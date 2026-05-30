import { useState, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import type { EquityTrade } from './EquityCurve';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number): string => {
  const abs = Math.abs(n);
  if (abs >= 1e7) return '₹' + (abs / 1e7).toFixed(2) + 'Cr';
  if (abs >= 1e5) return '₹' + (abs / 1e5).toFixed(1) + 'L';
  if (abs >= 1e3) return '₹' + (abs / 1e3).toFixed(1) + 'K';
  return '₹' + abs.toLocaleString('en-IN');
};

const WIN_COLOR  = '#1D9E75';
const LOSS_COLOR = '#E24B4A';
const WIN_BG     = 'rgba(29,158,117,0.18)';
const LOSS_BG    = 'rgba(226,75,74,0.18)';

const SORT_OPTIONS = [
  { key: 'pnl_desc', label: 'Best first'   },
  { key: 'pnl_asc',  label: 'Worst first'  },
  { key: 'abs_desc', label: 'Largest move' },
  { key: 'alpha',    label: 'A → Z'        },
] as const;

const FILTER_OPTIONS = [
  { key: 'all',    label: 'All'      },
  { key: 'wins',   label: 'Winners'  },
  { key: 'losses', label: 'Losers'   },
] as const;

type SortKey   = typeof SORT_OPTIONS[number]['key'];
type FilterKey = typeof FILTER_OPTIONS[number]['key'];

interface StockRow {
  stock:    string;
  totalPnl: number;
  trades:   number;
  wins:     number;
  winRate:  number;
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

function aggregateByStock(trades: EquityTrade[]): StockRow[] {
  const map: Record<string, StockRow> = {};
  for (const t of trades) {
    if (!map[t.stock]) {
      map[t.stock] = { stock: t.stock, totalPnl: 0, trades: 0, wins: 0, winRate: 0 };
    }
    map[t.stock].totalPnl += t.pnl;
    map[t.stock].trades   += 1;
    if (t.pnl > 0) map[t.stock].wins += 1;
  }
  return Object.values(map).map(s => ({
    ...s,
    totalPnl: Math.round(s.totalPnl),
    winRate:  Math.round((s.wins / s.trades) * 100),
  }));
}

function sortStocks(stocks: StockRow[], key: SortKey): StockRow[] {
  return [...stocks].sort((a, b) => {
    if (key === 'pnl_desc') return b.totalPnl - a.totalPnl;
    if (key === 'pnl_asc')  return a.totalPnl - b.totalPnl;
    if (key === 'abs_desc') return Math.abs(b.totalPnl) - Math.abs(a.totalPnl);
    if (key === 'alpha')    return a.stock.localeCompare(b.stock);
    return 0;
  });
}

// ─── Custom tooltip (canvas-drawn) ───────────────────────────────────────────

function buildTooltipPlugin(stocks: StockRow[]) {
  return {
    id: 'stockTooltip',
    afterDraw(chart: any) {
      const { tooltip } = chart;
      if (!tooltip || tooltip.opacity === 0) return;
      const idx = tooltip.dataPoints?.[0]?.dataIndex;
      if (idx == null) return;

      const s    = stocks[idx];
      const ctx: CanvasRenderingContext2D = chart.ctx;
      const bw = 192, bh = 88, pad = 12, r = 6;
      const cx: number = tooltip.caretX;
      const cy: number = tooltip.caretY;
      let bx = cx + 14;
      if (bx + bw > chart.chartArea.right + 40) bx = cx - bw - 14;
      const by = Math.max(chart.chartArea.top, Math.min(cy - bh / 2, chart.chartArea.bottom - bh));

      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#1C2333';
      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, r);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      const textMain  = '#E8E7DF';
      const textMuted = '#888780';

      ctx.save();
      ctx.font = '600 12px ui-monospace, monospace';
      ctx.fillStyle = textMain;
      ctx.fillText(s.stock, bx + pad, by + pad + 11);

      const rows: [string, string, string][] = [
        ['Total P&L', (s.totalPnl >= 0 ? '+' : '') + fmt(Math.abs(s.totalPnl)), s.totalPnl >= 0 ? WIN_COLOR : LOSS_COLOR],
        ['Trades',    String(s.trades),   textMain],
        ['Win rate',  s.winRate + '%',    s.winRate >= 50 ? WIN_COLOR : LOSS_COLOR],
      ];
      ctx.font = '400 11px ui-monospace, monospace';
      rows.forEach(([label, val, color], i) => {
        const y = by + pad + 28 + i * 17;
        ctx.fillStyle = textMuted;
        ctx.fillText(label, bx + pad, y);
        ctx.fillStyle = color;
        ctx.fillText(val, bx + bw - pad - ctx.measureText(val).width, y);
      });
      ctx.restore();
    },
  };
}

