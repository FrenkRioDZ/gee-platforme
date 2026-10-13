import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Box, Grid, Card, Typography, Button,
  Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, CircularProgress, Alert,
  IconButton, Tooltip, LinearProgress
} from '@mui/material';
import {
  Assessment, CheckCircle, HourglassEmpty,
  Warning, Add, Refresh, ArrowForward
} from '@mui/icons-material';
import Layout from '../components/layout/Layout';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import DashboardGraphs from '../components/ui/DashboardGraphs';

export default function BureauDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { fetchDashboard(); }, []);

  useEffect(() => {
    const handler = () => fetchDashboard();
    window.addEventListener('gee:report-updated', handler);
    return () => window.removeEventListener('gee:report-updated', handler);
  }, []);

  const fetchDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: res } = await api.get('/dashboard/bureau');
      setData(res);
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const stats = data?.stats;

  return (
    <Layout pageTitle={t('dashboard.title')}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontFamily: '"Playfair Display", serif', color: 'primary.main' }}>
            {t('dashboard.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {user?.bureau?.name}
            {data?.weekEnd && (
              <>
                {' — '}{t('dashboard.week')} : <strong>
                  {new Date(new Date(data.weekEnd).getTime() - 6 * 86400000).toLocaleDateString('fr-DZ')}
                  {' → '}
                  {new Date(data.weekEnd).toLocaleDateString('fr-DZ')}
                </strong>
              </>
            )}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Rafraîchir">
            <IconButton onClick={fetchDashboard} size="small" color="primary">
              <Refresh />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained" size="small"
            startIcon={<Add />}
            onClick={() => navigate('/reports/weekly/new')}
          >
            {t('reports.new')}
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Stat cards */}
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={3}>
              <StatCard
                title="Total projets"
                value={stats?.totalProjects}
                icon={<Assessment />}
                color="#0D3B6E"
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <StatCard
                title={t('dashboard.accepted')}
                value={stats?.accepted}
                icon={<CheckCircle />}
                color="#2E7D32"
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <StatCard
                title={t('dashboard.pending')}
                value={stats?.pending}
                icon={<HourglassEmpty />}
                color="#E65100"
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <StatCard
                title={t('dashboard.late')}
                value={stats?.late}
                icon={<Warning />}
                color="#C62828"
              />
            </Grid>
          </Grid>

          {/* Submission progress */}
          {stats && stats.totalProjects > 0 && (
            <Card sx={{ p: 2.5, mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography fontWeight={600} fontSize="0.875rem" color="primary.main">
                  Progression des soumissions cette semaine
                </Typography>
                <Typography fontWeight={700} fontSize="0.875rem" color="primary.main">
                  {stats.submitted}/{stats.totalProjects}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={stats.totalProjects > 0
                  ? Math.round((stats.submitted / stats.totalProjects) * 100)
                  : 0
                }
                sx={{
                  height: 8, borderRadius: 4,
                  backgroundColor: 'rgba(13,59,110,0.1)',
                  '& .MuiLinearProgress-bar': {
                    background: 'linear-gradient(90deg, #0D3B6E, #1565C0)'
                  }
                }}
              />
            </Card>
          )}
          <DashboardGraphs />

          {/* Project status table */}
          <Card>
            <Box sx={{
              px: 3, py: 2,
              borderBottom: '1px solid', borderColor: 'divider',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <Typography fontWeight={700} color="primary.main">
                Statut des rapports hebdomadaires
              </Typography>
              <Button
                size="small" endIcon={<ArrowForward />}
                onClick={() => navigate('/reports/weekly')}
              >
                Voir tous
              </Button>
            </Box>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Projet</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Site</TableCell>
                    <TableCell align="center">Statut</TableCell>
                    <TableCell align="center">Soumis le</TableCell>
                    <TableCell align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data?.projectStatus?.map(row => (
                    <TableRow
                      key={row.project._id}
                      sx={{
                        '&:hover': { background: 'rgba(13,59,110,0.02)' },
                        background: row.isLate ? 'rgba(198,40,40,0.03)' : 'inherit'
                      }}
                    >
                      <TableCell>
                        <Typography fontWeight={600} fontSize="0.85rem">
                          {row.project.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography fontSize="0.8rem" color="text.secondary">
                          {row.project.type?.replace('_', ' ')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography fontSize="0.8rem" color="text.secondary">
                          {row.project.siteLocation}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <StatusBadge status={row.isLate ? 'rejected' : row.status} />
                        {row.isLate && (
                          <Typography fontSize="0.65rem" color="error.main" fontWeight={700} mt={0.3}>
                            EN RETARD
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Typography fontSize="0.8rem" color="text.secondary">
                          {row.report?.submittedAt
                            ? new Date(row.report.submittedAt).toLocaleDateString('fr-DZ')
                            : '—'
                          }
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          size="small" variant="outlined"
                          disabled={row.isLate}
                          onClick={() => navigate(
                            row.report
                              ? `/reports/weekly/${row.report._id}`
                              : `/reports/weekly/new?project=${row.project._id}`
                          )}
                        >
                          {row.report ? 'Voir' : 'Saisir'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </>
      )}
    </Layout>
  );
}
