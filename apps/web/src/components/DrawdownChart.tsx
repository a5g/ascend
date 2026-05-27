import { useState, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import type { EquityTrade } from './EquityCurve';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend);

// ─── Constants ────────────────────────────────────────────────────────────────

const DD_COLOR       = '#E24B4A';
const DD_BG          = 'rgba(226,75,74,0.12)';
const DD_BG_DEEP     = 'rgba(226,75,74,0.22)';
const RECOVERY_COLOR = '#1D9E75';
const PEAK_COLOR     = '#534AB7';

const PERIOD_OPTIONS = [
  { key: 'all', label: 'All time' },
  { key: '1y',  label: '1Y'       },
  { key: '2y',  label: '2Y'       },
  { key: '3y',  label: '3Y'       },
] as const;

const VIEW_OPTIONS = [
  { key: 'pct',  label: '% Drawdown'  },
  { key: 'abs',  label: '₹ Drawdown'  },
  { key: 'bars', label: 'DD Episodes' },
] as const;

type PeriodKey = typeof PERIOD_OPTIONS[number]['key'];
type ViewKey   = typeof VIEW_OPTIONS[number]['key'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number): string => {
  const abs = Math.abs(n);
  if (abs >= 1e7) return '₹' + (abs / 1e7).toFixed(2) + 'Cr';
  if (abs >= 1e5) return '₹' + (abs / 1e5).toFixed(1) + 'L';
  if (abs >= 1e3) return '₹' + (abs / 1e3).toFixed(1) + 'K';
  return '₹' + Math.round(abs).toLocaleString('en-IN');
};

interface EquityPoint {
  date:  Date;
  value: number;
  trade: EquityTrade | null;
}

interface DDPoint extends EquityPoint {
  peak:    number;
  peakIdx: number;
  ddPct:   number;
  ddAbs:   number;
}

interface Episode {
  startDate:      Date;
  troughDate:     Date;
  troughPct:      number;
  troughAbs:      number;
  durationPoints: number;
  recoveryPoints: number;
  recovered:      boolean;
  troughIdx:      number;
}

function filterByPeriod(points: EquityPoint[], period: PeriodKey): EquityPoint[] {
  if (period === 'all') return points;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - parseInt(period));
  return points.filter(p => p.date >= cutoff);
}

function buildEquityPoints(trades: EquityTrade[], initialCapital: number): EquityPoint[] {
  if (!trades.length) return [];
  const sorted = [...trades].sort((a, b) => new Date(a.exit_date).getTime() - new Date(b.exit_date).getTime());
  let value = initialCapital;
  const points: EquityPoint[] = [{ date: new Date(sorted[0].exit_date), value: initialCapital, trade: null }];
  for (const t of sorted) {
    value += t.pnl;
    points.push({ date: new Date(t.exit_date), value: Math.round(value), trade: t });
  }
  return points;
}

function computeDrawdowns(points: EquityPoint[]): DDPoint[] {
  let peak = points[0]?.value ?? 0;
  let peakIdx = 0;
  return points.map((p, i) => {
    if (p.value >= peak) { peak = p.value; peakIdx = i; }
    return {
      ...p,
      peak,
      peakIdx,
      ddPct: parseFloat((peak > 0 ? ((p.value - peak) / peak) * 100 : 0).toFixed(2)),
      ddAbs: Math.round(p.value - peak),
    };
  });
}

