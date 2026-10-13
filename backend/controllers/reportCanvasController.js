const ReportCanvas = require('../models/ReportCanvas');
const WeeklyReport = require('../models/WeeklyReport');

// ─── LIST ALL CANVASES ─────────────────────────────────────────
const getCanvases = async (req, res) => {
  try {
    const filter = {};
    if (req.query.projectType) filter.projectType = req.query.projectType;
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

    const canvases = await ReportCanvas.find(filter)
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json(canvases);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── GET SINGLE CANVAS ─────────────────────────────────────────
const getCanvas = async (req, res) => {
  try {
    const canvas = await ReportCanvas.findById(req.params.id)
      .populate('createdBy', 'firstName lastName');

    if (!canvas) return res.status(404).json({ message: 'Canvas introuvable' });
    res.json(canvas);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── GET ACTIVE CANVAS FOR PROJECT TYPE (used by form) ────────
// Public to all authenticated users — bureau users need this to render the form
const getActiveCanvas = async (req, res) => {
  try {
    const { projectType } = req.params;

    const canvas = await ReportCanvas.findOne({ projectType, isActive: true })
      .sort({ createdAt: -1 });

    if (!canvas) return res.status(404).json({ message: 'Aucun canvas actif pour ce type de projet' });
    res.json(canvas);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── CREATE CANVAS ─────────────────────────────────────────────
const createCanvas = async (req, res) => {
  try {
    const { name, projectType, fields, isActive } = req.body;

    if (!name || !projectType || !fields?.length) {
      return res.status(400).json({ message: 'Nom, type de projet et champs sont requis' });
    }

    // Validate no duplicate field keys
    const keys = fields.map(f => f.key);
    if (new Set(keys).size !== keys.length) {
      return res.status(400).json({ message: 'Les clés de champs doivent être uniques' });
    }

    // If this canvas is set active, deactivate others of same projectType
    if (isActive) {
      await ReportCanvas.updateMany({ projectType, isActive: true }, { isActive: false });
    }

    const canvas = await ReportCanvas.create({
      name, projectType, fields,
      isActive: isActive ?? true,
      createdBy: req.user._id
    });

    res.status(201).json(canvas);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── UPDATE CANVAS ─────────────────────────────────────────────
const updateCanvas = async (req, res) => {
  try {
    const canvas = await ReportCanvas.findById(req.params.id);
    if (!canvas) return res.status(404).json({ message: 'Canvas introuvable' });

    const { name, projectType, fields, isActive } = req.body;

    // Validate no duplicate field keys
    if (fields) {
      const keys = fields.map(f => f.key);
      if (new Set(keys).size !== keys.length) {
        return res.status(400).json({ message: 'Les clés de champs doivent être uniques' });
      }
    }

    // If activating this canvas, deactivate others of same projectType
    if (isActive && !canvas.isActive) {
      await ReportCanvas.updateMany(
        { projectType: projectType || canvas.projectType, isActive: true, _id: { $ne: canvas._id } },
        { isActive: false }
      );
    }

    if (name)        canvas.name        = name;
    if (projectType) canvas.projectType = projectType;
    if (fields)      canvas.fields      = fields;
    if (isActive !== undefined) canvas.isActive = isActive;

    await canvas.save();
    res.json(canvas);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── SOFT DELETE CANVAS ────────────────────────────────────────
const deleteCanvas = async (req, res) => {
  try {
    const canvas = await ReportCanvas.findById(req.params.id);
    if (!canvas) return res.status(404).json({ message: 'Canvas introuvable' });

    const force = req.query.force === 'true';

    if (!force) {
      // Check if any active (non-accepted/rejected) reports reference this projectType
      const activeReports = await WeeklyReport.countDocuments({
        status: { $in: ['draft', 'submitted', 'bureau_approved'] },
        // Match by project type indirectly — canvas is global per type
      });

      // Warn if canvas is currently active
      if (canvas.isActive) {
        return res.status(400).json({
          message: 'Ce canvas est actif. Désactivez-le d\'abord ou utilisez force=true si le projet est terminé.',
          canForce: true
        });
      }
    }

    canvas.isDeleted = true;
    canvas.isActive  = false;
    await canvas.save();

    res.json({ message: 'Canvas supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getCanvases,
  getCanvas,
  getActiveCanvas,
  createCanvas,
  updateCanvas,
  deleteCanvas
};