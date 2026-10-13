import { Box, Card, Typography } from '@mui/material';
import { TrendingUp } from '@mui/icons-material';

export default function StatCard({ title, value, icon, color = '#0D3B6E', subtitle }) {
  return (
    <Card sx={{
      p: 2.5, height: '100%',
      position: 'relative', overflow: 'hidden',
      transition: 'transform 0.2s, box-shadow 0.2s',
      '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: '0 4px 20px rgba(13,59,110,0.12)'
      }
    }}>
      {/* Background decoration */}
      <Box sx={{
        position: 'absolute', top: -20, right: -20,
        width: 80, height: 80, borderRadius: '50%',
        background: color, opacity: 0.06
      }} />

      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box>
          <Typography sx={{
            fontSize: '0.75rem', fontWeight: 600,
            color: 'text.secondary', textTransform: 'uppercase',
            letterSpacing: 0.8, mb: 0.5
          }}>
            {title}
          </Typography>
          <Typography sx={{
            fontSize: '2rem', fontWeight: 700,
            color: color, lineHeight: 1,
            fontFamily: '"Playfair Display", serif'
          }}>
            {value ?? '—'}
          </Typography>
          {subtitle && (
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.5 }}>
              {subtitle}
            </Typography>
          )}
        </Box>

        <Box sx={{
          width: 44, height: 44, borderRadius: 2,
          background: color, opacity: 0.12,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Box sx={{ color: color, opacity: 1 / 0.12, display: 'flex' }}>
            {icon}
          </Box>
        </Box>
      </Box>
    </Card>
  );
}
