import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box, Card, CardContent, TextField, Button,
  Typography, Alert, CircularProgress, IconButton,
  InputAdornment, Divider, Select, MenuItem
} from '@mui/material';
import { Visibility, VisibilityOff, Language } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { isGEE } from '../utils/roles';

export default function Login() {
  const { t, i18n } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = e =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      navigate(isGEE(user.role) ? '/dashboard/gee' : '/dashboard/bureau');
    } catch (err) {
  setError(err.friendlyMessage || err.response?.data?.message || 'Erreur de connexion');
} finally {
      setLoading(false);
    }
  };

  const changeLang = lang => {
    i18n.changeLanguage(lang);
    localStorage.setItem('lang', lang);
    document.dir = lang === 'ar' ? 'rtl' : 'ltr';
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      display: 'flex',
      background: 'linear-gradient(160deg, #1B5E20 0%, #0a3d0a 50%, #051a05 100%)',
      position: 'relative',
      overflow: 'hidden'
    }}>

      {/* Background decorative circles */}
      <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <Box sx={{
          position: 'absolute', top: -120, right: -120,
          width: 400, height: 400, borderRadius: '50%',
          border: '1px solid rgba(198,40,40,0.2)'
        }} />
        <Box sx={{
          position: 'absolute', top: -60, right: -60,
          width: 280, height: 280, borderRadius: '50%',
          border: '1px solid rgba(198,40,40,0.12)'
        }} />
        <Box sx={{
          position: 'absolute', bottom: -80, left: -80,
          width: 320, height: 320, borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.05)'
        }} />
        <Box sx={{
          position: 'absolute', top: 0, left: '40%',
          width: '1px', height: '100%',
          background: 'linear-gradient(to bottom, transparent, rgba(198,40,40,0.15), transparent)'
        }} />
      </Box>

      {/* Left panel — branding + group image */}
      <Box sx={{
        flex: 1,
        display: { xs: 'none', md: 'flex' },
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        pl: 10,
        pr: 4,
        py: 6,
        position: 'relative',
        zIndex: 1,
        overflow: 'hidden'
      }}>

        {/* Group image */}
        <Box sx={{
          position: 'absolute', inset: 0,
          backgroundImage: `url('/Solutions_Groupe_GEE.jpg')`,
          backgroundSize: '115%',
          backgroundPosition: 'left center',
          opacity: 0.3,
          filter: 'grayscale(20%)'
        }} />

        {/* Content over image */}
        <Box sx={{ position: 'relative', zIndex: 2, textAlign: 'center', ml: 'auto', mr: 4, maxWidth: 380 }}>

          {/* Logo box */}
          <Box sx={{
            width: 88, height: 88, borderRadius: 2,
            background: 'linear-gradient(135deg, #C62828, #B71C1C)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            mb: 3, mx: 'auto',
            boxShadow: '0 8px 32px rgba(198,40,40,0.4)'
          }}>
            <Typography sx={{
              color: '#fff', fontWeight: 700, fontSize: 28,
              fontFamily: '"Playfair Display", serif'
            }}>
              GEE
            </Typography>
          </Box>

          <Typography variant="h3" sx={{
            color: '#fff', fontFamily: '"Playfair Display", serif',
            fontWeight: 700, textAlign: 'center', mb: 2, lineHeight: 1.2
          }}>
            Groupe Études<br />& Engineering
          </Typography>

          <Typography sx={{
            color: 'rgba(255,255,255,0.65)', textAlign: 'center',
            maxWidth: 380, lineHeight: 1.8, fontSize: '1rem', mx: 'auto'
          }}>
            Plateforme de digitalisation des flux d'information entre le GEE et ses 12 bureaux d'études affiliés.
          </Typography>

          <Divider sx={{
            width: 60, borderColor: 'rgba(198,40,40,0.6)',
            borderWidth: 2, my: 4, mx: 'auto'
          }} />

          <Box sx={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
            {['12 Filiales', '3 Domaines', 'Temps réel'].map(stat => (
              <Box key={stat} sx={{ textAlign: 'center' }}>
                <Typography sx={{
                  fontSize: '0.75rem', letterSpacing: 1.5,
                  textTransform: 'uppercase', color: 'rgba(239,83,80,0.9)'
                }}>
                  {stat}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Filiale logos hint */}
          <Typography sx={{
            mt: 5, fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)',
            letterSpacing: 2, textTransform: 'uppercase'
          }}>
            SETAM · BEREG · BEMILA · BEET · BEHA · BREP<br />
            ENRI · BETP · BER-MSILA · SATO · MHT · GART
          </Typography>
        </Box>
      </Box>

      {/* Right panel — login form */}
      <Box sx={{
        width: { xs: '100%', md: 480 },
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        p: { xs: 3, md: 5 }, position: 'relative', zIndex: 1
      }}>
        <Card sx={{
          width: '100%', maxWidth: 420,
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(20px)',
          borderRadius: 3, overflow: 'hidden'
        }}>
          {/* Red top bar */}
          <Box sx={{ height: 4, background: 'linear-gradient(90deg, #B71C1C, #EF5350, #B71C1C)' }} />

          <CardContent sx={{ p: 4 }}>
            {/* Mobile logo */}
            <Box sx={{ display: { md: 'none' }, textAlign: 'center', mb: 3 }}>
              <Typography variant="h5" sx={{ color: 'primary.main', fontFamily: '"Playfair Display", serif' }}>
                GEE Plateforme
              </Typography>
            </Box>

            <Typography variant="h5" sx={{
              color: 'primary.main', fontWeight: 700,
              mb: 0.5, fontFamily: '"Playfair Display", serif'
            }}>
              {t('login.title')}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
              {t('login.subtitle')}
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>
            )}

            <Box component="form" onSubmit={handleSubmit}>
              <TextField
                fullWidth name="email" type="email"
                label={t('login.email')}
                value={form.email} onChange={handleChange}
                required autoFocus sx={{ mb: 2 }}
              />
              <TextField
                fullWidth name="password"
                type={showPass ? 'text' : 'password'}
                label={t('login.password')}
                value={form.password} onChange={handleChange}
                required
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPass(p => !p)} size="small">
                        {showPass ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
                sx={{ mb: 3 }}
              />
              <Button
                type="submit" variant="contained" fullWidth
                size="large" disabled={loading}
                sx={{ py: 1.5, fontSize: '1rem' }}
              >
                {loading
                  ? <CircularProgress size={22} color="inherit" />
                  : t('login.submit')
                }
              </Button>
            </Box>

            <Divider sx={{ my: 3 }} />

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Language fontSize="small" sx={{ color: 'text.secondary' }} />
              <Select
                size="small" value={i18n.language}
                onChange={e => changeLang(e.target.value)}
                variant="standard" disableUnderline
                sx={{ fontSize: '0.85rem', color: 'text.secondary' }}
              >
                <MenuItem value="fr">Français</MenuItem>
                <MenuItem value="en">English</MenuItem>
                <MenuItem value="ar">العربية</MenuItem>
              </Select>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}