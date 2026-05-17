import React, { useState } from 'react';
import '../index.css';

const UserManagement = () => {
    const [activeTab, setActiveTab] = useState('users');

    return (
        <div className="bg-background text-on-surface antialiased min-h-screen">
            <div className="flex h-screen overflow-hidden">
                <aside className="w-64 bg-surface-container border-r border-outline-variant flex flex-col pt-12 z-40 relative">
                    <nav className="flex-1 px-4 py-6 space-y-1">
                        <button onClick={() => setActiveTab('users')} className={`w-full flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors ${activeTab === 'users' ? 'bg-secondary-container/20 text-secondary-fixed' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}`}>
                            Users
                        </button>
                        <button onClick={() => setActiveTab('onboard')} className={`w-full flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors ${activeTab === 'onboard' ? 'bg-secondary-container/20 text-secondary-fixed' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}`}>
                            Onboard
                        </button>
                        <button onClick={() => setActiveTab('groups')} className={`w-full flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors ${activeTab === 'groups' ? 'bg-secondary-container/20 text-secondary-fixed' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}`}>
                            Groups
                        </button>
                    </nav>
                </aside>

                <main className="flex-1 overflow-y-auto bg-surface pt-12 pb-16 px-gutter relative z-0">
                    <div className="max-w-[1200px] mx-auto py-6 space-y-8">
                        {activeTab === 'users' && <UsersTab />}
                        {activeTab === 'onboard' && <OnboardTab />}
                        {activeTab === 'groups' && <GroupsTab />}
                    </div>
                </main>
            </div>
        </div>
    );
};

