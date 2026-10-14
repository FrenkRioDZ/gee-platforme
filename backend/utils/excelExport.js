const ExcelJS = require('exceljs');
const Project = require('../models/Project');
const { getWeekLabel } = require('./scheduler');

// Fixed columns that always appear, before any canvas-driven ones.
// These come from the project/report metadata, not the values map.
const FIXED_COLUMNS = [
  { header: 'Filiale', key: '__filiale', width: 16 },
  { header: 'Projet', key: '__projet', width: 20 },
  { header: 'Site du Projet', key: '__site', width: 20 },
  { header: 'Entreprise de Réalisation', key: '__entreprise', width: 22 },
  { header: 'Date ODS', key: '__dateODS', width: 14 },
  { header: 'Délais Contractuel (mois)', key: '__delais', width: 14 },
  { header: 'Montant Marché (DA/TTC)', key: '__montant', width: 18 },
  { header: 'AMO', key: '__amo', width: 12 },
];

// Trailing columns, after the canvas-driven ones.
const TRAILING_COLUMNS = [
  { header: 'Statut', key: '__status', width: 14 },
  { header: 'Semaine', key: '__week', width: 12 },
  { header: 'Soumis le', key: '__submittedAt', width: 18 },
  { header: 'Envoyé à GEE le', key: '__sentToGeeAt', width: 18 },
  { header: 'En retard', key: '__isLate', width: 10 },
  { header: 'Retard', key: '__lateBy', width: 12 },
];

