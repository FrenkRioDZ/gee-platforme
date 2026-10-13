const Bureau = require('../models/Bureau');

// ─── GET ALL BUREAUS ───────────────────────────────────────────
const getBureaus = async (req, res) => {
  try {
    const bureaus = await Bureau.find().sort({ name: 1 });
    res.json(bureaus);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── GET SINGLE BUREAU ─────────────────────────────────────────
const getBureau = async (req, res) => {
  try {
    const bureau = await Bureau.findById(req.params.id);
    if (!bureau) return res.status(404).json({ message: 'Bureau introuvable' });
    res.json(bureau);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── CREATE BUREAU ─────────────────────────────────────────────
// GEE super admin only
const createBureau = async (req, res) => {
  try {
    const { name, fullName, emailDomain } = req.body;

    const exists = await Bureau.findOne({ $or: [{ name }, { emailDomain }] });
    if (exists) return res.status(400).json({ message: 'Bureau ou domaine email déjà existant' });

    const bureau = await Bureau.create({ name, fullName, emailDomain });
    res.status(201).json(bureau);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── UPDATE BUREAU ─────────────────────────────────────────────
const updateBureau = async (req, res) => {
  try {
    const { fullName, emailDomain, isActive } = req.body;
    const bureau = await Bureau.findById(req.params.id);
    if (!bureau) return res.status(404).json({ message: 'Bureau introuvable' });

    if (fullName)    bureau.fullName    = fullName;
    if (emailDomain) bureau.emailDomain = emailDomain;
    if (isActive !== undefined) bureau.isActive = isActive;

    await bureau.save();
    res.json(bureau);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── ADD CELL TO BUREAU ────────────────────────────────────────
// Bureau super admin or GEE super admin
const addCell = async (req, res) => {
  try {
    const { name, location } = req.body;
    const bureau = await Bureau.findById(req.params.id);
    if (!bureau) return res.status(404).json({ message: 'Bureau introuvable' });

    // Bureau super admin can only manage their own bureau
    if (req.user.role === 'bureau_super_admin' &&
        req.user.bureau.toString() !== bureau._id.toString()) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    const cellExists = bureau.cells.find(c => c.name === name);
    if (cellExists) return res.status(400).json({ message: 'Cette cellule existe déjà' });

    bureau.cells.push({ name, location });
    await bureau.save();

    res.status(201).json(bureau);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── UPDATE CELL ───────────────────────────────────────────────
const updateCell = async (req, res) => {
  try {
    const { name, location, isActive } = req.body;
    const bureau = await Bureau.findById(req.params.id);
    if (!bureau) return res.status(404).json({ message: 'Bureau introuvable' });

    if (req.user.role === 'bureau_super_admin' &&
        req.user.bureau.toString() !== bureau._id.toString()) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    const cell = bureau.cells.id(req.params.cellId);
    if (!cell) return res.status(404).json({ message: 'Cellule introuvable' });

    if (name)     cell.name     = name;
    if (location) cell.location = location;
    if (isActive !== undefined) cell.isActive = isActive;

    await bureau.save();
    res.json(bureau);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── DELETE CELL ───────────────────────────────────────────────
const deleteCell = async (req, res) => {
  try {
    const bureau = await Bureau.findById(req.params.id);
    if (!bureau) return res.status(404).json({ message: 'Bureau introuvable' });

    if (req.user.role === 'bureau_super_admin' &&
        req.user.bureau.toString() !== bureau._id.toString()) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    bureau.cells = bureau.cells.filter(c => c._id.toString() !== req.params.cellId);
    await bureau.save();
    res.json({ message: 'Cellule supprimée', bureau });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getBureaus, getBureau, createBureau, updateBureau, addCell, updateCell, deleteCell };
