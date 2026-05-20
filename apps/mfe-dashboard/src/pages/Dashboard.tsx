import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ZerodhaConnect from '../components/ZerodhaConnect';
import { useWebSocket } from '../hooks/useWebSocket';

const Dashboard: React.FC = () => {
  const [isConnected, setIsConnected] = useState(true); // Mock status initially
  const [isStale, setIsStale] = useState(false);
  const [holdings, setHoldings] = useState<any[]>([]);
  const [positions, setPositions] = useState<any>({});
  const [pnl, setPnl] = useState<{ totalPnl: number }>({ totalPnl: 0 });

  // Mock JWT Token
  const token = 'mock_jwt_token';

  const { requestPositionsRefresh } = useWebSocket(token, () => {
    // In real app, merge update to positions state
  });

  useEffect(() => {
    // Check connection status
    fetch('/api/auth/zerodha/status')
      .then(res => {
         if(res.status === 401) { setIsConnected(false); throw new Error('Unauthorized');}
         return res.json()
      })
      .then(data => {
         if (!data.connected) setIsConnected(false);
      })
      .catch(() => setIsConnected(false));

    // Fetch Holdings
    fetch('/api/dashboard/holdings')
        .then(res => res.json())
        .then(data => {
            if(data.stale) setIsStale(true);
            setHoldings(data.data || []);
        });

    // Fetch Positions
    fetch('/api/dashboard/positions')
        .then(res => res.json())
        .then(data => {
            if(data.stale) setIsStale(true);
            setPositions(data.data || {});
        });

    // Fetch PnL
    fetch('/api/dashboard/pnl')
        .then(res => res.json())
        .then(data => {
            setPnl(data.data || { totalPnl: 0 });
        });
  }, []);

  if (!isConnected) {
    return <ZerodhaConnect />;
  }

  // Prep data for chart
  const chartData = holdings.map(h => ({
      name: h.tradingsymbol,
      pnl: h.pnl
  }));

  return (
    <div className="dashboard-container">
      {isStale && <div className="stale-banner" style={{ background: 'yellow', padding: '10px' }}>Showing stale data due to Zerodha downtime.</div>}

      <h1>Dashboard</h1>

      <div className="summary-cards" style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
         <div className="card">Total P&L: {pnl.totalPnl}</div>
         <button onClick={requestPositionsRefresh}>Refresh Positions Live</button>
      </div>

      <div className="holdings-section">
         <h2>Holdings</h2>
         <ul>
             {holdings.map((h, i) => <li key={i}>{h.tradingsymbol} - {h.quantity} QTY</li>)}
         </ul>
      </div>

      <div className="chart-section" style={{ width: '100%', height: 300 }}>
        <h2>P&L by Stock</h2>
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="pnl" fill="#8884d8" />
            </BarChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
};

export default Dashboard;