// "07/10/2026 14:32" in Algeria time, whatever the server's timezone
const fmtDateTime = (d) => new Date(d).toLocaleString('fr-DZ', {
  timeZone: 'Africa/Algiers', day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

// How long after the Wednesday deadline the report was submitted, e.g. "1j 4h"
const fmtLateBy = (report) => {
  // Older reports predate firstSubmittedAt — fall back to the latest submission
  const submitted = report.firstSubmittedAt || report.submittedAt;
  if (!report.isLate || !submitted || !report.weekEnd) return '—';
  const hours = Math.max(0, Math.floor((new Date(submitted) - new Date(report.weekEnd)) / 3600000));
  return hours >= 24 ? `${Math.floor(hours / 24)}j ${hours % 24}h` : `${hours}h`;
};

const SENT_TO_GEE_STATUSES =['bureau_approved', 'accepted', 'rejected'];

const STATUS_LABELS = {
  draft: 'Brouillon',
  submitted: 'Soumis',
  bureau_approved: 'Transmis GEE',
  bureau_rejected: 'Renvoyé bureau',
  accepted: 'Accepté',
  rejected: 'Rejeté',
  missing: 'Non soumis',
};

// Every active weekly-report project must appear in the consolidated export,
// even when no report exists for that week — add a placeholder row for each one.
// bureauId (optional) limits the list to projects that bureau owns or joins.
const addMissingReports = async (reports, weekEnd, bureauId) => {
  const filter = { hasWeeklyReport: true, isActive: true, dateODS: { $lte: weekEnd } };
  if (bureauId) filter.$or = [{ bureau: bureauId }, { participantBureaus: bureauId }];

  const projects = await Project.find(filter)
    .select('name type siteLocation entrepriseRealisation dateODS delaisContractuel montantMarche AMO bureau')
    .populate('bureau', 'name');

  const reported = new Set(reports.map(r => String(r.project?._id || r.project)));
  const missing = projects
    .filter(p => !reported.has(String(p._id)))
    .map(p => ({
      project: p,
      bureau: p.bureau,
      status: 'missing',
      weekLabel: getWeekLabel(p.dateODS, weekEnd),
      values: new Map(),
      isLate: true,
    }));

  return [...reports, ...missing].sort((a, b) =>
    (a.bureau?.name || '').localeCompare(b.bureau?.name || '') ||
    (a.project?.name || '').localeCompare(b.project?.name || ''));
};

// Build the canvas-driven column set as the UNION of every field across all
// reports in this export. Different projects may run different canvases, so
// we can't assume a single shared field list. Ordered by (page, order) using
// the first canvas that defines each key.
const buildDynamicColumns = (reports) => {
  const seen = new Map(); // key -> field definition

  for (const report of reports) {
    const fields = report.canvasVersion?.fields || [];
    for (const f of fields) {
      if (!seen.has(f.key)) seen.set(f.key, f);
    }
  }

  return [...seen.values()]
    .sort((a, b) => (a.page - b.page) || (a.order - b.order))
    .map(f => ({
      header: f.unit ? `${f.label} (${f.unit})` : f.label,
      key: f.key,
      width: 18,
      field: f,
    }));
};

const exportWeeklyReports = async (reports, weekLabel) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Rapport Consolidé');

  const dynamicColumns = buildDynamicColumns(reports);
  const allColumns = [...FIXED_COLUMNS, ...dynamicColumns, ...TRAILING_COLUMNS];

  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B5E20' } };
  const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  const centerAlign = { horizontal: 'center', vertical: 'middle', wrapText: true };
  const borderStyle = {
    top: { style: 'thin' }, left: { style: 'thin' },
    bottom: { style: 'thin' }, right: { style: 'thin' }
  };

  worksheet.columns = allColumns.map(c => ({ key: c.key, width: c.width }));

  // ── Title row ──────────────────────────────────────────────
  const lastCol = worksheet.getColumn(allColumns.length).letter;
  worksheet.mergeCells(`A1:${lastCol}1`);
  const titleCell = worksheet.getCell('A1');
  titleCell.value = `RAPPORT CONSOLIDÉ HEBDOMADAIRE${weekLabel ? ` — ${weekLabel}` : ''}`;
  titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = headerFill;
  titleCell.alignment = centerAlign;
  worksheet.getRow(1).height = 30;

  // ── Header row ─────────────────────────────────────────────
  const headerRow = worksheet.getRow(2);
  allColumns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = centerAlign;
    cell.border = borderStyle;
  });
  headerRow.height = 45;

  // ── Data rows ──────────────────────────────────────────────
  reports.forEach((report, idx) => {
    const row = worksheet.getRow(idx + 3);
    const p = report.project || {};
    const getValue = (key) =>
      report.values?.get ? report.values.get(key) : report.values?.[key];

    const rowValues = {
      __filiale: report.bureau?.name || '—',
      __projet: p.name || '—',
      __site: p.siteLocation || '—',
      __entreprise: p.entrepriseRealisation || '—',
      __dateODS: p.dateODS ? new Date(p.dateODS).toLocaleDateString('fr-DZ') : '—',
      __delais: p.delaisContractuel ?? '—',
      __montant: p.montantMarche ?? '—',
      __amo: p.AMO || '—',
      __status: STATUS_LABELS[report.status] || report.status,
      __week: report.weekLabel || '—',
      __submittedAt: report.submittedAt
        ? fmtDateTime(report.submittedAt)
        : 'Non soumis',
      // bureauApprovedAt is also stamped on a bureau rejection, so only trust it
      // once the report actually reached GEE
      __sentToGeeAt: SENT_TO_GEE_STATUSES.includes(report.status) && report.bureauApprovedAt
        ? fmtDateTime(report.bureauApprovedAt)
        : 'Non envoyé',
      __isLate: report.isLate ? 'Oui' : 'Non',
      __lateBy: fmtLateBy(report),
    };

    // Canvas-driven values — a report whose canvas lacks a column simply
    // leaves it blank rather than breaking the row alignment.
    dynamicColumns.forEach(c => {
      const v = getValue(c.key);
      rowValues[c.key] = (v === undefined || v === null || v === '') ? '—' : v;
    });

    allColumns.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.value = rowValues[c.key];
      cell.border = borderStyle;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };

      if (report.isLate) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCCCC' } };
      } else if (report.status === 'accepted') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCFFCC' } };
      } else if (idx % 2 === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FA' } };
      }
    });

    row.height = 20;
  });

  // ── Totals row — sums every numeric DA column, averages every % column ──
  const totalRowIdx = reports.length + 3;
  const totalRow = worksheet.getRow(totalRowIdx);
  totalRow.getCell(1).value = 'TOTAL';

  dynamicColumns.forEach((c, i) => {
    const colIdx = FIXED_COLUMNS.length + i + 1;
    const field = c.field;
    if (field.type !== 'number') return;

    const nums = reports
      .map(r => (r.values?.get ? r.values.get(c.key) : r.values?.[c.key]))
      .filter(v => v !== undefined && v !== null && v !== '')
      .map(Number)
      .filter(n => !Number.isNaN(n));

    if (!nums.length) return;

    if (field.unit === '%') {
      const avg = nums.reduce((s, n) => s + n, 0) / nums.length;
      totalRow.getCell(colIdx).value = `${avg.toFixed(1)} (moy)`;
    } else {
      totalRow.getCell(colIdx).value = nums.reduce((s, n) => s + n, 0);
    }
  });

  totalRow.font = { bold: true };
  totalRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } };
    cell.border = borderStyle;
  });

  // ── Summary row ────────────────────────────────────────────
  const summaryRowIdx = totalRowIdx + 1;
  const summaryRow = worksheet.getRow(summaryRowIdx);
  const accepted = reports.filter(r => r.status === 'accepted').length;
  const late = reports.filter(r => r.isLate).length;
  const pending = reports.filter(r =>
    ['draft', 'submitted', 'bureau_approved', 'bureau_rejected'].includes(r.status)
  ).length;
  const missing = reports.filter(r => r.status === 'missing').length;

  worksheet.mergeCells(`A${summaryRowIdx}:${lastCol}${summaryRowIdx}`);
  summaryRow.getCell(1).value =
    `Total projets: ${reports.length}  |  Acceptés: ${accepted}  |  En attente: ${pending}  |  Non soumis: ${missing}  |  En retard: ${late}`;
  summaryRow.getCell(1).font = { bold: true };
  summaryRow.getCell(1).alignment = { horizontal: 'center' };

  // ── Copyright footer ───────────────────────────────────────
  worksheet.addRow([]);
  const crRow = worksheet.addRow([
    `© ${new Date().getFullYear()} Groupe Études & Engineering (GEE) — Document Confidentiel`
  ]);
  worksheet.mergeCells(`A${crRow.number}:${lastCol}${crRow.number}`);
  crRow.getCell(1).font = { italic: true, size: 9, color: { argb: 'FF9E9E9E' } };
  crRow.getCell(1).alignment = { horizontal: 'center' };

  return workbook;
};

module.exports = { exportWeeklyReports, addMissingReports };