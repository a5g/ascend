import { useState, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement,
  PointElement, LineElement,
  RadialLinearScale, ArcElement,
  Tooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Radar } from 'react-chartjs-2';
import type { EquityTrade } from './EquityCurve';

ChartJS.register(
  CategoryScale, LinearScale, BarElement,
  PointElement, LineElement,
  RadialLinearScale, ArcElement,
  Tooltip, Legend, Filler,
);

/* ─── constants ─────────────────────────────────────────────────── */

const WIN_COLOR   = '#1D9E75';
const WIN_STRONG  = 'rgba(29,158,117,0.82)';
const LOSS_COLOR  = '#E24B4A';
const LOSS_STRONG = 'rgba(226,75,74,0.82)';
const AMBER       = '#EF9F27';
const GRID_COLOR  = 'rgba(136,135,128,0.08)';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_FULL  = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];

const VIEW_OPTIONS = [
  { key: 'winrate' , label: 'Win rate'     },
  { key: 'pnl'     , label: 'Avg P&L'      },
  { key: 'stacked' , label: 'Win vs loss'  },
  { key: 'radar'   , label: 'Radar'        },
  { key: 'heatmap' , label: 'Year heatmap' },
] as const;
type ViewKey = typeof VIEW_OPTIONS[number]['key'];

const METRIC_OPTIONS = [
  { key: 'winrate', label: 'Win rate %'  },
  { key: 'avgpnl' , label: 'Avg P&L ₹'  },
  { key: 'trades' , label: 'Trade count' },
] as const;
type MetricKey = typeof METRIC_OPTIONS[number]['key'];

const PERIOD_OPTIONS = [
  { key: 'all', label: 'All time' },
  { key: '1',  label: '1 year'   },
  { key: '2',  label: '2 years'  },
  { key: '3',  label: '3 years'  },
] as const;

/* ─── types ─────────────────────────────────────────────────────── */

interface MonthStat {
  month: number;
  trades: EquityTrade[];
  wins: number; losses: number;
  totalPnl: number; avgPnl: number;
  winRate: number; avgReturnPct: number;
  bestTrade: EquityTrade | null;
  worstTrade: EquityTrade | null;
}
type MatrixCell = { wins: number; losses: number; pnl: number; trades: number };
interface EntryData {
  monthly: MonthStat[]; years: number[];
  matrix: Record<number, Record<number, MatrixCell>>;
  best: MonthStat | null; worst: MonthStat | null; mostActive: MonthStat | null;
  avgWinRate: number;
}

/* ─── helpers ───────────────────────────────────────────────────── */

function fmt(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 100000) return '₹' + (abs / 100000).toFixed(1) + 'L';
  if (abs >= 1000)   return '₹' + (abs / 1000).toFixed(1) + 'K';
  return '₹' + Math.round(abs).toLocaleString('en-IN');
}
const fmtSigned = (n: number) => (n >= 0 ? '+' : '') + fmt(Math.abs(n));

function posSize(t: EquityTrade): number {
  return t.positionSize ?? (Math.abs(t.pnl) * 10 || 50000);
}

function filterByPeriod(trades: EquityTrade[], period: string): EquityTrade[] {
  if (period === 'all') return trades;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - parseInt(period));
  return trades.filter(t => new Date(t.entry_date) >= cutoff);
}

