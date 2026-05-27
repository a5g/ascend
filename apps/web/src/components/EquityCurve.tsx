import { useState, useMemo, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EquityTrade {
  id: number | string;
  stock: string;
  entry_date: string;
  exit_date: string;
  pnl: number;
  isOpen?: boolean;
  positionSize?: number;  // buy_price × qty
}

interface EquityPoint {
  date: Date;
  value: number;
  trade: EquityTrade;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number): string => {
  const abs = Math.abs(n);
  if (abs >= 1e7) return '₹' + (abs / 1e7).toFixed(2) + 'Cr';
  if (abs >= 1e5) return '₹' + (abs / 1e5).toFixed(1) + 'L';
  if (abs >= 1e3) return '₹' + (abs / 1e3).toFixed(1) + 'K';
  return '₹' + abs.toLocaleString('en-IN');
};

const fmtFull = (n: number): string =>
  '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const sign = (n: number): string => (n >= 0 ? '+' : '');

function buildEquityPoints(trades: EquityTrade[], initialCapital: number): EquityPoint[] {
  const sorted = [...trades].filter(t => t.exit_date).sort(
    (a, b) => new Date(a.exit_date).getTime() - new Date(b.exit_date).getTime()
  );
  let value = initialCapital;
  return sorted.map(t => {
    value += t.pnl;
    return { date: new Date(t.exit_date), value: Math.round(value), trade: t };
  });
}

function buildBenchmark(points: EquityPoint[], initialCapital: number): number[] {
  if (!points.length) return [];
  const start = points[0].date;
  return points.map(p => {
    const months = (p.date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    return Math.round(initialCapital * Math.pow(1.0095, months));
  });
}

function maxDrawdown(values: number[]): number {
  let peak = -Infinity, maxDD = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    const dd = peak > 0 ? (peak - v) / peak : 0;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

// ─── Custom tooltip (canvas-drawn) ───────────────────────────────────────────

function buildTooltipPlugin(points: EquityPoint[], benchmark: number[]) {
  return {
    id: 'customTooltip',
    afterDraw(chart: any) {
      const { tooltip } = chart;
      if (!tooltip || tooltip.opacity === 0) return;
      const idx = tooltip.dataPoints?.[0]?.dataIndex;
      if (idx == null) return;

      const p = points[idx];
      const benchVal = benchmark[idx];
      const prevVal = idx > 0 ? points[idx - 1].value : points[0]?.value ?? p.value;
      const change = p.value - prevVal;

      const ctx: CanvasRenderingContext2D = chart.ctx;
      const x: number = tooltip.caretX;
      const y: number = tooltip.caretY;

      const boxW = 196, boxH = p.trade ? 114 : 90, pad = 12, r = 6;
      let bx = x + 14;
      if (bx + boxW > chart.chartArea.right) bx = x - boxW - 14;
      const by = Math.max(chart.chartArea.top, Math.min(y, chart.chartArea.bottom - boxH));

      const bg        = '#1C2333';
      const brdr      = 'rgba(255,255,255,0.10)';
      const textMain  = '#E8E7DF';
      const textMuted = '#888780';
      const green     = '#1D9E75';
      const red       = '#E24B4A';

      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 12;
      ctx.fillStyle = bg;
      ctx.strokeStyle = brdr;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.roundRect(bx, by, boxW, boxH, r);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.save();
      const row = (label: string, val: string, color: string, offsetY: number) => {
        ctx.font = '400 11px ui-monospace, monospace';
        ctx.fillStyle = textMuted;
        ctx.fillText(label, bx + pad, by + offsetY);
        ctx.fillStyle = color;
        ctx.font = '500 11px ui-monospace, monospace';
        ctx.fillText(val, bx + boxW - pad - ctx.measureText(val).width, by + offsetY);
      };

      ctx.font = '500 11px ui-monospace, monospace';
      ctx.fillStyle = textMain;
      ctx.fillText(
        p.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        bx + pad, by + pad + 11
      );
      row('Portfolio', fmtFull(p.value), textMain, pad + 30);
      row('Change', sign(change) + fmtFull(Math.abs(change)), change >= 0 ? green : red, pad + 48);
      row('Nifty ref.', fmtFull(benchVal ?? 0), textMuted, pad + 66);

      if (p.trade) {
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.fillRect(bx + 6, by + pad + 76, boxW - 12, 1);
        row(p.trade.stock, sign(p.trade.pnl) + fmtFull(Math.abs(p.trade.pnl)), p.trade.pnl >= 0 ? green : red, pad + 94);
      }
      ctx.restore();
    },
  };
}

// ─── Metric card ──────────────────────────────────────────────────────────────

function MetricCard({ label, value, positive, negative }: {
  label: string; value: string; positive?: boolean; negative?: boolean;
}) {
  const valueCls = positive ? 'text-secondary' : negative ? 'text-tertiary' : 'text-on-surface';
  return (
    <div className="bg-surface-container-high border border-outline-variant px-3 py-2">
      <p className="text-[10px] font-label-caps uppercase text-on-surface-variant mb-0.5">{label}</p>
      <p className={`text-sm font-bold font-mono leading-tight ${valueCls}`}>{value}</p>
    </div>
  );
}

// ─── EquityCurve ──────────────────────────────────────────────────────────────

interface EquityCurveProps {
  trades: EquityTrade[];
  initialCapital?: number;
  onCapitalChange?: (v: number) => void;
  compact?: boolean;          // narrower layout: smaller chart, 2-col metrics
  showRecentTrades?: boolean; // default true; set false when rendered alongside a separate card
}

export default function EquityCurve({ trades, initialCapital = 0, onCapitalChange, compact = false, showRecentTrades = true }: EquityCurveProps) {
  const [range, setRange] = useState<'1' | '2' | '3' | 'ALL'>('ALL');
  const [editingCapital, setEditingCapital] = useState(false);
  const [capitalInput, setCapitalInput] = useState(String(initialCapital));
  const chartRef = useRef(null);

  const allPoints = useMemo(() => buildEquityPoints(trades, initialCapital), [trades, initialCapital]);

  const filteredPoints = useMemo(() => {
    if (range === 'ALL') return allPoints;
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - parseInt(range));
    return allPoints.filter(p => p.date >= cutoff);
  }, [allPoints, range]);

  const benchmark = useMemo(
    () => buildBenchmark(filteredPoints, initialCapital),
    [filteredPoints, initialCapital]
  );

  const metrics = useMemo(() => {
    if (!filteredPoints.length) return null;
    const values = filteredPoints.map(p => p.value);
    const latest = values[values.length - 1];
    const totalPnl = latest - initialCapital;
    const wins = trades.filter(t => t.pnl > 0).length;
    const total = trades.length;
    const avgWin  = total > 0 ? trades.filter(t => t.pnl > 0).reduce((s, t) => s + t.pnl, 0) / Math.max(1, wins) : 0;
    const avgLoss = total > 0 ? trades.filter(t => t.pnl < 0).reduce((s, t) => s + t.pnl, 0) / Math.max(1, total - wins) : 0;
    const rr = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : null;
    return {
      portfolioValue: fmt(latest),
      totalPnl: sign(totalPnl) + fmt(Math.abs(totalPnl)),
      totalReturn: initialCapital > 0
        ? sign(totalPnl) + (((latest - initialCapital) / initialCapital) * 100).toFixed(1) + '%'
        : sign(totalPnl) + fmt(Math.abs(totalPnl)),
      maxDD: '-' + (maxDrawdown(values) * 100).toFixed(1) + '%',
      winRate: total > 0 ? Math.round((wins / total) * 100) + '%' : '—',
      tradeCount: total,
      rr: rr != null ? rr.toFixed(2) + 'x' : '—',
      pnlPositive: totalPnl >= 0,
    };
  }, [filteredPoints, trades, initialCapital]);

  const labels = filteredPoints.map(p =>
    p.date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
  );
  const values = filteredPoints.map(p => p.value);

  const tooltipPlugin = useMemo(
    () => buildTooltipPlugin(filteredPoints, benchmark),
    [filteredPoints, benchmark]
  );

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Portfolio',
        data: values,
        borderColor: '#1D9E75',
        borderWidth: 2,
        backgroundColor: 'rgba(29,158,117,0.07)',
        fill: 'origin' as const,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: '#1D9E75',
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
      },
      {
        label: 'Nifty 50',
        data: benchmark,
        borderColor: '#555550',
        borderWidth: 1.5,
        borderDash: [5, 4],
        pointRadius: 0,
        fill: false as const,
        tension: 0.35,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: {
          color: '#888780',
          font: { size: 10 },
          maxTicksLimit: 10,
        },
        border: { display: false },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: {
          color: '#888780',
          font: { size: 10 },
          callback: (v: number | string) => {
            const n = Number(v);
            if (Math.abs(n) >= 1e5) return '₹' + (n / 1e5).toFixed(0) + 'L';
            if (Math.abs(n) >= 1e3) return '₹' + (n / 1e3).toFixed(0) + 'K';
            return '₹' + n;
          },
        },
        border: { display: false },
      },
    },
  };

  const recentTrades = useMemo(
    () => [...trades].sort((a, b) => new Date(b.exit_date).getTime() - new Date(a.exit_date).getTime()).slice(0, 8),
    [trades]
  );

  if (trades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-on-surface-variant text-sm gap-2">
        <span className="material-symbols-outlined text-3xl">show_chart</span>
        No closed trades in the current filter. Close some positions to see the equity curve.
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Metric cards */}
      {metrics && (
        <div className="grid grid-cols-3 gap-2">
          <MetricCard label="Portfolio Value" value={metrics.portfolioValue} />
          <MetricCard label="Total P&L"       value={metrics.totalPnl}   positive={metrics.pnlPositive} negative={!metrics.pnlPositive} />
          <MetricCard label="Total Return"    value={metrics.totalReturn} positive={metrics.pnlPositive} negative={!metrics.pnlPositive} />
          {!compact && <MetricCard label="Max Drawdown"  value={metrics.maxDD}                   negative />}
          {!compact && <MetricCard label="Win Rate"      value={metrics.winRate} />}
          {!compact && <MetricCard label="Reward : Risk" value={metrics.rr} />}
          {!compact && <MetricCard label="Closed Trades" value={String(metrics.tradeCount)} />}
        </div>
      )}

      {/* Chart card */}
      <div className="bg-surface-container border border-outline-variant">

        {/* Chart toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant">
          <div className="flex items-center gap-4">
            {/* Legend */}
            <span className="flex items-center gap-1.5 text-xs text-on-surface-variant">
              <span className="inline-block w-6 h-0.5 bg-secondary rounded" />
              Portfolio
            </span>
            <span className="flex items-center gap-1.5 text-xs text-on-surface-variant">
              <span className="inline-block w-6 border-t-2 border-dashed border-[#555550]" />
              Nifty 50 ref.
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Initial capital input */}
            <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
              <span className="font-label-caps uppercase text-[10px]">Capital</span>
              {editingCapital ? (
                <input
                  type="text"
                  inputMode="decimal"
                  autoFocus
                  value={capitalInput}
                  onChange={e => setCapitalInput(e.target.value.replace(/[^0-9]/g, ''))}
                  onBlur={() => {
                    const v = parseInt(capitalInput, 10);
                    if (!isNaN(v) && v >= 0) onCapitalChange?.(v);
                    setEditingCapital(false);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === 'Escape') {
                      const v = parseInt(capitalInput, 10);
                      if (!isNaN(v) && v >= 0) onCapitalChange?.(v);
                      setEditingCapital(false);
                    }
                  }}
                  className="w-24 bg-surface-container-lowest border border-primary text-on-surface font-mono px-2 py-0.5 text-xs focus:outline-none"
                />
              ) : (
                <button
                  onClick={() => { setCapitalInput(String(initialCapital)); setEditingCapital(true); }}
                  className="font-mono text-on-surface hover:text-primary transition-colors"
                  title="Click to edit initial capital"
                >
                  {fmt(initialCapital)}
                </button>
              )}
            </div>

            {/* Period range */}
            <div className="flex border border-outline-variant overflow-hidden">
              {(['1', '2', '3', 'ALL'] as const).map(r => (
                <button key={r} onClick={() => setRange(r)}
                  className={`px-2.5 py-1 text-xs font-semibold transition-colors ${
                    range === r ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-high'
                  }`}>
                  {r === 'ALL' ? 'All' : r + 'Y'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="px-4 py-4" style={{ height: compact ? 220 : 320 }}>
          {filteredPoints.length < 2 ? (
            <div className="flex items-center justify-center h-full text-on-surface-variant text-xs">
              Not enough data for the selected period.
            </div>
          ) : (
            <Line
              ref={chartRef}
              data={chartData}
              options={chartOptions}
              plugins={[tooltipPlugin]}
            />
          )}
        </div>
      </div>

      {/* Recent closed trades */}
      {showRecentTrades && <div className="bg-surface-container border border-outline-variant">
        <div className="px-4 py-2.5 border-b border-outline-variant">
          <span className="text-[10px] font-label-caps uppercase text-on-surface-variant">Recent Closed Trades</span>
        </div>
        <div className="divide-y divide-outline-variant/40">
          {recentTrades.map(t => {
            const isWin = t.pnl >= 0;
            return (
              <div key={t.id} className="flex items-center justify-between px-4 py-2.5 text-xs hover:bg-surface-container-high transition-colors">
                <span className="font-bold text-on-surface font-mono w-28 shrink-0">{t.stock}</span>
                <span className="text-on-surface-variant font-mono flex-1 text-center">
                  {t.entry_date} → {t.exit_date}
                </span>
                <span className={`font-mono font-bold text-right w-24 ${isWin ? 'text-secondary' : 'text-tertiary'}`}>
                  {sign(t.pnl)}{fmt(Math.abs(t.pnl))}
                </span>
              </div>
            );
          })}
        </div>
      </div>}
    </div>
  );
}