function extractEpisodes(ddSeries: DDPoint[]): Episode[] {
  const episodes: Episode[] = [];
  let inDD = false;
  let ep: Episode | null = null;

  for (let i = 0; i < ddSeries.length; i++) {
    const d = ddSeries[i];
    if (d.ddPct < 0 && !inDD) {
      inDD = true;
      ep = {
        startDate: d.date, troughDate: d.date,
        troughPct: d.ddPct, troughAbs: d.ddAbs,
        troughIdx: i,
        durationPoints: 0, recoveryPoints: 0, recovered: false,
      };
    }
    if (inDD && ep) {
      if (d.ddPct < ep.troughPct) {
        ep.troughPct = d.ddPct; ep.troughAbs = d.ddAbs;
        ep.troughDate = d.date; ep.troughIdx = i;
      }
      ep.durationPoints = i - ddSeries.findIndex(x => x.date === ep!.startDate);
      if (d.ddPct >= -0.01) {
        ep.recovered = true;
        ep.recoveryPoints = i - ep.troughIdx;
        episodes.push({ ...ep });
        inDD = false; ep = null;
      }
    }
  }
  if (inDD && ep) {
    ep.recovered = false;
    ep.recoveryPoints = ddSeries.length - 1 - ep.troughIdx;
    episodes.push(ep);
  }
  return episodes.sort((a, b) => a.troughPct - b.troughPct);
}

// ─── Tooltip plugin ───────────────────────────────────────────────────────────

function buildLineTooltip(ddSeries: DDPoint[]) {
  return {
    id: 'ddLineTooltip',
    afterDraw(chart: any) {
      const { tooltip } = chart;
      if (!tooltip || tooltip.opacity === 0) return;
      const idx = tooltip.dataPoints?.[0]?.dataIndex;
      if (idx == null || idx >= ddSeries.length) return;

      const d = ddSeries[idx];
      const ctx: CanvasRenderingContext2D = chart.ctx;
      const inDD = d.ddPct < -0.01;
      const bw = 192, bh = inDD ? 106 : 72, pad = 12, r = 6;
      const cx: number = tooltip.caretX;
      let bx = cx + 12;
      if (bx + bw > chart.chartArea.right + 20) bx = cx - bw - 12;
      const by: number = chart.chartArea.top + 8;

      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur  = 12;
      ctx.fillStyle   = '#1C2333';
      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      ctx.lineWidth   = 0.8;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, r);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      const textP = '#E8E7DF';
      const textM = '#888780';

      ctx.save();
      ctx.font = '500 12px ui-monospace, monospace';
      ctx.fillStyle = textP;
      ctx.fillText(
        d.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        bx + pad, by + pad + 11,
      );
      ctx.font = '400 11px ui-monospace, monospace';
      const rows: [string, string, string][] = [
        ['Portfolio value', fmt(d.value), textP],
        ['Peak value',      fmt(d.peak),  PEAK_COLOR],
      ];
      if (inDD) {
        rows.push(['Drawdown', d.ddPct.toFixed(1) + '%', DD_COLOR]);
        rows.push(['Loss from peak', fmt(Math.abs(d.ddAbs)), DD_COLOR]);
        if (d.trade) rows.push(['Last trade', d.trade.stock, textM]);
      }
      rows.forEach(([label, val, color], i) => {
        const y = by + pad + 28 + i * 16;
        ctx.fillStyle = textM;
        ctx.fillText(label, bx + pad, y);
        ctx.fillStyle = color;
        ctx.fillText(val, bx + bw - pad - ctx.measureText(val).width, y);
      });
      ctx.restore();
    },
  };
}

// ─── Pill ─────────────────────────────────────────────────────────────────────

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

// ─── Severity badge ───────────────────────────────────────────────────────────

function SeverityBadge({ pct }: { pct: number }) {
  const abs = Math.abs(pct);
  const [color, label] =
    abs >= 20 ? [DD_COLOR,       'Severe >20%']
  : abs >= 10 ? ['#EF9F27',      'Moderate 10–20%']
  :             [RECOVERY_COLOR, 'Mild <10%'];
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-sm"
      style={{ background: color + '18', color, border: `0.5px solid ${color}40` }}>
      {label}
    </span>
  );
}

// ─── Episode row ──────────────────────────────────────────────────────────────

