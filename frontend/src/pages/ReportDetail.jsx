import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Grid, Card, Typography, Button, Divider,
  CircularProgress, Alert, Chip, Table, TableBody,
  TableCell, TableRow, FormControl, InputLabel, Select, MenuItem, Tooltip
} from '@mui/material';
import {
  ArrowBack, CheckCircle, Cancel,
  Send, RateReview
} from '@mui/icons-material';
import Layout from '../components/layout/Layout';
import StatusBadge from '../components/ui/StatusBadge';
import ReportTimeline from '../components/reports/ReportTimeline';
import ObservationModal from '../components/reports/ObservationModal';
import WeeklyReportForm from '../components/reports/WeeklyReportForm';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import {
  canReviewReport, canBureauForwardReport,
  canSubmitReport, isGEE
} from '../utils/roles';

// Page headings 
const PAGE_TITLES = {
  1: 'Situation Contractuelle',
  2: 'Infrastructure',
  3: 'Superstructure',
  4: 'Exploitation',
  5: 'Paiement',
};

// Large monetary values read better grouped; everything else passes through.
const formatValue = (value, field) => {
  if (value == null || value === '') return null;
  if (field.type === 'number' && field.unit === 'DA') {
    return Number(value).toLocaleString('fr-DZ');
  }
  return value;
};

// Group an ordered field list into consecutive runs sharing the same
// `section` value. Order within the page is preserved.
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

const DataRow = ({ label, value, suffix }) => (
  <TableRow>
    <TableCell sx={{
      color: 'text.secondary', fontSize: '0.825rem',
      fontWeight: 500, width: '55%', borderBottom: '1px solid rgba(0,0,0,0.04)'
    }}>
      {label}
    </TableCell>
    <TableCell sx={{
      fontWeight: 600, fontSize: '0.85rem',
      borderBottom: '1px solid rgba(0,0,0,0.04)'
    }}>
      {value != null && value !== '' ? `${value}${suffix || ''}` : '—'}
    </TableCell>
  </TableRow>
);

