import { useState, useEffect } from 'react';
import {
  Box, Card, Typography, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow,
  TextField, CircularProgress, Alert, IconButton,
  Tooltip, Chip, Grid, Divider, Accordion,
  AccordionSummary, AccordionDetails
} from '@mui/material';
import { Add, Edit, Refresh, ExpandMore, Business } from '@mui/icons-material';
import Layout from '../components/layout/Layout';
import Modal from '../components/ui/Modal';
import api from '../utils/api';

const EMPTY_CELL = { name: '', location: '' };

export default function Bureaus() {
  const [bureaus,  setBureaus]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');
  const [modal,    setModal]    = useState(false);
  const [cellModal,setCellModal]= useState(null); // { bureauId, cell? }
  const [saving,   setSaving]   = useState(false);
  const [form,     setForm]     = useState({ name:'', emailDomain:'' });
  const [cellForm, setCellForm] = useState(EMPTY_CELL);

  useEffect(() => { fetchBureaus(); }, []);

  const fetchBureaus = async () => {
    setLoading(true);
    try { const { data } = await api.get('/bureaus'); setBureaus(data); }
    catch { setError('Erreur lors du chargement'); }
    finally { setLoading(false); }
  };

  const handleSaveBureau = async () => {
    if (!form.name || !form.emailDomain) { setError('Nom et domaine email obligatoires'); return; }
    setSaving(true); setError('');
    try {
      await api.post('/bureaus', form);
      setSuccess('Bureau créé'); setModal(false); fetchBureaus();
    } catch (err) { setError(err.response?.data?.message || 'Erreur'); }
    finally { setSaving(false); }
  };

  const handleSaveCell = async () => {
    if (!cellForm.name) { setError('Le nom de la cellule est obligatoire'); return; }
    setSaving(true); setError('');
    try {
      const { bureauId, cell } = cellModal;
      if (cell) {
        await api.put(`/bureaus/${bureauId}/cells/${cell._id}`, cellForm);
      } else {
        await api.post(`/bureaus/${bureauId}/cells`, cellForm);
      }
      setSuccess(cell ? 'Cellule mise à jour' : 'Cellule ajoutée');
      setCellModal(null); fetchBureaus();
    } catch (err) { setError(err.response?.data?.message || 'Erreur'); }
    finally { setSaving(false); }
  };

  return (
    <Layout pageTitle="Bureaux">
      <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb:3 }}>
        <Typography variant="h4" sx={{ fontFamily:'"Playfair Display", serif', color:'primary.main' }}>
          Bureaux d'études
        </Typography>
        <Box sx={{ display:'flex', gap:1 }}>
          <Tooltip title="Rafraîchir"><IconButton onClick={fetchBureaus} size="small" color="primary"><Refresh /></IconButton></Tooltip>
          <Button variant="contained" size="small" startIcon={<Add />} onClick={() => { setForm({ name:'', emailDomain:'' }); setError(''); setModal(true); }}>
            Nouveau bureau
          </Button>
        </Box>
      </Box>

      {error   && <Alert severity="error"   sx={{ mb:2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb:2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {loading ? (
        <Box sx={{ display:'flex', justifyContent:'center', py:8 }}><CircularProgress /></Box>
      ) : (
        <Box sx={{ display:'flex', flexDirection:'column', gap:2 }}>
          {bureaus.map(bureau => (
            <Card key={bureau._id} sx={{ overflow:'visible' }}>
              {/* Bureau header */}
              <Box sx={{ px:3, py:2, display:'flex', alignItems:'center', justifyContent:'space-between',
                borderBottom:'1px solid', borderColor:'divider' }}>
                <Box sx={{ display:'flex', alignItems:'center', gap:2 }}>
                  <Box sx={{ width:40, height:40, borderRadius:2,
                    background:'linear-gradient(135deg, #0D3B6E, #1565C0)',
                    display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <Business sx={{ color:'#fff', fontSize:20 }} />
                  </Box>
                  <Box>
                    <Typography fontWeight={700} color="primary.main">{bureau.name}</Typography>
                    <Typography fontSize="0.75rem" color="text.secondary">@{bureau.emailDomain}</Typography>
                  </Box>
                </Box>
                <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
                  <Chip label={`${bureau.cells?.length || 0} cellule${bureau.cells?.length !== 1 ? 's' : ''}`}
                    size="small" variant="outlined" color="primary" />
                  <Chip label={bureau.isActive ? 'Actif' : 'Inactif'} size="small"
                    color={bureau.isActive ? 'success' : 'default'} variant="outlined" />
                  <Button size="small" startIcon={<Add />} variant="outlined"
                    onClick={() => { setCellForm(EMPTY_CELL); setError(''); setCellModal({ bureauId:bureau._id }); }}>
                    Cellule
                  </Button>
                </Box>
              </Box>

              {/* Cells table */}
              {bureau.cells?.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Nom de la cellule</TableCell>
                        <TableCell>Localisation</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {bureau.cells.map(cell => (
                        <TableRow key={cell._id} sx={{ '&:hover':{ background:'rgba(13,59,110,0.02)' } }}>
                          <TableCell>
                            <Typography fontWeight={500} fontSize="0.85rem">{cell.name}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography fontSize="0.8rem" color="text.secondary">{cell.location || '—'}</Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Tooltip title="Modifier">
                              <IconButton size="small" color="primary"
                                onClick={() => { setCellForm({ name:cell.name, location:cell.location||'' }); setError(''); setCellModal({ bureauId:bureau._id, cell }); }}>
                                <Edit fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Box sx={{ py:3, textAlign:'center' }}>
                  <Typography fontSize="0.825rem" color="text.disabled">
                    Aucune cellule — cliquez sur "+ Cellule" pour en ajouter
                  </Typography>
                </Box>
              )}
            </Card>
          ))}
        </Box>
      )}

      {/* New Bureau Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Nouveau bureau" maxWidth={480}>
        {error && <Alert severity="error" sx={{ mb:2 }}>{error}</Alert>}
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField fullWidth required label="Nom du bureau" value={form.name}
              onChange={e => setForm(p => ({ ...p, name:e.target.value }))} />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth required label="Domaine email (ex: setam.dz)" value={form.emailDomain}
              onChange={e => setForm(p => ({ ...p, emailDomain:e.target.value }))}
              helperText="Les utilisateurs devront avoir une adresse @ce-domaine" />
          </Grid>
        </Grid>
        <Divider sx={{ my:2 }} />
        <Box sx={{ display:'flex', gap:2, justifyContent:'flex-end' }}>
          <Button variant="outlined" onClick={() => setModal(false)} disabled={saving}>Annuler</Button>
          <Button variant="contained" onClick={handleSaveBureau} disabled={saving}>
            {saving ? <CircularProgress size={18} color="inherit" /> : 'Créer'}
          </Button>
        </Box>
      </Modal>

      {/* Cell Modal */}
      <Modal open={!!cellModal} onClose={() => setCellModal(null)}
        title={cellModal?.cell ? 'Modifier la cellule' : 'Nouvelle cellule'} maxWidth={440}>
        {error && <Alert severity="error" sx={{ mb:2 }}>{error}</Alert>}
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField fullWidth required label="Nom de la cellule" value={cellForm.name}
              onChange={e => setCellForm(p => ({ ...p, name:e.target.value }))} />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth label="Localisation (optionnel)" value={cellForm.location}
              onChange={e => setCellForm(p => ({ ...p, location:e.target.value }))} />
          </Grid>
        </Grid>
        <Divider sx={{ my:2 }} />
        <Box sx={{ display:'flex', gap:2, justifyContent:'flex-end' }}>
          <Button variant="outlined" onClick={() => setCellModal(null)} disabled={saving}>Annuler</Button>
          <Button variant="contained" onClick={handleSaveCell} disabled={saving}>
            {saving ? <CircularProgress size={18} color="inherit" /> : (cellModal?.cell ? 'Mettre à jour' : 'Ajouter')}
          </Button>
        </Box>
      </Modal>
    </Layout>
  );
}
