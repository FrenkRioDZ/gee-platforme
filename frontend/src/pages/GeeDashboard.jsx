import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Grid, Card, CardContent, Typography, Button,
  Chip, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, CircularProgress,
  Alert, Tooltip, IconButton, Select, MenuItem
} from '@mui/material';
import {
  Assessment, CheckCircle, HourglassEmpty, CalendarMonth,
  Warning, Cancel, Download, Refresh, TrendingUp, ChevronLeft, ChevronRight, Today
} from '@mui/icons-material';
import WeekCalendarPicker from '../components/ui/WeekCalendarPicker';
import Layout from '../components/layout/Layout';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import api from '../utils/api';
import DashboardGraphs from '../components/ui/DashboardGraphs';

const STATUS_BG = {
  accepte: { bg: '#E8F5E9', color: '#2E7D32', label: 'Accepté' },
  rejete: { bg: '#FFEBEE', color: '#C62828', label: 'Rejeté' },
  en_attente: { bg: '#FFF3E0', color: '#E65100', label: 'En attente' },
  retard: { bg: '#FCE4EC', color: '#880E4F', label: 'En retard' },
  brouillon: { bg: '#F3F4F6', color: '#6B7280', label: 'Brouillon' },
  non_soumis: { bg: '#F3F4F6', color: '#9E9E9E', label: 'Non soumis' }
};