function buildEntryMonthData(trades: EquityTrade[]): EntryData {
  const monthly: MonthStat[] = Array.from({ length: 12 }, (_, m) => ({
    month: m, trades: [], wins: 0, losses: 0,
    totalPnl: 0, avgPnl: 0, winRate: 0, avgReturnPct: 0,
    bestTrade: null, worstTrade: null,
  }));

  for (const t of trades) {
    const m = new Date(t.entry_date).getMonth();
    monthly[m].trades.push(t);
    monthly[m].totalPnl += t.pnl;
    if (t.pnl > 0) monthly[m].wins++;
    else            monthly[m].losses++;
  }

  for (const m of monthly) {
    const n = m.trades.length;
    if (!n) continue;
    m.avgPnl = Math.round(m.totalPnl / n);
    m.winRate = Math.round((m.wins / n) * 100);
    const returns = m.trades.map(t => (t.pnl / posSize(t)) * 100);
    m.avgReturnPct = parseFloat((returns.reduce((s, v) => s + v, 0) / n).toFixed(1));
    const sorted = [...m.trades].sort((a, b) => b.pnl - a.pnl);
    m.bestTrade  = sorted[0] ?? null;
    m.worstTrade = sorted[sorted.length - 1] ?? null;
  }

  const matrix: Record<number, Record<number, MatrixCell>> = {};
  const years: number[] = [];
  for (const t of trades) {
    const y = new Date(t.entry_date).getFullYear();
    const m = new Date(t.entry_date).getMonth();
    if (!matrix[y]) { matrix[y] = {}; years.push(y); }
    if (!matrix[y][m]) matrix[y][m] = { wins: 0, losses: 0, pnl: 0, trades: 0 };
    matrix[y][m].pnl += t.pnl; matrix[y][m].trades++;
    if (t.pnl > 0) matrix[y][m].wins++; else matrix[y][m].losses++;
  }
  years.sort();

  const active = monthly.filter(m => m.trades.length);
  const best       = [...active].sort((a, b) => b.winRate - a.winRate)[0] ?? null;
  const worst      = [...active].sort((a, b) => a.winRate - b.winRate)[0] ?? null;
  const mostActive = [...active].sort((a, b) => b.trades.length - a.trades.length)[0] ?? null;
  const avgWinRate = active.length
    ? active.reduce((s, m) => s + m.winRate, 0) / active.length : 0;

  return { monthly, years, matrix, best, worst, mostActive, avgWinRate };
}

