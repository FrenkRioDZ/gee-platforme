const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: [
      'report_submitted',
      'report_accepted',
      'report_rejected',
      'report_reminder',
      'report_late',
      'observation_added',
      'permission_granted',
      'permission_revoked'
    ],
    required: true
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  relatedReport: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WeeklyReport',
    default: null
  },
  isRead: { type: Boolean, default: false },
  readAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.models['Notification'] || mongoose.model('Notification', notificationSchema);
