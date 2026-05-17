import React, { useState } from 'react';

const mockUsers = [
    { id: 1, email: 'admin1@ascend.com', role: 'super_admin', status: 'Active', lastLogin: '2023-11-24 10:00' },
    { id: 2, email: 'admin2@ascend.com', role: 'admin', status: 'Active', lastLogin: '2023-11-24 09:15' },
    { id: 3, email: 'user1@example.com', role: 'trader', status: 'Active', lastLogin: '2023-11-23 15:30' },
    { id: 4, email: 'user2@example.com', role: 'trader', status: 'Suspended', lastLogin: '2023-11-20 08:45' },
    { id: 5, email: 'viewer1@example.com', role: 'read_only', status: 'Active', lastLogin: '2023-11-24 11:20' },
];

export const UsersTable = ({ showAdminsOnly = false }: { showAdminsOnly?: boolean }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('All');
    const [users, setUsers] = useState(mockUsers);

    const filteredUsers = users.filter(user => {
        if (showAdminsOnly && !['super_admin', 'admin'].includes(user.role)) return false;
        if (roleFilter !== 'All' && user.role !== roleFilter) return false;
        if (searchTerm && !user.email.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        return true;
    });

    const toggleStatus = (id: number) => {
        setUsers(users.map(u => {
            if (u.id === id) {
                return { ...u, status: u.status === 'Active' ? 'Suspended' : 'Active' };
            }
            return u;
        }));
    };

    return (
        <div className="bg-surface-container border border-outline-variant rounded-lg overflow-hidden">
            <div className="bg-surface-container-high px-4 py-3 border-b border-outline-variant flex justify-between items-center gap-4">
                <input
                    type="text"
                    placeholder="Search by email..."
                    className="bg-surface border border-outline-variant rounded px-3 py-1.5 text-sm text-on-surface focus:outline-none focus:border-primary w-64"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
                {!showAdminsOnly && (
                    <select
                        className="bg-surface border border-outline-variant rounded px-3 py-1.5 text-sm text-on-surface focus:outline-none"
                        value={roleFilter}
                        onChange={e => setRoleFilter(e.target.value)}
                    >
                        <option value="All">All Roles</option>
                        <option value="super_admin">Super Admin</option>
                        <option value="admin">Admin</option>
                        <option value="trader">Trader</option>
                        <option value="read_only">Read Only</option>
                    </select>
                )}
            </div>
            <table className="w-full text-left font-body-sm">
                <thead className="bg-surface-container-lowest text-on-surface-variant font-label-caps border-b border-outline-variant">
                    <tr>
                        <th className="px-6 py-3 uppercase tracking-wider">Email</th>
                        <th className="px-6 py-3 uppercase tracking-wider">Role</th>
                        <th className="px-6 py-3 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 uppercase tracking-wider">Last Login</th>
                        <th className="px-6 py-3 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                    {filteredUsers.map(user => (
                        <tr key={user.id} className="hover:bg-surface-container-low transition-colors">
                            <td className="px-6 py-4 font-bold text-on-surface">{user.email}</td>
                            <td className="px-6 py-4 text-on-surface-variant font-data-mono">{user.role}</td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded text-[10px] font-bold border ${user.status === 'Active' ? 'bg-secondary-container/20 text-secondary-fixed border-secondary-container/30' : 'bg-error-container/20 text-error border-error-container/30'}`}>
                                    {user.status}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-on-surface-variant font-data-mono">{user.lastLogin}</td>
                            <td className="px-6 py-4 text-right">
                                <button
                                    onClick={() => toggleStatus(user.id)}
                                    className={`px-3 py-1 text-[10px] rounded border ${user.status === 'Active' ? 'bg-[#1B2A4E] text-error border-error/30 hover:bg-error/10' : 'bg-[#1B2A4E] text-secondary-fixed border-secondary-fixed/30 hover:bg-secondary-fixed/10'}`}
                                >
                                    {user.status === 'Active' ? 'Suspend' : 'Activate'}
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