const UsersTab = () => {
    const [users, setUsers] = useState([
        { id: 1, name: 'Alice Trader', email: 'alice@example.com', zerodha: 'Connected', groups: ['Pro Traders', 'Options'], active: true },
        { id: 2, name: 'Bob Investor', email: 'bob@example.com', zerodha: 'Disconnected', groups: ['Beginners'], active: true },
        { id: 3, name: 'Charlie Algo', email: 'charlie@example.com', zerodha: 'Connected', groups: ['API Users'], active: false },
    ]);

    const toggleStatus = (id: number) => {
        setUsers(users.map(u => u.id === id ? { ...u, active: !u.active } : u));
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="font-display-lg text-display-lg font-bold text-on-surface tracking-tight mb-2">User Directory</h1>
                <p className="font-body-sm text-body-sm text-on-surface-variant">Manage individual users and access</p>
            </div>

            <div className="bg-surface-container border border-outline-variant rounded-lg overflow-hidden">
                <table className="w-full text-left font-body-sm">
                    <thead className="bg-surface-container-lowest text-on-surface-variant font-label-caps border-b border-outline-variant">
                        <tr>
                            <th className="px-6 py-3 uppercase tracking-wider">Name/Email</th>
                            <th className="px-6 py-3 uppercase tracking-wider">Zerodha Status</th>
                            <th className="px-6 py-3 uppercase tracking-wider">Permission Groups</th>
                            <th className="px-6 py-3 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant">
                        {users.map(user => (
                            <tr key={user.id} className="hover:bg-surface-container-low transition-colors">
                                <td className="px-6 py-4">
                                    <div className="font-bold text-on-surface">{user.name}</div>
                                    <div className="text-on-surface-variant text-xs">{user.email}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold border ${user.zerodha === 'Connected' ? 'bg-secondary-container/20 text-secondary-fixed border-secondary-container/30' : 'bg-surface-variant text-on-surface-variant border-outline-variant'}`}>
                                        {user.zerodha}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-wrap gap-1">
                                        {user.groups.map(g => (
                                            <span key={g} className="px-2 py-0.5 rounded bg-[#1B2A4E] text-primary text-[10px] border border-primary/30">{g}</span>
                                        ))}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <button className="bg-surface text-on-surface px-3 py-1 text-[10px] rounded border border-outline hover:bg-surface-variant">
                                        Assign Groups
                                    </button>
                                    <button
                                        onClick={() => toggleStatus(user.id)}
                                        className={`px-3 py-1 text-[10px] rounded border ${user.active ? 'bg-[#1B2A4E] text-error border-error/30 hover:bg-error/10' : 'bg-[#1B2A4E] text-secondary-fixed border-secondary-fixed/30 hover:bg-secondary-fixed/10'}`}
                                    >
                                        {user.active ? 'Deactivate' : 'Activate'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const OnboardTab = () => {
    const [status, setStatus] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('User onboarded successfully (mocked)');
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="font-display-lg text-display-lg font-bold text-on-surface tracking-tight mb-2">Onboard New User</h1>
                <p className="font-body-sm text-body-sm text-on-surface-variant">Create a new user account with specific permissions</p>
            </div>

            <form onSubmit={handleSubmit} className="bg-surface-container border border-outline-variant rounded-lg p-6 max-w-2xl space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col">
                        <label className="font-label-caps text-label-caps text-on-surface-variant mb-1 uppercase">Email Address *</label>
                        <input type="email" required className="bg-surface border border-outline-variant rounded px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary" />
                    </div>
                    <div className="flex flex-col">
                        <label className="font-label-caps text-label-caps text-on-surface-variant mb-1 uppercase">Initial Password *</label>
                        <input type="password" required className="bg-surface border border-outline-variant rounded px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary" />
                    </div>
                    <div className="flex flex-col">
                        <label className="font-label-caps text-label-caps text-on-surface-variant mb-1 uppercase">Full Name (Encrypted)</label>
                        <input type="text" className="bg-surface border border-outline-variant rounded px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary" />
                    </div>
                    <div className="flex flex-col">
                        <label className="font-label-caps text-label-caps text-on-surface-variant mb-1 uppercase">Phone Number (Encrypted)</label>
                        <input type="tel" className="bg-surface border border-outline-variant rounded px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary" />
                    </div>
                </div>

                <div className="space-y-2 border-t border-outline-variant pt-4">
                    <label className="font-label-caps text-label-caps text-on-surface-variant uppercase">Base Role</label>
                    <select className="bg-surface border border-outline-variant rounded px-3 py-2 text-sm text-on-surface w-full focus:outline-none focus:border-primary">
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>

                <div className="space-y-2 border-t border-outline-variant pt-4">
                    <label className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2 block">Permission Groups</label>
                    <div className="grid grid-cols-2 gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" className="rounded border-outline-variant bg-surface" />
                            <span className="text-sm">Pro Traders</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" className="rounded border-outline-variant bg-surface" />
                            <span className="text-sm">Options Desk</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" className="rounded border-outline-variant bg-surface" />
                            <span className="text-sm">API Access</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" className="rounded border-outline-variant bg-surface" />
                            <span className="text-sm">Beta Features</span>
                        </label>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <button type="submit" className="bg-[#1B2A4E] text-primary px-6 py-2 text-sm rounded border border-primary/30 hover:bg-primary/10 transition-colors">
                        Create Account
                    </button>
                </div>
                {status && <div className="text-sm text-secondary-fixed">{status}</div>}
            </form>
        </div>
    );
};

const GroupsTab = () => {
    const mockGroups = [
        { name: 'Pro Traders', desc: 'Access to advanced charting and margin', users: 142, tags: ['trading:margin', 'ui:advanced'] },
        { name: 'Options Desk', desc: 'Options chain and multi-leg orders', users: 56, tags: ['trading:options', 'data:realtime'] },
        { name: 'API Access', desc: 'Programmatic trading via REST/WS', users: 12, tags: ['api:trade', 'api:data'] },
    ];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="font-display-lg text-display-lg font-bold text-on-surface tracking-tight mb-2">Permission Groups</h1>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">Manage role-based access control groups</p>
                </div>
                <button className="bg-[#1B2A4E] text-primary px-4 py-2 text-sm rounded border border-primary/30 hover:bg-primary/10 transition-colors">
                    Create New Group
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {mockGroups.map(group => (
                    <div key={group.name} className="bg-surface-container border border-outline-variant rounded-lg p-5 flex flex-col h-full">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="font-title-sm text-title-sm text-on-surface font-bold">{group.name}</h3>
                            <span className="bg-surface text-on-surface-variant text-xs px-2 py-1 rounded border border-outline-variant">
                                {group.users} users
                            </span>
                        </div>
                        <p className="text-sm text-on-surface-variant mb-4 flex-1">{group.desc}</p>
                        <div className="flex flex-wrap gap-1 mt-auto pt-4 border-t border-outline-variant/50">
                            {group.tags.map(tag => (
                                <span key={tag} className="px-2 py-0.5 rounded bg-surface text-secondary-fixed text-[10px] font-data-mono border border-secondary-fixed/20 cursor-pointer hover:bg-secondary-fixed/10">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default UserManagement;
