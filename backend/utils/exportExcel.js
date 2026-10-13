const ExcelJS = require('exceljs');

// Page headings — keyed by canvas page number. Falls back to "Page N" for
// any page a future canvas adds that isn't listed here. Keep in sync with
// PAGE_TITLES in frontend/src/pages/ReportDetail.jsx.
const PAGE_TITLES = {
  1: 'Situation Contractuelle',
  2: 'Infrastructure',
  3: 'Superstructure',
  4: 'Exploitation',
  5: 'Paiement',
};

// Format one canvas-driven value for display, using the field's declared
// type/unit rather than hardcoded per-field logic.
const formatFieldValue = (value, field) => {
  if (value === undefined || value === null || value === '') return '—';
  if (field.type === 'number' && field.unit === 'DA') {
    return `${Number(value).toLocaleString('fr-DZ')} DA`;
  }
  if (field.unit) return `${value} ${field.unit}`;
  return value;
};

// Group canvas fields by page, each page's fields sorted by order.
const groupFieldsByPage = (fields) => {
  return fields
    .slice()
    .sort((a, b) => (a.page - b.page) || (a.order - b.order))
    .reduce((acc, f) => {
      (acc[f.page] = acc[f.page] || []).push(f);
      return acc;
    }, {});
};

const exportReportToExcel = async (report) => {
  const wb = new ExcelJS.Workbook();
  const p = report.project || {};

  // values arrives as a Mongoose Map (or plain object if .lean() was used)
  const getValue = (key) =>
    report.values?.get ? report.values.get(key) : report.values?.[key];

  const addRow = (sheet, label, value, bold = false) => {
    const row = sheet.addRow([label, value ?? '—']);
    if (bold) {
      row.font = { bold: true };
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } };
    }
    row.border = {
      bottom: { style: 'thin', color: { argb: 'FFD0D8E8' } }
    };
  };

  const addHeader = (sheet, title) => {
    const row = sheet.addRow([title]);
    sheet.mergeCells(`A${row.number}:B${row.number}`);
    row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B5E20' } };
    row.height = 22;
    sheet.addRow([]);
  };

  const addTitle = (sheet, text) => {
    const title = sheet.addRow([text]);
    sheet.mergeCells(`A${title.number}:B${title.number}`);
    title.font = { bold: true, size: 13, color: { argb: 'FF1B5E20' } };
    title.alignment = { horizontal: 'center' };
    title.height = 28;
    sheet.addRow([]);
  };

  // ── SHEET 1 — Informations Projet (static, not canvas-driven) ──────────
  const s1 = wb.addWorksheet('Informations Projet');
  s1.columns = [{ width: 45 }, { width: 30 }];

  addTitle(s1, 'RAPPORT HEBDOMADAIRE — INFORMATIONS PROJET');

  addHeader(s1, 'Informations Projet');
  addRow(s1, 'Projet', p.name);
  addRow(s1, 'Bureau', report.bureau?.name);
  addRow(s1, p.siteLabel || 'Site du projet', p.siteLocation);
  addRow(s1, 'Semaine', report.weekLabel);
  addRow(s1, 'Entreprise de réalisation', p.entrepriseRealisation);
  addRow(s1, 'Date ODS', p.dateODS ? new Date(p.dateODS).toLocaleDateString('fr-DZ') : '—');
  addRow(s1, 'Délais contractuel', p.delaisContractuel ? `${p.delaisContractuel} mois` : '—');
  addRow(s1, 'Montant du marché (DA/TTC)', p.montantMarche != null ? `${p.montantMarche.toLocaleString('fr-DZ')} DA` : '—');
  addRow(s1, 'AMO', p.AMO || '—');

  const sheets = [s1];

  // ── CANVAS-DRIVEN SHEETS — one per canvas page ────────────────────────
  const fields = report.canvasVersion?.fields || [];

  if (!fields.length) {
    // No canvas attached (shouldn't happen post-migration, but never produce
    // a silently-empty export — say so explicitly instead).
    addHeader(s1, 'Données du rapport');
    addRow(s1, 'Erreur', 'Aucun modèle (canvas) associé à ce rapport — données non affichables');
  } else {
    for (const [page, pageFields] of Object.entries(groupFieldsByPage(fields))) {
      const pageTitle = PAGE_TITLES[page] || `Page ${page}`;
      // Excel sheet names cap at 31 chars and can't contain : \ / ? * [ ]
      const safeName = pageTitle.replace(/[:\\/?*[\]]/g, '').slice(0, 31);

      const sheet = wb.addWorksheet(safeName);
      sheet.columns = [{ width: 45 }, { width: 30 }];

      addTitle(sheet, `RAPPORT HEBDOMADAIRE — ${pageTitle.toUpperCase()}`);
      addHeader(sheet, pageTitle);

      pageFields.forEach(f => {
        addRow(sheet, f.label, formatFieldValue(getValue(f.key), f));
      });

      sheets.push(sheet);
    }
  }

  // ── Copyright stamp ────────────────────────────────────────
  sheets.forEach(sheet => {
    sheet.addRow([]);
    const cr = sheet.addRow([`© ${new Date().getFullYear()} Groupe Études & Engineering (GEE) — Document Confidentiel`]);
    sheet.mergeCells(`A${cr.number}:B${cr.number}`);
    cr.font = { italic: true, size: 9, color: { argb: 'FF9E9E9E' } };
    cr.alignment = { horizontal: 'center' };
  });

  return wb;
};

module.exports = { exportReportToExcel };