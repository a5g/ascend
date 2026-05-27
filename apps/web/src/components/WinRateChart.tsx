import { useState, useMemo } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import type { EquityTrade } from './EquityCurve';

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend);

// ─── Constants ────────────────────────────────────────────────────────────────

const WIN_COLOR  = '#1D9E75';
const WIN_BG     = 'rgba(29,158,117,0.16)';
const LOSS_COLOR = '#E24B4A';
const LOSS_BG    = 'rgba(226,75,74,0.16)';
const NEUT_COLOR = '#555550';
const NEUT_BG    = 'rgba(136,135,128,0.15)';

const PERIODS = [
  { key: 'all', label: 'All time' },
  { key: '1y',  label: '1Y'       },
  { key: '2y',  label: '2Y'       },
  { key: '3y',  label: '3Y'       },
] as const;

const GROUP_BY = [
  { key: 'overall', label: 'Overall'  },
  { key: 'year',    label: 'By year'  },
] as const;

type Period  = typeof PERIODS[number]['key'];
type GroupBy = typeof GROUP_BY[number]['key'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number): string => {
  const abs = Math.abs(n);
  if (abs >= 1e7) return '₹' + (abs / 1e7).toFixed(2) + 'Cr';
  if (abs >= 1e5) return '₹' + (abs / 1e5).toFixed(1) + 'L';
  if (abs >= 1e3) return '₹' + (abs / 1e3).toFixed(1) + 'K';
  return '₹' + abs.toLocaleString('en-IN');
};

function filterByPeriod(trades: EquityTrade[], period: Period): EquityTrade[] {
  if (period === 'all') return trades;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - parseInt(period));
  return trades.filter(t => new Date(t.exit_date) >= cutoff);
}

interface Stats {
  total: number; wins: number; losses: number; breakevens: number;
  winRate: number; avgWin: number; avgLoss: number; totalPnl: number;
  expectancy: number; rr: number; largestWin: number; largestLoss: number;
}

function computeStats(trades: EquityTrade[]): Stats {
  const wins      = trades.filter(t => t.pnl > 0);
  const losses    = trades.filter(t => t.pnl < 0);
  const breakevens = trades.filter(t => t.pnl === 0);
  const avgWin    = wins.length   ? wins.reduce((s, t) => s + t.pnl, 0)   / wins.length   : 0;
  const avgLoss   = losses.length ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : 0;
  const totalPnl  = trades.reduce((s, t) => s + t.pnl, 0);
  const expectancy = trades.length
    ? (wins.length / trades.length) * avgWin + (losses.length / trades.length) * avgLoss
    : 0;
  const rr = losses.length && avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0;
  return {
    total: trades.length, wins: wins.length, losses: losses.length, breakevens: breakevens.length,
    winRate:    trades.length ? (wins.length / trades.length) * 100 : 0,
    avgWin:     Math.round(avgWin),
    avgLoss:    Math.round(avgLoss),
    totalPnl:   Math.round(totalPnl),
    expectancy: Math.round(expectancy),
    rr,
    largestWin:  wins.length   ? Math.max(...wins.map(t => t.pnl))   : 0,
    largestLoss: losses.length ? Math.min(...losses.map(t => t.pnl)) : 0,
  };
}

interface GroupRow extends Stats { label: string; }

function groupStats(trades: EquityTrade[], groupBy: GroupBy): GroupRow[] {
  if (groupBy === 'overall') return [{ label: 'Overall', ...computeStats(trades) }];
  const groups: Record<string, EquityTrade[]> = {};
  for (const t of trades) {
    const key = String(new Date(t.exit_date).getFullYear());
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }
  return Object.entries(groups)
    .map(([label, ts]) => ({ label, ...computeStats(ts) }))
    .sort((a, b) => parseInt(a.label) - parseInt(b.label));
}

