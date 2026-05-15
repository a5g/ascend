import React from 'react';

const ZerodhaConnect: React.FC = () => {
  const handleConnect = async () => {
    try {
      const response = await fetch('/api/auth/zerodha/connect', { method: 'POST' });
      const data = await response.json();
      if (data.loginUrl) {
        window.location.href = data.loginUrl;
      }
    } catch (error) {
      console.error('Failed to connect to Zerodha:', error);
    }
  };

  return (
    <div className="zerodha-connect">
      <h2>Connect to Zerodha</h2>
      <p>Please connect your Zerodha account to view your live holdings and positions.</p>
      <button onClick={handleConnect}>Connect via Kite</button>
    </div>
  );
};

export default ZerodhaConnect;