import { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Button, TextField, Select, MenuItem,
  FormControl, InputLabel, Switch, FormControlLabel,
  CircularProgress, Alert, Stepper, Step, StepLabel,
  Divider, InputAdornment, Chip
} from '@mui/material';
import { Save, Send } from '@mui/icons-material';
import api from '../../utils/api';

const DERIVED_KEYS = [
  'tauxConsommationDelais', 'avance_remboursement_cumule',
  'taux_facturation_marche', 'taux_encaissement_facturation',
  'taux_encaissement_marche', 'taux_avance_encaisse', 'delais_restant',
];

//Titles per Page
const PAGE_TITLES = {
  1: 'Situation Contractuelle',
  2: 'Infrastructure',
  3: 'Superstructure',
  4: 'Exploitation',
  5: 'Paiement',
};

// ─── Spec pairs
const SPEC_PAIRS = [
  { specKey: 'cellules_pieux_prevus', reportKey: 'cellules_pieux_realises', label: 'Cellules — Pieux', unit: '' },
  { specKey: 'cellules_profondeur', reportKey: 'cellules_profondeur', label: 'Cellules — Profondeur', unit: 'm' },
  { specKey: 'tour_travail_pieux_prevus', reportKey: 'tour_travail_pieux_realises', label: 'Tour de travail — Pieux', unit: '' },
  { specKey: 'tour_travail_profondeur', reportKey: 'tour_travail_profondeur', label: 'Tour de travail — Profondeur', unit: 'm' },
  { specKey: 'tour_travail_hauteur_prevue', reportKey: 'tour_travail_hauteur_realisee', label: 'Tour de travail — Hauteur', unit: 'ML' },
  { specKey: 'tour_expedition_pieux_prevus', reportKey: 'tour_expedition_pieux_realises', label: "Tour d'expédition — Pieux", unit: '' },
  { specKey: 'tour_expedition_profondeur', reportKey: 'tour_expedition_profondeur', label: "Tour d'expédition — Profondeur", unit: 'm' },
  { specKey: 'tour_expedition_hauteur_prevue', reportKey: 'tour_expedition_hauteur_realisee', label: "Tour d'expédition — Hauteur", unit: 'ML' },
  { specKey: 'batteries_hauteur_prevue', reportKey: 'batterie1_hauteur', label: 'Batterie 1 — Hauteur', unit: 'ML' },
  { specKey: 'batteries_hauteur_prevue', reportKey: 'batterie2_hauteur', label: 'Batterie 2 — Hauteur', unit: 'ML' },
  { specKey: 'batteries_hauteur_prevue', reportKey: 'batterie3_hauteur', label: 'Batterie 3 — Hauteur', unit: 'ML' },
];

// Group an ordered field list
const groupBySection = (fields) => {
  const groups = [];
  for (const f of fields) {
    const section = f.section || '';
    const last = groups[groups.length - 1];
    if (last && last.section === section) last.fields.push(f);
    else groups.push({ section, fields: [f] });
  }
  return groups;
};

// Canvas keys
const SPEC_MIRROR_KEYS = {
  cellules_pieux_prevus: 'cellules_pieux_prevus',
  tour_travail_pieux_prevus: 'tour_travail_pieux_prevus',
  tour_expedition_pieux_prevus: 'tour_expedition_pieux_prevus',
  tour_travail_hauteur_prevue: 'tour_travail_hauteur_prevue',
  tour_expedition_hauteur_prevue: 'tour_expedition_hauteur_prevue',
  batteries_hauteur_prevue: 'batteries_hauteur_prevue',
};

