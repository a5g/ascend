import { useState, useMemo } from 'react';
import {
  Chart as ChartJS,
  ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend,
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend);

/* ─── types ─────────────────────────────────────────────────────── */

export interface OpenPosition {
  id: number | string;
  stock: string;
  entry_date: string;
  entry_price: number;
  current_price: number;
  target_price: number;
  stop_loss: number;
  quantity: number;
}

interface EnrichedPosition extends OpenPosition {
  invested: number; currentValue: number;
  unrealizedPnl: number; unrealizedPct: number;
  daysHeld: number; allocPct: number;
  progressToTarget: number; distToTarget: number; distToStop: number;
  riskReward: number;
  status: 'on-track' | 'near-target' | 'target-hit' | 'near-stop' | 'stop-hit';
}

/* ─── constants ─────────────────────────────────────────────────── */

const WIN_COLOR  = '#1D9E75';
const WIN_BG     = 'rgba(29,158,117,0.18)';
const LOSS_COLOR = '#E24B4A';
const LOSS_BG    = 'rgba(226,75,74,0.18)';
const WARN_COLOR = '#EF9F27';
const PURPLE     = '#534AB7';
const GRID_COLOR = 'rgba(136,135,128,0.07)';
const SURFACE_H  = '#1C2333'; // dark surface-container-high

const STOCK_PALETTE = [
  '#534AB7','#1D9E75','#EF9F27','#0EA5E9',
  '#A855F7','#F43F5E','#10B981','#E24B4A','#64748B','#DC2626',
];

const SORT_OPTIONS = [
  { key: 'progress'  , label: 'Closest to target' },
  { key: 'pnl_desc'  , label: 'Best unrealized'   },
  { key: 'pnl_asc'   , label: 'Most at risk'       },
  { key: 'days_desc' , label: 'Held longest'       },
  { key: 'alloc_desc', label: 'Largest position'   },
] as const;
type SortKey = typeof SORT_OPTIONS[number]['key'];

const TAB_OPTIONS = [
  { key: 'gauges', label: 'Progress gauges' },
  { key: 'pnl'   , label: 'Unrealized P&L'  },
  { key: 'alloc' , label: 'Allocation'       },
  { key: 'days'  , label: 'Days held'        },
] as const;
type TabKey = typeof TAB_OPTIONS[number]['key'];

const FILTER_OPTIONS = [
  { key: 'all'        , label: 'All'         },
  { key: 'near-target', label: 'Near target' },
  { key: 'near-stop'  , label: 'Near stop'   },
  { key: 'over-plan'  , label: 'Over plan'   },
] as const;
type FilterKey = typeof FILTER_OPTIONS[number]['key'];

/* ─── helpers ───────────────────────────────────────────────────── */

function fmt(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 100000) return '₹' + (abs / 100000).toFixed(1) + 'L';
  if (abs >= 1000)   return '₹' + (abs / 1000).toFixed(1) + 'K';
  return '₹' + Math.round(abs).toLocaleString('en-IN');
}
const fmtSigned = (n: number) => (n >= 0 ? '+' : '') + fmt(Math.abs(n));
const fmtPct    = (n: number, dp = 1) => (n >= 0 ? '+' : '') + n.toFixed(dp) + '%';
const daysSince = (d: string) => Math.round((Date.now() - new Date(d).getTime()) / 86400000);

