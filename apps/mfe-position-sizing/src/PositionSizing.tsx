import React, { useState, useEffect } from 'react';
import { usePermissions } from './usePermissions';

type Strategy = 'Fixed Risk' | 'Fixed Fractional' | 'Kelly Criterion' | 'Fixed Units';

export default function PositionSizing() {
  const { hasPermission } = usePermissions();

  const [strategy, setStrategy] = useState<Strategy>('Fixed Risk');
  const [accountSize, setAccountSize] = useState<number>(10000);
  const [entryPrice, setEntryPrice] = useState<number>(100);
  const [stopLossPrice, setStopLossPrice] = useState<number>(90);
  const [riskPercent, setRiskPercent] = useState<number>(1);
  const [fraction, setFraction] = useState<number>(0.02);
  const [winRate, setWinRate] = useState<number>(0.5);
  const [avgWin, setAvgWin] = useState<number>(200);
  const [avgLoss, setAvgLoss] = useState<number>(100);
  const [units, setUnits] = useState<number>(100);

  const [quantity, setQuantity] = useState<number>(0);
  const [positionValue, setPositionValue] = useState<number>(0);
  const [riskAmount, setRiskAmount] = useState<number>(0);
  const [riskPerShare, setRiskPerShare] = useState<number>(0);
  const [configs, setConfigs] = useState<any[]>([]);
  const [configName, setConfigName] = useState<string>('');

  if (!hasPermission('positions:read')) {
    return <div style={{ color: 'red', padding: '20px' }}>Access Denied: You do not have permission to read positions.</div>;
  }

  // Allow passing the API URL for remote vs local dev environment easily. We'll default to relative if served via proxy
  // or default to absolute if running standalone.
  const API_BASE = window.location.port === '4003' ? 'http://localhost:3003' : '';

  const getHeaders = () => {
    // In a real shell, a token would be in localStorage or Context.
    const token = localStorage.getItem('token') || 'dummy-token';
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  const calculate = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/position-sizing/calculate`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          strategy, accountSize, entryPrice, stopLossPrice, riskPercent, fraction, winRate, avgWin, avgLoss, units
        })
      });

      if (!response.ok) return console.error('Failed to calculate');

      const data = await response.json();
      setQuantity(data.quantity);
      setPositionValue(data.positionValue);
      setRiskAmount(data.riskAmount);
      setRiskPerShare(data.riskPerShare);
    } catch (e) {
      console.error(e);
    }
  };

  const saveConfig = async () => {
    if (!configName) return;
    try {
      const response = await fetch(`${API_BASE}/api/position-sizing/configs`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          configName,
          strategy,
          parameters: { accountSize, entryPrice, stopLossPrice, riskPercent, fraction, winRate, avgWin, avgLoss, units }
        })
      });
      if (response.ok) {
        setConfigName('');
        fetchConfigs();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchConfigs = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/position-sizing/configs`, {
         headers: getHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setConfigs(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadConfig = (config: any) => {
    setStrategy(config.strategy);
    const p = config.parameters;
    setAccountSize(p.accountSize || 10000);
    setEntryPrice(p.entryPrice || 100);
    setStopLossPrice(p.stopLossPrice || 90);
    setRiskPercent(p.riskPercent || 1);
    setFraction(p.fraction || 0.02);
    setWinRate(p.winRate || 0.5);
    setAvgWin(p.avgWin || 200);
    setAvgLoss(p.avgLoss || 100);
    setUnits(p.units || 100);
  };

  const deleteConfig = async (id: number) => {
    try {
      const response = await fetch(`${API_BASE}/api/position-sizing/configs/${id}`, {
          method: 'DELETE',
          headers: getHeaders()
      });
      if (response.ok) {
        fetchConfigs();
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h2>Position Sizing Tool</h2>
      <p style={{ color: '#888', fontStyle: 'italic', fontSize: '0.9em' }}>
        For informational purposes only — not investment advice
      </p>

      <div style={{ display: 'flex', gap: '20px' }}>
        <div style={{ flex: 1, border: '1px solid #ccc', padding: '15px', borderRadius: '8px' }}>
          <h3>Input Parameters</h3>
          <div style={{ marginBottom: '10px' }}>
            <label>Strategy: </label>
            <select value={strategy} onChange={e => setStrategy(e.target.value as Strategy)}>
              <option value="Fixed Risk">Fixed Risk</option>
              <option value="Fixed Fractional">Fixed Fractional</option>
              <option value="Kelly Criterion">Kelly Criterion</option>
              <option value="Fixed Units">Fixed Units</option>
            </select>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label>Account Size: </label>
            <input type="number" value={accountSize} onChange={e => setAccountSize(Number(e.target.value))} />
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label>Entry Price: </label>
            <input type="number" value={entryPrice} onChange={e => setEntryPrice(Number(e.target.value))} />
          </div>

          {strategy === 'Fixed Risk' && (
            <>
              <div style={{ marginBottom: '10px' }}>
                <label>Stop Loss Price: </label>
                <input type="number" value={stopLossPrice} onChange={e => setStopLossPrice(Number(e.target.value))} />
              </div>
              <div style={{ marginBottom: '10px' }}>
                <label>Risk Percent (%): </label>
                <input type="number" value={riskPercent} onChange={e => setRiskPercent(Number(e.target.value))} />
              </div>
            </>
          )}

          {strategy === 'Fixed Fractional' && (
            <div style={{ marginBottom: '10px' }}>
              <label>Fraction (0 to 1): </label>
              <input type="number" step="0.01" value={fraction} onChange={e => setFraction(Number(e.target.value))} />
            </div>
          )}

          {strategy === 'Kelly Criterion' && (
            <>
              <div style={{ marginBottom: '10px' }}>
                <label>Win Rate (0 to 1): </label>
                <input type="number" step="0.01" value={winRate} onChange={e => setWinRate(Number(e.target.value))} />
              </div>
              <div style={{ marginBottom: '10px' }}>
                <label>Avg Win: </label>
                <input type="number" value={avgWin} onChange={e => setAvgWin(Number(e.target.value))} />
              </div>
              <div style={{ marginBottom: '10px' }}>
                <label>Avg Loss: </label>
                <input type="number" value={avgLoss} onChange={e => setAvgLoss(Number(e.target.value))} />
              </div>
            </>
          )}


          {strategy === 'Fixed Units' && (
            <div style={{ marginBottom: '10px' }}>
              <label>Units: </label>
              <input type="number" value={units} onChange={e => setUnits(Number(e.target.value))} />
            </div>
          )}
          <button onClick={calculate}
 style={{ padding: '8px 16px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Calculate</button>
        </div>

        <div style={{ flex: 1, border: '1px solid #ccc', padding: '15px', borderRadius: '8px' }}>
          <h3>Calculation Output</h3>
          <p><strong>Quantity:</strong> {quantity}</p>
          <p><strong>Position Value:</strong> ${positionValue.toFixed(2)}</p>
          <p><strong>Risk Amount:</strong> ${riskAmount.toFixed(2)}</p>
          <p><strong>Risk Per Share:</strong> ${riskPerShare.toFixed(2)}</p>
        </div>

        <div style={{ flex: 1, border: '1px solid #ccc', padding: '15px', borderRadius: '8px' }}>
          <h3>Saved Configs</h3>
          <div style={{ marginBottom: '10px', display: 'flex', gap: '5px' }}>
            <input type="text" placeholder="Config Name" value={configName} onChange={e => setConfigName(e.target.value)} style={{ flex: 1 }} />
            <button onClick={saveConfig}>Save</button>
          </div>
          <ul style={{ paddingLeft: '20px' }}>
            {configs.map((c: any) => (
              <li key={c.id} style={{ marginBottom: '5px' }}>
                {c.configName} ({c.strategy})
                <button onClick={() => loadConfig(c)} style={{ marginLeft: '10px' }}>Load</button>
                <button onClick={() => deleteConfig(c.id)} style={{ marginLeft: '5px', color: 'red' }}>Delete</button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
