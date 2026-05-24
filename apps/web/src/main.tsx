import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Safety net: suppress any MF RUNTIME-008 rejections that slip past the
// runtime plugin (e.g. during the very first virtual-module bootstrap tick).
window.addEventListener('unhandledrejection', (event) => {
  const msg = String((event.reason as any)?.message ?? '');
  if (msg.includes('Federation Runtime') || msg.includes('RUNTIME-')) {
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
