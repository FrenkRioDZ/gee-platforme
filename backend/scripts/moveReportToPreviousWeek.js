// Moves reports that the old week bug filed one week too late back to the week
// they were written for, and marks them late. Use only on IDs confirmed by the GEE
// (candidates come from findMisfiledReports.js).
//
// Dry run (default, changes nothing):  node scripts/moveReportToPreviousWeek.js <id> [<id> ...]
// Apply:                               node scripts/moveReportToPreviousWeek.js --apply <id> [<id> ...]
require('dotenv').config();
const mongoose = require('mongoose');
const WeeklyReport = require('../models/WeeklyReport');
const Project = require('../models/Project');
const { getWeekLabel, getWeekDeadline } = require('../utils/scheduler');

const DAY = 86400000;
const fmt = (d) => new Date(d).toLocaleDateString('fr-DZ', { timeZone: 'Africa/Algiers' });

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const ids = args.filter(a => a !== '--apply');

(async () => {
  if (!ids.length) {
    console.log('Usage: node scripts/moveReportToPreviousWeek.js [--apply] <id> [<id> ...]');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log(apply ? '== MODE APPLICATION — les rapports seront modifiés\n' : '== SIMULATION — rien ne sera modifié (ajoutez --apply)\n');

  let moved = 0;
  for (const id of ids) {
    const skip = (why) => console.log(`✗ ${id} ignoré : ${why}\n`);

    if (!mongoose.Types.ObjectId.isValid(id)) { skip('identifiant invalide'); continue; }
    const report = await WeeklyReport.findById(id);
    if (!report) { skip('rapport introuvable'); continue; }
    // The old bug never flagged these as late; a late flag means it was already moved — don't move twice
    if (report.isLate) { skip('déjà marqué en retard (déjà corrigé ?)'); continue; }
    const project = await Project.findById(report.project).select('name dateODS');
    if (!project) { skip('projet introuvable'); continue; }

    // Safety: the stored label must match the stored week, otherwise the data is not what we expect
    if (getWeekLabel(project.dateODS, report.weekEnd) !== report.weekLabel) {
      skip(`le libellé ${report.weekLabel} ne correspond pas à la semaine du ${fmt(report.weekEnd)}`);
      continue;
    }

    const newWeekEnd = getWeekDeadline(new Date(report.weekEnd.getTime() - 7 * DAY));
    const newWeekStart = new Date(newWeekEnd.getTime() - 6 * DAY);
    const newWeekLabel = getWeekLabel(project.dateODS, newWeekEnd);

    // Safety: the previous week must still be free for this project
    const taken = await WeeklyReport.findOne({
      project: report.project, _id: { $ne: report._id },
      $or: [{ weekLabel: newWeekLabel }, { weekEnd: newWeekEnd }]
    }).select('_id status');
    if (taken) { skip(`la semaine précédente a déjà un rapport (${taken._id}, ${taken.status})`); continue; }

    console.log(`✓ ${id} — ${project.name}`);
    console.log(`    ${report.weekLabel} (fin ${fmt(report.weekEnd)})  →  ${newWeekLabel} (fin ${fmt(newWeekEnd)}), marqué en retard`);

    if (apply) {
      report.weekLabel = newWeekLabel;
      report.weekStart = newWeekStart;
      report.weekEnd = newWeekEnd;
      report.isLate = true;
      await report.save();
      console.log('    → modifié');
    }
    console.log('');
    moved++;
  }

  console.log(`${moved} rapport(s) ${apply ? 'déplacé(s)' : 'à déplacer'} sur ${ids.length}`);
  await mongoose.disconnect();
})().catch(err => { console.error(err); process.exit(1); });
