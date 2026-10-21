import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box, Card, Typography, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow,
  TextField, Select, MenuItem, FormControl, InputLabel,
  CircularProgress, Alert, IconButton, Tooltip, Chip, Pagination
} from '@mui/material';
import {
  Add, Visibility, Refresh, FilterList, Download, FileDownload, LockOpen,
  CalendarMonth, ChevronLeft, ChevronRight, Close, Search
} from '@mui/icons-material';
import Layout from '../components/layout/Layout';
import StatusBadge from '../components/ui/StatusBadge';
import api from '../utils/api';
import { projectLabel } from '../utils/project';
import { useAuth } from '../context/AuthContext';
import { isGEE, canSubmitReport } from '../utils/roles';
import Modal from '../components/ui/Modal';
import WeekCalendarPicker from '../components/ui/WeekCalendarPicker';
import { getWeekDeadline, getWeekStart, prevWeekEnd, nextWeekEnd } from '../utils/week';

const EMPTY_FILTERS = { search: '', weekEnd: '', bureau: '', status: '', isLate: '' };
const fmtDay = (d) => new Date(d).toLocaleDateString('fr-DZ', { day: '2-digit', month: '2-digit' });
// Range of a calendar week, from its week end
const weekRange = (weekEnd) => `${fmtDay(getWeekStart(weekEnd))} → ${fmtDay(weekEnd)}`;

