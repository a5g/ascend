import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import UserManagement from './components/UserManagement';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<UserManagement />);
}
