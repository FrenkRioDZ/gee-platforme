// READ-ONLY — run on the production server before deploying, paste the output back.
// Prints only counts and server settings (no names, no report values).
// Run from backend/: node scripts/checkDeployReadiness.js
require('dotenv').config();
const mongoose = require('mongoose');
const WeeklyReport = require('../models/WeeklyReport');

const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const reports = await WeeklyReport.find()
    .select('project weekEnd weekStart status isLate submittedAt firstSubmittedAt deadlineOverride createdAt')
    .lean();

  // 1. Server clock — week boundaries are computed in the server's local time
  console.log('== Serveur');
  console.log('Fuseau horaire :', Intl.DateTimeFormat().resolvedOptions().timeZone,
    '| décalage UTC (min) :', -new Date().getTimezoneOffset());

  // 2. Which weekday/time do stored weeks end on? Must all be "Mer 23:59" in Algeria time
  const fmt = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Algiers', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const endings = {};
  for (const r of reports) {
    const key = fmt.format(new Date(r.weekEnd));
    endings[key] = (endings[key] || 0) + 1;
  }
  console.log('\n== Fin de semaine stockée (heure Algérie) -> nombre de rapports');
  console.table(endings);

  // 3. Two reports for the same project in the same calendar week (sign of the old week bug)
  const perWeek = {};
  for (const r of reports) {
    const key = `${r.project}|${new Date(r.weekEnd).toISOString().slice(0, 10)}`;
    perWeek[key] = (perWeek[key] || 0) + 1;
  }
  const dupes = Object.values(perWeek).filter(n => n > 1).length;

  // 4. General shape of the data
  const byStatus = {};
  reports.forEach(r => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });
  console.log('\n== Rapports par statut');
  console.table(byStatus);

  const createdDays = {};
  reports.forEach(r => {
    const d = DAYS[new Date(r.createdAt).getDay()];
    createdDays[d] = (createdDays[d] || 0) + 1;
  });

  console.log('\n== Divers');
  console.table({
    'Total rapports': reports.length,
    'Doublons projet + semaine': dupes,
    'En retard (isLate)': reports.filter(r => r.isLate).length,
    'Sans weekStart': reports.filter(r => !r.weekStart).length,
    'Soumis sans firstSubmittedAt (normal avant déploiement)':
      reports.filter(r => r.submittedAt && !r.firstSubmittedAt).length,
    'Extensions déjà accordées': reports.filter(r => r.deadlineOverride?.grantedAt).length,
  });
  console.log('\n== Jour de création des rapports');
  console.table(createdDays);

  await mongoose.disconnect();
})().catch(err => { console.error(err); process.exit(1); });
