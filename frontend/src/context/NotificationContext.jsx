import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import api from '../utils/api';

const NotificationContext = createContext(null);
const SOCKET_URL = import.meta.env.DEV ? 'http://localhost:5000' : '/';

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const socketRef = useRef(null);

  // Load notifications on login
  useEffect(() => {
    if (!user) { setNotifications([]); setUnreadCount(0); return; }
    fetchNotifications();
    connectSocket();
    return () => { socketRef.current?.disconnect(); socketRef.current = null; };
  }, [user]);

  const fetchNotifications = async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch { }
  };

  const connectSocket = () => {
    // auth as a function so every reconnect sends the current (refreshed) access token
    socketRef.current = io(SOCKET_URL, {
      withCredentials: true,
      auth: (cb) => cb({ token: localStorage.getItem('accessToken') })
    });
    // A rejected handshake (e.g. expired token) is not retried automatically —
    // retry shortly, by which time api.js will usually have refreshed the token
    const socket = socketRef.current;
    socket.on('connect_error', () => {
      if (socket.active) return; // network error — socket.io retries on its own
      setTimeout(() => { if (socketRef.current === socket) socket.connect(); }, 5000);
    });
    socketRef.current.on('notification', (notif) => {
      setNotifications(prev => [notif, ...prev]);
      setUnreadCount(prev => prev + 1);
    });
    socketRef.current.on('report:updated', (payload) => {
      window.dispatchEvent(new CustomEvent('gee:report-updated', { detail: payload }));
    });
  };

  const markAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => n._id === id ? { ...n, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/mark-all-read');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch { }
  };

  return (
    <NotificationContext.Provider value={{
      notifications, unreadCount,
      fetchNotifications, markAsRead, markAllAsRead
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
