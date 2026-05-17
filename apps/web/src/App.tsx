import React, { useState, Suspense } from 'react';
import reactLogo from './assets/react.svg';
import viteLogo from './assets/vite.svg';
import heroImg from './assets/hero.png';
import './App.css';

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

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: '#0A192F', color: 'white', position: 'sticky', top: 0, zIndex: 100 }}>
        <div>
           <button onClick={() => setRoute('home')} style={{ marginRight: '1rem', background: 'transparent', color: 'white', border: 'none', cursor: 'pointer' }}>Home</button>
           <button onClick={() => setRoute('alerts')} style={{ marginRight: '1rem', background: 'transparent', color: 'white', border: 'none', cursor: 'pointer' }}>Alerts</button>
           <button onClick={() => setRoute('admin')} style={{ marginRight: '1rem', background: 'transparent', color: 'white', border: 'none', cursor: 'pointer' }}>Admin (Super Admin)</button>
           <button onClick={() => setRoute('users')} style={{ background: 'transparent', color: 'white', border: 'none', cursor: 'pointer' }}>Users (Manage)</button>
        </div>
        <Suspense fallback={<div>Loading bell...</div>}>
          <NotificationBell />
        </Suspense>
      </header>

      {route === 'home' && (
          <div style={{ padding: '2rem' }}>
              <h1>Home</h1>
              <div className="hero">
                <img src={heroImg} className="base" width="170" height="179" alt="" />
                <img src={reactLogo} className="framework" alt="React logo" />
                <img src={viteLogo} className="vite" alt="Vite logo" />
              </div>
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