// ─── Pill ─────────────────────────────────────────────────────────────────────

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`px-2.5 py-1 text-xs font-semibold transition-colors ${
        active ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-high'
      }`}>
      {label}
    </button>
  );
}

// ─── Expectancy bar ───────────────────────────────────────────────────────────

function ExpectancyBar({ value }: { value: number }) {
  const max = Math.max(Math.abs(value) * 1.5, 5000);
  const pct = Math.min(Math.abs(value) / max, 1) * 50;
  const pos = value >= 0;
  return (
    <div className="mt-3">
      <div className="flex justify-between text-[10px] text-on-surface-variant mb-1">
        <span>Avg expected return / trade</span>
        <span className={`font-mono font-bold ${pos ? 'text-secondary' : 'text-tertiary'}`}>
          {pos ? '+' : ''}{fmt(value)}
        </span>
      </div>
      <div className="h-1.5 bg-surface-container-high rounded-full flex overflow-hidden">
        <div className="w-1/2 border-r border-outline-variant flex justify-end">
          {!pos && <div className="h-full bg-tertiary rounded-l-full transition-all" style={{ width: pct + '%' }} />}
        </div>
        <div className="w-1/2 flex">
          {pos && <div className="h-full bg-secondary rounded-r-full transition-all" style={{ width: pct + '%' }} />}
        </div>
      </div>
      <div className="flex justify-between text-[9px] text-on-surface-variant/50 mt-1 font-label-caps uppercase">
        <span>Losing</span><span>Break-even</span><span>Profitable</span>
      </div>
    </div>
  );
}

// ─── Win donut ────────────────────────────────────────────────────────────────

function WinDonut({ stats }: { stats: Stats }) {
  const data = {
    labels: ['Wins', 'Losses', 'Break-even'],
    datasets: [{
      data: [stats.wins, stats.losses, stats.breakevens],
      backgroundColor: [WIN_BG, LOSS_BG, NEUT_BG],
      borderColor:     [WIN_COLOR, LOSS_COLOR, NEUT_COLOR],
      borderWidth: 2,
      hoverOffset: 4,
    }],
  };
  const opts = {
    responsive: true, maintainAspectRatio: false, cutout: '72%',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` ${ctx.label}: ${ctx.raw} (${stats.total ? ((ctx.raw / stats.total) * 100).toFixed(1) : 0}%)`,
        },
        backgroundColor: '#1C2333', padding: 10, cornerRadius: 6,
        bodyFont: { size: 11 }, bodyColor: '#E8E7DF',
      },
    },
  };
  const cls = stats.winRate >= 50 ? 'text-secondary' : 'text-tertiary';
  return (
    <div style={{ position: 'relative', height: 180 }}>
      <Doughnut data={data} options={opts} />
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className={`text-3xl font-bold font-mono leading-none ${cls}`}>
          {stats.winRate.toFixed(0)}%
        </span>
        <span className="text-[10px] text-on-surface-variant mt-1 font-label-caps uppercase">win rate</span>
      </div>
    </div>
  );
}

// ─── Avg win vs loss bar ──────────────────────────────────────────────────────

function AvgBar({ stats }: { stats: Stats }) {
  const data = {
    labels: ['Avg win', 'Avg loss'],
    datasets: [{
      data: [stats.avgWin, Math.abs(stats.avgLoss)],
      backgroundColor: [WIN_BG, LOSS_BG],
      borderColor:     [WIN_COLOR, LOSS_COLOR],
      borderWidth: 2,
      borderRadius: 4,
      borderSkipped: false as const,
      barThickness: 40,
    }],
  };
  const opts = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: { label: (ctx: any) => ` ${fmt(ctx.raw)}` },
        backgroundColor: '#1C2333', padding: 10, cornerRadius: 6,
        bodyFont: { size: 11 }, bodyColor: '#E8E7DF',
      },
    },
    scales: {
      x: {
        grid: { display: false }, border: { display: false },
        ticks: { color: '#888780', font: { size: 11 } },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.04)' }, border: { display: false },
        ticks: { color: '#888780', font: { size: 10 }, callback: (v: any) => fmt(Number(v)) },
      },
    },
  };
  return (
    <div style={{ height: 160 }}>
      <Bar data={data} options={opts} />
    </div>
  );
}

