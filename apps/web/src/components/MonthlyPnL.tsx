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

const WIN_COLOR   = '#1D9E75';
const WIN_STRONG  = 'rgba(29,158,117,0.85)';
const LOSS_COLOR  = '#E24B4A';
const LOSS_STRONG = 'rgba(226,75,74,0.85)';
const CUMUL_COLOR = '#534AB7';
const GRID_COLOR  = 'rgba(136,135,128,0.08)';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_FULL  = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];

const YEAR_PALETTE = ['#534AB7','#1D9E75','#EF9F27','#E24B4A','#0EA5E9','#A855F7','#F43F5E','#10B981'];

const VIEW_OPTIONS = [
  { key: 'bar'     , label: 'Monthly bars'   },
  { key: 'calendar', label: 'Calendar view'  },
  { key: 'seasonal', label: 'Seasonality'    },
  { key: 'cumul'   , label: 'Cumulative P&L' },
] as const;
type ViewKey = typeof VIEW_OPTIONS[number]['key'];

/* ─── types ─────────────────────────────────────────────────────── */

interface MonthEntry {
  year: number; month: number; label: string;
  pnl: number; trades: number; wins: number; winRate: number;
}
interface SeasonalEntry { month: number; avg: number | null; winRate: number | null; count: number; }
interface YearTotal { year: number; pnl: number; months: number; wins: number; }
interface MonthlyData {
  monthly: MonthEntry[]; years: number[];
  seasonal: SeasonalEntry[]; bestMonth: MonthEntry | null; worstMonth: MonthEntry | null;
  maxWinStreak: number; maxLossStreak: number;
  map: Record<number, Record<number, { pnl: number; trades: number; wins: number }>>;
  yearTotals: YearTotal[];
}

/* ─── helpers ───────────────────────────────────────────────────── */

function fmt(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 100000) return '₹' + (abs / 100000).toFixed(1) + 'L';
  if (abs >= 1000)   return '₹' + (abs / 1000).toFixed(1) + 'K';
  return '₹' + Math.round(abs).toLocaleString('en-IN');
}
const fmtSigned = (n: number) => (n >= 0 ? '+' : '') + fmt(Math.abs(n));

function buildMonthlyData(trades: EquityTrade[]): MonthlyData {
  const map: Record<number, Record<number, { pnl: number; trades: number; wins: number }>> = {};
  for (const t of trades) {
    const d = new Date(t.exit_date);
    const y = d.getFullYear(), m = d.getMonth();
    if (!map[y]) map[y] = {};
    if (!map[y][m]) map[y][m] = { pnl: 0, trades: 0, wins: 0 };
    map[y][m].pnl    += t.pnl;
    map[y][m].trades += 1;
    map[y][m].wins   += t.pnl > 0 ? 1 : 0;
  }

  const years = Object.keys(map).map(Number).sort();
  const monthly: MonthEntry[] = [];
  for (const year of years) {
    for (let m = 0; m < 12; m++) {
      const cell = map[year][m];
      if (cell) monthly.push({
        year, month: m,
        label: MONTH_NAMES[m] + ' ' + String(year).slice(2),
        pnl: Math.round(cell.pnl), trades: cell.trades,
        wins: cell.wins, winRate: Math.round((cell.wins / cell.trades) * 100),
      });
    }
  }

  const seasonal: SeasonalEntry[] = Array.from({ length: 12 }, (_, m) => {
    const entries = monthly.filter(e => e.month === m);
    return {
      month: m,
      avg: entries.length ? Math.round(entries.reduce((s, e) => s + e.pnl, 0) / entries.length) : null,
      winRate: entries.length ? Math.round(entries.filter(e => e.pnl > 0).length / entries.length * 100) : null,
      count: entries.length,
    };
  });

  const sorted = [...monthly].sort((a, b) => b.pnl - a.pnl);
  let maxWinStreak = 0, maxLossStreak = 0, curW = 0, curL = 0;
  for (const m of monthly) {
    if (m.pnl > 0) { curW++; curL = 0; maxWinStreak  = Math.max(maxWinStreak, curW); }
    else           { curL++; curW = 0; maxLossStreak = Math.max(maxLossStreak, curL); }
  }

  const yearTotals: YearTotal[] = years.map(y => ({
    year: y,
    pnl: monthly.filter(m => m.year === y).reduce((s, m) => s + m.pnl, 0),
    months: monthly.filter(m => m.year === y).length,
    wins: monthly.filter(m => m.year === y && m.pnl > 0).length,
  }));

  return { monthly, years, seasonal, bestMonth: sorted[0] ?? null,
    worstMonth: sorted[sorted.length - 1] ?? null,
    maxWinStreak, maxLossStreak, map, yearTotals };
}

