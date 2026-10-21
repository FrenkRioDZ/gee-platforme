import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Card, Typography, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow,
  TextField, Select, MenuItem, FormControl, InputLabel,
  CircularProgress, Alert, IconButton, Tooltip, Chip,
  Grid, Switch, FormControlLabel, Divider
} from '@mui/material';
import { Add, Edit, Refresh, FilterList, FolderSpecial, Delete } from '@mui/icons-material';
import Layout from '../components/layout/Layout';
import Modal from '../components/ui/Modal';
import api from '../utils/api';
import { projectLabel } from '../utils/project';
import { useAuth } from '../context/AuthContext';
import { canManageProjects, isGEE } from '../utils/roles';

const PROJECT_TYPES = [
  { value: 'Industriel', label: 'Projet Industriel', color: '#1565C0' },
  { value: 'Batiment', label: 'Bâtiments', color: '#2E7D32' },
  { value: 'Equipement_Public', label: 'Équipement Public', color: '#E65100' },
];

const EMPTY_FORM = {
  name: '', type: 'Industriel', siteLocation: '',
  entrepriseRealisation: '', dateODS: '',
  delaisContractuel: '', cellId: '',
  montantMarche: '', AMO: '',
  hasWeeklyReport: false,
  participantBureaus: [],
  assignedUsers: [],
  specs: {
    cellules_pieux_prevus: '',
    cellules_profondeur: '',
    tour_travail_pieux_prevus: '',
    tour_travail_profondeur: '',
    tour_travail_hauteur_prevue: '',
    tour_expedition_pieux_prevus: '',
    tour_expedition_profondeur: '',
    tour_expedition_hauteur_prevue: '',
    batteries_hauteur_prevue: '',
    avance_forfaitaire: '',
  },
};