// ─── Group breakdown (by year) ────────────────────────────────────────────────

function GroupBreakdown({ groups }: { groups: GroupRow[] }) {
  const labels   = groups.map(g => g.label);
  const winRates = groups.map(g => parseFloat(g.winRate.toFixed(1)));
  const data = {
    labels,
    datasets: [{
      label: 'Win rate %',
      data: winRates,
      backgroundColor: winRates.map(r => r >= 50 ? WIN_BG   : LOSS_BG),
      borderColor:     winRates.map(r => r >= 50 ? WIN_COLOR : LOSS_COLOR),
      borderWidth: 2, borderRadius: 4, borderSkipped: false as const,
      barThickness: 28,
    }],
  };
  const opts = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const g = groups[ctx.dataIndex];
            return [
              ` Win rate: ${ctx.raw}%`,
              ` Trades: ${g.total}`,
              ` Avg win: ${fmt(g.avgWin)}`,
              ` Avg loss: ${fmt(Math.abs(g.avgLoss))}`,
            ];
          },
        },
        backgroundColor: '#1C2333', padding: 10, cornerRadius: 6,
        bodyFont: { size: 11 }, bodyColor: '#E8E7DF',
      },
    },
    scales: {
      x: {
        grid: { display: false }, border: { display: false },
        ticks: { color: '#888780', font: { size: 11 }, maxRotation: 0 },
      },
      y: {
        min: 0, max: 100,
        grid: { color: 'rgba(255,255,255,0.04)' }, border: { display: false },
        ticks: { color: '#888780', font: { size: 10 }, callback: (v: any) => v + '%', stepSize: 25 },
      },
    },
  };
  const h = Math.max(160, groups.length * 40 + 50);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {groups.map(g => (
          <span key={g.label}
            className={`px-2 py-0.5 text-[10px] font-bold border rounded-sm font-mono ${
              g.winRate >= 50
                ? 'bg-secondary/10 text-secondary border-secondary/30'
                : 'bg-tertiary/10 text-tertiary border-tertiary/30'
            }`}>
            {g.label} · {g.winRate.toFixed(0)}% · {g.total}T
          </span>
        ))}
      </div>
      <div style={{ height: h }}>
        <Bar data={data} options={opts} />
      </div>
    </div>
  );
}

// ─── WinRateChart ─────────────────────────────────────────────────────────────

