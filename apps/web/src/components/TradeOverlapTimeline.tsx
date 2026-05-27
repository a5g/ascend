import { useState, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Tooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import type { EquityTrade } from './EquityCurve';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend, Filler);

/* ─── constants ─────────────────────────────────────────────────── */

const WIN_COLOR    = '#1D9E75';
const WIN_BG       = 'rgba(29,158,117,0.75)';
const LOSS_COLOR   = '#E24B4A';
const LOSS_BG      = 'rgba(226,75,74,0.75)';
const OPEN_COLOR   = '#534AB7';
const OPEN_BG      = 'rgba(83,74,183,0.75)';
const OVERLAP_COLOR = '#EF9F27';
const GRID_COLOR   = 'rgba(136,135,128,0.07)';

const VIEW_OPTIONS = [
  { key: 'gantt'   , label: 'Gantt bars'       },
  { key: 'count'   , label: 'Concurrent count' },
  { key: 'exposure', label: 'Capital exposure' },
] as const;
type ViewKey = typeof VIEW_OPTIONS[number]['key'];

const COLOR_OPTIONS = [
  { key: 'outcome', label: 'By outcome' },
  { key: 'overlap', label: 'By overlap' },
] as const;
type ColorKey = typeof COLOR_OPTIONS[number]['key'];

const PERIOD_OPTIONS = [
  { key: 'all', label: 'All time' },
  { key: '1'  , label: '1 year'   },
  { key: '2'  , label: '2 years'  },
  { key: '3'  , label: '3 years'  },
] as const;

/* ─── helpers ───────────────────────────────────────────────────── */

function fmt(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 100000) return '₹' + (abs / 100000).toFixed(1) + 'L';
  if (abs >= 1000)   return '₹' + (abs / 1000).toFixed(1) + 'K';
  return '₹' + Math.round(abs).toLocaleString('en-IN');
}

function posSize(t: EquityTrade, capital: number): number {
  if (t.positionSize && t.positionSize > 0) return t.positionSize;
  const abs = Math.abs(t.pnl);
  if (abs === 0) return Math.round(capital * 0.1);
  return Math.round(abs * 10);
}

function filterByPeriod(trades: EquityTrade[], period: string): EquityTrade[] {
  if (period === 'all') return trades;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - parseInt(period));
  return trades.filter(t => new Date(t.entry_date) >= cutoff);
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function exitDate(t: EquityTrade): Date {
  return t.isOpen ? new Date() : new Date(t.exit_date);
}