// Calendar week (ends on the deadline day) — the same for every project, unlike "Semaine N".
// weekEnd '' means "all weeks" (or whatever default the caller gives allLabel).
function WeekNavigator({ weekEnd, onChange, allLabel = 'Toutes les semaines' }) {
  const [anchor, setAnchor] = useState(null);
  const shift = (step) => onChange(step(weekEnd || getWeekDeadline()).toISOString());
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', border: '1px solid', borderColor: 'divider',
      borderRadius: 1, px: 0.5, height: 40
    }}>
      <Tooltip title="Semaine précédente">
        <IconButton size="small" onClick={() => shift(prevWeekEnd)}><ChevronLeft fontSize="small" /></IconButton>
      </Tooltip>
      <Button
        size="small" startIcon={<CalendarMonth />}
        onClick={e => setAnchor(e.currentTarget)}
        sx={{ textTransform: 'none', minWidth: 170 }}
      >
        {weekEnd ? `Semaine du ${weekRange(weekEnd)}` : allLabel}
      </Button>
      <Tooltip title="Semaine suivante">
        <span>
          <IconButton size="small" disabled={!weekEnd} onClick={() => shift(nextWeekEnd)}>
            <ChevronRight fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      {weekEnd && (
        <Tooltip title={allLabel}>
          <IconButton size="small" onClick={() => onChange('')}>
            <Close fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      <WeekCalendarPicker
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        selectedWeekEnd={weekEnd || null}
        onSelect={(d) => onChange(d.toISOString())}
      />
    </Box>
  );
}

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
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [overrideModal, setOverrideModal] = useState(false);
  const [overrideReports, setOverrideReports] = useState([]);
  const [overrideFilters, setOverrideFilters] = useState({ bureau: '', weekEnd: '' });
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideSuccess, setOverrideSuccess] = useState('');
  const [missingReports, setMissingReports] = useState([]);
  const [missingWeekEnd, setMissingWeekEnd] = useState(null);

  const gee = isGEE(user?.role);
  const [bureaus, setBureaus] = useState([]);

  useEffect(() => {
    const handler = () => fetchReports();
    console.log('[table] gee:report-updated caught, refetching');
    window.addEventListener('gee:report-updated', handler);
    return () => window.removeEventListener('gee:report-updated', handler);
  }, [filters, page, rowsPerPage]);
  
  useEffect(() => {
    if (isGEE(user?.role)) {
      api.get('/bureaus').then(({ data }) => setBureaus(data)).catch(() => { });
    }
  }, []);

  // Debounce project search so the table doesn't refetch on every keystroke
  useEffect(() => {
    const id = setTimeout(() => setFilters(prev => (
      prev.search === searchInput.trim() ? prev : { ...prev, search: searchInput.trim() }
    )), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  useEffect(() => { setPage(1); }, [filters, rowsPerPage]);
  useEffect(() => { fetchReports(); }, [filters, page, rowsPerPage]);

  const fetchReports = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
      params.set('page', page);
      params.set('limit', rowsPerPage);

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
      // Every late report the BET can no longer submit without an extension
      const params = new URLSearchParams({ isLate: 'true', status: 'draft,rejected,bureau_rejected' });
      if (overrideFilters.bureau) params.set('bureau', overrideFilters.bureau);
      if (overrideFilters.weekEnd) params.set('weekEnd', overrideFilters.weekEnd);
      const { data } = await api.get(`/reports/weekly?${params}`);
      setOverrideReports(data.reports);
    } catch { }
    finally { setOverrideLoading(false); }
  };

  // No week chosen → the server defaults to last week
  const fetchMissingReports = async () => {
    try {
      const params = new URLSearchParams();
      if (overrideFilters.weekEnd) params.set('weekEnd', overrideFilters.weekEnd);
      if (overrideFilters.bureau) params.set('bureau', overrideFilters.bureau);
      const { data } = await api.get(`/reports/weekly/missing?${params}`);
      setMissingReports(data.missing);
      setMissingWeekEnd(data.weekEnd);
    } catch { }
  };

  const handleGrantMissing = async (projectId) => {
    try {
      await api.post('/reports/weekly/grant-override-missing', { projectId, weekEnd: missingWeekEnd });
      setOverrideSuccess('Extension accordée — valable 24h. Le rapport est créé en brouillon pour la filiale.');
      fetchMissingReports();
      fetchLateReports();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur');
    }
  };

  // Refetch both extension lists whenever the window opens or its filters change
  useEffect(() => {
    if (!overrideModal) return;
    fetchLateReports();
    fetchMissingReports();
  }, [overrideModal, overrideFilters]);

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
            <Tooltip title={filters.weekEnd ? 'Exporter la semaine sélectionnée' : 'Exporter la semaine en cours'}>
              <Button
                variant="outlined" size="small"
                startIcon={<FileDownload />}
                onClick={async () => {
                  try {
                    const params = filters.weekEnd ? `?weekEnd=${encodeURIComponent(filters.weekEnd)}` : '';
                    const response = await api.get(`/reports/weekly/export/consolidated${params}`, { responseType: 'blob' });
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
                onClick={() => setOverrideModal(true)}
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
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            size="small" placeholder="Rechercher un projet…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            InputProps={{ startAdornment: <Search fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} /> }}
            sx={{ minWidth: 220 }}
          />

          <WeekNavigator
            weekEnd={filters.weekEnd}
            onChange={weekEnd => setFilters(prev => ({ ...prev, weekEnd }))}
          />

          {gee && (
            <FormControl size="small" sx={{ minWidth: 170 }}>
              <InputLabel>Filiale</InputLabel>
              <Select name="bureau" value={filters.bureau}
                onChange={handleFilterChange} label="Filiale">
                <MenuItem value="">Toutes</MenuItem>
                {bureaus.map(b => (
                  <MenuItem key={b._id} value={b._id}>{b.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel>Statut</InputLabel>
            <Select name="status" value={filters.status}
              onChange={handleFilterChange} label="Statut">
              {STATUS_OPTIONS.map(o => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

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
            onClick={() => { setFilters(EMPTY_FILTERS); setSearchInput(''); }}>
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
                        {projectLabel(report.project)}
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
                      {report.weekEnd && (
                        <Typography fontSize="0.7rem" color="text.secondary">{weekRange(report.weekEnd)}</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography fontSize="0.8rem" color="text.secondary">
                        {report.project?.siteLocation}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography fontSize="0.85rem">
                        {report.values?.tauxAvancementGlobal != null
                          ? `${report.values.tauxAvancementGlobal}%`
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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography fontSize="0.75rem" color="text.secondary">
                {pagination.total} rapport{pagination.total !== 1 ? 's' : ''}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography fontSize="0.75rem" color="text.secondary">Par page</Typography>
                <Select
                  size="small" value={rowsPerPage}
                  onChange={e => setRowsPerPage(e.target.value)}
                  sx={{ fontSize: '0.75rem', '& .MuiSelect-select': { py: 0.5 } }}
                >
                  {[10, 25, 50, 100].map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                </Select>
              </Box>
            </Box>
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
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Filiale</InputLabel>
            <Select
              value={overrideFilters.bureau}
              label="Filiale"
              onChange={e => setOverrideFilters(p => ({ ...p, bureau: e.target.value }))}
            >
              <MenuItem value="">Tous</MenuItem>
              {bureaus.map(b => (
                <MenuItem key={b._id} value={b._id}>{b.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <WeekNavigator
            weekEnd={overrideFilters.weekEnd}
            onChange={weekEnd => setOverrideFilters(p => ({ ...p, weekEnd }))}
          />
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
                    <TableCell>{projectLabel(r.project)}</TableCell>
                    <TableCell>{r.bureau?.name}</TableCell>
                    <TableCell>
                      {r.weekLabel}
                      {r.weekEnd && (
                        <Typography fontSize="0.7rem" color="text.secondary">{weekRange(r.weekEnd)}</Typography>
                      )}
                    </TableCell>
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

        {/* Reports never started for a past week */}
        <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
          Rapports non soumis
          {missingWeekEnd && ` — semaine du ${weekRange(missingWeekEnd)}`}
          {!overrideFilters.weekEnd && ' (semaine dernière)'}
        </Typography>
        {missingReports.length === 0 ? (
          <Alert severity="info">Aucun rapport manquant pour cette semaine</Alert>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Projet</TableCell>
                <TableCell>Filiale</TableCell>
                <TableCell>Semaine</TableCell>
                <TableCell align="center">Extension</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {missingReports.map(m => (
                <TableRow key={m.project._id}>
                  <TableCell>{projectLabel(m.project)}</TableCell>
                  <TableCell>{m.bureau?.name}</TableCell>
                  <TableCell>{m.weekLabel}</TableCell>
                  <TableCell align="center">
                    <Button
                      size="small" variant="contained" color="warning"
                      onClick={() => handleGrantMissing(m.project._id)}
                    >
                      Accorder 24h
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Modal>

    </Layout>
  );
}