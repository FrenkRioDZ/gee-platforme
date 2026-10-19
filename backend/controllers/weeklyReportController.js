const mongoose = require('mongoose');
const WeeklyReport = require('../models/WeeklyReport');
const Project = require('../models/Project');
const ReportCanvas = require('../models/ReportCanvas');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Bureau = require('../models/Bureau');
const { sendEmail, emailTemplates } = require('../utils/email');
const { getWeekLabel, getWeekDeadline } = require('../utils/scheduler');
const { exportReportToExcel } = require('../utils/exportExcel');

// ─── HELPER: Send notification (in-app + email) ────────────────
const notify = async (req, recipientId, type, title, message, reportId = null, dataEvent = null) => {
  try {
    await Notification.create({
      recipient: recipientId,
      type, title, message,
      relatedReport: reportId
    });
    const sendNotification = req.app.get('sendNotification');
    if (sendNotification) {
      sendNotification(recipientId.toString(), { type, title, message, reportId });
    }
    if (dataEvent) {
      console.log('emitting report:updated to', recipientId);
      const emitToUser = req.app.get('emitToUser');
      if (emitToUser) emitToUser(recipientId.toString(), dataEvent.event, dataEvent.payload);
    }
  } catch (err) {
    console.error('Notification error:', err.message);
  }
};

// ─── HELPER: coerce a raw incoming value to the canvas field's declared type ──
// Mixed values in a Map don't auto-coerce like typed schema fields did, so we
// do it explicitly against the active canvas definition before writing.
const coerceValue = (rawValue, fieldDef) => {
  if (rawValue === undefined || rawValue === null || rawValue === '') return undefined;
  switch (fieldDef.type) {
    case 'number':
      const n = Number(rawValue);
      return Number.isNaN(n) ? undefined : n;
    case 'boolean':
      return rawValue === true || rawValue === 'true';
    case 'text':
    case 'textarea':
    case 'select':
    default:
      return String(rawValue);
  }
};

const buildValuesFromCanvas = (canvas, rawFields, existingValues = new Map()) => {
  const values = new Map(existingValues); // start from existing so partial updates don't wipe other pages
  const missingRequired = [];

  for (const fieldDef of canvas.fields) {
    const incoming = rawFields[fieldDef.key];
    if (incoming !== undefined) {
      const coerced = coerceValue(incoming, fieldDef);
      if (coerced === undefined) {
        values.delete(fieldDef.key);
      } else {
        values.set(fieldDef.key, coerced);
      }
    }
    if (fieldDef.required && (values.get(fieldDef.key) === undefined || values.get(fieldDef.key) === '')) {
      missingRequired.push(fieldDef.label || fieldDef.key);
    }
  }

  return { values, missingRequired };
};

// ─── Server-computed keys — never accepted from the client ─────
const DERIVED_KEYS = [
  'tauxConsommationDelais',
  'avance_remboursement_cumule',
  'taux_facturation_marche',
  'taux_encaissement_facturation',
  'taux_encaissement_marche',
  'taux_avance_encaisse',
  'delais_restant'
];

const MAX_NUMBER = 1e15;
const MAX_TEXT_LEN = 5000;

// ─── Strip derived keys + enforce canvas types and bounds ──────
const sanitizeValuesMap = (values, canvas) => {
  const fieldMap = new Map((canvas.fields || []).map(f => [f.key, f]));

  for (const key of Array.from(values.keys())) {
    // 1. Derived — always recomputed server-side below
    if (DERIVED_KEYS.includes(key)) { values.delete(key); continue; }

    // 2. Not defined in the active canvas
    const field = fieldMap.get(key);
    if (!field) { values.delete(key); continue; }

    const val = values.get(key);
    if (val === null || val === undefined || val === '') { values.delete(key); continue; }

    // 3. Type + bounds
    if (field.type === 'number') {
      const n = Number(val);
      if (!Number.isFinite(n) || n < 0 || n > MAX_NUMBER) { values.delete(key); continue; }
      values.set(key, n);
    } else if (field.type === 'boolean') {
      values.set(key, Boolean(val));
    } else if (field.type === 'select') {
      const opts = field.options || [];
      if (opts.length && !opts.includes(String(val))) { values.delete(key); continue; }
      values.set(key, String(val));
    } else {
      values.set(key, String(val).slice(0, MAX_TEXT_LEN));
    }
  }
  return values;
};

