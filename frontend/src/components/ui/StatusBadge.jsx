import { Chip } from '@mui/material';
import { STATUS_LABELS, STATUS_COLORS } from '../../utils/roles';

export default function StatusBadge({ status, size = 'small' }) {
  const label = STATUS_LABELS[status] || status;
  const color = STATUS_COLORS[status] || 'default';

  return (
    <Chip
      label={label}
      color={color}
      size={size}
      sx={{ fontWeight: 600, fontSize: '0.72rem' }}
    />
  );
}