function hmColor(winRate: number, hasTrades: boolean): { bg: string; fg: string } {
  if (!hasTrades) return { bg: 'transparent', fg: '#888780' };
  const ratio = (winRate - 50) / 50;
  if (ratio >= 0) {
    const a = 0.12 + ratio * 0.70;
    return { bg: `rgba(29,158,117,${a.toFixed(2)})`, fg: ratio > 0.5 ? '#fff' : '#6EE7C0' };
  }
  const a = 0.12 + Math.abs(ratio) * 0.70;
  return { bg: `rgba(226,75,74,${a.toFixed(2)})`, fg: Math.abs(ratio) > 0.5 ? '#fff' : '#F08080' };
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

/* ─── WinRateView ───────────────────────────────────────────────── */

function WinRateView({ monthly, avgWinRate }: { monthly: MonthStat[]; avgWinRate: number }) {
  const tooltipPlugin = useMemo(() => ({
    id: 'emTooltip',
    afterDraw(chart: ChartJS) {
      const { tooltip } = chart as ChartJS & { tooltip?: { opacity: number; caretX: number; dataPoints?: { dataIndex: number }[] } };
      if (!tooltip || tooltip.opacity === 0) return;
      const idx = tooltip.dataPoints?.[0]?.dataIndex;
      if (idx == null) return;
      const m = monthly[idx];
      if (!m.trades.length) return;

      const bg = '#1C2333', brdr = 'rgba(255,255,255,0.10)';
      const textP = '#E8E7DF', textM = '#888780';
      const ctx = chart.ctx;
      const bw = 192, bh = 110, pad = 12, r = 8;
      const cx = tooltip.caretX;
      let bx = cx + 12;
      if (bx + bw > chart.chartArea.right + 20) bx = cx - bw - 12;
      const by = chart.chartArea.top + 8;

      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 10;
      ctx.fillStyle = bg; ctx.strokeStyle = brdr; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, r);
      ctx.fill(); ctx.stroke(); ctx.restore();

      ctx.save();
      ctx.font = `500 12px 'DM Sans', sans-serif`;
      ctx.fillStyle = textP;
      ctx.fillText(MONTH_FULL[m.month] + ' entries', bx + pad, by + pad + 12);
      ctx.font = `400 11px 'DM Sans', sans-serif`;

      const rows: [string, string, string][] = [
        ['Trades entered', String(m.trades.length),                               textP],
        ['Win rate',       m.winRate + '%',                                        m.winRate >= 50 ? WIN_COLOR : LOSS_COLOR],
        ['Avg P&L',        fmtSigned(m.avgPnl),                                   m.avgPnl >= 0 ? WIN_COLOR : LOSS_COLOR],
        ['Avg return',     (m.avgReturnPct >= 0 ? '+' : '') + m.avgReturnPct.toFixed(1) + '%', m.avgReturnPct >= 0 ? WIN_COLOR : LOSS_COLOR],
        ['Best entry',     m.bestTrade?.stock  ?? '—',                             WIN_COLOR],
        ['Worst entry',    m.worstTrade?.stock ?? '—',                             LOSS_COLOR],
      ];
      rows.forEach(([label, val, color], i) => {
        const y = by + pad + 28 + i * 14;
        ctx.fillStyle = textM; ctx.fillText(label, bx + pad, y);
        ctx.fillStyle = color;
        ctx.fillText(val, bx + bw - pad - ctx.measureText(val).width, y);
      });
      ctx.restore();
    },
  }), [monthly]);

  const avgLinePlugin = useMemo(() => ({
    id: 'avgLine',
    afterDraw(chart: ChartJS) {
      const ctx = chart.ctx;
      const yScale = (chart.scales as Record<string, { getPixelForValue: (v: number) => number }>)['y'];
      if (!yScale) return;
      const y = yScale.getPixelForValue(avgWinRate);
      const { left, right } = chart.chartArea;
      ctx.save();
      ctx.strokeStyle = AMBER; ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = AMBER;
      ctx.font = `500 10px 'DM Sans', sans-serif`;
      ctx.fillText('Avg ' + avgWinRate.toFixed(0) + '%', right - 52, y - 4);
      ctx.restore();
    },
  }), [avgWinRate]);

  const chartData = {
    labels: MONTH_NAMES,
    datasets: [{
      label: 'Win rate %',
      data: monthly.map(m => m.trades.length ? m.winRate : null),
      backgroundColor: monthly.map(m =>
        !m.trades.length ? 'transparent' : m.winRate >= 50 ? WIN_STRONG : LOSS_STRONG),
      borderWidth: 0,
      borderRadius: { topLeft: 5, topRight: 5, bottomLeft: 5, bottomRight: 5 },
      borderSkipped: false as const,
      barThickness: 36,
    }],
  };

  const opts = {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: { grid: { display: false }, border: { display: false },
        ticks: { color: '#888780', font: { size: 12 } } },
      y: { min: 0, max: 100,
        grid: { color: GRID_COLOR, drawBorder: false }, border: { display: false },
        ticks: { color: '#888780', font: { size: 11 },
          callback: (v: string | number) => v + '%', stepSize: 25 } },
    },
  };

  return (
    <div className="relative w-full" style={{ height: 280 }}>
      <Bar data={chartData} options={opts} plugins={[avgLinePlugin, tooltipPlugin]} />
    </div>
  );
}

/* ─── AvgPnLView ────────────────────────────────────────────────── */

