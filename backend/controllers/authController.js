const User = require('../models/User');
const Bureau = require('../models/Bureau');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { sendEmail } = require('../utils/email');

// ─── HELPER: password strength
const validatePassword = (pwd) => {
  if (!pwd || typeof pwd !== 'string') {
    return 'Mot de passe requis';
  }
  if (pwd.length < 10) {
    return 'Le mot de passe doit contenir au moins 10 caractères';
  }
  if (pwd.length > 128) {
    return 'Mot de passe trop long (128 caractères maximum)';
  }
  if (!/[A-Za-z]/.test(pwd) || !/[0-9]/.test(pwd)) {
    return 'Le mot de passe doit contenir des lettres et des chiffres';
  }
  return null;
};

// ─── REGISTER
// Called by super admins (GEE or Bureau) to create users
const register = async (req, res) => {
  try {
    const { firstName, lastName, email, password, role, field, bureauId, cellId } = req.body;

    // ── SECURITY: creator may only assign roles they're allowed to ──
    const creator = req.user;

    if (creator.role === 'bureau_super_admin') {
      // Bureau admins may only create bureau_* users, inside their own bureau
      if (!role?.startsWith('bureau_')) {
        return res.status(403).json({ message: 'Rôle non autorisé' });
      }
      if (role === 'bureau_super_admin') {
        return res.status(403).json({ message: 'Rôle non autorisé' });
      }
      if (!bureauId || !creator.bureau?._id ||
        bureauId.toString() !== creator.bureau._id.toString()) {
        return res.status(403).json({ message: 'Bureau non autorisé' });
      }
    } else if (creator.role !== 'gee_super_admin') {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    if (!role || !User.ROLES.includes(role)) {
      return res.status(400).json({ message: 'Rôle invalide' });
    }
    if (!firstName || !lastName || !email) {
      return res.status(400).json({ message: 'Champs obligatoires manquants' });
    }

    // 1. Check email already exists
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email déjà utilisé' });

    // 2. Validate professional email domain matches bureau
    if (bureauId) {
      const bureau = await Bureau.findById(bureauId);
      if (!bureau) return res.status(404).json({ message: 'Bureau introuvable' });
    }

    const emailFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailFormat.test(email)) {
      return res.status(400).json({ message: 'Format d\'email invalide' });
    }

    // 3. GEE side users have no bureau
    if (role.startsWith('gee_') && bureauId) {
      return res.status(400).json({ message: 'Les utilisateurs GEE ne sont pas liés à un bureau' });
    }

    // 4. Bureau side users must have a bureau
    if (role.startsWith('bureau_') && !bureauId) {
      return res.status(400).json({ message: 'Un bureau est requis pour ce rôle' });
    }

    // 5. Field roles must have a field
    const fieldRoles = ['gee_rh_admin', 'gee_finance_admin', 'gee_technical_admin',
      'bureau_rh_admin', 'bureau_finance_admin', 'bureau_technical_admin'];
    if (fieldRoles.includes(role) && !field) {
      return res.status(400).json({ message: 'Un domaine (RH/Finance/Technical) est requis' });
    }

    const pwdError = validatePassword(password);
    if (pwdError) return res.status(400).json({ message: pwdError });

    const user = await User.create({
      firstName, lastName, email, password,
      role, field: field || null,
      bureau: bureauId || null,
      cell: cellId || null,
      isEmailVerified: true
    });

    // Notify user by email
    sendEmail({
      to: email,
      subject: 'Bienvenue sur la Plateforme GEE',
      html: `
        <h2>Bienvenue ${firstName} ${lastName},</h2>
        <p>Votre compte a été créé sur la <strong>Plateforme GEE</strong>.</p>
        <p><strong>Email :</strong> ${email}</p>
        <p>Connectez-vous et changez votre mot de passe dès que possible.</p>
        <a href="${process.env.CLIENT_URL}/login" 
           style="background:#1B5E20;color:white;padding:10px 20px;border-radius:4px;text-decoration:none">
          Se connecter
        </a>
      `
    }).catch(() => { });

    res.status(201).json({
      message: 'Utilisateur créé avec succès',
      user: {
        id: user._id,
        fullName: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('register error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ─── LOGIN ─────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email })
      .select('+password')
      .populate('bureau', 'name emailDomain');
    if (!user) return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    if (!user.isActive) return res.status(403).json({ message: 'Compte désactivé — contactez l\'administrateur' });
    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);
    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      accessToken,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        field: user.field,
        bureau: user.bureau,
        language: user.language
      }
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── REFRESH TOKEN ─────────────────────────────────────────────
const refreshToken = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) return res.status(401).json({ message: 'Token de rafraîchissement manquant' });
    const decoded = verifyRefreshToken(token);
    const user = await User.findById(decoded.id);
    if (!user || user.refreshToken !== token) {
      return res.status(401).json({ message: 'Token invalide' });
    }
    const newAccessToken = generateAccessToken(user._id, user.role);
    const newRefreshToken = generateRefreshToken(user._id);
    user.refreshToken = newRefreshToken;
    await user.save({ validateBeforeSave: false });
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    res.json({ accessToken: newAccessToken });
  } catch (error) {
    res.status(401).json({ message: 'Token expiré ou invalide' });
  }
};

// ─── LOGOUT ────────────────────────────────────────────────────
const logout = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+password');
    if (user) {
      user.refreshToken = null;
      await user.save({ validateBeforeSave: false });
    }
    res.clearCookie('refreshToken');
    res.json({ message: 'Déconnexion réussie' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── GET ME ────────────────────────────────────────────────────
const getMe = async (req, res) => {
  res.json({ user: req.user });
};

// ─── CHANGE PASSWORD ───────────────────────────────────────────
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const pwdError = validatePassword(newPassword);
    if (pwdError) return res.status(400).json({ message: pwdError });
    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) return res.status(400).json({ message: 'Mot de passe actuel incorrect' });
    user.password = newPassword;
    user.passwordChangedAt = new Date();
    user.refreshToken = null;
    await user.save();
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    res.json({ message: 'Mot de passe modifié — veuillez vous reconnecter' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { register, login, refreshToken, logout, getMe, changePassword, validatePassword };
