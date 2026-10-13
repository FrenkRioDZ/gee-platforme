import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Card, Typography, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow,
  TextField, Select, MenuItem, FormControl, InputLabel,
  CircularProgress, Alert, IconButton, Tooltip, Chip,
  Grid, Avatar, Divider, Switch
} from '@mui/material';
import { Add, Edit, Refresh, LockReset, FilterList, Delete } from '@mui/icons-material';
import Layout from '../components/layout/Layout';
import Modal from '../components/ui/Modal';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS, isGEE } from '../utils/roles';

const BUREAU_ROLES = ['bureau_super_admin', 'bureau_rh_admin', 'bureau_finance_admin', 'bureau_technical_admin', 'bureau_user'];
const GEE_ROLES = ['gee_super_admin', 'gee_rh_admin', 'gee_finance_admin', 'gee_technical_admin'];
const FIELDS = ['RH', 'Finance', 'Technical'];
const EMPTY_FORM = { firstName: '', lastName: '', email: '', password: '', role: 'bureau_user', field: '', bureauId: '', cellId: '' };

export default function Users() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const gee = isGEE(user?.role);

  const [users, setUsers] = useState([]);
  const [bureaus, setBureaus] = useState([]);
  const [cells, setCells] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [modal, setModal] = useState(false);
  const [resetModal, setResetModal] = useState(null);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [newPass, setNewPass] = useState('');
  const [filters, setFilters] = useState({ role: '', bureau: '' });

  const roleOptions = gee ? [...GEE_ROLES, ...BUREAU_ROLES] : BUREAU_ROLES;
  const needsField = ['gee_rh_admin', 'gee_finance_admin', 'gee_technical_admin', 'bureau_rh_admin', 'bureau_finance_admin', 'bureau_technical_admin'].includes(form.role);
  const needsBureau = form.role.startsWith('bureau_');

  useEffect(() => { fetchUsers(); }, [filters]);
  useEffect(() => { if (gee) fetchBureaus(); }, []);
  useEffect(() => { if (form.bureauId) fetchCells(form.bureauId); else setCells([]); }, [form.bureauId]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (filters.role) p.set('role', filters.role);
      if (filters.bureau) p.set('bureau', filters.bureau);
      const { data } = await api.get(`/users?${p}`);
      setUsers(data);
    } catch { setError(t('common.error')); }
    finally { setLoading(false); }
  };

  const fetchBureaus = async () => {
    try { const { data } = await api.get('/bureaus'); setBureaus(data); } catch { }
  };

  const fetchCells = async (bureauId) => {
    try { const { data } = await api.get(`/bureaus/${bureauId}`); setCells(data.cells || []); } catch { }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, bureauId: gee ? '' : user.bureau?._id || '' });
    setError(''); setModal(true);
  };

  const openEdit = u => {
    setEditing(u);
    setForm({
      firstName: u.firstName, lastName: u.lastName, email: u.email, password: '',
      role: u.role, field: u.field || '', bureauId: u.bureau?._id || '', cellId: u.cell || ''
    });
    setError(''); setModal(true);
  };

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev, [name]: value,
      ...(name === 'bureauId' ? { cellId: '' } : {}),
      ...(name === 'role' && !value.startsWith('bureau_') ? { bureauId: '', cellId: '' } : {})
    }));
  };

  const handleSave = async () => {
    if (!form.firstName || !form.lastName || !form.email || !form.role) {
      setError('Veuillez remplir tous les champs obligatoires'); return;
    }
    if (!editing && !form.password) { setError('Le mot de passe est obligatoire'); return; }
    setSaving(true); setError('');
    try {
      const payload = { ...form };
      if (!payload.field) delete payload.field;
      if (!payload.bureauId) delete payload.bureauId;
      if (!payload.cellId) delete payload.cellId;
      if (!payload.password) delete payload.password;
      editing ? await api.put(`/users/${editing._id}`, payload) : await api.post('/auth/register', payload);
      setSuccess(editing ? 'Utilisateur mis à jour' : 'Utilisateur créé');
      setModal(false); fetchUsers();
    } catch (err) { setError(err.response?.data?.message || t('common.error')); }
    finally { setSaving(false); }
  };

  const handleToggle = async (u) => {
    setUsers(prev => prev.map(usr =>
      usr._id === u._id ? { ...usr, isActive: !usr.isActive } : usr
    ));
    try {
      await api.patch(`/users/${u._id}/toggle-status`);
    } catch {
      setUsers(prev => prev.map(usr =>
        usr._id === u._id ? { ...usr, isActive: u.isActive } : usr
      ));
      setError(t('common.error'));
    }
  };

  const handleReset = async () => {
    if (!newPass || newPass.length < 8) { setError('Minimum 8 caractères'); return; }
    setSaving(true);
    try {
      await api.patch(`/users/${resetModal._id}/reset-password`, { newPassword: newPass });
      setSuccess('Mot de passe réinitialisé'); setResetModal(null); setNewPass('');
    } catch (err) { setError(err.response?.data?.message || t('common.error')); }
    finally { setSaving(false); }
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`Supprimer "${u.firstName} ${u.lastName}" ? Cette action est irréversible.`)) return;
    try {
      await api.delete(`/users/${u._id}`);
      setSuccess('Utilisateur supprimé');
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || t('common.error'));
    }
  };

  const initials = u => `${u.firstName?.[0] || ''}${u.lastName?.[0] || ''}`.toUpperCase();

  return (
    <Layout pageTitle={t('users.title')}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" sx={{ fontFamily: '"Playfair Display", serif', color: 'primary.main' }}>
          {t('users.title')}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Rafraîchir"><IconButton onClick={fetchUsers} size="small" color="primary"><Refresh /></IconButton></Tooltip>
          <Button variant="contained" size="small" startIcon={<Add />} onClick={openCreate}>{t('users.new')}</Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {/* Filters */}
      <Card sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Rôle</InputLabel>
            <Select value={filters.role} label="Rôle" onChange={e => setFilters(p => ({ ...p, role: e.target.value }))}>
              <MenuItem value="">Tous les rôles</MenuItem>
              {roleOptions.map(r => <MenuItem key={r} value={r}>{ROLE_LABELS[r]}</MenuItem>)}
            </Select>
          </FormControl>
          {gee && (
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Filiale</InputLabel>
              <Select value={filters.bureau} label="Bureau" onChange={e => setFilters(p => ({ ...p, bureau: e.target.value }))}>
                <MenuItem value="">Tous</MenuItem>
                {bureaus.map(b => <MenuItem key={b._id} value={b._id}>{b.name}</MenuItem>)}
              </Select>
            </FormControl>
          )}
          <Button size="small" variant="outlined" onClick={() => setFilters({ role: '', bureau: '' })}>Réinitialiser</Button>
        </Box>
      </Card>

      {/* Table */}
      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Utilisateur</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Rôle</TableCell>
                {gee && <TableCell>Filiale</TableCell>}
                <TableCell align="center">Actif</TableCell>
                <TableCell align="center">Dernière connexion</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6 }}><CircularProgress size={32} /></TableCell></TableRow>
              ) : users.length === 0 ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary' }}>Aucun utilisateur</TableCell></TableRow>
              ) : users.map(u => (
                <TableRow key={u._id} sx={{ '&:hover': { background: 'rgba(13,59,110,0.02)' }, opacity: u.isActive ? 1 : 0.5 }}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar sx={{ width: 32, height: 32, fontSize: '0.75rem', fontWeight: 700, background: 'linear-gradient(135deg, #0D3B6E, #1565C0)' }}>
                        {initials(u)}
                      </Avatar>
                      <Box>
                        <Typography fontWeight={600} fontSize="0.85rem">{u.firstName} {u.lastName}</Typography>
                        {u.field && <Typography fontSize="0.7rem" color="text.secondary">{u.field}</Typography>}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell><Typography fontSize="0.8rem" color="text.secondary">{u.email}</Typography></TableCell>
                  <TableCell>
                    <Chip label={ROLE_LABELS[u.role]} size="small" sx={{
                      fontSize: '0.7rem', fontWeight: 600,
                      background: u.role.startsWith('gee_') ? 'rgba(13,59,110,0.1)' : 'rgba(200,150,62,0.1)',
                      color: u.role.startsWith('gee_') ? '#0D3B6E' : '#8B6914'
                    }} />
                  </TableCell>
                  {gee && <TableCell><Typography fontSize="0.8rem">{u.bureau?.name || '—'}</Typography></TableCell>}
                  <TableCell align="center"><Switch size="small" checked={u.isActive} onChange={() => handleToggle(u)} /></TableCell>
                  <TableCell align="center">
                    <Typography fontSize="0.75rem" color="text.secondary">
                      {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('fr-DZ') : 'Jamais'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                      <Tooltip title="Modifier"><IconButton size="small" color="primary" onClick={() => openEdit(u)}><Edit fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Réinitialiser mot de passe"><IconButton size="small" color="warning" onClick={() => { setResetModal(u); setNewPass(''); setError(''); }}><LockReset fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Supprimer">
                        <IconButton size="small" color="error" onClick={() => handleDelete(u)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {!loading && (
          <Box sx={{ px: 2, py: 1, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography fontSize="0.75rem" color="text.secondary">{users.length} utilisateur{users.length !== 1 ? 's' : ''}</Typography>
          </Box>
        )}
      </Card>

      {/* Create/Edit Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Modifier l'utilisateur" : 'Nouvel utilisateur'} maxWidth={620}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}><TextField fullWidth required label="Prénom" name="firstName" value={form.firstName} onChange={handleChange} /></Grid>
          <Grid item xs={12} sm={6}><TextField fullWidth required label="Nom" name="lastName" value={form.lastName} onChange={handleChange} /></Grid>
          <Grid item xs={12}><TextField fullWidth required label="Email professionnel" name="email" type="email" value={form.email} onChange={handleChange} disabled={!!editing} /></Grid>
          {!editing && <Grid item xs={12}><TextField fullWidth required label="Mot de passe" name="password" type="password" value={form.password} onChange={handleChange} /></Grid>}
          <Grid item xs={12} sm={needsField ? 6 : 12}>
            <FormControl fullWidth required>
              <InputLabel>Rôle</InputLabel>
              <Select name="role" value={form.role} label="Rôle" onChange={handleChange}>
                {roleOptions.map(r => <MenuItem key={r} value={r}>{ROLE_LABELS[r]}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          {needsField && (
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Domaine</InputLabel>
                <Select name="field" value={form.field} label="Domaine" onChange={handleChange}>
                  {FIELDS.map(f => <MenuItem key={f} value={f}>{f}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
          )}
          {needsBureau && gee && (
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Filiale</InputLabel>
                <Select name="bureauId" value={form.bureauId} label="Bureau" onChange={handleChange}>
                  <MenuItem value="">— Sélectionner —</MenuItem>
                  {bureaus.map(b => <MenuItem key={b._id} value={b._id}>{b.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
          )}
          {needsBureau && cells.length > 0 && (
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Cellule</InputLabel>
                <Select name="cellId" value={form.cellId} label="Cellule" onChange={handleChange}>
                  <MenuItem value="">— Aucune —</MenuItem>
                  {cells.map(c => <MenuItem key={c._id} value={c._id}>{c.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
          )}
        </Grid>
        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button variant="outlined" onClick={() => setModal(false)} disabled={saving}>Annuler</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={18} color="inherit" /> : (editing ? 'Mettre à jour' : 'Créer')}
          </Button>
        </Box>
      </Modal>

      {/* Reset Password Modal */}
      <Modal open={!!resetModal} onClose={() => setResetModal(null)} title="Réinitialiser le mot de passe" maxWidth={420}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Typography fontSize="0.875rem" color="text.secondary" mb={2}>
          Nouveau mot de passe pour <strong>{resetModal?.firstName} {resetModal?.lastName}</strong>
        </Typography>
        <TextField fullWidth label="Nouveau mot de passe" type="password"
          value={newPass} onChange={e => setNewPass(e.target.value)} sx={{ mb: 2 }} />
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button variant="outlined" onClick={() => setResetModal(null)} disabled={saving}>Annuler</Button>
          <Button variant="contained" color="warning" onClick={handleReset} disabled={saving}>
            {saving ? <CircularProgress size={18} color="inherit" /> : 'Réinitialiser'}
          </Button>
        </Box>
      </Modal>
    </Layout>
  );
}
