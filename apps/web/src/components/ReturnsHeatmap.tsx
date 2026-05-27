import { useState, useMemo } from 'react';
import type { EquityTrade } from './EquityCurve';

// ─── Colour palette (dark-theme tuned) ───────────────────────────────────────

const WIN_STRONG  = '#6EE7C0';  // bright teal  — bg for top wins / text on subtle wins
const WIN_MID     = '#1D9E75';  // medium green — bg for mid wins
const WIN_LIGHT   = '#0D3327';  // dark tinted  — bg for small wins
const LOSS_LIGHT  = '#3D1414';  // dark tinted  — bg for small losses
const LOSS_MID    = '#C0422A';  // medium red   — bg for mid losses
const LOSS_STRONG = '#F08080';  // bright coral — bg for top losses / text on subtle losses
const NEUTRAL_BG  = 'transparent';
const NEUTRAL_FG  = '#888780';

const SORT_OPTIONS = [
  { key: 'total_desc', label: 'Best P&L'   },
  { key: 'total_asc',  label: 'Worst P&L'  },
  { key: 'winrate',    label: 'Win rate'   },
  { key: 'alpha',      label: 'A → Z'      },
] as const;

const METRIC_OPTIONS = [
  { key: 'pnl',     label: 'P&L ₹'      },
  { key: 'pct',     label: 'Return %'   },
  { key: 'winrate', label: 'Win rate %' },
  { key: 'trades',  label: 'Trades'     },
] as const;

