import { useState, useEffect, useRef } from 'react';

interface SecurityOption {
  id: number;
  symbol: string;
  name_of_company: string;
  series: string;
}

function SecurityDropdown({ value, onChange }: { value: SecurityOption | null; onChange: (s: SecurityOption | null) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SecurityOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
    if (!open) setFocusedIndex(-1);
  }, [open]);

  useEffect(() => {
    setFocusedIndex(-1);
    itemRefs.current = [];
    if (!query.trim()) { setResults([]); return; }
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/securities?search=${encodeURIComponent(query.trim())}&page=1`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => { setResults((data.data ?? []).slice(0, 10)); setLoading(false); })
      .catch(() => setLoading(false));
    return () => controller.abort();
  }, [query]);

  useEffect(() => {
    if (focusedIndex >= 0 && itemRefs.current[focusedIndex]) {
      itemRefs.current[focusedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedIndex]);

  function select(s: SecurityOption) {
    onChange(s);
    setOpen(false);
    setQuery('');
    setResults([]);
    setFocusedIndex(-1);
  }

  function handleButtonClick() {
    setOpen(o => !o);
    if (!open) { setQuery(''); setResults([]); }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = focusedIndex >= 0 ? results[focusedIndex] : results[0];
      if (target) select(target);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={ref} className="relative w-56">
      <button
        type="button"
        onClick={handleButtonClick}
        className="w-full flex items-center justify-between bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-3 py-1.5 text-sm focus:border-primary focus:outline-none hover:border-primary transition-colors"
      >
        <span className={value ? 'text-on-surface' : 'text-on-surface-variant text-xs'}>
          {value ? value.symbol : 'Select security…'}
        </span>
        <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: '16px' }}>
          {open ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 w-72 bg-surface-container border border-outline-variant shadow-lg mt-0.5">
          <div className="p-2 border-b border-outline-variant">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search symbol or company…"
              className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface text-sm px-2 py-1.5 focus:border-primary focus:outline-none font-data-mono"
            />
          </div>
          <div ref={listRef} className="max-h-48 overflow-y-auto">
            {loading && (
              <div className="px-3 py-2 text-[11px] text-on-surface-variant font-label-caps">Searching…</div>
            )}
            {!loading && query.trim() === '' && (
              <div className="px-3 py-2 text-[11px] text-on-surface-variant font-label-caps">Type to search securities</div>
            )}
            {!loading && query.trim() !== '' && results.length === 0 && (
              <div className="px-3 py-2 text-[11px] text-on-surface-variant font-label-caps">No results found</div>
            )}
            {results.map((s, i) => (
              <button
                key={s.id}
                ref={el => { itemRefs.current[i] = el; }}
                type="button"
                onClick={() => select(s)}
                onMouseEnter={() => setFocusedIndex(i)}
                className={`w-full text-left px-3 py-2 flex flex-col gap-0.5 transition-colors border-l-2 ${
                  value?.id === s.id
                    ? 'bg-primary/20 text-primary border-l-primary'
                    : focusedIndex === i
                      ? 'bg-surface-container-high border-l-primary text-on-surface'
                      : 'border-l-transparent text-on-surface'
                }`}
              >
                <span className="font-data-mono text-sm font-bold">{s.symbol}</span>
                <span className="text-[10px] text-on-surface-variant truncate">{s.name_of_company}</span>
              </button>
            ))}
          </div>
          {value && (
            <div className="border-t border-outline-variant p-1">
              <button
                type="button"
                onClick={() => { onChange(null); setOpen(false); setQuery(''); setResults([]); }}
                className="w-full text-center text-[10px] font-label-caps text-on-surface-variant hover:text-tertiary py-1 transition-colors"
              >
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const BUY_ROWS = [
  { account: 'ACC_9821-X', firm: 'Alpha Strategies LP', qty: 500, price: 174.55, margin: '$17,455.00' },
  { account: 'ACC_5521-A', firm: 'Global Growth Fund', qty: 750, price: 174.50, margin: '$26,175.00' },
  { account: 'ACC_3312-B', firm: 'Nexus Capital Mgmt', qty: 300, price: 174.60, margin: '$10,476.00' },
  { account: 'ACC_7741-C', firm: 'Vertex Asset Partners', qty: 600, price: 174.55, margin: '$20,946.00' },
];

const SELL_ROWS = [
  { account: 'ACC_9821-X', firm: 'Alpha Strategies LP', holding: 2500, sellQty: 1250, price: 174.58, pnl: '+$4,210.00', pnlPositive: true },
  { account: 'ACC_5521-A', firm: 'Global Growth Fund', holding: 10000, sellQty: 5000, price: 174.58, pnl: '-$1,840.50', pnlPositive: false },
  { account: 'ACC_3312-B', firm: 'Nexus Capital Mgmt', holding: 1800, sellQty: 900, price: 174.55, pnl: '+$2,106.00', pnlPositive: true },
];

const PCT_OPTIONS = ['25%', '33%', '50%', '75%'];

export default function BulkOrderPage() {
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [exitType, setExitType] = useState<'full' | 'partial'>('partial');
  const [activePct, setActivePct] = useState('50%');
  const [buyRows, setBuyRows] = useState(BUY_ROWS);
  const [sellRows, setSellRows] = useState(SELL_ROWS);
  const [buySelected, setBuySelected] = useState<boolean[]>(BUY_ROWS.map(() => true));
  const [sellSelected, setSellSelected] = useState<boolean[]>(SELL_ROWS.map(() => false));

  const [selectedSecurity, setSelectedSecurity] = useState<SecurityOption | null>(null);

  // Position Sizing Calculator — store as strings so trailing dots aren't eaten
  const [entryPrice, setEntryPrice] = useState('');
  const [exitPrice, setExitPrice]   = useState('');
  const [riskPct, setRiskPct]       = useState(1.00);

  const entryNum = parseFloat(entryPrice);
  const exitNum  = parseFloat(exitPrice);
  const hasValidInputs = entryPrice.trim() !== '' && exitPrice.trim() !== '' && !isNaN(entryNum) && !isNaN(exitNum) && entryNum > 0 && riskPct > 0;
  const pnlPct = hasValidInputs ? ((exitNum - entryNum) / entryNum) * 100 : null;
  const positionSize = pnlPct != null && pnlPct !== 0 ? (100 / (pnlPct * -1)) * riskPct : null;

  const allBuySelected = buySelected.every(Boolean);
  const allSellSelected = sellSelected.every(Boolean);

  const selectedBuyQty = buyRows.reduce((sum, r, i) => sum + (buySelected[i] ? r.qty : 0), 0);
  const selectedBuyAccounts = buySelected.filter(Boolean).length;
  const selectedSellQty = sellRows.reduce((sum, r, i) => sum + (sellSelected[i] ? r.sellQty : 0), 0);
  const selectedSellAccounts = sellSelected.filter(Boolean).length;

  return (
    <div className="p-6 min-h-full overflow-y-auto bg-background">
      <div className="flex flex-col gap-6 max-w-7xl mx-auto">

        {/* Ticker / Symbol Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-surface-container border border-outline-variant p-4 gap-4">
          <div className="flex items-center gap-6">
            <div>
              <label className="block font-label-caps text-[10px] text-on-surface-variant mb-1 uppercase">Security</label>
              <SecurityDropdown value={selectedSecurity} onChange={setSelectedSecurity} />
            </div>
            <div className="h-10 w-px bg-outline-variant/30" />
            <div className="flex gap-6">
              <div>
                <p className="font-label-caps text-[10px] text-on-surface-variant mb-1">BID</p>
                <p className="font-data-mono text-secondary text-sm">174.52 <span className="text-[10px] opacity-60">x 400</span></p>
              </div>
              <div>
                <p className="font-label-caps text-[10px] text-on-surface-variant mb-1">ASK</p>
                <p className="font-data-mono text-tertiary text-sm">174.58 <span className="text-[10px] opacity-60">x 1200</span></p>
              </div>
              <div>
                <p className="font-label-caps text-[10px] text-on-surface-variant mb-1">LAST</p>
                <p className="font-data-mono text-on-surface text-sm">174.55</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-label-caps text-[10px] text-on-surface-variant uppercase">Total Batch Value</p>
              <p className="font-data-mono text-primary text-sm font-bold">$182,455.20</p>
            </div>
            <button className="bg-primary text-on-primary font-label-caps text-xs px-6 py-2.5 font-bold uppercase hover:brightness-110 transition-all flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">bolt</span> Execute Bulk Order (8)
            </button>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-12 gap-6">

          {/* LEFT PANEL */}
          <div className="col-span-12 lg:col-span-8 space-y-0">

            {/* Tab Headers */}
            <div className="flex border-b border-outline-variant bg-surface-container">
              <button
                onClick={() => setActiveTab('buy')}
                className={`px-8 py-3 font-label-caps text-xs tracking-wider uppercase transition-colors flex items-center gap-2 border-b-2 ${
                  activeTab === 'buy'
                    ? 'border-primary text-primary bg-surface-container-high'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/50'
                }`}
              >
                <span className="material-symbols-outlined text-sm">shopping_cart</span> Buy Orders
              </button>
              <button
                onClick={() => setActiveTab('sell')}
                className={`px-8 py-3 font-label-caps text-xs tracking-wider uppercase transition-colors flex items-center gap-2 border-b-2 ${
                  activeTab === 'sell'
                    ? 'border-primary text-primary bg-surface-container-high'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/50'
                }`}
              >
                <span className="material-symbols-outlined text-sm">sell</span> Sell Orders
              </button>
            </div>

            {/* BUY TAB */}
            {activeTab === 'buy' && (
              <div className="space-y-6 mt-6">
                {/* Position Sizing Calculator */}
                <section className="bg-surface-container border border-outline-variant">
                  <div className="bg-surface-container-high px-4 py-2 border-b border-outline-variant flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-sm">calculate</span>
                      <h2 className="font-label-caps text-label-caps text-on-surface uppercase">Position Sizing Calculator</h2>
                    </div>
                    <button
                      onClick={() => { setEntryPrice(''); setExitPrice(''); setRiskPct(1.00); }}
                      className="flex items-center gap-1 font-label-caps text-[10px] uppercase text-on-surface-variant hover:text-on-surface border border-outline-variant hover:border-outline bg-surface-container px-2 py-1 transition-colors"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>restart_alt</span>
                      Reset
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-surface-container-high border-b border-outline-variant font-label-caps text-[10px] text-on-surface-variant uppercase">
                          <th className="px-4 py-2">Entry Price</th>
                          <th className="px-4 py-2">Stop Loss / Exit Price</th>
                          <th className="px-4 py-2">Risk Per Trade (%)</th>
                          <th className="px-4 py-2 text-right">P&amp;L %</th>
                          <th className="px-4 py-2 text-right">Position Size</th>
                        </tr>
                      </thead>
                      <tbody className="font-data-mono text-sm">
                        <tr className="hover:bg-surface-container-high transition-colors">
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={entryPrice}
                              onChange={e => setEntryPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                              className="w-36 bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={exitPrice}
                              onChange={e => setExitPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                              className="w-36 bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="relative inline-flex items-center">
                              <input
                                type="number"
                                step="0.25"
                                min="0"
                                value={riskPct}
                                onChange={e => setRiskPct(Number(e.target.value))}
                                className="w-28 bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-3 py-1.5 pr-6 text-sm focus:border-primary focus:outline-none"
                              />
                              <span className="absolute right-2 text-[10px] text-on-surface-variant pointer-events-none">%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {pnlPct != null ? (
                              <span className={`px-2 py-0.5 rounded text-sm ${pnlPct >= 0 ? 'bg-secondary/10 text-secondary' : 'bg-tertiary/10 text-tertiary'}`}>
                                {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                              </span>
                            ) : (
                              <span className="text-on-surface-variant text-sm">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-on-surface">
                            {positionSize != null ? `${positionSize.toFixed(2)}%` : <span className="text-on-surface-variant font-normal">—</span>}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Bulk Buy Table */}
                <section className="bg-surface-container border border-outline-variant">
                  <div className="bg-surface-container-high px-4 py-2 border-b border-outline-variant flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <h2 className="font-label-caps text-label-caps text-on-surface uppercase">Bulk Buy Management</h2>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="select-all-buy"
                          checked={allBuySelected}
                          onChange={e => setBuySelected(buySelected.map(() => e.target.checked))}
                          className="w-3 h-3 bg-surface-container-lowest border-outline-variant rounded-sm text-primary focus:ring-0"
                        />
                        <label htmlFor="select-all-buy" className="font-label-caps text-[10px] text-on-surface-variant cursor-pointer uppercase">Select All</label>
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-outline-variant bg-surface-container-low font-label-caps text-[10px] text-on-surface-variant">
                          <th className="px-4 py-2 w-8"></th>
                          <th className="px-4 py-2">Account / User</th>
                          <th className="px-4 py-2">Side</th>
                          <th className="px-4 py-2 text-right">Buy Qty</th>
                          <th className="px-4 py-2 text-right">Limit Price</th>
                          <th className="px-4 py-2 text-right">Est. Margin</th>
                          <th className="px-4 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="font-data-mono text-xs divide-y divide-outline-variant/10">
                        {buyRows.map((row, i) => (
                          <tr key={row.account} className="hover:bg-surface-container-high transition-colors">
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={buySelected[i]}
                                onChange={e => {
                                  const next = [...buySelected];
                                  next[i] = e.target.checked;
                                  setBuySelected(next);
                                }}
                                className="w-3 h-3 bg-surface-container-lowest border-outline-variant rounded-sm text-primary focus:ring-0"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <span className="text-primary font-bold">{row.account}</span>
                                <span className="text-[9px] text-on-surface-variant uppercase tracking-tighter">{row.firm}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 bg-secondary-container/20 text-secondary text-[9px] font-bold border border-secondary/20">BUY</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <input
                                type="number"
                                value={row.qty}
                                onChange={e => {
                                  const next = [...buyRows];
                                  next[i] = { ...next[i], qty: Number(e.target.value) };
                                  setBuyRows(next);
                                }}
                                className="bg-surface-container-lowest border border-outline-variant/50 w-20 px-2 py-1 text-right text-xs focus:border-primary focus:outline-none"
                              />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <input
                                type="number"
                                value={row.price}
                                onChange={e => {
                                  const next = [...buyRows];
                                  next[i] = { ...next[i], price: Number(e.target.value) };
                                  setBuyRows(next);
                                }}
                                className="bg-surface-container-lowest border border-outline-variant/50 w-24 px-2 py-1 text-right text-xs focus:border-primary focus:outline-none"
                              />
                            </td>
                            <td className="px-4 py-3 text-right text-on-surface-variant">{row.margin}</td>
                            <td className="px-4 py-3"><span className="text-[9px] text-secondary font-bold uppercase">Ready</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}

            {/* SELL TAB */}
            {activeTab === 'sell' && (
              <div className="space-y-6 mt-6">
                {/* Global Exit Control */}
                <section className="bg-surface-container border border-outline-variant">
                  <div className="bg-surface-container-high px-4 py-2 border-b border-outline-variant flex items-center gap-2">
                    <span className="material-symbols-outlined text-tertiary text-sm">output</span>
                    <h2 className="font-label-caps text-label-caps text-on-surface uppercase">Global Exit Control</h2>
                  </div>
                  <div className="p-4 flex flex-col md:flex-row gap-6 items-center">
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          id="exit-full"
                          name="exit-type"
                          value="full"
                          checked={exitType === 'full'}
                          onChange={() => setExitType('full')}
                          className="w-4 h-4 text-tertiary bg-surface-container-lowest border-outline-variant focus:ring-0"
                        />
                        <label htmlFor="exit-full" className="font-label-caps text-xs text-on-surface uppercase cursor-pointer">Sell Full Quantity</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          id="exit-partial"
                          name="exit-type"
                          value="partial"
                          checked={exitType === 'partial'}
                          onChange={() => setExitType('partial')}
                          className="w-4 h-4 text-tertiary bg-surface-container-lowest border-outline-variant focus:ring-0"
                        />
                        <label htmlFor="exit-partial" className="font-label-caps text-xs text-on-surface uppercase cursor-pointer">Partial Quantity</label>
                      </div>
                    </div>
                    <div className="h-10 w-px bg-outline-variant/30 hidden md:block" />
                    <div className="flex flex-1 items-center gap-2 w-full md:w-auto">
                      <label className="font-label-caps text-[10px] text-on-surface-variant uppercase whitespace-nowrap">Calc Holding %</label>
                      <div className="flex bg-surface-container-lowest border border-outline-variant p-0.5 rounded-sm w-full">
                        {PCT_OPTIONS.map(pct => (
                          <button
                            key={pct}
                            onClick={() => setActivePct(pct)}
                            className={`flex-1 py-1 text-[10px] font-bold font-data-mono transition-colors ${
                              activePct === pct ? 'bg-tertiary text-on-tertiary' : 'hover:bg-tertiary/20 text-on-surface'
                            }`}
                          >
                            {pct}
                          </button>
                        ))}
                        <input
                          className="w-16 bg-transparent border-l border-outline-variant text-[10px] text-center font-data-mono focus:outline-none py-0"
                          placeholder="Custom"
                          type="text"
                        />
                      </div>
                    </div>
                  </div>
                </section>

                {/* Bulk Sell Table */}
                <section className="bg-surface-container border border-outline-variant">
                  <div className="bg-surface-container-high px-4 py-2 border-b border-outline-variant flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <h2 className="font-label-caps text-label-caps text-on-surface uppercase">Bulk Sell Management</h2>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="select-all-sell"
                          checked={allSellSelected}
                          onChange={e => setSellSelected(sellSelected.map(() => e.target.checked))}
                          className="w-3 h-3 bg-surface-container-lowest border-outline-variant rounded-sm text-tertiary focus:ring-0"
                        />
                        <label htmlFor="select-all-sell" className="font-label-caps text-[10px] text-on-surface-variant cursor-pointer uppercase">Select All</label>
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-outline-variant bg-surface-container-low font-label-caps text-[10px] text-on-surface-variant">
                          <th className="px-4 py-2 w-8"></th>
                          <th className="px-4 py-2">Account / User</th>
                          <th className="px-4 py-2 text-right">Current Holding</th>
                          <th className="px-4 py-2 text-right">Sell Qty ({activePct})</th>
                          <th className="px-4 py-2 text-right">Limit Price</th>
                          <th className="px-4 py-2 text-right">Unrealized P/L</th>
                          <th className="px-4 py-2">Action</th>
                        </tr>
                      </thead>
                      <tbody className="font-data-mono text-xs divide-y divide-outline-variant/10">
                        {sellRows.map((row, i) => (
                          <tr key={row.account} className={`hover:bg-surface-container-high transition-colors ${i % 2 === 1 ? 'bg-surface-container-low/30' : ''}`}>
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={sellSelected[i]}
                                onChange={e => {
                                  const next = [...sellSelected];
                                  next[i] = e.target.checked;
                                  setSellSelected(next);
                                }}
                                className="w-3 h-3 bg-surface-container-lowest border-outline-variant rounded-sm text-tertiary focus:ring-0"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <span className="text-primary font-bold">{row.account}</span>
                                <span className="text-[9px] text-on-surface-variant uppercase tracking-tighter">{row.firm}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">{row.holding.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right">
                              <input
                                type="number"
                                value={row.sellQty}
                                onChange={e => {
                                  const next = [...sellRows];
                                  next[i] = { ...next[i], sellQty: Number(e.target.value) };
                                  setSellRows(next);
                                }}
                                className="bg-surface-container-lowest border border-tertiary/50 w-20 px-2 py-1 text-right text-xs focus:border-tertiary focus:outline-none"
                              />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <input
                                type="number"
                                value={row.price}
                                onChange={e => {
                                  const next = [...sellRows];
                                  next[i] = { ...next[i], price: Number(e.target.value) };
                                  setSellRows(next);
                                }}
                                className="bg-surface-container-lowest border border-outline-variant/50 w-24 px-2 py-1 text-right text-xs focus:outline-none"
                              />
                            </td>
                            <td className={`px-4 py-3 text-right ${row.pnlPositive ? 'text-secondary' : 'text-tertiary'}`}>{row.pnl}</td>
                            <td className="px-4 py-3">
                              <button className="bg-tertiary-container/20 border border-tertiary/30 text-tertiary font-label-caps text-[9px] px-2 py-1 uppercase hover:bg-tertiary/40 transition-colors">Sell</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}

            {/* Batch Footer Actions */}
            <div className="bg-surface-container-low p-3 border-x border-b border-outline-variant flex justify-between items-center mt-0">
              <div className="flex gap-4 text-[10px] font-label-caps text-on-surface-variant uppercase">
                {activeTab === 'buy' ? (
                  <>
                    <span>Selected Quantity: <span className="text-on-surface font-data-mono">{selectedBuyQty.toLocaleString()}</span></span>
                    <span>Accounts: <span className="text-on-surface font-data-mono">{selectedBuyAccounts} of {buyRows.length}</span></span>
                  </>
                ) : (
                  <>
                    <span>Selected Quantity: <span className="text-on-surface font-data-mono">{selectedSellQty.toLocaleString()}</span></span>
                    <span>Accounts: <span className="text-on-surface font-data-mono">{selectedSellAccounts} of {sellRows.length}</span></span>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <button className="text-[10px] font-label-caps px-3 py-1 bg-surface-variant hover:bg-outline-variant transition-colors uppercase">Preview Batch</button>
                <button className="text-[10px] font-label-caps px-3 py-1 bg-surface-variant hover:bg-outline-variant transition-colors uppercase">Reset</button>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            {/* Aggregate Positions */}
            <section className="bg-surface-container border border-outline-variant">
              <div className="bg-surface-container-high px-4 py-2 border-b border-outline-variant">
                <h2 className="font-label-caps text-label-caps text-on-surface uppercase">Aggregate Positions</h2>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex justify-between items-center p-3 bg-surface-container-low border border-outline-variant/30">
                  <div>
                    <p className="font-data-mono text-primary font-bold">NVDA.O</p>
                    <p className="text-[9px] text-on-surface-variant uppercase">Across 4 Accounts</p>
                  </div>
                  <div className="text-right">
                    <p className="font-data-mono text-xs">340 Total Qty</p>
                    <p className="font-data-mono text-secondary text-xs">+$12,410.50</p>
                  </div>
                </div>
                <div className="flex justify-between items-center p-3 bg-surface-container-low border border-outline-variant/30">
                  <div>
                    <p className="font-data-mono text-primary font-bold">AAPL.O</p>
                    <p className="text-[9px] text-on-surface-variant uppercase">Across 6 Accounts</p>
                  </div>
                  <div className="text-right">
                    <p className="font-data-mono text-xs">820 Total Qty</p>
                    <p className="font-data-mono text-tertiary text-xs">-$3,126.00</p>
                  </div>
                </div>
                <div className="flex justify-between items-center p-3 bg-surface-container-low border border-outline-variant/30">
                  <div>
                    <p className="font-data-mono text-primary font-bold">TSLA.O</p>
                    <p className="text-[9px] text-on-surface-variant uppercase">Across 8 Accounts</p>
                  </div>
                  <div className="text-right">
                    <p className="font-data-mono text-xs">2,150 Total Qty</p>
                    <p className="font-data-mono text-secondary text-xs">+$7,832.00</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Completed Batches */}
            <section className="bg-surface-container border border-outline-variant">
              <div className="bg-surface-container-high px-4 py-2 border-b border-outline-variant">
                <h2 className="font-label-caps text-label-caps text-on-surface uppercase">Completed Batches (24h)</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-outline-variant bg-surface-container-low font-label-caps text-[10px] text-on-surface-variant">
                      <th className="px-4 py-2">Time</th>
                      <th className="px-4 py-2">Batch ID</th>
                      <th className="px-4 py-2 text-right">Accs</th>
                      <th className="px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="font-data-mono text-xs divide-y divide-outline-variant/10">
                    {[
                      { time: '14:15:02', id: 'B_99120', accs: 12 },
                      { time: '11:42:31', id: 'B_99118', accs: 8 },
                      { time: '09:30:14', id: 'B_99115', accs: 5 },
                      { time: '08:01:55', id: 'B_99112', accs: 10 },
                    ].map(batch => (
                      <tr key={batch.id} className="hover:bg-surface-container-high transition-colors">
                        <td className="px-4 py-3 text-on-surface-variant">{batch.time}</td>
                        <td className="px-4 py-3 text-on-surface">{batch.id}</td>
                        <td className="px-4 py-3 text-right">{batch.accs}</td>
                        <td className="px-4 py-3"><span className="text-secondary text-[10px] font-bold">FILLED</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>

        {/* Status Footer */}
        <footer className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-auto">
          <div className="bg-surface-container p-3 border-l-2 border-secondary flex items-center gap-3">
            <span className="material-symbols-outlined text-secondary text-sm">cloud_done</span>
            <div>
              <p className="font-label-caps text-[9px] text-on-surface-variant uppercase">OMS Connectivity</p>
              <p className="font-data-mono text-xs text-on-surface uppercase">Operational (12ms)</p>
            </div>
          </div>
          <div className="bg-surface-container p-3 border-l-2 border-primary flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-sm">history</span>
            <div>
              <p className="font-label-caps text-[9px] text-on-surface-variant uppercase">Last Settlement</p>
              <p className="font-data-mono text-xs text-on-surface uppercase">04:00 UTC</p>
            </div>
          </div>
          <div className="bg-surface-container p-3 border-l-2 border-outline flex items-center gap-3">
            <span className="material-symbols-outlined text-on-surface-variant text-sm">hub</span>
            <div>
              <p className="font-label-caps text-[9px] text-on-surface-variant uppercase">Exchange Status</p>
              <p className="font-data-mono text-xs text-on-surface uppercase">NASDAQ — OPEN</p>
            </div>
          </div>
          <div className="bg-surface-container p-3 border-l-2 border-secondary flex items-center gap-3">
            <span className="material-symbols-outlined text-secondary text-sm">security</span>
            <div>
              <p className="font-label-caps text-[9px] text-on-surface-variant uppercase">Risk Status</p>
              <p className="font-data-mono text-xs text-on-surface uppercase">Limits Nominal</p>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
}
