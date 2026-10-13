const mongoose = require('mongoose');

const fieldSchema = new mongoose.Schema({
  key: { type: String, required: true },
  label: { type: String, required: true },
  type: {
    type: String,
    enum: ['number', 'text', 'textarea', 'select', 'boolean'],
    required: true
  },
  required: { type: Boolean, default: false },
  unit: { type: String, default: '' },
  cumulative: { type: Boolean, default: false },
  section: { type: String, default: '' },
  page: { type: Number, default: 1 },
  order: { type: Number, default: 0 },
  options: [{ type: String }],
}, { _id: false });

const reportCanvasSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  projectType: {
    type: String,
    enum: ['Industriel', 'Batiment', 'Equipement_Public'],
    required: true
  },
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
  fields: [fieldSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

reportCanvasSchema.pre(/^find/, function (next) {
  if (this.getFilter().isDeleted === undefined) {
    this.where({ isDeleted: false });
  }
  next();
});

module.exports = mongoose.model('ReportCanvas', reportCanvasSchema);