import React, { useState, useEffect } from 'react';
import pino from 'pino';

const logger = pino({ name: 'mfe-alerts' });

interface AlertData {
    id: number;
    symbol: string;
    condition: string;
    threshold: number;
    reference_price: number | null;
    active: boolean;
    channels: string[];
    triggered_at: string | null;
}

const AlertsTable = ({ refreshTrigger }: { refreshTrigger: number }) => {
    const [alerts, setAlerts] = useState<AlertData[]>([]);
    const [tab, setTab] = useState<'active' | 'history'>('active');
    const [loading, setLoading] = useState(false);

    const fetchAlerts = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/alerts?active=${tab === 'active'}`);
            if (res.ok) {
                const data = await res.json();
                setAlerts(data);
            }
        } catch (e) {
            logger.error({ err: e }, 'Failed to fetch alerts');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAlerts();
    }, [tab, refreshTrigger]);

    const handleRearm = async (id: number) => {
        try {
            await fetch(`/api/alerts/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active: true })
            });
            fetchAlerts();
        } catch (e) {
            logger.error({ err: e }, 'Failed to rearm');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this alert?')) return;
        try {
            await fetch(`/api/alerts/${id}`, { method: 'DELETE' });
            fetchAlerts();
        } catch (e) {
            logger.error({ err: e }, 'Failed to delete');
        }
    };

    return (
        <div className="bg-surface-container border border-outline-variant rounded-sm text-on-surface overflow-hidden">
            <div className="flex border-b border-outline-variant bg-surface-container-high">
                <button
                    className={`px-4 py-3 text-sm font-bold uppercase tracking-wider ${tab === 'active' ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-white'}`}
                    onClick={() => setTab('active')}
                >
                    Active Alerts
                </button>
                <button
                    className={`px-4 py-3 text-sm font-bold uppercase tracking-wider ${tab === 'history' ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-white'}`}
                    onClick={() => setTab('history')}
                >
                    History
                </button>
            </div>

            <div className="p-0 overflow-x-auto terminal-scroll">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-surface-container-high border-b border-outline-variant">
                            <th className="p-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Symbol</th>
                            <th className="p-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Condition</th>
                            <th className="p-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Channels</th>
                            {tab === 'history' && <th className="p-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Triggered At</th>}
                            <th className="p-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-outline-variant/30 font-mono">
                        {loading ? (
                            <tr><td colSpan={5} className="p-4 text-center text-on-surface-variant">Loading...</td></tr>
                        ) : alerts.length === 0 ? (
                            <tr><td colSpan={5} className="p-4 text-center text-on-surface-variant">No alerts found.</td></tr>
                        ) : alerts.map(a => (
                            <tr key={a.id} className="hover:bg-surface-variant transition-colors group">
                                <td className="p-3 font-bold">{a.symbol}</td>
                                <td className="p-3">
                                    <span className="text-secondary">{a.condition.replace('_', ' ')}</span>
                                    <span className="ml-2 text-on-surface-variant">
                                        {a.condition === 'PERCENT_CHANGE' ? `${a.threshold}% (Ref: ${a.reference_price})` : a.threshold}
                                    </span>
                                </td>
                                <td className="p-3 text-xs text-on-surface-variant">
                                    {a.channels.join(', ')}
                                </td>
                                {tab === 'history' && (
                                    <td className="p-3 text-xs text-on-surface-variant">
                                        {a.triggered_at ? new Date(a.triggered_at).toLocaleString() : 'N/A'}
                                    </td>
                                )}
                                <td className="p-3 text-right space-x-2">
                                    {tab === 'history' && (
                                        <button onClick={() => handleRearm(a.id)} className="text-xs bg-primary/20 text-primary px-2 py-1 rounded hover:bg-primary/30 transition-colors">
                                            Re-arm
                                        </button>
                                    )}
                                    <button onClick={() => handleDelete(a.id)} className="text-xs bg-error-container/20 text-error px-2 py-1 rounded hover:bg-error-container/40 transition-colors">
                                        Delete
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

export default AlertsTable;