// ─── Metric card ──────────────────────────────────────────────────────────────

function MetricCard({ label, value, positive, negative }: {
  label: string; value: string; positive?: boolean; negative?: boolean;
}) {
  const cls = positive ? 'text-secondary' : negative ? 'text-tertiary' : 'text-on-surface';
  return (
    <div className="bg-surface-container-high border border-outline-variant px-3 py-2">
      <p className="text-[10px] font-label-caps uppercase text-on-surface-variant mb-0.5">{label}</p>
      <p className={`text-sm font-bold font-mono leading-snug ${cls}`}>{value}</p>
    </div>
  );
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

// ─── StockPnL ─────────────────────────────────────────────────────────────────

interface StockPnLProps {
  trades: EquityTrade[];
}

export default function StockPnL({ trades }: StockPnLProps) {
  const [sortKey, setSortKey] = useState<SortKey>('pnl_desc');
  const [filter,  setFilter]  = useState<FilterKey>('all');
  const [topN,    setTopN]    = useState(20);

  const allStocks = useMemo(() => aggregateByStock(trades), [trades]);

  const displayed = useMemo(() => {
    let list = allStocks;
    if (filter === 'wins')   list = list.filter(s => s.totalPnl > 0);
    if (filter === 'losses') list = list.filter(s => s.totalPnl < 0);
    list = sortStocks(list, sortKey);
    return list.slice(0, topN);
  }, [allStocks, sortKey, filter, topN]);

  const tooltipPlugin = useMemo(() => buildTooltipPlugin(displayed), [displayed]);

  const summary = useMemo(() => {
    const wins  = allStocks.filter(s => s.totalPnl > 0);
    const losses = allStocks.filter(s => s.totalPnl < 0);
    const best  = [...allStocks].sort((a, b) => b.totalPnl - a.totalPnl)[0] ?? null;
    const worst = [...allStocks].sort((a, b) => a.totalPnl - b.totalPnl)[0] ?? null;
    return { wins: wins.length, losses: losses.length, best, worst };
  }, [allStocks]);

  if (trades.length === 0) return null;

  const barThickness = Math.max(12, Math.min(20, Math.floor(400 / displayed.length)));
  const chartHeight  = Math.max(200, displayed.length * (barThickness + 6) + 40);

  const labels   = displayed.map(s => s.stock);
  const values   = displayed.map(s => s.totalPnl);
  const bgColors = values.map(v => v >= 0 ? WIN_BG    : LOSS_BG);
  const bdColors = values.map(v => v >= 0 ? WIN_COLOR : LOSS_COLOR);
  const maxAbs   = Math.max(...values.map(Math.abs), 1);

  const chartData = {
    labels,
    datasets: [{
      label: 'P&L',
      data: values,
      backgroundColor: bgColors,
      borderColor: bdColors,
      borderWidth: { left: 0, right: 0, top: 0, bottom: 0 },
      borderRadius: { topRight: 3, bottomRight: 3, topLeft: 3, bottomLeft: 3 },
      borderSkipped: false as const,
      barThickness,
    }],
  };

  const chartOptions = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
    },
    layout: { padding: { right: 12 } },
    scales: {
      x: {
        min: -maxAbs * 1.15,
        max:  maxAbs * 1.15,
        grid: { color: 'rgba(255,255,255,0.04)' },
        border: { display: false },
        ticks: {
          color: '#888780',
          font: { size: 10 },
          callback: (v: number | string) => {
            const n = Number(v);
            if (n === 0) return '0';
            const abs = Math.abs(n);
            const str = abs >= 1e5 ? (abs / 1e5).toFixed(0) + 'L' : (abs / 1e3).toFixed(0) + 'K';
            return (n < 0 ? '-' : '+') + '₹' + str;
          },
          maxTicksLimit: 7,
        },
      },
      y: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          color: '#B0AFA8',
          font: { size: 11, weight: 500 },
        },
      },
    },
  };

  return (
    <div className="bg-surface-container border border-outline-variant">

      {/* Header */}
      <div className="px-4 py-3 border-b border-outline-variant flex items-center justify-between">
        <span className="text-sm font-bold text-on-surface">Stock P&amp;L</span>
        <div className="flex items-center gap-3 text-xs text-on-surface-variant">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-0.5 bg-[#1D9E75] rounded" />Profit
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-0.5 bg-[#E24B4A] rounded" />Loss
          </span>
        </div>
      </div>

      {/* Metric cards */}
      <div className="px-4 pt-3 pb-0 grid grid-cols-3 gap-2">
        <MetricCard label="Stocks traded"  value={String(allStocks.length)} />
        <MetricCard label="Profitable"     value={String(summary.wins)}   positive />
        <MetricCard label="Unprofitable"   value={String(summary.losses)} negative />
        {summary.best  && <MetricCard label="Best stock"  value={`${summary.best.stock}  +${fmt(summary.best.totalPnl)}`}  positive />}
        {summary.worst && <MetricCard label="Worst stock" value={`${summary.worst.stock}  ${fmt(summary.worst.totalPnl)}`} negative />}
      </div>

      {/* Controls */}
      <div className="px-4 pt-3 pb-0 flex flex-wrap gap-3">
        {/* Show filter */}
        <div className="flex items-center gap-0">
          <span className="text-[10px] font-label-caps uppercase text-on-surface-variant mr-2">Show</span>
          <div className="flex border border-outline-variant overflow-hidden">
            {FILTER_OPTIONS.map(f => (
              <Pill key={f.key} label={f.label} active={filter === f.key} onClick={() => setFilter(f.key)} />
            ))}
          </div>
        </div>
        {/* Sort */}
        <div className="flex items-center gap-0">
          <span className="text-[10px] font-label-caps uppercase text-on-surface-variant mr-2">Sort</span>
          <div className="flex border border-outline-variant overflow-hidden">
            {SORT_OPTIONS.map(o => (
              <Pill key={o.key} label={o.label} active={sortKey === o.key} onClick={() => setSortKey(o.key)} />
            ))}
          </div>
        </div>
        {/* Top N */}
        <div className="flex items-center gap-0">
          <span className="text-[10px] font-label-caps uppercase text-on-surface-variant mr-2">Top</span>
          <div className="flex border border-outline-variant overflow-hidden">
            {[10, 20, 50].map(n => (
              <Pill key={n} label={String(n)} active={topN === n} onClick={() => setTopN(n)} />
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="px-4 py-4" style={{ height: chartHeight, position: 'relative' }}>
        <Bar data={chartData} options={chartOptions} plugins={[tooltipPlugin]} />
      </div>

      {/* Show all prompt */}
      {displayed.length < allStocks.length && (
        <div className="px-4 pb-3 text-center text-xs text-on-surface-variant">
          Showing {displayed.length} of {allStocks.length} stocks.{' '}
          <button onClick={() => setTopN(allStocks.length)} className="text-primary hover:underline font-semibold">
            Show all
          </button>
        </div>
      )}
    </div>
  );
}
