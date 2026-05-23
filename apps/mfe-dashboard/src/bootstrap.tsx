import React from 'react';
import { createRoot } from 'react-dom/client';
import Dashboard from './pages/Dashboard';

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<Dashboard />);
}
