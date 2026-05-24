import React, { useState, Suspense } from 'react';
import './App.css';
import { Login } from './components/Login';
import BulkOrderPage from './components/BulkOrderPage';
import DashboardPage from './components/DashboardPage';
import SecuritiesPage from './components/SecuritiesPage';
import UsersPage from './components/UsersPage';
import { MfeErrorBoundary } from './components/MfeErrorBoundary';

// Wraps React.lazy so a failed remote (RUNTIME-008 / network error) resolves to
// a null component instead of rejecting the promise and crashing the whole app.
function safeLazy<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return React.lazy(() =>
    factory().catch(() => ({ default: (() => null) as unknown as T }))
  );
}

// @ts-ignore
const NotificationBell = safeLazy(() => import('mfe_alerts/NotificationBell'));
// @ts-ignore
const Alerts = safeLazy(() => import('mfe_alerts/Alerts'));
// @ts-ignore
const SuperAdmin = safeLazy(() => import('mfe_super_admin/SuperAdmin'));

function App() {
  const [route, setRoute] = useState('home');

  if (route === 'home') {
    return (
      <div className="dark flex flex-col min-h-screen font-body-md text-on-background selection:bg-primary-container selection:text-on-primary-container">
        {/* TopAppBar Component */}
        <header className="bg-slate-950 flex justify-between items-center px-6 h-14 w-full docked full-width top-0 border-b border-slate-800 transition-colors duration-150">
          <img src="/ASCEND.png" alt="Ascend Wealth Management" style={{ height: '38px', width: '38px', borderRadius: '8px', objectFit: 'cover' }} />
          <div className="flex items-center gap-4">
            <span className="material-symbols-outlined text-slate-400 hover:text-white cursor-pointer transition-colors" data-icon="help">help</span>
            <span className="material-symbols-outlined text-slate-400 hover:text-white cursor-pointer transition-colors" data-icon="security">security</span>
          </div>
        </header>

        {/* Auth Canvas */}
        <main className="flex-grow flex items-center justify-center px-6 py-12 relative overflow-hidden">
          {/* Abstract Background Texture */}
          <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary-container rounded-full blur-[120px] -translate-y-1/2 translate-x-1/4"></div>
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-on-primary-fixed-variant rounded-full blur-[100px] translate-y-1/3 -translate-x-1/4"></div>
          </div>

          <div className="w-full max-w-md z-10 flex flex-col items-center">
            <img
              src="/ASCEND.png"
              alt="Ascend Wealth Management"
              style={{ height: '140px', width: '140px', borderRadius: '20px', objectFit: 'cover', marginBottom: '2rem', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
            />
            <Login onLogin={() => setRoute('dashboard')} />
          </div>
        </main>

        {/* Footer Component */}
        <footer className="bg-slate-950 flex flex-col md:flex-row justify-between items-center px-6 py-4 w-full gap-4 docked full-width bottom-0 border-t border-slate-800 transition-opacity duration-200">
          <div className="font-inter uppercase tracking-wider text-[10px] text-slate-500">
            © 2025 ASCEND WEALTH MANAGEMENT. ALL RIGHTS RESERVED.
          </div>
          <nav className="flex gap-6">
            <a className="font-inter uppercase tracking-wider text-[10px] text-slate-500 hover:text-blue-400 transition-colors" href="#">Privacy Policy</a>
            <a className="font-inter uppercase tracking-wider text-[10px] text-slate-500 hover:text-blue-400 transition-colors" href="#">Terms of Service</a>
            <a className="font-inter uppercase tracking-wider text-[10px] text-slate-500 hover:text-blue-400 transition-colors" href="#">Risk Disclosure</a>
            <a className="font-inter uppercase tracking-wider text-[10px] text-slate-500 hover:text-blue-400 transition-colors" href="#">Contact Support</a>
          </nav>
        </footer>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        {/* Vertical sidebar nav */}
        <nav style={{ width: '180px', background: '#0A192F', color: 'white', display: 'flex', flexDirection: 'column', padding: '1.5rem 0', flexShrink: 0, borderRight: '1px solid #1e3a5f', position: 'sticky', top: 0, height: '100vh', overflowY: 'auto', zIndex: 100 }}>
          <div style={{ padding: '0.75rem 1rem 1.25rem', borderBottom: '1px solid #1e3a5f', marginBottom: '0.5rem' }}>
            <img
              src="/ASCEND.png"
              alt="Ascend Wealth Management"
              style={{ width: '100%', height: 'auto', borderRadius: '10px', display: 'block' }}
            />
          </div>
          {[
            { label: 'Dashboard',   route: 'dashboard'   },
            { label: 'Orders',      route: 'orders'      },
            { label: 'Securities',  route: 'securities'  },
            { label: 'Alerts',      route: 'alerts'      },
            { label: 'Super Admin', route: 'admin'       },
            { label: 'Users',       route: 'users'       },
          ].map(({ label, route: r }) => (
            <button
              key={r}
              onClick={() => setRoute(r)}
              style={{
                background: route === r ? '#1e3a5f' : 'transparent',
                color: route === r ? '#fff' : '#94a3b8',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                padding: '0.65rem 1rem',
                fontSize: '14px',
                fontWeight: route === r ? 600 : 400,
                borderLeft: route === r ? '3px solid #3b82f6' : '3px solid transparent',
                transition: 'all 0.15s',
              }}
            >{label}</button>
          ))}
          <div style={{ marginTop: 'auto', padding: '1rem', borderTop: '1px solid #1e3a5f' }}>
            <button
              onClick={() => setRoute('home')}
              style={{ background: 'transparent', color: '#64748b', border: 'none', cursor: 'pointer', fontSize: '14px', padding: 0 }}
            >Log Out</button>
          </div>
          <div style={{ padding: '0 1rem 1rem' }}>
            <MfeErrorBoundary name="mfe_alerts">
              <Suspense fallback={null}>
                <NotificationBell />
              </Suspense>
            </MfeErrorBoundary>
          </div>
        </nav>

        {/* Page content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>

      {route === 'dashboard'  && <DashboardPage />}

      {route === 'orders'     && <BulkOrderPage />}

      {route === 'securities' && <SecuritiesPage />}

      {route === 'alerts' && (
          <div style={{ padding: '2rem' }}>
              <MfeErrorBoundary name="mfe_alerts" fallback={<div style={{ padding: '2rem', color: '#94a3b8' }}>Alerts service unavailable.</div>}>
                <Suspense fallback={<div>Loading alerts...</div>}>
                  <Alerts />
                </Suspense>
              </MfeErrorBoundary>
          </div>
      )}

      {route === 'admin' && (
          <MfeErrorBoundary name="mfe_super_admin" fallback={<div style={{ padding: '2rem', color: '#94a3b8' }}>Super Admin service unavailable.</div>}>
            <Suspense fallback={<div>Loading Super Admin...</div>}>
               <SuperAdmin />
            </Suspense>
          </MfeErrorBoundary>
      )}

      {route === 'users' && <UsersPage />}
        </div>
    </div>
  );
}

export default App;
