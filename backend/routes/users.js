const express = require('express');
const router = express.Router();
const {
  getUsers, getUser, updateUser, deleteUser,
  toggleUserStatus, resetUserPassword
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');
const SUPER_ADMINS = ['gee_super_admin', 'bureau_super_admin', 'bureau_technical_admin'];

router.use(protect);

router.get('/', authorize(...SUPER_ADMINS), getUsers);
router.get('/:id', authorize(...SUPER_ADMINS), getUser);
router.put('/:id', authorize('gee_super_admin', 'bureau_super_admin'), updateUser);
router.delete('/:id', authorize('gee_super_admin', 'bureau_super_admin'), deleteUser);
router.patch('/:id/toggle-status', authorize('gee_super_admin', 'bureau_super_admin'), toggleUserStatus);
router.patch('/:id/reset-password', authorize('gee_super_admin', 'bureau_super_admin'), resetUserPassword);

module.exports = router;
