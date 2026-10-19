const mongoose = require('mongoose');
const User = require('../models/User');
const Bureau = require('../models/Bureau');
const { sendEmail } = require('../utils/email');

// ─── HELPER:
const guardTarget = (actor, target) => {
  if (actor.role === 'gee_super_admin') return null;

  // Nobody below GEE may touch a GEE account
  if (target.role?.startsWith('gee_')) return 'Accès refusé';

  // Bureau admins are confined to their own bureau
  const targetBureau = target.bureau?._id || target.bureau;
  if (!actor.bureau?._id || !targetBureau ||
    targetBureau.toString() !== actor.bureau._id.toString()) {
    return 'Accès refusé';
  }
  return null;
};

// ─── HELPER: password strength (mirrors authController)
const validatePassword = (pwd) => {
  if (!pwd || typeof pwd !== 'string') return 'Mot de passe requis';
  if (pwd.length < 10) return 'Le mot de passe doit contenir au moins 10 caractères';
  if (pwd.length > 128) return 'Mot de passe trop long (128 caractères maximum)';
  if (!/[A-Za-z]/.test(pwd) || !/[0-9]/.test(pwd)) {
    return 'Le mot de passe doit contenir des lettres et des chiffres';
  }
  return null;
};

// ─── GET USERS
// GEE super admin: sees all users
// Bureau super admin: sees only their bureau's users
const getUsers = async (req, res) => {
  try {
    let filter = {};

    if (req.query.role) filter.role = String(req.query.role);
    if (req.query.field) filter.field = String(req.query.field);
    if (req.query.bureau && mongoose.Types.ObjectId.isValid(String(req.query.bureau))) {
      filter.bureau = new mongoose.Types.ObjectId(String(req.query.bureau));
    }
    if (req.user.role.startsWith('bureau_')) {
      filter.bureau = req.user.bureau._id;
    }
    if (req.query.cell) filter.cell = req.query.cell;

    const users = await User.find(filter)
      .select('-password -refreshToken')
      .populate('bureau', 'name emailDomain')
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (error) {
    console.error('userController error:', error);
    res.status(500).json({ message: 'Erreur serveur' });;
  }
};

// ─── GET SINGLE USER ───────────────────────────────────────────
const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -refreshToken')
      .populate('bureau', 'name emailDomain cells');

    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });

    const denied = guardTarget(req.user, user);
    if (denied) return res.status(403).json({ message: denied });

    res.json(user);
  } catch (error) {
    console.error('userController error:', error);
    res.status(500).json({ message: 'Erreur serveur' });;
  }
};

// ─── CREATE USER ───────────────────────────────────────────────
// Handled by authController.register — kept here for clarity
// Super admins POST to /api/auth/register

// ─── UPDATE USER ───────────────────────────────────────────────
const updateUser = async (req, res) => {
  try {
    const { firstName, lastName, role, field, cellId, isActive, language } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });

    const denied = guardTarget(req.user, user);
    if (denied) return res.status(403).json({ message: denied });

    // Only GEE super admin may change roles at all
    if (role && role !== user.role) {
      if (req.user.role !== 'gee_super_admin') {
        if (!role.startsWith('bureau_') || role === 'bureau_super_admin' || req.user.role !== 'bureau_super_admin') {
          return res.status(403).json({ message: 'Vous ne pouvez pas modifier ce rôle' });
        }
      }
      if (!User.ROLES.includes(role)) {
        return res.status(400).json({ message: 'Rôle invalide' });
      }
    }

    // Nobody may change their own role or active status
    if (user._id.toString() === req.user._id.toString()) {
      if (role && role !== user.role) {
        return res.status(403).json({ message: 'Vous ne pouvez pas modifier votre propre rôle' });
      }
      if (isActive === false) {
        return res.status(400).json({ message: 'Vous ne pouvez pas désactiver votre propre compte' });
      }
    }

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (role) user.role = role;
    if (field) user.field = field;
    if (cellId) user.cell = cellId;
    if (language) user.language = language;
    if (isActive !== undefined) {
      user.isActive = isActive;
      // Notify user if deactivated
      if (!isActive) {
        sendEmail({
          to: user.email,
          subject: 'Compte désactivé — GEE Plateforme',
          html: `<p>Bonjour ${user.firstName}, votre compte a été désactivé. Contactez votre administrateur.</p>`
        }).catch(() => {});
      }
    }

    await user.save({ validateBeforeSave: false });

    const updated = await User.findById(user._id)
      .select('-password -refreshToken')
      .populate('bureau', 'name emailDomain');

    res.json(updated);
  } catch (error) {
    console.error('userController error:', error);
    res.status(500).json({ message: 'Erreur serveur' });;
  }
};

// ─── DELETE USER ───────────────────────────────────────────────
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });

    // Cannot delete yourself
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Vous ne pouvez pas supprimer votre propre compte' });
    }

    const denied = guardTarget(req.user, user);
    if (denied) return res.status(403).json({ message: denied });

    await user.deleteOne();
    res.json({ message: 'Utilisateur supprimé' });
  } catch (error) {
    console.error('userController error:', error);
    res.status(500).json({ message: 'Erreur serveur' });;
  }
};

// ─── TOGGLE ACTIVATE/DEACTIVATE ────────────────────────────────
const toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Action impossible sur votre propre compte' });
    }

    const denied = guardTarget(req.user, user);
    if (denied) return res.status(403).json({ message: denied });

    user.isActive = !user.isActive;
    if (!user.isActive) user.refreshToken = null;
    await user.save({ validateBeforeSave: false });

    const status = user.isActive ? 'activé' : 'désactivé';

    sendEmail({
      to: user.email,
      subject: `Compte ${status} — GEE Plateforme`,
      html: `<p>Bonjour ${user.firstName}, votre compte a été <strong>${status}</strong>.</p>`
    });

    res.json({ message: `Utilisateur ${status}`, isActive: user.isActive });
  } catch (error) {
    console.error('userController error:', error);
    res.status(500).json({ message: 'Erreur serveur' });;
  }
};

// ─── RESET USER PASSWORD (admin) ───────────────────────────────
const resetUserPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;

    const pwdError = validatePassword(newPassword);
    if (pwdError) return res.status(400).json({ message: pwdError });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });

    const denied = guardTarget(req.user, user);
    if (denied) return res.status(403).json({ message: denied });

    user.password = newPassword;
    user.refreshToken = null;
    await user.save();

    sendEmail({
      to: user.email,
      subject: 'Mot de passe réinitialisé — GEE Plateforme',
      html: `
        <p>Bonjour ${user.firstName},</p>
        <p>Votre mot de passe a été réinitialisé par un administrateur.</p>
        <p>Connectez-vous et changez-le immédiatement.</p>
        <a href="${process.env.CLIENT_URL}/login"
           style="background:#1B5E20;color:white;padding:10px 20px;border-radius:4px;text-decoration:none">
          Se connecter
        </a>
      `
    }).catch(() => {});

    res.json({ message: 'Mot de passe réinitialisé avec succès' });
  } catch (error) {
    console.error('userController error:', error);
    res.status(500).json({ message: 'Erreur serveur' });;
  }
};

module.exports = { getUsers, getUser, updateUser, deleteUser, toggleUserStatus, resetUserPassword };
