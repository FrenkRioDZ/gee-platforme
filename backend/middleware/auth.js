const jwt = require('jsonwebtoken');
const User = require('../models/User');

const isDev = process.env.NODE_ENV !== 'production';
const log = (...args) => { if (isDev) console.log(...args); };

const protect = async (req, res, next) => {
  try {
    log('[protect] incoming:', req.method, req.path);

    // Prefer httpOnly cookie; fall back to Bearer header during migration
    let token = req.cookies?.accessToken;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) return res.status(401).json({ message: 'Non authentifié' });

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256']
    });

    // Reject refresh tokens presented as access tokens
    if (decoded.type && decoded.type !== 'access') {
      return res.status(401).json({ message: 'Token invalide' });
    }

    const user = await User.findById(decoded.id)
      .select('-password -refreshToken')
      .populate('bureau', 'name emailDomain');

    if (!user)          return res.status(401).json({ message: 'Utilisateur introuvable' });
    if (!user.isActive) return res.status(401).json({ message: 'Compte désactivé' });

    // Invalidate tokens issued before the last password change
    if (user.passwordChangedAt && decoded.iat) {
      const changedAtSec = Math.floor(new Date(user.passwordChangedAt).getTime() / 1000);
      if (decoded.iat < changedAtSec) {
        return res.status(401).json({ message: 'Session expirée — reconnectez-vous' });
      }
    }

    // Bureau users must have a valid bureau — controllers assume req.user.bureau._id
    if (user.role.startsWith('bureau_') && !user.bureau?._id) {
      return res.status(403).json({ message: 'Aucun bureau associé à ce compte' });
    }

    req.user = user;
    next();
  } catch (err) {
    log('[protect] error:', err.message);
    return res.status(401).json({ message: 'Token invalide ou expiré' });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Accès refusé — permissions insuffisantes' });
  }
  next();
};

const geeOnly = (req, res, next) => {
  if (!req.user?.role?.startsWith('gee_')) {
    return res.status(403).json({ message: 'Accès réservé au GEE' });
  }
  next();
};

const bureauOnly = (req, res, next) => {
  if (!req.user?.role?.startsWith('bureau_')) {
    return res.status(403).json({ message: 'Accès réservé aux bureaux' });
  }
  next();
};

module.exports = { protect, authorize, geeOnly, bureauOnly };