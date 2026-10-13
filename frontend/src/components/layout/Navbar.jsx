import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, IconButton, Select, MenuItem,
  Tooltip, Avatar, Menu, ListItemIcon
} from '@mui/material';
import {
  MenuOpen, Language, Settings, Logout, AccountCircle
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from './NotificationBell';
import { ROLE_LABELS } from '../../utils/roles';

export default function Navbar({ onMenuToggle, pageTitle }) {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [userMenu, setUserMenu] = useState(null);

  const changeLang = lang => {
    i18n.changeLanguage(lang);
    localStorage.setItem('lang', lang);
    document.dir = lang === 'ar' ? 'rtl' : 'ltr';
  };

  const handleLogout = async () => {
    setUserMenu(null);
    await logout();
    navigate('/login');
  };

  // Get initials for avatar
  const initials = user
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase()
    : 'U';

  return (
    <Box sx={{
      height: 64,
      background: '#fff',
      borderBottom: '1px solid rgba(13,59,110,0.08)',
      display: 'flex', alignItems: 'center',
      px: 3, gap: 2,
      boxShadow: '0 1px 4px rgba(13,59,110,0.06)',
      position: 'sticky', top: 0, zIndex: 100
    }}>
      {/* Mobile menu toggle */}
      <IconButton onClick={onMenuToggle} size="small" sx={{
        display: { md: 'none' }, color: 'primary.main'
      }}>
        <MenuOpen />
      </IconButton>

      {/* Page title */}
      <Typography sx={{
        fontFamily: '"Playfair Display", serif',
        fontWeight: 600, fontSize: '1.1rem',
        color: 'primary.main', flex: 1
      }}>
        {pageTitle}
      </Typography>

      {/* Right side */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>

        {/* Language */}
        <Tooltip title="Langue / Language / اللغة">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Language fontSize="small" sx={{ color: 'text.secondary' }} />
            <Select
              value={i18n.language}
              onChange={e => changeLang(e.target.value)}
              variant="standard" disableUnderline size="small"
              sx={{ fontSize: '0.8rem', color: 'text.secondary', minWidth: 40 }}
            >
              <MenuItem value="fr">FR</MenuItem>
              <MenuItem value="en">EN</MenuItem>
              <MenuItem value="ar">ع</MenuItem>
            </Select>
          </Box>
        </Tooltip>

        {/* Notifications */}
        <NotificationBell />

        {/* User avatar */}
        <Tooltip title={`${user?.firstName} ${user?.lastName}`}>
          <Avatar
            onClick={e => setUserMenu(e.currentTarget)}
            sx={{
              width: 36, height: 36, cursor: 'pointer',
              background: 'linear-gradient(135deg, #0D3B6E, #1565C0)',
              fontSize: '0.8rem', fontWeight: 700,
              border: '2px solid rgba(13,59,110,0.15)',
              '&:hover': { borderColor: '#C8963E' },
              transition: 'border-color 0.2s'
            }}
          >
            {initials}
          </Avatar>
        </Tooltip>

        {/* User dropdown menu */}
        <Menu
          anchorEl={userMenu}
          open={Boolean(userMenu)}
          onClose={() => setUserMenu(null)}
          PaperProps={{
            sx: { mt: 1, minWidth: 200, borderRadius: 2,
              boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }
          }}
        >
          {/* User info header */}
          <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="body2" fontWeight={600}>
              {user?.firstName} {user?.lastName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {ROLE_LABELS[user?.role]}
            </Typography>
          </Box>

          <MenuItem onClick={() => { setUserMenu(null); navigate('/settings'); }}>
            <ListItemIcon><Settings fontSize="small" /></ListItemIcon>
            {t('nav.settings')}
          </MenuItem>

          <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
            <ListItemIcon><Logout fontSize="small" color="error" /></ListItemIcon>
            {t('nav.logout')}
          </MenuItem>
        </Menu>
      </Box>
    </Box>
  );
}
