import React from 'react';

export const SystemLogs = () => {
    return (
        <div className="col-span-12 lg:col-span-4 space-y-gutter mt-6">
            <div className="bg-surface-container border border-outline-variant rounded-lg flex flex-col h-[500px]">
                <div className="bg-surface-container-high px-4 py-2 border-b border-outline-variant flex justify-between items-center">
                    <span className="font-label-caps text-label-caps uppercase">System Events &amp; Logs</span>
                    <span className="material-symbols-outlined text-sm text-on-surface-variant">filter_list</span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 font-data-mono text-[11px] leading-tight space-y-1 bg-[#010e24]">
                    <div className="flex gap-2 text-slate-500">
                        <span className="w-16 shrink-0">[14:22:01]</span>
                        <span className="text-secondary-fixed-dim">INF</span>
                        <span className="text-slate-400">Auth-service heartbeat received.</span>
                    </div>
                    <div className="flex gap-2 text-slate-500">
                        <span className="w-16 shrink-0">[14:22:05]</span>
                        <span className="text-secondary-fixed-dim">INF</span>
                        <span className="text-slate-400">New websocket connection client_id: u_8422.</span>
                    </div>
                    <div className="flex gap-2 text-slate-500">
                        <span className="w-16 shrink-0">[14:22:12]</span>
                        <span className="text-tertiary-container">WRN</span>
                        <span className="text-on-surface">Order queue length exceeded threshold &gt; 500.</span>
                    </div>
                    <div className="flex gap-2 text-slate-500">
                        <span className="w-16 shrink-0">[14:22:15]</span>
                        <span className="text-error">ERR</span>
                        <span className="text-error-container bg-error/10 px-1">DB Connection Timeout on portfolio-cluster-04.</span>
                    </div>
                    <div className="flex gap-2 text-slate-500">
                        <span className="w-16 shrink-0">[14:22:18]</span>
                        <span className="text-secondary-fixed-dim">INF</span>
                        <span className="text-slate-400">Scaling group trigger: portfolio-service +2 nodes.</span>
                    </div>
                    <div className="flex gap-2 text-slate-500">
                        <span className="w-16 shrink-0">[14:22:25]</span>
                        <span className="text-secondary-fixed-dim">INF</span>
                        <span className="text-slate-400">Order-service responding after retry cycle 2.</span>
                    </div>
                    <div className="flex gap-2 text-slate-500">
                        <span className="w-16 shrink-0">[14:22:30]</span>
                        <span className="text-secondary-fixed-dim">INF</span>
                        <span className="text-slate-400">Admin session validated: root_01.</span>
                    </div>
                    <div className="flex gap-2 text-slate-500">
                        <span className="w-16 shrink-0">[14:22:31]</span>
                        <span className="text-secondary-fixed-dim">INF</span>
                        <span className="text-slate-400">Zerodha API Quote sync completed.</span>
                    </div>
                    <div className="flex gap-2 text-slate-500">
                        <span className="w-16 shrink-0">[14:22:32]</span>
                        <span className="text-secondary-fixed-dim">INF</span>
                        <span className="text-slate-400">Heartbeat check all nodes green.</span>
                    </div>
                    <div className="flex gap-2 text-slate-500">
                        <span className="w-16 shrink-0">[14:22:35]</span>
                        <span className="text-secondary-fixed-dim">INF</span>
                        <span className="text-slate-400">Cleaning up transient user sessions &lt; 5m.</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
