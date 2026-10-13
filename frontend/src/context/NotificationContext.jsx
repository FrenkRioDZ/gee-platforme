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
    return () => socketRef.current?.disconnect();
  }, [user]);

  const fetchNotifications = async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch { }
  };

  const connectSocket = () => {
    socketRef.current = io(SOCKET_URL, { withCredentials: true });
    socketRef.current.emit('register', user._id);
    socketRef.current.on('notification', (notif) => {
      setNotifications(prev => [notif, ...prev]);
      setUnreadCount(prev => prev + 1);
    });
    socketRef.current.on('report:updated', (payload) => {
      console.log('[socket] report:updated received', payload);
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