function AvgPnLView({ monthly }: { monthly: MonthStat[] }) {
  const chartData = {
    labels: MONTH_NAMES,
    datasets: [{
      label: 'Avg P&L per trade',
      data: monthly.map(m => m.trades.length ? m.avgPnl : null),
      backgroundColor: monthly.map(m =>
        !m.trades.length ? 'transparent' : m.avgPnl >= 0 ? WIN_STRONG : LOSS_STRONG),
      borderWidth: 0,
      borderRadius: { topLeft: 5, topRight: 5, bottomLeft: 5, bottomRight: 5 },
      borderSkipped: false as const,
      barThickness: 36,
    }],
  };

  const opts = {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items: { dataIndex: number }[]) => MONTH_FULL[items[0].dataIndex] + ' entries',
          label: (ctx: { dataIndex: number }) => {
            const m = monthly[ctx.dataIndex];
            return [` Avg P&L: ${fmtSigned(m.avgPnl)}`, ` Trades: ${m.trades.length}`, ` Win rate: ${m.winRate}%`];
          },
        },
        backgroundColor: '#1C2333', padding: 10, cornerRadius: 8,
        bodyFont: { family: "'DM Sans', sans-serif", size: 12 },
        bodyColor: '#E8E7DF', titleColor: '#E8E7DF',
      },
    },
    scales: {
      x: { grid: { display: false }, border: { display: false },
        ticks: { color: '#888780', font: { size: 12 } } },
      y: { grid: { color: GRID_COLOR, drawBorder: false }, border: { display: false },
        ticks: {
          color: '#888780', font: { size: 11 },
          callback: (v: string | number) => {
            const n = Number(v);
            return n === 0 ? '0' : (n > 0 ? '+' : '-') + fmt(Math.abs(n));
          },
        },
      },
    },
  };

  return (
    <div className="relative w-full" style={{ height: 280 }}>
      <Bar data={chartData} options={opts} />
    </div>
  );
}

/* ─── StackedView ───────────────────────────────────────────────── */

function StackedView({ monthly }: { monthly: MonthStat[] }) {
  const chartData = {
    labels: MONTH_NAMES,
    datasets: [
      {
        label: 'Winners',
        data: monthly.map(m => m.wins),
        backgroundColor: WIN_STRONG,
        borderRadius: { topLeft: 5, topRight: 5, bottomLeft: 0, bottomRight: 0 },
        borderSkipped: 'bottom' as const,
        barThickness: 36,
      },
      {
        label: 'Losers',
        data: monthly.map(m => m.losses),
        backgroundColor: LOSS_STRONG,
        borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 5, bottomRight: 5 },
        borderSkipped: 'top' as const,
        barThickness: 36,
      },
    ],
  };

  const opts = {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: {
        display: true, position: 'bottom' as const,
        labels: { boxWidth: 12, boxHeight: 3, font: { size: 11 }, color: '#888780', padding: 16 },
      },
      tooltip: {
        callbacks: {
          title: (items: { dataIndex: number }[]) => MONTH_FULL[items[0].dataIndex] + ' entries',
          label: (ctx: { dataset: { label?: string }; raw: unknown }) => ` ${ctx.dataset.label ?? ''}: ${ctx.raw}`,
          afterLabel: (ctx: { dataIndex: number }) => {
            const m = monthly[ctx.dataIndex];
            return ` Win rate: ${m.winRate}%  |  Avg P&L: ${fmtSigned(m.avgPnl)}`;
          },
        },
        backgroundColor: '#1C2333', padding: 10, cornerRadius: 8,
        bodyFont: { family: "'DM Sans', sans-serif", size: 12 },
        bodyColor: '#E8E7DF', titleColor: '#E8E7DF',
      },
    },
    scales: {
      x: { stacked: true, grid: { display: false }, border: { display: false },
        ticks: { color: '#888780', font: { size: 12 } } },
      y: { stacked: true,
        grid: { color: GRID_COLOR, drawBorder: false }, border: { display: false },
        ticks: { color: '#888780', font: { size: 11 },
          stepSize: 1, callback: (v: string | number) => Number.isInteger(Number(v)) ? v : '' } },
    },
  };

  return (
    <div className="relative w-full" style={{ height: 280 }}>
      <Bar data={chartData} options={opts} />
    </div>
  );
}

/* ─── RadarView ─────────────────────────────────────────────────── */

