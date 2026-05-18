import React from 'react';

export const AutomatedScripts = () => {
    return (
        <div className="col-span-12 mt-6">
            <div className="bg-surface-container border border-outline-variant rounded-lg overflow-hidden">
                <div className="bg-surface-container-high px-4 py-2 border-b border-outline-variant flex justify-between items-center">
                    <span className="font-label-caps text-label-caps uppercase">Automated Onboarding Scripts</span>
                    <button className="bg-[#1B2A4E] text-primary px-3 py-1 text-[10px] rounded border border-primary/30 hover:bg-primary/10">Trigger Manual Run</button>
                </div>
                <div className="p-0">
                    <table className="w-full text-left font-body-sm">
                        <thead className="bg-surface-container-lowest text-on-surface-variant font-label-caps border-b border-outline-variant">
                            <tr>
                                <th className="px-6 py-3 uppercase tracking-wider">Script ID</th>
                                <th className="px-6 py-3 uppercase tracking-wider">Service Scope</th>
                                <th className="px-6 py-3 uppercase tracking-wider">Last Run</th>
                                <th className="px-6 py-3 uppercase tracking-wider">Duration</th>
                                <th className="px-6 py-3 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 uppercase tracking-wider text-right">Success Rate</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant">
                            <tr className="hover:bg-surface-container-low transition-colors">
                                <td className="px-6 py-4 font-bold text-on-surface">SYS_INIT_PROV_V3</td>
                                <td className="px-6 py-4 text-on-surface-variant">Infrastructure Provisioning</td>
                                <td className="px-6 py-4 text-on-surface-variant font-data-mono">2023-11-24 08:45:12</td>
                                <td className="px-6 py-4 text-on-surface-variant font-data-mono">4m 12s</td>
                                <td className="px-6 py-4">
                                    <span className="flex items-center gap-2 text-secondary-fixed">
                                        <span className="material-symbols-outlined text-base">check_circle</span> SUCCESS
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right font-data-mono text-secondary-fixed">100%</td>
                            </tr>
                            <tr className="hover:bg-surface-container-low transition-colors">
                                <td className="px-6 py-4 font-bold text-on-surface">USER_MIGRATION_AUTO</td>
                                <td className="px-6 py-4 text-on-surface-variant">Database Sharding</td>
                                <td className="px-6 py-4 text-on-surface-variant font-data-mono">2023-11-24 09:12:05</td>
                                <td className="px-6 py-4 text-on-surface-variant font-data-mono">18m 44s</td>
                                <td className="px-6 py-4">
                                    <span className="flex items-center gap-2 text-secondary-fixed">
                                        <span className="material-symbols-outlined text-base">check_circle</span> SUCCESS
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right font-data-mono text-secondary-fixed">98.4%</td>
                            </tr>
                            <tr className="hover:bg-surface-container-low transition-colors">
                                <td className="px-6 py-4 font-bold text-on-surface">API_KEY_ROTATOR</td>
                                <td className="px-6 py-4 text-on-surface-variant">Security Enforcement</td>
                                <td className="px-6 py-4 text-on-surface-variant font-data-mono">2023-11-24 10:00:00</td>
                                <td className="px-6 py-4 text-on-surface-variant font-data-mono">1m 02s</td>
                                <td className="px-6 py-4">
                                    <span className="flex items-center gap-2 text-error">
                                        <span className="material-symbols-outlined text-base">cancel</span> FAILURE
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right font-data-mono text-error">92.1%</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
