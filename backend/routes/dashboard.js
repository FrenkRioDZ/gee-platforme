const express = require('express');
const router = express.Router();
const { geeDashboard, bureauDashboard, exportWeekly, weeklyHistory, graphData } = require('../controllers/dashboardController');
const { protect, authorize, geeOnly, bureauOnly } = require('../middleware/auth');

router.use(protect);

// GEE side
router.get('/gee', geeOnly, geeDashboard);
router.get('/gee/export', geeOnly, exportWeekly);
router.get('/gee/history', geeOnly, weeklyHistory);
router.get('/graphs', graphData);

// Bureau side
router.get('/bureau', bureauOnly, bureauDashboard);
router.get('/bureau/history', bureauOnly, weeklyHistory);

module.exports = router;
