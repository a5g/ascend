import { useState, useMemo } from 'react';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  BubbleController,
} from 'chart.js';
import { Bubble } from 'react-chartjs-2';
import type { EquityTrade } from './EquityCurve';

ChartJS.register(BubbleController, LinearScale, PointElement, Tooltip, Legend);

// ─── Constants ────────────────────────────────────────────────────────────────

const WIN_COLOR   = '#1D9E75';
const WIN_BG      = 'rgba(29,158,117,0.35)';
const LOSS_COLOR  = '#E24B4A';
const LOSS_BG     = 'rgba(226,75,74,0.35)';
const OPPORTUNITY = '#534AB7';
const NEUTRAL     = '#B4B2A9';

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

const HIGHLIGHT_OPTIONS = [
  { key: 'none',       label: 'None'             },
  { key: 'oversized',  label: 'Oversized losers' },
  { key: 'undersized', label: 'Missed winners'   },
  { key: 'large',      label: 'Large positions'  },
] as const;

type PeriodKey    = typeof PERIOD_OPTIONS[number]['key'];
type GroupKey     = typeof GROUP_OPTIONS[number]['key'];
type HighlightKey = typeof HIGHLIGHT_OPTIONS[number]['key'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number): string => {
  const abs = Math.abs(n);
  if (abs >= 1e7) return '₹' + (abs / 1e7).toFixed(2) + 'Cr';
  if (abs >= 1e5) return '₹' + (abs / 1e5).toFixed(1) + 'L';
  if (abs >= 1e3) return '₹' + (abs / 1e3).toFixed(1) + 'K';
  return '₹' + Math.round(abs).toLocaleString('en-IN');
};

function getPositionSize(trade: EquityTrade): number {
  if (trade.positionSize && trade.positionSize > 0) return trade.positionSize;
  // Fallback estimate: assume ~10% avg return, so position ≈ |pnl| × 10
  const abs = Math.abs(trade.pnl);
  if (abs === 0) return 10000;
  return Math.round(abs * 10);
}

function filterByPeriod(trades: EquityTrade[], period: PeriodKey): EquityTrade[] {
  if (period === 'all') return trades;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - parseInt(period));
  return trades.filter(t => new Date(t.exit_date) >= cutoff);
}

interface BubblePoint {
  x: number; y: number; r: number;
  trade: EquityTrade;
  posSize: number;
  sizePct: number;
  returnPct: number;
}

function buildBubblePoint(trade: EquityTrade, capital: number): BubblePoint {
  const posSize   = getPositionSize(trade);
  const sizePct   = capital > 0 ? (posSize / capital) * 100 : 0;
  const returnPct = posSize > 0 ? (trade.pnl / posSize) * 100 : 0;
  return {
    x: parseFloat(sizePct.toFixed(2)),
    y: parseFloat(returnPct.toFixed(2)),
    r: Math.max(4, Math.min(28, Math.sqrt(Math.abs(trade.pnl)) / 18)),
    trade, posSize, sizePct, returnPct,
  };
}

function mean(arr: number[]): number {
  return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
}

interface QuadrantStats {
  oversized_loss: BubblePoint[];
  undersized_win: BubblePoint[];
  normal_win:     BubblePoint[];
  normal_loss:    BubblePoint[];
  avgSizePct:     number;
}

function quadrantStats(points: BubblePoint[]): QuadrantStats {
  const avgSizePct = mean(points.map(p => p.sizePct));
  const q: QuadrantStats = { oversized_loss: [], undersized_win: [], normal_win: [], normal_loss: [], avgSizePct };
  for (const p of points) {
    const bigPos = p.sizePct >= avgSizePct;
    const isWin  = p.y >= 0;
    if (bigPos && !isWin)  q.oversized_loss.push(p);
    else if (!bigPos && isWin)  q.undersized_win.push(p);
    else if (bigPos && isWin)   q.normal_win.push(p);
    else                        q.normal_loss.push(p);
  }
  return q;
}

// ─── Tooltip plugin ───────────────────────────────────────────────────────────

