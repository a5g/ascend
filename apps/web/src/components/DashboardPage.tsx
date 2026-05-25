import { useState, useEffect, useMemo, useRef, useCallback } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

interface ActiveUser {
  zerodha_user_id: string;
  name: string | null;
}

interface KiteHolding {
  tradingsymbol: string;
  exchange: string;
  quantity: number;
  average_price: number;
}

interface FyersQuote {
  lp:  number | null;
  chp: number | null;
}

type SortKey = 'tradingsymbol' | 'quantity' | 'average_price' | 'last_price' | 'invested' | 'cur_val' | 'pnl' | 'pnl_pct' | 'day_change_percentage';
type SortDir = 'asc' | 'desc';

// ── Helpers ───────────────────────────────────────────────────────────────────

const inr = (v: number) =>
  v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const inrInt = (v: number) => Math.round(v).toLocaleString('en-IN');

const inrQty = (v: number) => v.toLocaleString('en-IN');

function fmtAmt(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e7) return `${sign}${(abs / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `${sign}${(abs / 1e5).toFixed(2)}L`;
  return (n < 0 ? '-' : '') + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(abs);
}

function fmtPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

const COLS: { key: SortKey; label: string; right: boolean }[] = [
  { key: 'tradingsymbol',        label: 'Instrument', right: false },
  { key: 'quantity',             label: 'Qty',        right: true  },
  { key: 'average_price',        label: 'Avg. Cost',  right: true  },
  { key: 'last_price',           label: 'LTP',        right: true  },
  { key: 'invested',             label: 'Invested',   right: true  },
  { key: 'cur_val',              label: 'Cur. Val',   right: true  },
  { key: 'pnl',                  label: 'P&L',        right: true  },
  { key: 'pnl_pct',              label: 'Net Chg',    right: true  },
  { key: 'day_change_percentage', label: 'Day Chg',   right: true  },
];

function fyersSymbol(tradingsymbol: string, _exchange: string): string {
  return tradingsymbol.includes('-BE')
    ? `NSE:${tradingsymbol}`
    : `NSE:${tradingsymbol}-EQ`;
}

function getLtp(h: KiteHolding, quotes: Record<string, FyersQuote>): number {
  return quotes[fyersSymbol(h.tradingsymbol, h.exchange)]?.lp ?? 0;
}

function getSortValue(h: KiteHolding, key: SortKey, quotes: Record<string, FyersQuote>): number | string {
  const ltp = getLtp(h, quotes);
  switch (key) {
    case 'tradingsymbol':         return h.tradingsymbol;
    case 'quantity':              return h.quantity;
    case 'average_price':         return h.average_price;
    case 'last_price':            return ltp;
    case 'invested':              return h.quantity * h.average_price;
    case 'cur_val':               return ltp * h.quantity;
    case 'pnl':                   return ltp * h.quantity - h.quantity * h.average_price;
    case 'pnl_pct':               return h.average_price > 0 ? ((ltp - h.average_price) / h.average_price) * 100 : 0;
    case 'day_change_percentage': return quotes[fyersSymbol(h.tradingsymbol, h.exchange)]?.chp ?? 0;
  }
}

// ── TradeModal ────────────────────────────────────────────────────────────────

interface TradeModalProps {
  holding: KiteHolding;
  type: 'BUY' | 'SELL';
  zerodha_user_id: string;
  name: string | null;
  ltp: number;
  onClose: () => void;
}

function TradeModal({ holding, type, zerodha_user_id, name, ltp, onClose }: TradeModalProps) {
  const isBuy = type === 'BUY';

  const [qty, setQty] = useState(isBuy ? '' : String(holding.quantity));
  const [order_type, setOrderType] = useState<'LIMIT' | 'MARKET'>('LIMIT');
  const [exchange, setExchange] = useState<'NSE' | 'BSE'>('NSE');
  const [price, setPrice] = useState(ltp > 0 ? ltp.toFixed(2) : '');
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [placing, setPlacing] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [margin, setMargin] = useState<number | null | undefined>(undefined);
  const qtyRef   = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isBuy) {
      setTimeout(() => qtyRef.current?.focus(), 50);
    } else {
      setTimeout(() => modalRef.current?.focus(), 50);
    }
  }, [isBuy]);

  useEffect(() => {
    if (step === 'confirm' || result) setTimeout(() => modalRef.current?.focus(), 50);
  }, [step, result]);

  useEffect(() => {
    fetch(`/api/users/${encodeURIComponent(zerodha_user_id)}/margins`)
      .then(r => r.json())
      .then(res => setMargin(res?.data?.live_balance ?? null))
      .catch(() => setMargin(null));
  }, [zerodha_user_id]);

  const inrM   = (v: number) => v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const inrQty = (v: number) => Math.floor(v).toLocaleString('en-IN');

  const qtyNum   = parseInt(qty, 10);
  const priceNum = parseFloat(price);
  const effectivePrice = order_type === 'LIMIT' ? priceNum : ltp;
  const amountRequired = qtyNum > 0 && isFinite(effectivePrice) ? qtyNum * effectivePrice : null;
  const txnFee         = amountRequired != null ? amountRequired * 0.00119063431 : null;
  const totalAmount    = amountRequired != null && txnFee != null ? amountRequired + txnFee : null;
  const marginInsufficient = isBuy && margin != null && totalAmount != null && totalAmount > margin;

  const canSubmit =
    qtyNum > 0 &&
    (order_type === 'MARKET' || priceNum > 0) &&
    !(!isBuy && qtyNum > holding.quantity) &&
    !marginInsufficient;

  async function placeOrder() {
    setPlacing(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zerodha_user_id,
          exchange,
          tradingSymbol:      holding.tradingsymbol,
          transaction_type:   type,
          order_type,
          price:              priceNum,
          qty:                qtyNum,
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
        setResult({ ok: false, msg: data?.error || 'Order failed' });
      } else {
        setResult({ ok: true, msg: data?.data?.order_id ? `Order placed: #${data.data.order_id}` : 'Order placed successfully' });
      }
    } catch {
      setResult({ ok: false, msg: 'Network error' });
    } finally {
      setPlacing(false);
    }
  }

  // Soft theme colours matching the holdings table badges
  const headerCls   = isBuy ? 'bg-secondary/10 border-b border-secondary/20' : 'bg-tertiary/10 border-b border-tertiary/20';
  const titleCls    = isBuy ? 'text-secondary' : 'text-tertiary';
  const borderCls   = isBuy ? 'border-secondary/30' : 'border-tertiary/30';
  const toggleActive = 'bg-primary text-on-primary';
  const btnCls      = isBuy
    ? 'bg-secondary/20 border border-secondary/50 text-secondary hover:bg-secondary/30'
    : 'bg-tertiary/20 border border-tertiary/50 text-tertiary hover:bg-tertiary/30';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onMouseDown={onClose}>
      <div
        ref={modalRef}
        className={`w-[440px] bg-surface-container border ${borderCls} shadow-2xl outline-none`}
        onMouseDown={e => e.stopPropagation()}
        tabIndex={-1}
        onKeyDown={e => {
          if (e.key === 'Escape') { onClose(); return; }
          if (e.key === 'Enter') {
            if (result)                         { onClose(); return; }
            if (step === 'form' && canSubmit)   { setStep('confirm'); return; }
            if (step === 'confirm' && !placing) { placeOrder(); return; }
          }
        }}
      >

        {/* Header */}
        <div className={`${headerCls} px-5 py-3 flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            <span className={`material-symbols-outlined text-base ${titleCls}`}>{isBuy ? 'add_shopping_cart' : 'sell'}</span>
            <span className={`font-bold text-sm uppercase tracking-widest ${titleCls}`}>
              {type} — {holding.tradingsymbol}
            </span>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {result ? (
            /* Result */
            <div className="space-y-4">
              <div className={`flex items-start gap-3 p-3 ${result.ok ? 'bg-secondary/10 text-secondary' : 'bg-tertiary/10 text-tertiary'}`}>
                <span className="material-symbols-outlined text-base mt-0.5">{result.ok ? 'check_circle' : 'error'}</span>
                <span className="text-sm font-data-mono">{result.msg}</span>
              </div>
              <button onClick={onClose} className="w-full py-2 bg-surface-container-high text-on-surface font-label-caps text-xs uppercase hover:brightness-110 transition-all">
                Close
              </button>
            </div>
          ) : step === 'form' ? (
            /* Form */
            <>
              {/* User + stock info strip */}
              <div className="bg-surface-container-high px-3 py-2 border border-outline-variant/30 flex items-center justify-between text-xs font-data-mono">
                <div className="flex flex-col">
                  <span className="text-primary font-bold">{zerodha_user_id}</span>
                  {name && <span className="text-on-surface-variant text-[10px] uppercase tracking-tighter">{name}</span>}
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex bg-surface-container border border-outline-variant p-0.5">
                    {(['NSE', 'BSE'] as const).map(ex => (
                      <button key={ex} type="button" onClick={() => setExchange(ex)}
                        className={`px-2 py-0.5 font-label-caps text-[10px] uppercase transition-colors ${
                          exchange === ex ? toggleActive : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                        }`}>
                        {ex}
                      </button>
                    ))}
                  </div>
                  <span className="text-on-surface-variant">LTP: <strong className={titleCls}>{ltp > 0 ? inrM(ltp) : '—'}</strong></span>
                  <span className="text-on-surface-variant">Holding: <strong className="text-on-surface">{inrQty(holding.quantity)}</strong></span>
                </div>
              </div>

              {/* Order type toggle */}
              <div className="flex items-center gap-3">
                <span className="font-label-caps text-[10px] text-on-surface-variant uppercase w-20 shrink-0">Order Type</span>
                <div className="flex bg-surface-container-lowest border border-outline-variant p-0.5">
                  {(['LIMIT', 'MARKET'] as const).map(ot => (
                    <button key={ot} type="button" onClick={() => setOrderType(ot)}
                      className={`px-4 py-1 font-label-caps text-[10px] uppercase transition-colors ${
                        order_type === ot ? toggleActive : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                      }`}>
                      {ot}
                    </button>
                  ))}
                </div>
              </div>

              {/* Qty */}
              <div className="flex items-start gap-3">
                <label className="font-label-caps text-[10px] text-on-surface-variant uppercase w-20 shrink-0 pt-2">Qty</label>
                <div className="flex-1 space-y-1">
                  <input ref={qtyRef} type="text" inputMode="numeric" value={qty}
                    onChange={e => setQty(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Enter quantity"
                    className={`w-full bg-surface-container-lowest border text-on-surface font-data-mono px-3 py-1.5 text-sm focus:outline-none ${
                      !isBuy && qtyNum > holding.quantity
                        ? 'border-tertiary/60 focus:border-tertiary'
                        : 'border-outline-variant focus:border-primary'
                    }`} />
                  {!isBuy && qtyNum > holding.quantity && (
                    <p className={`text-[10px] font-label-caps text-tertiary`}>Exceeds holding ({inrQty(holding.quantity)})</p>
                  )}
                </div>
              </div>

              {/* Price */}
              {order_type === 'LIMIT' && (
                <div className="flex items-center gap-3">
                  <label className="font-label-caps text-[10px] text-on-surface-variant uppercase w-20 shrink-0">Price</label>
                  <input type="text" inputMode="decimal" value={price}
                    onChange={e => setPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                    className="flex-1 bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-3 py-1.5 text-sm focus:outline-none focus:border-primary" />
                </div>
              )}

              {/* Amount + Fee + Total */}
              {amountRequired != null && (
                <div className="bg-surface-container-high border border-outline-variant/30 px-3 py-2 space-y-1.5 text-xs font-data-mono">
                  {isBuy ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-on-surface-variant">Amount Required</span>
                        <span className={`font-bold ${titleCls}`}>₹{inrM(amountRequired)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-on-surface-variant">Transaction Fee</span>
                        <span className="text-on-surface-variant">₹{inrM(txnFee!)}</span>
                      </div>
                      <div className="flex justify-between border-t border-outline-variant/40 pt-1.5">
                        <span className="text-on-surface font-bold">Total Amount</span>
                        <span className={`font-bold ${titleCls}`}>₹{inrM(totalAmount!)}</span>
                      </div>
                      <div className="flex justify-between border-t border-outline-variant/40 pt-1.5">
                        <span className="text-on-surface-variant">Available Margin</span>
                        <span className={margin === undefined ? 'text-on-surface-variant' : marginInsufficient ? 'text-tertiary font-bold' : 'text-secondary'}>
                          {margin === undefined ? '…' : margin != null ? `₹${inrM(margin)}` : '—'}
                        </span>
                      </div>
                      {marginInsufficient && (
                        <p className="text-tertiary text-[10px] font-label-caps">Insufficient margin</p>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span className="text-on-surface-variant">Transaction Fee</span>
                        <span className="text-on-surface-variant">₹{inrM(txnFee!)}</span>
                      </div>
                      <div className="flex justify-between border-t border-outline-variant/40 pt-1.5">
                        <span className="text-on-surface font-bold">Get Amount</span>
                        <span className={`font-bold ${titleCls}`}>₹{inrM(amountRequired - txnFee!)}</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              <button onClick={() => canSubmit && setStep('confirm')} disabled={!canSubmit}
                className={`w-full py-2 font-label-caps text-xs uppercase font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${btnCls}`}>
                Review Order
              </button>
            </>
          ) : (
            /* Confirm */
            <>
              <div className="bg-surface-container-high border border-outline-variant p-4 space-y-2 text-sm font-data-mono">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Account</span>
                  <div className="text-right">
                    <span className={`font-bold ${titleCls}`}>{zerodha_user_id}</span>
                    {name && <span className="block text-[10px] text-on-surface-variant uppercase">{name}</span>}
                  </div>
                </div>
                <div className="flex justify-between"><span className="text-on-surface-variant">Symbol</span><span className={`font-bold ${titleCls}`}>{holding.tradingsymbol}</span></div>
                <div className="flex justify-between"><span className="text-on-surface-variant">Exchange</span><span className="text-on-surface">{exchange}</span></div>
                <div className="flex justify-between"><span className="text-on-surface-variant">Action</span><span className={`font-bold ${titleCls}`}>{type}</span></div>
                <div className="flex justify-between"><span className="text-on-surface-variant">Qty</span><span className="text-on-surface">{qtyNum}</span></div>
                <div className="flex justify-between"><span className="text-on-surface-variant">Order Type</span><span className="text-on-surface">{order_type}</span></div>
                {order_type === 'LIMIT' && (
                  <div className="flex justify-between"><span className="text-on-surface-variant">Price</span><span className="text-on-surface">₹{inrM(priceNum)}</span></div>
                )}
                <div className="flex justify-between border-t border-outline-variant/40 pt-2">
                  <span className="text-on-surface-variant">Est. Value</span>
                  <span className={`font-bold ${titleCls}`}>₹{inrM(qtyNum * effectivePrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Transaction Fee</span>
                  <span className="text-on-surface-variant">₹{txnFee != null ? inrM(txnFee) : '—'}</span>
                </div>
                {isBuy ? (
                  <div className="flex justify-between">
                    <span className="text-on-surface font-bold">Total Amount</span>
                    <span className={`font-bold ${titleCls}`}>₹{totalAmount != null ? inrM(totalAmount) : '—'}</span>
                  </div>
                ) : (
                  <div className="flex justify-between">
                    <span className="text-on-surface font-bold">Get Amount</span>
                    <span className={`font-bold ${titleCls}`}>₹{txnFee != null ? inrM(qtyNum * effectivePrice - txnFee) : '—'}</span>
                  </div>
                )}
                {isBuy && margin != null && (
                  <div className="flex justify-between border-t border-outline-variant/40 pt-2">
                    <span className="text-on-surface-variant">Available Margin</span>
                    <span className="text-on-surface">₹{inrM(margin)}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button onClick={() => setStep('form')} disabled={placing}
                  className="flex-1 py-2 bg-surface-container-high text-on-surface font-label-caps text-xs uppercase hover:brightness-110 transition-all">
                  Back
                </button>
                <button onClick={placeOrder} disabled={placing}
                  className={`flex-1 py-2 font-label-caps text-xs uppercase font-bold transition-all disabled:opacity-60 ${btnCls}`}>
                  {placing ? 'Placing…' : `Confirm ${type}`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


// ── Sub-components ────────────────────────────────────────────────────────────


function HoldingsSkeleton() {
  return (
    <>
      {[...Array(4)].map((_, i) => (
        <tr key={i} className="border-b border-outline-variant/30">
          {[...Array(9)].map((_, j) => (
            <td key={j} className="p-3">
              <div className="h-3 bg-surface-container-high rounded animate-pulse" style={{ width: j === 0 ? '60%' : '80%' }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// Returns true if the current time falls within NSE market hours
// (Mon–Fri, 09:15–15:30 IST / UTC+5:30)
function isMarketOpen(): boolean {
  // IST = UTC+5:30
  const istMs  = Date.now() + (5 * 60 + 30) * 60 * 1000;
  const ist    = new Date(istMs);
  const istDay = ist.getUTCDay(); // 0=Sun, 6=Sat
  if (istDay === 0 || istDay === 6) return false;
  const mins = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return mins >= 9 * 60 + 15 && mins <= 15 * 60 + 30;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [activeUsers, setActiveUsers]       = useState<ActiveUser[]>([]);
  const [selectedKiteId, setSelectedKiteId] = useState<string>('');
  const [holdings, setHoldings]             = useState<KiteHolding[]>([]);
  const [loadingUsers, setLoadingUsers]     = useState(true);
  const [loadingHoldings, setLoadingHoldings] = useState(false);
  const [holdingsError, setHoldingsError]   = useState<string | null>(null);
  const [sortKey, setSortKey]     = useState<SortKey>('pnl_pct');
  const [sortDir, setSortDir]     = useState<SortDir>('desc');
  const [dropdownOpen, setDropdownOpen]   = useState(false);
  const [searchQuery, setSearchQuery]     = useState('');
  const [filterText, setFilterText]       = useState('');
  const [focusedUserIndex, setFocusedUserIndex] = useState(-1);
  const [tradeModal, setTradeModal] = useState<{ holding: KiteHolding; type: 'BUY' | 'SELL'; ltp: number } | null>(null);
  const [headerMargin, setHeaderMargin] = useState<number | null | undefined>(undefined);
  const [fyersQuotes, setFyersQuotes] = useState<Record<string, FyersQuote>>({});
  const dropdownRef  = useRef<HTMLDivElement>(null);
  const searchRef    = useRef<HTMLInputElement>(null);
  const userListRef  = useRef<HTMLDivElement>(null);
  const userItemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (dropdownOpen) {
      setTimeout(() => searchRef.current?.focus(), 50);
    } else {
      setSearchQuery('');
      setFocusedUserIndex(-1);
    }
  }, [dropdownOpen]);

  useEffect(() => {
    setFocusedUserIndex(-1);
    userItemRefs.current = [];
  }, [searchQuery]);

  useEffect(() => {
    if (focusedUserIndex >= 0 && userItemRefs.current[focusedUserIndex]) {
      userItemRefs.current[focusedUserIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedUserIndex]);

  // Fetch active users on mount
  useEffect(() => {
    fetch('/api/users/active')
      .then(r => r.json())
      .then(({ data }) => {
        setActiveUsers(data ?? []);
        if (data?.length) setSelectedKiteId(data[0].zerodha_user_id);
      })
      .catch(() => setActiveUsers([]))
      .finally(() => setLoadingUsers(false));
  }, []);

  // Fetch margin for the selected user
  useEffect(() => {
    if (!selectedKiteId) return;
    setHeaderMargin(undefined);
    fetch(`/api/users/${encodeURIComponent(selectedKiteId)}/margins`)
      .then(r => r.json())
      .then(res => setHeaderMargin(res?.data?.live_balance ?? null))
      .catch(() => setHeaderMargin(null));
  }, [selectedKiteId]);

  // Fetch holdings whenever the selected user changes
  useEffect(() => {
    if (!selectedKiteId) return;
    setLoadingHoldings(true);
    setHoldingsError(null);
    setFyersQuotes({});
    fetch(`/api/users/${encodeURIComponent(selectedKiteId)}/holdings`)
      .then(r => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then(({ data }) => setHoldings(data ?? []))
      .catch(e => setHoldingsError(`Failed to load holdings: ${e.message}`))
      .finally(() => setLoadingHoldings(false));
  }, [selectedKiteId]);

  // Fetch Fyers quotes for all holdings, then refresh every 1 minute
  const fetchFyersQuotes = useCallback(() => {
    if (holdings.length === 0) return;
    const symbols = holdings.map(h => fyersSymbol(h.tradingsymbol, h.exchange));
    fetch('/api/fyers/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols }),
    })
      .then(r => r.json())
      .then(res => { if (res.data) setFyersQuotes(res.data); })
      .catch(() => {});
  }, [holdings]);

  useEffect(() => {
    if (holdings.length === 0) return;
    fetchFyersQuotes(); // always fetch once on load
    const id = setInterval(() => {
      if (isMarketOpen()) fetchFyersQuotes();
    }, 60000);
    return () => clearInterval(id);
  }, [fetchFyersQuotes]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedHoldings = useMemo(() => {
    return [...holdings].sort((a, b) => {
      const av = getSortValue(a, sortKey, fyersQuotes);
      const bv = getSortValue(b, sortKey, fyersQuotes);
      const cmp = typeof av === 'string'
        ? av.localeCompare(bv as string)
        : (av as number) - (bv as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [holdings, sortKey, sortDir, fyersQuotes]);

  const summary = useMemo(() => {
    const ltpOf = (h: KiteHolding) => fyersQuotes[fyersSymbol(h.tradingsymbol, h.exchange)]?.lp ?? 0;
    const calc = (hs: KiteHolding[]) => {
      const totalInvested = hs.reduce((s, h) => s + h.quantity * h.average_price, 0);
      const totalCurVal   = hs.reduce((s, h) => s + ltpOf(h) * h.quantity, 0);
      const totalPnl      = totalCurVal - totalInvested;
      const totalPnlPct   = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
      return { totalInvested, totalCurVal, totalPnl, totalPnlPct };
    };
    return {
      overall: calc(holdings),
      profit:  calc(holdings.filter(h => ltpOf(h) > h.average_price)),
    };
  }, [holdings, fyersQuotes]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return activeUsers.filter(u =>
      !q ||
      u.zerodha_user_id.toLowerCase().includes(q) ||
      (u.name ?? '').toLowerCase().includes(q)
    );
  }, [activeUsers, searchQuery]);

  function handleUserKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedUserIndex(i => Math.min(i + 1, filteredUsers.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedUserIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = focusedUserIndex >= 0 ? filteredUsers[focusedUserIndex] : filteredUsers[0];
      if (target) { setSelectedKiteId(target.zerodha_user_id); setDropdownOpen(false); }
    } else if (e.key === 'Escape') {
      setDropdownOpen(false);
    }
  }

  return (
    <div className="p-6 min-h-full overflow-y-auto bg-background">
      <div className="max-w-[1600px] mx-auto space-y-6">

        {/* Portfolio Summary Row */}
        <div className="flex gap-4">

          {/* Profit Only */}
          <div className="flex-1 bg-surface-container border border-outline-variant rounded-sm p-4">
            <div className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-4 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: '16px' }}>trending_up</span>
              Profit Only
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-on-surface-variant mb-1.5">Total Investment</div>
                <div className="text-2xl font-semibold text-on-surface tabular-nums font-mono">₹{fmtAmt(summary.profit.totalInvested)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-on-surface-variant mb-1.5">Current Value</div>
                <div className="text-2xl font-semibold text-on-surface tabular-nums font-mono">₹{fmtAmt(summary.profit.totalCurVal)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-on-surface-variant mb-1.5">Total P&amp;L</div>
                <div className="text-2xl font-semibold tabular-nums text-secondary font-mono">+₹{fmtAmt(summary.profit.totalPnl)}</div>
                <div className="text-xs mt-1 text-secondary font-mono">{fmtPct(summary.profit.totalPnlPct)}</div>
              </div>
            </div>
          </div>

          {/* Overall */}
          <div className="flex-1 bg-surface-container border border-outline-variant rounded-sm p-4">
            <div className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-4 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: '16px' }}>donut_small</span>
              Overall
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-on-surface-variant mb-1.5">Total Investment</div>
                <div className="text-2xl font-semibold text-on-surface tabular-nums font-mono">₹{fmtAmt(summary.overall.totalInvested)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-on-surface-variant mb-1.5">Current Value</div>
                <div className="text-2xl font-semibold text-on-surface tabular-nums font-mono">₹{fmtAmt(summary.overall.totalCurVal)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-on-surface-variant mb-1.5">Total P&amp;L</div>
                <div className={`text-2xl font-semibold tabular-nums font-mono ${summary.overall.totalPnl >= 0 ? 'text-secondary' : 'text-tertiary'}`}>
                  {summary.overall.totalPnl >= 0 ? '+' : ''}₹{fmtAmt(summary.overall.totalPnl)}
                </div>
                <div className={`text-xs mt-1 font-mono ${summary.overall.totalPnlPct >= 0 ? 'text-secondary' : 'text-tertiary'}`}>
                  {fmtPct(summary.overall.totalPnlPct)}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Holdings + Allocation */}
        <div className="grid grid-cols-12 gap-4">

          {/* Holdings Table */}
          <div className="col-span-12 bg-surface-container border border-outline-variant rounded-sm flex flex-col">
            <div className="p-4 border-b border-outline-variant flex flex-wrap justify-between items-center gap-3 min-w-0">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold text-on-surface">Portfolio Holdings</h2>

                {/* User selector */}
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-on-surface-variant uppercase tracking-wider whitespace-nowrap">
                    Kite User
                  </label>
                  {loadingUsers ? (
                    <div className="h-8 w-52 bg-surface-container-high rounded-sm animate-pulse" />
                  ) : activeUsers.length === 0 ? (
                    <span className="text-sm text-on-surface-variant">No active users</span>
                  ) : (
                    <div ref={dropdownRef} className="relative">
                      {/* Trigger */}
                      <button
                        onClick={() => setDropdownOpen(o => !o)}
                        className="flex items-center justify-between gap-3 min-w-52 px-3 py-2 text-sm text-on-surface bg-surface-container-high border border-outline-variant rounded-sm hover:border-primary transition-colors focus:outline-none focus:border-primary"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: '16px' }}>person</span>
                          <span className="truncate">
                            {(() => {
                              const u = activeUsers.find(u => u.zerodha_user_id === selectedKiteId);
                              return u ? (u.name ? `${u.name} (${u.zerodha_user_id})` : u.zerodha_user_id) : selectedKiteId;
                            })()}
                          </span>
                        </div>
                        <span
                          className="material-symbols-outlined text-on-surface-variant flex-shrink-0 transition-transform duration-200"
                          style={{ fontSize: '18px', transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        >expand_more</span>
                      </button>

                      {/* Dropdown list */}
                      {dropdownOpen && (
                        <div className="absolute left-0 top-full mt-1 min-w-full w-max z-50 bg-surface-container-high border border-outline-variant rounded-sm shadow-xl overflow-hidden">
                          {/* Search input */}
                          <div className="flex items-center gap-2 px-3 py-2 border-b border-outline-variant bg-surface-container">
                            <span className="material-symbols-outlined text-on-surface-variant flex-shrink-0" style={{ fontSize: '16px' }}>search</span>
                            <input
                              ref={searchRef}
                              type="text"
                              value={searchQuery}
                              onChange={e => setSearchQuery(e.target.value)}
                              onKeyDown={handleUserKeyDown}
                              placeholder="Search user..."
                              className="flex-1 bg-transparent text-sm text-on-surface placeholder-on-surface-variant/50 outline-none"
                            />
                            {searchQuery && (
                              <button onClick={() => setSearchQuery('')}>
                                <span className="material-symbols-outlined text-on-surface-variant hover:text-on-surface transition-colors" style={{ fontSize: '15px' }}>close</span>
                              </button>
                            )}
                          </div>

                          {/* Filtered list */}
                          <div ref={userListRef} className="max-h-60 overflow-y-auto">
                            {filteredUsers.length === 0 ? (
                              <div className="px-3 py-4 text-sm text-on-surface-variant text-center">
                                No users match "{searchQuery}"
                              </div>
                            ) : filteredUsers.map((u, i) => {
                              const label = u.name ? `${u.name} (${u.zerodha_user_id})` : u.zerodha_user_id;
                              const isSelected = u.zerodha_user_id === selectedKiteId;
                              const isFocused = focusedUserIndex === i;
                              return (
                                <button
                                  key={u.zerodha_user_id}
                                  ref={el => { userItemRefs.current[i] = el; }}
                                  onClick={() => { setSelectedKiteId(u.zerodha_user_id); setDropdownOpen(false); }}
                                  onMouseEnter={() => setFocusedUserIndex(i)}
                                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left transition-colors border-l-2
                                    ${isSelected
                                      ? 'bg-primary/20 text-primary border-primary'
                                      : isFocused
                                        ? 'bg-surface-variant text-on-surface border-primary'
                                        : 'text-on-surface border-transparent'
                                    }`}
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: '15px', opacity: isSelected ? 1 : 0.4 }}>person</span>
                                  {label}
                                  {isSelected && (
                                    <span className="material-symbols-outlined text-primary ml-auto" style={{ fontSize: '15px' }}>check</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Available margin for selected user */}
                {selectedKiteId && (
                  <div className="flex items-center gap-1.5 whitespace-nowrap" style={{ fontSize: '16px' }}>
                    <span className="text-on-surface-variant">Margin:</span>
                    <span className="font-bold text-primary">
                      {headerMargin === undefined
                        ? '…'
                        : headerMargin != null
                          ? `₹${Math.floor(headerMargin).toLocaleString('en-IN')}`
                          : '—'}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                {/* Instrument filter */}
                <div className="flex items-center gap-2 w-64 bg-surface-container-high border border-outline-variant rounded-sm px-3 py-2 focus-within:border-primary transition-colors">
                  <span className="material-symbols-outlined text-on-surface-variant flex-shrink-0" style={{ fontSize: '16px' }}>search</span>
                  <input
                    type="text"
                    value={filterText}
                    onChange={e => setFilterText(e.target.value)}
                    placeholder="Filter by instrument..."
                    className="bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none flex-1 min-w-0"
                  />
                  <button onClick={() => setFilterText('')} className="flex-shrink-0" style={{ visibility: filterText ? 'visible' : 'hidden' }}>
                    <span className="material-symbols-outlined text-on-surface-variant hover:text-on-surface transition-colors" style={{ fontSize: '15px' }}>close</span>
                  </button>
                </div>

                {/* Refresh button */}
                <button
                  onClick={fetchFyersQuotes}
                  title="Refresh quotes"
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-surface-container-high border border-outline-variant rounded-sm text-on-surface-variant hover:text-on-surface hover:border-primary transition-colors whitespace-nowrap"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>refresh</span>
                  Refresh
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse table-fixed">
                <colgroup>
                  <col style={{ width: '200px' }} /> {/* Instrument */}
                  <col style={{ width: '80px' }}  /> {/* Qty */}
                  <col style={{ width: '110px' }} /> {/* Avg. Cost */}
                  <col style={{ width: '110px' }} /> {/* LTP */}
                  <col style={{ width: '120px' }} /> {/* Invested */}
                  <col style={{ width: '120px' }} /> {/* Cur. Val */}
                  <col style={{ width: '110px' }} /> {/* P&L */}
                  <col style={{ width: '100px' }} /> {/* Net Chg */}
                  <col style={{ width: '100px' }} /> {/* Day Chg */}
                </colgroup>
                <thead>
                  <tr className="bg-surface-container-high border-b border-outline-variant">
                    {COLS.map(col => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        className={`p-3 text-sm font-bold uppercase tracking-wider text-on-surface-variant cursor-pointer select-none whitespace-nowrap hover:text-on-surface transition-colors ${col.right ? 'text-right' : ''}`}
                      >

                        <span className={`inline-flex items-center gap-1 w-full ${col.right ? 'justify-end' : 'justify-start'}`}>
                          {col.right ? (
                            <>
                              {sortKey === col.key ? (
                                <span className="material-symbols-outlined text-primary" style={{ fontSize: '14px' }}>
                                  {sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                                </span>
                              ) : (
                                <span className="material-symbols-outlined text-outline" style={{ fontSize: '14px' }}>unfold_more</span>
                              )}
                              {col.label}
                            </>
                          ) : (
                            <>
                              {col.label}
                              {sortKey === col.key ? (
                                <span className="material-symbols-outlined text-primary" style={{ fontSize: '14px' }}>
                                  {sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                                </span>
                              ) : (
                                <span className="material-symbols-outlined text-outline" style={{ fontSize: '14px' }}>unfold_more</span>
                              )}
                            </>
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="font-data-mono text-sm divide-y divide-outline-variant/30">
                  {loadingHoldings ? (
                    <HoldingsSkeleton />
                  ) : holdingsError ? (
                    <tr>
                      <td colSpan={9} className="p-6 text-center text-on-surface-variant text-xs">
                        <span className="material-symbols-outlined text-error align-middle mr-1">error</span>
                        {holdingsError}
                      </td>
                    </tr>
                  ) : holdings.length === 0 && selectedKiteId ? (
                    <tr>
                      <td colSpan={9} className="p-6 text-center text-on-surface-variant text-xs">
                        No holdings found for {selectedKiteId}.
                      </td>
                    </tr>
                  ) : holdings.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-6 text-center text-on-surface-variant text-xs">
                        Select an active Kite user to view their holdings.
                      </td>
                    </tr>
                  ) : (<>
                    {sortedHoldings.filter(h => h.tradingsymbol.toLowerCase().includes(filterText.toLowerCase())).map(h => {
                      const fq       = fyersQuotes[fyersSymbol(h.tradingsymbol, h.exchange)];
                      const ltp      = fq?.lp ?? null;
                      const ltpVal   = ltp ?? 0;
                      const invested = h.quantity * h.average_price;
                      const curVal   = ltpVal * h.quantity;
                      const pnl      = curVal - invested;
                      const pnlPos   = pnl >= 0;
                      const pct      = h.average_price > 0 ? ((ltpVal - h.average_price) / h.average_price) * 100 : 0;
                      const chp      = fq?.chp ?? null;
                      return (
                        <tr key={h.tradingsymbol} className="group hover:bg-surface-variant transition-colors">
                          <td className="p-3 text-on-surface">
                            <div className="flex items-center">
                              <span>{h.tradingsymbol}</span>
                              {h.exchange === 'BSE' && (
                                <span className="ml-1.5 font-label-caps text-[8px] px-1 py-0.5 bg-surface-container-high border border-outline-variant text-on-surface-variant">BSE</span>
                              )}
                              <div className="hidden group-hover:flex items-center" style={{ marginLeft: '10px', gap: '4px' }}>
                                <button
                                  onClick={() => setTradeModal({ holding: h, type: 'BUY', ltp: ltpVal })}
                                  title="Buy more"
                                  className="px-1.5 py-0.5 text-xs font-bold bg-secondary/20 text-secondary hover:bg-secondary/30 transition-colors"
                                >B</button>
                                <button
                                  onClick={() => setTradeModal({ holding: h, type: 'SELL', ltp: ltpVal })}
                                  title="Sell"
                                  className="px-1.5 py-0.5 text-xs font-bold bg-tertiary/20 text-tertiary hover:bg-tertiary/30 transition-colors"
                                >S</button>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-right text-on-surface">{inrQty(h.quantity)}</td>
                          <td className="p-3 text-right text-on-surface">{inr(h.average_price)}</td>
                          <td className={`p-3 text-right ${pnlPos ? 'text-secondary' : 'text-tertiary'}`}>
                            {ltp != null ? inr(ltp) : <span className="text-on-surface-variant">—</span>}
                          </td>
                          <td className="p-3 text-right text-on-surface">{inrInt(invested)}</td>
                          <td className="p-3 text-right text-on-surface">{ltp != null ? inrInt(curVal) : <span className="text-on-surface-variant">—</span>}</td>
                          <td className={`p-3 text-right ${pnlPos ? 'text-secondary' : 'text-tertiary'}`}>
                            {ltp != null ? <>{pnlPos ? '+' : ''}{inrInt(pnl)}</> : <span className="text-on-surface-variant">—</span>}
                          </td>
                          <td className="p-3 text-right">
                            {ltp != null
                              ? <span className={`text-sm font-mono ${pct > 0 ? 'text-secondary' : pct < 0 ? 'text-tertiary' : 'text-on-surface-variant'}`}>
                                  {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                                </span>
                              : <span className="text-on-surface-variant">—</span>}
                          </td>
                          <td className="p-3 text-right">
                            {chp != null
                              ? <span className={`text-sm ${chp > 0 ? 'text-secondary' : chp < 0 ? 'text-tertiary' : 'text-on-surface-variant'}`}>
                                  {chp >= 0 ? '▲' : '▼'} {Math.abs(chp).toFixed(2)}%
                                </span>
                              : <span className="text-on-surface-variant">—</span>}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Summary row */}
                    {(() => {
                      const { totalInvested, totalCurVal, totalPnl, totalPnlPct } = summary.overall;
                      const pnlPos = totalPnl >= 0;
                      const pctPos = totalPnlPct >= 0;
                      return (
                        <tr className="border-t-2 border-outline-variant bg-surface-container-high font-semibold">
                          <td className="p-3 text-on-surface text-sm uppercase tracking-wider">Total</td>
                          <td className="p-3" />
                          <td className="p-3" />
                          <td className="p-3" />
                          <td className="p-3 text-right text-on-surface">{inrInt(totalInvested)}</td>
                          <td className="p-3 text-right text-on-surface">{inrInt(totalCurVal)}</td>
                          <td className={`p-3 text-right ${pnlPos ? 'text-secondary' : 'text-tertiary'}`}>
                            {pnlPos ? '+' : ''}{inrInt(totalPnl)}
                          </td>
                          <td className="p-3 text-right">
                            <span className={`px-2 py-0.5 rounded text-sm ${pctPos ? 'bg-secondary/10 text-secondary' : 'bg-tertiary/10 text-tertiary'}`}>
                              {pctPos ? '+' : ''}{totalPnlPct.toFixed(2)}%
                            </span>
                          </td>
                          <td className="p-3" />
                        </tr>
                      );
                    })()}
                  </>)}

                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>

      {tradeModal && (
        <TradeModal
          holding={tradeModal.holding}
          type={tradeModal.type}
          zerodha_user_id={selectedKiteId}
          name={activeUsers.find(u => u.zerodha_user_id === selectedKiteId)?.name ?? null}
          ltp={tradeModal.ltp}
          onClose={() => setTradeModal(null)}
        />
      )}

      {/* FAB */}
      <button
        className="fixed bottom-6 right-6 w-14 h-14 bg-primary text-on-primary rounded-full shadow-lg flex items-center justify-center z-50 hover:scale-105 transition-transform"
        title="Add chart"
      >
        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>add_chart</span>
      </button>
    </div>
  );
}
