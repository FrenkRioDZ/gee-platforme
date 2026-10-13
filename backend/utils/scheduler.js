const cron = require('node-cron');
const WeeklyReport = require('../models/WeeklyReport');
const Project = require('../models/Project');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendEmail, emailTemplates } = require('./email');

let appInstance = null;

const getWeekDeadline = (date = new Date()) => {
  const now = new Date(date);
  const day = now.getDay();
  const diff = (3 - day + 7) % 7;
  const wednesday = new Date(now);
  wednesday.setDate(now.getDate() + diff);
  wednesday.setHours(23, 59, 59, 999);
  return wednesday;
};

const getCycleStart = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = (day + 7 - 4) % 7;
  d.setDate(d.getDate() - diff);
  return d;
};

const getWeekLabel = (dateODS, referenceDate = new Date()) => {
  if (!dateODS) return 'Semaine 1';
  const projectCycleStart = getCycleStart(dateODS);
  const currentCycleStart = getCycleStart(referenceDate);
  const weekNumber = Math.round((currentCycleStart - projectCycleStart) / (7 * 86400000)) + 1;
  return `Semaine ${Math.max(weekNumber, 1)}`;
};

function initScheduler(app) {
  appInstance = app;

  // ─── TUESDAY 08:00 — First reminder ──────────────────────────
  cron.schedule('0 8 * * 2', async () => {
    console.log('[CRON] Tuesday reminder — running');
    await sendReminders();
  });

  // ─── WEDNESDAY 08:00 — Final reminder ────────────────────────
  cron.schedule('0 8 * * 3', async () => {
    console.log('[CRON] Wednesday final reminder — running');
    await sendReminders();
  });

  // ─── WEDNESDAY 00:00 — Open submission window ─────────────────
  cron.schedule('0 0 * * 3', async () => {
    console.log('[CRON] Submission window now OPEN');
  });

  // ─── WEDNESDAY 23:59 — Close + mark late ─────────────────────
  cron.schedule('59 23 * * 3', async () => {
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

module.exports = { getWeekLabel, getWeekDeadline, initScheduler };