/* ─── canvas tooltip ────────────────────────────────────────────── */

function buildBarTooltip(monthly: MonthEntry[]) {
  return {
    id: 'mpTooltip',
    afterDraw(chart: ChartJS) {
      const { tooltip } = chart as ChartJS & { tooltip?: { opacity: number; caretX: number; dataPoints?: { dataIndex: number }[] } };
      if (!tooltip || tooltip.opacity === 0) return;
      const idx = tooltip.dataPoints?.[0]?.dataIndex;
      if (idx == null) return;
      const m = monthly[idx];
      if (!m) return;

      const bg = '#1C2333', brdr = 'rgba(255,255,255,0.10)';
      const textP = '#E8E7DF', textM = '#888780';

      const ctx = chart.ctx;
      const bw = 180, bh = 88, pad = 12, r = 8;
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
      ctx.fillText(MONTH_FULL[m.month] + ' ' + m.year, bx + pad, by + pad + 11);

      ctx.font = `400 11px 'DM Sans', sans-serif`;
      const rows: [string, string, string][] = [
        ['P&L',      fmtSigned(m.pnl),    m.pnl >= 0 ? WIN_COLOR : LOSS_COLOR],
        ['Trades',   String(m.trades),     textP],
        ['Win rate', m.winRate + '%',      m.winRate >= 50 ? WIN_COLOR : LOSS_COLOR],
      ];
      rows.forEach(([label, val, color], i) => {
        const y = by + pad + 28 + i * 17;
        ctx.fillStyle = textM; ctx.fillText(label, bx + pad, y);
        ctx.fillStyle = color;
        ctx.fillText(val, bx + bw - pad - ctx.measureText(val).width, y);
      });
      ctx.restore();
    },
  };
}

/* ─── calendar cell color ───────────────────────────────────────── */

function calCellColor(pnl: number | null, maxAbs: number): { bg: string; fg: string } {
  if (pnl == null) return { bg: 'transparent', fg: '#888780' };
  if (pnl === 0)   return { bg: 'rgba(180,178,169,0.12)', fg: '#73726C' };
  const ratio = Math.min(Math.abs(pnl) / (maxAbs || 1), 1);
  const alpha = 0.15 + ratio * 0.70;
  if (pnl > 0) return {
    bg: `rgba(29,158,117,${alpha.toFixed(2)})`,
    fg: ratio > 0.55 ? '#fff' : '#6EE7C0',
  };
  return {
    bg: `rgba(226,75,74,${alpha.toFixed(2)})`,
    fg: ratio > 0.55 ? '#fff' : '#F08080',
  };
}

/* ─── Pill ──────────────────────────────────────────────────────── */

function Pill({ label, active, onClick }: { label: string | number; active: boolean; onClick: () => void }) {
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

/* ─── BarView ───────────────────────────────────────────────────── */

function BarView({ monthly, selectedYear }: { monthly: MonthEntry[]; selectedYear: 'all' | number }) {
  const data = selectedYear === 'all' ? monthly : monthly.filter(m => m.year === selectedYear);
  const tooltipPlugin = useMemo(() => buildBarTooltip(data), [data]);

  const chartData = {
    labels: data.map(m => m.label),
    datasets: [{
      label: 'Monthly P&L',
      data: data.map(m => m.pnl),
      backgroundColor: data.map(m => m.pnl >= 0 ? WIN_STRONG : LOSS_STRONG),
      borderColor: data.map(m => m.pnl >= 0 ? WIN_COLOR : LOSS_COLOR),
      borderWidth: 0,
      borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 4, bottomRight: 4 },
      borderSkipped: false as const,
      barThickness: Math.max(8, Math.min(28, 600 / Math.max(data.length, 1))),
    }],
  };

  const opts = {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: {
        grid: { display: false }, border: { display: false },
        ticks: { color: '#888780', font: { size: 10, family: "'DM Sans', sans-serif" },
          maxRotation: 45, autoSkip: true,
          maxTicksLimit: data.length > 36 ? 18 : data.length },
      },
      y: {
        grid: { color: GRID_COLOR, drawBorder: false }, border: { display: false },
        ticks: {
          color: '#888780', font: { size: 11, family: "'DM Sans', sans-serif" },
          callback: (v: string | number) => {
            const n = Number(v);
            if (n === 0) return '0';
            return (n > 0 ? '+' : '-') + fmt(Math.abs(n));
          },
        },
      },
    },
  };

  return (
    <div className="relative w-full" style={{ height: 300 }}>
      <Bar data={chartData} options={opts} plugins={[tooltipPlugin]} />
    </div>
  );
}

