import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import Alerts from './components/Alerts';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<Alerts />);
}
