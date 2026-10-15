const ExcelJS = require('exceljs');
const Project = require('../models/Project');
const WeeklyReport = require('../models/WeeklyReport');
const { getWeekLabel } = require('./scheduler');

// "07/10/2026 14:32" in Algeria time, whatever the server's timezone
const fmtDateTime = (d) => new Date(d).toLocaleString('fr-DZ', {
  timeZone: 'Africa/Algiers', day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

const fmtDate = (d) => new Date(d).toLocaleDateString('fr-DZ', {
  timeZone: 'Africa/Algiers', day: '2-digit', month: '2-digit', year: 'numeric',
});

// How long after the Wednesday deadline the report reached the GEE, e.g. "1j 4h".
// The deadline is for reaching the GEE: a report the BET user submitted on time but
// the BET admin forwarded on Thursday is late by the forwarding delay.
const fmtLateBy = (report) => {
  if (!report.isLate || !report.weekEnd) return '—';
  if (!SENT_TO_GEE_STATUSES.includes(report.status) || !report.bureauApprovedAt) return 'Non transmis';
  const hours = Math.max(0, Math.floor((new Date(report.bureauApprovedAt) - new Date(report.weekEnd)) / 3600000));
  return hours >= 24 ? `${Math.floor(hours / 24)}j ${hours % 24}h` : `${hours}h`;
};

const SENT_TO_GEE_STATUSES = ['bureau_approved', 'accepted', 'rejected'];

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

// ─── Client template "Canevas_Consolidation" ─────────────────────────────────
// Layout, fonts and colours reproduce the consolidation file GEE used before
// the platform (excel canvas/Canevas_Consolidation 16-9-2026.xlsx).

const HEADER_LIGHT = 'FFC6D9F1'; // theme blue 1F497D at 80% tint, as in the template
const HEADER_DARK = 'FF8DB4E2';  // same blue at 40% tint (INFRASTRUCTURE / SUPERSTRUCTURE band)
const TEMPLATE_REVISION = 'Rév 01-28/07/2026';
const MINISTRY_LINES = [
  'République Algérienne Démocratique et Populaire',
  "Ministère de l'Habitat, de l'Urbanisme, de la Ville et de l'Aménagement du Territoire",
  'Groupe "Etudes & Engineering"',
];

const BORDER = {
  top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' },
};
const CENTER = { horizontal: 'center', vertical: 'middle', wrapText: true };
const PCT = '0.00%';
const MONEY = '#,##0.00';

const valueOf = (report, key) => {
  const v = report.values?.get ? report.values.get(key) : report.values?.[key];
  return v === undefined || v === null || v === '' ? null : v;
};
const num = (report, key) => {
  const v = valueOf(report, key);
  if (v === null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? v : n;
};
// The platform stores 35 for 35 %; the template stores 0.35 formatted as %
const pct = (report, key) => {
  const n = num(report, key);
  return typeof n === 'number' ? n / 100 : n;
};

const SITUATION_COLUMNS = [
  { header: 'Filiale', width: 18 },
  { header: "Site d'implantation du Silo", width: 32, get: r => r.project?.siteLocation },
  { header: 'Entreprise de réalisation', width: 49, get: r => r.project?.entrepriseRealisation },
  { header: 'Date ODS de démarrage', width: 35, fmt: 'dd/mm/yyyy',
    get: r => (r.project?.dateODS ? new Date(r.project.dateODS) : null) },
  { header: 'Délais contractuel de réalisation (mois)', width: 24, fmt: '0', get: r => r.project?.delaisContractuel },
  { header: 'Délais contractuel restant de réalisation (mois)', width: 37, fmt: '0.0', get: r => num(r, 'delais_restant') },
  { header: 'Délais supplémentaire de réalisation (mois)', width: 24, fmt: '0', get: r => num(r, 'delais_supplementaire') },
  { header: "Taux d'avancement des travaux (%)", width: 27, fmt: PCT, get: r => pct(r, 'tauxAvancementGlobal') },
  { header: 'Taux de consommation des délais contractuels (%)', width: 30, fmt: PCT, get: r => pct(r, 'tauxConsommationDelais') },
  { header: "Montant du marché de l'entreprise\n(DA/TTC)", width: 49, fmt: MONEY, get: r => r.project?.montantMarche },
  { header: 'Montant facturé (DA/TTC)', width: 52, fmt: MONEY, get: r => num(r, 'entreprise_facturation') },
  { header: 'Taux de facturation/marché (%)', width: 25, fmt: PCT, get: r => pct(r, 'taux_facturation_marche') },
  { header: 'Montant encaissé (DA/TTC)', width: 39, fmt: MONEY, get: r => num(r, 'entreprise_encaissement') },
  { header: "Taux d'encaissement (%)", width: 34, fmt: PCT, get: r => pct(r, 'taux_encaissement_marche') },
  { header: "Taux de l'avance forfaitaire encaissé (%)", width: 30, fmt: PCT, get: r => pct(r, 'taux_avance_encaisse') },
];

const PIEUX = (prefix, depth) => [
  { header: 'Nombre de pieux réalisé (U)', width: depth ? 28 : 25, fmt: '0', get: r => num(r, `${prefix}_pieux_realises`) },
  { header: 'Nombre de pieux prévu (U)', width: depth ? 28 : 24, fmt: '0', get: r => num(r, `${prefix}_pieux_prevus`) },
  { header: 'Profondeur des pieux (m)', width: depth ? 28 : 25, fmt: '0', get: r => num(r, `${prefix}_profondeur`) },
  { header: 'Taux de réalisation du radier général (%)', width: 28, fmt: PCT, get: r => pct(r, `${prefix}_radier_taux`) },
];

const AVANCEMENT_COLUMNS = [
  { header: 'Filiale', width: 18 },
  { header: "Site d'implantation du Silo", width: 32, get: r => r.project?.siteLocation },
  { header: 'Entreprise de réalisation', width: 49, get: r => r.project?.entrepriseRealisation },
  ...PIEUX('cellules', false),            // D–G
  ...PIEUX('tour_travail', true),         // H–K
  ...PIEUX('tour_expedition', true),      // L–O
  { header: 'Taux de réalisation du VRD (%)', width: 23, fmt: PCT, get: r => pct(r, 'vrd_taux') },
  { header: "Taux d'avancement des travaux d'infrastructure (%)", width: 32, fmt: PCT, get: r => pct(r, 'taux_avancement_infrastructure') },
  { header: 'Hauteur de (batterie N01) réalisée (m)', width: 22, fmt: '0.00', get: r => num(r, 'batterie1_hauteur') },
  { header: 'Hauteur de (batterie N02) réalisée (m)', width: 22, fmt: '0.00', get: r => num(r, 'batterie2_hauteur') },
  { header: 'Hauteur de (batterie N03) réalisée (m)', width: 22, fmt: '0.00', get: r => num(r, 'batterie3_hauteur') },
  { header: 'Hauteur de Batterie (m)', width: 22, fmt: '0.00', get: r => num(r, 'batteries_hauteur_prevue') },
  { header: 'Hauteur de tours réalisée (m)', width: 20, fmt: '0.00', get: r => num(r, 'tour_travail_hauteur_realisee') },
  { header: 'Hauteur de tour prévue (m)', width: 20, fmt: '0.00', get: r => num(r, 'tour_travail_hauteur_prevue') },
  { header: "Hauteur d'expédition réalisée (m)", width: 26, fmt: '0.00', get: r => num(r, 'tour_expedition_hauteur_realisee') },
  { header: "Hauteur d'expédition prévue (m)", width: 26, fmt: '0.00', get: r => num(r, 'tour_expedition_hauteur_prevue') },
  { header: "Taux d'avancement des travaux de superstructure (%)", width: 36, fmt: PCT, get: r => pct(r, 'taux_avancement_superstructure') },
  { header: 'Gros Œuvres (%)', width: 38, fmt: PCT, get: r => pct(r, 'superstructure_gros_oeuvres') },
  { header: 'Finition : CES+CET (%)', width: 38, fmt: PCT, get: r => pct(r, 'superstructure_finition') },
  { header: "Taux d'avancement PHYSIQUE GLOBAL (%)", width: 35, fmt: PCT, get: r => pct(r, 'tauxAvancementGlobal') },
  { header: "mode d'intervention (3X8)", width: 33, get: r => valueOf(r, 'modeIntervention') },
  { header: 'Observations /Contraintes (Techniques, Contractuelles, Organisationnelles & Financières)',
    width: 120, align: 'left',
    get: (r) => {
      const obs = valueOf(r, 'observations');
      if (r.fallbackFrom) {
        return `[Données du rapport du ${fmtDate(r.fallbackFrom)} — rapport de cette semaine non transmis à la GEE]`
          + (obs ? `
${obs}` : '');
      }
      if (!r.hasData) return r.status === 'missing' ? 'Rapport non soumis' : 'Rapport non transmis à la GEE';
      return obs;
    } },
];

const colLetter = (i) => {
  let s = ''; let n = i;
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
};

const styleHeader = (cell, { fill = HEADER_LIGHT, size = 22, font = 'Calibri' } = {}) => {
  cell.font = { name: font, size, bold: true };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
  cell.alignment = CENTER;
  cell.border = BORDER;
};

// Merge a range, write the value in its top-left cell and style every cell of it
// (borders on merged cells only show if each cell carries them).
const mergeHeader = (ws, range, value, style) => {
  ws.mergeCells(range);
  const [from, to] = range.split(':');
  const a = ws.getCell(from); const b = ws.getCell(to);
  for (let r = a.row; r <= b.row; r++) {
    for (let c = a.col; c <= b.col; c++) styleHeader(ws.getCell(r, c), style);
  }
  a.value = value;
};

// Ministry lines + dated title + revision box, shared by both client sheets
// ministryLastCol: the template centres the ministry lines over A:N / A:Z, not the full width
const writeTitleBlock = (ws, lastCol, titleRow, title, ministryLastCol) => {
  const last = colLetter(lastCol);
  MINISTRY_LINES.forEach((text, i) => {
    ws.mergeCells(`A${i + 1}:${colLetter(ministryLastCol)}${i + 1}`);
    const cell = ws.getCell(`A${i + 1}`);
    cell.value = text;
    cell.font = { name: 'Verdana', size: 22, bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(i + 1).height = 27.75;
  });

  const titleEnd = colLetter(lastCol - 2);
  mergeHeader(ws, `A${titleRow}:${titleEnd}${titleRow}`, title, { fill: 'FFFFFFFF', size: 28, font: 'Arial' });
  mergeHeader(ws, `${colLetter(lastCol - 1)}${titleRow}:${last}${titleRow}`, TEMPLATE_REVISION,
    { fill: 'FFFFFFFF', size: 28, font: 'Arial' });
  ws.getRow(titleRow).height = 50.1;
  ws.getRow(titleRow + 1).height = 17.25;
};

// Data rows; the Filiale cell is merged over consecutive rows of the same bureau
const writeDataRows = (ws, columns, reports, firstRow, height) => {
  reports.forEach((report, i) => {
    const row = ws.getRow(firstRow + i);
    row.height = height;
    columns.forEach((col, c) => {
      const cell = row.getCell(c + 1);
      cell.value = c === 0 ? (report.bureau?.name || '—') : (col.get(report) ?? null);
      cell.font = { name: 'Calibri', size: c === 0 ? 18 : 22, bold: c === 0 };
      cell.alignment = { ...CENTER, horizontal: col.align || 'center' };
      cell.border = BORDER;
      if (col.fmt) cell.numFmt = col.fmt;
    });
  });

  let start = 0;
  for (let i = 1; i <= reports.length; i++) {
    const same = i < reports.length && reports[i].bureau?.name === reports[start].bureau?.name;
    if (!same) {
      if (i - 1 > start) ws.mergeCells(`A${firstRow + start}:A${firstRow + i - 1}`);
      start = i;
    }
  }
};

// No printArea: exceljs doesn't escape the apostrophe in "Etat d'avancement…" and
// Excel then reports the file as damaged. Fit-to-page already prints the used range.
const setupPage = (ws) => {
  ws.pageSetup = {
    paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1,
    horizontalCentered: true,
    margins: { left: 0.2, right: 0.2, top: 0.2, bottom: 0.2, header: 0.31, footer: 0.12 },
  };
  ws.views = [{ zoomScale: 40 }];
};

const buildSituationSheet = (wb, reports, dateLabel) => {
  const ws = wb.addWorksheet('Situation contractuelle');
  const cols = SITUATION_COLUMNS;
  ws.columns = cols.map(c => ({ width: c.width }));
  writeTitleBlock(ws, cols.length, 4, `SITUATION CONTRACTUELLE DES PROJETS DES SILOS ARRETEE AU ${dateLabel}`, 14);

  cols.forEach((c, i) => mergeHeader(ws, `${colLetter(i + 1)}6:${colLetter(i + 1)}7`, c.header));
  ws.getRow(6).height = 55.5;
  ws.getRow(7).height = 142.5;

  const first = 8;
  writeDataRows(ws, cols, reports, first, 63.6);
  const lastData = first + reports.length - 1;

  // Totals: average progress, summed amounts — Excel formulas, as in the template
  const totals = ws.getRow(lastData + 1);
  const range = (col) => `${col}${first}:${col}${lastData}`;
  const sum = (key) => reports.reduce((s, r) => s + (Number(key(r)) || 0), 0);
  const progress = reports.map(r => pct(r, 'tauxAvancementGlobal')).filter(n => typeof n === 'number');
  const avgProgress = progress.length ? progress.reduce((s, n) => s + n, 0) / progress.length : 0;
  const totalMarche = sum(r => r.project?.montantMarche);
  const totalEncaisse = sum(r => num(r, 'entreprise_encaissement'));

  totals.getCell('H').value = { formula: `IFERROR(AVERAGE(${range('H')}),0)`, result: avgProgress };
  totals.getCell('H').numFmt = PCT;
  totals.getCell('J').value = { formula: `SUM(${range('J')})`, result: totalMarche };
  totals.getCell('K').value = { formula: `SUM(${range('K')})`, result: sum(r => num(r, 'entreprise_facturation')) };
  totals.getCell('M').value = { formula: `SUM(${range('M')})`, result: totalEncaisse };
  ['J', 'K', 'M'].forEach(c => { totals.getCell(c).numFmt = MONEY; });
  totals.eachCell(c => { c.font = { name: 'Calibri', size: 22 }; c.alignment = CENTER; });

  const avgRow = lastData + 2;
  ws.mergeCells(`A${avgRow}:E${avgRow}`);
  const label = ws.getCell(`A${avgRow}`);
  label.value = "TAUX D'AVANCEMENT GLOBAL MOYEN";
  label.font = { name: 'Calibri', size: 24, bold: true };
  label.alignment = CENTER;
  const avg = ws.getCell(`F${avgRow}`);
  avg.value = { formula: `H${lastData + 1}`, result: avgProgress };
  avg.font = { name: 'Calibri', size: 26, bold: true, color: { argb: 'FFFF0000' } };
  avg.numFmt = PCT;
  avg.alignment = CENTER;
  const encRate = ws.getCell(`N${avgRow}`);
  encRate.value = { formula: `IFERROR(M${lastData + 1}/J${lastData + 1},0)`, result: totalMarche ? totalEncaisse / totalMarche : 0 };
  encRate.font = { name: 'Calibri', size: 22 };
  encRate.numFmt = PCT;
  encRate.alignment = CENTER;
  for (let c = 1; c <= 6; c++) ws.getCell(avgRow, c).border = BORDER;
  ws.getRow(avgRow).height = 48.75;

  setupPage(ws);
};

const buildAvancementSheet = (wb, reports, dateLabel) => {
  const ws = wb.addWorksheet("Etat d'avancement des travaux");
  const cols = AVANCEMENT_COLUMNS;
  ws.columns = cols.map(c => ({ width: c.width }));
  writeTitleBlock(ws, cols.length, 5,
    `ETAT D'AVANCEMENT DES TRAVAUX DE REALISATION DES SILOS ARRETE AU ${dateLabel}`, 26);

  // Four header rows: section band (7), group (8), sub-group (9), field (10)
  const band = { fill: HEADER_DARK, size: 48, font: 'Arial' };
  mergeHeader(ws, 'D7:Q7', 'INFRASTRUCTURE', band);
  mergeHeader(ws, 'R7:AB7', 'SUPERSTRUCTURE', band);

  const group = { size: 24 };
  mergeHeader(ws, 'A8:A10', 'Filiale');
  mergeHeader(ws, 'B8:B10', "Site d'implantation du Silo");
  mergeHeader(ws, 'C8:C10', 'Entreprise de réalisation');
  mergeHeader(ws, 'D8:G8', 'Infrastructure cellules de stockage', group);
  mergeHeader(ws, 'H8:K8', 'Infrastructure tours de travail', group);
  mergeHeader(ws, 'L8:O8', "Infrastructure poste d'expédition", group);
  mergeHeader(ws, 'P8:P9', 'VRD', group);
  mergeHeader(ws, 'Q8:Q10', cols[16].header, group);
  mergeHeader(ws, 'R8:U9', 'Superstructure cellule de stockage');
  mergeHeader(ws, 'V8:W9', 'Superstructure des tours de travail');
  mergeHeader(ws, 'X8:Y9', "Superstructure d'expédition");
  mergeHeader(ws, 'Z8:Z10', cols[25].header, group);
  mergeHeader(ws, 'AA8:AB9', "Taux d'avancement des travaux Ouvrages Annexes (OA) (%)");
  mergeHeader(ws, 'AC8:AC10', cols[28].header, group);
  mergeHeader(ws, 'AD8:AD10', cols[29].header);
  mergeHeader(ws, 'AE8:AE10', cols[30].header, group);
  [['D9:F9', 'G9'], ['H9:J9', 'K9'], ['L9:N9', 'O9']].forEach(([pieux, radier]) => {
    mergeHeader(ws, pieux, 'Fondations profondes (Pieux)');
    styleHeader(ws.getCell(radier));
    ws.getCell(radier).value = 'Radier général';
  });
  // Row 10: one label per field column that isn't already merged from above
  [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 19, 20, 21, 22, 23, 24, 25, 27, 28].forEach(c => {
    const cell = ws.getCell(10, c);
    styleHeader(cell, { size: 20 });
    cell.value = cols[c - 1].header;
  });
  ws.getRow(7).height = 55.5;
  ws.getRow(8).height = 55.5;
  ws.getRow(9).height = 45.6;
  ws.getRow(10).height = 105.6;

  writeDataRows(ws, cols, reports, 11, 187.8);
  setupPage(ws);
};

// Platform-only tracking (not in the client template): who submitted when, lateness
const buildSuiviSheet = (wb, reports, dateLabel, rows) => {
  const ws = wb.addWorksheet('Suivi des soumissions');
  const cols = [
    { header: 'Filiale', width: 18, get: r => r.bureau?.name || '—' },
    { header: 'Projet', width: 30, get: r => r.project?.name || '—' },
    { header: 'Semaine', width: 14, get: r => r.weekLabel || '—' },
    { header: 'Statut', width: 16, get: r => STATUS_LABELS[r.status] || r.status },
    { header: 'Soumis le', width: 20, get: r => (r.submittedAt ? fmtDateTime(r.submittedAt) : 'Non soumis') },
    // bureauApprovedAt is also stamped on a bureau rejection, so only trust it
    // once the report actually reached GEE
    { header: 'Envoyé à GEE le', width: 20,
      get: r => (SENT_TO_GEE_STATUSES.includes(r.status) && r.bureauApprovedAt ? fmtDateTime(r.bureauApprovedAt) : 'Non envoyé') },
    { header: 'En retard', width: 12, get: r => (r.isLate ? 'Oui' : 'Non') },
    { header: 'Retard', width: 12, get: fmtLateBy },
    { header: 'Données consolidées', width: 30, get: (r, i) => rows[i].source },
  ];
  ws.columns = cols.map(c => ({ width: c.width }));

  ws.mergeCells(`A1:${colLetter(cols.length)}1`);
  const title = ws.getCell('A1');
  title.value = `SUIVI DES SOUMISSIONS — SEMAINE ARRETEE AU ${dateLabel}`;
  title.font = { name: 'Arial', size: 14, bold: true };
  title.alignment = CENTER;
  ws.getRow(1).height = 30;

  cols.forEach((c, i) => {
    const cell = ws.getCell(2, i + 1);
    styleHeader(cell, { size: 11 });
    cell.value = c.header;
  });

  reports.forEach((r, i) => {
    const row = ws.getRow(i + 3);
    cols.forEach((c, j) => {
      const cell = row.getCell(j + 1);
      cell.value = c.get(r, i);
      cell.border = BORDER;
      cell.alignment = CENTER;
      if (r.isLate) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCCCC' } };
    });
  });

  const count = (fn) => reports.filter(fn).length;
  const summaryRow = reports.length + 4;
  ws.mergeCells(`A${summaryRow}:${colLetter(cols.length)}${summaryRow}`);
  const summary = ws.getCell(`A${summaryRow}`);
  summary.value = `Total projets: ${reports.length}  |  Acceptés: ${count(r => r.status === 'accepted')}  |  ` +
    `En attente: ${count(r => ['draft', 'submitted', 'bureau_approved', 'bureau_rejected'].includes(r.status))}  |  ` +
    `Non soumis: ${count(r => r.status === 'missing')}  |  En retard: ${count(r => r.isLate)}`;
  summary.font = { bold: true };
  summary.alignment = { horizontal: 'center' };

  const crRow = ws.getRow(summaryRow + 2);
  ws.mergeCells(`A${crRow.number}:${colLetter(cols.length)}${crRow.number}`);
  crRow.getCell(1).value = `© ${new Date().getFullYear()} Groupe Études & Engineering (GEE) — Document Confidentiel`;
  crRow.getCell(1).font = { italic: true, size: 9, color: { argb: 'FF9E9E9E' } };
  crRow.getCell(1).alignment = { horizontal: 'center' };
};

// Only data that reached the GEE is consolidated. A project whose report for this
// week hasn't (missing, draft, at the BET, rejected) carries its latest earlier
// report that did, so totals and averages don't drop to zero.
const CONSOLIDATED_STATUSES = ['bureau_approved', 'accepted'];

const resolveConsolidatedRows = (reports, weekEnd) => {
  const weekStart = new Date(weekEnd);
  weekStart.setDate(weekStart.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);

  return Promise.all(reports.map(async (r) => {
    const row = { bureau: r.bureau, project: r.project, status: r.status };
    if (CONSOLIDATED_STATUSES.includes(r.status)) {
      return { ...row, values: r.values, hasData: true, source: 'Semaine en cours' };
    }
    const last = await WeeklyReport.findOne({
      project: r.project?._id || r.project,
      status: { $in: CONSOLIDATED_STATUSES },
      weekEnd: { $lt: weekStart },
    }).sort({ weekEnd: -1 }).select('values weekEnd').lean();
    if (!last) return { ...row, values: new Map(), hasData: false, source: 'Aucune donnée' };
    return {
      ...row, values: last.values, hasData: true, fallbackFrom: last.weekEnd,
      source: `Semaine du ${fmtDate(last.weekEnd)} (dernier rapport transmis)`,
    };
  }));
};

// weekEnd: the Wednesday the consolidation is "arrêtée au"
const exportWeeklyReports = async (reports, weekEnd) => {
  const workbook = new ExcelJS.Workbook();
  const dateLabel = fmtDate(weekEnd);
  const rows = await resolveConsolidatedRows(reports, weekEnd);
  buildSituationSheet(workbook, rows, dateLabel);
  buildAvancementSheet(workbook, rows, dateLabel);
  buildSuiviSheet(workbook, reports, dateLabel, rows);
  return workbook;
};

module.exports = { exportWeeklyReports, addMissingReports };
