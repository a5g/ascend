import React, { useState } from 'react';

const mockLogs = [
    { id: 101, timestamp: '2023-11-24 10:15:22', action: 'USER_CREATE', targetType: 'User', actorId: 'admin1', payload: '{"email": "newuser@example.com", "role": "trader"}' },
    { id: 102, timestamp: '2023-11-24 10:12:05', action: 'CONFIG_UPDATE', targetType: 'System', actorId: 'admin1', payload: '{"featureFlags": {"newDashboard": true}}' },
    { id: 103, timestamp: '2023-11-24 09:45:11', action: 'USER_SUSPEND', targetType: 'User', actorId: 'admin2', payload: '{"userId": 4, "reason": "Violation of terms"}' },
    { id: 104, timestamp: '2023-11-24 09:30:00', action: 'LOGIN_SUCCESS', targetType: 'Session', actorId: 'admin1', payload: '{"ip": "192.168.1.1"}' },
    { id: 105, timestamp: '2023-11-23 15:30:45', action: 'ROLE_CHANGE', targetType: 'User', actorId: 'admin2', payload: '{"userId": 3, "newRole": "trader"}' },
];

export const AuditLogViewer = () => {
    const [actionFilter, setActionFilter] = useState('');
    const [expandedRow, setExpandedRow] = useState<number | null>(null);

    const filteredLogs = mockLogs.filter(log => {
        if (actionFilter && !log.action.toLowerCase().includes(actionFilter.toLowerCase())) return false;
        return true;
    });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="font-display-lg text-display-lg font-bold text-on-surface tracking-tight mb-2">Audit Logs</h1>
                <p className="font-body-sm text-body-sm text-on-surface-variant">System-wide activity tracker</p>
            </div>

            <div className="bg-surface-container border border-outline-variant rounded-lg overflow-hidden flex flex-col h-[600px]">
                <div className="bg-surface-container-high px-4 py-3 border-b border-outline-variant flex justify-between items-center gap-4">
                    <input
                        type="text"
                        placeholder="Filter by Action..."
                        className="bg-surface border border-outline-variant rounded px-3 py-1.5 text-sm text-on-surface focus:outline-none focus:border-primary w-64"
                        value={actionFilter}
                        onChange={e => setActionFilter(e.target.value)}
                    />
                    <div className="text-sm text-on-surface-variant">Showing {filteredLogs.length} entries</div>
                </div>

                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left font-body-sm">
                        <thead className="bg-surface-container-lowest text-on-surface-variant font-label-caps border-b border-outline-variant sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-3 uppercase tracking-wider">Timestamp</th>
                                <th className="px-6 py-3 uppercase tracking-wider">Action</th>
                                <th className="px-6 py-3 uppercase tracking-wider">Target</th>
                                <th className="px-6 py-3 uppercase tracking-wider">Actor ID</th>
                                <th className="px-6 py-3 uppercase tracking-wider w-8"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant">
                            {filteredLogs.map(log => (
                                <React.Fragment key={log.id}>
                                    <tr className="hover:bg-surface-container-low transition-colors cursor-pointer" onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}>
                                        <td className="px-6 py-4 text-on-surface-variant font-data-mono">{log.timestamp}</td>
                                        <td className="px-6 py-4 font-bold text-secondary-fixed">{log.action}</td>
                                        <td className="px-6 py-4 text-on-surface">{log.targetType}</td>
                                        <td className="px-6 py-4 text-primary-fixed">{log.actorId}</td>
                                        <td className="px-6 py-4 text-on-surface-variant">
                                            {expandedRow === log.id ? '▼' : '▶'}
                                        </td>
                                    </tr>
                                    {expandedRow === log.id && (
                                        <tr className="bg-surface-container-lowest">
                                            <td colSpan={5} className="px-6 py-4">
                                                <div className="bg-[#010e24] p-3 rounded border border-outline-variant/50">
                                                    <pre className="font-data-mono text-[11px] text-on-surface-variant whitespace-pre-wrap">
                                                        {JSON.stringify(JSON.parse(log.payload), null, 2)}
                                                    </pre>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