function enrich(pos: OpenPosition, capital: number): EnrichedPosition {
  const invested      = pos.entry_price * pos.quantity;
  const currentValue  = pos.current_price * pos.quantity;
  const unrealizedPnl = currentValue - invested;
  const unrealizedPct = invested > 0 ? (unrealizedPnl / invested) * 100 : 0;
  const daysHeld      = pos.entry_date ? daysSince(pos.entry_date) : 0;
  const allocPct      = capital > 0 ? (invested / capital) * 100 : 0;

  const totalRange        = pos.target_price - pos.entry_price;
  const progressToTarget  = totalRange !== 0 ? ((pos.current_price - pos.entry_price) / totalRange) * 100 : 0;
  const distToTarget      = ((pos.target_price  - pos.current_price) / pos.current_price) * 100;
  const distToStop        = ((pos.current_price - pos.stop_loss)      / pos.current_price) * 100;
  const riskReward        = distToStop > 0 ? Math.abs(distToTarget / distToStop) : 0;

  let status: EnrichedPosition['status'] = 'on-track';
  if      (pos.current_price <= pos.stop_loss)         status = 'stop-hit';
  else if (pos.current_price >= pos.target_price)      status = 'target-hit';
  else if (distToStop < 3)                             status = 'near-stop';
  else if (progressToTarget >= 75)                     status = 'near-target';

  return { ...pos, invested, currentValue, unrealizedPnl, unrealizedPct,
    daysHeld, allocPct, progressToTarget, distToTarget, distToStop, riskReward, status };
}

function statusColor(s: EnrichedPosition['status']): string {
  if (s === 'target-hit' || s === 'near-target') return WIN_COLOR;
  if (s === 'stop-hit'   || s === 'near-stop')   return LOSS_COLOR;
  return '#888780';
}
function statusLabel(s: EnrichedPosition['status']): string {
  if (s === 'target-hit')  return 'Target hit!';
  if (s === 'near-target') return 'Near target';
  if (s === 'stop-hit')    return 'Stop hit';
  if (s === 'near-stop')   return 'Near stop';
  return 'On track';
}