function buildMonthlySpine(trades: EquityTrade[]): Date[] {
  if (!trades.length) return [];
  const dates = trades.map(t => new Date(t.entry_date).getTime());
  const minDate = new Date(Math.min(...dates));
  const spine: Date[] = [];
  const cur = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const now = new Date();
  while (cur <= now) {
    spine.push(new Date(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  return spine;
}

function buildConcurrentCount(trades: EquityTrade[], spine: Date[]): number[] {
  return spine.map(monthStart => {
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    return trades.filter(t => {
      const entry = new Date(t.entry_date);
      const exit  = exitDate(t);
      return entry < monthEnd && exit >= monthStart;
    }).length;
  });
}

function buildExposure(trades: EquityTrade[], spine: Date[], capital: number): number[] {
  return spine.map(monthStart => {
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    const active = trades.filter(t => {
      const entry = new Date(t.entry_date);
      const exit  = exitDate(t);
      return entry < monthEnd && exit >= monthStart;
    });
    return Math.round(active.reduce((s, t) => s + posSize(t, capital), 0));
  });
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

/* ─── GanttView ─────────────────────────────────────────────────── */

function GanttView({ trades, colorBy, maxConcurrent }: {
  trades: EquityTrade[]; colorBy: ColorKey; maxConcurrent: number;
}) {
  const today = new Date();
  const sorted = [...trades].sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());

  const allDates = sorted.map(t => new Date(t.entry_date).getTime());
  const minDate  = new Date(Math.min(...allDates));
  const totalDays = daysBetween(minDate, today) || 1;

  function overlapOnDate(date: Date): number {
    return sorted.filter(t => {
      const entry = new Date(t.entry_date);
      const exit  = exitDate(t);
      return entry <= date && exit >= date;
    }).length;
  }

  function barColor(t: EquityTrade): string {
    if (colorBy === 'outcome') {
      if (t.isOpen) return OPEN_BG;
      return t.pnl >= 0 ? WIN_BG : LOSS_BG;
    }
    // overlap
    const entry   = new Date(t.entry_date);
    const exit    = exitDate(t);
    const mid     = new Date((entry.getTime() + exit.getTime()) / 2);
    const overlap = overlapOnDate(mid);
    if (overlap >= maxConcurrent * 0.8) return 'rgba(226,75,74,0.75)';
    if (overlap >= maxConcurrent * 0.5) return 'rgba(239,159,39,0.75)';
    return 'rgba(29,158,117,0.75)';
  }

  function barBorder(t: EquityTrade): string {
    if (t.isOpen) return OPEN_COLOR;
    return t.pnl >= 0 ? WIN_COLOR : LOSS_COLOR;
  }

  const CELL_H = Math.max(18, Math.min(28, 480 / Math.max(sorted.length, 1)));
  const chartH = sorted.length * (CELL_H + 2) + 60;
  const LABEL_W = 90;

  const spine = buildMonthlySpine(trades);
  const step  = Math.ceil(spine.length / 12);
  const ticks = spine
    .filter((_, i) => i % step === 0)
    .map(d => ({
      pct: (daysBetween(minDate, d) / totalDays) * 100,
      label: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
    }));

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: 560, position: 'relative' }}>
        {/* X-axis labels */}
        <div style={{ marginLeft: LABEL_W, position: 'relative', height: 20, marginBottom: 4 }}>
          {ticks.map((t, i) => (
            <span key={i} style={{
              position: 'absolute', left: t.pct + '%',
              fontSize: 10, color: '#888780',
              transform: 'translateX(-50%)', whiteSpace: 'nowrap',
            }}>{t.label}</span>
          ))}
        </div>

        {/* Grid lines + Today line */}
        <div style={{ marginLeft: LABEL_W, position: 'relative' }}>
          {ticks.map((t, i) => (
            <div key={i} style={{
              position: 'absolute', left: t.pct + '%', top: 0,
              width: 1, height: chartH,
              background: 'rgba(255,255,255,0.06)',
              pointerEvents: 'none',
            }} />
          ))}
          <div style={{
            position: 'absolute', left: '100%', top: 0,
            width: 1.5, height: chartH,
            background: OPEN_COLOR + '80',
          }}>
            <span style={{
              position: 'absolute', top: -16, left: 3,
              fontSize: 9, color: OPEN_COLOR, whiteSpace: 'nowrap',
            }}>Today</span>
          </div>
        </div>

        {/* Bars */}
        <div className="flex flex-col gap-0.5">
          {sorted.map(trade => {
            const entry    = new Date(trade.entry_date);
            const exit     = exitDate(trade);
            const startPct = (daysBetween(minDate, entry) / totalDays) * 100;
            const widthPct = (daysBetween(entry, exit)   / totalDays) * 100;
            const days     = daysBetween(entry, exit);
            const pnlStr   = trade.isOpen ? 'Open' : (trade.pnl >= 0 ? '+' : '') + fmt(Math.abs(trade.pnl));

            return (
              <div key={trade.id} className="flex items-center" style={{ height: CELL_H }}>
                <div style={{ width: LABEL_W, flexShrink: 0, paddingRight: 8, textAlign: 'right' }}
                  className="text-[11px] font-medium text-on-surface overflow-hidden text-ellipsis whitespace-nowrap">
                  {trade.stock}
                </div>
                <div className="flex-1 relative h-full">
                  <div
                    title={`${trade.stock}\nEntry: ${trade.entry_date}\nExit: ${trade.isOpen ? 'Open' : trade.exit_date}\nDuration: ${days}d\nP&L: ${pnlStr}`}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.opacity = '0.7'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = '1'; }}
                    style={{
                      position: 'absolute',
                      left: startPct + '%',
                      width: Math.max(widthPct, 0.4) + '%',
                      height: '100%',
                      background: barColor(trade),
                      border: `0.5px solid ${barBorder(trade)}`,
                      borderRadius: 4,
                      cursor: 'default',
                      transition: 'opacity .15s',
                      display: 'flex', alignItems: 'center', overflow: 'hidden',
                    }}
                  >
                    {widthPct > 4 && (
                      <span style={{ fontSize: 9, paddingLeft: 4, color: '#fff',
                        whiteSpace: 'nowrap', overflow: 'hidden', fontWeight: 500 }}>
                        {trade.stock} {pnlStr}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── CountView ─────────────────────────────────────────────────── */

function CountView({ spine, counts, maxConcurrent }: { spine: Date[]; counts: number[]; maxConcurrent: number }) {
  const labels = spine.map(d => d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }));
  const bgColors = counts.map(c =>
    c >= maxConcurrent * 0.8 ? 'rgba(226,75,74,0.25)'
    : c >= maxConcurrent * 0.5 ? 'rgba(239,159,39,0.20)'
    : 'rgba(83,74,183,0.15)');
  const bdColors = counts.map(c =>
    c >= maxConcurrent * 0.8 ? LOSS_COLOR
    : c >= maxConcurrent * 0.5 ? OVERLAP_COLOR
    : OPEN_COLOR);

  const maxLinePlugin = useMemo(() => ({
    id: 'maxLine',
    afterDraw(chart: ChartJS) {
      const yScale = (chart.scales as Record<string, { getPixelForValue: (v: number) => number }>)['y'];
      if (!yScale) return;
      const y = yScale.getPixelForValue(maxConcurrent * 0.8);
      const { left, right } = chart.chartArea;
      const ctx = chart.ctx;
      ctx.save();
      ctx.strokeStyle = LOSS_COLOR + '60'; ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = LOSS_COLOR;
      ctx.font = `500 10px 'DM Sans', sans-serif`;
      ctx.fillText('High concentration', right - 110, y - 4);
      ctx.restore();
    },
  }), [maxConcurrent]);

  const chartData = {
    labels,
    datasets: [{
      label: 'Open trades',
      data: counts,
      backgroundColor: bgColors,
      borderColor: bdColors,
      borderWidth: 1.5,
      borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
      borderSkipped: 'bottom' as const,
      barThickness: Math.max(6, Math.min(24, 600 / Math.max(spine.length, 1))),
    }],
  };

  const opts = {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items: { label: string }[]) => items[0].label,
          label: (ctx: { raw: unknown }) => ` Open positions: ${ctx.raw}`,
          afterLabel: (ctx: { raw: unknown }) => {
            const c = Number(ctx.raw);
            if (c >= maxConcurrent * 0.8) return ' ⚠ High concentration — review risk';
            if (c >= maxConcurrent * 0.5) return ' Moderate overlap';
            return ' Low overlap — well spread';
          },
        },
        backgroundColor: '#1C2333', padding: 10, cornerRadius: 8,
        bodyFont: { family: "'DM Sans', sans-serif", size: 12 },
        bodyColor: '#E8E7DF', titleColor: '#E8E7DF',
      },
    },
    scales: {
      x: {
        grid: { display: false }, border: { display: false },
        ticks: { color: '#888780', font: { size: 10 }, maxRotation: 45, autoSkip: true, maxTicksLimit: 14 },
      },
      y: {
        min: 0,
        grid: { color: GRID_COLOR, drawBorder: false }, border: { display: false },
        ticks: { color: '#888780', font: { size: 11 },
          stepSize: 1, callback: (v: string | number) => Number.isInteger(Number(v)) ? v : '' },
        title: { display: true, text: 'Open positions', color: '#888780', font: { size: 11 } },
      },
    },
  };

  return (
    <div className="relative w-full" style={{ height: 280 }}>
      <Bar data={chartData} options={opts} plugins={[maxLinePlugin]} />
    </div>
  );
}

