import { useState, useEffect, useRef, useMemo } from 'react';
import AppSelect from './AppSelect';

// ── Security dropdown ─────────────────────────────────────────────────────────

interface SecurityOption {
  id: number;
  symbol: string;
  name_of_company: string;
  series: string;
  exchange: string;
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

interface SellHolding {
  zerodha_user_id: string;
  name: string | null;
  quantity: number;
  average_price: number;
}

interface KiteOrder {
  order_id: string;
  exchange: string;
  tradingsymbol: string;
  transaction_type: 'BUY' | 'SELL';
  order_type: string;
  product: string;
  quantity: number;
  filled_quantity: number;
  pending_quantity: number;
  cancelled_quantity: number;
  price: number;
  average_price: number;
  status: string;
  status_message: string | null;
  created_at: string;
  order_timestamp: string;
  variety: string;
  validity: string;
  disclosed_quantity: number;
  trigger_price: number;
  parent_order_id: string | null;
}

interface KitePosition {
  tradingsymbol: string;
  exchange: string;
  product: string;
  quantity: number;
  average_price: number;
  last_price: number;
  pnl: number;
  day_change_percentage: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PCT_OPTIONS = ['25%', '33%', '50%', '75%', '100%'];
const OPEN_STATUSES = new Set(['OPEN', 'TRIGGER PENDING', 'AMO REQ RECEIVED', 'OPEN PENDING', 'MODIFY PENDING', 'CANCEL PENDING']);

const inrFmt = (v: number) => Math.floor(v).toLocaleString('en-IN');
const inrDec = (v: number) => v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function orderTime(o: KiteOrder): string {
  const ts = o.order_timestamp ?? o.created_at ?? '';
  return ts.split(' ')[1]?.slice(0, 8) ?? '—';
}

function statusBadgeCls(status: string): string {
  if (status === 'COMPLETE')  return 'text-secondary bg-secondary/10 border border-secondary/30';
  if (status === 'CANCELLED') return 'text-on-surface-variant bg-surface-container-high border border-outline-variant';
  if (status === 'REJECTED')  return 'text-tertiary bg-tertiary/10 border border-tertiary/30';
  if (OPEN_STATUSES.has(status)) return 'text-primary bg-primary/10 border border-primary/30';
  return 'text-on-surface-variant bg-surface-container border border-outline-variant';
}

// ── BulkSellModal ─────────────────────────────────────────────────────────────

interface BulkSellModalProps {
  holding: SellHolding;
  security: SecurityOption;
  initialQty: number;
  initialLimitPrice: string;
  initialOrderType: 'LIMIT' | 'MARKET';
  ltp: number | null;
  onClose: () => void;
  onPlaced: (ok: boolean, msg: string) => void;
}

function BulkSellModal({ holding, security, initialQty, initialLimitPrice, initialOrderType, ltp, onClose, onPlaced }: BulkSellModalProps) {
  const [qty, setQty]           = useState(String(initialQty));
  const [price, setPrice]       = useState(initialLimitPrice);
  const [order_type, setOrderType] = useState<'LIMIT' | 'MARKET'>(initialOrderType);
  const [step, setStep]   = useState<'form' | 'confirm'>('form');
  const [placing, setPlacing] = useState(false);
  const [result, setResult]   = useState<{ ok: boolean; msg: string } | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setTimeout(() => modalRef.current?.focus(), 50); }, []);
  useEffect(() => { if (step === 'confirm' || result) setTimeout(() => modalRef.current?.focus(), 50); }, [step, result]);

  const qtyNum        = parseInt(qty, 10);
  const priceNum      = parseFloat(price);
  const effectivePrice = order_type === 'LIMIT' ? priceNum : (ltp ?? 0);
  const amount        = qtyNum > 0 && effectivePrice > 0 ? qtyNum * effectivePrice : null;
  const fee           = amount != null ? amount * 0.00119063431 : null;
  const getAmt        = amount != null && fee != null ? amount - fee : null;
  const canSubmit     = qtyNum > 0 && !isNaN(qtyNum) && qtyNum <= holding.quantity &&
                        (order_type === 'MARKET' || (priceNum > 0 && !isNaN(priceNum)));

  async function placeOrder() {
    setPlacing(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zerodha_user_id:    holding.zerodha_user_id,
          exchange:           security.exchange,
          tradingSymbol:      security.symbol,
          transaction_type:   'SELL',
          order_type,
          price:              order_type === 'LIMIT' ? priceNum : 0,
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
      const msg = res.ok
        ? (data?.data?.order_id ? `Order placed: #${data.data.order_id}` : 'Order placed successfully')
        : (data?.error || 'Order failed');
      setResult({ ok: res.ok, msg });
      onPlaced(res.ok, msg);
    } catch {
      const msg = 'Network error';
      setResult({ ok: false, msg });
      onPlaced(false, msg);
    } finally {
      setPlacing(false);
    }
  }