function buildTooltipPlugin(allPoints: BubblePoint[]) {
  const avgSize = mean(allPoints.map(p => p.sizePct));
  return {
    id: 'bubbleTooltip',
    afterDraw(chart: any) {
      const { tooltip } = chart;
      if (!tooltip || tooltip.opacity === 0) return;
      const dp = tooltip.dataPoints?.[0];
      if (!dp) return;
      const p: BubblePoint = dp.raw._meta;
      if (!p) return;

      const ctx: CanvasRenderingContext2D = chart.ctx;
      const bw = 200, bh = 128, pad = 12, r = 6;
      const cx: number = tooltip.caretX;
      const cy: number = tooltip.caretY;
      let bx = cx + 14;
      if (bx + bw > chart.chartArea.right + 30) bx = cx - bw - 14;
      const by = Math.max(
        chart.chartArea.top + 4,
        Math.min(cy - bh / 2, chart.chartArea.bottom - bh - 4),
      );

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

      const isWin   = p.trade.pnl >= 0;
      const plColor = isWin ? WIN_COLOR : LOSS_COLOR;
      const textP   = '#E8E7DF';
      const textM   = '#888780';

      ctx.save();
      ctx.font = '600 12px ui-monospace, monospace';
      ctx.fillStyle = textP;
      ctx.fillText(p.trade.stock, bx + pad, by + pad + 13);

      ctx.font = '400 11px ui-monospace, monospace';
      const rows: [string, string, string][] = [
        ['P&L',           (isWin ? '+' : '') + fmt(Math.abs(p.trade.pnl)), plColor],
        ['Position size',  fmt(p.posSize),                                  textP],
        ['Size % of cap',  p.sizePct.toFixed(1) + '%',                      p.sizePct > avgSize * 1.5 ? LOSS_COLOR : textP],
        ['Return %',       (p.returnPct >= 0 ? '+' : '') + p.returnPct.toFixed(1) + '%', plColor],
        ['Exit date',      new Date(p.trade.exit_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }), textM],
      ];
      rows.forEach(([label, val, color], i) => {
        const y = by + pad + 30 + i * 16;
        ctx.fillStyle = textM;
        ctx.fillText(label, bx + pad, y);
        ctx.fillStyle = color;
        ctx.fillText(val, bx + bw - pad - ctx.measureText(val).width, y);
      });
      ctx.restore();
    },
  };
}

// ─── Quadrant overlay plugin ──────────────────────────────────────────────────

function buildQuadrantPlugin(avgSizePct: number) {
  return {
    id: 'quadrantOverlay',
    beforeDatasetsDraw(chart: any) {
      const ctx   = chart.ctx;
      const xAxis = chart.scales.x;
      const yAxis = chart.scales.y;
      const cx    = xAxis.getPixelForValue(avgSizePct);
      const cy    = yAxis.getPixelForValue(0);
      const { left, right, top, bottom } = chart.chartArea;

      ctx.save();
      ctx.fillStyle = 'rgba(226,74,74,0.05)';
      ctx.fillRect(cx, cy, right - cx, bottom - cy);
      ctx.fillStyle = 'rgba(83,74,183,0.05)';
      ctx.fillRect(left, top, cx - left, cy - top);

      ctx.strokeStyle = 'rgba(255,255,255,0.20)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(cx, top);  ctx.lineTo(cx, bottom); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(left, cy); ctx.lineTo(right, cy);  ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = '600 10px ui-monospace, monospace';
      ctx.fillStyle = 'rgba(226,74,74,0.85)';
      ctx.fillText('OVERSIZED LOSERS', cx + 8, bottom - 8);
      ctx.fillStyle = 'rgba(83,74,183,0.85)';
      ctx.fillText('MISSED WINNERS', left + 8, top + 14);
      ctx.fillStyle = 'rgba(29,158,117,0.85)';
      ctx.fillText('GOOD SIZING', cx + 8, top + 14);
      ctx.fillStyle = 'rgba(180,178,169,0.70)';
      ctx.fillText('SMALL LOSSES', left + 8, bottom - 8);
      ctx.restore();
    },
  };
}

// ─── Pill ─────────────────────────────────────────────────────────────────────

