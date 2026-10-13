import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box, List, ListItem, ListItemButton, ListItemIcon,
  ListItemText, Typography, Divider, Tooltip, IconButton
} from '@mui/material';
import {
  Dashboard, Assessment, FolderSpecial, People,
  Business, Settings, Logout, ChevronLeft,
  ChevronRight, AccountCircle, GridView
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { isGEE, ROLE_LABELS, canManageUsers, canManageProjects } from '../../utils/roles';

const SIDEBAR_WIDTH = 260;
const SIDEBAR_WIDTH_MINI = 68;

export default function Sidebar({ collapsed, onToggle }) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const gee = isGEE(user?.role);

  // Build nav items based on role
  const navItems = [
    {
      label: t('nav.dashboard'),
      icon: <Dashboard />,
      path: gee ? '/dashboard/gee' : '/dashboard/bureau',
      show: true
    },
    {
      label: t('nav.reports'),
      icon: <Assessment />,
      path: '/reports/weekly',
      show: true
    },
    {
      label: t('nav.projects'),
      icon: <FolderSpecial />,
      path: '/projects',
      show: true
    },
    {
      label: 'Canvas Rapports',
      icon: <GridView />,
      path: '/canvas-manager',
      show: user?.role === 'gee_super_admin'
    },
    {
      label: t('nav.users'),
      icon: <People />,
      path: '/users',
      show: canManageUsers(user?.role)
    },
    {
      label: t('nav.bureaus'),
      icon: <Business />,
      path: '/bureaus',
      show: gee
    },
    {
      label: t('nav.settings'),
      icon: <Settings />,
      path: '/settings',
      show: true
    }
  ].filter(item => item.show);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = path => location.pathname.startsWith(path);

  return (
    <Box sx={{
      width: collapsed ? SIDEBAR_WIDTH_MINI : SIDEBAR_WIDTH,
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #1B5E20 0%, #0a3d0a 100%)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.25s ease',
      overflow: 'hidden',
      flexShrink: 0,
      position: 'relative',
      boxShadow: '4px 0 20px rgba(0,0,0,0.15)'
    }}>

      {/* Gold top accent */}
      <Box sx={{ height: 3, background: 'linear-gradient(90deg, #B71C1C, #EF5350, #B71C1C)' }} />

      {/* Logo / Brand */}
      <Box sx={{
        px: collapsed ? 1 : 3, py: 2.5,
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        minHeight: 72
      }}>
        {!collapsed && (
          <Box>
            <Typography sx={{
              color: '#fff', fontWeight: 700, fontSize: '1.1rem',
              fontFamily: '"Playfair Display", serif', lineHeight: 1
            }}>
              GEE
            </Typography>
            <Typography sx={{
              color: 'rgba(200,150,62,0.9)', fontSize: '0.65rem',
              letterSpacing: 2, textTransform: 'uppercase', mt: 0.3
            }}>
              Plateforme
            </Typography>
          </Box>
        )}
        {collapsed && (
          <Typography sx={{
            color: '#C8963E', fontWeight: 700, fontSize: '1rem',
            fontFamily: '"Playfair Display", serif'
          }}>G</Typography>
        )}
        <IconButton onClick={onToggle} size="small" sx={{
          color: 'rgba(255,255,255,0.5)',
          '&:hover': { color: '#fff', background: 'rgba(255,255,255,0.08)' }
        }}>
          {collapsed ? <ChevronRight fontSize="small" /> : <ChevronLeft fontSize="small" />}
        </IconButton>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

      {/* User info */}
      {!collapsed && (
        <Box sx={{ px: 3, py: 2 }}>
          <Box sx={{
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 2, px: 2, py: 1.5,
            border: '1px solid rgba(255,255,255,0.08)'
          }}>
            <Typography sx={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.3 }}>
              {user?.firstName} {user?.lastName}
            </Typography>
            <Typography sx={{ color: 'rgba(200,150,62,0.8)', fontSize: '0.7rem', mt: 0.3 }}>
              {ROLE_LABELS[user?.role]}
            </Typography>
            {user?.bureau && (
              <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem', mt: 0.2 }}>
                {user.bureau.name}
              </Typography>
            )}
          </Box>
        </Box>
      )}

      {/* Nav items */}
      <List sx={{ px: collapsed ? 0.5 : 1.5, flex: 1, pt: 1 }}>
        {navItems.map(item => {
          const active = isActive(item.path);
          return (
            <Tooltip
              key={item.path}
              title={collapsed ? item.label : ''}
              placement="right"
            >
              <ListItem disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  onClick={() => navigate(item.path)}
                  sx={{
                    borderRadius: 2,
                    px: collapsed ? 1.5 : 2,
                    py: 1.2,
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    background: active
                      ? 'linear-gradient(135deg, rgba(198,40,40,0.25), rgba(198,40,40,0.1))'
                      : 'transparent',
                    border: active
                      ? '1px solid rgba(198,40,40,0.3)'
                      : '1px solid transparent',
                    '&:hover': {
                      background: active
                        ? 'linear-gradient(135deg, rgba(198,40,40,0.3), rgba(198,40,40,0.15))'
                        : 'rgba(255,255,255,0.06)'
                    }
                  }}
                >
                  <ListItemIcon sx={{
                    color: active ? '#EF5350' : 'rgba(255,255,255,0.55)',
                    minWidth: collapsed ? 0 : 38,
                    justifyContent: 'center'
                  }}>
                    {item.icon}
                  </ListItemIcon>
                  {!collapsed && (
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{
                        fontSize: '0.875rem',
                        fontWeight: active ? 600 : 400,
                        color: active ? '#fff' : 'rgba(255,255,255,0.7)'
                      }}
                    />
                  )}
                  {/* Active indicator bar */}
                  {active && !collapsed && (
                    <Box sx={{
                      width: 3, height: 20, borderRadius: 2,
                      background: '#EF5350', ml: 1
                    }} />
                  )}
                </ListItemButton>
              </ListItem>
            </Tooltip>
          );
        })}
      </List>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

      {/* Logout */}
      <List sx={{ px: collapsed ? 0.5 : 1.5, py: 1 }}>
        <Tooltip title={collapsed ? t('nav.logout') : ''} placement="right">
          <ListItem disablePadding>
            <ListItemButton
              onClick={handleLogout}
              sx={{
                borderRadius: 2, px: collapsed ? 1.5 : 2, py: 1.2,
                justifyContent: collapsed ? 'center' : 'flex-start',
                '&:hover': { background: 'rgba(220,53,69,0.15)' }
              }}
            >
              <ListItemIcon sx={{
                color: 'rgba(255,100,100,0.7)',
                minWidth: collapsed ? 0 : 38,
                justifyContent: 'center'
              }}>
                <Logout />
              </ListItemIcon>
              {!collapsed && (
                <ListItemText
                  primary={t('nav.logout')}
                  primaryTypographyProps={{
                    fontSize: '0.875rem',
                    color: 'rgba(255,150,150,0.8)'
                  }}
                />
              )}
            </ListItemButton>
          </ListItem>
        </Tooltip>
      </List>
    </Box>
  );
}
