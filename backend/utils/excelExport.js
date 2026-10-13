const ExcelJS = require('exceljs');

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
  { header: 'Soumis le', key: '__submittedAt', width: 16 },
  { header: 'Envoyé à GEE le', key: '__sentToGeeAt', width: 16 },
  { header: 'En retard', key: '__isLate', width: 10 },
];

const SENT_TO_GEE_STATUSES = ['bureau_approved', 'accepted', 'rejected'];

const STATUS_LABELS = {
  draft: 'Brouillon',
  submitted: 'Soumis',
  bureau_approved: 'Transmis GEE',
  bureau_rejected: 'Renvoyé bureau',
  accepted: 'Accepté',
  rejected: 'Rejeté',
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
        ? new Date(report.submittedAt).toLocaleDateString('fr-DZ')
        : 'Non soumis',
      // bureauApprovedAt is also stamped on a bureau rejection, so only trust it
      // once the report actually reached GEE
      __sentToGeeAt: SENT_TO_GEE_STATUSES.includes(report.status) && report.bureauApprovedAt
        ? new Date(report.bureauApprovedAt).toLocaleDateString('fr-DZ')
        : 'Non envoyé',
      __isLate: report.isLate ? 'Oui' : 'Non',
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

  worksheet.mergeCells(`A${summaryRowIdx}:${lastCol}${summaryRowIdx}`);
  summaryRow.getCell(1).value =
    `Total rapports: ${reports.length}  |  Acceptés: ${accepted}  |  En attente: ${pending}  |  En retard: ${late}`;
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

module.exports = { exportWeeklyReports };