// ─── SPEC VALIDATION 
const SPEC_VALIDATION_PAIRS = [
  { specKey: 'cellules_pieux_prevus', reportKey: 'cellules_pieux_realises', label: 'Cellules — Pieux Réalisés' },
  { specKey: 'cellules_profondeur', reportKey: 'cellules_profondeur', label: 'Cellules — Profondeur des Pieux' },
  { specKey: 'tour_travail_pieux_prevus', reportKey: 'tour_travail_pieux_realises', label: 'Tour de travail — Pieux Réalisés' },
  { specKey: 'tour_travail_profondeur', reportKey: 'tour_travail_profondeur', label: 'Tour de travail — Profondeur' },
  { specKey: 'tour_travail_hauteur_prevue', reportKey: 'tour_travail_hauteur_realisee', label: 'Tour de travail — Hauteur Réalisée' },
  { specKey: 'tour_expedition_pieux_prevus', reportKey: 'tour_expedition_pieux_realises', label: "Tour d'expédition — Pieux Réalisés" },
  { specKey: 'tour_expedition_profondeur', reportKey: 'tour_expedition_profondeur', label: "Tour d'expédition — Profondeur" },
  { specKey: 'tour_expedition_hauteur_prevue', reportKey: 'tour_expedition_hauteur_realisee', label: "Tour d'expédition — Hauteur Réalisée" },
  { specKey: 'batteries_hauteur_prevue', reportKey: 'batterie1_hauteur', label: 'Batterie 1 — Hauteur Réalisée' },
  { specKey: 'batteries_hauteur_prevue', reportKey: 'batterie2_hauteur', label: 'Batterie 2 — Hauteur Réalisée' },
  { specKey: 'batteries_hauteur_prevue', reportKey: 'batterie3_hauteur', label: 'Batterie 3 — Hauteur Réalisée' },
];

const validateAgainstSpecs = (project, values) => {
  if (!project?.specs) return [];
  const messages = [];
  for (const { specKey, reportKey, label } of SPEC_VALIDATION_PAIRS) {
    const specVal = project.specs.get ? project.specs.get(specKey) : project.specs[specKey];
    const reportVal = values.get ? values.get(reportKey) : values[reportKey];
    if (specVal != null && reportVal != null && reportVal > specVal) {
      messages.push(`${label} (${reportVal}) dépasse le prévu (${specVal})`);
    }
  }
  return messages;
};

