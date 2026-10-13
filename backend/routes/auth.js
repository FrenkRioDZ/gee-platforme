const express = require('express');
const router = express.Router();
const { register, login, refreshToken, logout, getMe, changePassword } = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 8,
    message: { message: 'Trop de tentatives — réessayez dans 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true
});

router.post('/register', protect, authorize('gee_super_admin', 'bureau_super_admin'), register);
router.post('/login', loginLimiter, login);
router.post('/refresh', refreshToken);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/change-password', protect, changePassword);

module.exports = router;
