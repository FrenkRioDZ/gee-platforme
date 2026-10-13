import { Box, Typography } from '@mui/material';

export default function AppFooter() {
  return (
    <Box sx={{
      mt: 'auto', py: 1.5, px: 3,
      borderTop: '1px solid rgba(0,0,0,0.08)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(13,59,110,0.02)'
    }}>
      <Typography fontSize="0.72rem" color="text.disabled" textAlign="center">
        © {new Date().getFullYear()} GEE/SETAM — Direction des Systèmes d'Information.
        Plateforme GEE — Usage interne confidentiel. Tous droits réservés.
      </Typography>
    </Box>
  );
}