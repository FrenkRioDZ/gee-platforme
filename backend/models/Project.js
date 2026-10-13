const mongoose = require('mongoose');

const PROJECT_TYPES = ['Industriel', 'Batiment', 'Equipement_Public'];

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
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

module.exports = mongoose.models['Project'] || mongoose.model('Project', projectSchema);
module.exports.PROJECT_TYPES = PROJECT_TYPES;