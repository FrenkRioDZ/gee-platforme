import { useState } from 'react';
import { Box } from '@mui/material';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import AppFooter from '../ui/AppFooter';

export default function Layout({ children, pageTitle }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', background: '#F4F6FA' }}>
      {/* Sidebar */}
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(p => !p)}
      />

      {/* Main content */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Navbar
          onMenuToggle={() => setCollapsed(p => !p)}
          pageTitle={pageTitle}
        />
        <Box sx={{ flex: 1, p: 3, overflowY: 'auto' }} className="page-enter">
          {children}
        </Box>
        <AppFooter />
      </Box>
    </Box>
  );
}
