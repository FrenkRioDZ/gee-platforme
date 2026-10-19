const express = require('express');
const router = express.Router();
const {
  getProjects, getProject, createProject,
  updateProject, deleteProject, getProjectTypes
} = require('../controllers/projectController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// All authenticated users can view projects (filtered by role in controller)
router.get('/', getProjects);
router.get('/types', getProjectTypes);
router.get('/:id', getProject);

// Bureau super admin creates; GEE super admin may also update and delete
router.post('/', authorize('bureau_super_admin'), createProject); // project belongs to the creator's bureau — GEE has none
router.put('/:id', authorize('bureau_super_admin', 'gee_super_admin'), updateProject);
router.delete('/:id', authorize('gee_super_admin'), deleteProject);

module.exports = router;
