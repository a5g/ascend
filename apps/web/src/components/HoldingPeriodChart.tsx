import { useState, useMemo } from 'react';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  Tooltip,
  ScatterController,
} from 'chart.js';
import { Scatter } from 'react-chartjs-2';
import type { EquityTrade } from './EquityCurve';

ChartJS.register(ScatterController, LinearScale, PointElement, Tooltip);

// ─── Constants ────────────────────────────────────────────────────────────────

const WIN_COLOR  = '#1D9E75';
const WIN_BG     = 'rgba(29,158,117,0.55)';
const LOSS_COLOR = '#E24B4A';
const LOSS_BG    = 'rgba(226,75,74,0.55)';
const SWEET_MIN  = 17;   // ~4 months in weeks
const SWEET_MAX  = 26;   // ~6 months in weeks

const PERIOD_OPTIONS = [
  { key: 'all', label: 'All time' },
  { key: '1y',  label: '1Y'       },
  { key: '2y',  label: '2Y'       },
  { key: '3y',  label: '3Y'       },
] as const;

type PeriodKey = typeof PERIOD_OPTIONS[number]['key'];

const BUCKETS = [
  { label: '< 1 week',   minW: 0,        maxW: 1    },
  { label: '1–4 wks',    minW: 1,        maxW: 4    },
  { label: '1–3 months', minW: 4,        maxW: 13   },
  { label: '3–6 months', minW: 13,       maxW: 26,  sweet: true },
  { label: '6–12 months',minW: 26,       maxW: 52   },
  { label: '> 1 year',   minW: 52,       maxW: Infinity },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1e7) return '₹' + (abs / 1e7).toFixed(2) + 'Cr';
  if (abs >= 1e5) return '₹' + (abs / 1e5).toFixed(1) + 'L';
  if (abs >= 1e3) return '₹' + (abs / 1e3).toFixed(1) + 'K';
  return '₹' + Math.round(abs).toLocaleString('en-IN');
};

function holdWeeks(trade: EquityTrade): number {
  const ms = new Date(trade.exit_date).getTime() - new Date(trade.entry_date).getTime();
  return Math.max(0, ms / (7 * 24 * 60 * 60 * 1000));
}

function returnPct(trade: EquityTrade): number {
  const posSize = trade.positionSize ?? (Math.abs(trade.pnl) * 10 || 1);
  return posSize > 0 ? parseFloat(((trade.pnl / posSize) * 100).toFixed(2)) : 0;
}

function filterByPeriod(trades: EquityTrade[], period: PeriodKey): EquityTrade[] {
  if (period === 'all') return trades;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - parseInt(period));
  return trades.filter(t => new Date(t.exit_date) >= cutoff);
}

function mean(arr: number[]) {
  return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
}

// ─── Plugins ──────────────────────────────────────────────────────────────────

function buildSweetSpotPlugin(xMax: number) {
  return {
    id: 'sweetSpot',
    beforeDatasetsDraw(chart: any) {
      if (xMax < SWEET_MIN) return;
      const ctx    = chart.ctx;
      const xScale = chart.scales.x;
      const { top, bottom } = chart.chartArea;
      const x1 = xScale.getPixelForValue(SWEET_MIN);
      const x2 = xScale.getPixelForValue(Math.min(SWEET_MAX, xMax * 1.1));

      ctx.save();
      ctx.fillStyle = 'rgba(83,74,183,0.07)';
      ctx.fillRect(x1, top, x2 - x1, bottom - top);

      ctx.strokeStyle = 'rgba(83,74,183,0.30)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(x1, top); ctx.lineTo(x1, bottom); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x2, top); ctx.lineTo(x2, bottom); ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = '600 10px ui-monospace, monospace';
      ctx.fillStyle = 'rgba(130,120,220,0.80)';
      ctx.fillText('SWEET SPOT', x1 + 6, top + 14);

      // Zero line
      const y0 = chart.scales.y.getPixelForValue(0);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(chart.chartArea.left, y0);
      ctx.lineTo(chart.chartArea.right, y0);
      ctx.stroke();
      ctx.restore();
    },
  };
}

