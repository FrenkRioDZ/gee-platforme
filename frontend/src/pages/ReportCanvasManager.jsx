import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, IconButton, Chip, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel,
  Switch, FormControlLabel, Divider, Alert, CircularProgress,
  Table, TableBody, TableCell, TableHead, TableRow, Paper,
  Accordion, AccordionSummary, AccordionDetails, Badge
} from '@mui/material';
import {
  Add, Edit, Delete, ExpandMore, DragIndicator,
  CheckCircle, Cancel, Visibility, ContentCopy, Save
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import api from '../utils/api';
import Layout from '../components/layout/Layout';

// ─── Constants ────────────────────────────────────────────────
const FIELD_TYPES = ['number', 'text', 'textarea', 'select', 'boolean'];
const PROJECT_TYPES = ['Industriel', 'Batiment', 'Equipement_Public'];
const PROJECT_TYPE_LABELS = {
  Industriel: 'Industriel (Silos)',
  Batiment: 'Bâtiments',
  Equipement_Public: 'Équipement Public'
};

const emptyField = () => ({
  key: '', label: '', type: 'text',
  required: false, unit: '', section: '', cumulative: false, page: 1, order: 0, options: []
});

// ─── Field Editor Row ──────────────────────────────────────────
const FieldRow = ({ field, index, onChange, onRemove, provided }) => {
  const [optionInput, setOptionInput] = useState('');

  const update = (k, v) => onChange(index, { ...field, [k]: v });

  const addOption = () => {
    if (!optionInput.trim()) return;
    update('options', [...(field.options || []), optionInput.trim()]);
    setOptionInput('');
  };

  const removeOption = (i) => {
    const opts = [...(field.options || [])];
    opts.splice(i, 1);
    update('options', opts);
  };

  return (
    <Box
      ref={provided.innerRef}
      {...provided.draggableProps}
      sx={{
        display: 'flex', flexDirection: 'column', gap: 1,
        p: 1.5, mb: 1, border: '1px solid', borderColor: 'divider',
        borderRadius: 1, bgcolor: 'background.paper',
        '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' }
      }}
    >
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Box {...provided.dragHandleProps} sx={{ cursor: 'grab', color: 'text.secondary', display: 'flex', alignItems: 'center' }}>
          <DragIndicator fontSize="small" />
        </Box>

        <TextField size="small" label="Clé (key)" value={field.key}
          onChange={e => update('key', e.target.value.replace(/\s/g, '_'))}
          sx={{ flex: 1 }} required />

        <TextField size="small" label="Label (FR)" value={field.label}
          onChange={e => update('label', e.target.value)}
          sx={{ flex: 1.5 }} required />

        <FormControl size="small" sx={{ minWidth: 110 }}>
          <InputLabel>Type</InputLabel>
          <Select value={field.type} label="Type" onChange={e => update('type', e.target.value)}>
            {FIELD_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </Select>
        </FormControl>

        <TextField size="small" label="Unité" value={field.unit}
          onChange={e => update('unit', e.target.value)}
          sx={{ width: 70 }} />

        <TextField size="small" label="Section" value={field.section || ''}
          onChange={e => update('section', e.target.value)}
          sx={{ width: 140 }} />

        <TextField size="small" label="Page" type="number"
          value={field.page} onChange={e => update('page', +e.target.value)}
          sx={{ width: 65 }} />

        <FormControlLabel
          control={<Switch size="small" checked={field.required} onChange={e => update('required', e.target.checked)} />}
          label="Req." sx={{ m: 0 }} />

        <FormControlLabel
          control={<Switch size="small" checked={field.cumulative || false} onChange={e => update('cumulative', e.target.checked)} />}
          label="Cumul." sx={{ m: 0 }} />

        <IconButton size="small" color="error" onClick={() => onRemove(index)}>
          <Cancel fontSize="small" />
        </IconButton>
      </Box>

      {field.type === 'select' && (
        <Box sx={{ pl: 4, display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
          {(field.options || []).map((opt, i) => (
            <Chip key={i} label={opt} size="small" onDelete={() => removeOption(i)} />
          ))}
          <TextField size="small" placeholder="Ajouter option..." value={optionInput}
            onChange={e => setOptionInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addOption())}
            sx={{ width: 160 }} />
          <Button size="small" onClick={addOption}>+</Button>
        </Box>
      )}
    </Box>
  );
};

// ─── Canvas Form Dialog ────────────────────────────────────────
const CanvasDialog = ({ open, canvas, onClose, onSave }) => {
  const [form, setForm] = useState({ name: '', projectType: 'Industriel', fields: [], isActive: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (canvas) {
      setForm({
        name: canvas.name,
        projectType: canvas.projectType,
        fields: canvas.fields.map(f => ({ ...f })),
        isActive: canvas.isActive
      });
    } else {
      setForm({ name: '', projectType: 'Industriel', fields: [], isActive: true });
    }
    setError('');
  }, [canvas, open]);

  const addField = () => {
    setForm(f => ({ ...f, fields: [...f.fields, { ...emptyField(), order: f.fields.length }] }));
  };

  const updateField = (index, updated) => {
    setForm(f => {
      const fields = [...f.fields];
      fields[index] = updated;
      return { ...f, fields };
    });
  };

  const removeField = (index) => {
    setForm(f => {
      const fields = f.fields.filter((_, i) => i !== index);
      return { ...f, fields: fields.map((fld, i) => ({ ...fld, order: i })) };
    });
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const fields = [...form.fields];
    const [moved] = fields.splice(result.source.index, 1);
    fields.splice(result.destination.index, 0, moved);
    setForm(f => ({ ...f, fields: fields.map((fld, i) => ({ ...fld, order: i })) }));
  };

  const handleSave = async () => {
    setError('');
    if (!form.name.trim()) return setError('Nom requis');
    if (!form.fields.length) return setError('Ajoutez au moins un champ');

    const invalid = form.fields.find(f => !f.key.trim() || !f.label.trim());
    if (invalid) return setError('Chaque champ doit avoir une clé et un label');

    const keys = form.fields.map(f => f.key);
    if (new Set(keys).size !== keys.length) return setError('Les clés doivent être uniques');

    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // Group fields by page for display
  const pages = [...new Set(form.fields.map(f => f.page))].sort((a, b) => a - b);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth
      PaperProps={{ sx: { height: '90vh' } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" component="span" fontWeight={700}>
          {canvas ? 'Modifier le Canvas' : 'Nouveau Canvas'}
        </Typography>
        <FormControlLabel
          control={<Switch checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />}
          label={form.isActive ? 'Actif' : 'Inactif'} />
      </DialogTitle>

      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {error && <Alert severity="error">{error}</Alert>}

        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField label="Nom du canvas" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            fullWidth required />
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Type de projet</InputLabel>
            <Select value={form.projectType} label="Type de projet"
              onChange={e => setForm(f => ({ ...f, projectType: e.target.value }))}>
              {PROJECT_TYPES.map(t => (
                <MenuItem key={t} value={t}>{PROJECT_TYPE_LABELS[t]}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Divider />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle1" fontWeight={600}>
            Champs ({form.fields.length})
          </Typography>
          <Button startIcon={<Add />} variant="outlined" size="small" onClick={addField}>
            Ajouter un champ
          </Button>
        </Box>

        {/* Group by page with accordions */}
        {pages.length === 0 && (
          <Typography color="text.secondary" textAlign="center" py={4}>
            Aucun champ — cliquez "Ajouter un champ" pour commencer
          </Typography>
        )}

        {pages.map(page => {
          const pageFields = form.fields.filter(f => f.page === page);
          const pageIndices = form.fields.map((f, i) => ({ f, i })).filter(({ f }) => f.page === page).map(({ i }) => i);

          return (
            <Accordion key={page} defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography fontWeight={600}>Page {page}</Typography>
                <Chip label={`${pageFields.length} champ(s)`} size="small" sx={{ ml: 1 }} />
              </AccordionSummary>
              <AccordionDetails sx={{ p: 1 }}>
                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId={`page-${page}`}>
                    {(provided) => (
                      <Box ref={provided.innerRef} {...provided.droppableProps}>
                        {pageIndices.map((globalIndex, position) => (
                          <Draggable key={globalIndex} draggableId={`field-${globalIndex}`} index={position}>
                            {(provided) => (
                              <FieldRow
                                field={form.fields[globalIndex]}
                                index={globalIndex}
                                onChange={updateField}
                                onRemove={removeField}
                                provided={provided}
                              />
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </Box>
                    )}
                  </Droppable>
                </DragDropContext>
              </AccordionDetails>
            </Accordion>
          );
        })}
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={saving}>Annuler</Button>
        <Button variant="contained" startIcon={saving ? <CircularProgress size={16} /> : <Save />}
          onClick={handleSave} disabled={saving}>
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── Main Page ─────────────────────────────────────────────────
export default function ReportCanvasManager() {
  const [canvases, setCanvases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCanvas, setEditCanvas] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const fetchCanvases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/report-canvas');
      setCanvases(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCanvases(); }, [fetchCanvases]);

  const handleSave = async (form) => {
    if (editCanvas) {
      await api.put(`/report-canvas/${editCanvas._id}`, form);
    } else {
      await api.post('/report-canvas', form);
    }
    fetchCanvases();
  };

  const handleDelete = async (force = false) => {
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/report-canvas/${deleteTarget._id}${force ? '?force=true' : ''}`);
      setDeleteTarget(null);
      fetchCanvases();
    } catch (err) {
      const msg = err.response?.data?.message || 'Erreur';
      const canForce = err.response?.data?.canForce;
      if (canForce) {
        setDeleteError(msg + ' — Forcer la suppression ?');
      } else {
        setDeleteError(msg);
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleDuplicate = async (canvas) => {
    const form = {
      name: `${canvas.name} (copie)`,
      projectType: canvas.projectType,
      fields: canvas.fields,
      isActive: false
    };
    await api.post('/report-canvas', form);
    fetchCanvases();
  };

  const openCreate = () => { setEditCanvas(null); setDialogOpen(true); };
  const openEdit = (c) => { setEditCanvas(c); setDialogOpen(true); };

  return (
    <Layout pageTitle="Canvas des Rapports">
      <Box>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box>
            <Typography variant="h5" fontWeight={700}>Canvas des Rapports</Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              Définissez les formulaires de rapports hebdomadaires pour chaque type de projet
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<Add />} onClick={openCreate}>
            Nouveau Canvas
          </Button>
        </Box>

        {/* Table */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Paper variant="outlined">
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell><strong>Nom</strong></TableCell>
                  <TableCell><strong>Type de projet</strong></TableCell>
                  <TableCell><strong>Champs</strong></TableCell>
                  <TableCell><strong>Pages</strong></TableCell>
                  <TableCell><strong>Statut</strong></TableCell>
                  <TableCell><strong>Créé par</strong></TableCell>
                  <TableCell><strong>Date</strong></TableCell>
                  <TableCell align="right"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {canvases.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                      Aucun canvas — créez le premier
                    </TableCell>
                  </TableRow>
                )}
                {canvases.map(canvas => {
                  const pages = [...new Set(canvas.fields.map(f => f.page))].length;
                  return (
                    <TableRow key={canvas._id} hover>
                      <TableCell>
                        <Typography fontWeight={600}>{canvas.name}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={PROJECT_TYPE_LABELS[canvas.projectType]} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Badge badgeContent={canvas.fields.length} color="primary" max={99}>
                          <Box sx={{ width: 20 }} />
                        </Badge>
                        <Typography variant="body2" component="span" ml={2}>
                          {canvas.fields.length} champ(s)
                        </Typography>
                      </TableCell>
                      <TableCell>{pages} page(s)</TableCell>
                      <TableCell>
                        <Chip
                          icon={canvas.isActive ? <CheckCircle /> : <Cancel />}
                          label={canvas.isActive ? 'Actif' : 'Inactif'}
                          color={canvas.isActive ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {canvas.createdBy
                          ? `${canvas.createdBy.firstName} ${canvas.createdBy.lastName}`
                          : '—'}
                      </TableCell>
                      <TableCell>
                        {new Date(canvas.createdAt).toLocaleDateString('fr-DZ')}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Voir les champs">
                          <IconButton size="small" onClick={() => openEdit(canvas)}>
                            <Visibility fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Modifier">
                          <IconButton size="small" color="primary" onClick={() => openEdit(canvas)}>
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Dupliquer">
                          <IconButton size="small" onClick={() => handleDuplicate(canvas)}>
                            <ContentCopy fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Supprimer">
                          <IconButton size="small" color="error"
                            onClick={() => { setDeleteTarget(canvas); setDeleteError(''); }}>
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Paper>
        )}

        {/* Create / Edit Dialog */}
        <CanvasDialog
          open={dialogOpen}
          canvas={editCanvas}
          onClose={() => setDialogOpen(false)}
          onSave={handleSave}
        />

        {/* Delete Confirm Dialog */}
        <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
          <DialogTitle>Supprimer le canvas</DialogTitle>
          <DialogContent>
            <Typography>
              Supprimer <strong>{deleteTarget?.name}</strong> ? Cette action est réversible (suppression douce).
            </Typography>
            {deleteError && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                {deleteError}
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteTarget(null)}>Annuler</Button>
            {deleteError?.includes('Forcer') && (
              <Button color="error" variant="outlined" onClick={() => handleDelete(true)} disabled={deleting}>
                Forcer
              </Button>
            )}
            <Button color="error" variant="contained" onClick={() => handleDelete(false)} disabled={deleting}>
              {deleting ? <CircularProgress size={18} /> : 'Supprimer'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Layout>
  );
}