export default function ReportDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [rejectModal, setRejectModal] = useState(false);
  const [bureauRejectModal, setBureauRejectModal] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const isNew = id === 'new';
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);

  useEffect(() => {
    const handler = (e) => { if (e.detail?.reportId === report?._id) fetchReport(); };
    window.addEventListener('gee:report-updated', handler);
    return () => window.removeEventListener('gee:report-updated', handler);
  }, [report?._id]);

  useEffect(() => {
    if (!isNew) fetchReport();
    else { setLoading(false); if (user) fetchProjects(); }
  }, [id, user]);

  const fetchProjects = async () => {
    try {
      const { data } = await api.get('/projects?active=true&weekly=true');
      if (user?.role === 'bureau_user') {
        setProjects(data.filter(p =>
          p.assignedUsers?.some(u => (u._id || u) === user._id)
        ));
      } else {
        setProjects(data);
      }
    } catch { }
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/reports/weekly/${id}`);
      setReport(data);
    } catch {
      setError('Rapport introuvable');
    } finally {
      setLoading(false);
    }
  };

  const handleBureauForward = async () => {
    setActionLoading(true);
    setError('');
    try {
      await api.put(`/reports/weekly/${id}/bureau-submit`);
      setSuccess('Rapport transmis au GEE avec succès');
      fetchReport();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBureauReject = async (observation) => {
    setActionLoading(true);
    setError('');
    try {
      await api.put(`/reports/weekly/${id}/bureau-reject`, { observation });
      setBureauRejectModal(false);
      setSuccess('Rapport renvoyé à l\'utilisateur pour correction');
      fetchReport();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAccept = async () => {
    setActionLoading(true);
    setError('');
    try {
      await api.put(`/reports/weekly/${id}/accept`);
      setSuccess('Rapport accepté');
      fetchReport();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (observation) => {
    setActionLoading(true);
    setError('');
    try {
      await api.put(`/reports/weekly/${id}/reject`, { observation });
      setRejectModal(false);
      setSuccess('Rapport rejeté avec observation');
      fetchReport();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur');
    } finally {
      setActionLoading(false);
    }
  };

  // Show form for new report or editing rejected report
  if (isNew || editMode) {
    const currentProject = editMode ? report?.project : selectedProject;
    return (
      <Layout pageTitle={isNew ? 'Nouveau rapport' : 'Modifier le rapport'}>
        <Box sx={{ maxWidth: 900, mx: 'auto' }}>
          <Button startIcon={<ArrowBack />} onClick={() => navigate('/reports/weekly')} sx={{ mb: 2 }}>
            Retour
          </Button>
          <Card sx={{ p: 3 }}>
            <Typography variant="h5" sx={{ fontFamily: '"Playfair Display", serif', color: 'primary.main', mb: 3 }}>
              {isNew ? 'Nouveau rapport hebdomadaire' : 'Modifier le rapport'}
            </Typography>

            {/* Step 1 — pick a project if new */}
            {isNew && !selectedProject && (
              <Box>
                <Typography fontWeight={600} color="primary.main" mb={2}>
                  Sélectionner un projet
                </Typography>
                {projects.length === 0 ? (
                  <Alert severity="warning">Aucun projet industriel actif trouvé. Créez un projet d'abord.</Alert>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {projects.map(p => (
                      <Box key={p._id} onClick={() => setSelectedProject(p)}
                        sx={{
                          p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2,
                          cursor: 'pointer', '&:hover': { borderColor: 'primary.main', background: 'rgba(13,59,110,0.03)' }
                        }}>
                        <Typography fontWeight={600}>{p.name}</Typography>
                        <Typography fontSize="0.8rem" color="text.secondary">{p.siteLocation} — {p.entrepriseRealisation}</Typography>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            )}

            {/* Step 2 — show form once project selected */}
            {currentProject && (
              <WeeklyReportForm
                projectId={currentProject._id}
                projectType={currentProject.type}
                project={currentProject}
                existingReport={editMode ? report : null}
                onSuccess={() => navigate('/reports/weekly')}
              />
            )}
          </Card>
        </Box>
      </Layout>
    );
  }

  if (loading) return (
    <Layout pageTitle="Rapport hebdomadaire">
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    </Layout>
  );

  if (!report) return (
    <Layout pageTitle="Rapport introuvable">
      <Alert severity="error">Rapport introuvable</Alert>
    </Layout>
  );

  const p = report.project || {};
  const isLeadBureau = report.bureau?._id === user?.bureau?._id;
  const canForward = canBureauForwardReport(user?.role) && report.status === 'submitted' && isLeadBureau;
  const canReview = canReviewReport(user?.role) && report.status === 'bureau_approved';

  return (
    <Layout pageTitle="Rapport hebdomadaire">
      <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
        {/* Top bar */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Button startIcon={<ArrowBack />} onClick={() => navigate('/reports/weekly')}>
            Retour
          </Button>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <StatusBadge status={report.status} />
            {report.isLate && (
              <Chip label="EN RETARD" size="small"
                sx={{ background: '#FCE4EC', color: '#880E4F', fontWeight: 700 }} />
            )}
          </Box>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        {/* Rejection history */}
        {report.rejectionHistory?.length > 0 ? (
          <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography fontWeight={700} fontSize="0.9rem" color="primary.main">
              Historique des observations
            </Typography>
            {report.rejectionHistory.map((entry, idx) => (
              <Alert
                key={idx}
                severity="warning"
                icon={false}
                sx={{
                  borderLeft: '4px solid',
                  borderLeftColor: entry.source === 'gee' ? '#C62828' : '#E65100',
                  background: entry.source === 'gee' ? 'rgba(198,40,40,0.05)' : 'rgba(230,81,0,0.05)'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                  <Chip
                    label={entry.source === 'gee' ? 'GEE' : 'Bureau'}
                    size="small"
                    sx={{
                      fontWeight: 700, fontSize: '0.68rem', height: 20,
                      background: entry.source === 'gee' ? '#C62828' : '#E65100',
                      color: '#fff'
                    }}
                  />
                  <Typography fontSize="0.78rem" color="text.secondary">
                    {entry.from?.firstName} {entry.from?.lastName}
                    {entry.createdAt && ` — ${new Date(entry.createdAt).toLocaleDateString('fr-DZ')} à ${new Date(entry.createdAt).toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit' })}`}
                  </Typography>
                </Box>
                <Typography fontSize="0.85rem">{entry.note}</Typography>
              </Alert>
            ))}
          </Box>
        ) : (

          ['rejected', 'bureau_rejected'].includes(report.status) && report.rejectionNote && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography fontWeight={700} fontSize="0.85rem" mb={0.5}>
                {report.status === 'bureau_rejected'
                  ? 'Rapport renvoyé par l\'admin technique — observation :'
                  : 'Rapport rejeté par le GEE — observation :'}
              </Typography>
              <Typography fontSize="0.85rem">{report.rejectionNote}</Typography>
            </Alert>
          )
        )}

        <Grid container spacing={3}>
          {/* Left — report data */}
          <Grid item xs={12} md={8}>
            <Card sx={{ p: 3, mb: 2 }}>
              {/* Report header */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="h5" sx={{
                  fontFamily: '"Playfair Display", serif', color: 'primary.main'
                }}>
                  {p.name}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                  <Chip label={report.weekLabel} size="small" color="primary" variant="outlined" />
                  <Chip label={p.type?.replace('_', ' ')} size="small" variant="outlined" />
                  {isGEE(user?.role) && (
                    <Chip label={report.bureau?.name} size="small"
                      sx={{ background: 'rgba(13,59,110,0.08)' }} />
                  )}
                </Box>
              </Box>

              <Divider sx={{ mb: 2 }} />

              {/* Project info */}
              <Typography variant="subtitle2" color="primary.main" fontWeight={700} mb={1}>
                Informations projet
              </Typography>
              <Table size="small" sx={{ mb: 2.5 }}>
                <TableBody>
                  <DataRow label={p.siteLabel || 'Site du projet'} value={p.siteLocation} />
                  <DataRow label="Entreprise de réalisation" value={p.entrepriseRealisation} />
                  <DataRow label="Date ODS"
                    value={p.dateODS ? new Date(p.dateODS).toLocaleDateString('fr-DZ') : null} />
                  <DataRow label="Délais contractuel" value={p.delaisContractuel} suffix=" mois" />
                </TableBody>
              </Table>

              {/* ── DYNAMIC REPORT DATA ─────────────────────────────*/}
              {report.canvasVersion?.fields?.length ? (
                Object.entries(
                  report.canvasVersion.fields
                    .slice()
                    .sort((a, b) => (a.page - b.page) || (a.order - b.order))
                    .reduce((acc, f) => {
                      (acc[f.page] = acc[f.page] || []).push(f);
                      return acc;
                    }, {})
                ).map(([page, fields]) => (
                  <Box key={page}>
                    <Typography variant="subtitle2" color="primary.main" fontWeight={700} mb={1}>
                      {PAGE_TITLES[page] || `Page ${page}`}
                    </Typography>

                    
                    {String(page) === '1' && (
                      <Table size="small" sx={{ mb: 1.5 }}>
                        <TableBody>
                          <DataRow label="Montant du marché"
                            value={p.montantMarche?.toLocaleString('fr-DZ')} suffix=" DA/TTC" />
                          <DataRow label="AMO" value={p.AMO} />
                        </TableBody>
                      </Table>
                    )}

                    {String(page) === '5' && p.specs?.avance_forfaitaire != null && (
                      <Table size="small" sx={{ mb: 1.5 }}>
                        <TableBody>
                          <DataRow label="Avance forfaitaire"
                            value={Number(p.specs.avance_forfaitaire).toLocaleString('fr-DZ')} suffix=" DA" />
                          <DataRow label="Solde restant"
                            value={(Number(p.specs.avance_forfaitaire) - Number(report.values?.avance_remboursement_cumule || 0)).toLocaleString('fr-DZ')} suffix=" DA" />
                        </TableBody>
                      </Table>
                    )}

                    {groupBySection(fields).map((group, gi) => (
                      <Box key={gi}>
                        {group.section && (
                          <Typography fontSize="0.8rem" fontWeight={600}
                            color="text.secondary" sx={{ mb: 0.5, mt: 1 }}>
                            {group.section}
                          </Typography>
                        )}
                        <Table size="small" sx={{ mb: 1.5 }}>
                          <TableBody>
                            {group.fields.map(f => (
                              <DataRow
                                key={f.key}
                                label={f.label}
                                value={formatValue(report.values?.[f.key], f)}
                                suffix={f.unit ? ` ${f.unit}` : ''}
                              />
                            ))}
                          </TableBody>
                        </Table>
                      </Box>
                    ))}
                    <Box sx={{ mb: 1 }} />
                  </Box>
                ))
              ) : (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Impossible d'afficher les données : aucun modèle (canvas) associé à ce rapport.
                </Alert>
              )}
            </Card>

            {/* Action buttons */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {canSubmitReport(user?.role) && ['draft', 'rejected', 'bureau_rejected'].includes(report.status) && (
                <Tooltip title={report.isLate ? 'Délai dépassé — soumission impossible' : ''}>
                  <span>
                    <Button
                      variant="outlined"
                      onClick={() => setEditMode(true)}
                      disabled={report.isLate}
                    >
                      {report.isLate ? 'Délai dépassé' : 'Modifier'}
                    </Button>
                  </span>
                </Tooltip>
              )}
              {canForward && (
                <>
                  <Button variant="contained" startIcon={<RateReview />}
                    onClick={handleBureauForward} disabled={actionLoading}>
                    {actionLoading ? <CircularProgress size={18} color="inherit" /> : 'Transmettre au GEE'}
                  </Button>
                  <Button variant="outlined" color="error" startIcon={<Cancel />}
                    onClick={() => setBureauRejectModal(true)} disabled={actionLoading}>
                    Renvoyer pour correction
                  </Button>
                </>
              )}
              {canReview && (
                <>
                  <Button variant="contained" color="success"
                    startIcon={<CheckCircle />}
                    onClick={handleAccept} disabled={actionLoading}>
                    {actionLoading ? <CircularProgress size={18} color="inherit" /> : 'Accepter'}
                  </Button>
                  <Button variant="contained" color="error"
                    startIcon={<Cancel />}
                    onClick={() => setRejectModal(true)} disabled={actionLoading}>
                    Rejeter
                  </Button>
                </>
              )}
            </Box>
          </Grid>

          {/* Right — timeline */}
          <Grid item xs={12} md={4}>
            <Card sx={{ p: 3 }}>
              <ReportTimeline report={report} />
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* GEE Reject modal */}
      <ObservationModal
        open={rejectModal}
        onClose={() => setRejectModal(false)}
        onConfirm={handleReject}
        projectName={p.name}
        loading={actionLoading}
      />

      {/* Bureau reject modal */}
      <ObservationModal
        open={bureauRejectModal}
        onClose={() => setBureauRejectModal(false)}
        onConfirm={handleBureauReject}
        projectName={p.name}
        loading={actionLoading}
      />
    </Layout>
  );
}