/* ─── CumulView ─────────────────────────────────────────────────── */

function CumulView({ monthly, selectedYear, years }: { monthly: MonthEntry[]; selectedYear: 'all' | number; years: number[] }) {
  const data = selectedYear === 'all' ? monthly : monthly.filter(m => m.year === selectedYear);
  let running = 0;
  const cumulVals = data.map(m => { running += m.pnl; return Math.round(running); });

  const yearDatasets = selectedYear === 'all'
    ? years.map((year, i) => {
        let r = 0;
        return {
          label: String(year),
          data: monthly.filter(m => m.year === year).map(m => { r += m.pnl; return Math.round(r); }),
          borderColor: YEAR_PALETTE[i % YEAR_PALETTE.length],
          borderWidth: 1.5,
          borderDash: [4, 3],
          pointRadius: 0, fill: false, tension: 0.3,
        };
      })
    : [];

  const yMin = Math.min(...cumulVals, 0) * 1.1;
  const yMax = Math.max(...cumulVals, 0) * 1.1;

  const chartData = {
    labels: data.map(m => m.label),
    datasets: [
      ...yearDatasets,
      {
        label: 'Cumulative P&L',
        data: cumulVals,
        borderColor: CUMUL_COLOR, borderWidth: 2.5,
        backgroundColor: 'rgba(83,74,183,0.08)',
        fill: 'origin' as const, tension: 0.35,
        pointRadius: 0, pointHoverRadius: 5,
        pointHoverBackgroundColor: CUMUL_COLOR,
      },
    ],
  };

  const opts = {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: {
        display: selectedYear === 'all' && years.length > 1,
        position: 'bottom' as const,
        labels: { boxWidth: 12, boxHeight: 2, font: { size: 11 }, color: '#888780', padding: 12 },
      },
      tooltip: {
        callbacks: { label: (ctx: { dataset: { label: string }; raw: unknown }) => ` ${ctx.dataset.label}: ${fmtSigned(Number(ctx.raw))}` },
        backgroundColor: '#1C2333', padding: 10, cornerRadius: 8,
        bodyFont: { family: "'DM Sans', sans-serif", size: 12 },
        bodyColor: '#E8E7DF', titleColor: '#E8E7DF',
      },
    },
    scales: {
      x: {
        grid: { display: false }, border: { display: false },
        ticks: { color: '#888780', font: { size: 10 }, maxRotation: 45, autoSkip: true, maxTicksLimit: 18 },
      },
      y: {
        min: yMin, max: yMax,
        grid: { color: GRID_COLOR, drawBorder: false }, border: { display: false },
        ticks: {
          color: '#888780', font: { size: 11 },
          callback: (v: string | number) => {
            const n = Number(v);
            if (n === 0) return '0';
            return (n > 0 ? '+' : n < 0 ? '-' : '') + fmt(Math.abs(n));
          },
        },
      },
    },
  };

  return (
    <div className="relative w-full" style={{ height: 300 }}>
      <Line data={chartData} options={opts} />
    </div>
  );
}

/* ─── CalendarView ──────────────────────────────────────────────── */

