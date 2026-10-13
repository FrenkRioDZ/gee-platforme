const mongoose = require('mongoose');

const rejectionEntrySchema = new mongoose.Schema({
  source: { type: String, enum: ['bureau', 'gee'], required: true },
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  note: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const weeklyReportSchema = new mongoose.Schema({
  // ── Identity / relations  ──────────────────────────
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  bureau: { type: mongoose.Schema.Types.ObjectId, ref: 'Bureau', required: true },

  // ── Week  ───────────────────────────────────────────
  weekLabel: { type: String, required: true },
  weekStart: { type: Date, required: true },
  weekEnd: { type: Date, required: true },

  // ── Workflow state  ──────────────────────────────────
  status: {
    type: String,
    enum: ['draft', 'submitted', 'bureau_approved', 'bureau_rejected', 'accepted', 'rejected'],
    default: 'draft'
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  submittedAt: Date,
  bureauApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  bureauApprovedAt: Date,
  geeReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  geeReviewedAt: Date,

  // ── Lateness / override  ─────────────────────────────
  isLate: { type: Boolean, default: false },
  deadlineOverride: {
    grantedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    grantedAt: Date,
    expiresAt: Date
  },

  // ── Rejection attribution ───────────────────────────
  rejectionHistory: [rejectionEntrySchema],
  rejectionNote: String,

  // ── CANVAS-DRIVEN DATA (dynamic) ────────────────────────────

  values: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: () => new Map()
  },

  // ── Canvas versioning (fixed, new) ──────────────────────────

  canvasVersion: { type: mongoose.Schema.Types.ObjectId, ref: 'ReportCanvas' }

}, { timestamps: true });

weeklyReportSchema.index({ project: 1, bureau: 1, weekLabel: 1 }, { unique: true });

module.exports = mongoose.model('WeeklyReport', weeklyReportSchema);