/* ─── Pill ──────────────────────────────────────────────────────── */

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs border transition-colors cursor-pointer ${
        active
          ? 'bg-primary text-on-primary border-primary'
          : 'border-outline-variant text-on-surface-variant hover:text-on-surface'
      }`}
    >
      {label}
    </button>
  );
}

/* ─── MetricCard ────────────────────────────────────────────────── */

function MetricCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-surface-container-high rounded-xl p-3">
      <p className="text-[11px] text-on-surface-variant mb-1">{label}</p>
      <p className="text-lg font-medium leading-tight" style={{ color: color ?? undefined }}>
        {color ? value : <span className="text-on-surface">{value}</span>}
      </p>
      {sub && <p className="text-[10px] text-on-surface-variant mt-0.5">{sub}</p>}
    </div>
  );
}

/* ─── ProgressGauge ─────────────────────────────────────────────── */

function ProgressGauge({ pos }: { pos: EnrichedPosition }) {
  const sc       = statusColor(pos.status);
  const filledW  = Math.min(Math.max(pos.progressToTarget, 0), 100);
  const isNeg    = pos.progressToTarget < 0;
  const barColor = pos.unrealizedPnl >= 0 ? WIN_COLOR : LOSS_COLOR;

  return (
    <div style={{
      background: SURFACE_H, borderRadius: 14, padding: '14px 16px',
      border: `0.5px solid ${sc}35`,
      display: 'flex', flexDirection: 'column', gap: 10,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Status badge */}
      {pos.status !== 'on-track' && (
        <span style={{
          position: 'absolute', top: 12, right: 12,
          fontSize: 10, fontWeight: 600, padding: '2px 8px',
          borderRadius: 20, background: sc + '20',
          color: sc, border: `0.5px solid ${sc}40`,
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          {statusLabel(pos.status)}
        </span>
      )}

      {/* Stock + meta */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        gap: 8, paddingRight: pos.status !== 'on-track' ? 90 : 0 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#E8E7DF', lineHeight: 1.2 }}>
            {pos.stock}
          </div>
          <div style={{ fontSize: 11, color: '#888780', marginTop: 2 }}>
            <span>Entered {pos.entry_date}</span>
            <span style={{ marginLeft: 8, color: pos.daysHeld > 150 ? WARN_COLOR : '#888780' }}>
              · {pos.daysHeld}d held
            </span>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: pos.unrealizedPnl >= 0 ? WIN_COLOR : LOSS_COLOR }}>
            {fmtSigned(pos.unrealizedPnl)}
          </div>
          <div style={{ fontSize: 11, color: pos.unrealizedPnl >= 0 ? WIN_COLOR : LOSS_COLOR }}>
            {fmtPct(pos.unrealizedPct)}
          </div>
        </div>
      </div>

      {/* Price row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#888780' }}>
        <span>SL <b style={{ color: LOSS_COLOR }}>₹{pos.stop_loss}</b></span>
        <span>Entry <b style={{ color: '#E8E7DF' }}>₹{pos.entry_price}</b></span>
        <span>CMP <b style={{ color: barColor }}>₹{pos.current_price}</b></span>
        <span>Target <b style={{ color: WIN_COLOR }}>₹{pos.target_price}</b></span>
      </div>

      {/* Progress bar */}
      <div style={{ position: 'relative' }}>
        <div style={{
          height: 10, borderRadius: 5,
          background: 'linear-gradient(to right, rgba(226,75,74,0.20) 0%, rgba(180,178,169,0.12) 30%, rgba(29,158,117,0.20) 100%)',
          border: '0.5px solid rgba(255,255,255,0.08)',
          position: 'relative', overflow: 'visible',
        }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: filledW + '%',
            background: isNeg
              ? `linear-gradient(to right, ${LOSS_COLOR}40, ${LOSS_COLOR}20)`
              : `linear-gradient(to right, ${barColor}30, ${barColor}70)`,
            borderRadius: 5, transition: 'width 0.6s ease',
          }} />
          {/* Entry marker */}
          <div style={{ position: 'absolute', left: '0%', top: -3, bottom: -3,
            width: 2, background: '#888780', borderRadius: 2 }} />
          {/* CMP cursor */}
          <div style={{
            position: 'absolute',
            left: `calc(${Math.min(Math.max(filledW, 0), 100)}% - 5px)`,
            top: -4, width: 10, height: 18,
            background: barColor, borderRadius: 3,
            boxShadow: `0 0 0 2px ${SURFACE_H}, 0 0 0 3.5px ${barColor}`,
            transition: 'left 0.6s ease',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 10, color: '#888780' }}>
          <span style={{ color: LOSS_COLOR }}>Stop −{Math.abs(pos.distToStop).toFixed(1)}%</span>
          <span style={{ fontWeight: 500, color: pos.progressToTarget >= 100 ? WIN_COLOR : pos.progressToTarget >= 0 ? barColor : LOSS_COLOR }}>
            {pos.progressToTarget.toFixed(0)}% to target
          </span>
          <span style={{ color: WIN_COLOR }}>Target +{pos.distToTarget.toFixed(1)}%</span>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap',
        paddingTop: 6, borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
        {([
          ['Invested'   , fmt(pos.invested)],
          ['Curr. value', fmt(pos.currentValue)],
          ['Alloc'      , pos.allocPct.toFixed(1) + '%'],
          ['R:R'        , pos.riskReward.toFixed(1) + 'x'],
          ['Qty'        , String(pos.quantity)],
        ] as [string, string][]).map(([label, val]) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontSize: 10, color: '#888780' }}>{label}</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: '#E8E7DF' }}>{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── UnrealizedPnLBars ─────────────────────────────────────────── */

function UnrealizedPnLBars({ positions }: { positions: EnrichedPosition[] }) {
  // Consolidate by stock name then sort descending by unrealized P&L
  const stockMap = new Map<string, { pnl: number; invested: number; daysHeld: number }>();
  for (const p of positions) {
    const existing = stockMap.get(p.stock);
    stockMap.set(p.stock, {
      pnl:      (existing?.pnl      ?? 0) + p.unrealizedPnl,
      invested: (existing?.invested ?? 0) + p.invested,
      daysHeld: Math.max(existing?.daysHeld ?? 0, p.daysHeld),
    });
  }
  const sorted = Array.from(stockMap.entries())
    .map(([stock, v]) => ({
      stock,
      unrealizedPnl: v.pnl,
      unrealizedPct: v.invested > 0 ? (v.pnl / v.invested) * 100 : 0,
      daysHeld: v.daysHeld,
    }))
    .sort((a, b) => b.unrealizedPnl - a.unrealizedPnl);

  // keyed by stock name for safe tooltip lookup
  const tooltipMap = new Map(sorted.map(p => [p.stock, p]));

  const maxAbs = Math.max(...sorted.map(p => Math.abs(p.unrealizedPnl)), 1);

  const chartData = {
    labels: sorted.map(p => p.stock),
    datasets: [{
      label: 'Unrealized P&L',
      data: sorted.map(p => p.unrealizedPnl),
      backgroundColor: sorted.map(p => p.unrealizedPnl >= 0 ? WIN_BG : LOSS_BG),
      borderColor: sorted.map(p => p.unrealizedPnl >= 0 ? WIN_COLOR : LOSS_COLOR),
      borderWidth: 1.5,
      borderRadius: { topRight: 4, bottomRight: 4, topLeft: 4, bottomLeft: 4 },
      borderSkipped: false as const,
      barThickness: Math.max(20, Math.min(36, 360 / Math.max(sorted.length, 1))),
    }],
  };

  const opts = {
    indexAxis: 'y' as const,
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items: { label: string }[]) => items[0].label,
          label: (ctx: { label: string; raw: unknown }) => {
            const pnl = Number(ctx.raw);
            const p   = tooltipMap.get(ctx.label);
            return [
              ` Unrealized: ${fmtSigned(pnl)}`,
              ` Return: ${p ? fmtPct(p.unrealizedPct) : '—'}`,
              ` Held: ${p ? p.daysHeld + 'd' : '—'}`,
            ];
          },
        },
        backgroundColor: '#1C2333', padding: 10, cornerRadius: 8,
        bodyFont: { family: "'DM Sans', sans-serif", size: 12 },
        bodyColor: '#E8E7DF', titleColor: '#E8E7DF',
      },
    },
    scales: {
      x: {
        min: -maxAbs * 1.15, max: maxAbs * 1.15,
        grid: { color: GRID_COLOR, drawBorder: false }, border: { display: false },
        ticks: {
          color: '#888780', font: { size: 11 },
          callback: (v: string | number) => {
            const n = Number(v);
            return n === 0 ? '0' : (n > 0 ? '+' : '-') + fmt(Math.abs(n));
          },
          maxTicksLimit: 7,
        },
      },
      y: { grid: { display: false }, border: { display: false },
        ticks: { color: '#888780', font: { size: 12 } } },
    },
  };

  return (
    <div className="relative w-full" style={{ height: Math.max(200, sorted.length * 44 + 60) }}>
      <Bar data={chartData} options={opts} />
    </div>
  );
}

/* ─── AllocationDonut ───────────────────────────────────────────── */

function AllocationDonut({ positions, initialCapital }: { positions: EnrichedPosition[]; initialCapital: number }) {
  const totalDeployed = positions.reduce((s, p) => s + p.invested, 0);
  const remaining     = Math.max(initialCapital - totalDeployed, 0);
  const deployedPct   = initialCapital > 0 ? Math.min((totalDeployed / initialCapital) * 100, 100) : 0;

  // Consolidate by stock name
  const stockMap = new Map<string, number>();
  for (const p of positions) {
    stockMap.set(p.stock, (stockMap.get(p.stock) ?? 0) + p.invested);
  }
  const stocks = Array.from(stockMap.entries()).sort((a, b) => b[1] - a[1]); // desc by invested

  const labels = [...stocks.map(([s]) => s), 'Cash'];
  const values = [...stocks.map(([, v]) => v), remaining];
  const colors = [
    ...stocks.map((_, i) => STOCK_PALETTE[i % STOCK_PALETTE.length]),
    'rgba(180,178,169,0.25)',
  ];

  const chartData = {
    labels,
    datasets: [{
      data: values,
      backgroundColor: colors,
      borderColor: colors.map(c => c.replace('0.25', '0.7')),
      borderWidth: 1.5,
      hoverOffset: 4,
    }],
  };

  const opts = {
    responsive: true, maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: {
        display: true, position: 'right' as const,
        labels: {
          boxWidth: 10, boxHeight: 10,
          font: { size: 11 }, color: '#E8E7DF', padding: 10,
          generateLabels: (chart: ChartJS) =>
            (chart.data.labels as string[]).map((label, i) => ({
              text: `${label}  ${((values[i] / (initialCapital || totalDeployed || 1)) * 100).toFixed(1)}%`,
              fillStyle: colors[i], strokeStyle: colors[i],
              fontColor: '#E8E7DF',
              lineWidth: 1, hidden: false, index: i,
            })),
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx: { raw: unknown; label: string }) => {
            const pct = ((Number(ctx.raw) / (initialCapital || totalDeployed || 1)) * 100).toFixed(1);
            return ` ${ctx.label}: ${fmt(Number(ctx.raw))} (${pct}%)`;
          },
        },
        backgroundColor: '#1C2333', padding: 10, cornerRadius: 8,
        bodyFont: { family: "'DM Sans', sans-serif", size: 12 },
        bodyColor: '#E8E7DF', titleColor: '#E8E7DF',
      },
    },
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative w-full" style={{ height: 220 }}>
        <Doughnut data={chartData} options={opts} />
        <div style={{
          position: 'absolute', top: '50%', left: '33%',
          transform: 'translate(-50%,-50%)',
          textAlign: 'center', pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: deployedPct > 80 ? WARN_COLOR : PURPLE }}>
            {deployedPct.toFixed(0)}%
          </div>
          <div style={{ fontSize: 10, color: '#888780' }}>deployed</div>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        {stocks.map(([stock, invested], i) => (
          <div key={stock} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '3px 9px', borderRadius: 20,
            background: STOCK_PALETTE[i % STOCK_PALETTE.length] + '18',
            border: `0.5px solid ${STOCK_PALETTE[i % STOCK_PALETTE.length]}40`,
            fontSize: 11, fontWeight: 500,
            color: STOCK_PALETTE[i % STOCK_PALETTE.length],
          }}>
            {stock} · {((invested / (initialCapital || totalDeployed || 1)) * 100).toFixed(1)}%
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── DaysHeldView ──────────────────────────────────────────────── */

function DaysHeldView({ positions }: { positions: EnrichedPosition[] }) {
  const sorted   = [...positions].sort((a, b) => b.daysHeld - a.daysHeld);
  const maxDays  = Math.max(...sorted.map(p => p.daysHeld), 1);
  const TARGET   = 150;

  return (
    <div className="flex flex-col gap-2">
      {sorted.map(p => {
        const barW    = (p.daysHeld / Math.max(maxDays, TARGET * 1.2)) * 100;
        const targetW = (TARGET    / Math.max(maxDays, TARGET * 1.2)) * 100;
        const isOver  = p.daysHeld > TARGET;
        const bColor  = isOver ? WARN_COLOR : WIN_COLOR;

        return (
          <div key={p.id} className="flex items-center gap-2.5">
            <span style={{ minWidth: 80, textAlign: 'right' }}
              className="text-xs font-medium text-on-surface">{p.stock}</span>
            <div style={{
              flex: 1, position: 'relative', height: 24,
              background: SURFACE_H, borderRadius: 5,
              border: '0.5px solid rgba(255,255,255,0.08)',
            }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: Math.min(barW, 100) + '%',
                background: `linear-gradient(to right, ${bColor}50, ${bColor}90)`,
                borderRadius: 5, transition: 'width 0.5s ease',
              }} />
              {/* Target line */}
              <div style={{
                position: 'absolute', left: targetW + '%', top: -3, bottom: -3,
                width: 1.5, background: PURPLE + '80', borderRadius: 1, zIndex: 1,
              }}>
                <span style={{ position: 'absolute', top: -14, left: 3,
                  fontSize: 8, color: PURPLE, whiteSpace: 'nowrap' }}>~5mo</span>
              </div>
              <div style={{
                position: 'absolute', left: 8, top: 0, bottom: 0,
                display: 'flex', alignItems: 'center',
                fontSize: 11, fontWeight: 500,
                color: p.daysHeld > 30 ? '#fff' : '#888780',
              }}>{p.daysHeld}d</div>
            </div>
            <span style={{ minWidth: 60, fontSize: 11, fontWeight: isOver ? 500 : 400,
              color: isOver ? WARN_COLOR : '#888780' }}>
              {isOver ? 'Over plan' : `${TARGET - p.daysHeld}d left`}
            </span>
          </div>
        );
      })}
      <p className="text-[11px] text-on-surface-variant mt-1">
        Purple line = 5-month swing target. Orange bar = over your planned hold window.
      </p>
    </div>
  );
}

/* ─── main component ─────────────────────────────────────────────── */

export default function OpenPositionsPanel({
  positions = [],
  initialCapital = 500000,
}: {
  positions?: OpenPosition[];
  initialCapital?: number;
}) {
  const [tab,     setTab    ] = useState<TabKey>('gauges');
  const [sortKey, setSortKey] = useState<SortKey>('progress');
  const [filter,  setFilter ] = useState<FilterKey>('all');

  const enriched = useMemo(() => {
    const totalInv = positions.reduce((s, p) => s + p.entry_price * p.quantity, 0);
    const cap = initialCapital > 0 ? initialCapital : Math.max(totalInv, 1);
    return positions.map(p => enrich(p, cap));
  }, [positions, initialCapital]);

  const filtered = useMemo(() => {
    if (filter === 'near-target') return enriched.filter(p => p.status === 'near-target' || p.status === 'target-hit');
    if (filter === 'near-stop')   return enriched.filter(p => p.status === 'near-stop'   || p.status === 'stop-hit');
    if (filter === 'over-plan')   return enriched.filter(p => p.daysHeld > 150);
    return enriched;
  }, [enriched, filter]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    if (sortKey === 'progress')   return b.progressToTarget - a.progressToTarget;
    if (sortKey === 'pnl_desc')   return b.unrealizedPnl   - a.unrealizedPnl;
    if (sortKey === 'pnl_asc')    return a.unrealizedPnl   - b.unrealizedPnl;
    if (sortKey === 'days_desc')  return b.daysHeld        - a.daysHeld;
    if (sortKey === 'alloc_desc') return b.allocPct        - a.allocPct;
    return 0;
  }), [filtered, sortKey]);

  const totalInvested   = enriched.reduce((s, p) => s + p.invested, 0);
  const totalUnrealized = enriched.reduce((s, p) => s + p.unrealizedPnl, 0);
  const nearTarget      = enriched.filter(p => p.status === 'near-target' || p.status === 'target-hit').length;
  const nearStop        = enriched.filter(p => p.status === 'near-stop'   || p.status === 'stop-hit').length;
  const overPlan        = enriched.filter(p => p.daysHeld > 150).length;
  const effectiveCap    = initialCapital > 0 ? initialCapital : Math.max(totalInvested, 1);
  const deployedPct     = Math.min((totalInvested / effectiveCap) * 100, 100).toFixed(1);

  if (!positions.length) {
    return (
      <div className="bg-surface-container rounded-2xl border border-outline-variant p-12 flex flex-col items-center justify-center gap-2">
        <div className="text-3xl">🎯</div>
        <p className="text-sm font-medium text-on-surface">No open positions</p>
        <p className="text-xs text-on-surface-variant">All positions are closed.</p>
      </div>
    );
  }

  return (
    <div className="bg-surface-container rounded-2xl border border-outline-variant p-5 flex flex-col gap-4">
      {/* Header */}
      <span className="text-sm font-bold text-on-surface">Open Positions</span>

      {/* Summary metrics */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        <MetricCard label="Open positions"   value={enriched.length} />
        <MetricCard label="Capital deployed" value={deployedPct + '%'}
          sub={fmt(totalInvested)} color={parseFloat(String(deployedPct)) > 80 ? WARN_COLOR : PURPLE} />
        <MetricCard label="Unrealized P&L"   value={fmtSigned(totalUnrealized)}
          color={totalUnrealized >= 0 ? WIN_COLOR : LOSS_COLOR} />
        <MetricCard label="Near target"      value={nearTarget} sub="exit opportunity" color={WIN_COLOR} />
        <MetricCard label="Near stop loss"   value={nearStop}   sub="review urgently"
          color={nearStop > 0 ? LOSS_COLOR : undefined} />
        <MetricCard label="Over hold plan"   value={overPlan}   sub=">5 months held"
          color={overPlan > 0 ? WARN_COLOR : undefined} />
      </div>

      {/* Alert banners */}
      {nearStop > 0 && (
        <div className="flex gap-2.5 items-start px-3 py-2.5 rounded-xl text-xs leading-relaxed border"
          style={{ background: LOSS_COLOR + '08', borderColor: LOSS_COLOR + '35' }}>
          <span style={{ color: LOSS_COLOR }} className="mt-0.5 flex-shrink-0">⚠</span>
          <span className="text-on-surface">
            <strong style={{ color: LOSS_COLOR }}>{nearStop} position{nearStop > 1 ? 's' : ''} near stop loss</strong>
            {' '}—{' '}
            {enriched.filter(p => p.status === 'near-stop' || p.status === 'stop-hit').map(p => p.stock).join(', ')}.
            {' '}Review immediately.
          </span>
        </div>
      )}
      {nearTarget > 0 && (
        <div className="flex gap-2.5 items-start px-3 py-2.5 rounded-xl text-xs leading-relaxed border"
          style={{ background: WIN_COLOR + '08', borderColor: WIN_COLOR + '35' }}>
          <span style={{ color: WIN_COLOR }} className="mt-0.5 flex-shrink-0">🎯</span>
          <span className="text-on-surface">
            <strong style={{ color: WIN_COLOR }}>{nearTarget} position{nearTarget > 1 ? 's' : ''} near target</strong>
            {' '}—{' '}
            {enriched.filter(p => p.status === 'near-target' || p.status === 'target-hit').map(p => p.stock).join(', ')}.
            {' '}Consider booking profits.
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {TAB_OPTIONS.map(t => (
            <Pill key={t.key} label={t.label} active={tab === t.key} onClick={() => setTab(t.key)} />
          ))}
        </div>
        {tab === 'gauges' && (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-on-surface-variant min-w-[36px]">Filter:</span>
              {FILTER_OPTIONS.map(f => (
                <Pill key={f.key} label={f.label} active={filter === f.key} onClick={() => setFilter(f.key)} />
              ))}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-on-surface-variant min-w-[36px]">Sort:</span>
              {SORT_OPTIONS.map(o => (
                <Pill key={o.key} label={o.label} active={sortKey === o.key} onClick={() => setSortKey(o.key)} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Content */}
      {tab === 'gauges' && (
        <div className="flex flex-col gap-2.5">
          {sorted.length === 0 && (
            <p className="text-center text-sm text-on-surface-variant py-4">
              No positions match this filter.
            </p>
          )}
          {sorted.map(p => <ProgressGauge key={p.id} pos={p} />)}
        </div>
      )}

      {tab === 'pnl' && (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant mb-3">
            Unrealized P&L — sorted best to worst
          </p>
          <UnrealizedPnLBars positions={enriched} />
        </div>
      )}

      {tab === 'alloc' && (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant mb-3">
            Portfolio allocation across open positions
          </p>
          <AllocationDonut positions={enriched} initialCapital={effectiveCap} />
        </div>
      )}

      {tab === 'days' && (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant mb-3">
            Days held vs your 4–6 month swing plan
          </p>
          <DaysHeldView positions={enriched} />
        </div>
      )}
    </div>
  );
}