/* ─── ExposureView ──────────────────────────────────────────────── */

function ExposureView({ spine, exposure, initialCapital }: { spine: Date[]; exposure: number[]; initialCapital: number }) {
  const labels = spine.map(d => d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }));
  const effectiveCap = initialCapital > 0 ? initialCapital : Math.max(...exposure, 1);
  const pctExposure  = exposure.map(v => parseFloat(((v / effectiveCap) * 100).toFixed(1)));

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Capital deployed',
        data: pctExposure,
        borderColor: OPEN_COLOR, borderWidth: 2.5,
        backgroundColor: 'rgba(83,74,183,0.07)',
        fill: 'origin' as const, tension: 0.35,
        pointRadius: 0, pointHoverRadius: 5,
        pointHoverBackgroundColor: OPEN_COLOR,
      },
      {
        label: '100% (fully deployed)',
        data: Array(spine.length).fill(100),
        borderColor: LOSS_COLOR + '40', borderWidth: 1,
        borderDash: [4, 4], pointRadius: 0, fill: false,
      },
    ],
  };

  const opts = {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items: { label: string }[]) => items[0].label,
          label: (ctx: { datasetIndex: number; dataIndex: number }) => {
            if (ctx.datasetIndex === 1) return '';
            return [` Deployed: ${pctExposure[ctx.dataIndex]}% of capital`, ` Approx: ${fmt(exposure[ctx.dataIndex])}`];
          },
          filter: (item: { datasetIndex: number }) => item.datasetIndex === 0,
        },
        backgroundColor: '#1C2333', padding: 10, cornerRadius: 8,
        bodyFont: { family: "'DM Sans', sans-serif", size: 12 },
        bodyColor: '#E8E7DF', titleColor: '#E8E7DF',
      },
    },
    scales: {
      x: {
        grid: { display: false }, border: { display: false },
        ticks: { color: '#888780', font: { size: 10 }, maxRotation: 45, autoSkip: true, maxTicksLimit: 14 },
      },
      y: {
        min: 0,
        grid: { color: GRID_COLOR, drawBorder: false }, border: { display: false },
        ticks: { color: '#888780', font: { size: 11 },
          callback: (v: string | number) => v + '%' },
        title: { display: true, text: '% of capital deployed', color: '#888780', font: { size: 11 } },
      },
    },
  };

  return (
    <div className="relative w-full" style={{ height: 280 }}>
      <Line data={chartData} options={opts} />
    </div>
  );
}

