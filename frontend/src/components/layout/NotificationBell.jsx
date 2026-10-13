import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IconButton, Badge, Popover, Box, Typography,
  List, ListItem, ListItemText, Divider, Button, Chip
} from '@mui/material';
import { Notifications, NotificationsNone, DoneAll, Circle } from '@mui/icons-material';
import { useNotifications } from '../../context/NotificationContext';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const TYPE_COLORS = {
  report_submitted: '#1565C0',
  report_accepted: '#2E7D32',
  report_rejected: '#C62828',
  report_reminder: '#E65100',
  report_late: '#C62828',
  observation_added: '#6A1B9A',
  permission_granted: '#1B5E20',
  permission_revoked: '#B71C1C',
  report_missing:   '#B71C1C',
};

export default function NotificationBell() {
  const { t } = useTranslation();
  const ctx = useNotifications();
  const notifications = ctx?.notifications || [];
  const unreadCount = ctx?.unreadCount || 0;
  const { markAsRead, markAllAsRead } = ctx || {};
  const [anchor, setAnchor] = useState(null);

  const open = Boolean(anchor);

  const handleOpen = e => setAnchor(e.currentTarget);
  const handleClose = () => setAnchor(null);

  const handleClick = async (notif) => {
    if (!notif.isRead) await markAsRead(notif._id);
  };

  return (
    <>
      <IconButton onClick={handleOpen} size="small" sx={{ color: 'inherit' }}>
        <Badge badgeContent={unreadCount} color="error" max={99}>
          {unreadCount > 0
            ? <Notifications />
            : <NotificationsNone />
          }
        </Badge>
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchor}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: {
            width: 380, maxHeight: 520,
            borderRadius: 2, overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)'
          }
        }}
      >
        {/* Header */}
        <Box sx={{
          px: 2.5, py: 2,
          background: 'linear-gradient(135deg, #0D3B6E, #1565C0)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem' }}>
              {t('notifications.title')}
            </Typography>
            {unreadCount > 0 && (
              <Chip
                label={unreadCount}
                size="small"
                sx={{
                  background: '#C8963E', color: '#fff',
                  height: 20, fontSize: '0.7rem', fontWeight: 700
                }}
              />
            )}
          </Box>
          {unreadCount > 0 && (
            <Button
              size="small" startIcon={<DoneAll fontSize="small" />}
              onClick={markAllAsRead}
              sx={{
                color: 'rgba(255,255,255,0.8)', fontSize: '0.75rem',
                '&:hover': { color: '#fff' }
              }}
            >
              {t('notifications.mark_all_read')}
            </Button>
          )}
        </Box>

        {/* Notification list */}
        <Box sx={{ overflowY: 'auto', maxHeight: 420 }}>
          {notifications.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <NotificationsNone sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography color="text.secondary" fontSize="0.875rem">
                {t('notifications.no_notifications')}
              </Typography>
            </Box>
          ) : (
            <List disablePadding>
              {notifications.map((notif, idx) => (
                <Box key={notif._id || idx}>
                  <ListItem
                    onClick={() => handleClick(notif)}
                    sx={{
                      px: 2.5, py: 1.5, cursor: 'pointer',
                      background: notif.isRead ? 'transparent' : 'rgba(13,59,110,0.04)',
                      '&:hover': { background: 'rgba(13,59,110,0.06)' },
                      alignItems: 'flex-start', gap: 1.5
                    }}
                  >
                    {/* Color dot */}
                    <Box sx={{ pt: 0.5, flexShrink: 0 }}>
                      <Circle sx={{
                        fontSize: 8,
                        color: notif.isRead
                          ? 'transparent'
                          : (TYPE_COLORS[notif.type] || '#0D3B6E')
                      }} />
                    </Box>

                    <ListItemText
                      primary={
                        <Typography sx={{
                          fontSize: '0.825rem', fontWeight: notif.isRead ? 400 : 600,
                          color: 'text.primary', lineHeight: 1.4
                        }}>
                          {notif.title}
                        </Typography>
                      }
                      secondary={
                        <Box>
                          <Typography sx={{
                            fontSize: '0.775rem', color: 'text.secondary',
                            lineHeight: 1.4, mt: 0.3
                          }}>
                            {notif.message}
                          </Typography>
                          <Typography sx={{
                            fontSize: '0.7rem', color: 'text.disabled', mt: 0.5
                          }}>
                            {notif.createdAt
                              ? formatDistanceToNow(new Date(notif.createdAt), {
                                addSuffix: true, locale: fr
                              })
                              : ''}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                  {idx < notifications.length - 1 && (
                    <Divider sx={{ mx: 2.5 }} />
                  )}
                </Box>
              ))}
            </List>
          )}
        </Box>
      </Popover>
    </>
  );
}
