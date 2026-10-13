import { Box, Modal as MuiModal, IconButton, Typography } from '@mui/material';
import { Close } from '@mui/icons-material';

export default function Modal({ open, onClose, title, children, maxWidth = 600 }) {
  const handleClose = (event, reason) => {
    if (reason === 'backdropClick') return;
    onClose();
  };

  return (
    <MuiModal open={open} onClose={handleClose}>
      <Box sx={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '100%', maxWidth,
        background: '#fff', borderRadius: 3,
        boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
        overflow: 'hidden',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column'
      }}>
        {/* Header */}
        <Box sx={{
          px: 3, py: 2,
          background: 'linear-gradient(135deg, #0D3B6E, #1565C0)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <Typography sx={{
            color: '#fff', fontWeight: 700, fontSize: '1rem',
            fontFamily: '"Playfair Display", serif'
          }}>
            {title}
          </Typography>
          <IconButton onClick={onClose} size="small" sx={{
            color: 'rgba(255,255,255,0.7)',
            '&:hover': { color: '#fff', background: 'rgba(255,255,255,0.1)' }
          }}>
            <Close fontSize="small" />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ p: 3, overflowY: 'auto' }}>
          {children}
        </Box>
      </Box>
    </MuiModal>
  );
}
