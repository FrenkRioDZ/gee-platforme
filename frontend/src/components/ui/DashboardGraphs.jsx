import { useState, useEffect } from 'react';
import {
  Box, Card, Typography, Grid, Chip,
  CircularProgress, ToggleButton, ToggleButtonGroup
} from '@mui/material';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { AccessTime, Warning, CheckCircle, Error } from '@mui/icons-material';
import api from '../../utils/api';

const COLORS = ['#0D3B6E', '#1565C0', '#2E7D32', '#E65100', '#880E4F', '#6A1B9A'];

const DeadlineItem = ({ project }) => {
  const color = project.status === 'overdue' ? '#C62828'
    : project.status === 'critical' ? '#E65100'
      : project.status === 'warning' ? '#F9A825'
        : '#2E7D32';

  const icon = project.status === 'overdue' ? <Error sx={{ fontSize: 16 }} />
    : project.status === 'critical' ? <Warning sx={{ fontSize: 16 }} />
      : <CheckCircle sx={{ fontSize: 16 }} />;

  const label = project.daysLeft < 0
    ? `Dépassé de ${Math.abs(project.daysLeft)}j`
    : `${project.daysLeft}j restants`;

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-between',
      py: 1, borderBottom: '1px solid rgba(0,0,0,0.05)'
    }}>
      <Box>
        <Typography fontSize="0.85rem" fontWeight={600}>{project.projectName}</Typography>
        <Typography fontSize="0.75rem" color="text.secondary">
          {project.bureau ? `${project.bureau} — ` : ''}{project.site}
        </Typography>
      </Box>
      <Chip
        icon={icon}
        label={label}
        size="small"
        sx={{
          background: `${color}15`, color,
          fontWeight: 700, fontSize: '0.72rem',
          '& .MuiChip-icon': { color }
        }}
      />
    </Box>
  );
};

export default function DashboardGraphs() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState('avancement');

  useEffect(() => {
    api.get('/dashboard/graphs')
      .then(r => setData(r.data))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} /></Box>;
  if (!data) return null;

  // Build line chart data — one entry per week
  const lineData = data.weeks.map((week, wi) => {
    const entry = { week: new Date(week).toLocaleDateString('fr-DZ', { day: '2-digit', month: '2-digit' }) };
    data.progressSeries.forEach((proj, pi) => {
      entry[proj.projectName] = proj[metric]?.[wi] ?? null;
    });
    return entry;
  });

  // Build bar chart data from weeklyStats
  const barData = data.weeklyStats.map(w => ({
    week: new Date(w.weekEnd).toLocaleDateString('fr-DZ', { day: '2-digit', month: '2-digit' }),
    Acceptés: w.accepted,
    'En attente': w.pending,
    Rejetés: w.rejected,
    Retard: w.late,
  }));

  const metricLabel = {
    avancement: 'Taux d\'avancement physique (%)',
    financier: 'Taux de consommation financière (%)',
    delais: 'Taux de consommation des délais (%)',
  };

  return (
    <Grid container spacing={2.5} sx={{ mb: 3 }}>

      {/* Progress line chart */}
      <Grid item xs={12} md={8}>
        <Card sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography fontWeight={700} fontSize="0.875rem" color="primary.main">
              Évolution par projet
            </Typography>
            <ToggleButtonGroup
              size="small" exclusive
              value={metric}
              onChange={(_, v) => v && setMetric(v)}
            >
              <ToggleButton value="avancement" sx={{ fontSize: '0.7rem', py: 0.3, px: 1 }}>Physique</ToggleButton>
              <ToggleButton value="financier" sx={{ fontSize: '0.7rem', py: 0.3, px: 1 }}>Financier</ToggleButton>
              <ToggleButton value="delais" sx={{ fontSize: '0.7rem', py: 0.3, px: 1 }}>Délais</ToggleButton>
            </ToggleButtonGroup>
          </Box>
          {data.progressSeries.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center', color: 'text.disabled' }}>
              <Typography fontSize="0.85rem">Aucune donnée disponible</Typography>
            </Box>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v) => v != null ? `${v}%` : '—'} />
                <Legend wrapperStyle={{ fontSize: '0.78rem' }} />
                {data.progressSeries.map((proj, i) => (
                  <Line
                    key={proj.projectName}
                    type="monotone"
                    dataKey={proj.projectName}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      </Grid>

      {/* Deadline countdown */}
      <Grid item xs={12} md={4}>
        <Card sx={{ p: 2.5, height: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <AccessTime fontSize="small" color="primary" />
            <Typography fontWeight={700} fontSize="0.875rem" color="primary.main">
              Échéances des projets
            </Typography>
          </Box>
          {data.deadlines.length === 0 ? (
            <Typography fontSize="0.85rem" color="text.disabled">Aucun projet actif</Typography>
          ) : (
            <Box sx={{ maxHeight: 260, overflowY: 'auto' }}>
              {data.deadlines.map((d, i) => (
                <DeadlineItem key={i} project={d} />
              ))}
            </Box>
          )}
        </Card>
      </Grid>

      {/* Weekly submission bar chart */}
      <Grid item xs={12}>
        <Card sx={{ p: 2.5 }}>
          <Typography fontWeight={700} fontSize="0.875rem" color="primary.main" mb={2}>
            Soumissions hebdomadaires
          </Typography>
          {barData.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center', color: 'text.disabled' }}>
              <Typography fontSize="0.85rem">Aucune donnée disponible</Typography>
            </Box>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '0.78rem' }} />
                <Bar dataKey="Acceptés" fill="#2E7D32" radius={[3, 3, 0, 0]} />
                <Bar dataKey="En attente" fill="#E65100" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Rejetés" fill="#C62828" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Retard" fill="#880E4F" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </Grid>

    </Grid>
  );
}