function Pill({ label, active, onClick, accent }: {
  label: string; active: boolean; onClick: () => void; accent?: string;
}) {
  if (active && accent) {
    return (
      <button onClick={onClick}
        className="px-2.5 py-1 text-xs font-semibold transition-colors border"
        style={{ background: accent, borderColor: accent, color: '#fff' }}>
        {label}
      </button>
    );
  }
  return (
    <button onClick={onClick}
      className={`px-2.5 py-1 text-xs font-semibold transition-colors border ${
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

// ─── Insight row ──────────────────────────────────────────────────────────────

function InsightRow({ text, color }: { text: string; color: string }) {
  return (
    <div className="flex items-start gap-2.5 px-3 py-2.5 border rounded-sm text-xs leading-relaxed text-on-surface"
      style={{ background: color + '10', borderColor: color + '30' }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ background: color }} />
      {text}
    </div>
  );
}

// ─── PositionSizeBubble ───────────────────────────────────────────────────────

interface PositionSizeBubbleProps {
  trades:          EquityTrade[];
  initialCapital?: number;
}

export default function PositionSizeBubble({ trades, initialCapital = 500000 }: PositionSizeBubbleProps) {
  const [period,        setPeriod       ] = useState<PeriodKey>('all');
  const [groupBy,       setGroupBy      ] = useState<GroupKey>('all');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [highlight,     setHighlight    ] = useState<HighlightKey>('none');

  const filteredByPeriod = useMemo(() => filterByPeriod(trades, period), [trades, period]);

  const groups = useMemo(() => {
    if (groupBy === 'all') return null;
    const map: Record<string, number> = {};
    for (const t of filteredByPeriod) {
      const key = new Date(t.exit_date).getFullYear().toString();
      map[key] = (map[key] ?? 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredByPeriod, groupBy]);

  const activeTrades = useMemo(() => {
    if (groupBy === 'all' || selectedGroup == null) return filteredByPeriod;
    return filteredByPeriod.filter(t =>
      new Date(t.exit_date).getFullYear().toString() === selectedGroup,
    );
  }, [filteredByPeriod, groupBy, selectedGroup]);

  // If user hasn't set initial capital, use max single position as proxy for 100%
  const effectiveCapital = useMemo(() => {
    if (initialCapital > 0) return initialCapital;
    const maxPos = Math.max(...activeTrades.map(t => getPositionSize(t)), 1);
    return maxPos * 5; // treat largest position as ~20% of portfolio
  }, [activeTrades, initialCapital]);

  const allPoints = useMemo(
    () => activeTrades.map(t => buildBubblePoint(t, effectiveCapital)),
    [activeTrades, effectiveCapital],
  );

  const qStats = useMemo(() => quadrantStats(allPoints), [allPoints]);

  const visiblePoints = useMemo(() => {
    if (highlight === 'none')       return allPoints;
    if (highlight === 'oversized')  return allPoints.filter(p => qStats.oversized_loss.includes(p));
    if (highlight === 'undersized') return allPoints.filter(p => qStats.undersized_win.includes(p));
    if (highlight === 'large')      return allPoints.filter(p => p.sizePct >= qStats.avgSizePct * 1.5);
    return allPoints;
  }, [allPoints, highlight, qStats]);

  const xVals = allPoints.map(p => p.x);
  const yVals = allPoints.map(p => p.y);
  const xMin  = (Math.min(...xVals, 0)) * 1.1 - 1;
  const xMax  = (Math.max(...xVals, 0)) * 1.15 + 1;
  const yMin  = (Math.min(...yVals, 0)) * 1.2 - 5;
  const yMax  = (Math.max(...yVals, 0)) * 1.2 + 5;

  const tooltipPlugin  = useMemo(() => buildTooltipPlugin(allPoints), [allPoints]);
  const quadrantPlugin = useMemo(() => buildQuadrantPlugin(qStats.avgSizePct), [qStats.avgSizePct]);

  const buildDataset = (points: BubblePoint[], label: string, bg: string, border: string) => ({
    label,
    data: points.map(p => ({ x: p.x, y: p.y, r: p.r, _meta: p })),
    backgroundColor: bg,
    borderColor: border,
    borderWidth: 1.5,
    hoverBackgroundColor: border + '55',
    hoverBorderColor: border,
    hoverBorderWidth: 2,
  });

  const highlighted = new Set(visiblePoints);
  const winners = allPoints.filter(p => p.y >= 0);
  const losers  = allPoints.filter(p => p.y < 0);

  const chartData = highlight === 'none'
    ? { datasets: [
        buildDataset(winners, 'Winners', WIN_BG,  WIN_COLOR),
        buildDataset(losers,  'Losers',  LOSS_BG, LOSS_COLOR),
      ]}
    : { datasets: [
        buildDataset(
          allPoints.filter(p => !highlighted.has(p)),
          'Other', 'rgba(180,178,169,0.12)', 'rgba(180,178,169,0.4)',
        ),
        buildDataset(
          [...highlighted], 'Highlighted',
          highlight === 'undersized' ? 'rgba(83,74,183,0.25)' : LOSS_BG,
          highlight === 'undersized' ? OPPORTUNITY : LOSS_COLOR,
        ),
      ]};

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'nearest' as const, intersect: true },
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    layout: { padding: { top: 20, right: 20, bottom: 10, left: 10 } },
    scales: {
      x: {
        min: xMin, max: xMax,
        grid: { color: 'rgba(255,255,255,0.04)' },
        border: { display: false },
        ticks: {
          color: '#888780', font: { size: 11 },
          callback: (v: number | string) => Number(v).toFixed(0) + '%',
        },
        title: { display: true, text: 'Position size (% of capital)', color: '#888780', font: { size: 11 } },
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

  const insights = useMemo(() => {
    const items: { text: string; color: string }[] = [];
    const olPnl = qStats.oversized_loss.reduce((s, p) => s + p.trade.pnl, 0);
    const uwPnl = qStats.undersized_win.reduce((s, p) => s + p.trade.pnl, 0);

    if (qStats.oversized_loss.length > 0)
      items.push({ color: LOSS_COLOR, text: `${qStats.oversized_loss.length} oversized losing trade${qStats.oversized_loss.length > 1 ? 's' : ''} — you deployed above-average capital on positions that lost ${fmt(Math.abs(olPnl))} total. Review your entry conviction on these.` });
    if (qStats.undersized_win.length > 0)
      items.push({ color: OPPORTUNITY, text: `${qStats.undersized_win.length} undersized winner${qStats.undersized_win.length > 1 ? 's' : ''} — you were right but sized small, capturing only ${fmt(uwPnl)}. Consider whether more confidence was warranted.` });
    if (qStats.normal_win.length > qStats.oversized_loss.length)
      items.push({ color: WIN_COLOR, text: `Good sizing discipline — your larger positions skew towards winners (${qStats.normal_win.length} big winners vs ${qStats.oversized_loss.length} big losers).` });

    const worstOL = [...qStats.oversized_loss].sort((a, b) => a.trade.pnl - b.trade.pnl)[0];
    if (worstOL)
      items.push({ color: LOSS_COLOR, text: `Worst oversized loss: ${worstOL.trade.stock} — ${worstOL.sizePct.toFixed(1)}% of capital deployed, returned ${worstOL.returnPct.toFixed(1)}% (${fmt(Math.abs(worstOL.trade.pnl))} loss).` });

    return items;
  }, [qStats]);

  const olLoss = qStats.oversized_loss.reduce((s, p) => s + p.trade.pnl, 0);
  const uwGain = qStats.undersized_win.reduce((s, p) => s + p.trade.pnl, 0);

  if (!trades.length) return null;

  return (
    <div className="bg-surface-container border border-outline-variant">

      {/* Header */}
      <div className="px-4 py-3 border-b border-outline-variant flex items-center justify-between flex-wrap gap-2">
        <span className="text-sm font-bold text-on-surface">Position Sizing</span>
        <div className="flex items-center gap-3 text-xs text-on-surface-variant">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: WIN_COLOR }} />Winners
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: LOSS_COLOR }} />Losers
          </span>
          <span className="flex items-center gap-1.5">
            {[6, 9, 12].map(s => (
              <span key={s} className="rounded-full inline-block" style={{ width: s, height: s, background: NEUTRAL }} />
            ))}
            Bubble = |P&amp;L|
          </span>
        </div>
      </div>

      <div className="px-4 pt-3 pb-4 space-y-4">

        {/* Metric cards */}
        <div className="grid grid-cols-5 gap-2">
          <MetricCard label="Oversized losers"  value={String(qStats.oversized_loss.length)} sub={fmt(Math.abs(olLoss)) + ' lost'}    color={LOSS_COLOR}  />
          <MetricCard label="Missed winners"    value={String(qStats.undersized_win.length)} sub={fmt(uwGain) + ' captured'}          color={OPPORTUNITY} />
          <MetricCard label="Good sizing"       value={String(qStats.normal_win.length)}     sub="large pos → win"                    color={WIN_COLOR}   />
          <MetricCard label="Avg position size" value={qStats.avgSizePct.toFixed(1) + '%'}   sub="of capital" />
          <MetricCard label="Largest position"
            value={allPoints.length ? Math.max(...allPoints.map(p => p.sizePct)).toFixed(1) + '%' : '—'}
            sub="of capital" />
        </div>

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
            <span className="text-[10px] font-label-caps uppercase text-on-surface-variant mr-2">Group</span>
            <div className="flex border border-outline-variant overflow-hidden">
              {GROUP_OPTIONS.map(g => (
                <Pill key={g.key} label={g.label} active={groupBy === g.key}
                  onClick={() => { setGroupBy(g.key); setSelectedGroup(null); }} />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-0">
            <span className="text-[10px] font-label-caps uppercase text-on-surface-variant mr-2">Highlight</span>
            <div className="flex border border-outline-variant overflow-hidden">
              <Pill label="None"             active={highlight === 'none'}       onClick={() => setHighlight('none')} />
              <Pill label="Oversized losers" active={highlight === 'oversized'}  onClick={() => setHighlight('oversized')}  accent={LOSS_COLOR}  />
              <Pill label="Missed winners"   active={highlight === 'undersized'} onClick={() => setHighlight('undersized')} accent={OPPORTUNITY} />
              <Pill label="Large positions"  active={highlight === 'large'}      onClick={() => setHighlight('large')} />
            </div>
          </div>
        </div>

        {/* Group pills */}
        {groups && (
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setSelectedGroup(null)}
              className={`text-[11px] px-2.5 py-1 border transition-colors ${selectedGroup == null ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-high'}`}>
              All ({filteredByPeriod.length})
            </button>
            {groups.map(([key, count]) => (
              <button key={key} onClick={() => setSelectedGroup(key)}
                className={`text-[11px] px-2.5 py-1 border transition-colors ${selectedGroup === key ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-high'}`}>
                {key} ({count})
              </button>
            ))}
          </div>
        )}

        {/* Chart */}
        <div style={{ position: 'relative', width: '100%', height: 400 }}>
          <Bubble data={chartData} options={chartOptions} plugins={[quadrantPlugin, tooltipPlugin]} />
        </div>

        {/* Quadrant guide */}
        <div className="grid grid-cols-2 gap-2 px-3 py-3 bg-surface-container-high border border-outline-variant">
          {[
            { label: 'Top-right: Good sizing',        desc: 'Large position + win — you sized up correctly',         color: WIN_COLOR   },
            { label: 'Bottom-right: Oversized losers', desc: 'Large position + loss — capital at risk on bad trades', color: LOSS_COLOR  },
            { label: 'Top-left: Missed winners',       desc: 'Small position + win — underconfident on good ideas',  color: OPPORTUNITY },
            { label: 'Bottom-left: Small losses',      desc: 'Small position + loss — controlled damage',            color: NEUTRAL     },
          ].map(q => (
            <div key={q.label} className="flex items-start gap-2">
              <span className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ background: q.color }} />
              <div>
                <p className="text-xs font-semibold text-on-surface m-0">{q.label}</p>
                <p className="text-[11px] text-on-surface-variant m-0 mt-0.5">{q.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Insights */}
        {insights.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-label-caps uppercase text-on-surface-variant">Position sizing insights</p>
            {insights.map((ins, i) => <InsightRow key={i} text={ins.text} color={ins.color} />)}
          </div>
        )}

        {/* Note */}
        <p className="text-[11px] text-on-surface-variant bg-surface-container-high border border-outline-variant px-3 py-2 m-0">
          {initialCapital <= 0
            ? 'Initial capital not set — position size % is estimated. Set your starting capital in the Equity Curve card for accurate sizing.'
            : 'Position size is calculated from entry price × quantity.'
          }
        </p>
      </div>
    </div>
  );
}
