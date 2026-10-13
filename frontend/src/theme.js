import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary:   { main: '#2E7D32', light: '#4CAF50', dark: '#1B5E20', contrastText: '#fff' },
    secondary: { main: '#C62828', light: '#EF5350', dark: '#B71C1C', contrastText: '#fff' },
    background:{ default: '#F4F6FA', paper: '#FFFFFF' },
    success:   { main: '#2E7D32' },
    error:     { main: '#C62828' },
    warning:   { main: '#E65100' },
    text:      { primary: '#1a1a1a', secondary: '#4a5568' }
  },
  typography: {
    fontFamily: '"Source Sans 3", sans-serif',
    h1: { fontFamily: '"Playfair Display", serif', fontWeight: 700 },
    h2: { fontFamily: '"Playfair Display", serif', fontWeight: 700 },
    h3: { fontFamily: '"Playfair Display", serif', fontWeight: 600 },
    h4: { fontFamily: '"Playfair Display", serif', fontWeight: 600 },
    h5: { fontFamily: '"Source Sans 3", sans-serif', fontWeight: 600 },
    h6: { fontFamily: '"Source Sans 3", sans-serif', fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 }
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          padding: '8px 20px',
          fontWeight: 600,
          boxShadow: 'none',
          '&:hover': { boxShadow: '0 2px 8px rgba(46,125,50,0.25)' }
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)',
        },
        containedSecondary: {
          background: 'linear-gradient(135deg, #EF5350 0%, #C62828 100%)',
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 4px rgba(46,125,50,0.08), 0 4px 16px rgba(46,125,50,0.06)',
          border: '1px solid rgba(46,125,50,0.08)'
        }
      }
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            backgroundColor: '#1B5E20',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: '0.85rem'
          }
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, fontSize: '0.75rem' }
      }
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined', size: 'small' }
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1B5E20',
          color: '#fff',
          borderRight: 'none'
        }
      }
    }
  }
});

export default theme;