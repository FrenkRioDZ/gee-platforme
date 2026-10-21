// Gives every project without a code its "BUREAU N" code, numbered per lead bureau
// by creation date, and sets each bureau's counter so new projects continue after it.
// Safe to run again: projects that already have a code are left alone.
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
    const projects = await Project.find({ bureau: bureau._id, code: null }).sort({ createdAt: 1, _id: 1 }).select('name');
    if (!projects.length) continue;

    let counter = bureau.projectCounter || 0;
    console.log(`${bureau.name}`);
    for (const p of projects) {
      const code = `${bureau.name} ${++counter}`;
      console.log(`  ${code.padEnd(16)} ${p.name}`);
      if (apply) await Project.updateOne({ _id: p._id }, { $set: { code } });
    }
    if (apply) await Bureau.updateOne({ _id: bureau._id }, { $set: { projectCounter: counter } });
  }

  await mongoose.disconnect();
})().catch(err => { console.error(err); process.exit(1); });
