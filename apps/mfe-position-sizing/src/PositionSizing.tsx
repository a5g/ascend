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
    return <div className="text-error p-5">Access Denied: You do not have permission to read positions.</div>;
  }

  // Allow passing the API URL for remote vs local dev environment easily. We'll default to relative if served via proxy
  // or default to absolute if running standalone.
  const API_BASE = window.location.port === '4003' ? 'http://localhost:3003' : '';

  const getHeaders = () => {
    // In a real shell, a token would be in localStorage or Context.
    const token = localStorage.getItem('token') || '';
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
    <div className="space-y-6">
      <section className="bg-surface-container border border-outline-variant">
        <div className="bg-surface-container-high px-4 py-2 border-b border-outline-variant flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-sm">calculate</span>
            <h2 className="font-label-caps text-label-caps text-on-surface uppercase">Position Sizing Calculator</h2>
          </div>
          <p className="text-on-surface-variant font-label-caps text-[9px] uppercase italic">
            For informational purposes only — not investment advice
          </p>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="block font-label-caps text-[9px] text-on-surface-variant uppercase">Strategy</label>
            <select
              value={strategy}
              onChange={e => setStrategy(e.target.value as Strategy)}
              className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-3 py-1.5 text-sm focus:border-primary focus:ring-0"
            >
              <option value="Fixed Risk">Fixed Risk</option>
              <option value="Fixed Fractional">Fixed Fractional</option>
              <option value="Kelly Criterion">Kelly Criterion</option>
              <option value="Fixed Units">Fixed Units</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block font-label-caps text-[9px] text-on-surface-variant uppercase">Account Size</label>
            <input
              type="number"
              value={accountSize}
              onChange={e => setAccountSize(Number(e.target.value))}
              className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-3 py-1.5 text-sm focus:border-primary focus:ring-0"
            />
          </div>

          <div className="space-y-1">
            <label className="block font-label-caps text-[9px] text-on-surface-variant uppercase">Entry Price</label>
            <input
              type="number"
              value={entryPrice}
              onChange={e => setEntryPrice(Number(e.target.value))}
              className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-3 py-1.5 text-sm focus:border-primary focus:ring-0"
            />
          </div>

          {strategy === 'Fixed Risk' && (
            <>
              <div className="space-y-1">
                <label className="block font-label-caps text-[9px] text-on-surface-variant uppercase">Stop Loss Price</label>
                <input
                  type="number"
                  value={stopLossPrice}
                  onChange={e => setStopLossPrice(Number(e.target.value))}
                  className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-3 py-1.5 text-sm focus:border-primary focus:ring-0"
                />
              </div>
              <div className="space-y-1">
                <label className="block font-label-caps text-[9px] text-on-surface-variant uppercase">Risk Per Trade (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.25"
                    value={riskPercent}
                    onChange={e => setRiskPercent(Number(e.target.value))}
                    className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-3 py-1.5 text-sm focus:border-primary focus:ring-0"
                  />
                  <span className="absolute right-3 top-1.5 text-[10px] text-on-surface-variant">%</span>
                </div>
              </div>
            </>
          )}

          {strategy === 'Fixed Fractional' && (
            <div className="space-y-1">
              <label className="block font-label-caps text-[9px] text-on-surface-variant uppercase">Fraction (0 to 1)</label>
              <input
                type="number"
                step="0.01"
                value={fraction}
                onChange={e => setFraction(Number(e.target.value))}
                className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-3 py-1.5 text-sm focus:border-primary focus:ring-0"
              />
            </div>
          )}

          {strategy === 'Kelly Criterion' && (
            <>
              <div className="space-y-1">
                <label className="block font-label-caps text-[9px] text-on-surface-variant uppercase">Win Rate (0 to 1)</label>
                <input
                  type="number"
                  step="0.01"
                  value={winRate}
                  onChange={e => setWinRate(Number(e.target.value))}
                  className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-3 py-1.5 text-sm focus:border-primary focus:ring-0"
                />
              </div>
              <div className="space-y-1">
                <label className="block font-label-caps text-[9px] text-on-surface-variant uppercase">Avg Win</label>
                <input
                  type="number"
                  value={avgWin}
                  onChange={e => setAvgWin(Number(e.target.value))}
                  className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-3 py-1.5 text-sm focus:border-primary focus:ring-0"
                />
              </div>
              <div className="space-y-1">
                <label className="block font-label-caps text-[9px] text-on-surface-variant uppercase">Avg Loss</label>
                <input
                  type="number"
                  value={avgLoss}
                  onChange={e => setAvgLoss(Number(e.target.value))}
                  className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-3 py-1.5 text-sm focus:border-primary focus:ring-0"
                />
              </div>
            </>
          )}

          {strategy === 'Fixed Units' && (
            <div className="space-y-1">
              <label className="block font-label-caps text-[9px] text-on-surface-variant uppercase">Units</label>
              <input
                type="number"
                value={units}
                onChange={e => setUnits(Number(e.target.value))}
                className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-3 py-1.5 text-sm focus:border-primary focus:ring-0"
              />
            </div>
          )}

          <div className="flex items-end">
             <button
                onClick={calculate}
                className="w-full bg-primary text-on-primary font-label-caps text-[11px] uppercase py-2 px-4 border border-primary hover:bg-primary-container transition-colors"
             >
                Calculate
             </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-surface-container border border-outline-variant">
          <div className="bg-surface-container-high px-4 py-2 border-b border-outline-variant">
            <h3 className="font-label-caps text-label-caps text-on-surface uppercase">Calculation Output</h3>
          </div>
          <div className="p-4 grid grid-cols-2 gap-4">
            <div className="bg-surface-container-low border border-outline-variant/30 p-2 flex flex-col justify-center items-center">
              <span className="font-label-caps text-[9px] text-primary uppercase">Calculated Shares</span>
              <span className="font-data-mono text-lg font-bold text-on-surface">{quantity}</span>
            </div>
            <div className="bg-surface-container-low border border-outline-variant/30 p-2 flex flex-col justify-center items-center">
              <span className="font-label-caps text-[9px] text-secondary uppercase">Position Value</span>
              <span className="font-data-mono text-lg font-bold text-on-surface">${positionValue.toFixed(2)}</span>
            </div>
            <div className="bg-surface-container-low border border-outline-variant/30 p-2 flex flex-col justify-center items-center">
              <span className="font-label-caps text-[9px] text-tertiary uppercase">Risk Amount</span>
              <span className="font-data-mono text-lg font-bold text-on-surface">${riskAmount.toFixed(2)}</span>
            </div>
            <div className="bg-surface-container-low border border-outline-variant/30 p-2 flex flex-col justify-center items-center">
              <span className="font-label-caps text-[9px] text-outline uppercase">Risk Per Share</span>
              <span className="font-data-mono text-lg font-bold text-on-surface">${riskPerShare.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="bg-surface-container border border-outline-variant">
          <div className="bg-surface-container-high px-4 py-2 border-b border-outline-variant">
            <h3 className="font-label-caps text-label-caps text-on-surface uppercase">Saved Configs</h3>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Config Name"
                value={configName}
                onChange={e => setConfigName(e.target.value)}
                className="flex-1 bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-3 py-1.5 text-sm focus:border-primary focus:ring-0"
              />
              <button
                onClick={saveConfig}
                className="bg-secondary text-on-secondary font-label-caps text-[11px] uppercase py-1.5 px-4 border border-secondary hover:bg-secondary-container transition-colors"
              >
                Save
              </button>
            </div>

            <ul className="space-y-2 max-h-[160px] overflow-y-auto pr-2">
              {configs.map((c: any) => (
                <li key={c.id} className="flex items-center justify-between p-2 bg-surface-container-low border border-outline-variant/30">
                  <div className="flex flex-col">
                     <span className="font-data-mono text-xs text-on-surface font-bold">{c.configName}</span>
                     <span className="font-label-caps text-[9px] text-on-surface-variant uppercase">{c.strategy}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => loadConfig(c)}
                      className="text-[10px] font-label-caps uppercase text-primary hover:text-primary-container px-2 py-1"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => deleteConfig(c.id)}
                      className="text-[10px] font-label-caps uppercase text-error hover:text-error-container px-2 py-1"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
              {configs.length === 0 && (
                <li className="text-center p-4 text-on-surface-variant text-xs italic">
                   No saved configs
                </li>
              )}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