export default function GeeDashboard() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [weekEnd, setWeekEnd] = useState('');
  const [calendarAnchor, setCalendarAnchor] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { fetchDashboard(); }, [weekEnd]);

  useEffect(() => {
    const handler = () => fetchDashboard();
    window.addEventListener('gee:report-updated', handler);
    return () => window.removeEventListener('gee:report-updated', handler);
  }, [weekEnd]);

  const fetchDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const params = weekEnd ? `?weekEnd=${weekEnd}` : '';
      const { data: res } = await api.get(`/dashboard/gee${params}`);
      setData(res);
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = weekEnd ? `?weekEnd=${weekEnd}` : '';
      const res = await api.get(`/dashboard/gee/export${params}`, {
        responseType: 'blob'
      });
      const url = URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      const dateLabel = data?.weekEnd ? new Date(data.weekEnd).toISOString().split('T')[0] : 'hebdomadaire';
      link.setAttribute('download', `rapport_${dateLabel}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      setError('Erreur lors de l\'export');
    } finally {
      setExporting(false);
    }
  };

  const stats = data?.consolidatedStats;

  return (
    <Layout pageTitle={t('dashboard.title')}>
      {/* Header row */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontFamily: '"Playfair Display", serif', color: 'primary.main' }}>
            {t('dashboard.title')}
          </Typography>
          {data?.weekEnd && (
            <Typography variant="body2" color="text.secondary">
              {t('dashboard.week')} : <strong>
                {new Date(new Date(data.weekEnd).getTime() - 6 * 86400000).toLocaleDateString('fr-DZ')}
                {' → '}
                {new Date(data.weekEnd).toLocaleDateString('fr-DZ')}
              </strong>
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Tooltip title="Semaine précédente">
            <IconButton
              size="small" color="primary"
              onClick={() => {
                const ref = new Date(weekEnd || data?.weekEnd || Date.now());
                ref.setDate(ref.getDate() - 7);
                setWeekEnd(ref.toISOString());
              }}
            >
              <ChevronLeft />
            </IconButton>
          </Tooltip>

          {weekEnd && (
            <Tooltip title="Revenir à la semaine actuelle">
              <IconButton size="small" color="primary" onClick={() => setWeekEnd('')}>
                <Today />
              </IconButton>
            </Tooltip>
          )}

          <Tooltip title="Semaine suivante">
            <span>
              <IconButton
                size="small" color="primary"
                disabled={!weekEnd}
                onClick={() => {
                  const ref = new Date(weekEnd || data?.weekEnd || Date.now());
                  ref.setDate(ref.getDate() + 7);
                  setWeekEnd(ref.toISOString());
                }}
              >
                <ChevronRight />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="Choisir une semaine">
            <IconButton size="small" color="primary" onClick={e => setCalendarAnchor(e.currentTarget)}>
              <CalendarMonth />
            </IconButton>
          </Tooltip>

          <Tooltip title="Rafraîchir">
            <IconButton onClick={fetchDashboard} size="small" color="primary">
              <Refresh />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained" startIcon={<Download />}
            onClick={handleExport} disabled={exporting || !data}
            size="small"
          >
            {exporting ? 'Export...' : t('dashboard.export_excel')}
          </Button>
        </Box>
      </Box>

      <WeekCalendarPicker
        anchorEl={calendarAnchor}
        open={Boolean(calendarAnchor)}
        onClose={() => setCalendarAnchor(null)}
        selectedWeekEnd={weekEnd || data?.weekEnd}
        onSelect={(weekEndDate) => setWeekEnd(weekEndDate.toISOString())}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Stat cards */}
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md>
              <StatCard
                title={t('dashboard.total_reports')}
                value={stats?.totalReports}
                icon={<Assessment />}
                color="#0D3B6E"
              />
            </Grid>
            <Grid item xs={12} sm={6} md>
              <StatCard
                title={t('dashboard.accepted')}
                value={stats?.totalAccepted}
                icon={<CheckCircle />}
                color="#2E7D32"
              />
            </Grid>
            <Grid item xs={12} sm={6} md>
              <StatCard
                title={t('dashboard.pending')}
                value={stats?.totalPending}
                icon={<HourglassEmpty />}
                color="#E65100"
              />
            </Grid>
            <Grid item xs={12} sm={6} md>
              <StatCard
                title={t('dashboard.rejected')}
                value={stats?.totalRejected}
                icon={<Cancel />}
                color="#C62828"
              />
            </Grid>
            <Grid item xs={12} sm={6} md>
              <StatCard
                title={t('dashboard.late')}
                value={stats?.totalLate}
                icon={<Warning />}
                color="#880E4F"
              />
            </Grid>
            <Grid item xs={12} sm={6} md>
              <StatCard
                title={t('dashboard.missing')}
                value={stats?.totalMissing}
                icon={<Warning />}
                color="#4E342E"
              />
            </Grid>
            <Grid item xs={12} sm={6} md>
              <StatCard
                title={t('dashboard.submission_rate')}
                value={stats?.submissionRate}
                icon={<TrendingUp />}
                color="#1565C0"
              />
            </Grid>
          </Grid>

          {/* Financial summary */}
          {stats && (
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} md={6}>
                <Card sx={{ p: 2 }}>
                  <Typography variant="h6" sx={{ mb: 1.5, color: 'primary.main', fontSize: '0.9rem', fontWeight: 700 }}>
                    Entreprise de Réalisation
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 3 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Facturation TTC</Typography>
                      <Typography fontWeight={700} color="primary.main">
                        {stats.totalFacturationEntreprise?.toLocaleString('fr-DZ') || 0} DA
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Encaissement TTC</Typography>
                      <Typography fontWeight={700} color="success.main">
                        {stats.totalEncaissementEntreprise?.toLocaleString('fr-DZ') || 0} DA
                      </Typography>
                    </Box>
                  </Box>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card sx={{ p: 2 }}>
                  <Typography variant="h6" sx={{ mb: 1.5, color: 'primary.main', fontSize: '0.9rem', fontWeight: 700 }}>
                    BET
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 3 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Facturation TTC</Typography>
                      <Typography fontWeight={700} color="primary.main">
                        {stats.totalFacturationBET?.toLocaleString('fr-DZ') || 0} DA
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Encaissement TTC</Typography>
                      <Typography fontWeight={700} color="success.main">
                        {stats.totalEncaissementBET?.toLocaleString('fr-DZ') || 0} DA
                      </Typography>
                    </Box>
                  </Box>
                </Card>
              </Grid>

              {stats.totalAvanceAccordee > 0 && (
                <Grid item xs={12}>
                  <Card sx={{ p: 2 }}>
                    <Typography variant="h6" sx={{ mb: 1.5, color: 'primary.main', fontSize: '0.9rem', fontWeight: 700 }}>
                      Avance Forfaitaire
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Accordée</Typography>
                        <Typography fontWeight={700} color="primary.main">
                          {stats.totalAvanceAccordee?.toLocaleString('fr-DZ') || 0} DA
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Remboursée</Typography>
                        <Typography fontWeight={700} color="success.main">
                          {stats.totalAvanceRemboursee?.toLocaleString('fr-DZ') || 0} DA
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Solde restant</Typography>
                        <Typography fontWeight={700} sx={{ color: '#E65100' }}>
                          {stats.totalAvanceSolde?.toLocaleString('fr-DZ') || 0} DA
                        </Typography>
                      </Box>
                    </Box>
                  </Card>
                </Grid>
              )}
            </Grid>
          )}
          <DashboardGraphs />
          {/* Bureau status grid */}
          <Card>
            <Box sx={{
              px: 3, py: 2,
              borderBottom: '1px solid', borderColor: 'divider',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <Typography fontWeight={700} color="primary.main">
                {t('dashboard.bureau_status')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {data?.bureauGrid?.length || 0} filiales
              </Typography>
            </Box>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Filiale</TableCell>
                    <TableCell align="center">Statut</TableCell>
                    <TableCell align="center">Total</TableCell>
                    <TableCell align="center">Acceptés</TableCell>
                    <TableCell align="center">En attente</TableCell>
                    <TableCell align="center">Rejetés</TableCell>
                    <TableCell align="center">En retard</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data?.bureauGrid?.map(row => {
                    const style = STATUS_BG[row.overallStatus] || STATUS_BG.non_soumis;
                    return (
                      <TableRow
                        key={row.bureau._id}
                        sx={{ '&:hover': { background: 'rgba(13,59,110,0.02)' } }}
                      >
                        <TableCell>
                          <Typography fontWeight={600} fontSize="0.85rem">
                            {row.bureau.name}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={style.label}
                            size="small"
                            sx={{
                              background: style.bg, color: style.color,
                              fontWeight: 700, fontSize: '0.7rem'
                            }}
                          />
                        </TableCell>
                        <TableCell align="center">{row.stats.total}</TableCell>
                        <TableCell align="center">
                          <Typography color="success.main" fontWeight={600} fontSize="0.85rem">
                            {row.stats.accepted}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Typography color="warning.main" fontWeight={600} fontSize="0.85rem">
                            {row.stats.pending}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Typography color="error.main" fontWeight={600} fontSize="0.85rem">
                            {row.stats.rejected}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          {row.stats.late > 0 ? (
                            <Chip
                              label={row.stats.late}
                              size="small"
                              sx={{ background: '#FCE4EC', color: '#880E4F', fontWeight: 700 }}
                            />
                          ) : (
                            <Typography color="text.disabled" fontSize="0.85rem">0</Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </>
      )}
    </Layout>
  );
}
