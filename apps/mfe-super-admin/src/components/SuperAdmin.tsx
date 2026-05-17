import React, { useState, useEffect } from 'react';
import '../index.css';
import { UsersTable } from './UsersTable';
import { NewAdminForm } from './NewAdminForm';
import { SettingsEditor } from './SettingsEditor';
import { AuditLogViewer } from './AuditLogViewer';

const SuperAdmin = () => {
    const [activeTab, setActiveTab] = useState('health');

    return (
        <div className="bg-background text-on-surface antialiased min-h-screen">
            <div className="flex h-screen overflow-hidden">
                <aside className="w-64 bg-surface-container border-r border-outline-variant flex flex-col pt-12 z-40 relative">
                    <nav className="flex-1 px-4 py-6 space-y-1">
                        <button onClick={() => setActiveTab('health')} className={`w-full flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors ${activeTab === 'health' ? 'bg-secondary-container/20 text-secondary-fixed' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}`}>
                            Health
                        </button>
                        <button onClick={() => setActiveTab('users')} className={`w-full flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors ${activeTab === 'users' ? 'bg-secondary-container/20 text-secondary-fixed' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}`}>
                            All Users
                        </button>
                        <button onClick={() => setActiveTab('admins')} className={`w-full flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors ${activeTab === 'admins' ? 'bg-secondary-container/20 text-secondary-fixed' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}`}>
                            Admins
                        </button>
                        <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors ${activeTab === 'settings' ? 'bg-secondary-container/20 text-secondary-fixed' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}`}>
                            Settings
                        </button>
                        <button onClick={() => setActiveTab('audit')} className={`w-full flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors ${activeTab === 'audit' ? 'bg-secondary-container/20 text-secondary-fixed' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}`}>
                            Audit Logs
                        </button>
                    </nav>
                </aside>

                <main className="flex-1 overflow-y-auto bg-surface pt-12 pb-16 px-gutter relative z-0">
                    <div className="max-w-[1600px] mx-auto py-6 space-y-8">
                        {activeTab === 'health' && <HealthTab />}
                        {activeTab === 'users' && <UsersTab />}
                        {activeTab === 'admins' && <AdminsTab />}
                        {activeTab === 'settings' && <SettingsEditor />}
                        {activeTab === 'audit' && <AuditLogViewer />}
                    </div>
                </main>
            </div>
        </div>
    );
};

const HealthTab = () => {
    const [healthData, setHealthData] = useState<any[]>([]);

    useEffect(() => {
        const fetchHealth = async () => {
            try {
                const mockData = [
                    { name: 'Auth', status: 'UP', latency_ms: Math.floor(Math.random() * 20) + 10 },
                    { name: 'User', status: 'UP', latency_ms: Math.floor(Math.random() * 30) + 10 },
                    { name: 'Dashboard', status: 'UP', latency_ms: Math.floor(Math.random() * 25) + 10 },
                    { name: 'Order', status: 'UP', latency_ms: Math.floor(Math.random() * 40) + 10 },
                    { name: 'Portfolio', status: 'UP', latency_ms: Math.floor(Math.random() * 35) + 10 },
                    { name: 'Alerts', status: 'UP', latency_ms: Math.floor(Math.random() * 20) + 10 },
                ];
                setHealthData(mockData);
            } catch (error) {
                console.error("Failed to fetch health data", error);
            }
        };

        fetchHealth();
        const interval = setInterval(fetchHealth, 30000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="font-display-lg text-display-lg font-bold text-on-surface tracking-tight mb-2">System Health</h1>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">Live metrics and service status</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-surface-container border border-outline-variant px-4 py-4 rounded-lg flex flex-col">
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">Active Users</span>
                    <span className="font-data-mono text-display-lg text-secondary-fixed">1,204</span>
                </div>
                <div className="bg-surface-container border border-outline-variant px-4 py-4 rounded-lg flex flex-col">
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">Open Orders</span>
                    <span className="font-data-mono text-display-lg text-primary-fixed">842</span>
                </div>
                <div className="bg-surface-container border border-outline-variant px-4 py-4 rounded-lg flex flex-col">
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">Active Alerts</span>
                    <span className="font-data-mono text-display-lg text-tertiary-fixed">3,491</span>
                </div>
            </div>

            <div className="bg-surface-container border border-outline-variant rounded-lg overflow-hidden">
                <div className="bg-surface-container-high px-4 py-2 border-b border-outline-variant flex justify-between items-center">
                    <span className="font-label-caps text-label-caps uppercase">Service Health Status</span>
                    <span className="text-[10px] text-on-surface-variant italic">Live Refresh: 30s</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3">
                    {healthData.map((service, index) => (
                        <div key={index} className={`p-4 border-b border-outline-variant flex flex-col gap-2 hover:bg-surface-container-low transition-colors ${index % 3 !== 2 ? 'md:border-r' : ''}`}>
                            <div className="flex justify-between items-center">
                                <span className="font-body-md text-body-md font-bold text-on-surface">{service.name}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${service.status === 'UP' ? 'bg-secondary-container/20 text-secondary-fixed border-secondary-container/30' : 'bg-error-container/20 text-error border-error-container/30'}`}>
                                    {service.status}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[11px] text-on-surface-variant uppercase">Latency</span>
                                <span className="font-data-mono text-data-mono text-on-surface">{service.latency_ms}ms</span>
                            </div>
                            <div className="w-full bg-surface-variant h-1 rounded-full overflow-hidden">
                                <div className={`${service.status === 'UP' ? 'bg-secondary-fixed' : 'bg-error'} h-full`} style={{width: `${Math.max(10, 100 - (service.latency_ms / 2))}%`}}></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const UsersTab = () => (
    <div className="space-y-6">
        <div>
            <h1 className="font-display-lg text-display-lg font-bold text-on-surface tracking-tight mb-2">All Users</h1>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Manage all platform users</p>
        </div>
        <UsersTable />
    </div>
);

const AdminsTab = () => (
    <div className="space-y-6">
        <div>
            <h1 className="font-display-lg text-display-lg font-bold text-on-surface tracking-tight mb-2">Administrators</h1>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Manage platform administrators</p>
        </div>
        <NewAdminForm />
        <UsersTable showAdminsOnly={true} />
    </div>
);

export default SuperAdmin;
