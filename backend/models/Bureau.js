const mongoose = require('mongoose');

const cellSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const bureauSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    enum: [
      'SETAM', 'BEHA', 'BEREG', 'BREP',
      'ENRI_OUEST', 'BEET_BATNA', 'BETP_BECHAR',
      'BEMILA', 'BER_MSILA', 'SATO', 'MHT', 'GART_ANNABA'
    ]
  },
  fullName: { type: String, required: true },
  emailDomain: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  cells: [cellSchema],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.models['Bureau'] || mongoose.model('Bureau', bureauSchema);
