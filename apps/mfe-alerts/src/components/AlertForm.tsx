import React, { useState } from 'react';

const conditions = [
    { value: 'PRICE_ABOVE', label: 'Price Above' },
    { value: 'PRICE_BELOW', label: 'Price Below' },
    { value: 'PERCENT_CHANGE', label: 'Percent Change' },
    { value: 'ORDER_STATUS', label: 'Order Status' }
];

const AlertForm = ({ onAlertCreated }: { onAlertCreated?: () => void }) => {
    const [symbol, setSymbol] = useState('');
    const [condition, setCondition] = useState('PRICE_ABOVE');
    const [threshold, setThreshold] = useState('');
    const [referencePrice, setReferencePrice] = useState('');
    const [channels, setChannels] = useState({ 'in-app': true, 'email': false, 'sms': false });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const selectedChannels = Object.entries(channels).filter(([_, v]) => v).map(([k]) => k);

        try {
            const res = await fetch('/api/alerts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbol,
                    condition,
                    threshold: threshold ? parseFloat(threshold) : null,
                    reference_price: referencePrice ? parseFloat(referencePrice) : null,
                    channels: selectedChannels
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to create alert');
            }

            setSymbol('');
            setThreshold('');
            setReferencePrice('');
            if (onAlertCreated) onAlertCreated();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-surface-container border border-outline-variant p-6 rounded-sm text-on-surface">
            <h2 className="text-title-sm font-bold mb-4 border-b border-outline-variant pb-2">Create New Alert</h2>
            {error && <div className="text-error bg-error-container/20 p-2 mb-4 rounded text-sm">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Symbol</label>
                        <input
                            type="text"
                            className="w-full bg-surface-variant border border-outline-variant rounded p-2 text-sm focus:outline-none focus:border-primary"
                            placeholder="e.g. AAPL"
                            value={symbol}
                            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Condition</label>
                        <select
                            className="w-full bg-surface-variant border border-outline-variant rounded p-2 text-sm focus:outline-none focus:border-primary"
                            value={condition}
                            onChange={(e) => setCondition(e.target.value)}
                        >
                            {conditions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Threshold / Target</label>
                        <input
                            type="number"
                            step="any"
                            className="w-full bg-surface-variant border border-outline-variant rounded p-2 text-sm focus:outline-none focus:border-primary"
                            placeholder="Value"
                            value={threshold}
                            onChange={(e) => setThreshold(e.target.value)}
                        />
                    </div>
                    {condition === 'PERCENT_CHANGE' && (
                        <div>
                            <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Reference Price</label>
                            <input
                                type="number"
                                step="any"
                                className="w-full bg-surface-variant border border-outline-variant rounded p-2 text-sm focus:outline-none focus:border-primary"
                                placeholder="Base Price"
                                value={referencePrice}
                                onChange={(e) => setReferencePrice(e.target.value)}
                                required
                            />
                        </div>
                    )}
                </div>

                <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-2 uppercase tracking-wider">Notification Channels</label>
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="checkbox" checked={channels['in-app']} onChange={(e) => setChannels({...channels, 'in-app': e.target.checked})} className="accent-primary" />
                            In-App Bell
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="checkbox" checked={channels['email']} onChange={(e) => setChannels({...channels, 'email': e.target.checked})} className="accent-primary" />
                            Email
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="checkbox" checked={channels['sms']} onChange={(e) => setChannels({...channels, 'sms': e.target.checked})} className="accent-primary" />
                            SMS
                        </label>
                    </div>
                </div>

                <div className="pt-2">
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-primary text-on-primary font-bold px-4 py-2 rounded text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                        {loading ? 'Creating...' : 'Create Alert'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AlertForm;