// ─── Render a single field dynamically ────────────────────────
const DynamicField = ({ field, value, onChange, disabled, helperText }) => {
  const handleChange = (val) => onChange(field.key, val);

  const inputProps = field.unit
    ? { endAdornment: <InputAdornment position="end">{field.unit}</InputAdornment> }
    : {};

  switch (field.type) {
    case 'number':
      return (
        <TextField
          label={field.label}
          type="number"
          value={value ?? ''}
          onChange={e => handleChange(e.target.value === '' ? '' : +e.target.value)}
          required={field.required}
          disabled={disabled}
          InputProps={inputProps}
          helperText={helperText}
          fullWidth
          size="small"
        />
      );

    case 'text':
      return (
        <TextField
          label={field.label}
          value={value ?? ''}
          onChange={e => handleChange(e.target.value)}
          required={field.required}
          disabled={disabled}
          InputProps={inputProps}
          fullWidth
          size="small"
        />
      );

    case 'textarea':
      return (
        <TextField
          label={field.label}
          value={value ?? ''}
          onChange={e => handleChange(e.target.value)}
          required={field.required}
          disabled={disabled}
          multiline
          rows={3}
          fullWidth
          size="small"
        />
      );

    case 'select':
      return (
        <FormControl fullWidth size="small" required={field.required} disabled={disabled}>
          <InputLabel>{field.label}</InputLabel>
          <Select value={value ?? ''} label={field.label} onChange={e => handleChange(e.target.value)}>
            {(field.options || []).map(opt => (
              <MenuItem key={opt} value={opt}>{opt}</MenuItem>
            ))}
          </Select>
        </FormControl>
      );

    case 'boolean':
      return (
        <FormControlLabel
          control={
            <Switch
              checked={value === true || value === 'true'}
              onChange={e => handleChange(e.target.checked)}
              disabled={disabled}
            />
          }
          label={field.label}
        />
      );

    default:
      return null;
  }
};

