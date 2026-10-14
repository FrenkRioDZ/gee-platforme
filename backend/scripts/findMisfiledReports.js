// READ-ONLY — lists reports that may have slid into the next week because they were
// saved after the Wednesday deadline (bug fixed in createOrUpdateDraft).
// Suspect = report created Thu–Sat of its week AND the project has no report the week before.
// Run from backend/: node scripts/findMisfiledReports.js
require('dotenv').config();
const mongoose = require('mongoose');
const WeeklyReport = require('../models/WeeklyReport');
require('../models/Project');
require('../models/Bureau');

const DAY = 86400000;

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const reports = await WeeklyReport.find()
    .select('project bureau weekLabel weekStart weekEnd createdAt status submittedAt')
    .populate('project', 'name').populate('bureau', 'name').lean();

  // project id -> set of week-end days that have a report
  const weeksByProject = new Map();
  for (const r of reports) {
    const key = String(r.project?._id);
    if (!weeksByProject.has(key)) weeksByProject.set(key, new Set());
    weeksByProject.get(key).add(new Date(r.weekEnd).toDateString());
  }

  const suspects = reports.filter(r => {
    const weekEnd = new Date(r.weekEnd);
    const daysBeforeDeadline = (weekEnd - new Date(r.createdAt)) / DAY;
    const prevWeek = new Date(weekEnd.getTime() - 7 * DAY).toDateString();
    return daysBeforeDeadline >= 4 && !weeksByProject.get(String(r.project?._id)).has(prevWeek);
  });

  console.table(suspects.map(r => ({
    id: String(r._id),
    projet: r.project?.name,
    bureau: r.bureau?.name,
    semaine: r.weekLabel,
    finSemaine: new Date(r.weekEnd).toLocaleDateString('fr-DZ'),
    creeLe: new Date(r.createdAt).toLocaleString('fr-DZ'),
    statut: r.status,
  })));
  console.log(`${suspects.length} rapport(s) à vérifier sur ${reports.length}`);
  await mongoose.disconnect();
})().catch(err => { console.error(err); process.exit(1); });
