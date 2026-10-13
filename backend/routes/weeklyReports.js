const express = require('express');
const router = express.Router();
const {
  getReports, getReport,
  createOrUpdateDraft, submitReport,
  bureauAdminSubmit, bureauRejectReport, acceptReport,
  rejectReport, getCurrentWeekStatus,
  exportReport, exportConsolidated, grantDeadlineOverride,
  getLastReportValues
} = require('../controllers/weeklyReportController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// View reports — all authenticated users (filtered by role in controller)
router.get('/', getReports);
router.get('/current-week', getCurrentWeekStatus);
router.get('/project/:projectId/last-values', getLastReportValues);
router.get('/:id', getReport);

// Bureau user — create draft or update draft
router.post('/',
  authorize('bureau_user', 'bureau_technical_admin', 'bureau_super_admin'),
  createOrUpdateDraft
);

// Bureau user — submit edit report to bureau field admin
router.put('/:id',
  authorize('bureau_user', 'bureau_technical_admin', 'bureau_super_admin'),
  createOrUpdateDraft
);

// Bureau user — submit draft to bureau field admin
router.put('/:id/submit',
  authorize('bureau_user', 'bureau_technical_admin', 'bureau_super_admin'),
  submitReport
);

// Bureau technical admin — consolidate and forward to GEE
router.put('/:id/bureau-submit',
  authorize('bureau_technical_admin', 'bureau_super_admin'),
  bureauAdminSubmit
);

// GEE technical admin — accept
router.put('/:id/accept',
  authorize('gee_technical_admin', 'gee_super_admin'),
  acceptReport
);

// Bureau technical admin — reject back to user with observation
router.put('/:id/bureau-reject',
  authorize('bureau_technical_admin', 'bureau_super_admin'),
  bureauRejectReport
);

// GEE technical admin — reject with observation
router.put('/:id/reject',
  authorize('gee_technical_admin', 'gee_super_admin'),
  rejectReport
);

//GEE Consolidate Excel Exportation
router.get('/export/consolidated',
  authorize('gee_technical_admin', 'gee_super_admin'),
  exportConsolidated
);

//GEE Excel Exportation
router.get('/:id/export',
  authorize('gee_technical_admin', 'gee_super_admin'),
  exportReport
);

//Override Deadline
router.put('/:id/grant-override',
  authorize('gee_super_admin'),
  grantDeadlineOverride
);

module.exports = router;