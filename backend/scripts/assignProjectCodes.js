// Recomputes every project code with Project.renumber: active projects of a bureau
// with several become "SATO 1, SATO 2…" by creation date, a bureau with one active
// project gets just "SETAM", inactive projects get none. Safe to run again.
//
// Dry run (default, changes nothing):  node scripts/assignProjectCodes.js
// Apply:                               node scripts/assignProjectCodes.js --apply
require('dotenv').config();
const mongoose = require('mongoose');
const Bureau = require('../models/Bureau');
const Project = require('../models/Project');

const apply = process.argv.includes('--apply');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(apply ? '== MODE APPLICATION — les codes seront enregistrés\n' : '== SIMULATION — rien ne sera modifié (ajoutez --apply)\n');

  for (const bureau of await Bureau.find().sort({ name: 1 })) {
    const plan = await Project.renumber(bureau._id, { apply });
    if (!plan.length) continue;
    console.log(bureau.name);
    plan.forEach(({ code, name }) => console.log(`  ${code.padEnd(16)} ${name}`));
  }

  await mongoose.disconnect();
})().catch(err => { console.error(err); process.exit(1); });