export default function Projects() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [projects, setProjects] = useState([]);
  const [cells, setCells] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filters, setFilters] = useState({ type: '', active: 'true' });
  const [bureaus, setBureaus] = useState([]);
  const [filialeUsers, setFilialeUsers] = useState([]);

  const canManage = canManageProjects(user?.role);
  const gee = isGEE(user?.role);
  const canDelete = user?.role === 'gee_super_admin';

  const fetchFilialeUsers = async () => {
    try {
      const { data } = await api.get('/users');
      setFilialeUsers(data.filter(u => u.role === 'bureau_user'));
    } catch { }
  };

  useEffect(() => { fetchProjects(); }, [filters]);

  useEffect(() => { if (!gee) fetchCells(); }, []);

  useEffect(() => {
    if (!gee) {
      fetchCells();
      fetchFilialeUsers();
    }
    fetchBureaus();
  }, []);

  const fetchBureaus = async () => {
    try {
      const { data } = await api.get('/bureaus');
      setBureaus(data.filter(b => b._id !== user?.bureau?._id));
    } catch { }
  };

  const fetchProjects = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filters.type) params.set('type', filters.type);
      if (filters.active) params.set('active', filters.active);
      const { data } = await api.get(`/projects?${params}`);
      setProjects(data);
    } catch { setError(t('common.error')); }
    finally { setLoading(false); }
  };

  const fetchCells = async () => {
    try {
      const { data } = await api.get(`/bureaus/${user.bureau._id}`);
      setCells(data.cells || []);
    } catch { }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, hasWeeklyReport: true });
    setModal(true);
  };

  const openEdit = (project) => {
    setEditing(project);
    setForm({
      name: project.name,
      type: project.type,
      siteLocation: project.siteLocation,
      entrepriseRealisation: project.entrepriseRealisation,
      dateODS: project.dateODS
        ? new Date(project.dateODS).toISOString().split('T')[0] : '',
      delaisContractuel: project.delaisContractuel,
      cellId: project.cell || '',
      montantMarche: project.montantMarche || '',
      AMO: project.AMO || '',
      hasWeeklyReport: project.hasWeeklyReport,
      participantBureaus: project.participantBureaus?.map(b => b._id || b) || [],
      assignedUsers: project.assignedUsers?.map(u => u._id || u) || [],
      specs: {
        ...EMPTY_FORM.specs,
        ...Object.fromEntries(
          Object.entries(project.specs || {}).map(([k, v]) => [k, v ?? ''])
        ),
      },
    });
    setModal(true);
  };

  const handleChange = e => {
    const { name, value, checked, type } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'type' ? { hasWeeklyReport: value === 'Industriel' } : {})
    }));
  };

  const handleSpecChange = e => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, specs: { ...prev.specs, [name]: value } }));
  };

  const handleSave = async () => {
    if (!form.name || !form.type || !form.siteLocation || !form.entrepriseRealisation) {
      setError('Veuillez remplir tous les champs obligatoires');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        montantMarche: form.montantMarche === '' ? null : Number(form.montantMarche),
        AMO: form.AMO || '',
        cellId: form.cellId || null,
        participantBureaus: form.participantBureaus,
        assignedUsers: form.assignedUsers,
        specs: Object.fromEntries(
          Object.entries(form.specs).map(([k, v]) => [k, v === '' ? null : Number(v)])
        ),
      };
      delete payload.BET;
      if (editing) {
        await api.put(`/projects/${editing._id}`, payload);
      } else {
        await api.post('/projects', payload);
      }
      setSuccess(editing ? 'Projet mis à jour' : 'Projet créé avec succès');
      setModal(false);
      fetchProjects();
    } catch (err) {
      setError(err.response?.data?.message || t('common.error'));
    } finally { setSaving(false); }
  };

  const handleToggleActive = async (project) => {
    try {
      await api.put(`/projects/${project._id}`, { isActive: !project.isActive });
      fetchProjects();
    } catch { setError(t('common.error')); }
  };

  const handleDelete = async (project) => {
    if (!window.confirm(`Supprimer "${project.name}" ? Cette action est irréversible.`)) return;
    try {
      await api.delete(`/projects/${project._id}`);
      setSuccess('Projet supprimé');
      fetchProjects();
    } catch (err) {
      setError(err.response?.data?.message || t('common.error'));
    }
  };

  const getTypeStyle = type => PROJECT_TYPES.find(t => t.value === type) || PROJECT_TYPES[0];

  return (
    <Layout pageTitle={t('projects.title')}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" sx={{ fontFamily: '"Playfair Display", serif', color: 'primary.main' }}>
          {t('projects.title')}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Rafraîchir">
            <IconButton onClick={fetchProjects} size="small" color="primary"><Refresh /></IconButton>
          </Tooltip>
          {canManage && !gee && (
            <Button variant="contained" size="small" startIcon={<Add />} onClick={openCreate}>
              {t('projects.new')}
            </Button>
          )}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {/* Filters */}
      <Card sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <FilterList fontSize="small" color="primary" />
          <Typography fontWeight={600} fontSize="0.875rem" color="primary.main">Filtres</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Type</InputLabel>
            <Select name="type" value={filters.type} label="Type"
              onChange={e => setFilters(p => ({ ...p, type: e.target.value }))}>
              <MenuItem value="">Tous les types</MenuItem>
              {PROJECT_TYPES.map(t => (
                <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Statut</InputLabel>
            <Select name="active" value={filters.active} label="Statut"
              onChange={e => setFilters(p => ({ ...p, active: e.target.value }))}>
              <MenuItem value="true">Actifs</MenuItem>
              <MenuItem value="false">Inactifs</MenuItem>
              <MenuItem value="">Tous</MenuItem>
            </Select>
          </FormControl>
          <Button size="small" variant="outlined"
            onClick={() => setFilters({ type: '', active: 'true' })}>
            Réinitialiser
          </Button>
        </Box>
      </Card>

      {/* Table */}
      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nom du projet</TableCell>
                <TableCell>Type</TableCell>
                {gee && <TableCell>Filiale</TableCell>}
                {gee && <TableCell>Filiales Participantes</TableCell>}
                <TableCell>Site</TableCell>
                <TableCell>Entreprise</TableCell>
                <TableCell align="center">Rapport hebdo</TableCell>
                <TableCell align="center">Statut</TableCell>
                {canManage && <TableCell align="center">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={32} />
                  </TableCell>
                </TableRow>
              ) : projects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    <FolderSpecial sx={{ fontSize: 40, mb: 1, opacity: 0.3, display: 'block', mx: 'auto' }} />
                    Aucun projet
                  </TableCell>
                </TableRow>
              ) : projects.map(project => {
                const typeStyle = getTypeStyle(project.type);
                return (
                  <TableRow key={project._id}
                    sx={{
                      '&:hover': { background: 'rgba(13,59,110,0.02)' },
                      opacity: project.isActive ? 1 : 0.5
                    }}>
                    <TableCell>
                      <Typography fontWeight={600} fontSize="0.85rem">{projectLabel(project)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={typeStyle.label} size="small"
                        sx={{
                          background: `${typeStyle.color}15`,
                          color: typeStyle.color, fontWeight: 600, fontSize: '0.72rem'
                        }} />
                    </TableCell>
                    {gee && (
                      <TableCell>
                        <Typography fontSize="0.85rem">{project.bureau?.name}</Typography>
                      </TableCell>
                    )}
                    {gee && (
                      <TableCell>
                        {project.participantBureaus?.length > 0
                          ? project.participantBureaus.map(b => (
                            <Chip key={b._id} label={b.name} size="small" sx={{ mr: 0.5, fontSize: '0.7rem' }} />
                          ))
                          : <Typography fontSize="0.75rem" color="text.disabled">—</Typography>
                        }
                      </TableCell>
                    )}
                    <TableCell>
                      <Typography fontSize="0.8rem" color="text.secondary">{project.siteLocation}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography fontSize="0.8rem" color="text.secondary">{project.entrepriseRealisation}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      {project.hasWeeklyReport
                        ? <Chip label="Oui" size="small" color="primary" variant="outlined" />
                        : <Typography fontSize="0.8rem" color="text.disabled">Non</Typography>
                      }
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={project.isActive ? 'Actif' : 'Inactif'}
                        size="small"
                        color={project.isActive ? 'success' : 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                    {canManage && (
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                          <Tooltip title="Modifier">
                            <IconButton size="small" color="primary" onClick={() => openEdit(project)}>
                              <Edit fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {canDelete && (
                            <Tooltip title="Supprimer">
                              <IconButton size="small" color="error" onClick={() => handleDelete(project)}>
                                <Delete fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title={project.isActive ? 'Désactiver' : 'Activer'}>
                            <Switch
                              size="small"
                              checked={project.isActive}
                              onChange={() => handleToggleActive(project)}
                            />
                          </Tooltip>
                        </Box>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        {!loading && (
          <Box sx={{ px: 2, py: 1, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography fontSize="0.75rem" color="text.secondary">
              {projects.length} projet{projects.length !== 1 ? 's' : ''}
            </Typography>
          </Box>
        )}
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        open={modal}
        onClose={() => { setModal(false); setError(''); }}
        title={editing ? 'Modifier le projet' : 'Nouveau projet'}
        maxWidth={640}
      >
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Bureau"
              value={user?.bureau?.name || ''}
              disabled
              InputProps={{ readOnly: true }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth required label="Nom du projet"
              name="name" value={form.name} onChange={handleChange} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth required>
              <InputLabel>Type de projet</InputLabel>
              <Select name="type" value={form.type} label="Type de projet" onChange={handleChange}>
                {PROJECT_TYPES.map(t => (
                  <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth required label="Site du projet"
              name="siteLocation" value={form.siteLocation} onChange={handleChange} />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth required label="Entreprise de réalisation"
              name="entrepriseRealisation" value={form.entrepriseRealisation} onChange={handleChange} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth required label="Date ODS" type="date"
              name="dateODS" value={form.dateODS} onChange={handleChange}
              InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth required label="Délais contractuel (mois)"
              type="number" name="delaisContractuel"
              value={form.delaisContractuel} onChange={handleChange}
              inputProps={{ min: 1 }} />
          </Grid>
          {form.type === 'Industriel' && (<>
            <Grid item xs={12} sm={8}>
              <TextField fullWidth label="Montant du marché (DA/TTC)"
                type="number" name="montantMarche"
                value={form.montantMarche} onChange={handleChange} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="AMO" name="AMO"
                value={form.AMO} onChange={handleChange} />
            </Grid>
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }}>
                <Chip label="Cellules de stockage" size="small" />
              </Divider>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Pieux — nombre prévu"
                type="number" name="cellules_pieux_prevus"
                value={form.specs.cellules_pieux_prevus} onChange={handleSpecChange} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Pieux — profondeur max (m)"
                type="number" name="cellules_profondeur"
                value={form.specs.cellules_profondeur} onChange={handleSpecChange} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Batteries — hauteur prévue (ML)"
                type="number" name="batteries_hauteur_prevue"
                value={form.specs.batteries_hauteur_prevue} onChange={handleSpecChange} />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 1 }}>
                <Chip label="Tour de travail" size="small" />
              </Divider>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Pieux — nombre prévu"
                type="number" name="tour_travail_pieux_prevus"
                value={form.specs.tour_travail_pieux_prevus} onChange={handleSpecChange} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Pieux — profondeur max (m)"
                type="number" name="tour_travail_profondeur"
                value={form.specs.tour_travail_profondeur} onChange={handleSpecChange} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Hauteur prévue (ML)"
                type="number" name="tour_travail_hauteur_prevue"
                value={form.specs.tour_travail_hauteur_prevue} onChange={handleSpecChange} />
            </Grid>
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }}>
                <Chip label="Tour d'expédition" size="small" />
              </Divider>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Pieux — nombre prévu"
                type="number" name="tour_expedition_pieux_prevus"
                value={form.specs.tour_expedition_pieux_prevus} onChange={handleSpecChange} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Pieux — profondeur max (m)"
                type="number" name="tour_expedition_profondeur"
                value={form.specs.tour_expedition_profondeur} onChange={handleSpecChange} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Hauteur prévue (ML)"
                type="number" name="tour_expedition_hauteur_prevue"
                value={form.specs.tour_expedition_hauteur_prevue} onChange={handleSpecChange} />
            </Grid>
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }}>
                <Chip label="Paiement" size="small" />
              </Divider>
            </Grid>
            <Grid item xs={12} sm={8}>
              <TextField fullWidth label="Avance forfaitaire (DA)"
                type="number" name="avance_forfaitaire"
                value={form.specs.avance_forfaitaire} onChange={handleSpecChange} />
            </Grid>
          </>)}
          {!gee && cells.length > 0 && (
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Cellule (optionnel)</InputLabel>
                <Select name="cellId" value={form.cellId} label="Cellule (optionnel)" onChange={handleChange}>
                  <MenuItem value="">— Aucune cellule —</MenuItem>
                  {cells.map(c => (
                    <MenuItem key={c._id} value={c._id}>{c.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch checked={form.hasWeeklyReport} name="hasWeeklyReport"
                  onChange={handleChange} color="primary" />
              }
              label={
                <Box>
                  <Typography fontSize="0.875rem" fontWeight={600}>Rapport hebdomadaire</Typography>
                  <Typography fontSize="0.75rem" color="text.secondary">
                    Activé automatiquement pour les projets Industriels
                  </Typography>
                </Box>
              }
            />
          </Grid>
          {form.type === 'Industriel' && (
            <>
              <Divider sx={{ my: 1 }} />
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Bureaux participants (optionnel)</InputLabel>
                  <Select
                    multiple
                    name="participantBureaus"
                    value={form.participantBureaus}
                    label="Bureaux participants (optionnel)"
                    onChange={e => setForm(p => ({ ...p, participantBureaus: e.target.value }))}
                    renderValue={selected =>
                      selected.map(id => bureaus.find(b => b._id === id)?.name || id).join(', ')
                    }
                  >
                    {bureaus.map(b => (
                      <MenuItem key={b._id} value={b._id}>
                        {b._id === user?.bureau?._id ? `${b.name} (vous — chef de file)` : b.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Typography fontSize="0.72rem" color="text.secondary" sx={{ mt: 0.5, ml: 0.5 }}>
                  Votre bureau est automatiquement le bureau chef de file
                </Typography>
              </Grid>
            </>
          )}

          {!gee && (
            <>
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }}>
                  <Chip label="Utilisateurs assignés" size="small" />
                </Divider>
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Utilisateurs assignés au projet</InputLabel>
                  <Select
                    multiple
                    name="assignedUsers"
                    value={form.assignedUsers}
                    label="Utilisateurs assignés au projet"
                    onChange={e => setForm(p => ({ ...p, assignedUsers: e.target.value }))}
                    renderValue={selected =>
                      selected.map(id => {
                        const u = filialeUsers.find(u => u._id === id);
                        return u ? `${u.firstName} ${u.lastName}` : id;
                      }).join(', ')
                    }
                  >
                    {filialeUsers.map(u => (
                      <MenuItem key={u._id} value={u._id}>
                        {u.firstName} {u.lastName} — {u.email}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Typography fontSize="0.72rem" color="text.secondary" sx={{ mt: 0.5, ml: 0.5 }}>
                  Seuls les utilisateurs assignés pourront créer des rapports pour ce projet
                </Typography>
              </Grid>
            </>
          )}
        </Grid>

        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button variant="outlined" onClick={() => setModal(false)} disabled={saving}>
            Annuler
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={18} color="inherit" /> : (editing ? 'Mettre à jour' : 'Créer')}
          </Button>
        </Box>
      </Modal>
    </Layout>
  );
}