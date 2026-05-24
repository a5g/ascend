import { useState, useEffect, useRef, useMemo } from 'react';

// ── Security dropdown ─────────────────────────────────────────────────────────

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
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
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
    if (focusedIndex >= 0) itemRefs.current[focusedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [focusedIndex]);

  function select(s: SecurityOption) {
    onChange(s); setOpen(false); setQuery(''); setResults([]); setFocusedIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocusedIndex(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setFocusedIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); const t = focusedIndex >= 0 ? results[focusedIndex] : results[0]; if (t) select(t); }
    else if (e.key === 'Escape') setOpen(false);
  }

  return (
    <div ref={ref} className="relative w-56">
      <button type="button" onClick={() => { setOpen(o => !o); if (!open) { setQuery(''); setResults([]); } }}
        className="w-full flex items-center justify-between bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-3 py-1.5 text-sm focus:border-primary focus:outline-none hover:border-primary transition-colors">
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
            <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="Search symbol or company…"
              className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface text-sm px-2 py-1.5 focus:border-primary focus:outline-none font-data-mono" />
          </div>
          <div ref={listRef} className="max-h-48 overflow-y-auto">
            {loading && <div className="px-3 py-2 text-[11px] text-on-surface-variant font-label-caps">Searching…</div>}
            {!loading && query.trim() === '' && <div className="px-3 py-2 text-[11px] text-on-surface-variant font-label-caps">Type to search securities</div>}
            {!loading && query.trim() !== '' && results.length === 0 && <div className="px-3 py-2 text-[11px] text-on-surface-variant font-label-caps">No results found</div>}
            {results.map((s, i) => (
              <button key={s.id} ref={el => { itemRefs.current[i] = el; }} type="button"
                onClick={() => select(s)} onMouseEnter={() => setFocusedIndex(i)}
                className={`w-full text-left px-3 py-2 flex flex-col gap-0.5 transition-colors border-l-2 ${
                  value?.id === s.id ? 'bg-primary/20 text-primary border-l-primary'
                  : focusedIndex === i ? 'bg-surface-container-high border-l-primary text-on-surface'
                  : 'border-l-transparent text-on-surface'}`}>
                <span className="font-data-mono text-sm font-bold">{s.symbol}</span>
                <span className="text-[10px] text-on-surface-variant truncate">{s.name_of_company}</span>
              </button>
            ))}
          </div>
          {value && (
            <div className="border-t border-outline-variant p-1">
              <button type="button" onClick={() => { onChange(null); setOpen(false); setQuery(''); setResults([]); }}
                className="w-full text-center text-[10px] font-label-caps text-on-surface-variant hover:text-tertiary py-1 transition-colors">
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface BuyUser {
  zerodha_user_id: string;
  name: string | null;
  capital: number | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SELL_ROWS = [
  { account: 'ACC_9821-X', firm: 'Alpha Strategies LP', holding: 2500, sellQty: 1250, price: 174.58, pnl: '+$4,210.00', pnlPositive: true },
  { account: 'ACC_5521-A', firm: 'Global Growth Fund', holding: 10000, sellQty: 5000, price: 174.58, pnl: '-$1,840.50', pnlPositive: false },
  { account: 'ACC_3312-B', firm: 'Nexus Capital Mgmt', holding: 1800, sellQty: 900, price: 174.55, pnl: '+$2,106.00', pnlPositive: true },
];

const PCT_OPTIONS = ['25%', '33%', '50%', '75%'];
const EXCHANGE = 'NSE';

const inrFmt = (v: number) => Math.floor(v).toLocaleString('en-IN');

// ── Main component ────────────────────────────────────────────────────────────

export default function BulkOrderPage() {
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [exitType, setExitType] = useState<'full' | 'partial'>('partial');
  const [activePct, setActivePct] = useState('50%');
  const [sellRows, setSellRows] = useState(SELL_ROWS);
  const [sellSelected, setSellSelected] = useState<boolean[]>(SELL_ROWS.map(() => false));

  const [selectedSecurity, setSelectedSecurity] = useState<SecurityOption | null>(null);

  // Position Sizing Calculator
  const [entryPrice, setEntryPrice] = useState('');
  const [exitPrice, setExitPrice] = useState('');
  const [riskPct, setRiskPct] = useState(1.00);

  const entryNum = parseFloat(entryPrice);
  const exitNum  = parseFloat(exitPrice);
  const hasValidInputs = entryPrice.trim() !== '' && exitPrice.trim() !== '' && !isNaN(entryNum) && !isNaN(exitNum) && entryNum > 0 && riskPct > 0;
  const pnlPct = hasValidInputs ? ((exitNum - entryNum) / entryNum) * 100 : null;
  const positionSize = pnlPct != null && pnlPct !== 0 ? (100 / (pnlPct * -1)) * riskPct : null;

  // Buy management
  const [buyUsers, setBuyUsers] = useState<BuyUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [qtyOverrides, setQtyOverrides] = useState<Record<string, string>>({});
  const [buySelected, setBuySelected] = useState<Record<string, boolean>>({});
  const [order_type, setOrderType] = useState<'LIMIT' | 'MARKET'>('LIMIT');
  const [orderStatus, setOrderStatus] = useState<Record<string, 'idle' | 'loading' | 'success' | 'error'>>({});
  const [orderMessage, setOrderMessage] = useState<Record<string, string>>({});
  const [bulkPlacing, setBulkPlacing] = useState(false);
  const [margins, setMargins] = useState<Record<string, number | null>>({});

  useEffect(() => {
    setLoadingUsers(true);
    fetch('/api/users/active')
      .then(r => r.json())
      .then(({ data }) => {
        const users: BuyUser[] = data ?? [];
        setBuyUsers(users);
        const sel: Record<string, boolean> = {};
        users.forEach(u => { sel[u.zerodha_user_id] = true; });
        setBuySelected(sel);
        // Fetch margins for each user in parallel
        users.forEach(u => {
          fetch(`/api/users/${encodeURIComponent(u.zerodha_user_id)}/margins`)
            .then(r => r.json())
            .then(res => setMargins(m => ({ ...m, [u.zerodha_user_id]: res?.data?.live_balance ?? null })))
            .catch(() => setMargins(m => ({ ...m, [u.zerodha_user_id]: null })));
        });
      })
      .catch(() => {})
      .finally(() => setLoadingUsers(false));
  }, []);

  // Reset qty overrides when calculator values change
  useEffect(() => { setQtyOverrides({}); }, [positionSize, entryNum]);

  function computedQty(capital: number | null): number {
    if (positionSize == null || !isFinite(entryNum) || entryNum <= 0 || !capital || capital <= 0) return 0;
    return Math.floor((capital * positionSize / 100) / entryNum);
  }

  function effectiveQty(u: BuyUser): number {
    const ov = qtyOverrides[u.zerodha_user_id];
    if (ov !== undefined) return parseInt(ov, 10) || 0;
    return computedQty(u.capital);
  }

  function qtyInputValue(u: BuyUser): string {
    const ov = qtyOverrides[u.zerodha_user_id];
    if (ov !== undefined) return ov;
    return String(computedQty(u.capital));
  }

  const allBuySelected = useMemo(
    () => buyUsers.length > 0 && buyUsers.every(u => buySelected[u.zerodha_user_id]),
    [buyUsers, buySelected]
  );
  const selectedBuyCount = useMemo(
    () => buyUsers.filter(u => buySelected[u.zerodha_user_id]).length,
    [buyUsers, buySelected]
  );

  async function placeSingleOrder(u: BuyUser) {
    if (!selectedSecurity) return;
    const qty = effectiveQty(u);
    if (qty <= 0) return;
    setOrderStatus(s => ({ ...s, [u.zerodha_user_id]: 'loading' }));
    setOrderMessage(m => ({ ...m, [u.zerodha_user_id]: '' }));
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zerodha_user_id:    u.zerodha_user_id,
          exchange:           EXCHANGE,
          tradingSymbol:      selectedSecurity.symbol,
          transaction_type:   'BUY',
          order_type,
          price:              entryNum,
          qty,
          variety:            'regular',
          product:            'CNC',
          validity:           'DAY',
          disclosed_quantity: 0,
          trigger_price:      0,
          squareoff:          0,
          stoploss:           0,
          trailing_stoploss:  0,
        }),
      });
      const data = await res.json() as any;
      if (!res.ok) {
        setOrderStatus(s => ({ ...s, [u.zerodha_user_id]: 'error' }));
        setOrderMessage(m => ({ ...m, [u.zerodha_user_id]: data?.error || 'Failed' }));
      } else {
        setOrderStatus(s => ({ ...s, [u.zerodha_user_id]: 'success' }));
        setOrderMessage(m => ({ ...m, [u.zerodha_user_id]: data?.data?.order_id ? `#${data.data.order_id}` : 'Placed' }));
      }
    } catch {
      setOrderStatus(s => ({ ...s, [u.zerodha_user_id]: 'error' }));
      setOrderMessage(m => ({ ...m, [u.zerodha_user_id]: 'Network error' }));
    }
  }

  async function placeBulkOrders() {
    const targets = buyUsers.filter(u => {
      if (!buySelected[u.zerodha_user_id] || effectiveQty(u) <= 0) return false;
      const margin = margins[u.zerodha_user_id];
      const amount = effectiveQty(u) * entryNum;
      if (margin != null && amount > margin) return false;
      return true;
    });
    if (!targets.length) return;
    setBulkPlacing(true);
    await Promise.allSettled(targets.map(u => placeSingleOrder(u)));
    setBulkPlacing(false);
  }

  const allSellSelected = sellSelected.every(Boolean);
  const selectedSellQty = sellRows.reduce((sum, r, i) => sum + (sellSelected[i] ? r.sellQty : 0), 0);
  const selectedSellAccounts = sellSelected.filter(Boolean).length;

  return (
    <div className="p-6 min-h-full overflow-y-auto bg-background">
      <div className="max-w-[1600px] mx-auto space-y-6">

        {/* Ticker / Symbol Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-surface-container border border-outline-variant p-4 gap-4">
          <div className="flex items-center gap-6">
            <div>
              <label className="block font-label-caps text-[10px] text-on-surface-variant mb-1 uppercase">Security</label>
              <SecurityDropdown value={selectedSecurity} onChange={setSelectedSecurity} />
            </div>
            {selectedSecurity && (
              <>
                <div className="h-10 w-px bg-outline-variant/30" />
                <div>
                  <p className="font-label-caps text-[10px] text-on-surface-variant mb-1">Series / Exchange</p>
                  <p className="font-data-mono text-on-surface text-sm tracking-widest">
                    {selectedSecurity.series}&nbsp;&nbsp;{EXCHANGE}
                  </p>
                </div>
              </>
            )}
            <div className="h-10 w-px bg-outline-variant/30" />
            <div>
              <p className="font-label-caps text-[10px] text-on-surface-variant mb-1">LAST</p>
              <p className="font-data-mono text-on-surface text-sm">174.55</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-label-caps text-[10px] text-on-surface-variant uppercase">Total Batch Value</p>
              <p className="font-data-mono text-primary text-sm font-bold">$182,455.20</p>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-12 gap-6">

          {/* LEFT PANEL */}
          <div className="col-span-12 lg:col-span-8 space-y-0">

            {/* Tab Headers */}
            <div className="flex border-b border-outline-variant bg-surface-container">
              {(['buy', 'sell'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-8 py-3 font-label-caps text-xs tracking-wider uppercase transition-colors flex items-center gap-2 border-b-2 ${
                    activeTab === tab
                      ? 'border-primary text-primary bg-surface-container-high'
                      : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/50'
                  }`}>
                  <span className="material-symbols-outlined text-sm">{tab === 'buy' ? 'shopping_cart' : 'sell'}</span>
                  {tab === 'buy' ? 'Buy Orders' : 'Sell Orders'}
                </button>
              ))}
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
                    <button onClick={() => { setEntryPrice(''); setExitPrice(''); setRiskPct(1.00); setQtyOverrides({}); setOrderStatus({}); setOrderMessage({}); }}
                      className="flex items-center gap-1 font-label-caps text-[10px] uppercase text-on-surface-variant hover:text-on-surface border border-outline-variant hover:border-outline bg-surface-container px-2 py-1 transition-colors">
                      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>restart_alt</span>
                      Reset
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse table-fixed">
                      <colgroup>
                        <col className="w-44" /><col className="w-52" /><col className="w-40" /><col className="w-32" /><col className="w-32" />
                      </colgroup>
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
                            <input type="text" inputMode="decimal" value={entryPrice}
                              onChange={e => setEntryPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                              className="w-36 bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-3 py-1.5 text-sm focus:border-primary focus:outline-none" />
                          </td>
                          <td className="px-4 py-3">
                            <input type="text" inputMode="decimal" value={exitPrice}
                              onChange={e => setExitPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                              className="w-36 bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-3 py-1.5 text-sm focus:border-primary focus:outline-none" />
                          </td>
                          <td className="px-4 py-3">
                            <div className="relative inline-flex items-center">
                              <input type="number" step="0.25" min="0" value={riskPct}
                                onChange={e => setRiskPct(Number(e.target.value))}
                                className="w-28 bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-3 py-1.5 pr-6 text-sm focus:border-primary focus:outline-none" />
                              <span className="absolute right-2 text-[10px] text-on-surface-variant pointer-events-none">%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {pnlPct != null ? (
                              <span className={`px-2 py-0.5 rounded text-sm ${pnlPct >= 0 ? 'bg-secondary/10 text-secondary' : 'bg-tertiary/10 text-tertiary'}`}>
                                {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                              </span>
                            ) : <span className="text-on-surface-variant text-sm">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-on-surface">
                            {positionSize != null ? `${positionSize.toFixed(2)}%` : <span className="text-on-surface-variant font-normal">—</span>}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Bulk Buy Management */}
                <section className="bg-surface-container border border-outline-variant">
                  <div className="bg-surface-container-high px-4 py-2 border-b border-outline-variant flex flex-wrap justify-between items-center gap-3">
                    <div className="flex items-center gap-4">
                      <h2 className="font-label-caps text-label-caps text-on-surface uppercase">Bulk Buy Management</h2>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id="select-all-buy" checked={allBuySelected}
                          onChange={e => {
                            const sel: Record<string, boolean> = {};
                            buyUsers.forEach(u => { sel[u.zerodha_user_id] = e.target.checked; });
                            setBuySelected(sel);
                          }}
                          className="w-3 h-3 bg-surface-container-lowest border-outline-variant rounded-sm text-primary focus:ring-0" />
                        <label htmlFor="select-all-buy" className="font-label-caps text-[10px] text-on-surface-variant cursor-pointer uppercase">Select All</label>
                      </div>
                    </div>
                    {/* Order type toggle */}
                    <div className="flex items-center gap-3">
                      <span className="font-label-caps text-[10px] text-on-surface-variant uppercase">Order Type</span>
                      <div className="flex bg-surface-container-lowest border border-outline-variant p-0.5">
                        {(['LIMIT', 'MARKET'] as const).map(ot => (
                          <button key={ot} type="button" onClick={() => setOrderType(ot)}
                            className={`px-4 py-1 font-label-caps text-[10px] uppercase transition-colors ${
                              order_type === ot
                                ? 'bg-primary text-on-primary'
                                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                            }`}>
                            {ot}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left table-fixed">
                      <colgroup>
                        <col className="w-8" />
                        <col className="w-44" />
                        <col className="w-32" />
                        <col className="w-32" />
                        <col className="w-20" />
                        <col className="w-28" />
                        <col className="w-28" />
                        <col className="w-28" />
                      </colgroup>
                      <thead>
                        <tr className="border-b border-outline-variant bg-surface-container-low font-label-caps text-[10px] text-on-surface-variant uppercase">
                          <th className="px-4 py-2"></th>
                          <th className="px-4 py-2">Account / User</th>
                          <th className="px-4 py-2 text-right">Capital</th>
                          <th className="px-4 py-2 text-right">Risk Amount</th>
                          <th className="px-2 py-2 text-right">Qty</th>
                          <th className="px-4 py-2 text-right">Amount</th>
                          <th className="px-4 py-2 text-right">Margin</th>
                          <th className="px-4 py-2 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="font-data-mono text-xs divide-y divide-outline-variant/10">
                        {loadingUsers && (
                          <tr>
                            <td colSpan={6} className="px-4 py-6 text-center text-on-surface-variant font-label-caps text-[10px]">
                              Loading users…
                            </td>
                          </tr>
                        )}
                        {!loadingUsers && buyUsers.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-4 py-6 text-center text-on-surface-variant font-label-caps text-[10px]">
                              No active users with Zerodha account
                            </td>
                          </tr>
                        )}
                        {buyUsers.map(u => {
                          const qty = effectiveQty(u);
                          const amount = isFinite(entryNum) && entryNum > 0 ? qty * entryNum : null;
                          const status = orderStatus[u.zerodha_user_id] ?? 'idle';
                          const msg = orderMessage[u.zerodha_user_id] ?? '';
                          return (
                            <tr key={u.zerodha_user_id} className="hover:bg-surface-container-high transition-colors">
                              <td className="px-4 py-3">
                                <input type="checkbox" checked={!!buySelected[u.zerodha_user_id]}
                                  onChange={e => setBuySelected(s => ({ ...s, [u.zerodha_user_id]: e.target.checked }))}
                                  className="w-3 h-3 bg-surface-container-lowest border-outline-variant rounded-sm text-primary focus:ring-0" />
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-col">
                                  <span className="text-primary font-bold">{u.zerodha_user_id}</span>
                                  {u.name && <span className="text-[9px] text-on-surface-variant uppercase tracking-tighter">{u.name}</span>}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right text-on-surface-variant">
                                {u.capital != null ? inrFmt(u.capital) : '—'}
                              </td>
                              <td className="px-4 py-3 text-right text-red-400 font-data-mono">
                                {u.capital != null && riskPct > 0
                                  ? inrFmt(u.capital * riskPct / 100)
                                  : '—'}
                              </td>
                              <td className="px-2 py-3 text-right">
                                <input type="text" inputMode="numeric"
                                  value={qtyInputValue(u)}
                                  onChange={e => setQtyOverrides(o => ({ ...o, [u.zerodha_user_id]: e.target.value.replace(/[^0-9]/g, '') }))}
                                  className="bg-surface-container-lowest border border-outline-variant/50 w-16 px-2 py-1 text-right text-xs text-on-surface focus:border-primary focus:outline-none" />
                              </td>
                              <td className="px-4 py-3 text-right text-on-surface-variant">
                                {amount != null && amount > 0 ? inrFmt(amount) : '—'}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {margins[u.zerodha_user_id] === undefined
                                  ? <span className="text-on-surface-variant text-[10px]">…</span>
                                  : margins[u.zerodha_user_id] != null
                                    ? <span className="text-on-surface">{inrFmt(margins[u.zerodha_user_id]!)}</span>
                                    : <span className="text-on-surface-variant">—</span>
                                }
                              </td>
                              <td className="px-4 py-3 text-center">
                                {status === 'loading' ? (
                                  <span className="font-label-caps text-[9px] text-on-surface-variant">Placing…</span>
                                ) : status === 'success' ? (
                                  <span className="font-label-caps text-[9px] text-secondary font-bold">{msg}</span>
                                ) : status === 'error' ? (
                                  <span className="font-label-caps text-[9px] text-tertiary font-bold leading-tight" style={{ wordBreak: 'break-word' }}>{msg || 'Failed'}</span>
                                ) : (
                                  <button
                                    onClick={() => placeSingleOrder(u)}
                                    disabled={!selectedSecurity || qty <= 0 || (margins[u.zerodha_user_id] != null && amount != null && amount > margins[u.zerodha_user_id]!)}
                                    className="bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-label-caps text-[9px] px-3 py-1 uppercase transition-colors">
                                    Buy
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Buy Multiple */}
                  {buyUsers.length > 0 && (
                    <div className="px-4 py-3 border-t border-outline-variant flex justify-end">
                      <button
                        onClick={placeBulkOrders}
                        disabled={bulkPlacing || !selectedSecurity || selectedBuyCount === 0}
                        className="bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-label-caps text-xs px-6 py-2 uppercase font-bold transition-colors flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">shopping_cart</span>
                        {bulkPlacing ? 'Placing…' : `Buy Multiple (${selectedBuyCount})`}
                      </button>
                    </div>
                  )}
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
                      {(['full', 'partial'] as const).map(et => (
                        <div key={et} className="flex items-center gap-2">
                          <input type="radio" id={`exit-${et}`} name="exit-type" value={et} checked={exitType === et}
                            onChange={() => setExitType(et)}
                            className="w-4 h-4 text-tertiary bg-surface-container-lowest border-outline-variant focus:ring-0" />
                          <label htmlFor={`exit-${et}`} className="font-label-caps text-xs text-on-surface uppercase cursor-pointer">
                            {et === 'full' ? 'Sell Full Quantity' : 'Partial Quantity'}
                          </label>
                        </div>
                      ))}
                    </div>
                    <div className="h-10 w-px bg-outline-variant/30 hidden md:block" />
                    <div className="flex flex-1 items-center gap-2 w-full md:w-auto">
                      <label className="font-label-caps text-[10px] text-on-surface-variant uppercase whitespace-nowrap">Calc Holding %</label>
                      <div className="flex bg-surface-container-lowest border border-outline-variant p-0.5 rounded-sm w-full">
                        {PCT_OPTIONS.map(pct => (
                          <button key={pct} onClick={() => setActivePct(pct)}
                            className={`flex-1 py-1 text-[10px] font-bold font-data-mono transition-colors ${
                              activePct === pct ? 'bg-tertiary text-on-tertiary' : 'hover:bg-tertiary/20 text-on-surface'
                            }`}>{pct}</button>
                        ))}
                        <input className="w-16 bg-transparent border-l border-outline-variant text-[10px] text-center font-data-mono focus:outline-none py-0" placeholder="Custom" type="text" />
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
                        <input type="checkbox" id="select-all-sell" checked={allSellSelected}
                          onChange={e => setSellSelected(sellSelected.map(() => e.target.checked))}
                          className="w-3 h-3 bg-surface-container-lowest border-outline-variant rounded-sm text-tertiary focus:ring-0" />
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
                              <input type="checkbox" checked={sellSelected[i]}
                                onChange={e => { const n = [...sellSelected]; n[i] = e.target.checked; setSellSelected(n); }}
                                className="w-3 h-3 bg-surface-container-lowest border-outline-variant rounded-sm text-tertiary focus:ring-0" />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <span className="text-primary font-bold">{row.account}</span>
                                <span className="text-[9px] text-on-surface-variant uppercase tracking-tighter">{row.firm}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">{row.holding.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right">
                              <input type="number" value={row.sellQty}
                                onChange={e => { const n = [...sellRows]; n[i] = { ...n[i], sellQty: Number(e.target.value) }; setSellRows(n); }}
                                className="bg-surface-container-lowest border border-tertiary/50 w-20 px-2 py-1 text-right text-xs focus:border-tertiary focus:outline-none" />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <input type="number" value={row.price}
                                onChange={e => { const n = [...sellRows]; n[i] = { ...n[i], price: Number(e.target.value) }; setSellRows(n); }}
                                className="bg-surface-container-lowest border border-outline-variant/50 w-24 px-2 py-1 text-right text-xs focus:outline-none" />
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

                {/* Sell footer */}
                <div className="bg-surface-container-low p-3 border-x border-b border-outline-variant flex justify-between items-center mt-0">
                  <div className="flex gap-4 text-[10px] font-label-caps text-on-surface-variant uppercase">
                    <span>Selected Quantity: <span className="text-on-surface font-data-mono">{selectedSellQty.toLocaleString()}</span></span>
                    <span>Accounts: <span className="text-on-surface font-data-mono">{selectedSellAccounts} of {sellRows.length}</span></span>
                  </div>
                  <div className="flex gap-2">
                    <button className="text-[10px] font-label-caps px-3 py-1 bg-surface-variant hover:bg-outline-variant transition-colors uppercase">Preview Batch</button>
                    <button className="text-[10px] font-label-caps px-3 py-1 bg-surface-variant hover:bg-outline-variant transition-colors uppercase">Reset</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT PANEL */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            <section className="bg-surface-container border border-outline-variant">
              <div className="bg-surface-container-high px-4 py-2 border-b border-outline-variant">
                <h2 className="font-label-caps text-label-caps text-on-surface uppercase">Aggregate Positions</h2>
              </div>
              <div className="p-4 space-y-4">
                {[
                  { sym: 'NVDA.O', label: 'Across 4 Accounts', qty: '340 Total Qty', pnl: '+$12,410.50', pos: true },
                  { sym: 'AAPL.O', label: 'Across 6 Accounts', qty: '820 Total Qty', pnl: '-$3,126.00', pos: false },
                  { sym: 'TSLA.O', label: 'Across 8 Accounts', qty: '2,150 Total Qty', pnl: '+$7,832.00', pos: true },
                ].map(p => (
                  <div key={p.sym} className="flex justify-between items-center p-3 bg-surface-container-low border border-outline-variant/30">
                    <div>
                      <p className="font-data-mono text-primary font-bold">{p.sym}</p>
                      <p className="text-[9px] text-on-surface-variant uppercase">{p.label}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-data-mono text-xs">{p.qty}</p>
                      <p className={`font-data-mono text-xs ${p.pos ? 'text-secondary' : 'text-tertiary'}`}>{p.pnl}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

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
          {[
            { icon: 'cloud_done', color: 'secondary', label: 'OMS Connectivity', value: 'Operational (12ms)' },
            { icon: 'history',    color: 'primary',   label: 'Last Settlement',  value: '04:00 UTC' },
            { icon: 'hub',        color: 'outline',   label: 'Exchange Status',  value: `${EXCHANGE} — OPEN` },
            { icon: 'security',   color: 'secondary', label: 'Risk Status',      value: 'Limits Nominal' },
          ].map(f => (
            <div key={f.label} className={`bg-surface-container p-3 border-l-2 border-${f.color} flex items-center gap-3`}>
              <span className={`material-symbols-outlined text-${f.color} text-sm`}>{f.icon}</span>
              <div>
                <p className="font-label-caps text-[9px] text-on-surface-variant uppercase">{f.label}</p>
                <p className="font-data-mono text-xs text-on-surface uppercase">{f.value}</p>
              </div>
            </div>
          ))}
        </footer>

      </div>
    </div>
  );
}
