const express = require('express');
const router = express.Router();
const {
  getCanvases, getCanvas, getActiveCanvas,
  createCanvas, updateCanvas, deleteCanvas
} = require('../controllers/reportCanvasController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// All authenticated
router.get('/active/:projectType', getActiveCanvas);

// GEE super admin only
router.get('/',      authorize('gee_super_admin'), getCanvases);
router.get('/:id',   authorize('gee_super_admin'), getCanvas);
router.post('/',     authorize('gee_super_admin'), createCanvas);
router.put('/:id',   authorize('gee_super_admin'), updateCanvas);
router.delete('/:id', authorize('gee_super_admin'), deleteCanvas);

module.exports = router;
