import { useState, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import type { EquityTrade } from './EquityCurve';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Filler);

// ─── Constants ────────────────────────────────────────────────────────────────

const WIN_COLOR    = '#1D9E75';
const WIN_BG       = 'rgba(29,158,117,0.18)';
const LOSS_COLOR   = '#E24B4A';
const LOSS_BG      = 'rgba(226,75,74,0.18)';
const MEDIAN_COLOR = '#534AB7';
const MEAN_COLOR   = '#EF9F27';

const BIN_OPTIONS = [
  { key: 'auto', label: 'Auto' },
  { key: '10',   label: '10'   },
  { key: '15',   label: '15'   },
  { key: '20',   label: '20'   },
  { key: '30',   label: '30'   },
] as const;

const PERIOD_OPTIONS = [
  { key: 'all', label: 'All time' },
  { key: '1y',  label: '1Y'       },
  { key: '2y',  label: '2Y'       },
  { key: '3y',  label: '3Y'       },
] as const;

const GROUP_OPTIONS = [
  { key: 'all',  label: 'All trades' },
  { key: 'year', label: 'By year'    },
] as const;

type BinKey    = typeof BIN_OPTIONS[number]['key'];
type PeriodKey = typeof PERIOD_OPTIONS[number]['key'];
type GroupKey  = typeof GROUP_OPTIONS[number]['key'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number): string => {
  const abs = Math.abs(n);
  if (abs >= 1e7) return '₹' + (abs / 1e7).toFixed(2) + 'Cr';
  if (abs >= 1e5) return '₹' + (abs / 1e5).toFixed(1) + 'L';
  if (abs >= 1e3) return '₹' + (abs / 1e3).toFixed(1) + 'K';
  return '₹' + Math.round(abs).toLocaleString('en-IN');
};

const fmtSigned = (n: number) => (n >= 0 ? '+' : '') + fmt(Math.abs(n));

function filterByPeriod(trades: EquityTrade[], period: PeriodKey): EquityTrade[] {
  if (period === 'all') return trades;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - parseInt(period));
  return trades.filter(t => new Date(t.exit_date) >= cutoff);
}

function mean(arr: number[]): number {
  return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
}

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

function skewness(arr: number[]): number {
  if (arr.length < 3) return 0;
  const m = mean(arr);
  const s = stdDev(arr);
  if (s === 0) return 0;
  return arr.reduce((sum, v) => sum + ((v - m) / s) ** 3, 0) / arr.length;
}

function kurtosis(arr: number[]): number {
  if (arr.length < 4) return 0;
  const m = mean(arr);
  const s = stdDev(arr);
  if (s === 0) return 0;
  return (arr.reduce((sum, v) => sum + ((v - m) / s) ** 4, 0) / arr.length) - 3;
}

interface Bin {
  min: number;
  max: number;
  wins: number;
  losses: number;
  trades: number[];
}

function buildBins(values: number[], binCount: BinKey): { bins: Bin[] } {
  if (!values.length) return { bins: [] };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const count = binCount === 'auto'
    ? Math.min(30, Math.max(8, Math.ceil(Math.sqrt(values.length))))
    : parseInt(binCount);
  const width = range / count;
  const edges = Array.from({ length: count + 1 }, (_, i) => min + i * width);

  const bins: Bin[] = edges.slice(0, -1).map((edge, i) => ({
    min: edge, max: edges[i + 1], wins: 0, losses: 0, trades: [],
  }));

  for (const v of values) {
    let idx = Math.floor((v - min) / width);
    if (idx >= count) idx = count - 1;
    bins[idx].trades.push(v);
    if (v >= 0) bins[idx].wins++; else bins[idx].losses++;
  }
  return { bins };
}

interface Stats {
  count: number; mean: number; median: number; stdDev: number;
  skew: number; kurt: number; winRate: number;
  avgWin: number; avgLoss: number;
  bestTrade: number; worstTrade: number;
  p10: number; p90: number;
  wins: number; losses: number;
}

function computeStats(pnls: number[]): Stats | null {
  if (!pnls.length) return null;
  const sorted = [...pnls].sort((a, b) => a - b);
  const wins   = pnls.filter(v => v > 0);
  const losses = pnls.filter(v => v < 0);
  const p10    = sorted[Math.floor(sorted.length * 0.10)] ?? 0;
  const p90    = sorted[Math.floor(sorted.length * 0.90)] ?? 0;
  return {
    count:      pnls.length,
    mean:       Math.round(mean(pnls)),
    median:     Math.round(median(pnls)),
    stdDev:     Math.round(stdDev(pnls)),
    skew:       parseFloat(skewness(pnls).toFixed(2)),
    kurt:       parseFloat(kurtosis(pnls).toFixed(2)),
    winRate:    wins.length / pnls.length * 100,
    avgWin:     wins.length   ? Math.round(mean(wins))   : 0,
    avgLoss:    losses.length ? Math.round(mean(losses)) : 0,
    bestTrade:  Math.max(...pnls),
    worstTrade: Math.min(...pnls),
    p10, p90,
    wins: wins.length, losses: losses.length,
  };
}