export default function WinRateChart({ trades }: { trades: EquityTrade[] }) {
  const [period,  setPeriod]  = useState<Period>('all');
  const [groupBy, setGroupBy] = useState<GroupBy>('overall');

  const filtered = useMemo(() => filterByPeriod(trades, period), [trades, period]);
  const stats    = useMemo(() => computeStats(filtered), [filtered]);
  const groups   = useMemo(() => groupStats(filtered, groupBy), [filtered, groupBy]);

  if (!trades.length) return null;

  return (
    <div className="bg-surface-container border border-outline-variant">

      {/* Header toolbar */}
      <div className="px-4 py-2.5 border-b border-outline-variant flex items-center justify-between flex-wrap gap-2">
        <span className="text-sm font-bold text-on-surface">Win Rate Analysis</span>
        <div className="flex border border-outline-variant overflow-hidden">
          {PERIODS.map(p => (
            <Pill key={p.key} label={p.label} active={period === p.key} onClick={() => setPeriod(p.key)} />
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4">

        {/* Top row: donut + avg win/loss */}
        <div className="grid grid-cols-2 gap-4">

          {/* Win / loss donut */}
          <div className="bg-surface-container-high border border-outline-variant p-4 space-y-3">
            <span className="text-[10px] font-label-caps uppercase text-on-surface-variant">Win / Loss Rate</span>
            <WinDonut stats={stats} />
            <div className="space-y-1.5 pt-1">
              {[
                { label: 'Wins',        count: stats.wins,       cls: 'text-secondary' },
                { label: 'Losses',      count: stats.losses,     cls: 'text-tertiary'  },
                { label: 'Break-even',  count: stats.breakevens, cls: 'text-on-surface-variant' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2 text-xs">
                  <span className={`font-bold font-mono w-4 text-right ${item.cls}`}>
                    {item.count}
                  </span>
                  <span className="text-on-surface-variant">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Avg win vs loss */}
          <div className="bg-surface-container-high border border-outline-variant p-4 space-y-3">
            <span className="text-[10px] font-label-caps uppercase text-on-surface-variant">Avg Win vs Avg Loss</span>
            <AvgBar stats={stats} />
            <div className="grid grid-cols-3 gap-2 pt-1">
              {[
                { label: 'R:R Ratio',    value: stats.rr.toFixed(2) + ':1',      cls: stats.rr >= 1 ? 'text-secondary' : 'text-tertiary' },
                { label: 'Largest Win',  value: fmt(stats.largestWin),           cls: 'text-secondary' },
                { label: 'Largest Loss', value: fmt(Math.abs(stats.largestLoss)), cls: 'text-tertiary'  },
              ].map(item => (
                <div key={item.label} className="bg-surface-container border border-outline-variant px-2.5 py-2">
                  <p className="text-[9px] font-label-caps uppercase text-on-surface-variant mb-0.5">{item.label}</p>
                  <p className={`text-xs font-bold font-mono ${item.cls}`}>{item.value}</p>
                </div>
              ))}
            </div>
            <ExpectancyBar value={stats.expectancy} />
          </div>
        </div>

        {/* Breakdown section */}
        <div className="bg-surface-container-high border border-outline-variant p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <span className="text-[10px] font-label-caps uppercase text-on-surface-variant">Breakdown</span>
            <div className="flex border border-outline-variant overflow-hidden">
              {GROUP_BY.map(g => (
                <Pill key={g.key} label={g.label} active={groupBy === g.key} onClick={() => setGroupBy(g.key)} />
              ))}
            </div>
          </div>

          {groupBy === 'overall' ? (
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Total Trades',  value: String(stats.total),                                                                                                 cls: 'text-on-surface' },
                { label: 'Total P&L',     value: (stats.totalPnl >= 0 ? '+' : '') + fmt(Math.abs(stats.totalPnl)),                                                    cls: stats.totalPnl >= 0 ? 'text-secondary' : 'text-tertiary' },
                { label: 'Avg Win',       value: '+' + fmt(stats.avgWin),                                                                                             cls: 'text-secondary' },
                { label: 'Avg Loss',      value: '-' + fmt(Math.abs(stats.avgLoss)),                                                                                  cls: 'text-tertiary' },
                { label: 'Expectancy',    value: (stats.expectancy >= 0 ? '+' : '') + fmt(Math.abs(stats.expectancy)),                                                cls: stats.expectancy >= 0 ? 'text-secondary' : 'text-tertiary' },
                { label: 'Reward : Risk', value: stats.rr.toFixed(2) + ' : 1',                                                                                       cls: stats.rr >= 1 ? 'text-secondary' : 'text-tertiary' },
              ].map(item => (
                <div key={item.label} className="bg-surface-container border border-outline-variant px-3 py-2">
                  <p className="text-[9px] font-label-caps uppercase text-on-surface-variant mb-0.5">{item.label}</p>
                  <p className={`text-sm font-bold font-mono ${item.cls}`}>{item.value}</p>
                </div>
              ))}
            </div>
          ) : (
            <GroupBreakdown groups={groups} />
          )}
        </div>
      </div>
    </div>
  );
}