function CalendarView({ monthly, years, map }: {
  monthly: MonthEntry[];
  years: number[];
  map: MonthlyData['map'];
}) {
  const maxAbs = useMemo(() => Math.max(...monthly.map(m => Math.abs(m.pnl)), 1), [monthly]);
  const [hovered, setHovered] = useState<{ year: number; month: number } | null>(null);

  return (
    <div className="flex flex-col gap-3">
      {/* Month header */}
      <div className="grid gap-1" style={{ gridTemplateColumns: '48px repeat(12, 1fr)' }}>
        <div />
        {MONTH_NAMES.map(m => (
          <div key={m} className="text-center text-[10px] font-medium text-on-surface-variant">{m}</div>
        ))}
      </div>

      {/* Year rows */}
      {years.map(year => (
        <div key={year} className="grid gap-1 items-center" style={{ gridTemplateColumns: '48px repeat(12, 1fr)' }}>
          <div className="text-[11px] font-medium text-on-surface-variant text-right pr-2">{year}</div>
          {Array.from({ length: 12 }, (_, m) => {
            const cell = map[year]?.[m] ?? null;
            const pnl = cell?.pnl ?? null;
            const { bg, fg } = calCellColor(pnl, maxAbs);
            const isHov = hovered?.year === year && hovered?.month === m;
            return (
              <div
                key={m}
                onMouseEnter={() => cell && setHovered({ year, month: m })}
                onMouseLeave={() => setHovered(null)}
                title={cell
                  ? `${MONTH_FULL[m]} ${year}\nP&L: ${fmtSigned(pnl!)}\nTrades: ${cell.trades}\nWin rate: ${Math.round(cell.wins / cell.trades * 100)}%`
                  : `${MONTH_FULL[m]} ${year} — no trades`}
                style={{
                  background: bg,
                  border: isHov
                    ? `1.5px solid ${(pnl ?? 0) >= 0 ? WIN_COLOR : LOSS_COLOR}`
                    : '0.5px solid rgba(255,255,255,0.07)',
                  borderRadius: 6, height: 38,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  transition: 'border .12s',
                }}
              >
                {cell ? (
                  <>
                    <span style={{ fontSize: 10, fontWeight: 600, color: fg, lineHeight: 1.1 }}>
                      {fmtSigned(pnl!)}
                    </span>
                    <span style={{ fontSize: 9, color: fg, opacity: 0.75 }}>
                      {Math.round(cell.wins / cell.trades * 100)}% WR
                    </span>
                  </>
                ) : (
                  <span className="text-[11px] text-on-surface-variant opacity-30">—</span>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* Color scale */}
      <div className="flex items-center gap-1.5 mt-1 text-[10px] text-on-surface-variant">
        <span>Worst loss</span>
        {['rgba(226,75,74,0.82)','rgba(226,75,74,0.5)','rgba(226,75,74,0.2)',
          'transparent',
          'rgba(29,158,117,0.2)','rgba(29,158,117,0.5)','rgba(29,158,117,0.82)'].map((c, i) => (
          <div key={i} style={{ width: 22, height: 14, background: c, borderRadius: 3,
            border: '0.5px solid rgba(255,255,255,0.08)' }} />
        ))}
        <span>Best win</span>
      </div>
    </div>
  );
}

/* ─── SeasonalView ──────────────────────────────────────────────── */

function SeasonalView({ seasonal }: { seasonal: SeasonalEntry[]; years: number[] }) {
  const validMonths = seasonal.filter(s => s.avg !== null);

  const chartData = {
    labels: MONTH_NAMES,
    datasets: [
      {
        label: 'Avg monthly P&L',
        data: seasonal.map(s => s.avg),
        backgroundColor: seasonal.map(s =>
          s.avg == null ? 'transparent' : s.avg >= 0 ? WIN_STRONG : LOSS_STRONG),
        borderWidth: 0,
        borderRadius: { topLeft: 5, topRight: 5, bottomLeft: 5, bottomRight: 5 },
        borderSkipped: false as const,
        barThickness: 32, order: 2,
      },
      {
        label: 'Win rate %',
        data: seasonal.map(s => s.winRate),
        type: 'line' as const,
        borderColor: CUMUL_COLOR, borderWidth: 2, borderDash: [4, 3],
        pointRadius: 4,
        pointBackgroundColor: seasonal.map(s =>
          s.winRate == null ? 'transparent' : s.winRate >= 50 ? WIN_COLOR : LOSS_COLOR),
        fill: false, tension: 0.4, yAxisID: 'y2', order: 1,
      },
    ],
  };

  const opts = {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: {
        display: true, position: 'bottom' as const,
        labels: { boxWidth: 12, boxHeight: 2, font: { size: 11 }, color: '#888780', padding: 16 },
      },
      tooltip: {
        callbacks: {
          title: (items: { dataIndex: number }[]) => MONTH_FULL[items[0].dataIndex],
          label: (ctx: { datasetIndex: number; dataIndex: number }) => {
            const s = seasonal[ctx.dataIndex];
            if (ctx.datasetIndex === 0)
              return ` Avg P&L: ${s.avg != null ? fmtSigned(s.avg) : '—'} (${s.count} year${s.count !== 1 ? 's' : ''})`;
            return ` Win rate: ${s.winRate != null ? s.winRate + '%' : '—'}`;
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
        ticks: { color: '#888780', font: { size: 11 } },
      },
      y: {
        position: 'left' as const,
        grid: { color: GRID_COLOR, drawBorder: false }, border: { display: false },
        ticks: {
          color: '#888780', font: { size: 11 },
          callback: (v: string | number) => {
            const n = Number(v);
            return n === 0 ? '0' : (n > 0 ? '+' : '-') + fmt(Math.abs(n));
          },
        },
        title: { display: true, text: 'Avg P&L', color: '#888780', font: { size: 10 } },
      },
      y2: {
        position: 'right' as const, min: 0, max: 100,
        grid: { display: false }, border: { display: false },
        ticks: { color: CUMUL_COLOR, font: { size: 11 },
          callback: (v: string | number) => v + '%', stepSize: 25 },
        title: { display: true, text: 'Win rate %', color: CUMUL_COLOR, font: { size: 10 } },
      },
    },
  };

  const best  = [...validMonths].sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))[0];
  const worst = [...validMonths].sort((a, b) => (a.avg ?? 0) - (b.avg ?? 0))[0];

  return (
    <div className="flex flex-col gap-4">
      {(best || worst) && (
        <div className="flex gap-2 flex-wrap">
          {best && (
            <div className="text-xs px-3 py-2 rounded-lg border"
              style={{ borderColor: WIN_COLOR + '40', background: 'rgba(29,158,117,0.08)' }}>
              <span style={{ color: WIN_COLOR }} className="font-medium">Best month seasonally: </span>
              <span className="text-on-surface">{MONTH_FULL[best.month]} — avg {fmtSigned(best.avg ?? 0)} · {best.winRate}% WR</span>
            </div>
          )}
          {worst && (
            <div className="text-xs px-3 py-2 rounded-lg border"
              style={{ borderColor: LOSS_COLOR + '40', background: 'rgba(226,75,74,0.08)' }}>
              <span style={{ color: LOSS_COLOR }} className="font-medium">Worst month seasonally: </span>
              <span className="text-on-surface">{MONTH_FULL[worst.month]} — avg {fmtSigned(worst.avg ?? 0)} · {worst.winRate}% WR</span>
            </div>
          )}
        </div>
      )}
      <div className="relative w-full" style={{ height: 280 }}>
        <Bar data={chartData} options={opts} />
      </div>
    </div>
  );
}

/* ─── main component ─────────────────────────────────────────────── */

export default function MonthlyPnL({ trades = [] }: { trades?: EquityTrade[] }) {
  const [view, setView] = useState<ViewKey>('bar');
  const [selectedYear, setSelectedYear] = useState<'all' | number>('all');

  const data = useMemo(() => buildMonthlyData(trades), [trades]);

  const winMonths  = data.monthly.filter(m => m.pnl > 0).length;
  const lossMonths = data.monthly.filter(m => m.pnl < 0).length;
  const monthWinRate = data.monthly.length
    ? Math.round((winMonths / data.monthly.length) * 100) : 0;
  const bestYear  = [...data.yearTotals].sort((a, b) => b.pnl - a.pnl)[0];
  const worstYear = [...data.yearTotals].sort((a, b) => a.pnl - b.pnl)[0];
  const maxYearPnl = Math.max(...data.yearTotals.map(y => Math.abs(y.pnl)), 1);

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
      <span className="text-sm font-bold text-on-surface">Monthly P&L</span>

      {/* Summary metrics */}
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        <MetricCard label="Total months"   value={data.monthly.length} />
        <MetricCard label="Month win rate" value={monthWinRate + '%'}
          color={monthWinRate >= 50 ? WIN_COLOR : LOSS_COLOR} />
        <MetricCard label="Green months"   value={winMonths}  color={WIN_COLOR} />
        <MetricCard label="Red months"     value={lossMonths} color={LOSS_COLOR} />
        <MetricCard label="Win streak"     value={data.maxWinStreak + ' mo'} sub="consecutive" color={WIN_COLOR} />
        <MetricCard label="Loss streak"    value={data.maxLossStreak + ' mo'} sub="consecutive" color={LOSS_COLOR} />
        {bestYear  && <MetricCard label="Best year"  value={bestYear.year}  sub={fmtSigned(bestYear.pnl)}  color={WIN_COLOR} />}
        {worstYear && <MetricCard label="Worst year" value={worstYear.year} sub={fmtSigned(worstYear.pnl)} color={LOSS_COLOR} />}
      </div>

      {/* View + Year selectors */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-on-surface-variant min-w-[32px]">View:</span>
          {VIEW_OPTIONS.map(v => (
            <Pill key={v.key} label={v.label} active={view === v.key} onClick={() => setView(v.key)} />
          ))}
        </div>
        {(view === 'bar' || view === 'cumul') && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-on-surface-variant min-w-[32px]">Year:</span>
            <Pill label="All" active={selectedYear === 'all'} onClick={() => setSelectedYear('all')} />
            {data.years.map(y => (
              <Pill key={y} label={y} active={selectedYear === y} onClick={() => setSelectedYear(y)} />
            ))}
          </div>
        )}
      </div>

      {/* Legend for bar view */}
      {view === 'bar' && (
        <div className="flex gap-4 text-xs text-on-surface-variant">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-0.5 rounded" style={{ background: WIN_STRONG }} />
            Profitable month
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-0.5 rounded" style={{ background: LOSS_STRONG }} />
            Loss month
          </span>
        </div>
      )}

      {/* Chart area */}
      {view === 'bar'      && <BarView      monthly={data.monthly} selectedYear={selectedYear} />}
      {view === 'cumul'    && <CumulView    monthly={data.monthly} selectedYear={selectedYear} years={data.years} />}
      {view === 'calendar' && <CalendarView monthly={data.monthly} years={data.years} map={data.map} />}
      {view === 'seasonal' && <SeasonalView seasonal={data.seasonal} years={data.years} />}

      {/* Year breakdown table */}
      {view !== 'calendar' && view !== 'seasonal' && data.yearTotals.length > 0 && (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant mb-2">
            Year-by-year breakdown
          </p>
          <div className="flex flex-col gap-1.5">
            {data.yearTotals.map(yt => {
              const wr = yt.months ? Math.round((yt.wins / yt.months) * 100) : 0;
              const barW = Math.min(Math.abs(yt.pnl) / maxYearPnl * 100, 100);
              return (
                <div key={yt.year}
                  className="flex items-center gap-2 px-3 py-2 bg-surface-container-high rounded-xl border border-outline-variant text-[13px]">
                  <span className="font-medium text-on-surface min-w-[38px]">{yt.year}</span>
                  <div className="flex-1 h-1.5 bg-surface-container rounded-full overflow-hidden">
                    <div style={{ width: barW + '%', background: yt.pnl >= 0 ? WIN_COLOR : LOSS_COLOR }}
                      className="h-full rounded-full" />
                  </div>
                  <span className="text-[11px] text-on-surface-variant min-w-[40px] text-center">{yt.months} mo</span>
                  <span className="text-[11px] text-on-surface-variant min-w-[44px] text-center">{wr}% WR</span>
                  <span className="font-medium min-w-[68px] text-right"
                    style={{ color: yt.pnl >= 0 ? WIN_COLOR : LOSS_COLOR }}>
                    {fmtSigned(yt.pnl)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