function EpisodeRow({ ep, rank }: { ep: Episode; rank: number }) {
  const depthColor = Math.abs(ep.troughPct) >= 20 ? DD_COLOR
    : Math.abs(ep.troughPct) >= 10 ? '#EF9F27' : RECOVERY_COLOR;
  const dateFmt = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });

  return (
    <div className="flex gap-3 items-start px-3 py-2.5 bg-surface-container-high border border-outline-variant">
      <span className="text-sm font-bold font-mono min-w-[28px] pt-0.5" style={{ color: depthColor }}>
        #{rank}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold font-mono" style={{ color: depthColor }}>
            {ep.troughPct.toFixed(1)}%
          </span>
          <span className="text-xs text-on-surface-variant">
            {fmt(Math.abs(ep.troughAbs))} from peak
          </span>
          <SeverityBadge pct={ep.troughPct} />
        </div>
        <div className="flex gap-3 mt-1 text-[11px] text-on-surface-variant/70 flex-wrap">
          <span>{dateFmt(ep.startDate)} → {dateFmt(ep.troughDate)}</span>
          <span>{ep.durationPoints} trades to trough</span>
          {ep.recovered
            ? <span style={{ color: RECOVERY_COLOR }}>Recovered in {ep.recoveryPoints} trades</span>
            : <span style={{ color: DD_COLOR }}>Ongoing</span>
          }
        </div>
      </div>
    </div>
  );
}

// ─── DrawdownChart ────────────────────────────────────────────────────────────

interface DrawdownChartProps {
  trades:         EquityTrade[];
  initialCapital?: number;
}

