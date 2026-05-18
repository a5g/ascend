import React from 'react';

export const StatusBar = () => {
    return (
        <div className="fixed bottom-0 left-64 right-0 h-8 bg-surface-container-lowest border-t border-outline-variant z-50 flex items-center px-6 justify-between text-[10px] font-medium tracking-wider text-slate-500 uppercase">
            <div className="flex gap-6 items-center">
                <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary-fixed"></span>
                    CORE NODE: ONLINE
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary-fixed"></span>
                    DB CLUSTER: SYNCED
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-error"></span>
                    REDIS CACHE: MISSING L3
                </div>
            </div>
            <div className="font-data-mono">
                SYS_LOAD: 2.14 / 1.88 / 1.92
            </div>
        </div>
    );
};