// ─── Pill toggle ─────────────────────────────────────────────────────────────

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 text-xs font-semibold transition-colors ${
        active
          ? 'bg-primary text-on-primary'
          : 'text-on-surface-variant hover:bg-surface-container-high'
      }`}
    >
      {label}
    </button>
  );
}

// ─── Skew badge ───────────────────────────────────────────────────────────────

function SkewBadge({ skew }: { skew: number }) {
  const isRight  = skew > 0.5;
  const isLeft   = skew < -0.5;
  const color    = isRight ? WIN_COLOR : isLeft ? LOSS_COLOR : '#888780';
  const bgClass  = isRight ? 'bg-secondary/10 border-secondary/30'
                 : isLeft  ? 'bg-tertiary/10 border-tertiary/30'
                 : 'bg-surface-container-high border-outline-variant';
  const label    = isRight ? 'Right-skewed' : isLeft ? 'Left-skewed' : 'Symmetric';
  const desc     = isRight
    ? 'More small losses, occasional large wins — positive for a swing trader'
    : isLeft
    ? 'More small wins, occasional large losses — watch your risk management'
    : 'Wins and losses are roughly mirror images of each other';

  return (
    <div className={`${bgClass} border rounded-sm px-3 py-2.5`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-semibold" style={{ color }}>{label}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-sm font-mono" style={{ background: color + '22', color }}>
          {skew > 0 ? '+' : ''}{skew.toFixed(2)}
        </span>
      </div>
      <p className="text-[11px] text-on-surface-variant leading-snug m-0">{desc}</p>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-surface-container-high border border-outline-variant px-3 py-2">
      <p className="text-[10px] font-label-caps uppercase text-on-surface-variant mb-0.5">{label}</p>
      <p className={`text-sm font-bold font-mono leading-snug ${color ? '' : 'text-on-surface'}`} style={color ? { color } : undefined}>{value}</p>
      {sub && <p className="text-[10px] text-on-surface-variant/60 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Histogram ────────────────────────────────────────────────────────────────

function HistogramChart({ pnls, binCount }: { pnls: number[]; binCount: BinKey }) {
  const { bins } = useMemo(() => buildBins(pnls, binCount), [pnls, binCount]);
  const stats    = useMemo(() => computeStats(pnls), [pnls]);

  if (!bins.length || !stats) return null;

  const counts   = bins.map(b => b.wins + b.losses);
  const labels   = bins.map(b => fmt(b.min));
  const bgColors = bins.map(b => b.min >= 0 ? WIN_BG   : LOSS_BG);
  const bdColors = bins.map(b => b.min >= 0 ? WIN_COLOR : LOSS_COLOR);
  const maxCount = Math.max(...counts, 1);

  const meanBinIdx   = bins.findIndex(b => stats.mean   >= b.min && stats.mean   < b.max);
  const medianBinIdx = bins.findIndex(b => stats.median >= b.min && stats.median < b.max);

  const annotationPlugin = {
    id: 'rdAnnotation',
    afterDraw(chart: any) {
      const ctx    = chart.ctx;
      const xScale = chart.scales.x;
      const yScale = chart.scales.y;
      const top    = yScale.getPixelForValue(maxCount * 1.05);
      const bottom = yScale.getPixelForValue(0);

      const drawLine = (binIdx: number, color: string, dash: number[]) => {
        if (binIdx < 0) return;
        const x = xScale.getPixelForValue(binIdx);
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash(dash);
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
        ctx.stroke();
        ctx.restore();
      };

      drawLine(meanBinIdx,   MEAN_COLOR,   []);
      drawLine(medianBinIdx, MEDIAN_COLOR, [4, 3]);
    },
  };

  const tooltipPlugin = {
    id: 'rdTooltip',
    afterDraw(chart: any) {
      const { tooltip } = chart;
      if (!tooltip || tooltip.opacity === 0) return;
      const idx = tooltip.dataPoints?.[0]?.dataIndex;
      if (idx == null) return;

      const bin   = bins[idx];
      const total = bin.wins + bin.losses;
      if (!total) return;

      const ctx: CanvasRenderingContext2D = chart.ctx;
      const bw = 185, bh = bin.losses && bin.wins ? 110 : 90, pad = 12, r = 6;
      const cx: number = tooltip.caretX;
      const cy: number = chart.chartArea.top + 12;
      let bx = cx + 12;
      if (bx + bw > chart.chartArea.right) bx = cx - bw - 12;

      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur  = 12;
      ctx.fillStyle   = '#1C2333';
      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      ctx.lineWidth   = 0.8;
      ctx.beginPath();
      ctx.roundRect(bx, cy, bw, bh, r);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      const textP = '#E8E7DF';
      const textM = '#888780';

      ctx.save();
      ctx.font = '500 12px ui-monospace, monospace';
      ctx.fillStyle = textP;
      ctx.fillText(`${fmt(bin.min)} → ${fmt(bin.max)}`, bx + pad, cy + pad + 11);

      const rows: [string, string, string][] = [
        ['Trades in bin', String(total), textP],
        ...(bin.wins   ? [['Winners', String(bin.wins),   WIN_COLOR ] as [string, string, string]] : []),
        ...(bin.losses ? [['Losers',  String(bin.losses), LOSS_COLOR] as [string, string, string]] : []),
        ['% of total', ((total / pnls.length) * 100).toFixed(1) + '%', textM],
      ];

      ctx.font = '400 11px ui-monospace, monospace';
      rows.forEach(([label, val, color], i) => {
        const y = cy + pad + 28 + i * 17;
        ctx.fillStyle = textM;
        ctx.fillText(label, bx + pad, y);
        ctx.fillStyle = color;
        ctx.fillText(val, bx + bw - pad - ctx.measureText(val).width, y);
      });
      ctx.restore();
    },
  };

  const data = {
    labels,
    datasets: [{
      label: 'Trades',
      data: counts,
      backgroundColor: bgColors,
      borderColor: bdColors,
      borderWidth: 1.5,
      borderRadius: { topLeft: 4, topRight: 4 },
      borderSkipped: 'bottom' as const,
      barPercentage: 0.95,
      categoryPercentage: 1.0,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend:  { display: false },
      tooltip: { enabled: false },
    },
    layout: { padding: { top: 8 } },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          color: '#888780',
          font: { size: 10 },
          maxRotation: 40,
          autoSkip: true,
          maxTicksLimit: 10,
        },
      },
      y: {
        min: 0,
        max: maxCount * 1.15,
        grid: { color: 'rgba(255,255,255,0.04)' },
        border: { display: false },
        ticks: {
          color: '#888780',
          font: { size: 11 },
          stepSize: 1,
          callback: (v: number | string) => Number.isInteger(Number(v)) ? v : '',
        },
      },
    },
  };

  const sharpe = stats.stdDev > 0 ? parseFloat((stats.mean / stats.stdDev).toFixed(2)) : 0;
  const sharpeColor = sharpe >= 1 ? WIN_COLOR : sharpe >= 0 ? '#888780' : LOSS_COLOR;

  return (
    <div className="space-y-3">
      {/* Annotation chips */}
      <div className="flex flex-wrap gap-2">
        <div className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 border border-outline-variant text-on-surface-variant">
          <span className="w-3 h-0.5 rounded-sm inline-block" style={{ background: MEAN_COLOR }} />
          Mean {fmtSigned(stats.mean)}
        </div>
        <div className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 border border-outline-variant text-on-surface-variant">
          <span className="w-3 inline-block" style={{ borderTop: `1.5px dashed ${MEDIAN_COLOR}` }} />
          Median {fmtSigned(stats.median)}
        </div>
        <div className="inline-flex items-center text-[11px] px-2.5 py-1 border border-outline-variant text-on-surface-variant">
          Std dev ±{fmt(stats.stdDev)}
        </div>
        <div className="inline-flex items-center text-[11px] px-2.5 py-1 border border-outline-variant font-mono"
          style={{ color: sharpeColor }}>
          Sharpe-like {sharpe >= 0 ? '+' : ''}{sharpe}
        </div>
      </div>

      {/* Chart */}
      <div style={{ position: 'relative', width: '100%', height: 260 }}>
        <Bar data={data} options={options} plugins={[annotationPlugin, tooltipPlugin]} />
      </div>
    </div>
  );
}

// ─── ReturnDistribution ───────────────────────────────────────────────────────

interface ReturnDistributionProps {
  trades: EquityTrade[];
}

export default function ReturnDistribution({ trades }: ReturnDistributionProps) {
  const [period,        setPeriod       ] = useState<PeriodKey>('all');
  const [binCount,      setBinCount     ] = useState<BinKey>('auto');
  const [groupBy,       setGroupBy      ] = useState<GroupKey>('all');
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);

  const filtered = useMemo(() => filterByPeriod(trades, period), [trades, period]);

  const groups = useMemo(() => {
    if (groupBy === 'all') return null;
    const map: Record<string, EquityTrade[]> = {};
    for (const t of filtered) {
      const key = new Date(t.exit_date).getFullYear().toString();
      if (!map[key]) map[key] = [];
      map[key].push(t);
    }
    return Object.entries(map)
      .map(([label, ts]) => ({ label, trades: ts, pnls: ts.map(t => t.pnl) }))
      .sort((a, b) => b.label.localeCompare(a.label));
  }, [filtered, groupBy]);

  const activePnls = useMemo(() => {
    if (groupBy !== 'all' && selectedGroup != null && groups) {
      return groups[selectedGroup]?.pnls ?? [];
    }
    return filtered.map(t => t.pnl);
  }, [filtered, groupBy, selectedGroup, groups]);

  const stats = useMemo(() => computeStats(activePnls), [activePnls]);

  if (!trades.length) return null;

  return (
    <div className="bg-surface-container border border-outline-variant">

      {/* Header */}
      <div className="px-4 py-3 border-b border-outline-variant">
        <span className="text-sm font-bold text-on-surface">Return Distribution</span>
      </div>

      <div className="px-4 pt-3 pb-4 space-y-4">

        {/* Controls */}
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-0">
            <span className="text-[10px] font-label-caps uppercase text-on-surface-variant mr-2">Period</span>
            <div className="flex border border-outline-variant overflow-hidden">
              {PERIOD_OPTIONS.map(p => (
                <Pill key={p.key} label={p.label} active={period === p.key} onClick={() => setPeriod(p.key)} />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-0">
            <span className="text-[10px] font-label-caps uppercase text-on-surface-variant mr-2">Bins</span>
            <div className="flex border border-outline-variant overflow-hidden">
              {BIN_OPTIONS.map(b => (
                <Pill key={b.key} label={b.label} active={binCount === b.key} onClick={() => setBinCount(b.key)} />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-0">
            <span className="text-[10px] font-label-caps uppercase text-on-surface-variant mr-2">Group</span>
            <div className="flex border border-outline-variant overflow-hidden">
              {GROUP_OPTIONS.map(g => (
                <Pill key={g.key} label={g.label} active={groupBy === g.key}
                  onClick={() => { setGroupBy(g.key); setSelectedGroup(null); }} />
              ))}
            </div>
          </div>
        </div>

        {/* Group pills */}
        {groups && (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedGroup(null)}
              className={`text-[11px] px-2.5 py-1 border transition-colors ${
                selectedGroup == null
                  ? 'border-primary bg-primary/10 text-primary font-semibold'
                  : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              All ({filtered.length})
            </button>
            {groups.map((g, i) => (
              <button
                key={g.label}
                onClick={() => setSelectedGroup(i)}
                className={`text-[11px] px-2.5 py-1 border transition-colors ${
                  selectedGroup === i
                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                    : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {g.label} ({g.trades.length})
              </button>
            ))}
          </div>
        )}

        {/* Histogram */}
        <HistogramChart pnls={activePnls} binCount={binCount} />

        {/* Skew badge + stats */}
        {stats && (
          <div className="space-y-3">
            <SkewBadge skew={stats.skew} />

            <div className="grid grid-cols-5 gap-2">
              <StatCard label="Total trades"  value={String(stats.count)} />
              <StatCard label="Win rate"      value={stats.winRate.toFixed(0) + '%'}
                color={stats.winRate >= 50 ? WIN_COLOR : LOSS_COLOR} />
              <StatCard label="Mean P&L"      value={fmtSigned(stats.mean)}
                color={stats.mean >= 0 ? WIN_COLOR : LOSS_COLOR} />
              <StatCard label="Median P&L"    value={fmtSigned(stats.median)}
                color={stats.median >= 0 ? WIN_COLOR : LOSS_COLOR} />
              <StatCard label="Std deviation" value={'±' + fmt(stats.stdDev)} sub="Volatility of returns" />
              <StatCard label="Skewness"      value={(stats.skew > 0 ? '+' : '') + stats.skew}
                sub={stats.skew > 0 ? 'Positive — good' : stats.skew < 0 ? 'Negative — watch losses' : 'Neutral'}
                color={stats.skew > 0 ? WIN_COLOR : stats.skew < 0 ? LOSS_COLOR : '#888780'} />
              <StatCard label="Kurtosis"      value={(stats.kurt > 0 ? '+' : '') + stats.kurt}
                sub={stats.kurt > 2 ? 'Fat tails' : 'Normal tails'} />
              <StatCard label="Best trade"    value={'+' + fmt(stats.bestTrade)}  color={WIN_COLOR} />
              <StatCard label="Worst trade"   value={'-' + fmt(Math.abs(stats.worstTrade))} color={LOSS_COLOR} />
              <StatCard label="P10 / P90"     value={fmt(stats.p10) + ' / ' + fmt(stats.p90)}
                sub="10th / 90th percentile" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
