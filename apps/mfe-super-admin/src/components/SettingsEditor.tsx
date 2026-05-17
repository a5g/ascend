import React, { useState } from 'react';

export const SettingsEditor = () => {
    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [maxSessionTime, setMaxSessionTime] = useState(60);
    const [jsonConfig, setJsonConfig] = useState('{\n  "featureFlags": {\n    "newDashboard": true,\n    "betaTrading": false\n  }\n}');
    const [jsonError, setJsonError] = useState('');

    const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setJsonConfig(e.target.value);
        try {
            JSON.parse(e.target.value);
            setJsonError('');
        } catch (err) {
            setJsonError('Invalid JSON format');
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="font-display-lg text-display-lg font-bold text-on-surface tracking-tight mb-2">Platform Settings</h1>
                <p className="font-body-sm text-body-sm text-on-surface-variant">Configure global platform behavior</p>
            </div>

            {maintenanceMode && (
                <div className="bg-error-container/20 border border-error/30 p-4 rounded-lg flex items-center gap-3">
                    <span className="material-symbols-outlined text-error">warning</span>
                    <span className="text-error font-medium">Maintenance mode is currently active. Users will see a maintenance page.</span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-surface-container border border-outline-variant rounded-lg p-6 space-y-6">
                    <h3 className="font-title-sm text-title-sm text-primary mb-4 border-b border-outline-variant pb-2">General Settings</h3>

                    <div className="flex items-center justify-between">
                        <div>
                            <div className="font-medium text-on-surface">Maintenance Mode</div>
                            <div className="text-sm text-on-surface-variant">Enable to restrict access to the platform</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={maintenanceMode} onChange={() => setMaintenanceMode(!maintenanceMode)} />
                            <div className="w-11 h-6 bg-surface-variant rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container"></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <div className="font-medium text-on-surface">Max Session Time (mins)</div>
                            <div className="text-sm text-on-surface-variant">Force logout after inactivity</div>
                        </div>
                        <input
                            type="number"
                            className="bg-surface border border-outline-variant rounded px-3 py-1.5 text-sm text-on-surface focus:outline-none w-24 text-right"
                            value={maxSessionTime}
                            onChange={(e) => setMaxSessionTime(parseInt(e.target.value) || 0)}
                        />
                    </div>
                </div>

                <div className="bg-surface-container border border-outline-variant rounded-lg p-6 space-y-4 flex flex-col">
                    <h3 className="font-title-sm text-title-sm text-primary border-b border-outline-variant pb-2">Advanced Configuration (JSON)</h3>
                    <textarea
                        className={`flex-1 min-h-[200px] w-full bg-[#010e24] text-secondary-fixed-dim font-data-mono text-sm p-4 rounded border focus:outline-none ${jsonError ? 'border-error' : 'border-outline-variant'}`}
                        value={jsonConfig}
                        onChange={handleJsonChange}
                    />
                    {jsonError && <div className="text-error text-sm">{jsonError}</div>}
                    <div className="flex justify-end">
                        <button disabled={!!jsonError} className="bg-[#1B2A4E] text-primary px-4 py-2 text-sm rounded border border-primary/30 hover:bg-primary/10 disabled:opacity-50 transition-colors">
                            Save Config
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
