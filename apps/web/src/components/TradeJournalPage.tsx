import { useState, useEffect, useMemo, useRef } from 'react';
import AppSelect from './AppSelect';
import SecurityDropdown from './SecurityDropdown';
import type { SecurityOption } from './SecurityDropdown';
import EquityCurve from './EquityCurve';
import type { EquityTrade } from './EquityCurve';
import StockPnL from './StockPnL';
import WinRateChart from './WinRateChart';
import ReturnDistribution from './ReturnDistribution';
import DrawdownChart from './DrawdownChart';
import PositionSizeBubble from './PositionSizeBubble';
import ReturnsHeatmap from './ReturnsHeatmap';
import HoldingPeriodChart from './HoldingPeriodChart';
import MonthlyPnL from './MonthlyPnL';
import EntryMonthAnalysis from './EntryMonthAnalysis';
import TradeOverlapTimeline from './TradeOverlapTimeline';
import OpenPositionsPanel from './OpenPositionsPanel';
import type { OpenPosition } from './OpenPositionsPanel';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TradeRecord {
  id: number;
  method: string;
  account: string;
  instrument: string;
  qty: number;
  buy_price: number;
  sell_price: number | null;
  stop_loss: number | null;
  buy_date: string | null;
  sell_date: string | null;
}

interface DisplayRow {
  id: number;
  method: string;
  account: string;
  instrument: string;
  qty: number;
  buy_price: number;
  sell_price: number | null;
  stop_loss: number | null;
  buy_date: string | null;
  sell_date: string | null;
  status: 'Open' | 'Closed' | 'Mixed';
  ltp: number | null;
  day_change: number | null;
  invested: number;
  curr_value: number;
  pnl: number;
  pnl_pct: number;
  cagr_pct: number | null;
  stop_loss_pct: number | null;
  hold_days: number;
  target_pct: number | null;
  remaining_profit_pct: number | null;
  fy: string;
  weight_pct: number;
}

interface JournalUser {
  zerodha_user_id: string;
  name: string | null;
}

interface JournalHolding extends JournalUser {
  holdQty: number;
  avgPrice: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeHoldDays(buyDate: string | null, sellDate: string | null): number {
  if (!buyDate) return 0;
  const buy = new Date(buyDate);
  const sell = sellDate ? new Date(sellDate) : new Date();
  return Math.max(0, Math.floor((sell.getTime() - buy.getTime()) / 86400000));
}

function computeFY(buyDate: string | null): string {
  if (!buyDate) return '';
  const d = new Date(buyDate);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  if (m >= 4) return `FY${String(y).slice(2)}-${String(y + 1).slice(2)}`;
  return `FY${String(y - 1).slice(2)}-${String(y).slice(2)}`;
}

const fyersKey = (instrument: string) =>
  instrument.endsWith('-BE') ? `NSE:${instrument}` : `NSE:${instrument}-EQ`;

function fmtAmt(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e7) return `${sign}${(abs / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `${sign}${(abs / 1e5).toFixed(2)}L`;
  return (n < 0 ? '-' : '') + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(abs);
}

function fmtPct(n: number | null): string {
  if (n == null) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function fmtPrice(n: number | null): string {
  if (n == null) return '—';
  return n.toFixed(2);
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  const parts = d.split('-');
  if (parts.length !== 3) return d;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parts[2]}-${months[parseInt(parts[1], 10) - 1]}-${parts[0].slice(2)}`;
}

function fmtDays(n: number): string {
  if (n < 1) return '0d';
  if (n >= 365) return `${(n / 365).toFixed(1)}y`;
  return `${Math.round(n)}d`;
}

function clsPnl(v: number): string {
  if (v > 0) return 'text-secondary';
  if (v < 0) return 'text-error';
  return 'text-on-surface-variant';
}

// ─── Column definitions ───────────────────────────────────────────────────────

const COLS: { key: string; label: string; w: number; right?: boolean }[] = [
  { key: 'method',              label: 'Method',    w: 68  },
  { key: 'account',             label: 'Acc',       w: 68  },
  { key: 'instrument',          label: 'Instrument',w: 96  },
  { key: 'day_change',          label: 'Day Chg%',  w: 72, right: true },
  { key: 'invested',            label: 'Invested',  w: 82, right: true },
  { key: 'curr_value',          label: 'Curr Val',  w: 82, right: true },
  { key: 'pnl',                 label: 'P&L',       w: 82, right: true },
  { key: 'pnl_pct',             label: 'P&L%',      w: 64, right: true },
  { key: 'cagr_pct',            label: 'CAGR%',     w: 64, right: true },
  { key: 'stop_loss_pct',       label: 'SL%',       w: 56, right: true },
  { key: 'qty',                 label: 'Qty',       w: 64, right: true },
  { key: 'buy_price',           label: 'Avg Cost',  w: 74, right: true },
  { key: 'ltp',                 label: 'LTP',       w: 72, right: true },
  { key: 'sell_price',          label: 'Sell/Tgt',  w: 74, right: true },
  { key: 'stop_loss',           label: 'Stop Loss', w: 74, right: true },
  { key: 'hold_days',           label: 'Hold',      w: 56, right: true },
  { key: 'target_pct',          label: 'Tgt%',      w: 60, right: true },
  { key: 'remaining_profit_pct',label: 'Rem%',      w: 60, right: true },
  { key: 'buy_date',            label: 'Buy Date',  w: 78  },
  { key: 'sell_date',           label: 'Sell Date', w: 78  },
  { key: 'status',              label: 'Status',    w: 58  },
  { key: 'fy',                  label: 'FY',        w: 62  },
  { key: 'weight_pct',          label: 'Wt%',       w: 52, right: true },
];

const PCT_OPTIONS = ['25%', '33%', '50%', '75%', '100%'];
const inrDec = (v: number) => v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const roundTo10p = (v: number) => (Math.round(v * 10) / 10).toFixed(2);

// ─── Multi-select dropdown ────────────────────────────────────────────────────

