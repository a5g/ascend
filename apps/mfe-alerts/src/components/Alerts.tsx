import React, { useState } from 'react';
import '../index.css';
import AlertForm from './AlertForm';
import AlertsTable from './AlertsTable';

const Alerts = () => {
    const [refresh, setRefresh] = useState(0);

    return (
        <div className="p-6 space-y-6">
            <AlertForm onAlertCreated={() => setRefresh(prev => prev + 1)} />
            <AlertsTable refreshTrigger={refresh} />
        </div>
    );
};

export default Alerts;
