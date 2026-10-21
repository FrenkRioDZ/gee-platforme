const mongoose = require('mongoose');
const Project = require('../models/Project');
const Bureau = require('../models/Bureau');

// Helper
const buildSpecs = (raw) => {
  const specs = new Map();
  if (!raw || typeof raw !== 'object') return specs;
  for (const [key, val] of Object.entries(raw)) {
    if (val === null || val === undefined || val === '') continue;
    const n = Number(val);
    if (!Number.isNaN(n)) specs.set(key, n);
  }
  return specs;
};

// ─── GET PROJECTS ──────────────────────────────────────────────
// Bureau users: see only their bureau's projects
const getProjects = async (req, res) => {
  try {
    let filter = {};

    if (req.query.type) filter.type = String(req.query.type);
    if (req.query.bureau && mongoose.Types.ObjectId.isValid(String(req.query.bureau))) {
      filter.bureau = new mongoose.Types.ObjectId(String(req.query.bureau));
    }
    if (req.user.role.startsWith('bureau_')) {
      // Lead bureau or participant — participants also file reports on the project
      delete filter.bureau;
      filter.$or = [{ bureau: req.user.bureau._id }, { participantBureaus: req.user.bureau._id }];
    }
    if (req.query.cell) filter.cell = req.query.cell;
    if (req.query.weekly) filter.hasWeeklyReport = req.query.weekly === 'true';
    if (req.query.active !== undefined) filter.isActive = req.query.active === 'true';

    const projects = await Project.find(filter)
      .populate('bureau', 'name emailDomain')
      .populate('createdBy', 'firstName lastName')
      .populate('assignedUsers', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── GET SINGLE PROJECT ────────────────────────────────────────
const getProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('bureau', 'name emailDomain cells')
      .populate('createdBy', 'firstName lastName');

    if (!project) return res.status(404).json({ message: 'Projet introuvable' });

    // Bureau users can only see projects their bureau leads or participates in
    const myBureau = req.user.bureau?._id?.toString();
    if (req.user.role.startsWith('bureau_') &&
      project.bureau._id.toString() !== myBureau &&
      !project.participantBureaus.some(id => id.toString() === myBureau)) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    res.json(project);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── CREATE PROJECT ────────────────────────────────────────────
// Bureau super admin only
const createProject = async (req, res) => {
  try {
    const {
      name, type, siteLocation,
      entrepriseRealisation, dateODS,
      delaisContractuel, cellId,
      montantMarche, AMO,
      hasWeeklyReport
    } = req.body;

    const bureau = await Bureau.findById(req.user.bureau._id);
    if (!bureau) return res.status(404).json({ message: 'Bureau introuvable' });

    if (cellId) {
      const cellExists = bureau.cells.id(cellId);
      if (!cellExists) return res.status(400).json({ message: 'Cellule invalide' });
    }

    const project = new Project({
      name,
      type,
      bureau: req.user.bureau._id,
      cell: cellId || null,
      siteLocation,
      entrepriseRealisation,
      dateODS,
      delaisContractuel,
      montantMarche: montantMarche != null && montantMarche !== '' ? Number(montantMarche) : null,
      AMO: AMO || '',
      specs: buildSpecs(req.body.specs),
      assignedUsers: req.body.assignedUsers || [],
      participantBureaus: req.body.participantBureaus || [],
      createdBy: req.user._id,
    });

    // Allow manual override of weekly report flag
    if (hasWeeklyReport !== undefined) {
      project.hasWeeklyReport = hasWeeklyReport;
    }

    await project.save();
    await Project.renumber(project.bureau);

    const populated = await Project.findById(project._id)
      .populate('bureau', 'name emailDomain')
      .populate('createdBy', 'firstName lastName');

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── UPDATE PROJECT ────────────────────────────────────────────
const updateProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Projet introuvable' });

    if (['bureau_super_admin', 'bureau_technical_admin'].includes(req.user.role) &&
      project.bureau.toString() !== req.user.bureau._id.toString()) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    const fields = [
      'name', 'siteLocation', 'entrepriseRealisation',
      'dateODS', 'delaisContractuel', 'isActive',
      'montantMarche', 'AMO',
      'hasWeeklyReport', 'hasMonthlyReport', 'hasQuarterlyReport',
      'assignedUsers',
    ];

    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        project[field] = req.body[field];
        project.markModified(field);
      }
    });

    if (req.body.specs !== undefined) {
      const incoming = buildSpecs(req.body.specs);
      for (const [key, val] of incoming) {
        project.specs.set(key, val);
      }
      for (const key of Object.keys(req.body.specs)) {
        const raw = req.body.specs[key];
        if (raw === null || raw === '') project.specs.delete(key);
      }
      project.markModified('specs');
    }
    if (req.body.montantMarche !== undefined) {
      project.montantMarche = req.body.montantMarche !== '' ? Number(req.body.montantMarche) : null;
    }

    // If type changed, re-trigger pre-save logic
    if (req.body.type && req.body.type !== project.type) {
      project.type = req.body.type;
    }

    if (req.body.cellId !== undefined) project.cell = req.body.cellId || null;

    await project.save();
    if (req.body.isActive !== undefined) await Project.renumber(project.bureau);

    const updated = await Project.findById(project._id)
      .populate('bureau', 'name emailDomain')
      .populate('createdBy', 'firstName lastName');

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── DELETE PROJECT ────────────────────────────────────────────
const deleteProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Projet introuvable' });

    project.isActive = false;
    await project.save();
    await Project.renumber(project.bureau);

    res.json({ message: 'Projet désactivé avec succès' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── GET PROJECT TYPES ─────────────────────────────────────────
const getProjectTypes = (req, res) => {
  res.json([
    { value: 'Industriel', label: 'Projet Industriel', hasWeekly: true },
    { value: 'Batiment', label: 'Bâtiments', hasWeekly: false },
    { value: 'Equipement_Public', label: 'Équipement Public', hasWeekly: false }
  ]);
};

module.exports = { getProjects, getProject, createProject, updateProject, deleteProject, getProjectTypes };