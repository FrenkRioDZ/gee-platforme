import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Card, Typography, TextField, Button,
  Grid, Divider, Alert, CircularProgress,
  Select, MenuItem, FormControl, InputLabel, Avatar
} from '@mui/material';
import { Save, Lock } from '@mui/icons-material';
import Layout from '../components/layout/Layout';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS } from '../utils/roles';

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { user, updateUser } = useAuth();

  const [profileForm, setProfileForm] = useState({
    firstName: user?.firstName || '',
    lastName:  user?.lastName  || '',
    language:  user?.language  || i18n.language
  });
  const [passForm, setPassForm] = useState({
    currentPassword: '', newPassword: '', confirmPassword: ''
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [passSaving,    setPassSaving]    = useState(false);
  const [profileMsg,    setProfileMsg]    = useState({ type:'', text:'' });
  const [passMsg,       setPassMsg]       = useState({ type:'', text:'' });

  const initials = `${user?.firstName?.[0]||''}${user?.lastName?.[0]||''}`.toUpperCase();

  const handleProfileSave = async () => {
    setProfileSaving(true); setProfileMsg({ type:'', text:'' });
    try {
      const { data } = await api.put(`/users/${user._id}`, {
        firstName: profileForm.firstName,
        lastName:  profileForm.lastName,
        language:  profileForm.language
      });
      updateUser({ firstName: profileForm.firstName, lastName: profileForm.lastName });
      i18n.changeLanguage(profileForm.language);
      localStorage.setItem('lang', profileForm.language);
      document.dir = profileForm.language === 'ar' ? 'rtl' : 'ltr';
      setProfileMsg({ type:'success', text:'Profil mis à jour avec succès' });
    } catch (err) {
      setProfileMsg({ type:'error', text: err.response?.data?.message || t('common.error') });
    } finally { setProfileSaving(false); }
  };

  const handlePassSave = async () => {
    if (!passForm.currentPassword || !passForm.newPassword) {
      setPassMsg({ type:'error', text:'Tous les champs sont obligatoires' }); return;
    }
    if (passForm.newPassword.length < 8) {
      setPassMsg({ type:'error', text:'Le nouveau mot de passe doit contenir au moins 8 caractères' }); return;
    }
    if (passForm.newPassword !== passForm.confirmPassword) {
      setPassMsg({ type:'error', text:'Les mots de passe ne correspondent pas' }); return;
    }
    setPassSaving(true); setPassMsg({ type:'', text:'' });
    try {
      await api.put('/auth/change-password', {
        currentPassword: passForm.currentPassword,
        newPassword:     passForm.newPassword
      });
      setPassMsg({ type:'success', text:'Mot de passe modifié avec succès' });
      setPassForm({ currentPassword:'', newPassword:'', confirmPassword:'' });
    } catch (err) {
      setPassMsg({ type:'error', text: err.response?.data?.message || t('common.error') });
    } finally { setPassSaving(false); }
  };

  return (
    <Layout pageTitle={t('nav.settings')}>
      <Box sx={{ maxWidth:720, mx:'auto' }}>
        <Typography variant="h4" sx={{ fontFamily:'"Playfair Display", serif', color:'primary.main', mb:3 }}>
          {t('nav.settings')}
        </Typography>

        {/* Profile card */}
        <Card sx={{ p:3, mb:3 }}>
          {/* User info banner */}
          <Box sx={{ display:'flex', alignItems:'center', gap:2.5, mb:3,
            p:2, borderRadius:2, background:'rgba(13,59,110,0.04)',
            border:'1px solid rgba(13,59,110,0.08)' }}>
            <Avatar sx={{ width:56, height:56, fontSize:'1.2rem', fontWeight:700,
              background:'linear-gradient(135deg, #0D3B6E, #1565C0)' }}>
              {initials}
            </Avatar>
            <Box>
              <Typography fontWeight={700} fontSize="1rem" color="primary.main">
                {user?.firstName} {user?.lastName}
              </Typography>
              <Typography fontSize="0.8rem" color="text.secondary">{user?.email}</Typography>
              <Typography fontSize="0.75rem" color="secondary.main" fontWeight={600} mt={0.3}>
                {ROLE_LABELS[user?.role]}
              </Typography>
              {user?.bureau && (
                <Typography fontSize="0.72rem" color="text.disabled">{user.bureau.name}</Typography>
              )}
            </Box>
          </Box>

          <Typography fontWeight={700} color="primary.main" mb={2}>
            Informations personnelles
          </Typography>

          {profileMsg.text && (
            <Alert severity={profileMsg.type} sx={{ mb:2 }} onClose={() => setProfileMsg({ type:'', text:'' })}>
              {profileMsg.text}
            </Alert>
          )}

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Prénom" value={profileForm.firstName}
                onChange={e => setProfileForm(p => ({ ...p, firstName:e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Nom" value={profileForm.lastName}
                onChange={e => setProfileForm(p => ({ ...p, lastName:e.target.value }))} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Email" value={user?.email || ''} disabled
                helperText="L'email ne peut pas être modifié" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Langue d'interface</InputLabel>
                <Select value={profileForm.language} label="Langue d'interface"
                  onChange={e => setProfileForm(p => ({ ...p, language:e.target.value }))}>
                  <MenuItem value="fr">Français</MenuItem>
                  <MenuItem value="en">English</MenuItem>
                  <MenuItem value="ar">العربية</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Divider sx={{ my:2.5 }} />
          <Box sx={{ display:'flex', justifyContent:'flex-end' }}>
            <Button variant="contained" startIcon={<Save />}
              onClick={handleProfileSave} disabled={profileSaving}>
              {profileSaving ? <CircularProgress size={18} color="inherit" /> : 'Enregistrer'}
            </Button>
          </Box>
        </Card>

        {/* Password card */}
        <Card sx={{ p:3 }}>
          <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:2 }}>
            <Lock color="primary" />
            <Typography fontWeight={700} color="primary.main">Changer le mot de passe</Typography>
          </Box>

          {passMsg.text && (
            <Alert severity={passMsg.type} sx={{ mb:2 }} onClose={() => setPassMsg({ type:'', text:'' })}>
              {passMsg.text}
            </Alert>
          )}

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField fullWidth label="Mot de passe actuel" type="password"
                value={passForm.currentPassword}
                onChange={e => setPassForm(p => ({ ...p, currentPassword:e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Nouveau mot de passe" type="password"
                value={passForm.newPassword}
                onChange={e => setPassForm(p => ({ ...p, newPassword:e.target.value }))}
                helperText="Minimum 8 caractères" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Confirmer le nouveau mot de passe" type="password"
                value={passForm.confirmPassword}
                onChange={e => setPassForm(p => ({ ...p, confirmPassword:e.target.value }))}
                error={!!passForm.confirmPassword && passForm.newPassword !== passForm.confirmPassword}
                helperText={passForm.confirmPassword && passForm.newPassword !== passForm.confirmPassword ? 'Ne correspond pas' : ''} />
            </Grid>
          </Grid>

          <Divider sx={{ my:2.5 }} />
          <Box sx={{ display:'flex', justifyContent:'flex-end' }}>
            <Button variant="contained" color="warning" startIcon={<Lock />}
              onClick={handlePassSave} disabled={passSaving}>
              {passSaving ? <CircularProgress size={18} color="inherit" /> : 'Changer le mot de passe'}
            </Button>
          </Box>
        </Card>
      </Box>
    </Layout>
  );
}
