import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { CircularProgress, Box } from '@mui/material';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import theme from './theme';
import './i18n';

import Login from './pages/Login';
import GeeDashboard from './pages/GeeDashboard';
import BureauDashboard from './pages/BureauDashboard';
import WeeklyReports from './pages/WeeklyReports';
import ReportDetail from './pages/ReportDetail';
import Projects from './pages/Projects';
import Users from './pages/Users';
import Bureaus from './pages/Bureaus';
import Settings from './pages/Settings';
import ReportCanvasManager from './pages/ReportCanvasManager';

import { isGEE, canManageUsers } from './utils/roles';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <CircularProgress />
    </Box>
  );
  return user ? children : <Navigate to="/login" replace />;
};

const GEERoute = ({ children }) => {
  const { user } = useAuth(); return (!user || !isGEE(user.role)) ? <Navigate to="/dashboard/bureau" replace /> : children;
};
const BureauRoute = ({ children }) => {
  const { user } = useAuth(); return (!user || isGEE(user.role)) ? <Navigate to="/dashboard/gee" replace /> : children;
};
const AdminRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user || !canManageUsers(user.role)) {
    return <Navigate to={isGEE(user?.role) ? '/dashboard/gee' : '/dashboard/bureau'} replace />;
  }
  return children;
};
const SuperAdminRoute = ({ children }) => {
  const { user } = useAuth(); return (!user || user.role !== 'gee_super_admin') ? <Navigate to="/dashboard/gee" replace /> : children;
};
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to={isGEE(user.role) ? '/dashboard/gee' : '/dashboard/bureau'} replace />;
  return children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/dashboard/gee" element={<ProtectedRoute><GEERoute><GeeDashboard /></GEERoute></ProtectedRoute>} />
      <Route path="/dashboard/bureau" element={<ProtectedRoute><BureauRoute><BureauDashboard /></BureauRoute></ProtectedRoute>} />
      <Route path="/reports/weekly" element={<ProtectedRoute><WeeklyReports /></ProtectedRoute>} />
      <Route path="/reports/weekly/:id" element={<ProtectedRoute><ReportDetail /></ProtectedRoute>} />
      <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute><AdminRoute><Users /></AdminRoute></ProtectedRoute>} />
      <Route path="/bureaus" element={<ProtectedRoute><GEERoute><Bureaus /></GEERoute></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/canvas-manager" element={<ProtectedRoute><SuperAdminRoute><ReportCanvasManager /></SuperAdminRoute></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <AuthProvider>
          <NotificationProvider>
            <AppRoutes />
          </NotificationProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}