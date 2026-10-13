import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box, Card, Typography, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow,
  TextField, Select, MenuItem, FormControl, InputLabel,
  CircularProgress, Alert, IconButton, Tooltip, Chip, Pagination
} from '@mui/material';
import { Add, Visibility, Refresh, FilterList, Download, FileDownload, LockOpen } from '@mui/icons-material';
import Layout from '../components/layout/Layout';
import StatusBadge from '../components/ui/StatusBadge';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { isGEE, canSubmitReport } from '../utils/roles';
import Modal from '../components/ui/Modal';

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'draft', label: 'Brouillon' },
  { value: 'submitted', label: 'Soumis' },
  { value: 'bureau_approved', label: 'Transmis GEE' },
  { value: 'bureau_rejected', label: 'Renvoyé par le bureau' },
  { value: 'accepted', label: 'Accepté' },
  { value: 'rejected', label: 'Rejeté' },
];

export default function WeeklyReports() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ status: '', weekLabel: '', isLate: '' });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  const [overrideModal, setOverrideModal] = useState(false);
  const [overrideReports, setOverrideReports] = useState([]);
  const [overrideFilters, setOverrideFilters] = useState({ bureau: '', weekLabel: '' });
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideSuccess, setOverrideSuccess] = useState('');

  const gee = isGEE(user?.role);
  const [bureaus, setBureaus] = useState([]);

  useEffect(() => {
    const handler = () => fetchReports();
    console.log('[table] gee:report-updated caught, refetching');
    window.addEventListener('gee:report-updated', handler);
    return () => window.removeEventListener('gee:report-updated', handler);
  }, [filters, page]);
  
  useEffect(() => {
    if (user?.role === 'gee_super_admin') {
      api.get('/bureaus').then(({ data }) => setBureaus(data)).catch(() => { });
    }
  }, []);

  useEffect(() => { setPage(1); }, [filters]);
  useEffect(() => { fetchReports(); }, [filters, page]);

  const fetchReports = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.weekLabel) params.set('weekLabel', filters.weekLabel);
      if (filters.isLate) params.set('isLate', filters.isLate);
      params.set('page', page);
      params.set('limit', 10);

      const { data } = await api.get(`/reports/weekly?${params}`);
      setReports(data.reports);
      setPagination(data.pagination);
    } catch (err) {
      console.error('fetchReports error:', err.response?.data || err.message);
      setError(err.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const fetchLateReports = async () => {
    setOverrideLoading(true);
    try {
      const params = new URLSearchParams({ isLate: 'true', status: 'draft' });
      if (overrideFilters.bureau) params.set('bureau', overrideFilters.bureau);
      if (overrideFilters.weekLabel) params.set('weekLabel', overrideFilters.weekLabel);
      const { data } = await api.get(`/reports/weekly?${params}`);
      setOverrideReports(data.reports);
    } catch { }
    finally { setOverrideLoading(false); }
  };

  const handleFilterChange = e => {
    setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleGrantOverride = async (reportId) => {
    try {
      await api.put(`/reports/weekly/${reportId}/grant-override`);
      setOverrideSuccess('Extension accordée — valable 24h');
      fetchLateReports();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur');
    }
  };

  return (
    <Layout pageTitle={t('reports.title')}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" sx={{ fontFamily: '"Playfair Display", serif', color: 'primary.main' }}>
          {t('reports.title')}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Rafraîchir">
            <IconButton onClick={fetchReports} size="small" color="primary">
              <Refresh />
            </IconButton>
          </Tooltip>
          {gee && (
            <Tooltip title="Exporter rapport consolidé">
              <Button
                variant="outlined" size="small"
                startIcon={<FileDownload />}
                onClick={async () => {
                  try {
                    const response = await api.get('/reports/weekly/export/consolidated', { responseType: 'blob' });
                    const url = window.URL.createObjectURL(new Blob([response.data]));
                    const link = document.createElement('a');
                    link.href = url;
                    link.setAttribute('download', `Rapport_Consolidé_${new Date().toISOString().slice(0, 10)}.xlsx`);
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    window.URL.revokeObjectURL(url);
                  } catch { }
                }}
              >
                Consolidé
              </Button>
            </Tooltip>
          )}
          {user?.role === 'gee_super_admin' && (
            <Tooltip title="Accorder une extension de délai">
              <Button
                variant="outlined" size="small" color="warning"
                startIcon={<LockOpen />}
                onClick={() => { setOverrideModal(true); fetchLateReports(); }}
              >
                Extensions
              </Button>
            </Tooltip>
          )}
          {canSubmitReport(user?.role) && (
            <Button variant="contained" size="small" startIcon={<Add />}
              onClick={() => navigate('/reports/weekly/new')}>
              {t('reports.new')}
            </Button>
          )}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Filters */}
      <Card sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <FilterList fontSize="small" color="primary" />
          <Typography fontWeight={600} fontSize="0.875rem" color="primary.main">Filtres</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Statut</InputLabel>
            <Select name="status" value={filters.status}
              onChange={handleFilterChange} label="Statut">
              {STATUS_OPTIONS.map(o => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            size="small" label="Semaine (ex: 2026-W09)"
            name="weekLabel" value={filters.weekLabel}
            onChange={handleFilterChange}
            sx={{ minWidth: 200 }}
          />

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Retard</InputLabel>
            <Select name="isLate" value={filters.isLate}
              onChange={handleFilterChange} label="Retard">
              <MenuItem value="">Tous</MenuItem>
              <MenuItem value="true">En retard</MenuItem>
              <MenuItem value="false">Dans les délais</MenuItem>
            </Select>
          </FormControl>

          <Button size="small" variant="outlined"
            onClick={() => setFilters({ status: '', weekLabel: '', isLate: '' })}>
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
                <TableCell>Projet</TableCell>
                {gee && <TableCell>Filiale</TableCell>}
                <TableCell>Semaine</TableCell>
                <TableCell>Site</TableCell>
                <TableCell align="center">Taux avancement</TableCell>
                <TableCell align="center">Statut</TableCell>
                <TableCell align="center">Retard</TableCell>
                <TableCell align="center">Soumis le</TableCell>
                <TableCell align="center">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={32} />
                  </TableCell>
                </TableRow>
              ) : reports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    {t('common.no_data')}
                  </TableCell>
                </TableRow>
              ) : (
                reports.map(report => (
                  <TableRow
                    key={report._id}
                    sx={{
                      '&:hover': { background: 'rgba(13,59,110,0.02)' },
                      background: report.isLate ? 'rgba(198,40,40,0.02)' : 'inherit'
                    }}
                  >
                    <TableCell>
                      <Typography fontWeight={600} fontSize="0.85rem">
                        {report.project?.name}
                      </Typography>
                      <Typography fontSize="0.72rem" color="text.secondary">
                        {report.project?.type?.replace('_', ' ')}
                      </Typography>
                    </TableCell>
                    {gee && (
                      <TableCell>
                        <Typography fontSize="0.85rem">{report.bureau?.name}</Typography>
                        {report.project?.participantBureaus?.length > 0 && (
                          <Typography fontSize="0.7rem" color="text.secondary">
                            + {report.project.participantBureaus.length} participant(s)
                          </Typography>
                        )}
                      </TableCell>
                    )}
                    <TableCell>
                      <Typography fontSize="0.85rem" fontWeight={500}>{report.weekLabel}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography fontSize="0.8rem" color="text.secondary">
                        {report.project?.siteLocation}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography fontSize="0.85rem">
                        {report.tauxAvancementGlobal != null
                          ? `${report.tauxAvancementGlobal}%`
                          : '—'
                        }
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <StatusBadge status={report.status} />
                    </TableCell>
                    <TableCell align="center">
                      {report.isLate
                        ? <Chip label="Retard" size="small" sx={{ background: '#FCE4EC', color: '#880E4F', fontWeight: 700, fontSize: '0.7rem' }} />
                        : <Typography fontSize="0.8rem" color="text.disabled">—</Typography>
                      }
                    </TableCell>
                    <TableCell align="center">
                      <Typography fontSize="0.8rem" color="text.secondary">
                        {report.submittedAt
                          ? new Date(report.submittedAt).toLocaleDateString('fr-DZ')
                          : '—'
                        }
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                        <Tooltip title="Voir le rapport">
                          <IconButton size="small" color="primary"
                            onClick={() => navigate(`/reports/weekly/${report._id}`)}>
                            <Visibility fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {gee && report.status === 'accepted' && (
                          <Tooltip title="Exporter Excel">
                            <IconButton size="small" color="success"
                              onClick={async () => {
                                try {
                                  const response = await api.get(
                                    `/reports/weekly/${report._id}/export`,
                                    { responseType: 'blob' }
                                  );
                                  const url = window.URL.createObjectURL(new Blob([response.data]));
                                  const link = document.createElement('a');
                                  link.href = url;
                                  link.setAttribute('download', `Rapport_${report.project?.name}_${report.weekLabel}.xlsx`);
                                  document.body.appendChild(link);
                                  link.click();
                                  link.remove();
                                  window.URL.revokeObjectURL(url);
                                } catch { }
                              }}>
                              <Download fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Count */}
        {!loading && pagination && (
          <Box sx={{
            px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <Typography fontSize="0.75rem" color="text.secondary">
              {pagination.total} rapport{pagination.total !== 1 ? 's' : ''}
            </Typography>
            <Pagination
              count={pagination.pages}
              page={page}
              onChange={(_, v) => setPage(v)}
              size="small"
              color="primary"
            />
          </Box>
        )}
      </Card>

      <Modal
        open={overrideModal}
        onClose={() => { setOverrideModal(false); setOverrideSuccess(''); }}
        title="Extensions de délai"
        maxWidth={700}
      >
        {overrideSuccess && <Alert severity="success" sx={{ mb: 2 }}>{overrideSuccess}</Alert>}

        {/* Filters */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Filiale</InputLabel>
            <Select
              value={overrideFilters.bureau}
              label="Bureau"
              onChange={e => setOverrideFilters(p => ({ ...p, bureau: e.target.value }))}
            >
              <MenuItem value="">Tous</MenuItem>
              {bureaus.map(b => (
                <MenuItem key={b._id} value={b._id}>{b.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small" label="Semaine (ex: Semaine 5)"
            value={overrideFilters.weekLabel}
            onChange={e => setOverrideFilters(p => ({ ...p, weekLabel: e.target.value }))}
          />
          <Button size="small" variant="outlined" onClick={fetchLateReports}>
            Filtrer
          </Button>
        </Box>

        {/* Late reports table */}
        {overrideLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : overrideReports.length === 0 ? (
          <Alert severity="info">Aucun rapport en retard trouvé</Alert>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Projet</TableCell>
                <TableCell>Filiale</TableCell>
                <TableCell>Semaine</TableCell>
                <TableCell>Statut</TableCell>
                <TableCell align="center">Extension</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {overrideReports.map(r => {
                const hasActiveOverride = r.deadlineOverride?.expiresAt &&
                  new Date() < new Date(r.deadlineOverride.expiresAt);
                return (
                  <TableRow key={r._id}>
                    <TableCell>{r.project?.name}</TableCell>
                    <TableCell>{r.bureau?.name}</TableCell>
                    <TableCell>{r.weekLabel}</TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell align="center">
                      {hasActiveOverride ? (
                        <Chip
                          label={`Expire ${new Date(r.deadlineOverride.expiresAt).toLocaleTimeString('fr-DZ')}`}
                          size="small" color="warning"
                        />
                      ) : (
                        <Button
                          size="small" variant="contained" color="warning"
                          onClick={() => handleGrantOverride(r._id)}
                        >
                          Accorder 24h
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Modal>

    </Layout>
  );
}