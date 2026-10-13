const express = require('express');
const router = express.Router();
const {
  getBureaus, getBureau, createBureau, updateBureau,
  addCell, updateCell, deleteCell
} = require('../controllers/bureauController');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

router.get('/', authorize('gee_super_admin', 'gee_rh_admin', 'gee_finance_admin', 'gee_technical_admin', 'bureau_super_admin', 'bureau_technical_admin'), getBureaus);
router.get('/:id', authorize('gee_super_admin', 'gee_rh_admin', 'gee_finance_admin', 'gee_technical_admin', 'bureau_super_admin', 'bureau_technical_admin'), getBureau);
router.post('/', authorize('gee_super_admin'), createBureau);
router.put('/:id', authorize('gee_super_admin'), updateBureau)

// Cell management
router.post('/:id/cells', authorize('gee_super_admin', 'bureau_super_admin'), addCell);
router.put('/:id/cells/:cellId', authorize('gee_super_admin', 'bureau_super_admin'), updateCell);
router.delete('/:id/cells/:cellId', authorize('gee_super_admin', 'bureau_super_admin'), deleteCell);

module.exports = router;
