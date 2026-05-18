import React, { useState, Suspense } from 'react';
import './App.css';
import { Login } from './components/Login';

// Using module federation dynamic imports
// @ts-ignore
const NotificationBell = React.lazy(() => import('mfe_alerts/NotificationBell'));
// @ts-ignore
const Alerts = React.lazy(() => import('mfe_alerts/Alerts'));
// @ts-ignore
const SuperAdmin = React.lazy(() => import('mfe_super_admin/SuperAdmin'));
// @ts-ignore
const UserManagement = React.lazy(() => import('mfe_user_management/UserManagement'));

function App() {
  const [route, setRoute] = useState('home');

  if (route === 'home') {
    return (
      <div className="dark flex flex-col min-h-screen font-body-md text-on-background selection:bg-primary-container selection:text-on-primary-container">
        {/* TopAppBar Component */}
        <header className="bg-slate-950 flex justify-between items-center px-6 h-14 w-full docked full-width top-0 border-b border-slate-800 transition-colors duration-150">
          <div className="font-inter tracking-tight text-lg font-bold tracking-widest text-slate-50 uppercase">
            TERMINAL PRIME
          </div>
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

          <div className="w-full max-w-md z-10">
            <Login onLogin={() => setRoute('dashboard')} />
          </div>
        </main>

        {/* Footer Component */}
        <footer className="bg-slate-950 flex flex-col md:flex-row justify-between items-center px-6 py-4 w-full gap-4 docked full-width bottom-0 border-t border-slate-800 transition-opacity duration-200">
          <div className="font-inter uppercase tracking-wider text-[10px] text-slate-500">
            © 2024 TERMINAL PRIME INC. ALL RIGHTS RESERVED. INSTITUTIONAL GRADE SECURITY.
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
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: '#0A192F', color: 'white', position: 'sticky', top: 0, zIndex: 100 }}>
        <div>
           <button onClick={() => setRoute('home')} style={{ marginRight: '1rem', background: 'transparent', color: 'white', border: 'none', cursor: 'pointer' }}>Log Out</button>
           <button onClick={() => setRoute('alerts')} style={{ marginRight: '1rem', background: 'transparent', color: 'white', border: 'none', cursor: 'pointer' }}>Alerts</button>
           <button onClick={() => setRoute('admin')} style={{ marginRight: '1rem', background: 'transparent', color: 'white', border: 'none', cursor: 'pointer' }}>Admin (Super Admin)</button>
           <button onClick={() => setRoute('users')} style={{ background: 'transparent', color: 'white', border: 'none', cursor: 'pointer' }}>Users (Manage)</button>
        </div>
        <Suspense fallback={<div>Loading bell...</div>}>
          <NotificationBell />
        </Suspense>
      </header>

      {route === 'dashboard' && (
          <div style={{ padding: '2rem' }}>
              <h1>Dashboard (Placeholder)</h1>
          </div>
      )}

      {route === 'alerts' && (
          <div style={{ padding: '2rem' }}>
              <Suspense fallback={<div>Loading alerts...</div>}>
                <Alerts />
              </Suspense>
          </div>
      )}

      {route === 'admin' && (
          <Suspense fallback={<div>Loading Super Admin...</div>}>
             <SuperAdmin />
          </Suspense>
      )}

      {route === 'users' && (
          <Suspense fallback={<div>Loading User Management...</div>}>
             <UserManagement />
          </Suspense>
      )}
    </div>
  );
}

export default App;