const getReports = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
  const skip = (page - 1) * limit;

  try {
    const filter = {};
    if (req.query.weekLabel) filter.weekLabel = String(req.query.weekLabel);
    // One status, or several comma-separated (e.g. draft,rejected,bureau_rejected)
    if (req.query.status) {
      const statuses = String(req.query.status).split(',');
      filter.status = statuses.length > 1 ? { $in: statuses } : statuses[0];
    }
    if (req.query.isLate) filter.isLate = req.query.isLate === 'true';
    if (req.query.project && mongoose.Types.ObjectId.isValid(String(req.query.project))) {
      filter.project = new mongoose.Types.ObjectId(String(req.query.project));
    }
    if (req.query.bureau && mongoose.Types.ObjectId.isValid(String(req.query.bureau))) {
      filter.bureau = new mongoose.Types.ObjectId(String(req.query.bureau));
    }
    // Calendar week (Thu→Wed) shared by all projects — any date inside the week works
    if (req.query.weekEnd && !Number.isNaN(Date.parse(String(req.query.weekEnd)))) {
      const weekEnd = getWeekDeadline(new Date(String(req.query.weekEnd)));
      const dayStart = new Date(weekEnd); dayStart.setHours(0, 0, 0, 0);
      filter.weekEnd = { $gte: dayStart, $lte: weekEnd };
    }
    // Project name search (escaped — user text must not become a regex)
    if (req.query.search && !filter.project) {
      const escaped = String(req.query.search).trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const projects = await Project.find({ name: { $regex: escaped, $options: 'i' } }).select('_id');
      filter.project = { $in: projects.map(p => p._id) };
    }
    if (req.user.role.startsWith('bureau_')) {
      filter.bureau = req.user.bureau._id;
    }
    const total = await WeeklyReport.countDocuments(filter);
    const reports = await WeeklyReport.find(filter)
      .populate('project', 'name type siteLocation')
      .populate('bureau', 'name')
      .populate('submittedBy', 'firstName lastName')
      .sort({ weekEnd: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);
    res.json({
      reports,
      pagination: { total, page, pages: Math.ceil(total / limit), limit }
    });

  } catch (error) {
    console.error('getReports error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ─── GET SINGLE REPORT 
const getReport = async (req, res) => {
  try {
    const report = await WeeklyReport.findById(req.params.id)
      .populate('project', 'name type siteLocation siteLabel entrepriseRealisation dateODS delaisContractuel montantMarche AMO BET specs')
      .populate('bureau', 'name emailDomain')
      .populate('submittedBy', 'firstName lastName email')
      .populate('bureauApprovedBy', 'firstName lastName email')
      .populate('geeReviewedBy', 'firstName lastName email')
      .populate('rejectionHistory.from', 'firstName lastName')
      .populate('canvasVersion');

    if (!report) return res.status(404).json({ message: 'Rapport introuvable' });

    if (req.user.role.startsWith('bureau_') &&
      report.bureau._id.toString() !== req.user.bureau._id.toString()) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    res.json(report);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── GET LAST SUBMITTED VALUES FOR PROJECT
const getLastReportValues = async (req, res) => {
  try {
    const { projectId } = req.params;

    // Bureau users may only read projects their bureau leads or participates in
    const project = await Project.findById(projectId).select('bureau participantBureaus');
    if (!project) return res.status(404).json({ message: 'Projet introuvable' });
    if (req.user.role.startsWith('bureau_')) {
      const allBureaus = [project.bureau, ...project.participantBureaus].map(id => id.toString());
      if (!allBureaus.includes(req.user.bureau._id.toString())) {
        return res.status(403).json({ message: 'Accès refusé' });
      }
    }

    const lastReport = await WeeklyReport.findOne({
      project: projectId,
      status: { $in: ['submitted', 'bureau_approved', 'accepted'] }
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!lastReport) return res.json({ values: null });

    res.json({ values: lastReport });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── CREATE / SAVE DRAFT 
const createOrUpdateDraft = async (req, res) => {
  try {
    const { projectId, ...fields } = req.body;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: 'Projet introuvable' });
    if (!project.hasWeeklyReport) return res.status(400).json({ message: "Ce projet n'a pas de rapport hebdomadaire" });
    if (!project.isActive) return res.status(400).json({ message: 'Projet inactif' });

    // Allow lead BET + all participant BETs
    const allBureaus = [project.bureau, ...project.participantBureaus].map(id => id.toString());
    if (!allBureaus.includes(req.user.bureau._id.toString())) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    if (req.user.role === 'bureau_user') {
      const isAssigned = project.assignedUsers
        ?.map(id => id.toString())
        .includes(req.user._id.toString());
      if (!isAssigned) {
        return res.status(403).json({
          message: 'Vous n\'êtes pas assigné à ce projet'
        });
      }
    }

    const canvas = await ReportCanvas.findOne({ projectType: project.type, isActive: true });
    if (!canvas) {
      return res.status(400).json({ message: "Aucun modèle de rapport (canvas) actif pour ce type de projet" });
    }

    let weekLabel = getWeekLabel(project.dateODS);
    let deadline = getWeekDeadline();
    let weekStart = new Date(deadline);
    weekStart.setDate(weekStart.getDate() - 6);

    // Editing an existing report keeps the week it was written for — a late
    // report saved after Wednesday must not slide into the next week.
    if (req.params.id) {
      const target = await WeeklyReport.findById(req.params.id).select('project weekLabel weekStart weekEnd');
      if (!target) return res.status(404).json({ message: 'Rapport introuvable' });
      if (target.project.toString() !== String(projectId)) {
        return res.status(400).json({ message: 'Le rapport ne correspond pas à ce projet' });
      }
      ({ weekLabel, weekStart, weekEnd: deadline } = target);
    }

    // Check if another bureau already owns this report this week
    const ownedByOther = await WeeklyReport.findOne({
      project: projectId,
      weekLabel,
      bureau: { $ne: req.user.bureau._id }
    }).populate('bureau', 'name');

    if (ownedByOther) {
      return res.status(403).json({
        message: `Ce rapport a déjà été pris en charge par le bureau ${ownedByOther.bureau.name} pour la semaine ${weekLabel}`
      });
    }

    // Check if current bureau already has a report
    const existing = await WeeklyReport.findOne({
      project: projectId,
      bureau: req.user.bureau._id,
      weekLabel
    });

    if (existing && !['draft', 'rejected', 'bureau_rejected'].includes(existing.status)) {
      return res.status(400).json({ message: 'Ce rapport a déjà été soumis' });
    }

    const { values, missingRequired } = buildValuesFromCanvas(
      canvas,
      fields,
      existing ? existing.values : new Map()
    );

    // ── SECURITY: strip derived keys, enforce canvas types/bounds
    sanitizeValuesMap(values, canvas);

    if (project.dateODS && project.delaisContractuel) {
      const elapsedDays = (Date.now() - new Date(project.dateODS)) / 86400000;
      const contractDays = project.delaisContractuel * 30.44;
      const taux = Math.max(0, (elapsedDays / contractDays) * 100);
      values.set('tauxConsommationDelais', Number(taux.toFixed(1)));
    }

    // Avance forfaitaire — derived: recovered amount = min(avance, facturation cumulée)
    const avanceForfaitaire = project.specs?.get
      ? project.specs.get('avance_forfaitaire')
      : project.specs?.avance_forfaitaire;
    const facturationCumulee = values.get('entreprise_facturation');
    if (avanceForfaitaire != null && facturationCumulee != null) {
      values.set('avance_remboursement_cumule',
        Math.min(Number(avanceForfaitaire), Number(facturationCumulee)));
    }
    const montantMarche = Number(project.montantMarche);
    const fact = Number(values.get('entreprise_facturation'));
    const enc = Number(values.get('entreprise_encaissement'));

    if (montantMarche > 0 && !Number.isNaN(fact)) {
      values.set('taux_facturation_marche', Number(((fact / montantMarche) * 100).toFixed(1)));
    }
    if (fact > 0 && !Number.isNaN(enc)) {
      values.set('taux_encaissement_facturation', Number(((enc / fact) * 100).toFixed(1)));
    }
    if (montantMarche > 0 && !Number.isNaN(enc)) {
      values.set('taux_encaissement_marche', Number(((enc / montantMarche) * 100).toFixed(1)));
    }
    const remb = values.get('avance_remboursement_cumule');
    if (avanceForfaitaire > 0 && remb != null) {
      values.set('taux_avance_encaisse', Number(((Number(remb) / Number(avanceForfaitaire)) * 100).toFixed(1)));
    }

    // Délais restant — (contractuel + supplémentaire)
    if (project.dateODS && project.delaisContractuel) {
      const elapsedMonths = (Date.now() - new Date(project.dateODS)) / 86400000 / 30.44;
      const supp = Number(values.get('delais_supplementaire')) || 0;
      const restant = (project.delaisContractuel + supp) - elapsedMonths;
      values.set('delais_restant', Number(restant.toFixed(1)));
    }

    // Lateness is fixed at first submission — correcting a rejected report after the deadline is not late
    const computedLate = !existing?.submittedAt && new Date() > deadline;

    const reportData = {
      project: projectId,
      bureau: req.user.bureau._id,
      weekLabel, weekStart, weekEnd: deadline,
      createdBy: req.user._id,
      status: 'draft',
      values,
      canvasVersion: canvas._id,
      isLate: existing ? (existing.isLate || computedLate) : computedLate,
    };

    let report;
    if (existing) {
      existing.weekLabel = reportData.weekLabel;
      existing.weekStart = reportData.weekStart;
      existing.weekEnd = reportData.weekEnd;
      existing.status = 'draft';
      existing.values = values;
      existing.canvasVersion = canvas._id;
      existing.isLate = reportData.isLate;
      // Clear stale approval attribution when a rejected report re-enters draft
      existing.bureauApprovedBy = undefined;
      existing.bureauApprovedAt = undefined;
      existing.reviewedBy = undefined;
      existing.reviewedAt = undefined;
      report = await existing.save();
    } else {
      report = await WeeklyReport.create({ ...reportData, createdBy: req.user._id });
    }

    const specWarnings = validateAgainstSpecs(project, values);
    res.status(existing ? 200 : 201).json({
      ...report.toObject(),
      _missingRequired: missingRequired,
      _specWarnings: specWarnings
    });
  } catch (error) {
    console.error('createOrUpdateDraft error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ─── SUBMIT REPORT
const submitReport = async (req, res) => {
  try {
    const report = await WeeklyReport.findById(req.params.id).populate('project').populate('canvasVersion');
    if (!report) return res.status(404).json({ message: 'Rapport introuvable' });

    if (!['draft', 'rejected', 'bureau_rejected'].includes(report.status)) {
      return res.status(400).json({ message: 'Ce rapport ne peut pas être soumis dans son état actuel' });
    }
    const hasOverride = report.deadlineOverride?.expiresAt &&
      new Date() < new Date(report.deadlineOverride.expiresAt);

    if (!report.isLate && !report.submittedAt && new Date() > report.weekEnd) {
      report.isLate = true;
      await report.save();
    }
    if (report.isLate && !hasOverride) {
      return res.status(400).json({ message: 'Délai dépassé — soumission impossible' });
    }
    if (report.bureau.toString() !== req.user.bureau._id.toString()) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    const allBureaus = [report.project.bureau, ...report.project.participantBureaus].map(id => id.toString());
    if (!allBureaus.includes(req.user.bureau._id.toString())) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    // Hard-block on required fields at submission time
    if (report.canvasVersion) {
      const missing = report.canvasVersion.fields
        .filter(f => f.required)
        .filter(f => {
          const v = report.values.get(f.key);
          return v === undefined || v === null || v === '';
        })
        .map(f => f.label || f.key);

      if (missing.length) {
        return res.status(400).json({
          message: `Champs requis manquants : ${missing.join(', ')}`
        });
      }
    }

    const specErrors = validateAgainstSpecs(report.project, report.values);
    if (specErrors.length) {
      return res.status(400).json({
        message: specErrors.join(' | ')
      });
    }

    // Financial guard — facturation cannot exceed montant du marché
    const marcheGuard = Number(report.project.montantMarche);
    const factGuard = Number(report.values.get('entreprise_facturation'));
    if (marcheGuard > 0 && !Number.isNaN(factGuard) && factGuard > marcheGuard) {
      return res.status(400).json({
        message: `Facturation Entreprise (${factGuard.toLocaleString('fr-DZ')} DA) dépasse le montant du marché (${marcheGuard.toLocaleString('fr-DZ')} DA)`
      });
    }

    const prev = await WeeklyReport.findOne({
      project: report.project._id,
      _id: { $ne: report._id },
      weekEnd: { $lt: report.weekEnd }, // a late report must not be compared with a later week
      status: { $in: ['submitted', 'bureau_approved', 'accepted'] }
    }).sort({ weekEnd: -1 });

    if (prev && report.canvasVersion) {
      const decreases = report.canvasVersion.fields
        .filter(f => f.cumulative && f.type === 'number')
        .map(f => {
          const prevVal = prev.values?.get ? prev.values.get(f.key) : prev.values?.[f.key];
          const curVal = report.values.get(f.key);
          return (prevVal != null && curVal != null && Number(curVal) < Number(prevVal))
            ? `${f.label} (${curVal}) est inférieur à la semaine précédente (${prevVal})`
            : null;
        })
        .filter(Boolean);

      if (decreases.length) {
        return res.status(400).json({ message: decreases.join(' | ') });
      }
    }

    report.status = 'submitted';
    report.submittedBy = req.user._id;
    report.submittedAt = new Date();
    if (!report.firstSubmittedAt) report.firstSubmittedAt = report.submittedAt;
    await report.save();

    const admins = await User.find({
      bureau: report.project.bureau,
      role: 'bureau_technical_admin',
      isActive: true
    });

    for (const admin of admins) {
      await notify(req, admin._id, 'report_submitted', 'Nouveau rapport soumis',
        `${req.user.firstName} ${req.user.lastName} a soumis le rapport hebdomadaire du projet ${report.project.name}`,
        report._id,
        { event: 'report:updated', payload: { reportId: report._id, status: report.status } }
      );
      const tpl = emailTemplates.reportSubmitted(admin.firstName, report.project.name, report.weekLabel);
      sendEmail({ to: admin.email, ...tpl }).catch(() => { });
    }

    const geeAdmins = await User.find({
      role: { $in: ['gee_technical_admin', 'gee_super_admin'] },
      isActive: true
    });

    const emitToUser = req.app.get('emitToUser');
    if (emitToUser) {
      for (const gee of geeAdmins) {
        emitToUser(gee._id.toString(), 'report:updated', { reportId: report._id, status: report.status });
      }
    }

    res.json({ message: 'Rapport soumis avec succès', report });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── BUREAU ADMIN SUBMITS TO GEE ──────────────────────────────
const bureauAdminSubmit = async (req, res) => {
  try {
    const report = await WeeklyReport.findById(req.params.id).populate('project');
    if (!report) return res.status(404).json({ message: 'Rapport introuvable' });

    if (report.status !== 'submitted') {
      return res.status(400).json({ message: "Le rapport doit être soumis par l'utilisateur d'abord" });
    }

    if (report.project.bureau.toString() !== req.user.bureau._id.toString()) {
      return res.status(403).json({ message: 'Seul le bureau chef de file peut transmettre au GEE' });
    }

    if (report.bureau.toString() !== req.user.bureau._id.toString()) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    report.status = 'bureau_approved';
    report.bureauApprovedBy = req.user._id;
    report.bureauApprovedAt = new Date();
    await report.save();

    const bureau = await Bureau.findById(req.user.bureau._id);

    const geeAdmins = await User.find({
      role: { $in: ['gee_technical_admin', 'gee_super_admin'] },
      isActive: true
    });

    for (const admin of geeAdmins) {
      await notify(req, admin._id, 'report_submitted', 'Rapport à réviser',
        `Le bureau ${bureau?.name || ''} a soumis le rapport du projet ${report.project.name} pour révision`,
        report._id,
        { event: 'report:updated', payload: { reportId: report._id, status: report.status } }
      );
      const tpl = emailTemplates.reportSubmitted(admin.firstName, report.project.name, report.weekLabel);
      sendEmail({ to: admin.email, ...tpl }).catch(() => { });
    }

    res.json({ message: 'Rapport transmis au GEE avec succès', report });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── BUREAU TECHNICAL ADMIN REJECTS BACK TO USER ──────────────
const bureauRejectReport = async (req, res) => {
  try {
    const { observation } = req.body;
    if (!observation || !observation.trim()) {
      return res.status(400).json({ message: 'Une observation est requise pour le rejet' });
    }

    const report = await WeeklyReport.findById(req.params.id)
      .populate('project')
      .populate('submittedBy', 'firstName lastName email');

    if (!report) return res.status(404).json({ message: 'Rapport introuvable' });

    if (report.status !== 'submitted') {
      return res.status(400).json({ message: "Le rapport n'est pas en attente de validation du bureau" });
    }
    if (report.bureau.toString() !== req.user.bureau._id.toString()) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    report.status = 'bureau_rejected';
    report.bureauApprovedBy = req.user._id;
    report.bureauApprovedAt = new Date();
    report.rejectionNote = observation;
    report.rejectionHistory.push({ source: 'bureau', from: req.user._id, note: observation });

    await report.save();

    if (report.submittedBy) {
      await notify(req, report.submittedBy._id, 'report_rejected',
        'Rapport renvoyé pour correction',
        `Votre rapport pour le projet ${report.project.name} a été renvoyé par l'admin technique. Veuillez corriger et resoumettre.`,
        report._id,
        { event: 'report:updated', payload: { reportId: report._id, status: report.status } }
      );
      const tpl = emailTemplates.reportRejected(
        report.submittedBy.firstName,
        report.project.name,
        observation
      );
      sendEmail({ to: report.submittedBy.email, ...tpl }).catch(() => { });
    }

    res.json({ message: 'Rapport renvoyé à l\'utilisateur avec observation', report });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── GEE ACCEPT REPORT ─────────────────────────────────────────
const acceptReport = async (req, res) => {
  try {
    const report = await WeeklyReport.findById(req.params.id)
      .populate('project')
      .populate('submittedBy', 'firstName lastName email');

    if (!report) return res.status(404).json({ message: 'Rapport introuvable' });

    if (report.status !== 'bureau_approved') {
      return res.status(400).json({ message: 'Le rapport n\'est pas prêt pour révision GEE' });
    }

    report.status = 'accepted';
    report.geeReviewedBy = req.user._id;
    report.geeReviewedAt = new Date();
    await report.save();

    const geeAdmins = await User.find({ role: 'gee_super_admin', isActive: true });
    const emitToUser = req.app.get('emitToUser');
    if (emitToUser) {
      for (const gee of geeAdmins) {
        emitToUser(gee._id.toString(), 'report:updated', { reportId: report._id, status: report.status });
      }
    }

    if (report.submittedBy) {
      await notify(req, report.submittedBy._id, 'report_accepted', 'Rapport accepté',
        `Votre rapport hebdomadaire pour le projet ${report.project.name} (${report.weekLabel}) a été accepté`,
        report._id,
        { event: 'report:updated', payload: { reportId: report._id, status: report.status } }
      );
      const tpl = emailTemplates.reportAccepted(
        report.submittedBy.firstName,
        report.project.name,
        report.weekLabel
      );
      sendEmail({ to: report.submittedBy.email, ...tpl }).catch(() => { });
    }

    res.json({ message: 'Rapport accepté', report });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── GEE REJECT REPORT WITH OBSERVATION ───────────────────────
const rejectReport = async (req, res) => {
  try {
    const { observation } = req.body;
    if (!observation || !observation.trim()) {
      return res.status(400).json({ message: 'Une observation est requise pour le rejet' });
    }

    const report = await WeeklyReport.findById(req.params.id)
      .populate('project')
      .populate('submittedBy', 'firstName lastName email')
      .populate('bureauApprovedBy', 'firstName lastName email');

    if (!report) return res.status(404).json({ message: 'Rapport introuvable' });

    if (report.status !== 'bureau_approved') {
      return res.status(400).json({ message: 'Le rapport n\'est pas prêt pour révision GEE' });
    }

    report.status = 'rejected';
    report.geeReviewedBy = req.user._id;
    report.geeReviewedAt = new Date();
    report.rejectionNote = observation;
    report.rejectionHistory.push({ source: 'gee', from: req.user._id, note: observation });

    await report.save();

    const geeAdmins = await User.find({ role: 'gee_super_admin', isActive: true });
    const emitToUser = req.app.get('emitToUser');
    if (emitToUser) {
      for (const gee of geeAdmins) {
        emitToUser(gee._id.toString(), 'report:updated', { reportId: report._id, status: report.status });
      }
    }

    if (report.bureauApprovedBy) {
      await notify(req, report.bureauApprovedBy._id, 'report_rejected',
        'Rapport rejeté',
        `Le rapport du projet ${report.project.name} a été rejeté avec une observation`,
        report._id,
        { event: 'report:updated', payload: { reportId: report._id, status: report.status } }
      );
      const tpl = emailTemplates.reportRejected(
        report.bureauApprovedBy.firstName,
        report.project.name,
        observation
      );
      sendEmail({ to: report.bureauApprovedBy.email, ...tpl }).catch(() => { });
    }

    if (report.submittedBy) {
      await notify(req, report.submittedBy._id, 'report_rejected',
        'Rapport rejeté',
        `Votre rapport pour le projet ${report.project.name} a été rejeté. Veuillez corriger et resoumettre.`,
        report._id,
        { event: 'report:updated', payload: { reportId: report._id, status: report.status } }
      );
      const tpl = emailTemplates.reportRejected(
        report.submittedBy.firstName,
        report.project.name,
        observation
      );
      sendEmail({ to: report.submittedBy.email, ...tpl }).catch(() => { });
    }

    res.json({ message: 'Rapport rejeté avec observation', report });
  } catch (error) {
    console.error('rejectReport error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ─── GET CURRENT WEEK STATUS (for dashboard) ──────────────────
const getCurrentWeekStatus = async (req, res) => {
  try {
    let projectFilter = { hasWeeklyReport: true, isActive: true };
    if (req.user.role.startsWith('bureau_')) {
      projectFilter.bureau = req.user.bureau._id;
    }

    const projects = await Project.find(projectFilter)
      .populate('bureau', 'name')
      .select('name type bureau dateODS');

    const statuses = await Promise.all(projects.map(async (project) => {
      const weekLabel = getWeekLabel(project.dateODS);
      const report = await WeeklyReport.findOne({ project: project._id, weekLabel })
        .select('status isLate weekLabel submittedAt bureau');

      return {
        project: { _id: project._id, name: project.name, type: project.type },
        bureau: project.bureau,
        weekLabel,
        status: report?.status || 'non_soumis',
        isLate: report?.isLate || false,
        submittedAt: report?.submittedAt || null
      };
    }));

    res.json({ statuses });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//Excel Exportation
const exportReport = async (req, res) => {
  try {
    const report = await WeeklyReport.findById(req.params.id)
      .populate('project')
      .populate('bureau', 'name')
      .populate('submittedBy', 'firstName lastName')
      .populate('bureauApprovedBy', 'firstName lastName')
      .populate('canvasVersion');

    if (!report) return res.status(404).json({ message: 'Rapport introuvable' });

    const wb = await exportReportToExcel(report);

    const filename = `Rapport_${report.project?.name}_${report.weekLabel}.xlsx`
      .replace(/\s+/g, '_');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await wb.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── CONSOLIDATED EXCEL EXPORT ────────────────────────────────
const exportConsolidated = async (req, res) => {
  try {
    const { exportWeeklyReports, addMissingReports } = require('../utils/excelExport');
    const { getWeekDeadline } = require('../utils/scheduler');
    const weekEnd = req.query.weekEnd ? new Date(req.query.weekEnd) : getWeekDeadline();
    const dayStart = new Date(weekEnd); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(weekEnd); dayEnd.setHours(23, 59, 59, 999);

    const found = await WeeklyReport.find({
      weekEnd: { $gte: dayStart, $lte: dayEnd }
    })
      .populate('project', 'name type siteLocation siteLabel entrepriseRealisation dateODS delaisContractuel montantMarche AMO')
      .populate('bureau', 'name')
      .populate('submittedBy', 'firstName lastName')
      .populate('bureauApprovedBy', 'firstName lastName')
      .populate('canvasVersion');

    // Projects with no report this week still get a "Non soumis" row
    const reports = await addMissingReports(found, dayEnd);
    if (!reports.length) {
      return res.status(404).json({ message: 'Aucun rapport trouvé pour cette période' });
    }

    const wb = await exportWeeklyReports(reports, dayEnd);

    const filename = `Rapport_Consolide_${dayEnd.toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const grantDeadlineOverride = async (req, res) => {
  try {
    const report = await WeeklyReport.findById(req.params.id).populate('project bureau');
    if (!report) return res.status(404).json({ message: 'Rapport introuvable' });

    if (!report.isLate) {
      return res.status(400).json({ message: 'Ce rapport n\'est pas en retard' });
    }

    if (!['draft', 'rejected', 'bureau_rejected'].includes(report.status)) {
      return res.status(400).json({ message: 'Ce rapport ne peut pas recevoir une extension' });
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    report.deadlineOverride = {
      grantedBy: req.user._id,
      grantedAt: new Date(),
      expiresAt
    };
    await report.save();

    const admins = await User.find({
      bureau: report.bureau._id,
      role: 'bureau_technical_admin',
      isActive: true
    });

    for (const admin of admins) {
      await notify(req, admin._id, 'report_submitted',
        'Extension de délai accordée',
        `Une extension de 24h a été accordée pour le rapport du projet ${report.project.name} (${report.weekLabel})`,
        report._id
      );
    }

    res.json({
      message: 'Extension accordée — valable 24h',
      expiresAt,
      report
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Week end (Wednesday 23:59:59.999) of the week containing `date`; defaults to last week
const resolvePastWeekEnd = (date) => {
  if (date) return getWeekDeadline(new Date(date));
  const d = getWeekDeadline();
  d.setDate(d.getDate() - 7);
  return d;
};

// ─── MISSING REPORTS FOR A PAST WEEK (GEE) ────────────────────
const getMissingReports = async (req, res) => {
  try {
    const { addMissingReports } = require('../utils/excelExport');
    const weekEnd = resolvePastWeekEnd(req.query.weekEnd);
    const found = await WeeklyReport.find({ weekEnd }).select('project');
    const all = await addMissingReports(found, weekEnd, req.query.bureau || undefined);
    const missing = all
      .filter(r => r.status === 'missing')
      .map(r => ({
        project: { _id: r.project._id, name: r.project.name },
        bureau: r.bureau,
        weekLabel: r.weekLabel,
      }));
    res.json({ weekEnd, missing });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── EXTENSION FOR A REPORT THAT WAS NEVER STARTED (GEE) ──────
// Creates the missing week's report as a late draft with a 24h override,
// so the bureau can fill it in and submit it under its own week.
const grantMissingOverride = async (req, res) => {
  try {
    const { projectId, weekEnd: weekEndInput } = req.body;
    const weekEnd = resolvePastWeekEnd(weekEndInput);
    if (new Date() <= weekEnd) {
      return res.status(400).json({ message: 'Le délai de cette semaine n\'est pas encore dépassé' });
    }

    const project = await Project.findById(projectId);
    if (!project || !project.hasWeeklyReport || !project.isActive) {
      return res.status(404).json({ message: 'Projet introuvable ou inactif' });
    }

    const weekLabel = getWeekLabel(project.dateODS, weekEnd);
    if (await WeeklyReport.exists({ project: project._id, weekLabel })) {
      return res.status(400).json({ message: 'Un rapport existe déjà pour cette semaine' });
    }

    const canvas = await ReportCanvas.findOne({ projectType: project.type, isActive: true });
    if (!canvas) {
      return res.status(400).json({ message: "Aucun modèle de rapport (canvas) actif pour ce type de projet" });
    }

    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 6);
    const expiresAt = new Date(Date.now() + 24 * 3600000);

    const report = await WeeklyReport.create({
      project: project._id,
      bureau: project.bureau,
      weekLabel, weekStart, weekEnd,
      createdBy: req.user._id,
      status: 'draft',
      canvasVersion: canvas._id,
      isLate: true,
      deadlineOverride: { grantedBy: req.user._id, grantedAt: new Date(), expiresAt }
    });

    const admins = await User.find({
      bureau: project.bureau,
      role: 'bureau_technical_admin',
      isActive: true
    });
    for (const admin of admins) {
      await notify(req, admin._id, 'report_submitted',
        'Extension de délai accordée',
        `Une extension de 24h a été accordée pour le rapport non soumis du projet ${project.name} (${weekLabel})`,
        report._id
      );
    }

    res.status(201).json({ message: 'Extension accordée — valable 24h', expiresAt, report });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getReports, getReport, getLastReportValues,
  createOrUpdateDraft, submitReport,
  bureauAdminSubmit, bureauRejectReport, acceptReport,
  rejectReport, getCurrentWeekStatus, exportConsolidated, exportReport, grantDeadlineOverride,
  getMissingReports, grantMissingOverride
};