function buildTooltipPlugin(points: ScatterPoint[]) {
  return {
    id: 'holdTooltip',
    afterDraw(chart: any) {
      const { tooltip } = chart;
      if (!tooltip || tooltip.opacity === 0) return;
      const dp = tooltip.dataPoints?.[0];
      if (!dp) return;
      // Find point by x/y match since datasets are split win/loss
      const raw = dp.raw as { x: number; y: number };
      const pt  = points.find(p => Math.abs(p.x - raw.x) < 0.01 && Math.abs(p.y - raw.y) < 0.01);
      if (!pt) return;

      const ctx: CanvasRenderingContext2D = chart.ctx;
      const bw = 200, bh = 100, pad = 12, r = 6;
      const cx: number = tooltip.caretX;
      const cy: number = tooltip.caretY;
      let bx = cx + 12;
      if (bx + bw > chart.chartArea.right + 20) bx = cx - bw - 12;
      const by = Math.max(chart.chartArea.top + 4,
        Math.min(cy - bh / 2, chart.chartArea.bottom - bh - 4));

      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur  = 12;
      ctx.fillStyle   = '#1C2333';
      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      ctx.lineWidth   = 0.8;
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, r);
      ctx.fill(); ctx.stroke();
      ctx.restore();

      const textP = '#E8E7DF';
      const textM = '#888780';
      const plCol = pt.isWin ? WIN_COLOR : LOSS_COLOR;

      ctx.save();
      ctx.font = '600 12px ui-monospace, monospace';
      ctx.fillStyle = textP;
      ctx.fillText(pt.trade.stock, bx + pad, by + pad + 11);

      ctx.font = '400 11px ui-monospace, monospace';
      const wks = pt.x.toFixed(1);
      const rows: [string, string, string][] = [
        ['Hold',    wks + ' wks (' + (pt.x / 4.33).toFixed(1) + ' mo)', textM],
        ['Return',  (pt.y >= 0 ? '+' : '') + pt.y.toFixed(1) + '%',     plCol],
        ['P&L',     (pt.isWin ? '+' : '') + fmt(Math.abs(pt.trade.pnl)),plCol],
        ['Exit',    pt.trade.exit_date,                                   textM],
      ];
      rows.forEach(([label, val, color], i) => {
        const y = by + pad + 27 + i * 16;
        ctx.fillStyle = textM; ctx.fillText(label, bx + pad, y);
        ctx.fillStyle = color;
        ctx.fillText(val, bx + bw - pad - ctx.measureText(val).width, y);
      });
      ctx.restore();
    },
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScatterPoint {
  x: number; y: number;
  trade: EquityTrade;
  isWin: boolean;
}

interface BucketStats {
  label:     string;
  trades:    number;
  wins:      number;
  winRate:   number;
  avgReturn: number;
  totalPnl:  number;
  sweet:     boolean;
}

// ─── Pill ─────────────────────────────────────────────────────────────────────

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`px-2.5 py-1 text-xs font-semibold border transition-colors ${
        active
          ? 'bg-primary text-on-primary border-primary'
          : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-high'
      }`}>
      {label}
    </button>
  );
}