function RadarView({ monthly }: { monthly: MonthStat[] }) {
  const chartData = {
    labels: MONTH_NAMES,
    datasets: [
      {
        label: 'Win rate %',
        data: monthly.map(m => m.trades.length ? m.winRate : 0),
        backgroundColor: 'rgba(29,158,117,0.12)',
        borderColor: WIN_COLOR, borderWidth: 2,
        pointBackgroundColor: monthly.map(m => m.winRate >= 50 ? WIN_COLOR : LOSS_COLOR),
        pointRadius: 4,
      },
      {
        label: 'Avg target (50%)',
        data: Array(12).fill(50),
        backgroundColor: 'transparent',
        borderColor: 'rgba(180,178,169,0.3)',
        borderWidth: 1,
        borderDash: [4, 4],
        pointRadius: 0,
      },
    ],
  };

  const opts = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true, position: 'bottom' as const,
        labels: { boxWidth: 12, boxHeight: 2, font: { size: 11 }, color: '#888780', padding: 16 },
      },
      tooltip: {
        callbacks: {
          label: (ctx: { datasetIndex: number; dataIndex: number }) => {
            const m = monthly[ctx.dataIndex];
            if (ctx.datasetIndex === 1) return '';
            return [` Win rate: ${m.winRate}%`, ` Trades: ${m.trades.length}`, ` Avg P&L: ${fmtSigned(m.avgPnl)}`];
          },
        },
        backgroundColor: '#1C2333', padding: 10, cornerRadius: 8,
        bodyFont: { family: "'DM Sans', sans-serif", size: 12 },
        bodyColor: '#E8E7DF', titleColor: '#E8E7DF',
        filter: (item: { datasetIndex: number }) => item.datasetIndex === 0,
      },
    },
    scales: {
      r: {
        min: 0, max: 100,
        angleLines: { color: GRID_COLOR },
        grid: { color: GRID_COLOR },
        pointLabels: { color: '#888780', font: { size: 11 } },
        ticks: {
          color: '#888780', font: { size: 9 },
          backdropColor: 'transparent', stepSize: 25,
          callback: (v: string | number) => v + '%',
        },
      },
    },
  };

  return (
    <div className="relative w-full" style={{ height: 320 }}>
      <Radar data={chartData} options={opts} />
    </div>
  );
}

/* ─── HeatmapView ───────────────────────────────────────────────── */