export default function DrawdownChart({ trades, initialCapital = 500000 }: DrawdownChartProps) {
  const [period,  setPeriod ] = useState<PeriodKey>('all');
  const [view,    setView   ] = useState<ViewKey>('pct');
  const [showAll, setShowAll] = useState(false);

  const allPoints = useMemo(() => buildEquityPoints(trades, initialCapital), [trades, initialCapital]);
  const points    = useMemo(() => filterByPeriod(allPoints, period), [allPoints, period]);
  const ddSeries  = useMemo(() => computeDrawdowns(points), [points]);
  const episodes  = useMemo(() => extractEpisodes(ddSeries), [ddSeries]);

  const metrics = useMemo(() => {
    if (!episodes.length) return null;
    const worst   = episodes[0];
    const avg     = episodes.reduce((s, e) => s + Math.abs(e.troughPct), 0) / episodes.length;
    const avgDur  = episodes.reduce((s, e) => s + e.durationPoints,      0) / episodes.length;
    const recovered = episodes.filter(e => e.recovered);
    const avgRec  = recovered.length
      ? recovered.reduce((s, e) => s + e.recoveryPoints, 0) / recovered.length : 0;
    const current = ddSeries[ddSeries.length - 1];
    return {
      worstPct:  worst.troughPct.toFixed(1) + '%',
      worstAbs:  fmt(Math.abs(worst.troughAbs)),
      count:     String(episodes.length),
      avgDepth:  avg.toFixed(1) + '%',
      avgDur:    avgDur.toFixed(0) + ' trades',
      avgRec:    avgRec.toFixed(0) + ' trades',
      currentDD: (current?.ddPct ?? 0) < -0.1 ? current.ddPct.toFixed(1) + '%' : null,
    };
  }, [episodes, ddSeries]);

  const tooltipPlugin = useMemo(() => buildLineTooltip(ddSeries), [ddSeries]);

  const labels = ddSeries.map(d =>
    d.date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
  );

  const lineValues = ddSeries.map(d => view === 'abs' ? Math.min(d.ddAbs, 0) : Math.min(d.ddPct, 0));

  const lineData = {
    labels,
    datasets: [{
      label: view === 'abs' ? '₹ Drawdown' : '% Drawdown',
      data: lineValues,
      borderColor: DD_COLOR,
      borderWidth: 1.5,
      backgroundColor: DD_BG,
      fill: { target: { value: 0 }, below: DD_BG },
      tension: 0.35,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointHoverBackgroundColor: DD_COLOR,
      pointHoverBorderColor: '#fff',
      pointHoverBorderWidth: 2,
      segment: {
        backgroundColor: (ctx: any) => Math.abs(ctx.p1.parsed.y) >= 20 ? DD_BG_DEEP : DD_BG,
      },
    }],
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        border: { display: false },
        ticks: { color: '#888780', font: { size: 11 }, maxTicksLimit: 10 },
      },
      y: {
        max: 0,
        grid: { color: 'rgba(255,255,255,0.04)' },
        border: { display: false },
        ticks: {
          color: '#888780',
          font: { size: 11 },
          callback: (v: number | string) => view === 'abs'
            ? (Number(v) === 0 ? '0' : '-' + fmt(Math.abs(Number(v))))
            : Number(v).toFixed(0) + '%',
        },
      },
    },
  };

  const epsSorted = [...episodes].sort((a, b) => a.troughPct - b.troughPct);
  const barData = {
    labels: epsSorted.map((_, i) => `DD #${i + 1}`),
    datasets: [
      {
        label: 'Depth',
        data: epsSorted.map(e => Math.abs(e.troughPct)),
        backgroundColor: epsSorted.map(e =>
          Math.abs(e.troughPct) >= 20 ? 'rgba(226,75,74,0.3)'
          : Math.abs(e.troughPct) >= 10 ? 'rgba(239,159,39,0.25)'
          : 'rgba(29,158,117,0.2)',
        ),
        borderColor: epsSorted.map(e =>
          Math.abs(e.troughPct) >= 20 ? DD_COLOR
          : Math.abs(e.troughPct) >= 10 ? '#EF9F27'
          : RECOVERY_COLOR,
        ),
        borderWidth: 1.5,
        borderRadius: 4,
        borderSkipped: false as const,
        barThickness: 24,
        order: 1,
      },
      {
        label: 'Recovery',
        data: epsSorted.map(e => e.recovered ? e.recoveryPoints : 0),
        backgroundColor: 'rgba(29,158,117,0.15)',
        borderColor: RECOVERY_COLOR,
        borderWidth: 1,
        borderRadius: 4,
        borderSkipped: false as const,
        barThickness: 24,
        order: 2,
        yAxisID: 'y2',
      },
    ],
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items: any[]) => {
            const ep = epsSorted[items[0].dataIndex];
            if (!ep) return '';
            const d = (dt: Date) => dt.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
            return `${d(ep.startDate)} → ${d(ep.troughDate)}`;
          },
          label: (item: any) => {
            const ep = epsSorted[item.dataIndex];
            if (item.datasetIndex === 0) return ` Depth: ${Math.abs(ep.troughPct).toFixed(1)}%  (${fmt(Math.abs(ep.troughAbs))})`;
            return ep.recovered ? ` Recovery: ${ep.recoveryPoints} trades` : ' Not yet recovered';
          },
        },
        backgroundColor: '#1C2333',
        borderColor: 'rgba(255,255,255,0.10)',
        borderWidth: 0.8,
        padding: 10,
        cornerRadius: 6,
        titleColor: '#E8E7DF',
        bodyColor: '#B0AFA8',
        bodyFont: { family: 'ui-monospace, monospace', size: 11 },
        titleFont: { family: 'ui-monospace, monospace', size: 11 },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: '#888780', font: { size: 11 } },
      },
      y: {
        position: 'left' as const,
        grid: { color: 'rgba(255,255,255,0.04)' },
        border: { display: false },
        ticks: {
          color: DD_COLOR,
          font: { size: 11 },
          callback: (v: number | string) => Number(v).toFixed(0) + '%',
        },
        title: { display: true, text: 'Depth %', color: DD_COLOR, font: { size: 10 } },
      },
      y2: {
        position: 'right' as const,
        grid: { display: false },
        border: { display: false },
        ticks: {
          color: RECOVERY_COLOR,
          font: { size: 11 },
          callback: (v: number | string) => v + 'T',
        },
        title: { display: true, text: 'Recovery (trades)', color: RECOVERY_COLOR, font: { size: 10 } },
      },
    },
  };

  if (!trades.length) return null;

  const displayedEps = showAll ? episodes : episodes.slice(0, 5);

  return (
    <div className="bg-surface-container border border-outline-variant">

      {/* Header */}
      <div className="px-4 py-3 border-b border-outline-variant flex items-center justify-between">
        <span className="text-sm font-bold text-on-surface">Drawdown Analysis</span>
        <div className="flex items-center gap-3 text-xs text-on-surface-variant">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 rounded-sm" style={{ background: DD_COLOR }} />
            Drawdown
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: DD_BG_DEEP, border: `0.5px solid ${DD_COLOR}` }} />
            Severe &gt;20%
          </span>
          {view === 'bars' && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: 'rgba(29,158,117,0.15)', border: `0.5px solid ${RECOVERY_COLOR}` }} />
              Recovery (trades)
            </span>
          )}
        </div>
      </div>

      <div className="px-4 pt-3 pb-4 space-y-4">

        {/* Metric cards */}
        {metrics && (
          <div className="grid grid-cols-3 gap-2 lg:grid-cols-6">
            <MetricCard label="Worst drawdown" value={metrics.worstPct} sub={metrics.worstAbs + ' lost'} color={DD_COLOR} />
            <MetricCard label="Total episodes" value={metrics.count}    sub="distinct declines" />
            <MetricCard label="Avg depth"      value={metrics.avgDepth} color={DD_COLOR} />
            <MetricCard label="Avg to trough"  value={metrics.avgDur}   sub="from peak" />
            <MetricCard label="Avg recovery"   value={metrics.avgRec}   sub="after trough" color={RECOVERY_COLOR} />
            {metrics.currentDD
              ? <MetricCard label="Current DD" value={metrics.currentDD} sub="ongoing" color={DD_COLOR} />
              : <MetricCard label="Current DD" value="At peak" color={RECOVERY_COLOR} />
            }
          </div>
        )}

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
            <span className="text-[10px] font-label-caps uppercase text-on-surface-variant mr-2">View</span>
            <div className="flex border border-outline-variant overflow-hidden">
              {VIEW_OPTIONS.map(v => (
                <Pill key={v.key} label={v.label} active={view === v.key} onClick={() => setView(v.key)} />
              ))}
            </div>
          </div>
        </div>

        {/* Chart */}
        {view === 'bars' ? (
          <div style={{ position: 'relative', width: '100%', height: Math.max(220, epsSorted.length * 40 + 60) }}>
            <Bar data={barData} options={barOptions} />
          </div>
        ) : (
          <div style={{ position: 'relative', width: '100%', height: 280 }}>
            <Line data={lineData} options={lineOptions} plugins={[tooltipPlugin]} />
          </div>
        )}

        {/* Episodes list */}
        {episodes.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-label-caps uppercase text-on-surface-variant mb-2">
              Drawdown episodes — worst to mildest
            </p>
            {displayedEps.map((ep, i) => (
              <EpisodeRow key={i} ep={ep} rank={i + 1} />
            ))}
            {episodes.length > 5 && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="w-full py-2 text-xs text-on-surface-variant border border-outline-variant hover:bg-surface-container-high transition-colors mt-1"
              >
                {showAll ? 'Show less' : `Show all ${episodes.length} episodes`}
              </button>
            )}
          </div>
        )}

        {!episodes.length && (
          <div className="text-center py-8 text-sm text-on-surface-variant">
            No drawdown episodes — portfolio never dipped below a previous peak.
          </div>
        )}
      </div>
    </div>
  );
}