// ─── Metric card ──────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-surface-container-high border border-outline-variant px-3 py-2">
      <p className="text-[10px] font-label-caps uppercase text-on-surface-variant mb-0.5">{label}</p>
      <p className={`text-sm font-bold font-mono leading-snug ${color ? '' : 'text-on-surface'}`}
        style={color ? { color } : undefined}>{value}</p>
      {sub && <p className="text-[10px] text-on-surface-variant/60 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── HoldingPeriodChart ───────────────────────────────────────────────────────

interface HoldingPeriodChartProps {
  trades: EquityTrade[];
}

export default function HoldingPeriodChart({ trades }: HoldingPeriodChartProps) {
  const [period, setPeriod] = useState<PeriodKey>('all');

  const filtered = useMemo(() => filterByPeriod(trades, period), [trades, period]);

  const points = useMemo<ScatterPoint[]>(() =>
    filtered.map(t => ({
      x: holdWeeks(t),
      y: returnPct(t),
      trade: t,
      isWin: t.pnl >= 0,
    })),
    [filtered],
  );

  const buckets = useMemo<BucketStats[]>(() =>
    BUCKETS.map(b => {
      const bpts = points.filter(p => p.x >= b.minW && p.x < b.maxW);
      const wins = bpts.filter(p => p.isWin);
      return {
        label:     b.label,
        trades:    bpts.length,
        wins:      wins.length,
        winRate:   bpts.length ? Math.round((wins.length / bpts.length) * 100) : 0,
        avgReturn: bpts.length ? parseFloat(mean(bpts.map(p => p.y)).toFixed(1)) : 0,
        totalPnl:  Math.round(bpts.reduce((s, p) => s + p.trade.pnl, 0)),
        sweet:     b.sweet ?? false,
      };
    }),
    [points],
  );

  // Summary stats
  const summary = useMemo(() => {
    const winners = points.filter(p => p.isWin);
    const losers  = points.filter(p => !p.isWin);
    const sweetPts = points.filter(p => p.x >= SWEET_MIN && p.x <= SWEET_MAX);
    const bestBucket = [...buckets].filter(b => b.trades > 0)
      .sort((a, b) => b.avgReturn - a.avgReturn)[0];
    return {
      avgHold:       mean(points.map(p => p.x)).toFixed(1),
      avgWinHold:    winners.length ? mean(winners.map(p => p.x)).toFixed(1) : '—',
      avgLossHold:   losers.length  ? mean(losers.map(p => p.x)).toFixed(1)  : '—',
      sweetTrades:   sweetPts.length,
      sweetWinRate:  sweetPts.length ? Math.round(sweetPts.filter(p => p.isWin).length / sweetPts.length * 100) : 0,
      bestBucket:    bestBucket?.label ?? '—',
      bestBucketRet: bestBucket ? (bestBucket.avgReturn >= 0 ? '+' : '') + bestBucket.avgReturn + '%' : '—',
    };
  }, [points, buckets]);

  const xMax  = Math.max(...points.map(p => p.x), SWEET_MAX + 5);
  const yVals = points.map(p => p.y);
  const yMin  = Math.min(...yVals, 0) * 1.15 - 2;
  const yMax  = Math.max(...yVals, 0) * 1.15 + 2;

  const sweetSpotPlugin = useMemo(() => buildSweetSpotPlugin(xMax), [xMax]);
  const tooltipPlugin   = useMemo(() => buildTooltipPlugin(points), [points]);

  const winners = points.filter(p => p.isWin);
  const losers  = points.filter(p => !p.isWin);

  const chartData = {
    datasets: [
      {
        label: 'Winners',
        data: winners.map(p => ({ x: p.x, y: p.y })),
        backgroundColor: WIN_BG,
        borderColor: WIN_COLOR,
        borderWidth: 1,
        pointRadius: 5,
        pointHoverRadius: 7,
      },
      {
        label: 'Losers',
        data: losers.map(p => ({ x: p.x, y: p.y })),
        backgroundColor: LOSS_BG,
        borderColor: LOSS_COLOR,
        borderWidth: 1,
        pointRadius: 5,
        pointHoverRadius: 7,
      },
    ],
  };

  const xTickCallback = (v: number | string) => {
    const w = Number(v);
    if (w === 0)  return '0';
    if (w % 4 === 0) return `${w}w / ${(w / 4.33).toFixed(0)}mo`;
    return `${w}w`;
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'nearest' as const, intersect: true },
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    layout: { padding: { top: 20, right: 16, bottom: 8, left: 8 } },
    scales: {
      x: {
        min: -0.5,
        max: xMax * 1.05,
        grid: { color: 'rgba(255,255,255,0.04)' },
        border: { display: false },
        ticks: {
          color: '#888780', font: { size: 10 },
          callback: xTickCallback,
          maxTicksLimit: 10,
        },
        title: { display: true, text: 'Hold duration (weeks)', color: '#888780', font: { size: 11 } },
      },
      y: {
        min: yMin, max: yMax,
        grid: { color: 'rgba(255,255,255,0.04)' },
        border: { display: false },
        ticks: {
          color: '#888780', font: { size: 11 },
          callback: (v: number | string) => (Number(v) >= 0 ? '+' : '') + Number(v).toFixed(0) + '%',
        },
        title: { display: true, text: 'Return on position (%)', color: '#888780', font: { size: 11 } },
      },
    },
  };

  if (!trades.length) return null;

  return (
    <div className="bg-surface-container border border-outline-variant">

      {/* Header */}
      <div className="px-4 py-3 border-b border-outline-variant flex items-center justify-between flex-wrap gap-2">
        <span className="text-sm font-bold text-on-surface">Holding Period vs Return</span>
        <div className="flex items-center gap-3 text-xs text-on-surface-variant">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: WIN_COLOR }} />Winners
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: LOSS_COLOR }} />Losers
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 inline-block rounded-sm" style={{ background: 'rgba(83,74,183,0.25)', border: '1px dashed rgba(130,120,220,0.6)' }} />
            Sweet spot (4–6 mo)
          </span>
        </div>
      </div>

      <div className="px-4 pt-3 pb-4 space-y-4">

        {/* Metric cards */}
        <div className="grid grid-cols-3 gap-2 lg:grid-cols-6">
          <MetricCard label="Avg hold"       value={summary.avgHold + ' wks'}   sub="all trades" />
          <MetricCard label="Avg winner hold" value={summary.avgWinHold + (summary.avgWinHold !== '—' ? ' wks' : '')} color={WIN_COLOR} />
          <MetricCard label="Avg loser hold"  value={summary.avgLossHold + (summary.avgLossHold !== '—' ? ' wks' : '')} color={LOSS_COLOR} />
          <MetricCard label="Sweet spot trades" value={String(summary.sweetTrades)} sub={summary.sweetWinRate + '% win rate'} color="rgb(130,120,220)" />
          <MetricCard label="Best window"    value={summary.bestBucket} sub={summary.bestBucketRet + ' avg return'} color={WIN_COLOR} />
          <MetricCard label="Total trades"   value={String(points.length)} />
        </div>

        {/* Period filter */}
        <div className="flex items-center gap-0">
          <span className="text-[10px] font-label-caps uppercase text-on-surface-variant mr-2">Period</span>
          <div className="flex border border-outline-variant overflow-hidden">
            {PERIOD_OPTIONS.map(p => (
              <Pill key={p.key} label={p.label} active={period === p.key} onClick={() => setPeriod(p.key)} />
            ))}
          </div>
        </div>

        {/* Scatter chart */}
        <div style={{ position: 'relative', width: '100%', height: 360 }}>
          <Scatter data={chartData} options={chartOptions} plugins={[sweetSpotPlugin, tooltipPlugin]} />
        </div>

        {/* Bucket breakdown */}
        <div className="space-y-1">
          <p className="text-[10px] font-label-caps uppercase text-on-surface-variant mb-2">
            Performance by holding period
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-surface-container-high">
                  <th className="text-left px-3 py-2 text-[10px] font-label-caps uppercase text-on-surface-variant border border-outline-variant/40">Window</th>
                  <th className="text-right px-3 py-2 text-[10px] font-label-caps uppercase text-on-surface-variant border border-outline-variant/40">Trades</th>
                  <th className="text-right px-3 py-2 text-[10px] font-label-caps uppercase text-on-surface-variant border border-outline-variant/40">Win %</th>
                  <th className="text-right px-3 py-2 text-[10px] font-label-caps uppercase text-on-surface-variant border border-outline-variant/40">Avg Return</th>
                  <th className="text-right px-3 py-2 text-[10px] font-label-caps uppercase text-on-surface-variant border border-outline-variant/40">Total P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                {buckets.filter(b => b.trades > 0).map(b => (
                  <tr key={b.label}
                    className={`border-b border-outline-variant/30 transition-colors ${b.sweet ? 'bg-[rgba(83,74,183,0.06)]' : 'hover:bg-surface-container-high'}`}>
                    <td className="px-3 py-2 border border-outline-variant/20">
                      <div className="flex items-center gap-1.5">
                        {b.sweet && <span className="text-[9px] px-1.5 py-0.5 font-semibold rounded-sm" style={{ background: 'rgba(83,74,183,0.25)', color: 'rgb(160,150,230)' }}>SWEET</span>}
                        <span className={`font-mono ${b.sweet ? 'text-on-surface font-semibold' : 'text-on-surface-variant'}`}>{b.label}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-on-surface border border-outline-variant/20">{b.trades}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold border border-outline-variant/20"
                      style={{ color: b.winRate >= 50 ? WIN_COLOR : LOSS_COLOR }}>
                      {b.winRate}%
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold border border-outline-variant/20"
                      style={{ color: b.avgReturn >= 0 ? WIN_COLOR : LOSS_COLOR }}>
                      {b.avgReturn >= 0 ? '+' : ''}{b.avgReturn}%
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold border border-outline-variant/20"
                      style={{ color: b.totalPnl >= 0 ? WIN_COLOR : LOSS_COLOR }}>
                      {b.totalPnl >= 0 ? '+' : ''}{fmt(Math.abs(b.totalPnl))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