function HeatmapView({ monthly, years, matrix, metric }: {
  monthly: MonthStat[]; years: number[];
  matrix: EntryData['matrix']; metric: MetricKey;
}) {
  const maxAbs = useMemo(() => {
    let m = 0;
    for (const y of years)
      for (let mo = 0; mo < 12; mo++) {
        const c = matrix[y]?.[mo];
        if (c) m = Math.max(m, Math.abs(c.pnl));
      }
    return m || 1;
  }, [matrix, years]);

  void monthly;

  return (
    <div className="flex flex-col gap-3">
      {/* Header row */}
      <div className="grid gap-1" style={{ gridTemplateColumns: '48px repeat(12, 1fr)' }}>
        <div />
        {MONTH_NAMES.map(m => (
          <div key={m} className="text-center text-[10px] font-medium text-on-surface-variant">{m}</div>
        ))}
      </div>

      {years.map(year => (
        <div key={year} className="grid gap-1 items-center" style={{ gridTemplateColumns: '48px repeat(12, 1fr)' }}>
          <div className="text-[11px] font-medium text-on-surface-variant text-right pr-2">{year}</div>
          {Array.from({ length: 12 }, (_, m) => {
            const cell = matrix[year]?.[m] ?? null;
            const wr = cell ? Math.round((cell.wins / cell.trades) * 100) : null;
            const hasTrades = !!cell;

            const { bg, fg } = hmColor(wr ?? 0, hasTrades);
            const bgFinal = metric === 'avgpnl' && cell
              ? cell.pnl >= 0
                ? `rgba(29,158,117,${(0.12 + Math.min(Math.abs(cell.pnl) / maxAbs, 1) * 0.70).toFixed(2)})`
                : `rgba(226,75,74,${(0.12 + Math.min(Math.abs(cell.pnl) / maxAbs, 1) * 0.70).toFixed(2)})`
              : bg;

            return (
              <div
                key={m}
                title={hasTrades
                  ? `${MONTH_FULL[m]} ${year} entries\nWin rate: ${wr}%\nAvg P&L: ${fmtSigned(Math.round(cell!.pnl / cell!.trades))}\nTrades: ${cell!.trades}`
                  : `${MONTH_FULL[m]} ${year} — no entries`}
                style={{
                  background: bgFinal,
                  border: '0.5px solid rgba(255,255,255,0.07)',
                  borderRadius: 6, height: 36,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                {hasTrades ? (
                  <>
                    <span style={{ fontSize: 10, fontWeight: 600, color: fg, lineHeight: 1.1 }}>
                      {metric === 'winrate' ? wr + '%'
                        : metric === 'avgpnl' ? fmtSigned(Math.round(cell!.pnl / cell!.trades))
                        : cell!.trades + 'T'}
                    </span>
                    {metric !== 'trades' && (
                      <span style={{ fontSize: 9, color: fg, opacity: 0.75 }}>{cell!.trades}T</span>
                    )}
                  </>
                ) : (
                  <span className="text-[11px] text-on-surface-variant opacity-30">—</span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ─── main component ─────────────────────────────────────────────── */

export default function EntryMonthAnalysis({ trades = [] }: { trades?: EquityTrade[] }) {
  const [view,     setView    ] = useState<ViewKey>('winrate');
  const [period,   setPeriod  ] = useState('all');
  const [hmMetric, setHmMetric] = useState<MetricKey>('winrate');

  const filtered = useMemo(() => filterByPeriod(trades, period), [trades, period]);
  const data     = useMemo(() => buildEntryMonthData(filtered), [filtered]);

  const hotMonths  = data.monthly
    .filter(m => m.trades.length && m.winRate >= data.avgWinRate + 5)
    .sort((a, b) => b.winRate - a.winRate);
  const coldMonths = data.monthly
    .filter(m => m.trades.length && m.winRate < data.avgWinRate - 5)
    .sort((a, b) => a.winRate - b.winRate);

  if (!trades.length) {
    return (
      <div className="bg-surface-container rounded-2xl border border-outline-variant p-6 flex items-center justify-center">
        <p className="text-sm text-on-surface-variant">No closed trades found.</p>
      </div>
    );
  }

  return (
    <div className="bg-surface-container rounded-2xl border border-outline-variant p-5 flex flex-col gap-4">
      {/* Header */}
      <span className="text-sm font-bold text-on-surface">Entry Month Analysis</span>

      {/* Summary metrics */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        <MetricCard label="Total trades"     value={filtered.length} />
        <MetricCard label="Avg win rate"     value={data.avgWinRate.toFixed(0) + '%'}
          color={data.avgWinRate >= 50 ? WIN_COLOR : LOSS_COLOR} />
        {data.best && (
          <MetricCard label="Best entry month"  value={MONTH_NAMES[data.best.month]}
            sub={data.best.winRate + '% WR · ' + data.best.trades.length + ' trades'} color={WIN_COLOR} />
        )}
        {data.worst && (
          <MetricCard label="Worst entry month" value={MONTH_NAMES[data.worst.month]}
            sub={data.worst.winRate + '% WR · ' + data.worst.trades.length + ' trades'} color={LOSS_COLOR} />
        )}
        {data.mostActive && (
          <MetricCard label="Most active"       value={MONTH_NAMES[data.mostActive.month]}
            sub={data.mostActive.trades.length + ' trades entered'} />
        )}
        <MetricCard label="Hot months"  value={hotMonths.length} sub="above avg WR" color={WIN_COLOR} />
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
        {view === 'heatmap' && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-on-surface-variant min-w-[44px]">Show:</span>
            {METRIC_OPTIONS.map(m => (
              <Pill key={m.key} label={m.label} active={hmMetric === m.key} onClick={() => setHmMetric(m.key)} />
            ))}
          </div>
        )}
      </div>

      {/* Chart */}
      {view === 'winrate'  && <WinRateView  monthly={data.monthly} avgWinRate={data.avgWinRate} />}
      {view === 'pnl'      && <AvgPnLView   monthly={data.monthly} />}
      {view === 'stacked'  && <StackedView  monthly={data.monthly} />}
      {view === 'radar'    && <RadarView    monthly={data.monthly} />}
      {view === 'heatmap'  && (
        <HeatmapView monthly={data.monthly} years={data.years} matrix={data.matrix} metric={hmMetric} />
      )}

      {/* Hot / cold insights */}
      {(hotMonths.length > 0 || coldMonths.length > 0) && (
        <div className="flex flex-col gap-2">
          {hotMonths.length > 0 && (
            <div className="flex gap-2.5 items-start px-3 py-2.5 rounded-xl text-xs leading-relaxed border"
              style={{ background: WIN_COLOR + '08', borderColor: WIN_COLOR + '30' }}>
              <span style={{ color: WIN_COLOR }} className="mt-0.5">🔥</span>
              <span className="text-on-surface">
                <strong style={{ color: WIN_COLOR }}>Best months to enter: </strong>
                {hotMonths.map(m => MONTH_NAMES[m.month] + ' (' + m.winRate + '%)').join(', ')}.
                {' '}Trades entered in these months have a win rate {(hotMonths[0].winRate - data.avgWinRate).toFixed(0)}%+ above your average.
              </span>
            </div>
          )}
          {coldMonths.length > 0 && (
            <div className="flex gap-2.5 items-start px-3 py-2.5 rounded-xl text-xs leading-relaxed border"
              style={{ background: LOSS_COLOR + '08', borderColor: LOSS_COLOR + '30' }}>
              <span style={{ color: LOSS_COLOR }} className="mt-0.5">❄️</span>
              <span className="text-on-surface">
                <strong style={{ color: LOSS_COLOR }}>Months to be cautious: </strong>
                {coldMonths.map(m => MONTH_NAMES[m.month] + ' (' + m.winRate + '%)').join(', ')}.
                {' '}Consider reducing position sizes or being more selective when entering in these months.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Month breakdown table */}
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant mb-2">
          Month-by-month breakdown
        </p>
        <div className="flex flex-col gap-1">
          {data.monthly
            .filter(m => m.trades.length > 0)
            .sort((a, b) => b.winRate - a.winRate)
            .map(m => (
              <div key={m.month}
                className="flex items-center gap-2.5 px-3 py-2 bg-surface-container-high rounded-xl border border-outline-variant text-xs flex-wrap">
                <span className="font-medium text-on-surface min-w-[28px]">{MONTH_NAMES[m.month]}</span>
                <div className="flex-1 min-w-[60px] h-1.5 bg-surface-container rounded-full overflow-hidden">
                  <div style={{ width: m.winRate + '%', background: m.winRate >= data.avgWinRate ? WIN_COLOR : LOSS_COLOR }}
                    className="h-full rounded-full" />
                </div>
                <span className="font-medium min-w-[36px]" style={{ color: m.winRate >= 50 ? WIN_COLOR : LOSS_COLOR }}>
                  {m.winRate}%
                </span>
                <span className="font-medium min-w-[56px] text-right" style={{ color: m.avgPnl >= 0 ? WIN_COLOR : LOSS_COLOR }}>
                  {fmtSigned(m.avgPnl)}
                </span>
                <span className="text-on-surface-variant min-w-[52px]">
                  {m.trades.length} trade{m.trades.length !== 1 ? 's' : ''}
                </span>
                {m.winRate >= data.avgWinRate + 5 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                    style={{ background: 'rgba(29,158,117,0.12)', color: WIN_COLOR, border: '0.5px solid rgba(29,158,117,0.3)' }}>
                    Hot
                  </span>
                )}
                {m.winRate < data.avgWinRate - 5 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                    style={{ background: 'rgba(226,75,74,0.10)', color: LOSS_COLOR, border: '0.5px solid rgba(226,75,74,0.3)' }}>
                    Cold
                  </span>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
