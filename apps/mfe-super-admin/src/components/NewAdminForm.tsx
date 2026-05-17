import React, { useState } from 'react';

export const NewAdminForm = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('admin');
    const [status, setStatus] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setStatus('Admin created successfully (mocked)');
            setEmail('');
            setPassword('');
        } catch (error) {
            setStatus('Error creating admin');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-surface-container border border-outline-variant rounded-lg p-6 mb-6">
            <h3 className="font-title-sm text-title-sm text-primary mb-4 flex items-center gap-2">New Admin Account</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="flex flex-col">
                    <label className="font-label-caps text-label-caps text-on-surface-variant mb-1 uppercase">Email</label>
                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="bg-surface border border-outline-variant rounded px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary" />
                </div>
                <div className="flex flex-col">
                    <label className="font-label-caps text-label-caps text-on-surface-variant mb-1 uppercase">Password</label>
                    <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="bg-surface border border-outline-variant rounded px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary" />
                </div>
                <div className="flex flex-col">
                    <label className="font-label-caps text-label-caps text-on-surface-variant mb-1 uppercase">Role</label>
                    <select value={role} onChange={e => setRole(e.target.value)} className="bg-surface border border-outline-variant rounded px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary">
                        <option value="admin">Admin</option>
                        <option value="super_admin">Super Admin</option>
                    </select>
                </div>
                <div>
                    <button type="submit" className="w-full bg-[#1B2A4E] text-primary px-4 py-2 text-sm rounded border border-primary/30 hover:bg-primary/10 transition-colors">
                        Create Admin
                    </button>
                </div>
            </div>
            {status && <div className="mt-4 text-sm text-secondary-fixed">{status}</div>}
        </form>
    );
};