  const titleCls  = 'text-tertiary';
  const headerCls = 'bg-tertiary/10 border-b border-tertiary/20';
  const borderCls = 'border-tertiary/30';
  const btnCls    = 'bg-tertiary/20 border border-tertiary/50 text-tertiary hover:bg-tertiary/30';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onMouseDown={onClose}>
      <div
        ref={modalRef}
        className={`w-[460px] bg-surface-container border ${borderCls} shadow-2xl outline-none`}
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
            <span className={`material-symbols-outlined text-base ${titleCls}`}>sell</span>
            <span className={`font-bold text-sm uppercase tracking-widest ${titleCls}`}>
              SELL — {security.symbol}
            </span>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {result ? (
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
            <>
              {/* User + stock info strip */}
              <div className="bg-surface-container-high px-3 py-2 border border-outline-variant/30 flex items-center justify-between text-xs font-data-mono">
                <div className="flex flex-col">
                  <span className="text-primary font-bold">{holding.zerodha_user_id}</span>
                  {holding.name && <span className="text-on-surface-variant text-[10px] uppercase tracking-tighter">{holding.name}</span>}
                </div>
                <div className="flex gap-4 text-right">
                  <span className="text-on-surface-variant">LTP: <strong className={titleCls}>{ltp != null ? inrDec(ltp) : '—'}</strong></span>
                  <span className="text-on-surface-variant">Holding: <strong className="text-on-surface">{holding.quantity.toLocaleString('en-IN')}</strong></span>
                </div>
              </div>

              {/* Order Type */}
              <div className="flex items-center gap-3">
                <span className="font-label-caps text-[10px] text-on-surface-variant uppercase w-24 shrink-0">Order Type</span>
                <div className="flex bg-surface-container-lowest border border-outline-variant p-0.5">
                  {(['LIMIT', 'MARKET'] as const).map(ot => (
                    <button key={ot} type="button" onClick={() => setOrderType(ot)}
                      className={`px-4 py-1 font-label-caps text-[10px] uppercase transition-colors ${
                        order_type === ot ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                      }`}>
                      {ot}
                    </button>
                  ))}
                </div>
              </div>

              {/* Qty */}
              <div className="flex items-start gap-3">
                <label className="font-label-caps text-[10px] text-on-surface-variant uppercase w-24 shrink-0 pt-2">Qty</label>
                <div className="flex-1 space-y-1">
                  <input type="text" inputMode="numeric" value={qty}
                    onChange={e => setQty(e.target.value.replace(/[^0-9]/g, ''))}
                    className={`w-full bg-surface-container-lowest border text-on-surface font-data-mono px-3 py-1.5 text-sm focus:outline-none ${
                      qtyNum > holding.quantity ? 'border-tertiary/60 focus:border-tertiary' : 'border-outline-variant focus:border-primary'
                    }`} />
                  {qtyNum > holding.quantity && (
                    <p className="text-[10px] font-label-caps text-tertiary">Exceeds holding ({holding.quantity.toLocaleString('en-IN')})</p>
                  )}
                </div>
              </div>

              {/* Limit Price — hidden for MARKET */}
              {order_type === 'LIMIT' && (
                <div className="flex items-center gap-3">
                  <label className="font-label-caps text-[10px] text-on-surface-variant uppercase w-24 shrink-0">Limit Price</label>
                  <input type="text" inputMode="decimal" value={price}
                    onChange={e => setPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                    className="flex-1 bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-3 py-1.5 text-sm focus:outline-none focus:border-primary" />
                </div>
              )}

              {/* Amount summary */}
              {amount != null && (
                <div className="bg-surface-container-high border border-outline-variant/30 px-3 py-2 space-y-1.5 text-xs font-data-mono">
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">Transaction Fee</span>
                    <span className="text-on-surface-variant">₹{inrDec(fee!)}</span>
                  </div>
                  <div className="flex justify-between border-t border-outline-variant/40 pt-1.5">
                    <span className="text-on-surface font-bold">Get Amount</span>
                    <span className={`font-bold ${titleCls}`}>₹{inrDec(getAmt!)}</span>
                  </div>
                </div>
              )}

              <button onClick={() => canSubmit && setStep('confirm')} disabled={!canSubmit}
                className={`w-full py-2 font-label-caps text-xs uppercase font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${btnCls}`}>
                Review Order
              </button>
            </>
          ) : (
            <>
              {/* Confirm summary */}
              <div className="bg-surface-container-high border border-outline-variant p-4 space-y-2 text-sm font-data-mono">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Account</span>
                  <div className="text-right">
                    <span className={`font-bold ${titleCls}`}>{holding.zerodha_user_id}</span>
                    {holding.name && <span className="block text-[10px] text-on-surface-variant uppercase">{holding.name}</span>}
                  </div>
                </div>
                <div className="flex justify-between"><span className="text-on-surface-variant">Symbol</span><span className={`font-bold ${titleCls}`}>{security.symbol}</span></div>
                <div className="flex justify-between"><span className="text-on-surface-variant">Exchange</span><span className="text-on-surface">{security.exchange}</span></div>
                <div className="flex justify-between"><span className="text-on-surface-variant">Action</span><span className={`font-bold ${titleCls}`}>SELL</span></div>
                <div className="flex justify-between"><span className="text-on-surface-variant">Qty</span><span className="text-on-surface">{qtyNum}</span></div>
                <div className="flex justify-between"><span className="text-on-surface-variant">Order Type</span><span className="text-on-surface">{order_type}</span></div>
                {order_type === 'LIMIT' && (
                  <div className="flex justify-between"><span className="text-on-surface-variant">Price</span><span className="text-on-surface">₹{inrDec(priceNum)}</span></div>
                )}
                <div className="flex justify-between border-t border-outline-variant/40 pt-2">
                  <span className="text-on-surface-variant">Est. Value</span>
                  <span className={`font-bold ${titleCls}`}>₹{inrDec(qtyNum * effectivePrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Transaction Fee</span>
                  <span className="text-on-surface-variant">₹{fee != null ? inrDec(fee) : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface font-bold">Get Amount</span>
                  <span className={`font-bold ${titleCls}`}>₹{getAmt != null ? inrDec(getAmt) : '—'}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setStep('form')} disabled={placing}
                  className="flex-1 py-2 bg-surface-container-high text-on-surface font-label-caps text-xs uppercase hover:brightness-110 transition-all">
                  Back
                </button>
                <button onClick={placeOrder} disabled={placing}
                  className={`flex-1 py-2 font-label-caps text-xs uppercase font-bold transition-all disabled:opacity-60 ${btnCls}`}>
                  {placing ? 'Placing…' : 'Confirm SELL'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── BulkBuyModal ──────────────────────────────────────────────────────────────

interface BulkBuyModalProps {
  user: BuyUser;
  security: SecurityOption;
  initialQty: number;
  initialPrice: string;
  initialOrderType: 'LIMIT' | 'MARKET';
  ltp: number | null;
  margin: number | null | undefined;
  onClose: () => void;
  onPlaced: (ok: boolean, msg: string) => void;
}

function BulkBuyModal({ user, security, initialQty, initialPrice, initialOrderType, ltp, margin, onClose, onPlaced }: BulkBuyModalProps) {
  const [qty, setQty]             = useState(String(initialQty));
  const [price, setPrice]         = useState(initialPrice);
  const [order_type, setOrderType] = useState<'LIMIT' | 'MARKET'>(initialOrderType);
  const [step, setStep]           = useState<'form' | 'confirm'>('form');
  const [placing, setPlacing]     = useState(false);
  const [result, setResult]       = useState<{ ok: boolean; msg: string } | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setTimeout(() => modalRef.current?.focus(), 50); }, []);
  useEffect(() => { if (step === 'confirm' || result) setTimeout(() => modalRef.current?.focus(), 50); }, [step, result]);

  const qtyNum         = parseInt(qty, 10);
  const priceNum       = parseFloat(price);
  const effectivePrice = order_type === 'LIMIT' ? priceNum : (ltp ?? 0);
  const amount         = qtyNum > 0 && effectivePrice > 0 ? qtyNum * effectivePrice : null;
  const fee            = amount != null ? amount * 0.00119063431 : null;
  const totalAmount    = amount != null && fee != null ? amount + fee : null;
  const marginInsufficient = margin != null && totalAmount != null && totalAmount > margin;
  const canSubmit = qtyNum > 0 && !isNaN(qtyNum) &&
    (order_type === 'MARKET' || (priceNum > 0 && !isNaN(priceNum))) &&
    !marginInsufficient;

  async function placeOrder() {
    setPlacing(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zerodha_user_id:    user.zerodha_user_id,
          exchange:           security.exchange,
          tradingSymbol:      security.symbol,
          transaction_type:   'BUY',
          order_type,
          price:              order_type === 'LIMIT' ? priceNum : 0,
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
      const msg = res.ok
        ? (data?.data?.order_id ? `Order placed: #${data.data.order_id}` : 'Order placed successfully')
        : (data?.error || 'Order failed');
      setResult({ ok: res.ok, msg });
      onPlaced(res.ok, msg);
    } catch {
      const msg = 'Network error';
      setResult({ ok: false, msg });
      onPlaced(false, msg);
    } finally {
      setPlacing(false);
    }
  }

  const titleCls   = 'text-secondary';
  const headerCls  = 'bg-secondary/10 border-b border-secondary/20';
  const borderCls  = 'border-secondary/30';
  const btnCls     = 'bg-secondary/20 border border-secondary/50 text-secondary hover:bg-secondary/30';
  const toggleActive = 'bg-primary text-on-primary';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onMouseDown={onClose}>
      <div
        ref={modalRef}
        className={`w-[460px] bg-surface-container border ${borderCls} shadow-2xl outline-none`}
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
        <div className={`${headerCls} px-5 py-3 flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            <span className={`material-symbols-outlined text-base ${titleCls}`}>add_shopping_cart</span>
            <span className={`font-bold text-sm uppercase tracking-widest ${titleCls}`}>BUY — {security.symbol}</span>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {result ? (
            <div className="space-y-4">
              <div className={`flex items-start gap-3 p-3 ${result.ok ? 'bg-secondary/10 text-secondary' : 'bg-tertiary/10 text-tertiary'}`}>
                <span className="material-symbols-outlined text-base mt-0.5">{result.ok ? 'check_circle' : 'error'}</span>
                <span className="text-sm font-data-mono">{result.msg}</span>
              </div>
              <button onClick={onClose} className="w-full py-2 bg-surface-container-high text-on-surface font-label-caps text-xs uppercase hover:brightness-110 transition-all">Close</button>
            </div>
          ) : step === 'form' ? (
            <>
              <div className="bg-surface-container-high px-3 py-2 border border-outline-variant/30 flex items-center justify-between text-xs font-data-mono">
                <div className="flex flex-col">
                  <span className="text-primary font-bold">{user.zerodha_user_id}</span>
                  {user.name && <span className="text-on-surface-variant text-[10px] uppercase tracking-tighter">{user.name}</span>}
                </div>
                <div className="flex gap-4 text-right">
                  <span className="text-on-surface-variant">LTP: <strong className={titleCls}>{ltp != null && ltp > 0 ? inrDec(ltp) : '—'}</strong></span>
                  <span className="text-on-surface-variant">Margin: <strong className="text-on-surface">{margin != null ? inrFmt(margin) : '—'}</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="font-label-caps text-[10px] text-on-surface-variant uppercase w-24 shrink-0">Order Type</span>
                <div className="flex bg-surface-container-lowest border border-outline-variant p-0.5">
                  {(['LIMIT', 'MARKET'] as const).map(ot => (
                    <button key={ot} type="button" onClick={() => setOrderType(ot)}
                      className={`px-4 py-1 font-label-caps text-[10px] uppercase transition-colors ${order_type === ot ? toggleActive : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'}`}>
                      {ot}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="font-label-caps text-[10px] text-on-surface-variant uppercase w-24 shrink-0">Qty</label>
                <input type="text" inputMode="numeric" value={qty}
                  onChange={e => setQty(e.target.value.replace(/[^0-9]/g, ''))}
                  className="flex-1 bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-3 py-1.5 text-sm focus:outline-none focus:border-primary" />
              </div>

              {order_type === 'LIMIT' && (
                <div className="flex items-center gap-3">
                  <label className="font-label-caps text-[10px] text-on-surface-variant uppercase w-24 shrink-0">Price</label>
                  <input type="text" inputMode="decimal" value={price}
                    onChange={e => setPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                    className="flex-1 bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-3 py-1.5 text-sm focus:outline-none focus:border-primary" />
                </div>
              )}

              {amount != null && (
                <div className="bg-surface-container-high border border-outline-variant/30 px-3 py-2 space-y-1.5 text-xs font-data-mono">
                  <div className="flex justify-between"><span className="text-on-surface-variant">Amount Required</span><span className={`font-bold ${titleCls}`}>₹{inrDec(amount)}</span></div>
                  <div className="flex justify-between"><span className="text-on-surface-variant">Transaction Fee</span><span className="text-on-surface-variant">₹{inrDec(fee!)}</span></div>
                  <div className="flex justify-between border-t border-outline-variant/40 pt-1.5"><span className="text-on-surface font-bold">Total Amount</span><span className={`font-bold ${titleCls}`}>₹{inrDec(totalAmount!)}</span></div>
                  <div className="flex justify-between border-t border-outline-variant/40 pt-1.5">
                    <span className="text-on-surface-variant">Available Margin</span>
                    <span className={margin === undefined ? 'text-on-surface-variant' : marginInsufficient ? 'text-tertiary font-bold' : 'text-secondary'}>
                      {margin === undefined ? '…' : margin != null ? `₹${inrDec(margin)}` : '—'}
                    </span>
                  </div>
                  {marginInsufficient && <p className="text-tertiary text-[10px] font-label-caps">Insufficient margin</p>}
                </div>
              )}

              <button onClick={() => canSubmit && setStep('confirm')} disabled={!canSubmit}
                className={`w-full py-2 font-label-caps text-xs uppercase font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${btnCls}`}>
                Review Order
              </button>
            </>
          ) : (
            <>
              <div className="bg-surface-container-high border border-outline-variant p-4 space-y-2 text-sm font-data-mono">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Account</span>
                  <div className="text-right">
                    <span className={`font-bold ${titleCls}`}>{user.zerodha_user_id}</span>
                    {user.name && <span className="block text-[10px] text-on-surface-variant uppercase">{user.name}</span>}
                  </div>
                </div>
                <div className="flex justify-between"><span className="text-on-surface-variant">Symbol</span><span className={`font-bold ${titleCls}`}>{security.symbol}</span></div>
                <div className="flex justify-between"><span className="text-on-surface-variant">Exchange</span><span className="text-on-surface">{security.exchange}</span></div>
                <div className="flex justify-between"><span className="text-on-surface-variant">Action</span><span className={`font-bold ${titleCls}`}>BUY</span></div>
                <div className="flex justify-between"><span className="text-on-surface-variant">Qty</span><span className="text-on-surface">{qtyNum}</span></div>
                <div className="flex justify-between"><span className="text-on-surface-variant">Order Type</span><span className="text-on-surface">{order_type}</span></div>
                {order_type === 'LIMIT' && <div className="flex justify-between"><span className="text-on-surface-variant">Price</span><span className="text-on-surface">₹{inrDec(priceNum)}</span></div>}
                <div className="flex justify-between border-t border-outline-variant/40 pt-2"><span className="text-on-surface-variant">Est. Value</span><span className={`font-bold ${titleCls}`}>₹{inrDec(qtyNum * effectivePrice)}</span></div>
                <div className="flex justify-between"><span className="text-on-surface-variant">Transaction Fee</span><span className="text-on-surface-variant">₹{fee != null ? inrDec(fee) : '—'}</span></div>
                <div className="flex justify-between"><span className="text-on-surface font-bold">Total Amount</span><span className={`font-bold ${titleCls}`}>₹{totalAmount != null ? inrDec(totalAmount) : '—'}</span></div>
                {margin != null && <div className="flex justify-between border-t border-outline-variant/40 pt-2"><span className="text-on-surface-variant">Available Margin</span><span className="text-on-surface">₹{inrDec(margin)}</span></div>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep('form')} disabled={placing}
                  className="flex-1 py-2 bg-surface-container-high text-on-surface font-label-caps text-xs uppercase hover:brightness-110 transition-all">Back</button>
                <button onClick={placeOrder} disabled={placing}
                  className={`flex-1 py-2 font-label-caps text-xs uppercase font-bold transition-all disabled:opacity-60 ${btnCls}`}>
                  {placing ? 'Placing…' : 'Confirm BUY'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── BulkMultipleConfirmModal (shared) ─────────────────────────────────────────

interface MultipleConfirmRow { zerodha_user_id: string; name: string | null; qty: number; value: number; }

interface BulkMultipleConfirmModalProps {
  side: 'buy' | 'sell';
  rows: MultipleConfirmRow[];
  security: SecurityOption;
  orderType: 'LIMIT' | 'MARKET';
  priceLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}

function BulkMultipleConfirmModal({ side, rows, security, orderType, priceLabel, onConfirm, onClose }: BulkMultipleConfirmModalProps) {
  const isBuy      = side === 'buy';
  const titleCls   = isBuy ? 'text-secondary' : 'text-tertiary';
  const headerCls  = isBuy ? 'bg-secondary/10 border-b border-secondary/20' : 'bg-tertiary/10 border-b border-tertiary/20';
  const borderCls  = isBuy ? 'border-secondary/30' : 'border-tertiary/30';
  const confirmCls = isBuy
    ? 'bg-secondary/20 border border-secondary/50 text-secondary hover:bg-secondary/30'
    : 'bg-red-500 hover:bg-red-400 text-white border-0';
  const totalQty   = rows.reduce((s, r) => s + r.qty, 0);
  const totalVal   = rows.reduce((s, r) => s + r.value, 0);
  const modalRef   = useRef<HTMLDivElement>(null);

  useEffect(() => { setTimeout(() => modalRef.current?.focus(), 50); }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onMouseDown={onClose}>
      <div
        ref={modalRef}
        className={`w-[500px] bg-surface-container border ${borderCls} shadow-2xl outline-none`}
        onMouseDown={e => e.stopPropagation()}
        tabIndex={-1}
        onKeyDown={e => {
          if (e.key === 'Escape') { onClose(); return; }
          if (e.key === 'Enter') { onConfirm(); onClose(); }
        }}
      >
        <div className={`${headerCls} px-5 py-3 flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            <span className={`material-symbols-outlined text-base ${titleCls}`}>{isBuy ? 'shopping_cart' : 'sell'}</span>
            <span className={`font-bold text-sm uppercase tracking-widest ${titleCls}`}>
              {isBuy ? 'Buy' : 'Sell'} Multiple — {security.symbol}
            </span>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between text-xs font-data-mono bg-surface-container-high px-3 py-2 border border-outline-variant/30">
            <span className="text-on-surface-variant">Exchange: <strong className="text-on-surface">{security.exchange}</strong></span>
            <span className="text-on-surface-variant">Order Type: <strong className="text-on-surface">{orderType}</strong></span>
            {orderType === 'LIMIT' && <span className="text-on-surface-variant">Price: <strong className={titleCls}>₹{priceLabel}</strong></span>}
          </div>

          <div className="border border-outline-variant overflow-hidden">
            <table className="w-full text-xs font-data-mono">
              <thead>
                <tr className="bg-surface-container-high border-b border-outline-variant font-label-caps text-[10px] text-on-surface-variant uppercase">
                  <th className="px-3 py-2 text-left">Account</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">{isBuy ? 'Amount' : 'Est. Get'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {rows.map(r => (
                  <tr key={r.zerodha_user_id} className="hover:bg-surface-container-high transition-colors">
                    <td className="px-3 py-2">
                      <span className="text-primary font-bold">{r.zerodha_user_id}</span>
                      {r.name && <span className="block text-[9px] text-on-surface-variant uppercase">{r.name}</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-on-surface">{r.qty.toLocaleString('en-IN')}</td>
                    <td className={`px-3 py-2 text-right font-bold ${titleCls}`}>₹{inrFmt(r.value)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-outline-variant bg-surface-container-high font-bold">
                  <td className="px-3 py-2 font-label-caps text-[10px] text-on-surface uppercase">Total</td>
                  <td className="px-3 py-2 text-right text-on-surface">{totalQty.toLocaleString('en-IN')}</td>
                  <td className={`px-3 py-2 text-right ${titleCls}`}>₹{inrFmt(totalVal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex gap-2">
            <button onClick={onClose}
              className="flex-1 py-2 bg-surface-container-high text-on-surface font-label-caps text-xs uppercase hover:brightness-110 transition-all">
              Cancel
            </button>
            <button onClick={() => { onConfirm(); onClose(); }}
              className={`flex-1 py-2 font-label-caps text-xs uppercase font-bold transition-all ${confirmCls}`}>
              Confirm {isBuy ? 'Buy' : 'Sell'} ({rows.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── OrderModifyModal ──────────────────────────────────────────────────────────

interface OrderModifyModalProps {
  order: KiteOrder;
  zerodha_user_id: string;
  onClose: () => void;
  onModified: () => void;
}

function OrderModifyModal({ order, zerodha_user_id, onClose, onModified }: OrderModifyModalProps) {
  const [qty,       setQty]       = useState(String(order.quantity));
  const [price,     setPrice]     = useState(String(order.price));
  const [orderType, setOrderType] = useState<'LIMIT' | 'MARKET'>(
    order.order_type === 'MARKET' ? 'MARKET' : 'LIMIT'
  );
  const [step,    setStep]    = useState<'form' | 'confirm'>('form');
  const [placing, setPlacing] = useState(false);
  const [result,  setResult]  = useState<{ ok: boolean; msg: string } | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setTimeout(() => modalRef.current?.focus(), 50); }, []);
  useEffect(() => { if (step === 'confirm' || result) setTimeout(() => modalRef.current?.focus(), 50); }, [step, result]);

  const qtyNum   = parseInt(qty, 10);
  const priceNum = parseFloat(price);
  const canSubmit = qtyNum > 0 && !isNaN(qtyNum) && (orderType === 'MARKET' || (priceNum > 0 && !isNaN(priceNum)));

  const isBuy    = order.transaction_type === 'BUY';
  const titleCls = isBuy ? 'text-secondary' : 'text-tertiary';
  const btnCls   = isBuy
    ? 'bg-secondary/20 border border-secondary/50 text-secondary hover:bg-secondary/30'
    : 'bg-tertiary/20 border border-tertiary/50 text-tertiary hover:bg-tertiary/30';
  const borderCls = isBuy ? 'border-secondary/30' : 'border-tertiary/30';

  async function modify() {
    setPlacing(true);
    try {
      const res = await fetch(`/api/orders/${order.order_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zerodha_user_id,
          variety:            order.variety || 'regular',
          exchange:           order.exchange,
          tradingsymbol:      order.tradingsymbol,
          transaction_type:   order.transaction_type,
          order_type:         orderType,
          quantity:           qtyNum,
          price:              orderType === 'LIMIT' ? priceNum : 0,
          product:            order.product,
          validity:           order.validity || 'DAY',
          disclosed_quantity: order.disclosed_quantity ?? 0,
          trigger_price:      order.trigger_price ?? 0,
          squareoff:          0,
          stoploss:           0,
          trailing_stoploss:  0,
        }),
      });
      const data = await res.json() as any;
      const msg = res.ok ? 'Order modified successfully' : (data?.error || 'Modify failed');
      setResult({ ok: res.ok, msg });
      if (res.ok) onModified();
    } catch {
      setResult({ ok: false, msg: 'Network error' });
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onMouseDown={onClose}>
      <div
        ref={modalRef}
        className={`w-[420px] bg-surface-container border ${borderCls} shadow-2xl outline-none`}
        onMouseDown={e => e.stopPropagation()}
        tabIndex={-1}
        onKeyDown={e => {
          if (e.key === 'Escape') { onClose(); return; }
          if (e.key === 'Enter' && !result && step === 'form' && canSubmit) setStep('confirm');
          if (e.key === 'Enter' && !result && step === 'confirm' && !placing) modify();
          if (e.key === 'Enter' && result) onClose();
        }}
      >
        {/* Header */}
        <div className={`px-4 py-3 border-b ${isBuy ? 'bg-secondary/10 border-b-secondary/20' : 'bg-tertiary/10 border-b-tertiary/20'} flex items-center justify-between`}>
          <span className={`font-label-caps text-xs font-bold uppercase tracking-widest ${titleCls}`}>
            Modify Order — {order.transaction_type}
          </span>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Account + instrument strip */}
          <div className="bg-surface-container-high px-3 py-2 border border-outline-variant/30 flex items-center justify-between text-xs font-data-mono">
            <div className="flex flex-col">
              <span className="text-primary font-bold">{zerodha_user_id}</span>
            </div>
            <div className="flex items-center gap-4 text-right">
              <span className={`font-bold ${titleCls}`}>{order.tradingsymbol}</span>
              <span className="text-on-surface-variant">{order.exchange}</span>
            </div>
          </div>

          {result ? (
            <div className={`p-3 text-sm text-center font-medium ${result.ok ? 'text-secondary bg-secondary/10' : 'text-tertiary bg-tertiary/10'}`}>
              {result.msg}
            </div>
          ) : step === 'form' ? (
            <div className="space-y-3">
              {/* Order type toggle */}
              <div className="flex items-center gap-2">
                <span className="font-label-caps text-[10px] text-on-surface-variant uppercase w-20">Order Type</span>
                <div className="flex bg-surface-container-lowest border border-outline-variant p-0.5 gap-0.5">
                  {(['LIMIT', 'MARKET'] as const).map(ot => (
                    <button key={ot} onClick={() => setOrderType(ot)}
                      className={`px-3 py-1 font-label-caps text-[10px] uppercase transition-colors ${orderType === ot ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>
                      {ot}
                    </button>
                  ))}
                </div>
              </div>
              {/* Qty */}
              <div className="flex items-center gap-2">
                <span className="font-label-caps text-[10px] text-on-surface-variant uppercase w-20">Quantity</span>
                <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)}
                  className="flex-1 bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-2 py-1.5 text-sm focus:border-primary focus:outline-none" />
              </div>
              {/* Price */}
              {orderType === 'LIMIT' && (
                <div className="flex items-center gap-2">
                  <span className="font-label-caps text-[10px] text-on-surface-variant uppercase w-20">Price</span>
                  <input type="number" min="0" step="0.05" value={price} onChange={e => setPrice(e.target.value)}
                    className="flex-1 bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-2 py-1.5 text-sm focus:border-primary focus:outline-none" />
                </div>
              )}
              <button onClick={() => setStep('confirm')} disabled={!canSubmit}
                className={`w-full py-2 font-label-caps text-xs uppercase font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${btnCls}`}>
                Review Changes
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-surface-container-high border border-outline-variant/30 divide-y divide-outline-variant/20 text-xs font-data-mono">
                {[
                  ['Instrument', `${order.tradingsymbol} / ${order.exchange}`],
                  ['Type', order.transaction_type],
                  ['Order Type', orderType],
                  ['Quantity', qtyNum.toLocaleString('en-IN')],
                  ...(orderType === 'LIMIT' ? [['Price', `₹${inrDec(priceNum)}`]] : []),
                  ['Product', order.product],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between px-3 py-2">
                    <span className="text-on-surface-variant">{k}</span>
                    <span className="text-on-surface font-medium">{v}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep('form')} className="flex-1 py-2 font-label-caps text-xs uppercase border border-outline-variant text-on-surface-variant hover:text-on-surface transition-colors">
                  Back
                </button>
                <button onClick={modify} disabled={placing}
                  className={`flex-1 py-2 font-label-caps text-xs uppercase font-bold disabled:opacity-40 transition-colors ${btnCls}`}>
                  {placing ? 'Modifying…' : 'Confirm Modify'}
                </button>
              </div>
            </div>
          )}

          {result && (
            <button onClick={onClose} className="w-full py-2 font-label-caps text-xs uppercase border border-outline-variant text-on-surface-variant hover:text-on-surface transition-colors">
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── OrderCancelModal ──────────────────────────────────────────────────────────

interface OrderCancelModalProps {
  order: KiteOrder;
  zerodha_user_id: string;
  onClose: () => void;
  onCancelled: () => void;
}

function OrderCancelModal({ order, zerodha_user_id, onClose, onCancelled }: OrderCancelModalProps) {
  const [cancelling, setCancelling] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setTimeout(() => modalRef.current?.focus(), 50); }, []);

  async function cancel() {
    setCancelling(true);
    try {
      const res = await fetch(`/api/orders/${order.order_id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zerodha_user_id, variety: order.variety || 'regular' }),
      });
      const data = await res.json() as any;
      const msg = res.ok ? 'Order cancelled' : (data?.error || 'Cancel failed');
      setResult({ ok: res.ok, msg });
      if (res.ok) onCancelled();
    } catch {
      setResult({ ok: false, msg: 'Network error' });
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onMouseDown={onClose}>
      <div
        ref={modalRef}
        className="w-[380px] bg-surface-container border border-tertiary/30 shadow-2xl outline-none"
        onMouseDown={e => e.stopPropagation()}
        tabIndex={-1}
        onKeyDown={e => {
          if (e.key === 'Escape') { onClose(); return; }
          if (e.key === 'Enter' && !result && !cancelling) cancel();
          if (e.key === 'Enter' && result) onClose();
        }}
      >
        <div className="px-4 py-3 bg-tertiary/10 border-b border-tertiary/20 flex items-center justify-between">
          <span className="font-label-caps text-xs font-bold uppercase tracking-widest text-tertiary">Cancel Order</span>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>
        <div className="p-4 space-y-3">
          {result ? (
            <div className={`p-3 text-sm text-center font-medium ${result.ok ? 'text-secondary bg-secondary/10' : 'text-tertiary bg-tertiary/10'}`}>
              {result.msg}
            </div>
          ) : (
            <>
              <p className="text-sm text-on-surface-variant text-center">
                Cancel this order for <span className="text-on-surface font-bold">{order.tradingsymbol}</span>?
              </p>
              <div className="bg-surface-container-high border border-outline-variant/30 divide-y divide-outline-variant/20 text-xs font-data-mono">
                {[
                  ['Account',    zerodha_user_id],
                  ['Instrument', `${order.tradingsymbol} / ${order.exchange}`],
                  ['Type',       order.transaction_type],
                  ['Qty',        `${order.filled_quantity} / ${order.quantity}`],
                  ['Price',      order.price > 0 ? `₹${inrDec(order.price)}` : 'MARKET'],
                  ['Order ID',   order.order_id],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between px-3 py-2">
                    <span className="text-on-surface-variant">{k}</span>
                    <span className="text-on-surface">{v}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={onClose} className="flex-1 py-2 font-label-caps text-xs uppercase border border-outline-variant text-on-surface-variant hover:text-on-surface transition-colors">
                  Keep Order
                </button>
                <button onClick={cancel} disabled={cancelling}
                  className="flex-1 py-2 font-label-caps text-xs uppercase font-bold disabled:opacity-40 transition-colors bg-tertiary/20 border border-tertiary/50 text-tertiary hover:bg-tertiary/30">
                  {cancelling ? 'Cancelling…' : 'Cancel Order'}
                </button>
              </div>
            </>
          )}
          {result && (
            <button onClick={onClose} className="w-full py-2 font-label-caps text-xs uppercase border border-outline-variant text-on-surface-variant hover:text-on-surface transition-colors">
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Trade Journal position helpers ────────────────────────────────────────────

function fmtJournalDate(d: string | null): string {
  if (!d) return '—';
  const parts = d.split('-');
  if (parts.length !== 3) return d;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parts[2]}-${months[parseInt(parts[1], 10) - 1]}-${parts[0].slice(2)}`;
}

interface TJRecord {
  id: number; qty: number; buy_price: number; buy_date: string | null;
  method: string; account: string; instrument: string; stop_loss: number | null;
}

type PosAllocAction =
  | { type: 'full_close'; tradeId: number; qty: number;                             buyDate: string | null; buyPrice: number }
  | { type: 'split';      tradeId: number; closedQty: number; remainingQty: number; buyDate: string | null; buyPrice: number }
  | { type: 'unchanged';  tradeId: number; qty: number;                             buyDate: string | null; buyPrice: number };

function computePosAllocation(trades: TJRecord[], sellQty: number): PosAllocAction[] {
  const sorted = [...trades].sort((a, b) => {
    const da = a.buy_date ?? '9999-99-99', db = b.buy_date ?? '9999-99-99';
    return da !== db ? da.localeCompare(db) : a.id - b.id;
  });
  const actions: PosAllocAction[] = [];
  let remaining = sellQty;
  for (const t of sorted) {
    if (remaining < 0.0001) {
      actions.push({ type: 'unchanged',  tradeId: t.id, qty: t.qty, buyDate: t.buy_date, buyPrice: t.buy_price });
    } else if (t.qty <= remaining + 0.0001) {
      actions.push({ type: 'full_close', tradeId: t.id, qty: t.qty, buyDate: t.buy_date, buyPrice: t.buy_price });
      remaining -= t.qty;
    } else {
      actions.push({ type: 'split', tradeId: t.id, closedQty: remaining, remainingQty: t.qty - remaining, buyDate: t.buy_date, buyPrice: t.buy_price });
      remaining = 0;
    }
  }
  return actions;
}

function PosAllocationTable({ actions }: { actions: PosAllocAction[] }) {
  return (
    <div className="border border-outline-variant text-xs divide-y divide-outline-variant/30">
      <div className="grid grid-cols-3 px-3 py-1.5 bg-surface-container-high text-[10px] text-on-surface-variant uppercase font-label-caps">
        <span>Buy Date</span><span className="text-right pr-4">Orig Qty</span><span>Action</span>
      </div>
      {actions.map((a, i) => {
        const origQty = a.type === 'split' ? a.closedQty + a.remainingQty : a.qty;
        return (
          <div key={i} className={`grid grid-cols-3 px-3 py-2 items-center font-data-mono ${
            a.type === 'full_close' ? 'bg-secondary/5' : a.type === 'split' ? 'bg-primary/5' : ''
          }`}>
            <span className="text-on-surface-variant">{fmtJournalDate(a.buyDate)}</span>
            <span className="text-right pr-4 text-on-surface">{origQty}</span>
            {a.type === 'full_close' ? (
              <span className="text-secondary font-semibold">Close all {a.qty}</span>
            ) : a.type === 'split' ? (
              <span className="text-primary font-semibold">Close {a.closedQty} · Keep {Number(a.remainingQty.toFixed(4))}</span>
            ) : (
              <span className="text-on-surface-variant">No change</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── PositionAddEntryModal ─────────────────────────────────────────────────────

function PositionAddEntryModal({ account, position, onClose, onSaved }: {
  account: string; position: KitePosition; onClose: () => void; onSaved: () => void;
}) {
  const [methods,   setMethods]   = useState<string[]>([]);
  const [method,    setMethod]    = useState('');
  const [qty,       setQty]       = useState(String(Math.abs(position.quantity)));
  const [buyPrice,  setBuyPrice]  = useState(position.average_price.toFixed(2));
  const [sellPrice, setSellPrice] = useState((position.average_price * 1.4).toFixed(2));
  const [stopLoss,  setStopLoss]  = useState('');
  const [buyDate,   setBuyDate]   = useState(new Date().toISOString().slice(0, 10));
  const [sellDate,  setSellDate]  = useState('');
  const [step,      setStep]      = useState<'form' | 'confirm' | 'done'>('form');
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/trade-journal/methods').then(r => r.json()).then((d: any) => setMethods(d.data ?? [])).catch(() => {});
  }, []);
  useEffect(() => { setTimeout(() => modalRef.current?.focus(), 50); }, []);
  useEffect(() => { if (step !== 'form') setTimeout(() => modalRef.current?.focus(), 50); }, [step]);
  useEffect(() => {
    const n = parseFloat(buyPrice);
    if (!isNaN(n) && n > 0) setSellPrice((n * 1.4).toFixed(2)); else setSellPrice('');
  }, [buyPrice]);

  const qtyNum = parseFloat(qty), buyPriceNum = parseFloat(buyPrice);
  const canSubmit = method && !isNaN(qtyNum) && qtyNum > 0 && !isNaN(buyPriceNum) && buyPriceNum > 0;

  async function save() {
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/trade-journal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instrument: position.tradingsymbol, method, account,
          qty: qtyNum, buy_price: buyPriceNum,
          sell_price: sellPrice ? parseFloat(sellPrice) : null,
          stop_loss:  stopLoss  ? parseFloat(stopLoss)  : null,
          buy_date: buyDate || null, sell_date: sellDate || null,
        }),
      });
      if (!res.ok) { const d = await res.json() as any; setError(d?.error || 'Create failed'); setStep('form'); }
      else { setStep('done'); }
    } catch { setError('Network error'); setStep('form'); }
    finally { setSaving(false); }
  }

  const inputCls = 'w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-3 py-1.5 text-xs focus:outline-none focus:border-primary';
  const labelCls = 'font-label-caps text-[10px] text-on-surface-variant uppercase block mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onMouseDown={onClose}>
      <div ref={modalRef}
        className="w-[500px] max-h-[90vh] flex flex-col bg-surface-container border border-secondary/30 shadow-2xl outline-none"
        onMouseDown={e => e.stopPropagation()} tabIndex={-1}
        onKeyDown={e => {
          if (e.key === 'Escape') { onClose(); return; }
          if (e.key === 'Enter') {
            if (step === 'done')               { onSaved(); return; }
            if (step === 'form' && canSubmit)  { setStep('confirm'); return; }
            if (step === 'confirm' && !saving) { save(); return; }
          }
        }}
      >
        <div className="bg-secondary/10 border-b border-secondary/20 px-5 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-secondary">add_circle</span>
            <span className="font-bold text-sm uppercase tracking-widest text-secondary">Add Journal Entry</span>
            <span className="text-xs text-on-surface-variant font-data-mono ml-1">— {position.tradingsymbol}</span>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {step === 'done' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-secondary/10 text-secondary">
                <span className="material-symbols-outlined text-base">check_circle</span>
                <span className="text-sm font-data-mono">Trade entry added successfully</span>
              </div>
              <button onClick={onSaved} className="w-full py-2 bg-surface-container-high text-on-surface font-label-caps text-xs uppercase hover:brightness-110 transition-all">Close</button>
            </div>
          )}

          {step === 'confirm' && (
            <div className="space-y-3">
              <p className="text-xs text-on-surface-variant font-label-caps uppercase">Review new entry</p>
              <div className="bg-surface-container-high border border-outline-variant text-xs font-data-mono divide-y divide-outline-variant/30">
                {([
                  ['Instrument', position.tradingsymbol], ['Account', account], ['Method', method],
                  ['Qty', qty], ['Avg Cost', buyPrice],
                  ...(sellPrice ? [['Sell / Target', sellPrice]] as [string,string][] : []),
                  ...(stopLoss  ? [['Stop Loss',     stopLoss]]  as [string,string][] : []),
                  ...(buyDate   ? [['Buy Date',      buyDate]]   as [string,string][] : []),
                  ...(sellDate  ? [['Sell Date',     sellDate]]  as [string,string][] : []),
                ] as [string,string][]).map(([l, v]) => (
                  <div key={l} className="px-4 py-2.5 grid grid-cols-2 items-center gap-2">
                    <span className="text-on-surface-variant text-[10px] uppercase font-label-caps">{l}</span>
                    <span className="text-secondary font-bold text-right">{v}</span>
                  </div>
                ))}
              </div>
              {error && <div className="flex items-center gap-2 p-2 bg-tertiary/10 text-tertiary text-xs"><span className="material-symbols-outlined" style={{ fontSize: '14px' }}>error</span>{error}</div>}
              <div className="flex gap-2">
                <button onClick={() => setStep('form')} disabled={saving} className="flex-1 py-2 bg-surface-container-high text-on-surface font-label-caps text-xs uppercase hover:brightness-110 transition-all">Back</button>
                <button onClick={save} disabled={saving} className="flex-1 py-2 font-label-caps text-xs uppercase font-bold transition-all disabled:opacity-40 bg-secondary/20 border border-secondary/50 text-secondary hover:bg-secondary/30">
                  {saving ? 'Saving…' : 'Confirm Add'}
                </button>
              </div>
            </div>
          )}

          {step === 'form' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                {[['Instrument', position.tradingsymbol], ['Account', account]].map(([l, v]) => (
                  <div key={l} className="bg-surface-container-high border border-outline-variant px-3 py-2">
                    <p className={labelCls}>{l}</p>
                    <p className="font-data-mono text-xs font-bold text-on-surface">{v}</p>
                  </div>
                ))}
              </div>
              {error && <div className="flex items-center gap-2 p-2 bg-tertiary/10 text-tertiary text-xs"><span className="material-symbols-outlined" style={{ fontSize: '14px' }}>error</span>{error}</div>}
              <div>
                <label className={labelCls}>Method</label>
                <AppSelect value={method} onChange={setMethod} options={methods} listMaxHeight="max-h-36" placeholder="Select method…" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>Qty</label><input type="text" inputMode="decimal" value={qty} onChange={e => setQty(e.target.value.replace(/[^0-9.]/g, ''))} className={inputCls} /></div>
                <div><label className={labelCls}>Avg Cost</label><input type="text" inputMode="decimal" value={buyPrice} onChange={e => setBuyPrice(e.target.value.replace(/[^0-9.]/g, ''))} className={inputCls} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>Sell / Target Price</label><input type="text" inputMode="decimal" value={sellPrice} onChange={e => setSellPrice(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="—" className={inputCls} /></div>
                <div><label className={labelCls}>Stop Loss</label><input type="text" inputMode="decimal" value={stopLoss} onChange={e => setStopLoss(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="—" className={inputCls} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>Buy Date</label><input type="date" value={buyDate} onChange={e => setBuyDate(e.target.value)} className={`${inputCls} [color-scheme:dark]`} /></div>
                <div><label className={labelCls}>Sell Date</label><input type="date" value={sellDate} onChange={e => setSellDate(e.target.value)} className={`${inputCls} [color-scheme:dark]`} /></div>
              </div>
              <button onClick={() => canSubmit && setStep('confirm')} disabled={!canSubmit}
                className="w-full py-2 font-label-caps text-xs uppercase font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-secondary/20 border border-secondary/50 text-secondary hover:bg-secondary/30">
                Review Entry
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── PositionCloseModal ────────────────────────────────────────────────────────

function PositionCloseModal({ account, position, onClose, onSaved }: {
  account: string; position: KitePosition; onClose: () => void; onSaved: () => void;
}) {
  const [openTrades,    setOpenTrades]    = useState<TJRecord[]>([]);
  const [loadingTrades, setLoadingTrades] = useState(true);
  const [tradesError,   setTradesError]   = useState<string | null>(null);
  const [sellQty,   setSellQty]   = useState(String(Math.abs(position.quantity)));
  const [sellPrice, setSellPrice] = useState(position.average_price.toFixed(2));
  const [sellDate,  setSellDate]  = useState(new Date().toISOString().slice(0, 10));
  const [step,      setStep]      = useState<'form' | 'confirm' | 'done'>('form');
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/trade-journal?status=open&accounts=${encodeURIComponent(account)}&instrument=${encodeURIComponent(position.tradingsymbol)}`)
      .then(r => r.json())
      .then((d: any) => {
        const rows: TJRecord[] = (d.data ?? []).map((r: any) => ({ ...r, qty: parseFloat(r.qty), buy_price: parseFloat(r.buy_price) }));
        setOpenTrades(rows.sort((a, b) => {
          const da = a.buy_date ?? '9999-99-99', db = b.buy_date ?? '9999-99-99';
          return da !== db ? da.localeCompare(db) : a.id - b.id;
        }));
        setLoadingTrades(false);
      })
      .catch(() => { setTradesError('Failed to load open trades'); setLoadingTrades(false); });
  }, [account, position.tradingsymbol]);

  useEffect(() => { setTimeout(() => modalRef.current?.focus(), 50); }, []);
  useEffect(() => { if (step !== 'form') setTimeout(() => modalRef.current?.focus(), 50); }, [step]);

  const totalOpenQty = useMemo(() => openTrades.reduce((s, t) => s + t.qty, 0), [openTrades]);
  const sellQtyNum   = parseFloat(sellQty);
  const sellPriceNum = parseFloat(sellPrice);
  const qtyExceeds   = !isNaN(sellQtyNum) && totalOpenQty > 0 && sellQtyNum > totalOpenQty + 0.0001;

  const allocation = useMemo((): PosAllocAction[] => {
    if (!openTrades.length || isNaN(sellQtyNum) || sellQtyNum <= 0) return [];
    return computePosAllocation(openTrades, Math.min(sellQtyNum, totalOpenQty));
  }, [openTrades, sellQtyNum, totalOpenQty]);

  const canSubmit = !isNaN(sellQtyNum) && sellQtyNum > 0 && !qtyExceeds
    && !isNaN(sellPriceNum) && sellPriceNum > 0 && !!sellDate && openTrades.length > 0;

  async function executeClose() {
    setSubmitting(true); setError(null);
    try {
      const res = await fetch('/api/trade-journal/close-position', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account, instrument: position.tradingsymbol, sell_qty: sellQtyNum, sell_price: sellPriceNum, sell_date: sellDate }),
      });
      if (!res.ok) { const d = await res.json() as any; setError(d?.error || 'Close failed'); setStep('form'); }
      else { setStep('done'); }
    } catch { setError('Network error'); setStep('form'); }
    finally { setSubmitting(false); }
  }

  const inputCls = 'w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-3 py-1.5 text-xs focus:outline-none focus:border-primary';
  const labelCls = 'font-label-caps text-[10px] text-on-surface-variant uppercase block mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onMouseDown={onClose}>
      <div ref={modalRef}
        className="w-[560px] max-h-[90vh] flex flex-col bg-surface-container border border-primary/30 shadow-2xl outline-none"
        onMouseDown={e => e.stopPropagation()} tabIndex={-1}
        onKeyDown={e => {
          if (e.key === 'Escape') { onClose(); return; }
          if (e.key === 'Enter') {
            if (step === 'done')                  { onSaved(); return; }
            if (step === 'form' && canSubmit)     { setStep('confirm'); return; }
            if (step === 'confirm' && !submitting){ executeClose(); return; }
          }
        }}
      >
        <div className="bg-primary/10 border-b border-primary/20 px-5 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-primary">price_change</span>
            <span className="font-bold text-sm uppercase tracking-widest text-primary">Close Position</span>
            <span className="text-xs text-on-surface-variant font-data-mono ml-1">— {position.tradingsymbol} · {account}</span>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {step === 'done' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-secondary/10 text-secondary">
                <span className="material-symbols-outlined text-base">check_circle</span>
                <span className="text-sm font-data-mono">Position closed successfully</span>
              </div>
              <button onClick={onSaved} className="w-full py-2 bg-surface-container-high text-on-surface font-label-caps text-xs uppercase hover:brightness-110 transition-all">Close</button>
            </div>
          )}

          {step === 'confirm' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {([
                  ['Account', account], ['Instrument', position.tradingsymbol],
                  ['Sell Qty', String(sellQtyNum)], ['Sell Price', String(sellPriceNum)],
                  ['Sell Date', sellDate], ['Trades affected', String(allocation.filter(a => a.type !== 'unchanged').length)],
                ] as [string,string][]).map(([l, v]) => (
                  <div key={l} className="bg-surface-container-high border border-outline-variant px-3 py-2 flex justify-between gap-2 text-xs">
                    <span className="text-on-surface-variant text-[10px] uppercase font-label-caps">{l}</span>
                    <span className="font-data-mono text-on-surface font-bold">{v}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className={labelCls}>FIFO Allocation</p>
                <PosAllocationTable actions={allocation} />
              </div>
              {error && <div className="flex items-center gap-2 p-2 bg-error/10 text-error text-xs"><span className="material-symbols-outlined" style={{ fontSize: '14px' }}>error</span>{error}</div>}
              <div className="flex gap-2">
                <button onClick={() => setStep('form')} disabled={submitting} className="flex-1 py-2 bg-surface-container-high text-on-surface font-label-caps text-xs uppercase hover:brightness-110 transition-all">Back</button>
                <button onClick={executeClose} disabled={submitting} className="flex-1 py-2 font-label-caps text-xs uppercase font-bold transition-all disabled:opacity-40 bg-primary/20 border border-primary/50 text-primary hover:bg-primary/30">
                  {submitting ? 'Executing…' : 'Execute Close'}
                </button>
              </div>
            </div>
          )}

          {step === 'form' && (
            loadingTrades ? (
              <div className="flex items-center justify-center p-8 text-xs text-on-surface-variant font-label-caps">Loading open trades…</div>
            ) : tradesError ? (
              <div className="flex items-center gap-2 p-4 bg-error/10 text-error text-xs"><span className="material-symbols-outlined" style={{ fontSize: '14px' }}>error</span>{tradesError}</div>
            ) : openTrades.length === 0 ? (
              <div className="space-y-3">
                <div className="p-4 bg-surface-container-high border border-outline-variant text-xs text-on-surface-variant text-center">
                  No open journal entries found for <span className="font-bold text-on-surface">{position.tradingsymbol}</span> in account <span className="font-bold text-on-surface">{account}</span>.
                </div>
                <button onClick={onClose} className="w-full py-2 bg-surface-container-high text-on-surface font-label-caps text-xs uppercase hover:brightness-110 transition-all">Close</button>
              </div>
            ) : (
              <>
                <div>
                  <label className={labelCls}>Open Journal Entries — FIFO order (oldest first)</label>
                  <div className="border border-outline-variant text-xs divide-y divide-outline-variant/30">
                    <div className="grid grid-cols-4 px-3 py-1.5 bg-surface-container-high text-[10px] text-on-surface-variant uppercase font-label-caps">
                      <span>#</span><span>Buy Date</span><span className="text-right">Qty</span><span className="text-right">Avg Cost</span>
                    </div>
                    {openTrades.map((t, i) => (
                      <div key={t.id} className="grid grid-cols-4 px-3 py-2 font-data-mono text-on-surface">
                        <span className="text-on-surface-variant">{i + 1}</span>
                        <span>{fmtJournalDate(t.buy_date)}</span>
                        <span className="text-right">{t.qty}</span>
                        <span className="text-right">{t.buy_price.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="grid grid-cols-4 px-3 py-1.5 bg-surface-container-high font-data-mono text-xs">
                      <span className="col-span-2 text-on-surface-variant text-[10px] uppercase font-label-caps">Total</span>
                      <span className="text-right font-bold text-on-surface">{totalOpenQty}</span>
                      <span />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>Sell Qty</label>
                    <input type="text" inputMode="decimal" value={sellQty} onChange={e => setSellQty(e.target.value.replace(/[^0-9.]/g, ''))} className={`${inputCls} ${qtyExceeds ? 'border-error' : ''}`} />
                    {qtyExceeds && <p className="text-[10px] text-error mt-0.5">Max: {totalOpenQty}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>Sell Price</label>
                    <input type="text" inputMode="decimal" value={sellPrice} onChange={e => setSellPrice(e.target.value.replace(/[^0-9.]/g, ''))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Sell Date</label>
                    <input type="date" value={sellDate} onChange={e => setSellDate(e.target.value)} className={`${inputCls} [color-scheme:dark]`} />
                  </div>
                </div>

                {allocation.length > 0 && (
                  <div>
                    <label className={labelCls}>FIFO Allocation Preview</label>
                    <PosAllocationTable actions={allocation} />
                  </div>
                )}

                {error && <div className="flex items-center gap-2 p-2 bg-error/10 text-error text-xs"><span className="material-symbols-outlined" style={{ fontSize: '14px' }}>error</span>{error}</div>}

                <div className="flex gap-2">
                  <button onClick={onClose} className="flex-1 py-2 bg-surface-container-high text-on-surface font-label-caps text-xs uppercase hover:brightness-110 transition-all">Cancel</button>
                  <button onClick={() => canSubmit && setStep('confirm')} disabled={!canSubmit}
                    className="flex-1 py-2 font-label-caps text-xs uppercase font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-primary/20 border border-primary/50 text-primary hover:bg-primary/30">
                    Review Close
                  </button>
                </div>
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BulkOrderPage() {
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [exitType, setExitType] = useState<'full' | 'partial'>('partial');
  const [activePct, setActivePct] = useState('50%');
  const [customPct, setCustomPct] = useState('');
  const [sellHoldings, setSellHoldings] = useState<SellHolding[]>([]);
  const [loadingSellHoldings, setLoadingSellHoldings] = useState(false);
  const [sellSelected, setSellSelected] = useState<Record<string, boolean>>({});
  const [sellLimitPrice, setSellLimitPrice] = useState('');
  const [sellOrderType, setSellOrderType] = useState<'LIMIT' | 'MARKET'>('LIMIT');
  const [sellQtyOverrides, setSellQtyOverrides] = useState<Record<string, string>>({});
  const [sellOrderStatus, setSellOrderStatus] = useState<Record<string, 'idle' | 'loading' | 'success' | 'error'>>({});
  const [sellOrderMessage, setSellOrderMessage] = useState<Record<string, string>>({});
  const [bulkSelling, setBulkSelling] = useState(false);
  const [sellConfirmModal, setSellConfirmModal] = useState<SellHolding | null>(null);
  const [showSellMultipleConfirm, setShowSellMultipleConfirm] = useState(false);
  const [buyConfirmModal, setBuyConfirmModal] = useState<BuyUser | null>(null);
  const [showBuyMultipleConfirm, setShowBuyMultipleConfirm] = useState(false);

  // Orders panel state
  const [selectedOrdersUserId, setSelectedOrdersUserId] = useState('');
  const [ordersDropdownOpen, setOrdersDropdownOpen]     = useState(false);
  const [ordersSearchQuery, setOrdersSearchQuery]       = useState('');
  const [focusedOrderUserIdx, setFocusedOrderUserIdx]   = useState(-1);
  const [openOrders, setOpenOrders]         = useState<KiteOrder[]>([]);
  const [executedOrders, setExecutedOrders] = useState<KiteOrder[]>([]);
  const [loadingOrders, setLoadingOrders]   = useState(false);
  const [modifyModal, setModifyModal]       = useState<KiteOrder | null>(null);
  const [cancelModal, setCancelModal]       = useState<KiteOrder | null>(null);
  const [positions, setPositions]           = useState<KitePosition[]>([]);
  const [loadingPositions, setLoadingPositions] = useState(false);
  const [positionModal, setPositionModal]   = useState<{ type: 'add' | 'close'; position: KitePosition } | null>(null);
  const ordersDropdownRef   = useRef<HTMLDivElement>(null);
  const ordersSearchRef     = useRef<HTMLInputElement>(null);
  const ordersUserListRef   = useRef<HTMLDivElement>(null);
  const ordersUserItemRefs  = useRef<(HTMLButtonElement | null)[]>([]);

  const [selectedSecurity, setSelectedSecurity] = useState<SecurityOption | null>(null);
  const [ltp, setLtp]           = useState<number | null>(null);
  const [ltpLoading, setLtpLoading] = useState(false);

  // Fetch LTP whenever the selected security changes
  useEffect(() => {
    if (!selectedSecurity) { setLtp(null); return; }
    const symbol = `${selectedSecurity.exchange}:${selectedSecurity.symbol}-${selectedSecurity.series}`;
    setLtpLoading(true);
    setLtp(null);
    fetch('/api/fyers/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols: [symbol] }),
    })
      .then(r => r.json())
      .then(res => {
        const price = res.data?.[symbol]?.lp ?? null;
        setLtp(price);
        if (price != null) setEntryPrice(String(price));
      })
      .catch(() => {})
      .finally(() => setLtpLoading(false));
  }, [selectedSecurity]);

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
          exchange:           selectedSecurity.exchange,
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

  // Auto-fill sell limit price from LTP
  useEffect(() => {
    if (ltp != null) setSellLimitPrice(String(ltp));
  }, [ltp]);

  // Fetch sell holdings for selected security across all active users
  useEffect(() => {
    if (!selectedSecurity || buyUsers.length === 0) { setSellHoldings([]); return; }
    setLoadingSellHoldings(true);
    Promise.all(
      buyUsers.map(u =>
        fetch(`/api/users/${encodeURIComponent(u.zerodha_user_id)}/holdings`)
          .then(r => r.json())
          .then((res: { data?: { tradingsymbol: string; quantity: number; average_price: number }[] }) => {
            const match = (res.data ?? []).find(h => h.tradingsymbol === selectedSecurity.symbol);
            if (!match || match.quantity <= 0) return null;
            return { zerodha_user_id: u.zerodha_user_id, name: u.name, quantity: match.quantity, average_price: match.average_price } as SellHolding;
          })
          .catch(() => null)
      )
    ).then(results => {
      const valid = results.filter((h): h is SellHolding => h !== null);
      setSellHoldings(valid);
      const sel: Record<string, boolean> = {};
      valid.forEach(h => { sel[h.zerodha_user_id] = true; });
      setSellSelected(sel);
      setSellQtyOverrides({});
    }).finally(() => setLoadingSellHoldings(false));
  }, [selectedSecurity, buyUsers]);

  function effectivePct(): number {
    if (exitType === 'full') return 100;
    const c = parseFloat(customPct);
    if (customPct.trim() !== '' && !isNaN(c) && c > 0) return Math.min(c, 100);
    const a = parseFloat(activePct);
    return isNaN(a) ? 50 : a;
  }

  function computeSellQty(h: SellHolding): number {
    const ov = sellQtyOverrides[h.zerodha_user_id];
    if (ov !== undefined) return parseInt(ov, 10) || 0;
    return Math.floor(h.quantity * effectivePct() / 100);
  }

  function sellQtyInputValue(h: SellHolding): string {
    const ov = sellQtyOverrides[h.zerodha_user_id];
    if (ov !== undefined) return ov;
    return String(Math.floor(h.quantity * effectivePct() / 100));
  }

  async function placeSellOrder(h: SellHolding) {
    if (!selectedSecurity) return;
    const qty = computeSellQty(h);
    if (qty <= 0) return;
    setSellOrderStatus(s => ({ ...s, [h.zerodha_user_id]: 'loading' }));
    setSellOrderMessage(m => ({ ...m, [h.zerodha_user_id]: '' }));
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zerodha_user_id:    h.zerodha_user_id,
          exchange:           selectedSecurity.exchange,
          tradingSymbol:      selectedSecurity.symbol,
          transaction_type:   'SELL',
          order_type:         sellOrderType,
          price:              sellOrderType === 'LIMIT' ? (parseFloat(sellLimitPrice) || 0) : 0,
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
        setSellOrderStatus(s => ({ ...s, [h.zerodha_user_id]: 'error' }));
        setSellOrderMessage(m => ({ ...m, [h.zerodha_user_id]: data?.error || 'Failed' }));
      } else {
        setSellOrderStatus(s => ({ ...s, [h.zerodha_user_id]: 'success' }));
        setSellOrderMessage(m => ({ ...m, [h.zerodha_user_id]: data?.data?.order_id ? `#${data.data.order_id}` : 'Placed' }));
      }
    } catch {
      setSellOrderStatus(s => ({ ...s, [h.zerodha_user_id]: 'error' }));
      setSellOrderMessage(m => ({ ...m, [h.zerodha_user_id]: 'Network error' }));
    }
  }

  async function placeBulkSellOrders() {
    const targets = sellHoldings.filter(h => sellSelected[h.zerodha_user_id] && computeSellQty(h) > 0);
    if (!targets.length) return;
    setBulkSelling(true);
    await Promise.allSettled(targets.map(h => placeSellOrder(h)));
    setBulkSelling(false);
  }

  const allSellSelected = sellHoldings.length > 0 && sellHoldings.every(h => sellSelected[h.zerodha_user_id]);
  const selectedSellCount = sellHoldings.filter(h => sellSelected[h.zerodha_user_id]).length;

  // Orders panel — close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ordersDropdownRef.current && !ordersDropdownRef.current.contains(e.target as Node))
        setOrdersDropdownOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Orders panel — focus search when dropdown opens
  useEffect(() => {
    if (ordersDropdownOpen) setTimeout(() => ordersSearchRef.current?.focus(), 50);
    else { setFocusedOrderUserIdx(-1); ordersUserItemRefs.current = []; }
  }, [ordersDropdownOpen]);

  // Orders panel — scroll focused item into view
  useEffect(() => {
    if (focusedOrderUserIdx >= 0) ordersUserItemRefs.current[focusedOrderUserIdx]?.scrollIntoView({ block: 'nearest' });
  }, [focusedOrderUserIdx]);

  // Orders panel — fetch orders when user changes
  const filteredOrderUsers = useMemo(() => {
    const q = ordersSearchQuery.toLowerCase();
    return buyUsers.filter(u => !q || u.zerodha_user_id.toLowerCase().includes(q) || (u.name ?? '').toLowerCase().includes(q));
  }, [buyUsers, ordersSearchQuery]);

  function fetchOrders(userId: string) {
    if (!userId) { setOpenOrders([]); setExecutedOrders([]); return; }
    setLoadingOrders(true);
    fetch(`/api/orders/user/${encodeURIComponent(userId)}`)
      .then(r => r.json())
      .then(res => {
        const orders: KiteOrder[] = res.data ?? [];
        setOpenOrders(orders.filter(o => OPEN_STATUSES.has(o.status)));
        setExecutedOrders(orders.filter(o => !OPEN_STATUSES.has(o.status)));
      })
      .catch(() => {})
      .finally(() => setLoadingOrders(false));
  }

  function fetchPositions(userId: string) {
    if (!userId) { setPositions([]); return; }
    setLoadingPositions(true);
    fetch(`/api/positions/user/${encodeURIComponent(userId)}`)
      .then(r => r.json())
      .then(res => setPositions(res.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingPositions(false));
  }

  useEffect(() => { fetchOrders(selectedOrdersUserId); fetchPositions(selectedOrdersUserId); }, [selectedOrdersUserId]);

  function handleOrderUserKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocusedOrderUserIdx(i => Math.min(i + 1, filteredOrderUsers.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setFocusedOrderUserIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const t = focusedOrderUserIdx >= 0 ? filteredOrderUsers[focusedOrderUserIdx] : filteredOrderUsers[0];
      if (t) { setSelectedOrdersUserId(t.zerodha_user_id); setOrdersDropdownOpen(false); }
    } else if (e.key === 'Escape') { setOrdersDropdownOpen(false); }
  }

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
                    {selectedSecurity.series}&nbsp;&nbsp;{selectedSecurity.exchange}
                  </p>
                </div>
              </>
            )}
            <div className="h-10 w-px bg-outline-variant/30" />
            <div>
              <p className="font-label-caps text-[10px] text-on-surface-variant mb-1">LTP</p>
              <p className="font-data-mono text-on-surface text-sm">
                {ltpLoading
                  ? <span className="text-on-surface-variant text-xs">…</span>
                  : ltp != null
                    ? ltp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : <span className="text-on-surface-variant">—</span>
                }
              </p>
            </div>
          </div>
          {/* Orders user selector */}
          <div className="flex items-center gap-3">
            <label className="font-label-caps text-[10px] text-on-surface-variant uppercase whitespace-nowrap">Orders For</label>
            <div ref={ordersDropdownRef} className="relative">
              <button
                onClick={() => setOrdersDropdownOpen(o => !o)}
                className="flex items-center justify-between gap-3 min-w-48 px-3 py-2 text-sm text-on-surface bg-surface-container-lowest border border-outline-variant hover:border-primary transition-colors focus:outline-none focus:border-primary"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: '15px' }}>person</span>
                  <span className="truncate font-data-mono text-xs">
                    {selectedOrdersUserId
                      ? (() => { const u = buyUsers.find(u => u.zerodha_user_id === selectedOrdersUserId); return u?.name ? `${u.name} (${u.zerodha_user_id})` : selectedOrdersUserId; })()
                      : <span className="text-on-surface-variant">Select user…</span>}
                  </span>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant flex-shrink-0" style={{ fontSize: '15px', transform: ordersDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>expand_more</span>
              </button>
              {ordersDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 min-w-full w-max z-50 bg-surface-container-high border border-outline-variant shadow-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-outline-variant bg-surface-container">
                    <span className="material-symbols-outlined text-on-surface-variant flex-shrink-0" style={{ fontSize: '15px' }}>search</span>
                    <input
                      ref={ordersSearchRef}
                      type="text"
                      value={ordersSearchQuery}
                      onChange={e => setOrdersSearchQuery(e.target.value)}
                      onKeyDown={handleOrderUserKeyDown}
                      placeholder="Search user..."
                      className="flex-1 bg-transparent text-sm text-on-surface placeholder-on-surface-variant/50 outline-none"
                    />
                    {ordersSearchQuery && (
                      <button onClick={() => setOrdersSearchQuery('')}>
                        <span className="material-symbols-outlined text-on-surface-variant hover:text-on-surface transition-colors" style={{ fontSize: '14px' }}>close</span>
                      </button>
                    )}
                  </div>
                  <div ref={ordersUserListRef} className="max-h-56 overflow-y-auto">
                    {filteredOrderUsers.length === 0 ? (
                      <div className="px-3 py-4 text-sm text-on-surface-variant text-center">No users match</div>
                    ) : filteredOrderUsers.map((u, i) => {
                      const label = u.name ? `${u.name} (${u.zerodha_user_id})` : u.zerodha_user_id;
                      const isSelected = u.zerodha_user_id === selectedOrdersUserId;
                      const isFocused  = focusedOrderUserIdx === i;
                      return (
                        <button
                          key={u.zerodha_user_id}
                          ref={el => { ordersUserItemRefs.current[i] = el; }}
                          onClick={() => { setSelectedOrdersUserId(u.zerodha_user_id); setOrdersDropdownOpen(false); }}
                          onMouseEnter={() => setFocusedOrderUserIdx(i)}
                          className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left transition-colors border-l-2
                            ${isSelected ? 'bg-primary/20 text-primary border-primary' : isFocused ? 'bg-surface-variant text-on-surface border-primary' : 'text-on-surface border-transparent'}`}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '14px', opacity: isSelected ? 1 : 0.4 }}>person</span>
                          {label}
                          {isSelected && <span className="material-symbols-outlined text-primary ml-auto" style={{ fontSize: '14px' }}>check</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            {selectedOrdersUserId && (
              <button onClick={() => fetchOrders(selectedOrdersUserId)} title="Refresh orders"
                className="p-1.5 text-on-surface-variant hover:text-on-surface border border-outline-variant hover:border-primary transition-colors">
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>refresh</span>
              </button>
            )}
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
                                    onClick={() => setBuyConfirmModal(u)}
                                    disabled={!selectedSecurity || qty <= 0 || margins[u.zerodha_user_id] == null || (amount != null && amount > margins[u.zerodha_user_id]!)}
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
                        onClick={() => setShowBuyMultipleConfirm(true)}
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
                <section className="bg-surface-container border border-outline-variant">
                  {/* Section header */}
                  <div className="bg-surface-container-high px-4 py-2 border-b border-outline-variant flex flex-wrap justify-between items-center gap-3">
                    <div className="flex items-center gap-4">
                      <h2 className="font-label-caps text-label-caps text-on-surface uppercase">Bulk Sell Management</h2>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id="select-all-sell" checked={allSellSelected}
                          onChange={e => {
                            const sel: Record<string, boolean> = {};
                            sellHoldings.forEach(h => { sel[h.zerodha_user_id] = e.target.checked; });
                            setSellSelected(sel);
                          }}
                          className="w-3 h-3 bg-surface-container-lowest border-outline-variant rounded-sm text-tertiary focus:ring-0" />
                        <label htmlFor="select-all-sell" className="font-label-caps text-[10px] text-on-surface-variant cursor-pointer uppercase">Select All</label>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {sellOrderType === 'LIMIT' && (
                        <input type="text" inputMode="decimal" value={sellLimitPrice}
                          onChange={e => setSellLimitPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                          placeholder="0.00"
                          className="w-28 bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-3 py-1 text-xs focus:border-primary focus:outline-none" />
                      )}
                      <div className="flex bg-surface-container-lowest border border-outline-variant p-0.5">
                        {(['LIMIT', 'MARKET'] as const).map(ot => (
                          <button key={ot} type="button" onClick={() => setSellOrderType(ot)}
                            className={`px-4 py-1 font-label-caps text-[10px] uppercase transition-colors ${
                              sellOrderType === ot
                                ? 'bg-primary text-on-primary'
                                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                            }`}>
                            {ot}
                          </button>
                        ))}
                      </div>
                      <div className="flex bg-surface-container-lowest border border-outline-variant p-0.5">
                        {(['full', 'partial'] as const).map(et => (
                          <button key={et} type="button" onClick={() => setExitType(et)}
                            className={`px-4 py-1 font-label-caps text-[10px] uppercase transition-colors ${
                              exitType === et
                                ? 'bg-tertiary text-on-tertiary'
                                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                            }`}>
                            {et === 'full' ? 'FULL' : 'PARTIAL'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* SELL HOLDING % bar — only when PARTIAL */}
                  {exitType === 'partial' && (
                    <div className="px-4 py-2 border-b border-outline-variant bg-surface-container flex items-center justify-end gap-2">
                      <label className="font-label-caps text-[10px] text-on-surface-variant uppercase whitespace-nowrap">Sell Holding %</label>
                      <div className="flex bg-surface-container-lowest border border-outline-variant p-0.5">
                        {PCT_OPTIONS.map(pct => (
                          <button key={pct} type="button" onClick={() => { setActivePct(pct); setCustomPct(''); }}
                            className={`px-3 py-1 text-[10px] font-bold font-data-mono transition-colors ${
                              activePct === pct && customPct === '' ? 'bg-tertiary text-on-tertiary' : 'hover:bg-tertiary/20 text-on-surface'
                            }`}>{pct}</button>
                        ))}
                        <input
                          type="text"
                          value={customPct}
                          onChange={e => setCustomPct(e.target.value.replace(/[^0-9.]/g, ''))}
                          placeholder="Custom"
                          className="w-16 bg-transparent border-l border-outline-variant text-[10px] text-center font-data-mono focus:outline-none py-1 px-1" />
                      </div>
                    </div>
                  )}

                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left table-fixed">
                      <colgroup>
                        <col className="w-8" />
                        <col className="w-40" />
                        <col className="w-20" />
                        <col className="w-28" />
                        <col className="w-28" />
                        <col className="w-28" />
                        <col className="w-24" />
                        <col className="w-20" />
                        <col className="w-20" />
                        <col className="w-24" />
                      </colgroup>
                      <thead>
                        <tr className="border-b border-outline-variant bg-surface-container-low font-label-caps text-[10px] text-on-surface-variant uppercase">
                          <th className="px-4 py-2"></th>
                          <th className="px-4 py-2">Account / User</th>
                          <th className="px-4 py-2 text-right">Holding</th>
                          <th className="px-4 py-2 text-right">Avg Price</th>
                          <th className="px-4 py-2 text-right">Invested</th>
                          <th className="px-4 py-2 text-right">Curr Value</th>
                          <th className="px-4 py-2 text-right">P&amp;L</th>
                          <th className="px-4 py-2 text-right">P&amp;L%</th>
                          <th className="px-4 py-2 text-right">Sell Qty</th>
                          <th className="px-4 py-2 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="font-data-mono text-xs divide-y divide-outline-variant/10">
                        {loadingSellHoldings && (
                          <tr>
                            <td colSpan={10} className="px-4 py-6 text-center text-on-surface-variant font-label-caps text-[10px]">
                              Loading holdings…
                            </td>
                          </tr>
                        )}
                        {!loadingSellHoldings && !selectedSecurity && (
                          <tr>
                            <td colSpan={10} className="px-4 py-6 text-center text-on-surface-variant font-label-caps text-[10px]">
                              Select a security to view holdings
                            </td>
                          </tr>
                        )}
                        {!loadingSellHoldings && selectedSecurity && sellHoldings.length === 0 && (
                          <tr>
                            <td colSpan={10} className="px-4 py-6 text-center text-on-surface-variant font-label-caps text-[10px]">
                              No holdings found for {selectedSecurity.symbol}
                            </td>
                          </tr>
                        )}
                        {sellHoldings.map(h => {
                          const invested = h.quantity * h.average_price;
                          const ltpVal = ltp ?? 0;
                          const currVal = h.quantity * ltpVal;
                          const pnl = currVal - invested;
                          const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
                          const sellQty = computeSellQty(h);
                          const status = sellOrderStatus[h.zerodha_user_id] ?? 'idle';
                          const msg = sellOrderMessage[h.zerodha_user_id] ?? '';
                          return (
                            <tr key={h.zerodha_user_id} className="hover:bg-surface-container-high transition-colors">
                              <td className="px-4 py-3">
                                <input type="checkbox" checked={!!sellSelected[h.zerodha_user_id]}
                                  onChange={e => setSellSelected(s => ({ ...s, [h.zerodha_user_id]: e.target.checked }))}
                                  className="w-3 h-3 bg-surface-container-lowest border-outline-variant rounded-sm text-tertiary focus:ring-0" />
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-col">
                                  <span className="text-primary font-bold">{h.zerodha_user_id}</span>
                                  {h.name && <span className="text-[9px] text-on-surface-variant uppercase tracking-tighter">{h.name}</span>}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right text-on-surface">{h.quantity.toLocaleString('en-IN')}</td>
                              <td className="px-4 py-3 text-right text-on-surface-variant">
                                {h.average_price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="px-4 py-3 text-right text-on-surface-variant">{inrFmt(invested)}</td>
                              <td className="px-4 py-3 text-right text-on-surface">
                                {ltp != null ? inrFmt(currVal) : <span className="text-on-surface-variant">—</span>}
                              </td>
                              <td className={`px-4 py-3 text-right ${pnl >= 0 ? 'text-secondary' : 'text-tertiary'}`}>
                                {ltp != null ? `${pnl >= 0 ? '+' : ''}${inrFmt(pnl)}` : <span className="text-on-surface-variant">—</span>}
                              </td>
                              <td className={`px-4 py-3 text-right ${pnlPct >= 0 ? 'text-secondary' : 'text-tertiary'}`}>
                                {ltp != null ? `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%` : <span className="text-on-surface-variant">—</span>}
                              </td>
                              <td className="px-2 py-3 text-right">
                                <input type="text" inputMode="numeric"
                                  value={sellQtyInputValue(h)}
                                  onChange={e => setSellQtyOverrides(o => ({ ...o, [h.zerodha_user_id]: e.target.value.replace(/[^0-9]/g, '') }))}
                                  className="bg-surface-container-lowest border border-outline-variant/50 w-16 px-2 py-1 text-right text-xs text-on-surface font-bold focus:border-primary focus:outline-none" />
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
                                    onClick={() => setSellConfirmModal(h)}
                                    disabled={!selectedSecurity || sellQty <= 0 || (sellOrderType === 'LIMIT' && !sellLimitPrice.trim())}
                                    className="bg-red-500 hover:bg-red-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-label-caps text-[9px] px-3 py-1 uppercase transition-colors">
                                    Sell
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Sell Multiple footer */}
                  {sellHoldings.length > 0 && (
                    <div className="px-4 py-3 border-t border-outline-variant flex justify-end">
                      <button
                        onClick={() => setShowSellMultipleConfirm(true)}
                        disabled={bulkSelling || !selectedSecurity || selectedSellCount === 0 || (sellOrderType === 'LIMIT' && !sellLimitPrice.trim())}
                        className="bg-red-500 hover:bg-red-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-label-caps text-xs px-6 py-2 uppercase font-bold transition-colors flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">sell</span>
                        {bulkSelling ? 'Placing…' : `Sell Multiple (${selectedSellCount})`}
                      </button>
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>

          {/* RIGHT PANEL — Orders */}
          <div className="col-span-12 lg:col-span-4 space-y-4">

            {/* Open Orders */}
            <section className="bg-surface-container border border-outline-variant">
              <div className="bg-surface-container-high px-4 py-2.5 border-b border-outline-variant flex items-center justify-between">
                <h2 className="font-label-caps text-[11px] text-on-surface uppercase font-bold">
                  Open Orders {openOrders.length > 0 && <span className="text-primary">({openOrders.length})</span>}
                </h2>
                {loadingOrders && <span className="material-symbols-outlined text-on-surface-variant animate-spin" style={{ fontSize: '14px' }}>progress_activity</span>}
              </div>
              {!selectedOrdersUserId ? (
                <div className="p-6 text-center text-xs text-on-surface-variant font-label-caps">Select a user to view orders</div>
              ) : loadingOrders && openOrders.length === 0 ? (
                <div className="p-6 text-center text-xs text-on-surface-variant font-label-caps">Loading…</div>
              ) : openOrders.length === 0 ? (
                <div className="p-6 text-center text-xs text-on-surface-variant font-label-caps">No open orders</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-outline-variant bg-surface-container-low font-label-caps text-[9px] text-on-surface-variant uppercase">
                        <th className="px-3 py-2">Time</th>
                        <th className="px-3 py-2">Instrument</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                        <th className="px-3 py-2 text-right">Price</th>
                        <th className="px-3 py-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="font-data-mono text-[11px] divide-y divide-outline-variant/10">
                      {openOrders.map(o => (
                        <tr key={o.order_id} className="group hover:bg-surface-container-high transition-colors">
                          <td className="px-3 py-2 text-on-surface-variant whitespace-nowrap">{orderTime(o)}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              <div className="flex flex-col gap-0">
                                <span className="text-on-surface font-bold text-[11px] leading-tight">{o.tradingsymbol}</span>
                                <span className="text-on-surface-variant text-[9px]">{o.product} · {o.exchange}</span>
                              </div>
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 ml-1">
                                <button onClick={() => setModifyModal(o)} title="Modify order"
                                  className="p-0.5 bg-primary/20 text-primary hover:bg-primary/30 transition-colors">
                                  <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>edit</span>
                                </button>
                                <button onClick={() => setCancelModal(o)} title="Cancel order"
                                  className="p-0.5 bg-tertiary/20 text-tertiary hover:bg-tertiary/30 transition-colors">
                                  <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>delete</span>
                                </button>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`font-label-caps text-[8px] font-bold px-1.5 py-0.5 ${o.transaction_type === 'BUY' ? 'bg-secondary/20 text-secondary' : 'bg-tertiary/20 text-tertiary'}`}>
                              {o.transaction_type}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-on-surface">
                            {o.filled_quantity}/{o.quantity}
                          </td>
                          <td className="px-3 py-2 text-right text-on-surface">
                            {o.price > 0 ? `₹${inrDec(o.price)}` : 'MKT'}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className={`font-label-caps text-[8px] px-1.5 py-0.5 ${statusBadgeCls(o.status)}`}>
                              {o.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Executed Orders */}
            <section className="bg-surface-container border border-outline-variant">
              <div className="bg-surface-container-high px-4 py-2.5 border-b border-outline-variant flex items-center justify-between">
                <h2 className="font-label-caps text-[11px] text-on-surface uppercase font-bold">
                  Executed Orders {executedOrders.length > 0 && <span className="text-on-surface-variant">({executedOrders.length})</span>}
                </h2>
              </div>
              {!selectedOrdersUserId ? (
                <div className="p-6 text-center text-xs text-on-surface-variant font-label-caps">Select a user to view orders</div>
              ) : loadingOrders && executedOrders.length === 0 ? (
                <div className="p-6 text-center text-xs text-on-surface-variant font-label-caps">Loading…</div>
              ) : executedOrders.length === 0 ? (
                <div className="p-6 text-center text-xs text-on-surface-variant font-label-caps">No executed orders</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-outline-variant bg-surface-container-low font-label-caps text-[9px] text-on-surface-variant uppercase">
                        <th className="px-3 py-2">Time</th>
                        <th className="px-3 py-2">Instrument</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                        <th className="px-3 py-2 text-right">Avg</th>
                        <th className="px-3 py-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="font-data-mono text-[11px] divide-y divide-outline-variant/10">
                      {executedOrders.map(o => (
                        <tr key={o.order_id} className="hover:bg-surface-container-high transition-colors">
                          <td className="px-3 py-2 text-on-surface-variant whitespace-nowrap">{orderTime(o)}</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-col gap-0">
                              <span className="text-on-surface font-bold text-[11px] leading-tight">{o.tradingsymbol}</span>
                              <span className="text-on-surface-variant text-[9px]">{o.product} · {o.exchange}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`font-label-caps text-[8px] font-bold px-1.5 py-0.5 ${o.transaction_type === 'BUY' ? 'bg-secondary/20 text-secondary' : 'bg-tertiary/20 text-tertiary'}`}>
                              {o.transaction_type}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-on-surface">
                            {o.filled_quantity}/{o.quantity}
                          </td>
                          <td className="px-3 py-2 text-right text-on-surface">
                            {o.average_price > 0 ? `₹${inrDec(o.average_price)}` : '—'}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className={`font-label-caps text-[8px] px-1.5 py-0.5 ${statusBadgeCls(o.status)}`}>
                              {o.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Positions */}
            <section className="bg-surface-container border border-outline-variant">
              <div className="bg-surface-container-high px-4 py-2.5 border-b border-outline-variant flex items-center justify-between">
                <h2 className="font-label-caps text-[11px] text-on-surface uppercase font-bold">
                  Positions {positions.length > 0 && <span className="text-on-surface-variant">({positions.length})</span>}
                </h2>
                <div className="flex items-center gap-2">
                  {loadingPositions && <span className="material-symbols-outlined text-on-surface-variant animate-spin" style={{ fontSize: '14px' }}>progress_activity</span>}
                  {selectedOrdersUserId && (
                    <button onClick={() => fetchPositions(selectedOrdersUserId)} title="Refresh positions"
                      className="text-on-surface-variant hover:text-on-surface transition-colors">
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>refresh</span>
                    </button>
                  )}
                </div>
              </div>
              {!selectedOrdersUserId ? (
                <div className="p-6 text-center text-xs text-on-surface-variant font-label-caps">Select a user to view positions</div>
              ) : loadingPositions && positions.length === 0 ? (
                <div className="p-6 text-center text-xs text-on-surface-variant font-label-caps">Loading…</div>
              ) : positions.length === 0 ? (
                <div className="p-6 text-center text-xs text-on-surface-variant font-label-caps">No positions</div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-outline-variant bg-surface-container-low font-label-caps text-[9px] text-on-surface-variant uppercase">
                          <th className="px-3 py-2">Instrument</th>
                          <th className="px-3 py-2">Prod</th>
                          <th className="px-3 py-2 text-right">Qty</th>
                          <th className="px-3 py-2 text-right">Avg</th>
                          <th className="px-3 py-2 text-right">LTP</th>
                          <th className="px-3 py-2 text-right">P&amp;L</th>
                        </tr>
                      </thead>
                      <tbody className="font-data-mono text-[11px] divide-y divide-outline-variant/10">
                        {positions.map((p, i) => {
                          const pnlPos = p.pnl >= 0;
                          return (
                            <tr key={i} className="hover:bg-surface-container-high transition-colors group/posrow">
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-1">
                                  <div className="flex flex-col gap-0">
                                    <span className="text-on-surface font-bold text-[11px] leading-tight">{p.tradingsymbol}</span>
                                    <span className="text-on-surface-variant text-[9px]">{p.exchange}</span>
                                  </div>
                                  <div className="opacity-0 group-hover/posrow:opacity-100 transition-opacity flex gap-0.5 ml-1 shrink-0">
                                    {p.quantity > 0 && (
                                      <button type="button"
                                        onClick={e => { e.stopPropagation(); setPositionModal({ type: 'add', position: p }); }}
                                        className="inline-flex items-center justify-center w-5 h-5 bg-secondary/15 text-secondary border border-secondary/30 rounded-sm hover:bg-secondary/30 transition-colors"
                                        title="Add to Trade Journal">
                                        <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>add_circle</span>
                                      </button>
                                    )}
                                    {p.quantity < 0 && (
                                      <button type="button"
                                        onClick={e => { e.stopPropagation(); setPositionModal({ type: 'close', position: p }); }}
                                        className="inline-flex items-center justify-center w-5 h-5 bg-tertiary/15 text-tertiary border border-tertiary/30 rounded-sm hover:bg-tertiary/30 transition-colors"
                                        title="Close in Trade Journal">
                                        <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>price_change</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <span className="font-label-caps text-[8px] font-bold px-1.5 py-0.5 bg-surface-container-high border border-outline-variant text-on-surface-variant">
                                  {p.product}
                                </span>
                              </td>
                              <td className={`px-3 py-2 text-right font-bold ${p.quantity < 0 ? 'text-tertiary' : p.quantity > 0 ? 'text-secondary' : 'text-on-surface-variant'}`}>
                                {p.quantity}
                              </td>
                              <td className="px-3 py-2 text-right text-on-surface">
                                {inrDec(p.average_price)}
                              </td>
                              <td className="px-3 py-2 text-right text-on-surface">
                                {inrDec(p.last_price)}
                              </td>
                              <td className={`px-3 py-2 text-right font-bold ${pnlPos ? 'text-secondary' : 'text-tertiary'}`}>
                                {pnlPos ? '+' : ''}{inrDec(p.pnl)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {/* Total P&L */}
                  {(() => {
                    const total = positions.reduce((s, p) => s + p.pnl, 0);
                    const pos = total >= 0;
                    return (
                      <div className="px-4 py-2.5 border-t border-outline-variant flex items-center justify-between bg-surface-container-high">
                        <span className="font-label-caps text-[10px] text-on-surface-variant uppercase">Total P&amp;L</span>
                        <span className={`font-data-mono text-sm font-bold ${pos ? 'text-secondary' : 'text-tertiary'}`}>
                          {pos ? '+' : ''}₹{inrDec(total)}
                        </span>
                      </div>
                    );
                  })()}
                </>
              )}
            </section>
          </div>
        </div>

        {/* Status Footer */}
        <footer className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-auto">
          {[
            { icon: 'cloud_done', color: 'secondary', label: 'OMS Connectivity', value: 'Operational (12ms)' },
            { icon: 'history',    color: 'primary',   label: 'Last Settlement',  value: '04:00 UTC' },
            { icon: 'hub',        color: 'outline',   label: 'Exchange Status',  value: `${selectedSecurity?.exchange ?? 'NSE'} — OPEN` },
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

      {sellConfirmModal && selectedSecurity && (
        <BulkSellModal
          holding={sellConfirmModal}
          security={selectedSecurity}
          initialQty={computeSellQty(sellConfirmModal)}
          initialLimitPrice={sellLimitPrice}
          initialOrderType={sellOrderType}
          ltp={ltp}
          onClose={() => setSellConfirmModal(null)}
          onPlaced={(ok, msg) => {
            setSellOrderStatus(s => ({ ...s, [sellConfirmModal.zerodha_user_id]: ok ? 'success' : 'error' }));
            setSellOrderMessage(m => ({ ...m, [sellConfirmModal.zerodha_user_id]: msg }));
          }}
        />
      )}

      {buyConfirmModal && selectedSecurity && (
        <BulkBuyModal
          user={buyConfirmModal}
          security={selectedSecurity}
          initialQty={effectiveQty(buyConfirmModal)}
          initialPrice={entryPrice}
          initialOrderType={order_type}
          ltp={ltp}
          margin={margins[buyConfirmModal.zerodha_user_id]}
          onClose={() => setBuyConfirmModal(null)}
          onPlaced={(ok, msg) => {
            setOrderStatus(s => ({ ...s, [buyConfirmModal.zerodha_user_id]: ok ? 'success' : 'error' }));
            setOrderMessage(m => ({ ...m, [buyConfirmModal.zerodha_user_id]: msg }));
          }}
        />
      )}

      {showBuyMultipleConfirm && selectedSecurity && (
        <BulkMultipleConfirmModal
          side="buy"
          rows={buyUsers
            .filter(u => buySelected[u.zerodha_user_id] && effectiveQty(u) > 0)
            .map(u => ({
              zerodha_user_id: u.zerodha_user_id,
              name: u.name,
              qty: effectiveQty(u),
              value: effectiveQty(u) * (isFinite(entryNum) && entryNum > 0 ? entryNum : 0),
            }))}
          security={selectedSecurity}
          orderType={order_type}
          priceLabel={entryPrice}
          onConfirm={placeBulkOrders}
          onClose={() => setShowBuyMultipleConfirm(false)}
        />
      )}

      {showSellMultipleConfirm && selectedSecurity && (
        <BulkMultipleConfirmModal
          side="sell"
          rows={sellHoldings
            .filter(h => sellSelected[h.zerodha_user_id] && computeSellQty(h) > 0)
            .map(h => {
              const qty = computeSellQty(h);
              const ep  = sellOrderType === 'LIMIT' ? (parseFloat(sellLimitPrice) || 0) : (ltp ?? 0);
              return {
                zerodha_user_id: h.zerodha_user_id,
                name: h.name,
                qty,
                value: qty * ep * (1 - 0.00119063431),
              };
            })}
          security={selectedSecurity}
          orderType={sellOrderType}
          priceLabel={sellLimitPrice}
          onConfirm={placeBulkSellOrders}
          onClose={() => setShowSellMultipleConfirm(false)}
        />
      )}

      {positionModal?.type === 'add' && selectedOrdersUserId && (
        <PositionAddEntryModal
          account={selectedOrdersUserId}
          position={positionModal.position}
          onClose={() => setPositionModal(null)}
          onSaved={() => setPositionModal(null)}
        />
      )}
      {positionModal?.type === 'close' && selectedOrdersUserId && (
        <PositionCloseModal
          account={selectedOrdersUserId}
          position={positionModal.position}
          onClose={() => setPositionModal(null)}
          onSaved={() => setPositionModal(null)}
        />
      )}

      {modifyModal && selectedOrdersUserId && (
        <OrderModifyModal
          order={modifyModal}
          zerodha_user_id={selectedOrdersUserId}
          onClose={() => setModifyModal(null)}
          onModified={() => { setModifyModal(null); fetchOrders(selectedOrdersUserId); }}
        />
      )}

      {cancelModal && selectedOrdersUserId && (
        <OrderCancelModal
          order={cancelModal}
          zerodha_user_id={selectedOrdersUserId}
          onClose={() => setCancelModal(null)}
          onCancelled={() => { setCancelModal(null); fetchOrders(selectedOrdersUserId); }}
        />
      )}
    </div>
  );
}
