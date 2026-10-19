const cron = require('node-cron');
const WeeklyReport = require('../models/WeeklyReport');
const Project = require('../models/Project');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendEmail, emailTemplates } = require('./email');

let appInstance = null;

const DAY_MS = 86400000;

// Deadline moved from Wednesday to Tuesday (client request, Oct 2026). Weeks up to
// this one keep their Wednesday deadline; the next week runs Thu 22/10 → Tue 27/10,
// then every week runs Wednesday → Tuesday 23:59:59.999.
const LAST_WEDNESDAY_DEADLINE = new Date(2026, 9, 21, 23, 59, 59, 999);

// Next `weekday` (0=Sun..6=Sat) on or after `date`, at 23:59:59.999
const nextWeekdayEnd = (date, weekday) => {
  const d = new Date(date);
  d.setDate(d.getDate() + (weekday - d.getDay() + 7) % 7);
  d.setHours(23, 59, 59, 999);
  return d;
};

// Deadline (= week end) of the week containing `date`
const getWeekDeadline = (date = new Date()) => {
  const wednesday = nextWeekdayEnd(date, 3);
  return wednesday <= LAST_WEDNESDAY_DEADLINE ? wednesday : nextWeekdayEnd(date, 2);
};

// First moment of the week ending at `weekEnd`: the day after the previous deadline
const getWeekStart = (weekEnd) => {
  const start = getWeekDeadline(new Date(new Date(weekEnd).getTime() - 7 * DAY_MS));
  start.setDate(start.getDate() + 1);
  start.setHours(0, 0, 0, 0);
  return start;
};

// "Semaine N" counts deadlines since the project's ODS week. Rounding absorbs the
// 6-day transition week, so numbering continues without a gap or a repeat.
const getWeekLabel = (dateODS, referenceDate = new Date()) => {
  if (!dateODS) return 'Semaine 1';
  const weeks = Math.round((getWeekDeadline(referenceDate) - getWeekDeadline(dateODS)) / (7 * DAY_MS));
  return `Semaine ${Math.max(weeks + 1, 1)}`;
};

// Cron jobs fire on both the old and new days; only the one matching the real deadline acts
const hoursToDeadline = () => (getWeekDeadline() - Date.now()) / 3600000;

function initScheduler(app) {
  appInstance = app;

  // ─── 08:00 the day before and the day of the deadline — reminders ──
  cron.schedule('0 8 * * 1,2,3', async () => {
    if (hoursToDeadline() > 40) return;
    console.log('[CRON] Reminder — running');
    await sendReminders();
  });

  // ─── Deadline day 23:59 — Close + mark late ──────────────────
  cron.schedule('59 23 * * 2,3', async () => {
    if (hoursToDeadline() > 1) return;
    console.log('[CRON] Deadline passed — marking late reports');
    await markLateReports();
    await notifyMissingReports();
  });
}

async function sendReminders() {
  try {
    const deadline = getWeekDeadline();
    const projects = await Project.find({ hasWeeklyReport: true, isActive: true }).populate('bureau');

    for (const project of projects) {
      const weekLabel = getWeekLabel(project.dateODS);
      const existing = await WeeklyReport.findOne({ project: project._id, weekLabel });
      if (existing && existing.status !== 'draft') continue;

      const users = await User.find({
        bureau: project.bureau._id,
        role: { $in: ['bureau_user', 'bureau_technical_admin'] },
        isActive: true
      });

      for (const user of users) {
        const template = emailTemplates.weeklyReminder(user.firstName, deadline);
        await sendEmail({ to: user.email, ...template });

        const title = 'Rappel — Rapport hebdomadaire';
        const message = `Votre rapport pour le projet ${project.name} doit être soumis avant le ${deadline.toLocaleDateString('fr-DZ')}`;

        await Notification.create({
          recipient: user._id,
          type: 'report_reminder',
          title,
          message,
          relatedReport: existing?._id || null
        });

        if (appInstance) {
          const sendNotification = appInstance.get('sendNotification');
          if (sendNotification) {
            sendNotification(user._id.toString(), { type: 'report_reminder', title, message, reportId: existing?._id || null });
          }
        }
      }
    }
    console.log('[CRON] Reminders sent');
  } catch (err) {
    console.error('[CRON] Reminder error:', err.message);
  }
}

async function markLateReports() {
  try {
    const projects = await Project.find({ hasWeeklyReport: true, isActive: true });

    for (const project of projects) {
      const weekLabel = getWeekLabel(project.dateODS);
      const report = await WeeklyReport.findOne({ project: project._id, weekLabel });

      if (report && ['draft', 'submitted'].includes(report.status)) {
        report.isLate = true;
        await report.save();

        if (appInstance) {
          const emitToUser = appInstance.get('emitToUser');
          if (emitToUser && report.submittedBy) {
            emitToUser(report.submittedBy.toString(), 'report:updated', { reportId: report._id, status: report.status });
          }
        }
      }
    }
    console.log('[CRON] Late reports marked');
  } catch (err) {
    console.error('[CRON] Late marking error:', err.message);
  }
}

async function notifyMissingReports() {
  try {
    const projects = await Project.find({ hasWeeklyReport: true, isActive: true }).populate('bureau', 'name');
    const missing = [];

    for (const project of projects) {
      const weekLabel = getWeekLabel(project.dateODS);
      const existing = await WeeklyReport.findOne({ project: project._id, weekLabel });
      if (!existing) {
        missing.push({ projectName: project.name, bureauName: project.bureau?.name || '—', weekLabel });
      }
    }

    if (missing.length === 0) {
      console.log('[CRON] No missing reports this week');
      return;
    }

    const geeAdmins = await User.find({
      role: { $in: ['gee_technical_admin', 'gee_super_admin'] },
      isActive: true
    });

    const summary = missing.map(m => `${m.projectName} (${m.bureauName})`).join(', ');
    const title = `${missing.length} rapport(s) non soumis`;
    const message = `Aucun rapport n'a été créé pour : ${summary}`;

    for (const gee of geeAdmins) {
      await Notification.create({
        recipient: gee._id,
        type: 'report_missing',
        title,
        message,
        relatedReport: null
      });

      // Live push — same pattern as notify() in weeklyReportController.js
      if (appInstance) {
        const sendNotification = appInstance.get('sendNotification');
        if (sendNotification) {
          sendNotification(gee._id.toString(), { type: 'report_missing', title, message, reportId: null });
        }
      }
    }
    console.log(`[CRON] ${missing.length} missing report(s) notified to GEE`);
  } catch (err) {
    console.error('[CRON] Missing report notification error:', err.message);
  }
}

module.exports = { getWeekLabel, getWeekDeadline, getWeekStart, initScheduler };