function MultiSelect({ label, options, selected, onToggle, labelMap }: {
  label: string;
  options: string[];
  selected: Set<string>;
  onToggle: (v: string) => void;
  labelMap?: Record<string, string>;
}) {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState('');
  const ref       = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch(''); }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open && labelMap) setTimeout(() => searchRef.current?.focus(), 50);
    else setSearch('');
  }, [open]);

  const count    = selected.size;
  const q        = search.toLowerCase();
  const filtered = q
    ? options.filter(opt => (labelMap?.[opt] ?? opt).toLowerCase().includes(q) || opt.toLowerCase().includes(q))
    : options;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border rounded-sm transition-colors ${
          count > 0
            ? 'bg-primary/15 border-primary/40 text-primary'
            : 'bg-surface-container border-outline-variant text-on-surface-variant hover:border-primary/40'
        }`}
      >
        {label}{count > 0 ? ` (${count})` : ''}
        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
          {open ? 'expand_less' : 'expand_more'}
        </span>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-30 bg-surface-container border border-outline-variant rounded-sm shadow-lg min-w-[200px] max-h-72 flex flex-col overflow-hidden">
          {labelMap && (
            <div className="flex items-center gap-2 px-3 py-2 border-b border-outline-variant bg-surface-container shrink-0">
              <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: '14px' }}>search</span>
              <input ref={searchRef} type="text" value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                className="flex-1 bg-transparent text-xs text-on-surface placeholder:text-on-surface-variant/50 outline-none" />
              {search && (
                <button onClick={() => setSearch('')}>
                  <span className="material-symbols-outlined text-on-surface-variant hover:text-on-surface" style={{ fontSize: '13px' }}>close</span>
                </button>
              )}
            </div>
          )}
          <div className="overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-xs text-on-surface-variant text-center">No match</div>
            ) : filtered.map(opt => (
              <label key={opt} className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface-container-high cursor-pointer text-xs text-on-surface">
                <input type="checkbox" checked={selected.has(opt)} onChange={() => onToggle(opt)} className="accent-primary w-3 h-3 shrink-0" />
                <span className="truncate">{labelMap?.[opt] ?? opt}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Summary card ────────────────────────────────────────────────────────────

function SummaryCard({ title, count, invested, currValue, pnl, pnlPct }: {
  title: string; count: number; invested: number; currValue: number; pnl: number; pnlPct: number;
}) {
  const isPnlPos = pnl >= 0;
  return (
    <div className="bg-surface-container border border-outline-variant rounded-sm px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{title}</span>
        <span className="text-xs text-on-surface-variant">{count} trades</span>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <div>
          <p className="text-xs text-on-surface-variant mb-0.5">Invested</p>
          <p className="text-sm font-bold text-on-surface font-mono">₹{fmtAmt(invested)}</p>
        </div>
        <div>
          <p className="text-xs text-on-surface-variant mb-0.5">Curr Value</p>
          <p className="text-sm font-bold text-on-surface font-mono">₹{fmtAmt(currValue)}</p>
        </div>
        <div>
          <p className="text-xs text-on-surface-variant mb-0.5">P&amp;L</p>
          <p className={`text-sm font-bold font-mono ${isPnlPos ? 'text-secondary' : 'text-error'}`}>
            {isPnlPos ? '+' : ''}₹{fmtAmt(pnl)}
          </p>
        </div>
        <div>
          <p className="text-xs text-on-surface-variant mb-0.5">P&amp;L%</p>
          <p className={`text-sm font-bold font-mono ${isPnlPos ? 'text-secondary' : 'text-error'}`}>
            {fmtPct(pnlPct)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── EditTradeModal ───────────────────────────────────────────────────────────

interface EditTradeModalProps {
  row: DisplayRow;
  allMethods: string[];
  allAccounts: string[];
  onClose: () => void;
  onSaved: () => void;
}

function EditTradeModal({ row, allMethods, allAccounts, onClose, onSaved }: EditTradeModalProps) {
  const [instrument, setInstrument] = useState(row.instrument);
  const [method,     setMethod]     = useState(row.method);
  const [account,    setAccount]    = useState(row.account);
  const [qty,        setQty]        = useState(String(row.qty));
  const [buyPrice,   setBuyPrice]   = useState(String(row.buy_price));
  const [sellPrice,  setSellPrice]  = useState(row.sell_price  != null ? String(row.sell_price)  : '');
  const [stopLoss,   setStopLoss]   = useState(row.stop_loss   != null ? String(row.stop_loss)   : '');
  const [buyDate,    setBuyDate]    = useState(row.buy_date  ?? '');
  const [sellDate,   setSellDate]   = useState(row.sell_date ?? '');
  const [step,       setStep]       = useState<'form' | 'confirm' | 'done'>('form');
  const [saving,     setSaving]     = useState(false);
  const [saveError,  setSaveError]  = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setTimeout(() => modalRef.current?.focus(), 50); }, []);
  useEffect(() => {
    if (step === 'confirm' || step === 'done') setTimeout(() => modalRef.current?.focus(), 50);
  }, [step]);

  const qtyNum      = parseFloat(qty);
  const buyPriceNum = parseFloat(buyPrice);
  const canSubmit   = !isNaN(qtyNum) && qtyNum > 0 && !isNaN(buyPriceNum) && buyPriceNum > 0 && method && account;

  // Diff for the confirm step
  const changes: { label: string; oldVal: string; newVal: string }[] = [];
  const pushIfChanged = (label: string, oldVal: string, newVal: string) => {
    if (oldVal !== newVal) changes.push({ label, oldVal: oldVal || '—', newVal: newVal || '—' });
  };
  pushIfChanged('Instrument',        row.instrument,                                      instrument.trim().toUpperCase());
  pushIfChanged('Method',            row.method,                                          method);
  pushIfChanged('Account',           row.account,                                         account);
  pushIfChanged('Qty',               String(row.qty),                                     qty);
  pushIfChanged('Avg Cost',          String(row.buy_price),                               buyPrice);
  pushIfChanged('Sell / Target',     row.sell_price  != null ? String(row.sell_price)  : '', sellPrice);
  pushIfChanged('Stop Loss',         row.stop_loss   != null ? String(row.stop_loss)   : '', stopLoss);
  pushIfChanged('Buy Date',          row.buy_date  ?? '',                                 buyDate);
  pushIfChanged('Sell Date',         row.sell_date ?? '',                                 sellDate);

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/trade-journal/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instrument: instrument.trim().toUpperCase(),
          method,
          account,
          qty:        qtyNum,
          buy_price:  buyPriceNum,
          sell_price: sellPrice  ? parseFloat(sellPrice)  : null,
          stop_loss:  stopLoss   ? parseFloat(stopLoss)   : null,
          buy_date:   buyDate    || null,
          sell_date:  sellDate   || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json() as any;
        setSaveError(data?.error || 'Update failed');
        setStep('form');
      } else {
        setStep('done');
        onSaved();
      }
    } catch {
      setSaveError('Network error');
      setStep('form');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-3 py-1.5 text-xs focus:outline-none focus:border-primary';
  const labelCls = 'font-label-caps text-[10px] text-on-surface-variant uppercase block mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onMouseDown={onClose}>
      <div
        ref={modalRef}
        className="w-[500px] max-h-[90vh] flex flex-col bg-surface-container border border-primary/30 shadow-2xl outline-none"
        onMouseDown={e => e.stopPropagation()}
        tabIndex={-1}
        onKeyDown={e => {
          if (e.key === 'Escape') { onClose(); return; }
          if (e.key === 'Enter') {
            if (step === 'done')                         { onClose(); return; }
            if (step === 'form' && canSubmit)            { setStep('confirm'); return; }
            if (step === 'confirm' && !saving)           { save(); return; }
          }
        }}
      >
        {/* Header */}
        <div className="bg-primary/10 border-b border-primary/20 px-5 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-primary">edit</span>
            <span className="font-bold text-sm uppercase tracking-widest text-primary">
              Edit — {row.instrument}
            </span>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {step === 'done' ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-secondary/10 text-secondary">
                <span className="material-symbols-outlined text-base">check_circle</span>
                <span className="text-sm font-data-mono">Trade updated successfully</span>
              </div>
              <button onClick={onClose} className="w-full py-2 bg-surface-container-high text-on-surface font-label-caps text-xs uppercase hover:brightness-110 transition-all">
                Close
              </button>
            </div>

          ) : step === 'confirm' ? (
            <div className="space-y-3">
              <p className="text-xs text-on-surface-variant font-label-caps uppercase">
                {changes.length === 0 ? 'No changes detected' : `${changes.length} field${changes.length > 1 ? 's' : ''} changed`}
              </p>

              {changes.length > 0 && (
                <div className="bg-surface-container-high border border-outline-variant text-xs font-data-mono divide-y divide-outline-variant/30">
                  {changes.map(c => (
                    <div key={c.label} className="px-4 py-2.5 grid grid-cols-3 items-center gap-2">
                      <span className="text-on-surface-variant text-[10px] uppercase font-label-caps">{c.label}</span>
                      <span className="text-tertiary line-through text-right">{c.oldVal}</span>
                      <span className="text-secondary font-bold text-right">→ {c.newVal}</span>
                    </div>
                  ))}
                </div>
              )}

              {saveError && (
                <div className="flex items-center gap-2 p-2 bg-tertiary/10 text-tertiary text-xs">
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>error</span>
                  {saveError}
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setStep('form')} disabled={saving}
                  className="flex-1 py-2 bg-surface-container-high text-on-surface font-label-caps text-xs uppercase hover:brightness-110 transition-all">
                  Back
                </button>
                <button onClick={save} disabled={saving || changes.length === 0}
                  className="flex-1 py-2 font-label-caps text-xs uppercase font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-primary/20 border border-primary/50 text-primary hover:bg-primary/30">
                  {saving ? 'Saving…' : 'Confirm Update'}
                </button>
              </div>
            </div>

          ) : (
            <>
              {saveError && (
                <div className="flex items-center gap-2 p-2 bg-tertiary/10 text-tertiary text-xs">
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>error</span>
                  {saveError}
                </div>
              )}

              <div>
                <label className={labelCls}>Instrument</label>
                <input type="text" value={instrument}
                  onChange={e => setInstrument(e.target.value.toUpperCase())}
                  className={inputCls} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Method</label>
                  <AppSelect value={method} onChange={setMethod} options={allMethods} listMaxHeight="max-h-36" />
                </div>
                <div>
                  <label className={labelCls}>Account</label>
                  <AppSelect value={account} onChange={setAccount} options={allAccounts} searchable listMaxHeight="max-h-36" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Qty</label>
                  <input type="text" inputMode="decimal" value={qty}
                    onChange={e => setQty(e.target.value.replace(/[^0-9.]/g, ''))}
                    className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Avg Cost</label>
                  <input type="text" inputMode="decimal" value={buyPrice}
                    onChange={e => setBuyPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                    className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Sell / Target Price</label>
                  <input type="text" inputMode="decimal" value={sellPrice}
                    onChange={e => setSellPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="—" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Stop Loss</label>
                  <input type="text" inputMode="decimal" value={stopLoss}
                    onChange={e => setStopLoss(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="—" className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Buy Date</label>
                  <input type="date" value={buyDate} onChange={e => setBuyDate(e.target.value)}
                    className={`${inputCls} [color-scheme:dark]`} />
                </div>
                <div>
                  <label className={labelCls}>Sell Date</label>
                  <input type="date" value={sellDate} onChange={e => setSellDate(e.target.value)}
                    className={`${inputCls} [color-scheme:dark]`} />
                </div>
              </div>

              <button onClick={() => canSubmit && setStep('confirm')} disabled={!canSubmit}
                className="w-full py-2 font-label-caps text-xs uppercase font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-primary/20 border border-primary/50 text-primary hover:bg-primary/30">
                Review Changes
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── DeleteTradeConfirm ───────────────────────────────────────────────────────

function DeleteTradeConfirm({ row, onClose, onDeleted }: {
  row: DisplayRow;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setTimeout(() => modalRef.current?.focus(), 50); }, []);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/trade-journal/${row.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json() as any;
        setError(data?.error || 'Delete failed');
      } else {
        onDeleted();
      }
    } catch {
      setError('Network error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onMouseDown={onClose}>
      <div
        ref={modalRef}
        className="w-[400px] flex flex-col bg-surface-container border border-error/30 shadow-2xl outline-none"
        onMouseDown={e => e.stopPropagation()}
        tabIndex={-1}
        onKeyDown={e => {
          if (e.key === 'Escape') { onClose(); return; }
          if (e.key === 'Enter' && !deleting) { handleDelete(); return; }
        }}
      >
        <div className="bg-error/10 border-b border-error/20 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-error">delete</span>
            <span className="font-bold text-sm uppercase tracking-widest text-error">Delete Trade</span>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-on-surface">
            Are you sure you want to delete this trade entry? This action cannot be undone.
          </p>
          <div className="bg-surface-container-high border border-outline-variant text-xs font-data-mono divide-y divide-outline-variant/30">
            {[
              ['Instrument', row.instrument],
              ['Method',     row.method],
              ['Account',    row.account],
              ['Qty',        String(row.qty)],
              ['Avg Cost',   String(row.buy_price)],
              ['Buy Date',   row.buy_date ?? '—'],
            ].map(([label, val]) => (
              <div key={label} className="px-4 py-2 grid grid-cols-2 gap-2">
                <span className="text-on-surface-variant text-[10px] uppercase font-label-caps">{label}</span>
                <span className="text-on-surface text-right">{val}</span>
              </div>
            ))}
          </div>

          {error && (
            <div className="flex items-center gap-2 p-2 bg-error/10 text-error text-xs">
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>error</span>
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={onClose} disabled={deleting}
              className="flex-1 py-2 bg-surface-container-high text-on-surface font-label-caps text-xs uppercase hover:brightness-110 transition-all">
              Cancel
            </button>
            <button onClick={handleDelete} disabled={deleting}
              className="flex-1 py-2 font-label-caps text-xs uppercase font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-error/20 border border-error/50 text-error hover:bg-error/30">
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AddTradeModal ────────────────────────────────────────────────────────────

interface AddTradeModalProps {
  allMethods: string[];
  allAccounts: string[];
  onClose: () => void;
  onSaved: () => void;
}

function AddTradeModal({ allMethods, allAccounts, onClose, onSaved }: AddTradeModalProps) {
  const [security,   setSecurity]   = useState<SecurityOption | null>(null);
  const [method,     setMethod]     = useState('');
  const [account,    setAccount]    = useState('');
  const [qty,        setQty]        = useState('');
  const [buyPrice,   setBuyPrice]   = useState('');
  const [sellPrice,  setSellPrice]  = useState('');
  const [stopLoss,   setStopLoss]   = useState('');
  const [buyDate,    setBuyDate]    = useState('');
  const [sellDate,   setSellDate]   = useState('');
  const [step,       setStep]       = useState<'form' | 'confirm' | 'done'>('form');
  const [saving,     setSaving]     = useState(false);
  const [saveError,  setSaveError]  = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setTimeout(() => modalRef.current?.focus(), 50); }, []);
  useEffect(() => {
    if (step === 'confirm' || step === 'done') setTimeout(() => modalRef.current?.focus(), 50);
  }, [step]);

  const qtyNum      = parseFloat(qty);
  const buyPriceNum = parseFloat(buyPrice);
  useEffect(() => {
    const n = parseFloat(buyPrice);
    if (!isNaN(n) && n > 0) setSellPrice((n * 1.4).toFixed(2));
    else setSellPrice('');
  }, [buyPrice]);

  const canSubmit   = security != null && method && account && !isNaN(qtyNum) && qtyNum > 0 && !isNaN(buyPriceNum) && buyPriceNum > 0;

  async function save() {
    if (!security) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/trade-journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instrument: security.symbol,
          method,
          account,
          qty:        qtyNum,
          buy_price:  buyPriceNum,
          sell_price: sellPrice  ? parseFloat(sellPrice)  : null,
          stop_loss:  stopLoss   ? parseFloat(stopLoss)   : null,
          buy_date:   buyDate    || null,
          sell_date:  sellDate   || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json() as any;
        setSaveError(data?.error || 'Create failed');
        setStep('form');
      } else {
        setStep('done');
      }
    } catch {
      setSaveError('Network error');
      setStep('form');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-3 py-1.5 text-xs focus:outline-none focus:border-primary';
  const labelCls = 'font-label-caps text-[10px] text-on-surface-variant uppercase block mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onMouseDown={onClose}>
      <div
        ref={modalRef}
        className="w-[500px] max-h-[90vh] flex flex-col bg-surface-container border border-primary/30 shadow-2xl outline-none"
        onMouseDown={e => e.stopPropagation()}
        tabIndex={-1}
        onKeyDown={e => {
          if (e.key === 'Escape') { onClose(); return; }
          if (e.key === 'Enter') {
            if (step === 'done')                         { onSaved(); return; }
            if (step === 'form' && canSubmit)            { setStep('confirm'); return; }
            if (step === 'confirm' && !saving)           { save(); return; }
          }
        }}
      >
        {/* Header */}
        <div className="bg-primary/10 border-b border-primary/20 px-5 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-primary">add_circle</span>
            <span className="font-bold text-sm uppercase tracking-widest text-primary">Add Trade Entry</span>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {step === 'done' ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-secondary/10 text-secondary">
                <span className="material-symbols-outlined text-base">check_circle</span>
                <span className="text-sm font-data-mono">Trade entry added successfully</span>
              </div>
              <button onClick={onSaved} className="w-full py-2 bg-surface-container-high text-on-surface font-label-caps text-xs uppercase hover:brightness-110 transition-all">
                Close
              </button>
            </div>

          ) : step === 'confirm' ? (
            <div className="space-y-3">
              <p className="text-xs text-on-surface-variant font-label-caps uppercase">Review new entry</p>
              <div className="bg-surface-container-high border border-outline-variant text-xs font-data-mono divide-y divide-outline-variant/30">
                {[
                  ['Instrument', security?.symbol ?? ''],
                  ['Method',     method],
                  ['Account',    account],
                  ['Qty',        qty],
                  ['Avg Cost',   buyPrice],
                  ...(sellPrice ? [['Sell / Target', sellPrice]] : []),
                  ...(stopLoss  ? [['Stop Loss',     stopLoss]]  : []),
                  ...(buyDate   ? [['Buy Date',      buyDate]]   : []),
                  ...(sellDate  ? [['Sell Date',     sellDate]]  : []),
                ].map(([label, val]) => (
                  <div key={label} className="px-4 py-2.5 grid grid-cols-2 items-center gap-2">
                    <span className="text-on-surface-variant text-[10px] uppercase font-label-caps">{label}</span>
                    <span className="text-secondary font-bold text-right">{val}</span>
                  </div>
                ))}
              </div>

              {saveError && (
                <div className="flex items-center gap-2 p-2 bg-tertiary/10 text-tertiary text-xs">
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>error</span>
                  {saveError}
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setStep('form')} disabled={saving}
                  className="flex-1 py-2 bg-surface-container-high text-on-surface font-label-caps text-xs uppercase hover:brightness-110 transition-all">
                  Back
                </button>
                <button onClick={save} disabled={saving}
                  className="flex-1 py-2 font-label-caps text-xs uppercase font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-primary/20 border border-primary/50 text-primary hover:bg-primary/30">
                  {saving ? 'Saving…' : 'Confirm Add'}
                </button>
              </div>
            </div>

          ) : (
            <>
              {saveError && (
                <div className="flex items-center gap-2 p-2 bg-tertiary/10 text-tertiary text-xs">
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>error</span>
                  {saveError}
                </div>
              )}

              <div>
                <label className={labelCls}>Instrument</label>
                <SecurityDropdown
                  value={security}
                  onChange={setSecurity}
                  className="relative w-full"
                  placeholder="Search symbol or company…"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Method</label>
                  <AppSelect value={method} onChange={setMethod} options={allMethods} listMaxHeight="max-h-36" />
                </div>
                <div>
                  <label className={labelCls}>Account</label>
                  <AppSelect value={account} onChange={setAccount} options={allAccounts} searchable listMaxHeight="max-h-36" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Qty</label>
                  <input type="text" inputMode="decimal" value={qty}
                    onChange={e => setQty(e.target.value.replace(/[^0-9.]/g, ''))}
                    className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Avg Cost</label>
                  <input type="text" inputMode="decimal" value={buyPrice}
                    onChange={e => setBuyPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                    className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Sell / Target Price</label>
                  <input type="text" inputMode="decimal" value={sellPrice}
                    onChange={e => setSellPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="—" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Stop Loss</label>
                  <input type="text" inputMode="decimal" value={stopLoss}
                    onChange={e => setStopLoss(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="—" className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Buy Date</label>
                  <input type="date" value={buyDate} onChange={e => setBuyDate(e.target.value)}
                    className={`${inputCls} [color-scheme:dark]`} />
                </div>
                <div>
                  <label className={labelCls}>Sell Date</label>
                  <input type="date" value={sellDate} onChange={e => setSellDate(e.target.value)}
                    className={`${inputCls} [color-scheme:dark]`} />
                </div>
              </div>

              <button onClick={() => canSubmit && setStep('confirm')} disabled={!canSubmit}
                className="w-full py-2 font-label-caps text-xs uppercase font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-primary/20 border border-primary/50 text-primary hover:bg-primary/30">
                Review Entry
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Close Position ───────────────────────────────────────────────────────────

type AllocAction =
  | { type: 'full_close'; tradeId: number; qty: number;                              buyDate: string | null; buyPrice: number }
  | { type: 'split';      tradeId: number; closedQty: number; remainingQty: number;  buyDate: string | null; buyPrice: number }
  | { type: 'unchanged';  tradeId: number; qty: number;                              buyDate: string | null; buyPrice: number };

function computeFIFO(trades: TradeRecord[], sellQty: number): AllocAction[] {
  const sorted = [...trades].sort((a, b) => {
    const da = a.buy_date ?? '9999-99-99';
    const db = b.buy_date ?? '9999-99-99';
    return da !== db ? da.localeCompare(db) : a.id - b.id;
  });
  const actions: AllocAction[] = [];
  let remaining = sellQty;
  for (const t of sorted) {
    if (remaining < 0.0001) {
      actions.push({ type: 'unchanged', tradeId: t.id, qty: t.qty, buyDate: t.buy_date, buyPrice: t.buy_price });
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

function AllocationTable({ allocation }: { allocation: AllocAction[] }) {
  return (
    <div className="border border-outline-variant text-xs divide-y divide-outline-variant/30">
      <div className="grid grid-cols-3 px-3 py-1.5 bg-surface-container-high text-[10px] text-on-surface-variant uppercase font-label-caps">
        <span>Buy Date</span>
        <span className="text-right pr-4">Orig Qty</span>
        <span>Action</span>
      </div>
      {allocation.map((a, i) => {
        const origQty = a.type === 'split' ? a.closedQty + a.remainingQty : a.qty;
        return (
          <div key={i} className={`grid grid-cols-3 px-3 py-2 items-center font-data-mono ${
            a.type === 'full_close' ? 'bg-secondary/5' : a.type === 'split' ? 'bg-primary/5' : ''
          }`}>
            <span className="text-on-surface-variant">{fmtDate(a.buyDate)}</span>
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

interface ClosePositionModalProps {
  allTrades: TradeRecord[];
  activeUsers: Record<string, JournalUser>;
  onClose: () => void;
  onSaved: () => void;
}

function ClosePositionModal({ allTrades, activeUsers, onClose, onSaved }: ClosePositionModalProps) {
  const [account,    setAccount]    = useState('');
  const [instrument, setInstrument] = useState('');
  const [sellQty,    setSellQty]    = useState('');
  const [sellPrice,  setSellPrice]  = useState('');
  const [sellDate,   setSellDate]   = useState(new Date().toISOString().slice(0, 10));
  const [step,       setStep]       = useState<'select' | 'form' | 'confirm' | 'done'>('select');
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setTimeout(() => modalRef.current?.focus(), 50); }, []);
  useEffect(() => {
    if (step !== 'select') setTimeout(() => modalRef.current?.focus(), 50);
  }, [step]);

  // Accounts that have at least one open position
  const openAccounts = useMemo(() =>
    [...new Set(allTrades.filter(t => !t.sell_date).map(t => t.account))].sort(),
    [allTrades]
  );

  // Instruments with open positions for the selected account
  const openInstruments = useMemo(() =>
    [...new Set(allTrades.filter(t => !t.sell_date && t.account === account).map(t => t.instrument))].sort(),
    [allTrades, account]
  );

  // Reset instrument when account changes
  useEffect(() => { setInstrument(''); setSellQty(''); setSellPrice(''); }, [account]);

  // Open trades for the selected account + instrument, FIFO sorted
  const positionTrades = useMemo(() => {
    if (!account || !instrument) return [];
    return allTrades
      .filter(t => !t.sell_date && t.account === account && t.instrument.toUpperCase() === instrument.toUpperCase())
      .sort((a, b) => {
        const da = a.buy_date ?? '9999-99-99';
        const db = b.buy_date ?? '9999-99-99';
        return da !== db ? da.localeCompare(db) : a.id - b.id;
      });
  }, [allTrades, account, instrument]);

  const totalOpenQty = useMemo(() => positionTrades.reduce((s, t) => s + t.qty, 0), [positionTrades]);

  // Auto-fill sell qty when a position loads
  useEffect(() => {
    if (positionTrades.length > 0) setSellQty(String(totalOpenQty));
  }, [positionTrades, totalOpenQty]);

  const sellQtyNum   = parseFloat(sellQty);
  const sellPriceNum = parseFloat(sellPrice);
  const qtyExceeds   = !isNaN(sellQtyNum) && sellQtyNum > totalOpenQty + 0.0001;

  const allocation = useMemo((): AllocAction[] => {
    if (!positionTrades.length || isNaN(sellQtyNum) || sellQtyNum <= 0) return [];
    return computeFIFO(positionTrades, Math.min(sellQtyNum, totalOpenQty));
  }, [positionTrades, sellQtyNum, totalOpenQty]);

  const canProceedToForm = !!(account && instrument && positionTrades.length > 0);
  const canSubmit        = !isNaN(sellQtyNum) && sellQtyNum > 0 && !qtyExceeds
                        && !isNaN(sellPriceNum) && sellPriceNum > 0 && !!sellDate;

  const userName = account ? (activeUsers[account]?.name ?? account) : '';

  async function executeClose() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/trade-journal/close-position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account, instrument, sell_qty: sellQtyNum, sell_price: sellPriceNum, sell_date: sellDate }),
      });
      if (!res.ok) {
        const data = await res.json() as any;
        setError(data?.error || 'Close failed');
        setStep('form');
      } else {
        setStep('done');
      }
    } catch {
      setError('Network error');
      setStep('form');
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = 'w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-3 py-1.5 text-xs focus:outline-none focus:border-primary';
  const labelCls = 'font-label-caps text-[10px] text-on-surface-variant uppercase block mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onMouseDown={onClose}>
      <div
        ref={modalRef}
        className="w-[560px] max-h-[90vh] flex flex-col bg-surface-container border border-primary/30 shadow-2xl outline-none"
        onMouseDown={e => e.stopPropagation()}
        tabIndex={-1}
        onKeyDown={e => {
          if (e.key === 'Escape')  { onClose(); return; }
          if (e.key === 'Enter') {
            if (step === 'done')                         { onSaved(); return; }
            if (step === 'select' && canProceedToForm)   { setStep('form'); return; }
            if (step === 'form'   && canSubmit)          { setStep('confirm'); return; }
            if (step === 'confirm' && !submitting)       { executeClose(); return; }
          }
        }}
      >
        {/* Header */}
        <div className="bg-primary/10 border-b border-primary/20 px-5 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-primary">price_change</span>
            <span className="font-bold text-sm uppercase tracking-widest text-primary">Close Position</span>
            {step !== 'select' && step !== 'done' && (
              <span className="text-xs text-on-surface-variant font-data-mono ml-1">— {instrument} · {userName}</span>
            )}
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>

        <div className={`flex-1 p-5 space-y-4 ${step === 'select' ? 'overflow-visible min-h-[320px]' : 'overflow-y-auto'}`}>

          {step === 'done' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-secondary/10 text-secondary">
                <span className="material-symbols-outlined text-base">check_circle</span>
                <span className="text-sm font-data-mono">Position closed successfully</span>
              </div>
              <button onClick={onSaved}
                className="w-full py-2 bg-surface-container-high text-on-surface font-label-caps text-xs uppercase hover:brightness-110 transition-all">
                Close
              </button>
            </div>
          )}

          {step === 'select' && (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Account</label>
                <AppSelect value={account} onChange={setAccount} options={openAccounts} searchable listMaxHeight="max-h-36" placeholder="Select account…" />
              </div>
              {account && (
                <div>
                  <label className={labelCls}>Security (open positions only)</label>
                  <AppSelect value={instrument} onChange={setInstrument} options={openInstruments} searchable listMaxHeight="max-h-36" placeholder="Select instrument…" />
                </div>
              )}
              {account && instrument && positionTrades.length === 0 && (
                <p className="text-xs text-error">No open positions for {instrument} in {account}</p>
              )}
              <button onClick={() => canProceedToForm && setStep('form')} disabled={!canProceedToForm}
                className="w-full py-2 font-label-caps text-xs uppercase font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-primary/20 border border-primary/50 text-primary hover:bg-primary/30">
                View Positions
              </button>
            </div>
          )}

          {step === 'form' && (
            <>
              {/* Position summary bar */}
              <div className="flex items-center gap-3 bg-surface-container-high border border-outline-variant px-4 py-2 text-xs">
                <span className="font-bold font-data-mono text-on-surface">{instrument}</span>
                <span className="text-on-surface-variant">·</span>
                <span className="text-on-surface-variant">{userName}</span>
                <span className="ml-auto text-on-surface-variant">
                  Total open: <span className="text-on-surface font-mono font-bold">{totalOpenQty}</span> qty
                  <span className="ml-2">({positionTrades.length} trade{positionTrades.length !== 1 ? 's' : ''})</span>
                </span>
              </div>

              {/* Open positions (FIFO order) */}
              <div>
                <label className={labelCls}>Open Positions — FIFO order (oldest first)</label>
                <div className="border border-outline-variant text-xs divide-y divide-outline-variant/30">
                  <div className="grid grid-cols-4 px-3 py-1.5 bg-surface-container-high text-[10px] text-on-surface-variant uppercase font-label-caps">
                    <span>#</span><span>Buy Date</span>
                    <span className="text-right">Qty</span>
                    <span className="text-right">Avg Cost</span>
                  </div>
                  {positionTrades.map((t, i) => (
                    <div key={t.id} className="grid grid-cols-4 px-3 py-2 font-data-mono text-on-surface">
                      <span className="text-on-surface-variant">{i + 1}</span>
                      <span>{fmtDate(t.buy_date)}</span>
                      <span className="text-right">{t.qty}</span>
                      <span className="text-right">{t.buy_price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sell fields */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Sell Qty</label>
                  <input type="text" inputMode="decimal" value={sellQty}
                    onChange={e => setSellQty(e.target.value.replace(/[^0-9.]/g, ''))}
                    className={`${inputCls} ${qtyExceeds ? 'border-error' : ''}`} />
                  {qtyExceeds && <p className="text-[10px] text-error mt-0.5">Max: {totalOpenQty}</p>}
                </div>
                <div>
                  <label className={labelCls}>Sell Price</label>
                  <input type="text" inputMode="decimal" value={sellPrice}
                    onChange={e => setSellPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                    className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Sell Date</label>
                  <input type="date" value={sellDate} onChange={e => setSellDate(e.target.value)}
                    className={`${inputCls} [color-scheme:dark]`} />
                </div>
              </div>

              {/* Live FIFO allocation preview */}
              {allocation.length > 0 && (
                <div>
                  <label className={labelCls}>FIFO Allocation Preview</label>
                  <AllocationTable allocation={allocation} />
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 p-2 bg-error/10 text-error text-xs">
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>error</span>
                  {error}
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setStep('select')}
                  className="flex-1 py-2 bg-surface-container-high text-on-surface font-label-caps text-xs uppercase hover:brightness-110 transition-all">
                  Back
                </button>
                <button onClick={() => canSubmit && setStep('confirm')} disabled={!canSubmit}
                  className="flex-1 py-2 font-label-caps text-xs uppercase font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-primary/20 border border-primary/50 text-primary hover:bg-primary/30">
                  Review Close
                </button>
              </div>
            </>
          )}

          {step === 'confirm' && (
            <div className="space-y-4">
              {/* Summary grid */}
              <div className="grid grid-cols-2 gap-2">
                {([
                  ['Account',         userName],
                  ['Instrument',      instrument],
                  ['Sell Qty',        String(sellQtyNum)],
                  ['Sell Price',      String(sellPriceNum)],
                  ['Sell Date',       sellDate],
                  ['Trades affected', String(allocation.filter(a => a.type !== 'unchanged').length)],
                ] as [string, string][]).map(([label, val]) => (
                  <div key={label} className="bg-surface-container-high border border-outline-variant px-3 py-2 flex justify-between gap-2 text-xs">
                    <span className="text-on-surface-variant text-[10px] uppercase font-label-caps">{label}</span>
                    <span className="font-data-mono text-on-surface font-bold">{val}</span>
                  </div>
                ))}
              </div>

              {/* Allocation */}
              <div>
                <label className={labelCls}>FIFO Allocation</label>
                <AllocationTable allocation={allocation} />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-2 bg-error/10 text-error text-xs">
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>error</span>
                  {error}
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setStep('form')} disabled={submitting}
                  className="flex-1 py-2 bg-surface-container-high text-on-surface font-label-caps text-xs uppercase hover:brightness-110 transition-all">
                  Back
                </button>
                <button onClick={executeClose} disabled={submitting}
                  className="flex-1 py-2 font-label-caps text-xs uppercase font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-primary/20 border border-primary/50 text-primary hover:bg-primary/30">
                  {submitting ? 'Executing…' : 'Execute Close'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── JournalSellModal ─────────────────────────────────────────────────────────

interface JournalSellModalProps {
  instrument: string;
  accounts: string[];
  ltp: number | null;
  chp: number | null;
  userMap: Record<string, JournalUser>;
  onClose: () => void;
  onToggle?: () => void;
}

function JournalSellModal({ instrument, accounts, ltp, chp, userMap, onClose, onToggle }: JournalSellModalProps) {
  const [holdings, setHoldings] = useState<JournalHolding[]>([]);
  const [loadingHoldings, setLoadingHoldings] = useState(true);
  const [exitType, setExitType] = useState<'full' | 'partial'>('partial');
  const [activePct, setActivePct] = useState('100%');
  const [customPct, setCustomPct] = useState('');
  const [qtyOverrides, setQtyOverrides] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [orderType, setOrderType] = useState<'LIMIT' | 'MARKET' | 'GTT'>('LIMIT');
  const [price, setPrice] = useState(ltp != null && ltp > 0 ? roundTo10p(ltp) : '');
  const [triggerPct, setTriggerPct] = useState('');
  const [step, setStep] = useState<'form' | 'confirm' | 'done'>('form');
  const [placing, setPlacing] = useState(false);
  const [orderResults, setOrderResults] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setTimeout(() => modalRef.current?.focus(), 50); }, []);
  useEffect(() => {
    if (step === 'confirm' || step === 'done') setTimeout(() => modalRef.current?.focus(), 50);
  }, [step]);

  useEffect(() => {
    async function fetchHoldings() {
      setLoadingHoldings(true);
      const results: JournalHolding[] = [];
      for (const acct of accounts) {
        try {
          const res = await fetch(`/api/users/${encodeURIComponent(acct)}/holdings`);
          if (!res.ok) continue;
          const data = await res.json() as any;
          const h = (data.data ?? []).find((x: any) =>
            x.tradingsymbol?.toUpperCase() === instrument.toUpperCase()
          );
          if (h && h.quantity > 0) {
            results.push({
              zerodha_user_id: acct,
              name: userMap[acct]?.name ?? null,
              holdQty: h.quantity,
              avgPrice: h.average_price,
            });
          }
        } catch { /* skip */ }
      }
      setHoldings(results);
      const sel: Record<string, boolean> = {};
      results.forEach(h => { sel[h.zerodha_user_id] = true; });
      setSelected(sel);
      setLoadingHoldings(false);
    }
    fetchHoldings();
  }, [instrument, accounts, userMap]);

  const gttExpiry = new Date(); gttExpiry.setFullYear(gttExpiry.getFullYear() + 2);
  const gttExpiryStr = gttExpiry.toISOString().slice(0, 10);

  function handlePriceChange(val: string) {
    setPrice(val);
    if (orderType === 'GTT' && ltp != null && ltp > 0) {
      const p = parseFloat(val);
      setTriggerPct(!isNaN(p) ? ((p - ltp) / ltp * 100).toFixed(2) : '');
    }
  }

  function handlePctChange(val: string) {
    setTriggerPct(val);
    if (ltp != null && ltp > 0) {
      const pct = parseFloat(val);
      if (!isNaN(pct)) setPrice(roundTo10p(ltp * (1 + pct / 100)));
    }
  }

  function effectivePct(): number {
    if (exitType === 'full') return 100;
    const c = parseFloat(customPct);
    if (customPct.trim() !== '' && !isNaN(c) && c > 0) return Math.min(c, 100);
    const a = parseFloat(activePct);
    return isNaN(a) ? 100 : a;
  }

  function computeSellQty(h: JournalHolding): number {
    const ov = qtyOverrides[h.zerodha_user_id];
    if (ov !== undefined) return parseInt(ov, 10) || 0;
    return Math.floor(h.holdQty * effectivePct() / 100);
  }

  function sellQtyDisplay(h: JournalHolding): string {
    const ov = qtyOverrides[h.zerodha_user_id];
    if (ov !== undefined) return ov;
    return String(Math.floor(h.holdQty * effectivePct() / 100));
  }

  const selectedHoldings = holdings.filter(h => selected[h.zerodha_user_id] && computeSellQty(h) > 0);
  const canReview = selectedHoldings.length > 0 && (orderType === 'MARKET' || parseFloat(price) > 0);

  async function placeOrders() {
    setPlacing(true);
    const results: Record<string, { ok: boolean; msg: string }> = {};
    for (const h of selectedHoldings) {
      try {
        let res: Response;
        if (orderType === 'GTT') {
          res = await fetch('/api/gtt/triggers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              zerodha_user_id: h.zerodha_user_id,
              exchange: 'NSE',
              tradingsymbol: instrument,
              transaction_type: 'SELL',
              qty: computeSellQty(h),
              trigger_price: parseFloat(price),
              last_price: ltp ?? 0,
            }),
          });
        } else {
          res = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              zerodha_user_id: h.zerodha_user_id,
              exchange: 'NSE',
              tradingSymbol: instrument,
              transaction_type: 'SELL',
              order_type: orderType,
              price: orderType === 'LIMIT' ? parseFloat(price) : 0,
              qty: computeSellQty(h),
              variety: 'regular', product: 'CNC', validity: 'DAY',
              disclosed_quantity: 0, trigger_price: 0,
              squareoff: 0, stoploss: 0, trailing_stoploss: 0,
            }),
          });
        }
        const data = await res.json() as any;
        const id = data?.data?.order_id ?? data?.data?.trigger_id;
        results[h.zerodha_user_id] = {
          ok: res.ok,
          msg: res.ok ? (id ? `#${id}` : 'Placed') : (data?.error || 'Failed'),
        };
      } catch {
        results[h.zerodha_user_id] = { ok: false, msg: 'Network error' };
      }
    }
    setOrderResults(results);
    setStep('done');
    setPlacing(false);
  }

  const titleCls  = 'text-tertiary';
  const borderCls = 'border-tertiary/30';
  const btnCls    = 'bg-tertiary/20 border border-tertiary/50 text-tertiary hover:bg-tertiary/30';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onMouseDown={onClose}>
      <div
        ref={modalRef}
        className={`w-[640px] max-h-[90vh] flex flex-col bg-surface-container border ${borderCls} shadow-2xl outline-none`}
        onMouseDown={e => e.stopPropagation()}
        tabIndex={-1}
        onKeyDown={e => {
          if (e.key === 'Escape') { onClose(); return; }
          if (e.key === 'Enter') {
            if (step === 'done')                         { onClose(); return; }
            if (step === 'form' && canReview)            { setStep('confirm'); return; }
            if (step === 'confirm' && !placing)          { placeOrders(); return; }
          }
        }}
      >
        <div className="bg-tertiary/10 border-b border-tertiary/20 px-5 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className={`material-symbols-outlined text-base ${titleCls}`}>sell</span>
            <span className={`font-bold text-sm uppercase tracking-widest ${titleCls}`}>SELL — {instrument}</span>
          </div>
          <div className="flex items-center gap-2">
            {step !== 'done' && onToggle && (
              <button onClick={onToggle}
                className="px-2 py-0.5 text-xs font-bold bg-secondary/20 border border-secondary/40 text-secondary hover:bg-secondary/30 transition-colors">
                B
              </button>
            )}
            <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {step === 'done' ? (
            <div className="space-y-3">
              {Object.entries(orderResults).map(([uid, r]) => (
                <div key={uid} className={`flex items-center gap-3 px-3 py-2.5 ${r.ok ? 'bg-secondary/10' : 'bg-tertiary/10'}`}>
                  <span className={`material-symbols-outlined text-base ${r.ok ? 'text-secondary' : 'text-tertiary'}`}>
                    {r.ok ? 'check_circle' : 'error'}
                  </span>
                  <div>
                    <span className={`font-bold text-xs ${r.ok ? 'text-secondary' : 'text-tertiary'}`}>{uid}</span>
                    <span className="text-xs text-on-surface-variant ml-2 font-data-mono">{r.msg}</span>
                  </div>
                </div>
              ))}
              <button onClick={onClose} className="w-full py-2 bg-surface-container-high text-on-surface font-label-caps text-xs uppercase hover:brightness-110 transition-all">
                Close
              </button>
            </div>
          ) : step === 'confirm' ? (
            <div className="space-y-3">
              <p className="text-xs text-on-surface-variant font-label-caps uppercase">
                Review {selectedHoldings.length} order{selectedHoldings.length > 1 ? 's' : ''}
              </p>
              <div className="bg-surface-container-high border border-outline-variant divide-y divide-outline-variant/30 text-xs font-data-mono">
                {selectedHoldings.map(h => {
                  const qty = computeSellQty(h);
                  const priceVal = parseFloat(price);
                  const effPrice = orderType === 'GTT' || orderType === 'LIMIT' ? priceVal : (ltp ?? 0);
                  const amt = qty * effPrice;
                  const fee = orderType === 'GTT' ? 0 : amt * 0.00119063431;
                  return (
                    <div key={h.zerodha_user_id} className="px-4 py-3 space-y-1.5">
                      <div className="flex justify-between">
                        <div>
                          <span className="text-primary font-bold">{h.zerodha_user_id}</span>
                          {h.name && <span className="text-on-surface-variant text-[10px] ml-2 uppercase">{h.name}</span>}
                        </div>
                        <span className="text-on-surface">{instrument} · SELL · {qty} qty</span>
                      </div>
                      <div className="flex justify-between text-on-surface-variant">
                        {orderType === 'GTT'
                          ? <span className="px-1.5 py-0.5 text-xs bg-primary/20 text-primary font-bold">GTT · SINGLE · CNC · {gttExpiryStr}</span>
                          : <span>{orderType}{orderType === 'LIMIT' ? ` @ ₹${inrDec(priceVal)}` : ' (market)'}</span>
                        }
                        <span className={titleCls}>
                          {orderType === 'GTT' ? `Trigger ₹${inrDec(priceVal)}` : `Est. ₹${inrDec(amt - fee)}`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep('form')} disabled={placing}
                  className="flex-1 py-2 bg-surface-container-high text-on-surface font-label-caps text-xs uppercase hover:brightness-110 transition-all">
                  Back
                </button>
                <button onClick={placeOrders} disabled={placing}
                  className={`flex-1 py-2 font-label-caps text-xs uppercase font-bold transition-all disabled:opacity-60 ${btnCls}`}>
                  {placing ? `Placing ${selectedHoldings.length} order${selectedHoldings.length > 1 ? 's' : ''}…` : `Confirm SELL (${selectedHoldings.length})`}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* LTP strip */}
              <div className="bg-surface-container-high px-3 py-2 border border-outline-variant/30 flex items-center justify-between text-xs font-data-mono">
                <span className="text-on-surface-variant font-label-caps text-[10px] uppercase">{instrument}</span>
                <div className="flex flex-col items-end">
                  <span className="text-on-surface font-bold">{ltp != null && ltp > 0 ? inrDec(ltp) : '—'}</span>
                  {chp != null && ltp != null && ltp > 0 && (
                    <span className={`text-[10px] font-data-mono ${chp > 0 ? 'text-secondary' : chp < 0 ? 'text-tertiary' : 'text-on-surface-variant'}`}>
                      {(() => { const ch = ltp - ltp / (1 + chp / 100); return `${ch >= 0 ? '+' : ''}${ch.toFixed(2)} (${chp >= 0 ? '+' : ''}${chp.toFixed(2)}%)`; })()}
                    </span>
                  )}
                </div>
              </div>

              {/* Order type */}
              <div className="flex items-center gap-3">
                <span className="font-label-caps text-[10px] text-on-surface-variant uppercase w-24 shrink-0">Order Type</span>
                <div className="flex bg-surface-container-lowest border border-outline-variant p-0.5">
                  {(['LIMIT', 'MARKET', 'GTT'] as const).map(ot => (
                    <button key={ot} type="button" onClick={() => setOrderType(ot)}
                      className={`px-4 py-1 font-label-caps text-[10px] uppercase transition-colors ${
                        orderType === ot ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                      }`}>{ot}</button>
                  ))}
                </div>
              </div>

              {/* GTT trigger price + % */}
              {orderType === 'GTT' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <label className="font-label-caps text-[10px] text-on-surface-variant uppercase w-24 shrink-0">Trigger Price</label>
                    <input type="text" inputMode="decimal" value={price}
                      onChange={e => handlePriceChange(e.target.value.replace(/[^0-9.]/g, ''))}
                      className="w-28 bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-3 py-1.5 text-sm focus:outline-none focus:border-primary" />
                    <input type="text" inputMode="decimal" value={triggerPct}
                      onChange={e => handlePctChange(e.target.value.replace(/[^0-9.\-]/g, ''))}
                      className="w-20 bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-2 py-1.5 text-sm focus:outline-none focus:border-primary text-right" />
                    <span className="text-[10px] text-on-surface-variant shrink-0">%LTP</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-on-surface-variant pl-[calc(1.5rem+6rem)]">
                    <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>info</span>
                    Single · CNC · LIMIT · Expires {gttExpiryStr}
                  </div>
                </div>
              )}

              {/* Limit price */}
              {orderType === 'LIMIT' && (
                <div className="flex items-center gap-3">
                  <label className="font-label-caps text-[10px] text-on-surface-variant uppercase w-24 shrink-0">Price</label>
                  <input type="text" inputMode="decimal" value={price}
                    onChange={e => setPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                    className="w-28 bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-3 py-1.5 text-sm focus:outline-none focus:border-primary" />
                </div>
              )}

              {/* Exit type */}
              <div className="flex items-center gap-3">
                <span className="font-label-caps text-[10px] text-on-surface-variant uppercase w-24 shrink-0">Exit Type</span>
                <div className="flex bg-surface-container-lowest border border-outline-variant p-0.5">
                  {(['full', 'partial'] as const).map(et => (
                    <button key={et} type="button" onClick={() => setExitType(et)}
                      className={`px-4 py-1 font-label-caps text-[10px] uppercase transition-colors ${
                        exitType === et ? 'bg-tertiary text-on-tertiary' : 'text-on-surface-variant hover:bg-surface-container-high'
                      }`}>{et === 'full' ? 'FULL' : 'PARTIAL'}</button>
                  ))}
                </div>
              </div>

              {/* Sell holding % — only for partial */}
              {exitType === 'partial' && (
                <div className="flex items-center gap-3">
                  <span className="font-label-caps text-[10px] text-on-surface-variant uppercase w-24 shrink-0">Sell Holding %</span>
                  <div className="flex bg-surface-container-lowest border border-outline-variant p-0.5">
                    {PCT_OPTIONS.map(pct => (
                      <button key={pct} type="button"
                        onClick={() => { setActivePct(pct); setCustomPct(''); setQtyOverrides({}); }}
                        className={`px-3 py-1 text-[10px] font-bold font-data-mono transition-colors ${
                          activePct === pct && customPct === '' ? 'bg-tertiary text-on-tertiary' : 'hover:bg-tertiary/20 text-on-surface'
                        }`}>{pct}</button>
                    ))}
                    <input type="text" value={customPct}
                      onChange={e => { setCustomPct(e.target.value.replace(/[^0-9.]/g, '')); setQtyOverrides({}); }}
                      placeholder="Custom"
                      className="w-16 bg-transparent border-l border-outline-variant text-[10px] text-center font-data-mono focus:outline-none py-1 px-1" />
                  </div>
                </div>
              )}

              {/* Holdings table */}
              {loadingHoldings ? (
                <div className="flex items-center justify-center py-8 text-on-surface-variant text-xs">
                  <span className="material-symbols-outlined animate-spin mr-2" style={{ fontSize: '16px' }}>progress_activity</span>
                  Loading holdings…
                </div>
              ) : holdings.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-on-surface-variant text-xs">
                  No holdings found for {instrument} in Zerodha
                </div>
              ) : (
                <div className="border border-outline-variant overflow-hidden">
                  <table className="w-full text-xs font-data-mono">
                    <thead>
                      <tr className="bg-surface-container-high border-b border-outline-variant font-label-caps text-[10px] text-on-surface-variant uppercase">
                        <th className="px-3 py-2 w-8"></th>
                        <th className="px-3 py-2 text-left">Account</th>
                        <th className="px-3 py-2 text-right">Hold Qty</th>
                        <th className="px-3 py-2 text-right">Avg Price</th>
                        {ltp != null && <th className="px-3 py-2 text-right">P&L</th>}
                        <th className="px-3 py-2 text-right">Sell Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/20">
                      {holdings.map(h => {
                        const pnl     = ltp != null ? (ltp - h.avgPrice) * h.holdQty : null;
                        const pnlPct  = ltp != null ? ((ltp - h.avgPrice) / h.avgPrice) * 100 : null;
                        const sellQty = computeSellQty(h);
                        return (
                          <tr key={h.zerodha_user_id} className="hover:bg-surface-container-high transition-colors">
                            <td className="px-3 py-2">
                              <input type="checkbox" checked={!!selected[h.zerodha_user_id]}
                                onChange={e => setSelected(s => ({ ...s, [h.zerodha_user_id]: e.target.checked }))}
                                className="w-3 h-3 accent-tertiary" />
                            </td>
                            <td className="px-3 py-2">
                              <span className="text-primary font-bold">{h.zerodha_user_id}</span>
                              {h.name && <span className="text-on-surface-variant text-[10px] ml-1.5 uppercase">{h.name}</span>}
                            </td>
                            <td className="px-3 py-2 text-right text-on-surface">{h.holdQty.toLocaleString('en-IN')}</td>
                            <td className="px-3 py-2 text-right text-on-surface-variant">{inrDec(h.avgPrice)}</td>
                            {ltp != null && (
                              <td className={`px-3 py-2 text-right ${pnl != null && pnl >= 0 ? 'text-secondary' : 'text-tertiary'}`}>
                                {pnl != null
                                  ? `${pnl >= 0 ? '+' : ''}${pnl.toLocaleString('en-IN', { maximumFractionDigits: 0 })} (${pnlPct != null ? (pnlPct >= 0 ? '+' : '') + pnlPct.toFixed(2) + '%' : ''})`
                                  : '—'}
                              </td>
                            )}
                            <td className="px-2 py-1.5 text-right">
                              <input type="text" inputMode="numeric"
                                value={sellQtyDisplay(h)}
                                onChange={e => setQtyOverrides(ov => ({ ...ov, [h.zerodha_user_id]: e.target.value.replace(/[^0-9]/g, '') }))}
                                className={`w-20 text-right bg-surface-container-lowest border text-on-surface font-data-mono px-2 py-1 text-xs focus:outline-none ${
                                  sellQty > h.holdQty ? 'border-tertiary/60' : 'border-outline-variant focus:border-primary'
                                }`} />
                              {sellQty > h.holdQty && (
                                <p className="text-[9px] text-tertiary">Exceeds holding</p>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <button onClick={() => canReview && setStep('confirm')} disabled={!canReview || loadingHoldings}
                className={`w-full py-2 font-label-caps text-xs uppercase font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${btnCls}`}>
                Review {selectedHoldings.length} Order{selectedHoldings.length !== 1 ? 's' : ''}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── JournalBuyModal ──────────────────────────────────────────────────────────

interface JournalBuyModalProps {
  instrument: string;
  accounts: string[];
  ltp: number | null;
  chp: number | null;
  userMap: Record<string, JournalUser>;
  onClose: () => void;
  onToggle?: () => void;
}

function JournalBuyModal({ instrument, accounts, ltp, chp, userMap, onClose, onToggle }: JournalBuyModalProps) {
  const [orderType, setOrderType] = useState<'LIMIT' | 'MARKET' | 'GTT'>('LIMIT');
  const [price, setPrice] = useState(ltp != null && ltp > 0 ? roundTo10p(ltp) : '');
  const [triggerPct, setTriggerPct] = useState('');
  const [qtyMap, setQtyMap] = useState<Record<string, string>>({});
  const [margins, setMargins] = useState<Record<string, number | null | undefined>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>(
    Object.fromEntries(accounts.map(a => [a, true]))
  );
  const [step, setStep] = useState<'form' | 'confirm' | 'done'>('form');
  const [placing, setPlacing] = useState(false);
  const [orderResults, setOrderResults] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setTimeout(() => modalRef.current?.focus(), 50); }, []);
  useEffect(() => {
    if (step === 'confirm' || step === 'done') setTimeout(() => modalRef.current?.focus(), 50);
  }, [step]);

  useEffect(() => {
    for (const acct of accounts) {
      fetch(`/api/users/${encodeURIComponent(acct)}/margins`)
        .then(r => r.json())
        .then(res => setMargins(m => ({ ...m, [acct]: res?.data?.live_balance ?? null })))
        .catch(() => setMargins(m => ({ ...m, [acct]: null })));
    }
  }, [accounts]);

  const gttExpiry = new Date(); gttExpiry.setFullYear(gttExpiry.getFullYear() + 2);
  const gttExpiryStr = gttExpiry.toISOString().slice(0, 10);

  function handlePriceChange(val: string) {
    setPrice(val);
    if (orderType === 'GTT' && ltp != null && ltp > 0) {
      const p = parseFloat(val);
      setTriggerPct(!isNaN(p) ? ((p - ltp) / ltp * 100).toFixed(2) : '');
    }
  }

  function handlePctChange(val: string) {
    setTriggerPct(val);
    if (ltp != null && ltp > 0) {
      const pct = parseFloat(val);
      if (!isNaN(pct)) setPrice(roundTo10p(ltp * (1 + pct / 100)));
    }
  }

  const priceNum = parseFloat(price);
  const effectivePrice = orderType === 'LIMIT' || orderType === 'GTT' ? priceNum : (ltp ?? 0);

  const selectedAccounts = accounts.filter(a => selected[a] && parseInt(qtyMap[a] || '0', 10) > 0);
  const canReview = selectedAccounts.length > 0 && (orderType === 'MARKET' || priceNum > 0);

  async function placeOrders() {
    setPlacing(true);
    const results: Record<string, { ok: boolean; msg: string }> = {};
    for (const acct of selectedAccounts) {
      const qty = parseInt(qtyMap[acct] || '0', 10);
      try {
        let res: Response;
        if (orderType === 'GTT') {
          res = await fetch('/api/gtt/triggers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              zerodha_user_id: acct,
              exchange: 'NSE',
              tradingsymbol: instrument,
              transaction_type: 'BUY',
              qty,
              trigger_price: priceNum,
              last_price: ltp ?? 0,
            }),
          });
        } else {
          res = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              zerodha_user_id: acct,
              exchange: 'NSE',
              tradingSymbol: instrument,
              transaction_type: 'BUY',
              order_type: orderType,
              price: orderType === 'LIMIT' ? priceNum : 0,
              qty,
              variety: 'regular', product: 'CNC', validity: 'DAY',
              disclosed_quantity: 0, trigger_price: 0,
              squareoff: 0, stoploss: 0, trailing_stoploss: 0,
            }),
          });
        }
        const data = await res.json() as any;
        const id = data?.data?.order_id ?? data?.data?.trigger_id;
        results[acct] = {
          ok: res.ok,
          msg: res.ok ? (id ? `#${id}` : 'Placed') : (data?.error || 'Failed'),
        };
      } catch {
        results[acct] = { ok: false, msg: 'Network error' };
      }
    }
    setOrderResults(results);
    setStep('done');
    setPlacing(false);
  }

  const titleCls  = 'text-secondary';
  const borderCls = 'border-secondary/30';
  const btnCls    = 'bg-secondary/20 border border-secondary/50 text-secondary hover:bg-secondary/30';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onMouseDown={onClose}>
      <div
        ref={modalRef}
        className={`w-[600px] max-h-[90vh] flex flex-col bg-surface-container border ${borderCls} shadow-2xl outline-none`}
        onMouseDown={e => e.stopPropagation()}
        tabIndex={-1}
        onKeyDown={e => {
          if (e.key === 'Escape') { onClose(); return; }
          if (e.key === 'Enter') {
            if (step === 'done')                         { onClose(); return; }
            if (step === 'form' && canReview)            { setStep('confirm'); return; }
            if (step === 'confirm' && !placing)          { placeOrders(); return; }
          }
        }}
      >
        <div className="bg-secondary/10 border-b border-secondary/20 px-5 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className={`material-symbols-outlined text-base ${titleCls}`}>add_shopping_cart</span>
            <span className={`font-bold text-sm uppercase tracking-widest ${titleCls}`}>BUY — {instrument}</span>
          </div>
          <div className="flex items-center gap-2">
            {step !== 'done' && onToggle && (
              <button onClick={onToggle}
                className="px-2 py-0.5 text-xs font-bold bg-tertiary/20 border border-tertiary/40 text-tertiary hover:bg-tertiary/30 transition-colors">
                S
              </button>
            )}
            <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {step === 'done' ? (
            <div className="space-y-3">
              {Object.entries(orderResults).map(([uid, r]) => (
                <div key={uid} className={`flex items-center gap-3 px-3 py-2.5 ${r.ok ? 'bg-secondary/10' : 'bg-tertiary/10'}`}>
                  <span className={`material-symbols-outlined text-base ${r.ok ? 'text-secondary' : 'text-tertiary'}`}>
                    {r.ok ? 'check_circle' : 'error'}
                  </span>
                  <div>
                    <span className={`font-bold text-xs ${r.ok ? 'text-secondary' : 'text-tertiary'}`}>{uid}</span>
                    <span className="text-xs text-on-surface-variant ml-2 font-data-mono">{r.msg}</span>
                  </div>
                </div>
              ))}
              <button onClick={onClose} className="w-full py-2 bg-surface-container-high text-on-surface font-label-caps text-xs uppercase hover:brightness-110 transition-all">
                Close
              </button>
            </div>
          ) : step === 'confirm' ? (
            <div className="space-y-3">
              <p className="text-xs text-on-surface-variant font-label-caps uppercase">
                Review {selectedAccounts.length} order{selectedAccounts.length > 1 ? 's' : ''}
              </p>
              <div className="bg-surface-container-high border border-outline-variant divide-y divide-outline-variant/30 text-xs font-data-mono">
                {selectedAccounts.map(acct => {
                  const qty = parseInt(qtyMap[acct] || '0', 10);
                  const amt = qty * effectivePrice;
                  const fee = orderType === 'GTT' ? 0 : amt * 0.00119063431;
                  return (
                    <div key={acct} className="px-4 py-3 space-y-1.5">
                      <div className="flex justify-between">
                        <div>
                          <span className="text-primary font-bold">{acct}</span>
                          {userMap[acct]?.name && <span className="text-on-surface-variant text-[10px] ml-2 uppercase">{userMap[acct].name}</span>}
                        </div>
                        <span className="text-on-surface">{instrument} · BUY · {qty} qty</span>
                      </div>
                      <div className="flex justify-between text-on-surface-variant">
                        {orderType === 'GTT'
                          ? <span className="px-1.5 py-0.5 text-xs bg-primary/20 text-primary font-bold">GTT · SINGLE · CNC · {gttExpiryStr}</span>
                          : <span>{orderType}{orderType === 'LIMIT' ? ` @ ₹${inrDec(priceNum)}` : ' (market)'}</span>
                        }
                        <span className={titleCls}>
                          {orderType === 'GTT' ? `Trigger ₹${inrDec(priceNum)}` : `Total ₹${inrDec(amt + fee)}`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep('form')} disabled={placing}
                  className="flex-1 py-2 bg-surface-container-high text-on-surface font-label-caps text-xs uppercase hover:brightness-110 transition-all">
                  Back
                </button>
                <button onClick={placeOrders} disabled={placing}
                  className={`flex-1 py-2 font-label-caps text-xs uppercase font-bold transition-all disabled:opacity-60 ${btnCls}`}>
                  {placing ? 'Placing…' : `Confirm BUY (${selectedAccounts.length})`}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* LTP strip */}
              <div className="bg-surface-container-high px-3 py-2 border border-outline-variant/30 flex items-center justify-between text-xs font-data-mono">
                <span className="text-on-surface-variant font-label-caps text-[10px] uppercase">{instrument}</span>
                <div className="flex flex-col items-end">
                  <span className="text-on-surface font-bold">{ltp != null && ltp > 0 ? inrDec(ltp) : '—'}</span>
                  {chp != null && ltp != null && ltp > 0 && (
                    <span className={`text-[10px] font-data-mono ${chp > 0 ? 'text-secondary' : chp < 0 ? 'text-tertiary' : 'text-on-surface-variant'}`}>
                      {(() => { const ch = ltp - ltp / (1 + chp / 100); return `${ch >= 0 ? '+' : ''}${ch.toFixed(2)} (${chp >= 0 ? '+' : ''}${chp.toFixed(2)}%)`; })()}
                    </span>
                  )}
                </div>
              </div>

              {/* Order type */}
              <div className="flex items-center gap-3">
                <span className="font-label-caps text-[10px] text-on-surface-variant uppercase w-24 shrink-0">Order Type</span>
                <div className="flex bg-surface-container-lowest border border-outline-variant p-0.5">
                  {(['LIMIT', 'MARKET', 'GTT'] as const).map(ot => (
                    <button key={ot} type="button" onClick={() => setOrderType(ot)}
                      className={`px-4 py-1 font-label-caps text-[10px] uppercase transition-colors ${
                        orderType === ot ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                      }`}>{ot}</button>
                  ))}
                </div>
              </div>

              {/* GTT trigger price + % */}
              {orderType === 'GTT' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <label className="font-label-caps text-[10px] text-on-surface-variant uppercase w-24 shrink-0">Trigger Price</label>
                    <input type="text" inputMode="decimal" value={price}
                      onChange={e => handlePriceChange(e.target.value.replace(/[^0-9.]/g, ''))}
                      className="w-28 bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-3 py-1.5 text-sm focus:outline-none focus:border-primary" />
                    <input type="text" inputMode="decimal" value={triggerPct}
                      onChange={e => handlePctChange(e.target.value.replace(/[^0-9.\-]/g, ''))}
                      className="w-20 bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-2 py-1.5 text-sm focus:outline-none focus:border-primary text-right" />
                    <span className="text-[10px] text-on-surface-variant shrink-0">%LTP</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-on-surface-variant pl-[calc(1.5rem+6rem)]">
                    <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>info</span>
                    Single · CNC · LIMIT · Expires {gttExpiryStr}
                  </div>
                </div>
              )}

              {/* Limit price */}
              {orderType === 'LIMIT' && (
                <div className="flex items-center gap-3">
                  <label className="font-label-caps text-[10px] text-on-surface-variant uppercase w-24 shrink-0">Price</label>
                  <input type="text" inputMode="decimal" value={price}
                    onChange={e => setPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                    className="w-28 bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-3 py-1.5 text-sm focus:outline-none focus:border-primary" />
                </div>
              )}

              {/* Accounts table */}
              <div className="border border-outline-variant overflow-hidden">
                <table className="w-full text-xs font-data-mono">
                  <thead>
                    <tr className="bg-surface-container-high border-b border-outline-variant font-label-caps text-[10px] text-on-surface-variant uppercase">
                      <th className="px-3 py-2 w-8"></th>
                      <th className="px-3 py-2 text-left">Account</th>
                      <th className="px-3 py-2 text-right">Available Margin</th>
                      <th className="px-3 py-2 text-right">Buy Qty</th>
                      <th className="px-3 py-2 text-right">Est. Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {accounts.map(acct => {
                      const qty = parseInt(qtyMap[acct] || '0', 10);
                      const margin = margins[acct];
                      const amt = qty > 0 && effectivePrice > 0 ? qty * effectivePrice * (orderType === 'GTT' ? 1 : 1.00119063431) : null;
                      const marginInsufficient = margin != null && amt != null && amt > margin;
                      return (
                        <tr key={acct} className="hover:bg-surface-container-high transition-colors">
                          <td className="px-3 py-2">
                            <input type="checkbox" checked={!!selected[acct]}
                              onChange={e => setSelected(s => ({ ...s, [acct]: e.target.checked }))}
                              className="w-3 h-3 accent-secondary" />
                          </td>
                          <td className="px-3 py-2">
                            <span className="text-primary font-bold">{acct}</span>
                            {userMap[acct]?.name && <span className="text-on-surface-variant text-[10px] ml-1.5 uppercase">{userMap[acct].name}</span>}
                          </td>
                          <td className={`px-3 py-2 text-right ${marginInsufficient ? 'text-tertiary font-bold' : 'text-on-surface-variant'}`}>
                            {margin === undefined ? '…' : margin != null ? `₹${margin.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <input type="text" inputMode="numeric"
                              value={qtyMap[acct] || ''}
                              onChange={e => setQtyMap(m => ({ ...m, [acct]: e.target.value.replace(/[^0-9]/g, '') }))}
                              placeholder="0"
                              className="w-20 text-right bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-2 py-1 text-xs focus:outline-none focus:border-primary" />
                          </td>
                          <td className={`px-3 py-2 text-right ${marginInsufficient ? 'text-tertiary' : 'text-on-surface'}`}>
                            {amt != null ? `₹${inrDec(amt)}` : '—'}
                            {marginInsufficient && <span className="block text-[9px] text-tertiary">Insufficient margin</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <button onClick={() => canReview && setStep('confirm')} disabled={!canReview}
                className={`w-full py-2 font-label-caps text-xs uppercase font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${btnCls}`}>
                Review {selectedAccounts.length} Order{selectedAccounts.length !== 1 ? 's' : ''}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TradeJournalPage() {
  // ── View toggle
  const [view, setView] = useState<'journal' | 'analytics'>('journal');
  const [analyticsTab, setAnalyticsTab] = useState<'performance' | 'risk' | 'time' | 'open'>('performance');
  const [initialCapital, setInitialCapital] = useState<number>(() => {
    const saved = localStorage.getItem('tj_initial_capital');
    return saved ? parseInt(saved, 10) : 0;
  });

  // ── Filter state
  const [status, setStatus] = useState<'all' | 'open' | 'closed'>('open');
  const [selectedMethods, setSelectedMethods] = useState<Set<string>>(new Set(['SWING']));
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [instrumentFilter, setInstrumentFilter] = useState('');
  const [grouped, setGrouped] = useState(true);
  const [dateFrom,    setDateFrom]    = useState('');
  const [dateTo,      setDateTo]      = useState('');
  const [dateField,   setDateField]   = useState<'buy' | 'sell'>('buy');
  const [sortCol, setSortCol] = useState('pnl_pct');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  // ── Data state
  const [allTrades, setAllTrades] = useState<TradeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [quotes, setQuotes] = useState<Record<string, { lp: number | null; chp: number | null }>>({});
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [activeUsers, setActiveUsers] = useState<Record<string, JournalUser>>({});
  const [orderModal, setOrderModal] = useState<{ type: 'BUY' | 'SELL'; instrument: string; accounts: string[] } | null>(null);
  const [editModal,      setEditModal]      = useState<DisplayRow | null>(null);
  const [deleteConfirm,  setDeleteConfirm]  = useState<DisplayRow | null>(null);
  const [addModal,       setAddModal]       = useState(false);
  const [closeModal,     setCloseModal]     = useState(false);

  // ── Instrument autocomplete state
  const [instrDropOpen, setInstrDropOpen] = useState(false);
  const [instrFocusedIdx, setInstrFocusedIdx] = useState(-1);
  const instrDropRef  = useRef<HTMLDivElement>(null);
  const instrInputRef = useRef<HTMLInputElement>(null);
  const instrItemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // ── Derived filter options
  const allMethods  = useMemo(() => [...new Set(allTrades.map(t => t.method))].sort(), [allTrades]);
  const allAccounts = useMemo(() => [...new Set(allTrades.map(t => t.account))].sort(), [allTrades]);

  const accountLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const id of allAccounts) {
      const user = activeUsers[id];
      map[id] = user?.name ? `${user.name} (${id})` : id;
    }
    return map;
  }, [allAccounts, activeUsers]);

  // Autocomplete suggestions — distinct instruments matching the current text
  const instrSuggestions = useMemo(() => {
    const q = instrumentFilter.trim().toLowerCase();
    if (!q) return [];
    return [...new Set(allTrades.map(t => t.instrument))]
      .filter(i => i.toLowerCase().includes(q))
      .sort()
      .slice(0, 12);
  }, [allTrades, instrumentFilter]);

  // Reset focused index whenever suggestions change
  useEffect(() => { setInstrFocusedIdx(-1); instrItemRefs.current = []; }, [instrSuggestions]);

  // Scroll focused suggestion into view
  useEffect(() => {
    if (instrFocusedIdx >= 0) instrItemRefs.current[instrFocusedIdx]?.scrollIntoView({ block: 'nearest' });
  }, [instrFocusedIdx]);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (instrDropRef.current && !instrDropRef.current.contains(e.target as Node)) {
        setInstrDropOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { fetchAllTrades(); }, []);

  useEffect(() => {
    fetch('/api/users?page=1')
      .then(r => r.json())
      .then((data: any) => {
        const map: Record<string, JournalUser> = {};
        for (const u of (data.data ?? [])) {
          if (!u.zerodha_user_id) continue;
          map[u.zerodha_user_id] = { zerodha_user_id: u.zerodha_user_id, name: u.name ?? null };
        }
        setActiveUsers(map);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const allInstruments = [...new Set(allTrades.map(t => t.instrument))];
    if (allInstruments.length > 0) fetchQuotes(allInstruments);
  }, [allTrades]);

  async function fetchAllTrades() {
    setLoading(true);
    try {
      const res = await fetch('/api/trade-journal');
      const data = await res.json() as any;
      setAllTrades(data.data || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  async function fetchQuotes(instruments: string[]) {
    setQuotesLoading(true);
    try {
      const result: typeof quotes = {};

      // Instruments explicitly stored with -BE suffix → fetch directly as NSE:SYMBOL-BE
      const beInstruments  = instruments.filter(i => i.endsWith('-BE'));
      // All others → try -EQ first, fall back to -BE if ltp is null
      const eqInstruments  = instruments.filter(i => !i.endsWith('-BE'));

      if (eqInstruments.length > 0) {
        const r1 = await fetch('/api/fyers/quotes', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols: eqInstruments.map(i => `NSE:${i}-EQ`) }),
        });
        if (r1.ok) {
          const d1 = await r1.json() as any;
          Object.assign(result, d1.data || {});
          // Retry failed EQ lookups with -BE
          const beRetry = eqInstruments.filter(i => { const q = result[`NSE:${i}-EQ`]; return !q || q.lp == null; });
          if (beRetry.length > 0) {
            const r2 = await fetch('/api/fyers/quotes', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ symbols: beRetry.map(i => `NSE:${i}-BE`) }),
            });
            if (r2.ok) {
              const d2 = await r2.json() as any;
              for (const i of beRetry) {
                const q = d2.data?.[`NSE:${i}-BE`];
                if (q?.lp != null) result[`NSE:${i}-EQ`] = q;
              }
            }
          }
        }
      }

      if (beInstruments.length > 0) {
        const r3 = await fetch('/api/fyers/quotes', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols: beInstruments.map(i => `NSE:${i}`) }),
        });
        if (r3.ok) {
          const d3 = await r3.json() as any;
          Object.assign(result, d3.data || {});
        }
      }

      setQuotes(result);
    } catch { /* silent */ }
    finally { setQuotesLoading(false); }
  }

  // ── Client-side filtering — all active filters applied together
  const filteredTrades = useMemo(() => {
    return allTrades.filter(t => {
      if (status === 'open'   && t.sell_date)  return false;
      if (status === 'closed' && !t.sell_date) return false;
      if (selectedMethods.size  > 0 && !selectedMethods.has(t.method))   return false;
      if (selectedAccounts.size > 0 && !selectedAccounts.has(t.account)) return false;
      if (instrumentFilter.trim()) {
        const q = instrumentFilter.trim().toLowerCase();
        if (!t.instrument.toLowerCase().includes(q)) return false;
      }
      const dateVal = dateField === 'buy' ? t.buy_date : t.sell_date;
      if (dateFrom && (!dateVal || dateVal < dateFrom)) return false;
      if (dateTo   && (!dateVal || dateVal > dateTo))   return false;
      return true;
    });
  }, [allTrades, status, selectedMethods, selectedAccounts, instrumentFilter, dateFrom, dateTo, dateField]);

  // ── All filtered trades mapped for analytics — open positions use LTP + today
  const chartTrades = useMemo((): EquityTrade[] => {
    const today = new Date().toISOString().slice(0, 10);

    const raw: EquityTrade[] = filteredTrades
      .filter(t => t.buy_date)
      .map(t => {
        const isOpen         = !t.sell_date;
        const ltp            = isOpen ? (quotes[fyersKey(t.instrument)]?.lp ?? null) : null;
        const effectivePrice = isOpen ? (ltp ?? t.buy_price) : (t.sell_price ?? t.buy_price);
        return {
          id:         t.id,
          stock:      t.instrument,
          entry_date: t.buy_date  ?? '',
          exit_date:  t.sell_date ?? today,
          pnl:          (effectivePrice - t.buy_price) * t.qty,
          positionSize: t.buy_price * t.qty,
          isOpen,
        };
      });

    if (!grouped) return raw;

    // Aggregate by instrument: sum PnL, earliest entry, latest exit
    const groups = new Map<string, EquityTrade[]>();
    for (const t of raw) {
      if (!groups.has(t.stock)) groups.set(t.stock, []);
      groups.get(t.stock)!.push(t);
    }
    return Array.from(groups.entries()).map(([stock, rows]) => ({
      id:         rows[0].id,
      stock,
      entry_date: rows.reduce((m, r) => r.entry_date < m ? r.entry_date : m, rows[0].entry_date),
      exit_date:  rows.reduce((m, r) => r.exit_date  > m ? r.exit_date  : m, rows[0].exit_date),
      pnl:          Math.round(rows.reduce((s, r) => s + r.pnl, 0)),
      positionSize: Math.round(rows.reduce((s, r) => s + (r.positionSize ?? 0), 0)),
      isOpen:       rows.some(r => r.isOpen),
    }));
  }, [filteredTrades, quotes, grouped]);

  const openPositions = useMemo((): OpenPosition[] => {
    return filteredTrades
      .filter(t => !t.sell_date)
      .map(t => {
        const ltp = quotes[fyersKey(t.instrument)]?.lp ?? null;
        return {
          id:            t.id,
          stock:         t.instrument,
          entry_date:    t.buy_date ?? '',
          entry_price:   t.buy_price,
          current_price: ltp ?? t.buy_price,
          target_price:  t.sell_price ?? t.buy_price * 1.15,
          stop_loss:     t.stop_loss  ?? t.buy_price * 0.90,
          quantity:      t.qty,
        };
      });
  }, [filteredTrades, quotes]);

  // ── Compute derived values
  const computedRows = useMemo((): DisplayRow[] => {
    const totalInv = filteredTrades.reduce((s, t) => s + t.qty * t.buy_price, 0);
    return filteredTrades.map(t => {
      const isOpen     = !t.sell_date;
      const ltp        = quotes[fyersKey(t.instrument)]?.lp  ?? null;
      const day_change = isOpen ? (quotes[fyersKey(t.instrument)]?.chp ?? null) : null;
      const currPrice  = isOpen ? (ltp ?? t.buy_price) : (t.sell_price ?? t.buy_price);
      const invested   = t.qty * t.buy_price;
      const curr_value = t.qty * currPrice;
      const pnl        = curr_value - invested;
      const pnl_pct    = invested > 0 ? (pnl / invested) * 100 : 0;
      const hold_days  = computeHoldDays(t.buy_date, t.sell_date);
      const holdYrs    = hold_days / 365;
      const cagr_pct   = holdYrs > 0 && t.buy_price > 0
        ? (Math.pow(currPrice / t.buy_price, 1 / holdYrs) - 1) * 100
        : null;
      const stop_loss_pct = t.stop_loss != null && ltp != null && ltp > 0
        ? ((t.stop_loss - ltp) / ltp) * 100
        : null;
      const target_pct = t.sell_price != null && t.buy_price > 0
        ? ((t.sell_price - t.buy_price) / t.buy_price) * 100
        : null;
      const remaining_profit_pct = isOpen && t.sell_price != null && ltp && ltp > 0
        ? ((t.sell_price - ltp) / ltp) * 100
        : null;
      const fy         = computeFY(t.buy_date);
      const weight_pct = totalInv > 0 ? (invested / totalInv) * 100 : 0;
      return {
        ...t, status: isOpen ? 'Open' : 'Closed',
        ltp, day_change, invested, curr_value, pnl, pnl_pct,
        cagr_pct, stop_loss_pct, hold_days, target_pct, remaining_profit_pct, fy, weight_pct,
      };
    });
  }, [filteredTrades, quotes]);

  // ── Group + sort
  const displayRows = useMemo((): DisplayRow[] => {
    let rows: DisplayRow[];
    if (grouped) {
      const groups = new Map<string, DisplayRow[]>();
      for (const row of computedRows) {
        if (!groups.has(row.instrument)) groups.set(row.instrument, []);
        groups.get(row.instrument)!.push(row);
      }
      const totalInv = computedRows.reduce((s, r) => s + r.invested, 0);
      rows = Array.from(groups.entries()).map(([instrument, gRows]) => {
        const totalQty   = gRows.reduce((s, r) => s + r.qty, 0);
        const totalInvGrp = gRows.reduce((s, r) => s + r.invested, 0);
        const wAvgCost   = totalQty > 0 ? totalInvGrp / totalQty : 0;
        const totalCurr  = gRows.reduce((s, r) => s + r.curr_value, 0);
        const totalPnl   = totalCurr - totalInvGrp;
        const pnlPct     = totalInvGrp > 0 ? (totalPnl / totalInvGrp) * 100 : 0;
        const avgHold    = gRows.length > 0 ? gRows.reduce((s, r) => s + r.hold_days, 0) / gRows.length : 0;
        const methods    = [...new Set(gRows.map(r => r.method))].join(', ');
        const accounts   = [...new Set(gRows.map(r => r.account))].join(', ');
        const statuses   = [...new Set(gRows.map(r => r.status))];
        const gStatus    = statuses.length === 1 ? statuses[0] : 'Mixed';
        const weight     = totalInv > 0 ? (totalInvGrp / totalInv) * 100 : 0;
        const ltpNum     = gRows.reduce((s, r) => s + (r.ltp ?? wAvgCost) * r.qty, 0);
        const avgLtp     = totalQty > 0 ? ltpNum / totalQty : null;
        // Weighted avg day change across open positions that have a valid chp
        const openWithChp = gRows.filter(r => r.status === 'Open' && r.day_change != null);
        const chpInvTotal = openWithChp.reduce((s, r) => s + r.invested, 0);
        const avgDayChange = chpInvTotal > 0
          ? openWithChp.reduce((s, r) => s + r.day_change! * r.invested, 0) / chpInvTotal
          : null;
        return {
          id: gRows[0].id,
          method: methods, account: accounts, instrument,
          qty: totalQty, buy_price: wAvgCost,
          sell_price: null, stop_loss: null, buy_date: null, sell_date: null,
          status: gStatus as any,
          ltp: avgLtp, day_change: avgDayChange,
          invested: totalInvGrp, curr_value: totalCurr,
          pnl: totalPnl, pnl_pct: pnlPct,
          cagr_pct: null, stop_loss_pct: null,
          hold_days: avgHold,
          target_pct: null, remaining_profit_pct: null,
          fy: '', weight_pct: weight,
        };
      });
    } else {
      rows = computedRows;
    }
    return [...rows].sort((a, b) => {
      const va = (a as any)[sortCol];
      const vb = (b as any)[sortCol];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      const cmp = typeof va === 'string' ? va.localeCompare(vb) : (Number(va) - Number(vb));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [computedRows, grouped, sortCol, sortDir]);

  // ── Summary — reflects the active filters
  const summary = useMemo(() => {
    function calc(rows: DisplayRow[]) {
      const invested   = rows.reduce((s, r) => s + r.invested, 0);
      const curr_value = rows.reduce((s, r) => s + r.curr_value, 0);
      const pnl        = curr_value - invested;
      const pnl_pct    = invested > 0 ? (pnl / invested) * 100 : 0;
      return { invested, curr_value, pnl, pnl_pct, count: rows.length };
    }
    return { overall: calc(computedRows), profits: calc(computedRows.filter(r => r.pnl > 0)) };
  }, [computedRows]);

  // ── Pagination
  // Reset to page 1 whenever the sorted display list changes
  useEffect(() => { setCurrentPage(1); }, [displayRows]);

  const totalPages = Math.max(1, Math.ceil(displayRows.length / pageSize));
  const pagedRows  = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return displayRows.slice(start, start + pageSize);
  }, [displayRows, currentPage, pageSize]);

  // ── Handlers
  function handleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }
  function toggleMethod(m: string) {
    setSelectedMethods(p => { const n = new Set(p); n.has(m) ? n.delete(m) : n.add(m); return n; });
  }
  function toggleAccount(a: string) {
    setSelectedAccounts(p => { const n = new Set(p); n.has(a) ? n.delete(a) : n.add(a); return n; });
  }
  function selectInstrument(instrument: string) {
    setInstrumentFilter(instrument);
    setInstrDropOpen(false);
    setInstrFocusedIdx(-1);
  }
  function handleInstrKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!instrDropOpen && instrSuggestions.length > 0) setInstrDropOpen(true);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setInstrDropOpen(true);
      setInstrFocusedIdx(i => Math.min(i + 1, instrSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setInstrFocusedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const sel = instrFocusedIdx >= 0 ? instrSuggestions[instrFocusedIdx] : instrSuggestions[0];
      if (sel) selectInstrument(sel);
    } else if (e.key === 'Escape') {
      setInstrDropOpen(false);
    }
  }
  function sortArrow(col: string) {
    if (sortCol !== col) return <span className="text-on-surface-variant/30 ml-0.5">↕</span>;
    return <span className="text-primary ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  // ── Cell renderer
  function renderCell(row: DisplayRow, key: string): React.ReactNode {
    switch (key) {
      case 'method':
        return (
          <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold rounded-sm bg-primary/10 text-primary border border-primary/20">
            {row.method}
          </span>
        );
      case 'account':
        return <span className="text-on-surface-variant font-mono">{row.account}</span>;
      case 'instrument': {
        const parseAccounts = (acct: string) =>
          acct.split(',').map(a => a.trim()).filter(Boolean);
        return (
          <span className="flex items-center gap-1 group/instr">
            {(() => {
              const isOpenRow = row.status === 'Open' || row.status === 'Mixed';
              const alertDown  = isOpenRow && row.pnl_pct <= -5;
              const highlight  = status === 'all' && isOpenRow && !alertDown;
              return (
                <span className={`font-semibold ${
                  alertDown  ? 'bg-tertiary/20 text-tertiary px-1.5 py-0.5 rounded-sm' :
                  highlight  ? 'bg-secondary/15 text-secondary px-1.5 py-0.5 rounded-sm' :
                  'text-on-surface'
                }`}>
                  {row.instrument}
                </span>
              );
            })()}
            <span className="flex gap-0.5 opacity-0 group-hover/instr:opacity-100 transition-opacity ml-1">
              {!grouped && (
                <>
                  <button type="button"
                    onClick={e => { e.stopPropagation(); setEditModal(row); }}
                    className="inline-flex items-center justify-center w-5 h-5 bg-primary/15 text-primary border border-primary/30 rounded-sm hover:bg-primary/30 transition-colors"
                    title="Edit trade">
                    <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>edit</span>
                  </button>
                  {/* delete button hidden — re-enable when needed
                  <button type="button"
                    onClick={e => { e.stopPropagation(); setDeleteConfirm(row); }}
                    className="inline-flex items-center justify-center w-5 h-5 bg-error/15 text-error border border-error/30 rounded-sm hover:bg-error/30 transition-colors"
                    title="Delete trade">
                    <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>delete</span>
                  </button>
                  */}
                </>
              )}
              {(status === 'open' || (status === 'all' && (row.status === 'Open' || row.status === 'Mixed'))) && (
                <>
                  <button type="button"
                    onClick={e => { e.stopPropagation(); setOrderModal({ type: 'BUY', instrument: row.instrument, accounts: parseAccounts(row.account) }); }}
                    className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold bg-secondary/20 text-secondary border border-secondary/40 rounded-sm hover:bg-secondary/40 transition-colors leading-none">
                    B
                  </button>
                  <button type="button"
                    onClick={e => { e.stopPropagation(); setOrderModal({ type: 'SELL', instrument: row.instrument, accounts: parseAccounts(row.account) }); }}
                    className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold bg-tertiary/20 text-tertiary border border-tertiary/40 rounded-sm hover:bg-tertiary/40 transition-colors leading-none">
                    S
                  </button>
                </>
              )}
            </span>
          </span>
        );
      }
      case 'day_change':
        if (row.day_change == null) return <span className="text-on-surface-variant/40">—</span>;
        return (
          <span className={clsPnl(row.day_change)}>
            {row.day_change >= 0 ? '▲' : '▼'} {Math.abs(row.day_change).toFixed(2)}%
          </span>
        );
      case 'invested':   return <span className="font-mono text-on-surface">₹{fmtAmt(row.invested)}</span>;
      case 'curr_value': return <span className="font-mono text-on-surface">₹{fmtAmt(row.curr_value)}</span>;
      case 'pnl': {
        const sign = row.pnl >= 0 ? '+' : '';
        const full = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(row.pnl));
        return <span className={`font-mono font-semibold ${clsPnl(row.pnl)}`}>{sign}{full}</span>;
      }
      case 'pnl_pct':
        return <span className={`font-mono ${clsPnl(row.pnl_pct)}`}>{fmtPct(row.pnl_pct)}</span>;
      case 'cagr_pct':
        return <span className={`font-mono ${row.cagr_pct != null ? clsPnl(row.cagr_pct) : 'text-on-surface-variant/40'}`}>{fmtPct(row.cagr_pct)}</span>;
      case 'stop_loss_pct': {
        if (row.stop_loss_pct == null) return <span className="font-mono text-on-surface-variant/40">—</span>;
        const nearSL = row.stop_loss_pct >= -5;
        return (
          <span className={`font-mono px-1.5 py-0.5 rounded-sm ${nearSL ? 'bg-error/15 text-error font-semibold' : 'text-on-surface-variant'}`}>
            {row.stop_loss_pct.toFixed(1)}%
          </span>
        );
      }
      case 'qty':
        return <span className="font-mono text-on-surface">{new Intl.NumberFormat('en-IN').format(row.qty)}</span>;
      case 'buy_price':  return <span className="font-mono text-on-surface">{fmtPrice(row.buy_price)}</span>;
      case 'ltp':
        if (quotesLoading && row.ltp == null) return <span className="text-on-surface-variant/40 animate-pulse">…</span>;
        return <span className="font-mono text-on-surface">{fmtPrice(row.ltp)}</span>;
      case 'sell_price': return <span className="font-mono text-on-surface-variant">{fmtPrice(row.sell_price)}</span>;
      case 'stop_loss':  return <span className="font-mono text-on-surface-variant">{fmtPrice(row.stop_loss)}</span>;
      case 'hold_days':  return <span className="font-mono text-on-surface-variant">{fmtDays(row.hold_days)}</span>;
      case 'target_pct':
        return <span className={`font-mono ${row.target_pct != null ? clsPnl(row.target_pct) : 'text-on-surface-variant/40'}`}>{fmtPct(row.target_pct)}</span>;
      case 'remaining_profit_pct':
        return <span className={`font-mono ${row.remaining_profit_pct != null ? clsPnl(row.remaining_profit_pct) : 'text-on-surface-variant/40'}`}>{fmtPct(row.remaining_profit_pct)}</span>;
      case 'buy_date':  return <span className="text-on-surface-variant font-mono">{fmtDate(row.buy_date)}</span>;
      case 'sell_date': return <span className="text-on-surface-variant font-mono">{fmtDate(row.sell_date)}</span>;
      case 'status': {
        const cls = row.status === 'Open'
          ? 'bg-secondary/15 text-secondary border-secondary/30'
          : row.status === 'Mixed'
          ? 'bg-tertiary/15 text-tertiary border-tertiary/30'
          : 'bg-surface-container-high text-on-surface-variant border-outline-variant';
        return <span className={`inline-block px-1.5 py-0.5 text-[10px] font-bold rounded-sm border ${cls}`}>{row.status}</span>;
      }
      case 'fy':
        return <span className="text-on-surface-variant font-mono text-[10px]">{row.fy || '—'}</span>;
      case 'weight_pct':
        return <span className="font-mono text-on-surface-variant">{row.weight_pct > 0 ? `${row.weight_pct.toFixed(1)}%` : '—'}</span>;
      default: return null;
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-5 space-y-4">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-on-surface">Trade Journal</h1>
              <p className="text-sm text-on-surface-variant mt-0.5">
                {allTrades.length} total records
                {quotesLoading && <span className="ml-2 text-primary animate-pulse">• Fetching live prices…</span>}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Journal / Analytics toggle */}
              <div className="flex border border-outline-variant overflow-hidden rounded-sm">
                {(['journal', 'analytics'] as const).map(v => (
                  <button key={v} onClick={() => setView(v)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                      view === v ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-high'
                    }`}>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                      {v === 'journal' ? 'table_rows' : 'show_chart'}
                    </span>
                    {v}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setCloseModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-surface-container border border-outline-variant text-on-surface rounded-sm hover:bg-surface-container-high transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>price_change</span>
                Close Position
              </button>
              <button
                onClick={() => setAddModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-primary/15 border border-primary/40 text-primary rounded-sm hover:bg-primary/25 transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
                Add Position
              </button>
              <button
                onClick={fetchAllTrades}
                disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-surface-container border border-outline-variant text-on-surface rounded-sm hover:bg-surface-container-high transition-colors disabled:opacity-50"
              >
                <span className={`material-symbols-outlined ${loading ? 'animate-spin' : ''}`} style={{ fontSize: '16px' }}>refresh</span>
                Refresh
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-surface-container border border-outline-variant rounded-sm px-4 py-3 flex flex-wrap items-center gap-3">
            {/* Status toggle */}
            <div className="flex rounded-sm overflow-hidden border border-outline-variant">
              {(['all', 'open', 'closed'] as const).map(s => (
                <button key={s} onClick={() => setStatus(s)}
                  className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                    status === s ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-high'
                  }`}>
                  {s}
                </button>
              ))}
            </div>

            {/* Methods */}
            <MultiSelect label="Method" options={allMethods} selected={selectedMethods} onToggle={toggleMethod} />

            {/* Accounts */}
            <MultiSelect label="Account" options={allAccounts} selected={selectedAccounts} onToggle={toggleAccount} labelMap={accountLabelMap} />

            {/* Instrument autocomplete */}
            <div ref={instrDropRef} className="relative">
              <div className={`flex items-center gap-1.5 bg-surface-container border rounded-sm px-2 py-1.5 transition-colors ${instrDropOpen ? 'border-primary' : 'border-outline-variant'}`}>
                <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: '14px' }}>search</span>
                <input
                  ref={instrInputRef}
                  value={instrumentFilter}
                  onChange={e => { setInstrumentFilter(e.target.value); setInstrDropOpen(true); }}
                  onFocus={() => { if (instrSuggestions.length > 0) setInstrDropOpen(true); }}
                  onKeyDown={handleInstrKeyDown}
                  placeholder="Instrument…"
                  className="bg-transparent text-xs text-on-surface placeholder:text-on-surface-variant/40 outline-none w-28"
                />
                {instrumentFilter && (
                  <button onClick={() => { setInstrumentFilter(''); setInstrDropOpen(false); instrInputRef.current?.focus(); }}
                    className="text-on-surface-variant hover:text-on-surface">
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
                  </button>
                )}
              </div>

              {instrDropOpen && instrSuggestions.length > 0 && (
                <div className="absolute top-full left-0 mt-1 z-30 w-44 bg-surface-container border border-outline-variant rounded-sm shadow-lg max-h-52 overflow-y-auto">
                  {instrSuggestions.map((instr, i) => (
                    <button
                      key={instr}
                      ref={el => { instrItemRefs.current[i] = el; }}
                      type="button"
                      onClick={() => selectInstrument(instr)}
                      onMouseEnter={() => setInstrFocusedIdx(i)}
                      className={`w-full text-left px-3 py-1.5 text-xs font-mono font-semibold transition-colors border-l-2 ${
                        instrFocusedIdx === i
                          ? 'bg-surface-container-high border-l-primary text-on-surface'
                          : 'border-l-transparent text-on-surface hover:bg-surface-container-high'
                      }`}
                    >
                      {instr}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Grouped toggle */}
            <label className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant cursor-pointer ml-1">
              <div
                onClick={() => setGrouped(g => !g)}
                className={`w-8 h-4 rounded-full transition-colors cursor-pointer ${grouped ? 'bg-primary' : 'bg-outline-variant'}`}
              >
                <div className={`w-3.5 h-3.5 rounded-full bg-white shadow-sm mt-0.25 transition-transform ${grouped ? 'translate-x-4' : 'translate-x-0.5'}`} style={{ marginTop: '1px' }} />
              </div>
              Grouped
            </label>

            {/* Date range filter */}
            <div className="flex items-center gap-1.5">
              <div className="flex border border-outline-variant overflow-hidden rounded-sm">
                {(['buy', 'sell'] as const).map(f => (
                  <button key={f} onClick={() => setDateField(f)}
                    className={`px-2.5 py-1 text-xs font-semibold uppercase tracking-wider transition-colors ${
                      dateField === f ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-high'
                    }`}>
                    {f}
                  </button>
                ))}
              </div>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="bg-surface-container border border-outline-variant text-on-surface px-2 py-1 text-xs focus:outline-none focus:border-primary [color-scheme:dark] w-32"
              />
              <span className="text-on-surface-variant text-xs">–</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="bg-surface-container border border-outline-variant text-on-surface px-2 py-1 text-xs focus:outline-none focus:border-primary [color-scheme:dark] w-32"
              />
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(''); setDateTo(''); }}
                  className="text-on-surface-variant hover:text-on-surface transition-colors"
                  title="Clear date filter">
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
                </button>
              )}
            </div>

            <span className="ml-auto text-xs text-on-surface-variant">
              {displayRows.length} rows
              {selectedMethods.size > 0 || selectedAccounts.size > 0 || instrumentFilter || status !== 'all' || dateFrom || dateTo
                ? ` (filtered from ${allTrades.length})`
                : ''}
            </span>
          </div>

          {view === 'analytics' ? (
            /* ── Analytics view ───────────────────────────────────────────── */
            <div className="space-y-4">

              {/* Analytics sub-tabs */}
              <div className="flex border-b border-outline-variant">
                {([
                  { key: 'performance', label: 'Performance', icon: 'show_chart'     },
                  { key: 'risk',        label: 'Risk',        icon: 'shield'          },
                  { key: 'time',        label: 'Time',        icon: 'calendar_month'  },
                  { key: 'open',        label: 'Open Positions', icon: 'pending'      },
                ] as const).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setAnalyticsTab(tab.key)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors -mb-px ${
                      analyticsTab === tab.key
                        ? 'border-primary text-primary'
                        : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline-variant'
                    }`}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Performance tab */}
              {analyticsTab === 'performance' && (
                <div className="space-y-4">
                  {/* Row 1: Equity Curve + Trades list */}
                  <div className="grid grid-cols-2 gap-4 items-start">
                    <EquityCurve
                      trades={chartTrades}
                      initialCapital={initialCapital}
                      compact
                      showRecentTrades={false}
                      onCapitalChange={v => {
                        setInitialCapital(v);
                        localStorage.setItem('tj_initial_capital', String(v));
                      }}
                    />

                    <div className="bg-surface-container border border-outline-variant">
                      <div className="px-4 py-2.5 border-b border-outline-variant flex items-center gap-2">
                        <span className="text-sm font-bold text-on-surface">Trades</span>
                        <span className="text-[10px] text-on-surface-variant/50">{chartTrades.length} total</span>
                        <span className="ml-auto text-[10px] text-on-surface-variant/50">
                          {chartTrades.filter(t => t.isOpen).length} open · {chartTrades.filter(t => !t.isOpen).length} closed
                        </span>
                      </div>
                      {chartTrades.length === 0 ? (
                        <div className="px-4 py-8 text-xs text-on-surface-variant text-center">No trades in current filter.</div>
                      ) : (
                        <div className="divide-y divide-outline-variant/40 max-h-[340px] overflow-y-auto">
                          {[...chartTrades]
                            .sort((a, b) => b.pnl - a.pnl)
                            .map(t => {
                              const isWin = t.pnl >= 0;
                              const sign  = t.pnl >= 0 ? '+' : '';
                              const fmt   = (n: number) => { const a = Math.abs(n); if (a >= 1e7) return '₹'+(a/1e7).toFixed(2)+'Cr'; if (a >= 1e5) return '₹'+(a/1e5).toFixed(1)+'L'; if (a >= 1e3) return '₹'+(a/1e3).toFixed(1)+'K'; return '₹'+a.toLocaleString('en-IN'); };
                              return (
                                <div key={t.id} className="flex items-center justify-between px-4 py-2 text-xs hover:bg-surface-container-high transition-colors">
                                  <div className="min-w-0">
                                    <span className="font-bold text-on-surface font-mono block truncate">{t.stock}</span>
                                    <span className="text-on-surface-variant/60 text-[10px]">
                                      {t.entry_date}
                                      {t.isOpen
                                        ? <span className="ml-1.5 px-1 py-0.5 bg-secondary/15 text-secondary border border-secondary/30 rounded-sm font-label-caps uppercase text-[9px]">Open</span>
                                        : <> → {t.exit_date}</>
                                      }
                                    </span>
                                  </div>
                                  <span className={`font-mono font-bold ml-3 shrink-0 ${isWin ? 'text-secondary' : 'text-tertiary'}`}>
                                    {sign}{fmt(t.pnl)}
                                  </span>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  </div>

                  <StockPnL trades={chartTrades} />
                  <WinRateChart trades={chartTrades} />
                  <ReturnDistribution trades={chartTrades} />
                </div>
              )}

              {/* Risk tab */}
              {analyticsTab === 'risk' && (
                <div className="space-y-4">
                  <DrawdownChart trades={chartTrades} initialCapital={initialCapital} />
                  <PositionSizeBubble trades={chartTrades} initialCapital={initialCapital} />
                  <ReturnsHeatmap trades={chartTrades} />
                </div>
              )}

              {/* Time tab */}
              {analyticsTab === 'time' && (
                <div className="space-y-4">
                  <MonthlyPnL trades={chartTrades} />
                  <EntryMonthAnalysis trades={chartTrades} />
                  <TradeOverlapTimeline trades={chartTrades} initialCapital={initialCapital} />
                  <HoldingPeriodChart trades={chartTrades} />
                </div>
              )}

              {/* Open Positions tab */}
              {analyticsTab === 'open' && (
                <OpenPositionsPanel positions={openPositions} initialCapital={initialCapital} />
              )}

            </div>
          ) : (
          <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4">
            <SummaryCard title="Profits Only" count={summary.profits.count}
              invested={summary.profits.invested} currValue={summary.profits.curr_value}
              pnl={summary.profits.pnl} pnlPct={summary.profits.pnl_pct} />
            <SummaryCard title="Overall" count={summary.overall.count}
              invested={summary.overall.invested} currValue={summary.overall.curr_value}
              pnl={summary.overall.pnl} pnlPct={summary.overall.pnl_pct} />
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <span className="material-symbols-outlined animate-spin text-primary" style={{ fontSize: '32px' }}>progress_activity</span>
            </div>
          ) : displayRows.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-on-surface-variant text-sm">
              No records match the current filters.
            </div>
          ) : (
            <div className="bg-surface-container border border-outline-variant rounded-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="text-xs w-max min-w-full">
                  <thead>
                    <tr className="bg-surface-container-high border-b border-outline-variant">
                      {COLS.map(col => (
                        <th
                          key={col.key}
                          onClick={() => handleSort(col.key)}
                          style={{ minWidth: col.w }}
                          className={`px-2 py-2 font-bold uppercase tracking-wider text-on-surface-variant cursor-pointer select-none whitespace-nowrap hover:text-on-surface hover:bg-surface-container transition-colors ${col.right ? 'text-right' : 'text-left'}`}
                        >
                          {col.label}{sortArrow(col.key)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRows.map((row, i) => (
                      <tr
                        key={`${row.instrument}-${row.id}-${i}`}
                        className="border-b border-outline-variant/50 hover:bg-surface-container-high/60 transition-colors"
                      >
                        {COLS.map(col => (
                          <td
                            key={col.key}
                            className={`px-2 py-1.5 whitespace-nowrap ${col.right ? 'text-right' : 'text-left'}`}
                          >
                            {renderCell(row, col.key)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination bar */}
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-outline-variant bg-surface-container-high/40">
                {/* Row count */}
                <span className="text-xs text-on-surface-variant min-w-[120px]">
                  {displayRows.length === 0 ? '0 rows' : (
                    <>
                      {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, displayRows.length)}
                      {' '}of {displayRows.length}
                    </>
                  )}
                </span>

                {/* Page navigation */}
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}
                      className="px-1.5 py-1 text-xs text-on-surface-variant disabled:opacity-30 hover:text-on-surface transition-colors">«</button>
                    <button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}
                      className="px-1.5 py-1 text-xs text-on-surface-variant disabled:opacity-30 hover:text-on-surface transition-colors">‹</button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                      .reduce<(number | '…')[]>((acc, p, idx, arr) => {
                        if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('…');
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((p, i) =>
                        p === '…'
                          ? <span key={`e${i}`} className="px-1 text-xs text-on-surface-variant/50">…</span>
                          : <button key={p} onClick={() => setCurrentPage(p as number)}
                              className={`w-6 h-6 text-xs rounded-sm transition-colors ${
                                currentPage === p
                                  ? 'bg-primary text-on-primary font-bold'
                                  : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                              }`}>{p}</button>
                      )}
                    <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}
                      className="px-1.5 py-1 text-xs text-on-surface-variant disabled:opacity-30 hover:text-on-surface transition-colors">›</button>
                    <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}
                      className="px-1.5 py-1 text-xs text-on-surface-variant disabled:opacity-30 hover:text-on-surface transition-colors">»</button>
                  </div>
                )}

                {/* Page size selector */}
                <div className="flex items-center gap-1.5 min-w-[120px] justify-end">
                  <span className="text-xs text-on-surface-variant">Per page:</span>
                  {[25, 50, 75, 100].map(n => (
                    <button key={n} onClick={() => { setPageSize(n); setCurrentPage(1); }}
                      className={`w-8 h-6 text-xs rounded-sm transition-colors ${
                        pageSize === n
                          ? 'bg-primary text-on-primary font-bold'
                          : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                      }`}>{n}</button>
                  ))}
                </div>
              </div>
            </div>
          )}
          </>
          )}

        </div>
      </div>

      {/* Close Position modal */}
      {closeModal && (
        <ClosePositionModal
          allTrades={allTrades}
          activeUsers={activeUsers}
          onClose={() => setCloseModal(false)}
          onSaved={() => { setCloseModal(false); fetchAllTrades(); }}
        />
      )}

      {/* Add modal */}
      {addModal && (
        <AddTradeModal
          allMethods={allMethods}
          allAccounts={allAccounts}
          onClose={() => setAddModal(false)}
          onSaved={() => { setAddModal(false); fetchAllTrades(); }}
        />
      )}

      {/* Delete confirm */}
      {deleteConfirm && !grouped && (
        <DeleteTradeConfirm
          row={deleteConfirm}
          onClose={() => setDeleteConfirm(null)}
          onDeleted={() => { setDeleteConfirm(null); fetchAllTrades(); }}
        />
      )}

      {/* Edit modal */}
      {editModal && !grouped && (
        <EditTradeModal
          row={editModal}
          allMethods={allMethods}
          allAccounts={allAccounts}
          onClose={() => setEditModal(null)}
          onSaved={() => { setEditModal(null); fetchAllTrades(); }}
        />
      )}

      {/* Order modals */}
      {orderModal?.type === 'SELL' && (
        <JournalSellModal
          instrument={orderModal.instrument}
          accounts={orderModal.accounts}
          ltp={quotes[`NSE:${orderModal.instrument}-EQ`]?.lp ?? null}
          chp={quotes[`NSE:${orderModal.instrument}-EQ`]?.chp ?? null}
          userMap={activeUsers}
          onClose={() => setOrderModal(null)}
          onToggle={() => setOrderModal(m => m ? { ...m, type: 'BUY' } : null)}
        />
      )}
      {orderModal?.type === 'BUY' && (
        <JournalBuyModal
          instrument={orderModal.instrument}
          accounts={orderModal.accounts}
          ltp={quotes[`NSE:${orderModal.instrument}-EQ`]?.lp ?? null}
          chp={quotes[`NSE:${orderModal.instrument}-EQ`]?.chp ?? null}
          userMap={activeUsers}
          onClose={() => setOrderModal(null)}
          onToggle={() => setOrderModal(m => m ? { ...m, type: 'SELL' } : null)}
        />
      )}
    </div>
  );
}
