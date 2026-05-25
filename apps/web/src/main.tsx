import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Clear stale Module Federation runtime cache from localStorage before the MF
// runtime initialises. The runtime persists remote-entry version metadata and
// module-load state across page loads; when a remote was unreachable in a
// previous session the cached "failed" entry causes RUNTIME-008 on every
// subsequent refresh / new tab, before React even mounts.
//
// We wipe all keys except our own app keys so the runtime always starts clean.
const APP_STORAGE_KEYS = new Set(['ascend_logged_in']);
for (const key of [...Object.keys(localStorage)]) {
  if (!APP_STORAGE_KEYS.has(key)) localStorage.removeItem(key);
}

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