// ─── Main Form Component ───────────────────────────────────────
export default function WeeklyReportForm({ projectId, projectType = 'Industriel', project, existingReport, onSuccess }) {
  const [canvas, setCanvas] = useState(null);
  const [canvasLoading, setCanvasLoading] = useState(true);
  const [canvasError, setCanvasError] = useState('');
  const [values, setValues] = useState({});
  const [lastValues, setLastValues] = useState(null);
  const [lastStatus, setLastStatus] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const specs = project?.specs || {};
  const readonlyKeys = useMemo(
    () => [
      ...Object.keys(SPEC_MIRROR_KEYS).filter(k => specs[SPEC_MIRROR_KEYS[k]] != null),
      ...DERIVED_KEYS,
    ],
    [specs]
  );

  const specWarnings = useMemo(() => {
    if (!project) return [];
    return SPEC_PAIRS.reduce((acc, { specKey, reportKey, label, unit }) => {
      const specVal = specs[specKey];
      const reportVal = values[reportKey];
      if (specVal != null && reportVal != null && reportVal !== '' && reportVal > specVal) {
        acc.push(`${label}: ${reportVal}${unit} > prévu ${specVal}${unit}`);
      }
      return acc;
    }, []);
  }, [values, project, specs]);

  useEffect(() => {
    const fetchCanvas = async () => {
      setCanvasLoading(true);
      setCanvasError('');
      try {
        const res = await api.get(`/report-canvas/active/${projectType}`);
        setCanvas(res.data);
      } catch (err) {
        setCanvasError(
          err.response?.status === 404
            ? `Aucun canvas actif pour le type "${projectType}". Contactez un administrateur GEE.`
            : 'Erreur lors du chargement du formulaire'
        );
      } finally {
        setCanvasLoading(false);
      }
    };
    fetchCanvas();
  }, [projectType]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/reports/weekly/project/${projectId}/last-values`);
        const prev = data?.values;
        if (!cancelled) {
          setLastValues(prev?.values || null);
          setLastStatus(prev?.status || null);
        }
      } catch {
        if (!cancelled) setLastValues(null);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  useEffect(() => {
    if (!canvas) return;

    const next = {};

    // 1. Spec-mirrored defaults
    for (const [canvasKey, specKey] of Object.entries(SPEC_MIRROR_KEYS)) {
      if (specs[specKey] != null) next[canvasKey] = specs[specKey];
    }

    const saved = existingReport?.values || {};

    // 2. Derived — taux délais
    if (project?.dateODS && project?.delaisContractuel) {
      const elapsedDays = (Date.now() - new Date(project.dateODS)) / 86400000;
      const contractDays = project.delaisContractuel * 30.44;
      next.tauxConsommationDelais = Number(Math.max(0, (elapsedDays / contractDays) * 100).toFixed(1));
    }

    // 3. Avance + derived financial taux 
    if (lastValues) {
      ['avance_remboursement_cumule', 'taux_facturation_marche',
        'taux_encaissement_facturation', 'taux_encaissement_marche',
        'taux_avance_encaisse'].forEach(k => {
          if (lastValues[k] != null) next[k] = lastValues[k];
        });
    }
    if (specs.avance_forfaitaire != null) {
      const fact = saved?.entreprise_facturation;
      if (fact != null && fact !== '') {
        next.avance_remboursement_cumule = Math.min(Number(specs.avance_forfaitaire), Number(fact));
      }
    }

    // 4. Carry forward délais supplémentaire from previous report
    if (lastValues?.delais_supplementaire != null) {
      next.delais_supplementaire = lastValues.delais_supplementaire;
    }

    // 5. Carry forward cumulative fields already at their cap
    if (lastValues) {
      canvas.fields.forEach(f => {
        if (!f.cumulative) return;
        const pair = SPEC_PAIRS.find(p => p.reportKey === f.key);
        const cap = pair ? specs[pair.specKey] : (f.unit === '%' ? 100 : null);
        const lastV = lastValues[f.key];
        if (cap != null && lastV != null && Number(lastV) >= Number(cap)) {
          next[f.key] = lastV;
        }
      });
    }

    // 6. Saved values win over everything above
    canvas.fields.forEach(f => {
      if (saved[f.key] !== undefined && saved[f.key] !== null) {
        next[f.key] = saved[f.key];
      }
    });

    // 7. Derived — délais restant (needs supplémentaire resolved above)
    if (project?.dateODS && project?.delaisContractuel) {
      const elapsedM = (Date.now() - new Date(project.dateODS)) / 86400000 / 30.44;
      const supp = Number(next.delais_supplementaire) || 0;
      next.delais_restant = Number(((project.delaisContractuel + supp) - elapsedM).toFixed(1));
    }

    setValues(next);
  }, [existingReport, canvas, project, lastValues]);

  useEffect(() => {
    if (specs.avance_forfaitaire == null) return;
    const fact = values.entreprise_facturation;
    if (fact == null || fact === '') return;
    const floor = Number(lastValues?.avance_remboursement_cumule) || 0;
    const computed = Math.max(floor, Math.min(Number(specs.avance_forfaitaire), Number(fact)));
    if (values.avance_remboursement_cumule !== computed) {
      setValues(v => ({ ...v, avance_remboursement_cumule: computed }));
    }
  }, [values.entreprise_facturation, specs.avance_forfaitaire, lastValues]);

  // Live recompute of Rev01 derived fields
  useEffect(() => {
    const marche = Number(project?.montantMarche);
    const fact = Number(values.entreprise_facturation);
    const enc = Number(values.entreprise_encaissement);
    const next = {};
    if (marche > 0 && !Number.isNaN(fact))
      next.taux_facturation_marche = Number(((fact / marche) * 100).toFixed(1));
    if (fact > 0 && !Number.isNaN(enc))
      next.taux_encaissement_facturation = Number(((enc / fact) * 100).toFixed(1));
    if (marche > 0 && !Number.isNaN(enc))
      next.taux_encaissement_marche = Number(((enc / marche) * 100).toFixed(10));
    const avance = Number(specs.avance_forfaitaire);
    const remb = Number(values.avance_remboursement_cumule);
    if (avance > 0 && !Number.isNaN(remb))
      next.taux_avance_encaisse = Number(((remb / avance) * 100).toFixed(1));
    if (project?.dateODS && project?.delaisContractuel) {
      const elapsedM = (Date.now() - new Date(project.dateODS)) / 86400000 / 30.44;
      const supp = Number(values.delais_supplementaire) || 0;
      next.delais_restant = Number(((project.delaisContractuel + supp) - elapsedM).toFixed(1));
    }
    const changed = Object.keys(next).some(k => values[k] !== next[k]);
    if (changed) setValues(v => ({ ...v, ...next }));
  }, [values.entreprise_facturation, values.entreprise_encaissement,
  values.avance_remboursement_cumule, values.delais_supplementaire,
  project?.montantMarche, project?.dateODS, project?.delaisContractuel,
  specs.avance_forfaitaire]);

  // Derived: pages list
  const pages = canvas
    ? [...new Set(canvas.fields.map(f => f.page))].sort((a, b) => a - b)
    : [];

  const currentPageNumber = pages[currentPage];
  const currentFields = canvas
    ? canvas.fields
      .filter(f => f.page === currentPageNumber)
      .sort((a, b) => a.order - b.order)
    : [];

  const handleChange = (key, val) => {
    setValues(v => ({ ...v, [key]: val }));
    setError('');
  };

  const validateCurrentPage = () => {
    const missing = currentFields
      .filter(f => f.required && (values[f.key] === undefined || values[f.key] === '' || values[f.key] === null))
      .map(f => f.label);
    return missing;
  };

  const handleNext = () => {
    const missing = validateCurrentPage();
    if (missing.length) {
      setError(`Champs obligatoires manquants : ${missing.join(', ')}`);
      return;
    }
    setError('');
    setCurrentPage(p => p + 1);
  };

  const handleBack = () => {
    setError('');
    setCurrentPage(p => p - 1);
  };

  // Save as draft
  const handleSaveDraft = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = { projectId, ...values };
      if (existingReport) {
        await api.put(`/reports/weekly/${existingReport._id}`, payload);
      } else {
        await api.post('/reports/weekly', payload);
      }
      setSuccess('Brouillon sauvegardé');
      if (onSuccess) onSuccess('draft');
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // Submit report — required-field check is a fast local guard; spec
  // validation is left entirely to the server (single source of truth).
  const handleSubmit = async () => {
    const allMissing = canvas?.fields
      .filter(f => f.required && (values[f.key] === undefined || values[f.key] === ''))
      .map(f => f.label) || [];

    if (allMissing.length) {
      setError(`Champs obligatoires manquants : ${allMissing.join(', ')}`);
      return;
    }

    if (specWarnings.length) {
      setError(`Valeurs supérieures aux prévus : ${specWarnings.join(' | ')}`);
      return;
    }

    const marcheV = Number(project?.montantMarche);
    const factV = Number(values.entreprise_facturation);
    if (marcheV > 0 && !Number.isNaN(factV) && factV > marcheV) {
      setError(`Facturation Entreprise (${factV.toLocaleString('fr-DZ')} DA) dépasse le montant du marché (${marcheV.toLocaleString('fr-DZ')} DA)`);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      let reportId = existingReport?._id;

      // Save/update first
      const payload = { projectId, ...values };
      if (reportId) {
        await api.put(`/reports/weekly/${reportId}`, payload);
      } else {
        const res = await api.post('/reports/weekly', payload);
        reportId = res.data._id;
      }

      // Then submit
      await api.put(`/reports/weekly/${reportId}/submit`);
      setSuccess('Rapport soumis avec succès');
      if (onSuccess) onSuccess('submitted');
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la soumission');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Loading / Error states ──────────────────────────────────
  if (canvasLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (canvasError) {
    return <Alert severity="error">{canvasError}</Alert>;
  }

  const isLastPage = currentPage === pages.length - 1;
  const isReadOnly = existingReport && !['draft', 'rejected', 'bureau_rejected'].includes(existingReport.status);

  return (
    <Box>
      {/* Canvas name badge */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Chip label={canvas.name} size="small" color="primary" variant="outlined" />
        <Chip label={`${canvas.fields.length} champs`} size="small" variant="outlined" />
      </Box>

      {/* Stepper */}
      {pages.length > 1 && (
        <Stepper activeStep={currentPage} sx={{ mb: 3 }}>
          {pages.map((page, index) => (
            <Step key={page} completed={index < currentPage}>
              <StepLabel>{PAGE_TITLES[page] || `Page ${page}`}</StepLabel>
            </Step>
          ))}
        </Stepper>
      )}

      {/* Fields grouped by section */}
      {groupBySection(currentFields).map((group, gi) => (
        <Box key={gi} sx={{ mb: 2 }}>
          {group.section && (
            <Divider sx={{ mb: 2 }}>
              <Chip label={group.section} size="small" color="primary" variant="outlined" />
            </Divider>
          )}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 2,
              mb: 1
            }}
          >
            {group.fields.map(field => {
              const pair = SPEC_PAIRS.find(p => p.reportKey === field.key);
              const cap = pair ? specs[pair.specKey] : (field.unit === '%' && field.cumulative ? 100 : null);
              const maxedOut = field.cumulative && cap != null &&
                lastValues?.[field.key] != null &&
                Number(lastValues[field.key]) >= Number(cap);
              const showLast =
                field.cumulative &&
                !DERIVED_KEYS.includes(field.key) &&
                lastValues && lastValues[field.key] != null;
              const helper = maxedOut
                ? 'Valeur maximale atteinte'
                : showLast
                  ? `Semaine précédente : ${Number(lastValues[field.key]).toLocaleString('fr-DZ')}${field.unit ? ' ' + field.unit : ''}`
                  : undefined;
              return (
                <DynamicField
                  key={field.key}
                  field={field}
                  value={values[field.key]}
                  onChange={handleChange}
                  disabled={
                    isReadOnly ||
                    readonlyKeys.includes(field.key) ||
                    maxedOut ||
                    (field.key === 'delais_supplementaire' &&
                      lastStatus === 'accepted' &&
                      lastValues?.delais_supplementaire != null &&
                      Number(values.delais_restant) > 0)
                  }
                  helperText={helper}
                />
              );
            })}
          </Box>
        </Box>
      ))}

      {/* Avance forfaitaire — solde restant hint */}
      {specs.avance_forfaitaire != null &&
        currentFields.some(f => f.key === 'avance_remboursement_cumule') && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography fontSize="0.85rem">
              Avance forfaitaire : <b>{Number(specs.avance_forfaitaire).toLocaleString('fr-DZ')} DA</b>
              {' — '}Remboursé : <b>{Number(values.avance_remboursement_cumule || 0).toLocaleString('fr-DZ')} DA</b>
              {' — '}Solde restant : <b>{(Number(specs.avance_forfaitaire) - Number(values.avance_remboursement_cumule || 0)).toLocaleString('fr-DZ')} DA</b>
            </Typography>
          </Alert>
        )}

      {/* Live spec warnings — non-blocking until submit */}
      {!isReadOnly && specWarnings.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography fontSize="0.85rem" fontWeight={600} sx={{ mb: 0.5 }}>
            Valeurs supérieures aux prévus du projet
          </Typography>
          {specWarnings.map((w, i) => (
            <Typography key={i} fontSize="0.8rem">• {w}</Typography>
          ))}
        </Alert>
      )}

      {/* Errors / Success */}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {isReadOnly ? (
        <Alert severity="info">Ce rapport est en lecture seule (statut : {existingReport.status})</Alert>
      ) : (
        <>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {/* Navigation */}
            <Box sx={{ display: 'flex', gap: 1 }}>
              {currentPage > 0 && (
                <Button variant="outlined" onClick={handleBack}>← Précédent</Button>
              )}
              {!isLastPage && (
                <Button variant="contained" onClick={handleNext}>Suivant →</Button>
              )}
            </Box>

            {/* Save draft — available on every page */}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={saving ? <CircularProgress size={16} /> : <Save />}
                onClick={handleSaveDraft}
                disabled={saving || submitting}
              >
                Sauvegarder brouillon
              </Button>
              {isLastPage && (
                <Button
                  variant="contained"
                  startIcon={submitting ? <CircularProgress size={16} /> : <Send />}
                  onClick={handleSubmit}
                  disabled={saving || submitting}
                >
                  Soumettre
                </Button>
              )}
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
}