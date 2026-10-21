const mongoose = require('mongoose');

const PROJECT_TYPES = ['Industriel', 'Batiment', 'Equipement_Public'];

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  // "SATO 2" among the lead bureau's active projects, or just "SETAM" when it has one;
  // inactive projects have none. Maintained by Project.renumber, never edited by hand.
  code: { type: String, unique: true, sparse: true },
  type: { type: String, enum: PROJECT_TYPES, required: true },

  bureau: { type: mongoose.Schema.Types.ObjectId, ref: 'Bureau', required: true },
  participantBureaus: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Bureau' }],
  assignedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  cell: { type: mongoose.Schema.Types.ObjectId, default: null },

  siteLabel: { type: String },
  siteLocation: { type: String, required: true },

  entrepriseRealisation: { type: String, required: true },
  dateODS: { type: Date, required: true },
  delaisContractuel: { type: Number, required: true },

  montantMarche: { type: Number, default: null },
  AMO: { type: String, default: '' },

  specs: {
    type: Map,
    of: Number,
    default: () => new Map()
  },

  hasWeeklyReport: { type: Boolean, default: false },
  hasMonthlyReport: { type: Boolean, default: true },
  hasQuarterlyReport: { type: Boolean, default: true },

  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

projectSchema.pre('save', function (next) {
  if (this.isModified('type')) {
    this.hasWeeklyReport = this.type === 'Industriel';
    this.siteLabel = this.type === 'Industriel' ? "Site d'implantation du Silo" : "Site du Projet";
  }
  next();
});

// Recomputes the codes of one bureau's projects (call after a project is created,
// switched on/off or deleted). apply: false only returns what it would write.
// shortcut: two renumbers of the same bureau at the same instant can hit the unique index; fine at a few edits a day.
projectSchema.statics.renumber = async function (bureauId, { apply = true } = {}) {
  const [bureau, active] = await Promise.all([
    mongoose.model('Bureau').findById(bureauId).select('name'),
    this.find({ bureau: bureauId, isActive: true }).sort({ createdAt: 1, _id: 1 }).select('name'),
  ]);
  const plan = active.map((p, i) => ({ _id: p._id, name: p.name, code: active.length > 1 ? `${bureau.name} ${i + 1}` : bureau.name }));
  if (apply) {
    // Clear first so swapping two numbers never collides on the unique index
    await this.updateMany({ bureau: bureauId }, { $unset: { code: 1 } });
    if (plan.length) await this.bulkWrite(plan.map(({ _id, code }) => ({ updateOne: { filter: { _id }, update: { $set: { code } } } })));
  }
  return plan;
};

// "SATO 1 · SILO BERRICHE OEB" — the name users and the client see
projectSchema.virtual('label').get(function () {
  return this.code ? `${this.code} · ${this.name}` : this.name;
});

module.exports = mongoose.models['Project'] || mongoose.model('Project', projectSchema);
module.exports.PROJECT_TYPES = PROJECT_TYPES;