type SortKey   = typeof SORT_OPTIONS[number]['key'];
type MetricKey = typeof METRIC_OPTIONS[number]['key'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtCompact = (n: number) => {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '+';
  if (abs >= 1e7) return sign + (abs / 1e7).toFixed(1) + 'Cr';
  if (abs >= 1e5) return sign + (abs / 1e5).toFixed(0) + 'L';
  if (abs >= 1e3) return sign + (abs / 1e3).toFixed(0) + 'K';
  return sign + Math.round(abs);
};

const fmtFull = (n: number) => {
  const abs = Math.abs(n);
  const prefix = n < 0 ? '-₹' : '+₹';
  if (abs >= 1e7) return prefix + (abs / 1e7).toFixed(2) + 'Cr';
  if (abs >= 1e5) return prefix + (abs / 1e5).toFixed(1) + 'L';
  if (abs >= 1e3) return prefix + (abs / 1e3).toFixed(1) + 'K';
  return prefix + Math.round(abs).toLocaleString('en-IN');
};

// ─── Matrix types ─────────────────────────────────────────────────────────────

interface Cell {
  pnl:     number;
  trades:  number;
  wins:    number;
  winRate: number;
  pct:     number;
}

interface StockSummary {
  totalPnl: number;
  winRate:  number;
  trades:   number;
  activeYears: number;
}

interface YearSummary {
  totalPnl: number;
  trades:   number;
  wins:     number;
}

interface Matrix {
  enriched:     Record<string, Record<number, Cell | null>>;
  years:        number[];
  stocks:       string[];
  stockSummary: Record<string, StockSummary>;
  yearSummary:  Record<number, YearSummary>;
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

function buildMatrix(trades: EquityTrade[]): Matrix {
  const map: Record<string, Record<number, { pnl: number; trades: number; wins: number; posSize: number }>> = {};

  for (const t of trades) {
    const year = new Date(t.exit_date).getFullYear();
    if (!map[t.stock]) map[t.stock] = {};
    if (!map[t.stock][year]) map[t.stock][year] = { pnl: 0, trades: 0, wins: 0, posSize: 0 };
    map[t.stock][year].pnl    += t.pnl;
    map[t.stock][year].trades += 1;
    map[t.stock][year].wins   += t.pnl > 0 ? 1 : 0;
    map[t.stock][year].posSize += t.positionSize ?? (Math.abs(t.pnl) * 10 || 10000);
  }

  const years  = [...new Set(trades.map(t => new Date(t.exit_date).getFullYear()))].sort();
  const stocks = Object.keys(map);

  const enriched: Matrix['enriched'] = {};
  for (const stock of stocks) {
    enriched[stock] = {};
    for (const year of years) {
      const c = map[stock]?.[year];
      if (!c) { enriched[stock][year] = null; continue; }
      enriched[stock][year] = {
        pnl:     Math.round(c.pnl),
        trades:  c.trades,
        wins:    c.wins,
        winRate: Math.round((c.wins / c.trades) * 100),
        pct:     c.posSize > 0 ? parseFloat(((c.pnl / c.posSize) * 100).toFixed(1)) : 0,
      };
    }
  }

  const stockSummary: Matrix['stockSummary'] = {};
  for (const stock of stocks) {
    const cells = years.map(y => enriched[stock][y]).filter((c): c is Cell => c != null);
    const totalPnl  = cells.reduce((s, c) => s + c.pnl, 0);
    const totalWins = cells.reduce((s, c) => s + c.wins, 0);
    const totalT    = cells.reduce((s, c) => s + c.trades, 0);
    stockSummary[stock] = {
      totalPnl:    Math.round(totalPnl),
      winRate:     totalT ? Math.round((totalWins / totalT) * 100) : 0,
      trades:      totalT,
      activeYears: cells.length,
    };
  }

  const yearSummary: Matrix['yearSummary'] = {};
  for (const year of years) {
    const cells = stocks.map(s => enriched[s][year]).filter((c): c is Cell => c != null);
    yearSummary[year] = {
      totalPnl: Math.round(cells.reduce((s, c) => s + c.pnl, 0)),
      trades:   cells.reduce((s, c) => s + c.trades, 0),
      wins:     cells.reduce((s, c) => s + c.wins, 0),
    };
  }

  return { enriched, years, stocks, stockSummary, yearSummary };
}

function getCellValue(cell: Cell | null, metric: MetricKey): number | null {
  if (!cell) return null;
  if (metric === 'pnl')     return cell.pnl;
  if (metric === 'pct')     return cell.pct;
  if (metric === 'winrate') return cell.winRate;
  if (metric === 'trades')  return cell.trades;
  return null;
}

function formatCellLabel(value: number, metric: MetricKey): string {
  if (metric === 'pnl')     return fmtCompact(value);
  if (metric === 'pct')     return (value >= 0 ? '+' : '') + value.toFixed(0) + '%';
  if (metric === 'winrate') return value + '%';
  if (metric === 'trades')  return value + 'T';
  return String(value);
}

function cellColor(value: number | null, metric: MetricKey, maxAbs: number): { bg: string; fg: string } {
  if (value == null) return { bg: NEUTRAL_BG, fg: NEUTRAL_FG };

  let ratio = 0;
  let positive = true;

  if (metric === 'pnl') {
    positive = value >= 0;
    ratio = maxAbs > 0 ? Math.min(Math.abs(value) / maxAbs, 1) : 0;
  } else if (metric === 'pct') {
    positive = value >= 0;
    ratio = Math.min(Math.abs(value) / 50, 1);
  } else if (metric === 'winrate') {
    positive = value >= 50;
    ratio = Math.abs(value - 50) / 50;
  } else if (metric === 'trades') {
    positive = true;
    ratio = Math.min(value / 5, 1);
  }

  const stops = positive
    ? [WIN_LIGHT, WIN_MID, WIN_STRONG]
    : [LOSS_LIGHT, LOSS_MID, LOSS_STRONG];

  const bg = ratio <= 0.33 ? stops[0] : ratio <= 0.66 ? stops[1] : stops[2];

  // Text: dark on bright cells, bright-tinted on dark/subtle cells
  const fg = ratio > 0.55
    ? (positive ? '#0A1F17' : '#1A0808')
    : (positive ? WIN_STRONG : LOSS_STRONG);

  return { bg, fg };
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
  label: string; value: string | number; sub?: string; color?: string;
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

// ─── Colour legend ────────────────────────────────────────────────────────────

function ColorLegend({ metric }: { metric: MetricKey }) {
  const isWinRate = metric === 'winrate';
  const stops = [
    { color: LOSS_STRONG, label: isWinRate ? '0%'   : 'Worst' },
    { color: LOSS_MID,    label: '' },
    { color: LOSS_LIGHT,  label: isWinRate ? '45%'  : '' },
    { color: '#2A2F3D',   label: isWinRate ? '50%'  : '0' },
    { color: WIN_LIGHT,   label: isWinRate ? '55%'  : '' },
    { color: WIN_MID,     label: '' },
    { color: WIN_STRONG,  label: isWinRate ? '100%' : 'Best' },
  ];
  return (
    <div className="flex items-center gap-1">
      {stops.map((s, i) => (
        <div key={i} className="flex flex-col items-center gap-0.5">
          <div className="w-5 h-3 rounded-sm" style={{ background: s.color }} />
          <span className="text-[9px] text-on-surface-variant/60 min-w-[20px] text-center">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Cell tooltip ─────────────────────────────────────────────────────────────

interface TooltipState {
  visible: boolean;
  cell: Cell | null;
  stock: string;
  year: number;
  x: number;
  y: number;
}

function CellTooltip({ visible, cell, stock, year, x, y }: TooltipState) {
  if (!visible || !cell) return null;
  return (
    <div className="fixed z-50 pointer-events-none bg-surface-container-high border border-outline-variant shadow-xl rounded-sm p-3 min-w-[160px]"
      style={{ left: x + 12, top: y - 8 }}>
      <p className="text-xs font-bold text-on-surface mb-2">{stock} · {year}</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {([
          ['P&L',      fmtFull(cell.pnl),                                           cell.pnl >= 0 ? WIN_MID : LOSS_STRONG],
          ['Return',   (cell.pct >= 0 ? '+' : '') + cell.pct.toFixed(1) + '%',      cell.pct >= 0 ? WIN_MID : LOSS_STRONG],
          ['Win rate', cell.winRate + '%',                                            cell.winRate >= 50 ? WIN_MID : LOSS_STRONG],
          ['Trades',   String(cell.trades),                                           '#888780'],
        ] as [string, string, string][]).map(([label, val, color]) => (
          <div key={label}>
            <span className="text-[10px] text-on-surface-variant">{label}</span>
            <br />
            <span className="text-xs font-semibold font-mono" style={{ color }}>{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ReturnsHeatmap ───────────────────────────────────────────────────────────

interface ReturnsHeatmapProps {
  trades: EquityTrade[];
}

export default function ReturnsHeatmap({ trades }: ReturnsHeatmapProps) {
  const [metric,  setMetric ] = useState<MetricKey>('pnl');
  const [sortKey, setSortKey] = useState<SortKey>('total_desc');
  const [search,  setSearch ] = useState('');
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, cell: null, stock: '', year: 0, x: 0, y: 0 });

  const matrix = useMemo(() => buildMatrix(trades), [trades]);

  const sortedStocks = useMemo(() => {
    let list = matrix.stocks.filter(s => s.toLowerCase().includes(search.toLowerCase()));
    if (sortKey === 'alpha')      list.sort((a, b) => a.localeCompare(b));
    if (sortKey === 'total_desc') list.sort((a, b) => matrix.stockSummary[b].totalPnl - matrix.stockSummary[a].totalPnl);
    if (sortKey === 'total_asc')  list.sort((a, b) => matrix.stockSummary[a].totalPnl - matrix.stockSummary[b].totalPnl);
    if (sortKey === 'winrate')    list.sort((a, b) => matrix.stockSummary[b].winRate   - matrix.stockSummary[a].winRate);
    return list;
  }, [matrix, sortKey, search]);

  const maxAbs = useMemo(() => {
    if (metric !== 'pnl') return 0;
    let m = 0;
    for (const stock of matrix.stocks)
      for (const year of matrix.years) {
        const c = matrix.enriched[stock]?.[year];
        if (c) m = Math.max(m, Math.abs(c.pnl));
      }
    return m;
  }, [matrix, metric]);

  const bestStock  = useMemo(() => matrix.stocks.length ? [...matrix.stocks].sort((a, b) => matrix.stockSummary[b].totalPnl - matrix.stockSummary[a].totalPnl)[0] : null, [matrix]);
  const worstStock = useMemo(() => matrix.stocks.length ? [...matrix.stocks].sort((a, b) => matrix.stockSummary[a].totalPnl - matrix.stockSummary[b].totalPnl)[0] : null, [matrix]);
  const bestYear   = useMemo(() => { const ys = Object.entries(matrix.yearSummary); return ys.length ? ys.sort((a, b) => Number(b[1].totalPnl) - Number(a[1].totalPnl))[0] : null; }, [matrix]);
  const worstYear  = useMemo(() => { const ys = Object.entries(matrix.yearSummary); return ys.length ? ys.sort((a, b) => Number(a[1].totalPnl) - Number(b[1].totalPnl))[0] : null; }, [matrix]);

  const CELL_W     = Math.max(60, Math.min(90, Math.floor(540 / Math.max(matrix.years.length, 1))));
  const STOCK_COL_W = 120;

  function handleCellEnter(e: React.MouseEvent, cell: Cell | null, stock: string, year: number) {
    if (!cell) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({ visible: true, cell, stock, year, x: rect.right, y: rect.top });
  }

  if (!trades.length) return null;

  return (
    <div className="bg-surface-container border border-outline-variant">

      {/* Header */}
      <div className="px-4 py-3 border-b border-outline-variant">
        <span className="text-sm font-bold text-on-surface">Returns Heatmap</span>
      </div>

      <div className="px-4 pt-3 pb-4 space-y-4">

        {/* Metric cards */}
        <div className="grid grid-cols-3 gap-2 lg:grid-cols-6">
          {bestStock  && <MetricCard label="Best stock"   value={bestStock}  sub={fmtFull(matrix.stockSummary[bestStock].totalPnl)}  color={WIN_MID}    />}
          {worstStock && <MetricCard label="Worst stock"  value={worstStock} sub={fmtFull(matrix.stockSummary[worstStock].totalPnl)} color={LOSS_STRONG} />}
          {bestYear   && <MetricCard label="Best year"    value={bestYear[0]}  sub={fmtFull(Number(bestYear[1].totalPnl))}   color={WIN_MID}    />}
          {worstYear  && <MetricCard label="Worst year"   value={worstYear[0]} sub={fmtFull(Number(worstYear[1].totalPnl))}  color={LOSS_STRONG} />}
          <MetricCard label="Stocks" value={matrix.stocks.length} />
          <MetricCard label="Years"  value={matrix.years.length}  />
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-label-caps uppercase text-on-surface-variant w-10">Metric</span>
            <div className="flex border border-outline-variant overflow-hidden">
              {METRIC_OPTIONS.map(m => (
                <Pill key={m.key} label={m.label} active={metric === m.key} onClick={() => setMetric(m.key)} />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-label-caps uppercase text-on-surface-variant w-10">Sort</span>
            <div className="flex border border-outline-variant overflow-hidden">
              {SORT_OPTIONS.map(s => (
                <Pill key={s.key} label={s.label} active={sortKey === s.key} onClick={() => setSortKey(s.key)} />
              ))}
            </div>
          </div>
        </div>

        {/* Search + legend */}
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Search stock…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-[140px] max-w-xs px-3 py-1.5 text-xs bg-surface-container-high border border-outline-variant text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-primary"
          />
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-on-surface-variant">Scale:</span>
            <ColorLegend metric={metric} />
            <span className="text-[10px] text-on-surface-variant/60">— = no trades</span>
          </div>
        </div>

        {/* Heatmap table */}
        <div className="overflow-auto max-h-[560px] border border-outline-variant">
          <table className="border-collapse w-full" style={{ minWidth: STOCK_COL_W + matrix.years.length * CELL_W + CELL_W + 10, tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: STOCK_COL_W }} />
              {matrix.years.map(y => <col key={y} style={{ width: CELL_W }} />)}
              <col style={{ width: CELL_W + 10 }} />
            </colgroup>

            {/* Header */}
            <thead className="sticky top-0 z-20">
              <tr className="bg-surface-container-high">
                <th className="text-left px-3 py-2 text-[10px] font-label-caps uppercase text-on-surface-variant border border-outline-variant/40 sticky left-0 bg-surface-container-high z-30">
                  Stock
                </th>
                {matrix.years.map(year => {
                  const ys = matrix.yearSummary[year];
                  return (
                    <th key={year} className="text-center px-1 py-1.5 border border-outline-variant/40">
                      <div className="text-xs font-semibold text-on-surface">{year}</div>
                      <div className="text-[10px] font-mono" style={{ color: ys.totalPnl >= 0 ? WIN_MID : LOSS_STRONG }}>
                        {fmtCompact(ys.totalPnl)}
                      </div>
                    </th>
                  );
                })}
                <th className="text-center px-1 py-1.5 text-[10px] font-label-caps uppercase text-on-surface-variant border border-outline-variant/40">
                  Total
                </th>
              </tr>
            </thead>

            <tbody>
              {sortedStocks.map(stock => {
                const summary = matrix.stockSummary[stock];
                return (
                  <tr key={stock} className="border-b border-outline-variant/30">
                    {/* Stock column — sticky */}
                    <td className="px-3 py-0 border border-outline-variant/30 sticky left-0 z-10 bg-surface-container" style={{ height: 36 }}>
                      <span className="text-xs font-semibold text-on-surface font-mono">{stock}</span>
                    </td>

                    {/* Year cells */}
                    {matrix.years.map(year => {
                      const cell  = matrix.enriched[stock]?.[year] ?? null;
                      const value = getCellValue(cell, metric);
                      const { bg, fg } = cellColor(value, metric, maxAbs);
                      return (
                        <td key={year}
                          onMouseEnter={e => handleCellEnter(e, cell, stock, year)}
                          onMouseLeave={() => setTooltip(t => ({ ...t, visible: false }))}
                          className="text-center p-0 border border-outline-variant/20 cursor-default transition-opacity hover:opacity-80"
                          style={{ background: cell ? bg : 'transparent', height: 36 }}>
                          <div className="h-full flex items-center justify-center text-[11px] font-semibold tracking-tight font-mono"
                            style={{ color: cell ? fg : NEUTRAL_FG }}>
                            {cell ? formatCellLabel(value!, metric) : '—'}
                          </div>
                        </td>
                      );
                    })}

                    {/* Row total */}
                    <td className="text-center px-2 border border-outline-variant/20"
                      style={{ background: summary.totalPnl >= 0 ? 'rgba(29,158,117,0.12)' : 'rgba(226,75,74,0.12)' }}>
                      <div className="text-[11px] font-semibold font-mono" style={{ color: summary.totalPnl >= 0 ? WIN_MID : LOSS_STRONG }}>
                        {fmtCompact(summary.totalPnl)}
                      </div>
                      <div className="text-[10px] text-on-surface-variant/60">{summary.winRate}% WR</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Footer */}
            <tfoot>
              <tr className="bg-surface-container-high border-t border-outline-variant">
                <td className="px-3 py-1.5 text-[10px] font-label-caps uppercase text-on-surface-variant border border-outline-variant/30 sticky left-0 bg-surface-container-high z-10">
                  Year total
                </td>
                {matrix.years.map(year => {
                  const ys = matrix.yearSummary[year];
                  const wr = ys.trades ? Math.round((ys.wins / ys.trades) * 100) : 0;
                  return (
                    <td key={year} className="text-center px-1 py-1.5 border border-outline-variant/20">
                      <div className="text-[11px] font-semibold font-mono" style={{ color: ys.totalPnl >= 0 ? WIN_MID : LOSS_STRONG }}>
                        {fmtCompact(ys.totalPnl)}
                      </div>
                      <div className="text-[10px] text-on-surface-variant/60">{wr}% WR</div>
                    </td>
                  );
                })}
                <td className="border border-outline-variant/20" />
              </tr>
            </tfoot>
          </table>
        </div>

        {sortedStocks.length === 0 && search && (
          <p className="text-center text-xs text-on-surface-variant py-4">No stocks match "{search}"</p>
        )}
      </div>

      <CellTooltip {...tooltip} />
    </div>
  );
}
