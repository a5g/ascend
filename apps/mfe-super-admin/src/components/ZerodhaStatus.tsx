import React from 'react';

export const ZerodhaStatus = () => {
    return (
        <div className="bg-surface-container border border-outline-variant rounded-lg p-6 relative overflow-hidden mt-6">
            <div className="absolute top-0 right-0 p-8 opacity-10">
                <span className="material-symbols-outlined text-[120px]">api</span>
            </div>
            <div className="relative z-10">
                <h3 className="font-title-sm text-title-sm text-primary mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined">hub</span>
                    Zerodha API Integration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="flex flex-col">
                        <span className="font-label-caps text-label-caps text-on-surface-variant mb-1 uppercase">Connection Status</span>
                        <span className="text-secondary-fixed font-bold flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">link</span> ESTABLISHED
                        </span>
                    </div>
                    <div className="flex flex-col">
                        <span className="font-label-caps text-label-caps text-on-surface-variant mb-1 uppercase">Avg. API Latency</span>
                        <span className="font-data-mono text-data-mono text-on-surface">182 ms</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="font-label-caps text-label-caps text-on-surface-variant mb-1 uppercase">Requests / Min</span>
                        <span className="font-data-mono text-data-mono text-on-surface">4,208</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="font-label-caps text-label-caps text-on-surface-variant mb-1 uppercase">Token Expiry</span>
                        <span className="font-data-mono text-data-mono text-on-tertiary-fixed-variant">04h 12m</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
