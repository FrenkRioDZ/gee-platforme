import { Box, Typography, Divider, Chip } from '@mui/material';
import {
  Edit, Send, RateReview, CheckCircle,
  Cancel, Person
} from '@mui/icons-material';

const STEPS = [
  { status: 'draft', icon: <Edit />, label: 'Brouillon créé', color: '#9E9E9E' },
  { status: 'submitted', icon: <Send />, label: 'Soumis au bureau admin', color: '#1565C0' },
  { status: 'bureau_approved', icon: <RateReview />, label: 'Transmis au GEE', color: '#E65100' },
  { status: 'accepted', icon: <CheckCircle />, label: 'Accepté par le GEE', color: '#2E7D32' },
];

const STATUS_ORDER = ['draft', 'submitted', 'bureau_approved', 'accepted'];

export default function ReportTimeline({ report }) {
  if (!report) return null;

  const currentIdx = STATUS_ORDER.indexOf(report.status);
  const isGeeRejected = report.status === 'rejected';
  const isBureauRejected = report.status === 'bureau_rejected';
  const isAnyRejected = isGeeRejected || isBureauRejected;

  // GEE rejects from 'bureau_approved' (idx 2); bureau rejects from 'submitted' (idx 1)
  const rejectedFromIdx = isBureauRejected ? 1 : isGeeRejected ? 2 : null;

  return (
    <Box>
      <Typography fontWeight={700} fontSize="0.875rem" color="primary.main" mb={2}>
        Historique de soumission
      </Typography>

      {/* Timeline steps */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {STATUS_ORDER.map((status, idx) => {
          const step = STEPS.find(s => s.status === status);
          const done = isAnyRejected ? idx <= rejectedFromIdx : idx <= currentIdx;
          const current = !isAnyRejected && idx === currentIdx;

          let timestamp = null;
          if (status === 'submitted' && report.submittedAt)
            timestamp = report.submittedAt;
          if (status === 'bureau_approved' && report.bureauApprovedAt)
            timestamp = report.bureauApprovedAt;
          if (status === 'accepted' && report.geeReviewedAt)
            timestamp = report.geeReviewedAt;

          let actor = null;
          if (status === 'submitted' && report.submittedBy)
            actor = `${report.submittedBy.firstName} ${report.submittedBy.lastName}`;
          if (status === 'bureau_approved' && report.bureauApprovedBy)
            actor = `${report.bureauApprovedBy.firstName} ${report.bureauApprovedBy.lastName}`;
          if (status === 'accepted' && report.geeReviewedBy)
            actor = `${report.geeReviewedBy.firstName} ${report.geeReviewedBy.lastName}`;

          return (
            <Box key={status} sx={{ display: 'flex', gap: 2 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Box sx={{
                  width: 36, height: 36, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: done ? step.color : 'rgba(0,0,0,0.06)',
                  color: done ? '#fff' : '#9E9E9E',
                  flexShrink: 0,
                  boxShadow: current ? `0 0 0 3px ${step.color}33` : 'none',
                  transition: 'all 0.2s'
                }}>
                  {step.icon}
                </Box>
                {idx < STATUS_ORDER.length - 1 && (
                  <Box sx={{
                    width: 2, flex: 1, minHeight: 24,
                    background: done && idx < (isAnyRejected ? rejectedFromIdx : currentIdx)
                      ? step.color
                      : 'rgba(0,0,0,0.08)',
                    my: 0.5
                  }} />
                )}
              </Box>

              <Box sx={{ pb: 2, flex: 1 }}>
                <Typography fontSize="0.825rem" fontWeight={done ? 600 : 400}
                  color={done ? 'text.primary' : 'text.disabled'}>
                  {step.label}
                </Typography>
                {actor && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.3 }}>
                    <Person sx={{ fontSize: 12, color: 'text.disabled' }} />
                    <Typography fontSize="0.75rem" color="text.secondary">{actor}</Typography>
                  </Box>
                )}
                {timestamp && (
                  <Typography fontSize="0.72rem" color="text.disabled" mt={0.2}>
                    {new Date(timestamp).toLocaleString('fr-DZ')}
                  </Typography>
                )}
              </Box>
            </Box>
          );
        })}

        {/* Terminal rejection step — branches by source */}
        {isAnyRejected && (
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Box sx={{
              width: 36, height: 36, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isGeeRejected ? '#C62828' : '#E65100', color: '#fff', flexShrink: 0,
              boxShadow: isGeeRejected ? '0 0 0 3px rgba(198,40,40,0.2)' : '0 0 0 3px rgba(230,81,0,0.2)'
            }}>
              <Cancel />
            </Box>
            <Box sx={{ pb: 2, flex: 1 }}>
              <Typography fontSize="0.825rem" fontWeight={600} color={isGeeRejected ? 'error.main' : 'warning.main'}>
                {isGeeRejected ? 'Rejeté par le GEE' : 'Renvoyé par le bureau'}
              </Typography>
              {isGeeRejected && report.geeReviewedBy && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.3 }}>
                  <Person sx={{ fontSize: 12, color: 'text.disabled' }} />
                  <Typography fontSize="0.75rem" color="text.secondary">
                    {report.geeReviewedBy.firstName} {report.geeReviewedBy.lastName}
                  </Typography>
                </Box>
              )}
              {isGeeRejected && report.geeReviewedAt && (
                <Typography fontSize="0.72rem" color="text.disabled" mt={0.2}>
                  {new Date(report.geeReviewedAt).toLocaleString('fr-DZ')}
                </Typography>
              )}
              {isBureauRejected && report.bureauApprovedBy && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.3 }}>
                  <Person sx={{ fontSize: 12, color: 'text.disabled' }} />
                  <Typography fontSize="0.75rem" color="text.secondary">
                    {report.bureauApprovedBy.firstName} {report.bureauApprovedBy.lastName}
                  </Typography>
                </Box>
              )}
              {isBureauRejected && report.bureauApprovedAt && (
                <Typography fontSize="0.72rem" color="text.disabled" mt={0.2}>
                  {new Date(report.bureauApprovedAt).toLocaleString('fr-DZ')}
                </Typography>
              )}
            </Box>
          </Box>
        )}
      </Box>

      {/* Full rejection history — every bureau + GEE observation, tagged and timestamped */}
      {report.rejectionHistory?.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Divider sx={{ mb: 2 }} />
          <Typography fontWeight={700} fontSize="0.875rem" color="primary.main" mb={1.5}>
            Historique des observations
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {report.rejectionHistory.map((entry, idx) => {
              const color = entry.source === 'gee' ? '#C62828' : '#E65100';
              return (
                <Box key={idx} sx={{
                  p: 2, borderRadius: 2,
                  background: `${color}0A`,
                  border: `1px solid ${color}26`,
                  borderLeft: `3px solid ${color}`
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Chip
                      label={entry.source === 'gee' ? 'GEE' : 'Bureau'}
                      size="small"
                      sx={{ fontWeight: 700, fontSize: '0.65rem', height: 18, background: color, color: '#fff' }}
                    />
                  </Box>
                  <Typography fontSize="0.825rem" color="text.primary">
                    {entry.note}
                  </Typography>
                  {entry.from && (
                    <Typography fontSize="0.72rem" color="text.disabled" mt={0.5}>
                      {entry.from.firstName} {entry.from.lastName}
                      {entry.createdAt && ` — ${new Date(entry.createdAt).toLocaleString('fr-DZ')}`}
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
      )}
    </Box>
  );
}