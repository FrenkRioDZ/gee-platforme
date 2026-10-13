const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Roles:
// GEE side:    gee_super_admin | gee_rh_admin | gee_finance_admin | gee_technical_admin
// Bureau side: bureau_super_admin | bureau_rh_admin | bureau_finance_admin | bureau_technical_admin | bureau_user

const ROLES = [
  'gee_super_admin',
  'gee_rh_admin',
  'gee_finance_admin',
  'gee_technical_admin',
  'bureau_super_admin',
  'bureau_rh_admin',
  'bureau_finance_admin',
  'bureau_technical_admin',
  'bureau_user'
];

const FIELDS = ['RH', 'Finance', 'Technical'];

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: { type: String, required: true, minlength: 10, select: false },
  role: { type: String, enum: ROLES, required: true },
  field: {
    type: String,
    enum: FIELDS,
    // required only for field-specific roles
    default: null
  },
  // For bureau-side users
  bureau: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bureau',
    default: null
  },
  cell: {
    type: mongoose.Schema.Types.ObjectId, // refers to embedded cell _id in Bureau
    default: null
  },
  isActive: { type: Boolean, default: true },
  isEmailVerified: { type: Boolean, default: false },
  refreshToken: { type: String, default: null },
  passwordChangedAt: { type: Date, default: null },
  language: { type: String, enum: ['fr', 'en', 'ar'], default: 'fr' },
  lastLogin: { type: Date, default: null }
}, { timestamps: true });

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  if (!this.isNew) this.passwordChangedAt = Date.now() - 1000;
  next();
});

// Compare password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Virtual full name
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

module.exports = mongoose.models['User'] || mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
module.exports.FIELDS = FIELDS;