/* ─── LegendItem ────────────────────────────────────────────────── */

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-on-surface-variant">
      <span className="inline-block w-3.5 h-2 rounded-sm flex-shrink-0" style={{ background: color }} />
      {label}
    </span>
  );
}

/* ─── main component ─────────────────────────────────────────────── */

export default function TradeOverlapTimeline({
  trades = [],
  initialCapital = 500000,
}: {
  trades?: EquityTrade[];
  initialCapital?: number;
}) {
  const [view,    setView   ] = useState<ViewKey>('gantt');
  const [period,  setPeriod ] = useState('all');
  const [colorBy, setColorBy] = useState<ColorKey>('outcome');
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => filterByPeriod(trades, period), [trades, period]);

  const spine    = useMemo(() => buildMonthlySpine(filtered), [filtered]);
  const counts   = useMemo(() => buildConcurrentCount(filtered, spine), [filtered, spine]);
  const exposure = useMemo(() => buildExposure(filtered, spine, initialCapital), [filtered, spine, initialCapital]);

  const maxConcurrent    = Math.max(...counts, 1);
  const avgConcurrent    = counts.length ? parseFloat((counts.reduce((s, v) => s + v, 0) / counts.length).toFixed(1)) : 0;
  const highOverlapMonths = counts.filter(c => c >= maxConcurrent * 0.8).length;
  const openTrades       = filtered.filter(t => t.isOpen);

  const ganttTrades = useMemo(() => {
    const s = [...filtered].sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());
    return showAll ? s : s.slice(0, 40);
  }, [filtered, showAll]);

  if (!trades.length) {
    return (
      <div className="bg-surface-container rounded-2xl border border-outline-variant p-6 flex items-center justify-center">
        <p className="text-sm text-on-surface-variant">No trades found.</p>
      </div>
    );
  }

  return (
    <div className="bg-surface-container rounded-2xl border border-outline-variant p-5 flex flex-col gap-4">
      {/* Header */}
      <span className="text-sm font-bold text-on-surface">Trade Overlap Timeline</span>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        <MetricCard label="Total trades"        value={filtered.length} />
        <MetricCard label="Currently open"      value={openTrades.length} color={OPEN_COLOR} />
        <MetricCard label="Peak concurrent"     value={maxConcurrent} sub="open at once"
          color={maxConcurrent >= 8 ? LOSS_COLOR : WIN_COLOR} />
        <MetricCard label="Avg concurrent"      value={avgConcurrent} sub="open per month" />
        <MetricCard label="High overlap months" value={highOverlapMonths} sub="≥80% of peak"
          color={highOverlapMonths > 3 ? LOSS_COLOR : WIN_COLOR} />
        <MetricCard label="Months tracked"      value={spine.length} />
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-on-surface-variant min-w-[44px]">Period:</span>
          {PERIOD_OPTIONS.map(p => (
            <Pill key={p.key} label={p.label} active={period === p.key} onClick={() => setPeriod(p.key)} />
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-on-surface-variant min-w-[44px]">View:</span>
          {VIEW_OPTIONS.map(v => (
            <Pill key={v.key} label={v.label} active={view === v.key} onClick={() => setView(v.key)} />
          ))}
        </div>
        {view === 'gantt' && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-on-surface-variant min-w-[44px]">Colour:</span>
            {COLOR_OPTIONS.map(c => (
              <Pill key={c.key} label={c.label} active={colorBy === c.key} onClick={() => setColorBy(c.key)} />
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      {view === 'gantt' && colorBy === 'outcome' && (
        <div className="flex gap-4 text-xs flex-wrap">
          <LegendItem color={WIN_BG}  label="Winner" />
          <LegendItem color={LOSS_BG} label="Loser"  />
          <LegendItem color={OPEN_BG} label="Open"   />
        </div>
      )}
      {view === 'gantt' && colorBy === 'overlap' && (
        <div className="flex gap-4 text-xs flex-wrap">
          <LegendItem color="rgba(29,158,117,0.75)"  label="Low overlap"  />
          <LegendItem color="rgba(239,159,39,0.75)"  label="Moderate"     />
          <LegendItem color="rgba(226,75,74,0.75)"   label="High overlap" />
        </div>
      )}
      {view === 'count' && (
        <div className="flex gap-4 text-xs flex-wrap">
          <LegendItem color="rgba(83,74,183,0.3)"  label="Low"              />
          <LegendItem color="rgba(239,159,39,0.3)" label="Moderate"         />
          <LegendItem color="rgba(226,75,74,0.3)"  label="High concentration" />
        </div>
      )}

      {/* Chart area */}
      {view === 'gantt' && (
        <div className="overflow-x-auto overflow-y-auto max-h-[520px] rounded-xl border border-outline-variant p-3 bg-surface-container-high">
          <GanttView trades={ganttTrades} colorBy={colorBy} maxConcurrent={maxConcurrent} />
          {filtered.length > 40 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="mt-2.5 w-full py-1.5 text-xs text-on-surface-variant border border-outline-variant rounded-lg cursor-pointer hover:text-on-surface transition-colors"
            >
              {showAll
                ? 'Show fewer'
                : `Show all ${filtered.length} trades (${filtered.length - 40} more)`}
            </button>
          )}
        </div>
      )}
      {view === 'count'    && <CountView    spine={spine} counts={counts} maxConcurrent={maxConcurrent} />}
      {view === 'exposure' && <ExposureView spine={spine} exposure={exposure} initialCapital={initialCapital} />}

      {/* Insight */}
      {highOverlapMonths > 3 ? (
        <div className="flex gap-2.5 items-start px-3 py-2.5 rounded-xl text-xs leading-relaxed border"
          style={{ background: LOSS_COLOR + '08', borderColor: LOSS_COLOR + '30' }}>
          <span style={{ color: LOSS_COLOR }} className="mt-0.5">⚠</span>
          <span className="text-on-surface">
            <strong style={{ color: LOSS_COLOR }}>Concentration risk: </strong>
            you had {highOverlapMonths} month{highOverlapMonths !== 1 ? 's' : ''} with
            near-peak simultaneous positions ({maxConcurrent} at once).
            High overlap means a broad market drop could hit multiple positions together.
            Consider staggering entries or capping max concurrent positions.
          </span>
        </div>
      ) : maxConcurrent > 0 ? (
        <div className="flex gap-2.5 items-start px-3 py-2.5 rounded-xl text-xs leading-relaxed border"
          style={{ background: WIN_COLOR + '08', borderColor: WIN_COLOR + '30' }}>
          <span style={{ color: WIN_COLOR }} className="mt-0.5">✓</span>
          <span className="text-on-surface">
            <strong style={{ color: WIN_COLOR }}>Good position management: </strong>
            your portfolio rarely reached peak concentration —
            most months averaged {avgConcurrent} open trades, keeping overlap risk controlled.
          </span>
        </div>
      ) : null}

      {/* Open positions list */}
      {openTrades.length > 0 && (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant mb-2">
            Currently open positions ({openTrades.length})
          </p>
          <div className="flex flex-col gap-1.5">
            {[...openTrades]
              .sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime())
              .map(t => {
                const days = Math.round((new Date().getTime() - new Date(t.entry_date).getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={t.id}
                    className="flex justify-between items-center px-3 py-2 rounded-xl text-xs gap-2 flex-wrap border"
                    style={{ background: 'rgba(83,74,183,0.06)', borderColor: OPEN_COLOR + '30' }}>
                    <span className="font-medium text-on-surface min-w-[80px]">{t.stock}</span>
                    <span className="text-on-surface-variant">Entered {t.entry_date}</span>
                    <span className="font-medium text-on-surface">{days}d open</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
