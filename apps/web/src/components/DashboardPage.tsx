import { useState, useEffect, useMemo, useRef } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

interface ActiveUser {
  zerodha_user_id: string;
  name: string | null;
}

interface KiteHolding {
  tradingsymbol: string;
  exchange: string;
  quantity: number;
  average_price: number;
  last_price: number;
  pnl: number;
  day_change: number;
  day_change_percentage: number;
}

type SortKey = 'tradingsymbol' | 'quantity' | 'average_price' | 'last_price' | 'invested' | 'cur_val' | 'pnl' | 'pnl_pct' | 'day_change_percentage';
type SortDir = 'asc' | 'desc';

// ── Helpers ───────────────────────────────────────────────────────────────────

const inr = (v: number) =>
  v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const inrInt = (v: number) => Math.round(v).toLocaleString('en-IN');

const inrQty = (v: number) => v.toLocaleString('en-IN');

const COLS: { key: SortKey; label: string; right: boolean }[] = [
  { key: 'tradingsymbol',        label: 'Instrument', right: false },
  { key: 'quantity',             label: 'Qty',        right: true  },
  { key: 'average_price',        label: 'Avg. Cost',  right: true  },
  { key: 'last_price',           label: 'LTP',        right: true  },
  { key: 'invested',             label: 'Invested',   right: true  },
  { key: 'cur_val',              label: 'Cur. Val',   right: true  },
  { key: 'pnl',                  label: 'P&L',        right: true  },
  { key: 'pnl_pct',              label: 'Net Chg',    right: true  },
  { key: 'day_change_percentage', label: 'Day Chg',   right: true  },
];

function getSortValue(h: KiteHolding, key: SortKey): number | string {
  switch (key) {
    case 'tradingsymbol':        return h.tradingsymbol;
    case 'quantity':             return h.quantity;
    case 'average_price':        return h.average_price;
    case 'last_price':           return h.last_price;
    case 'invested':             return h.quantity * h.average_price;
    case 'cur_val':              return h.last_price * h.quantity;
    case 'pnl':                  return h.pnl;
    case 'pnl_pct':              return h.average_price > 0 ? ((h.last_price - h.average_price) / h.average_price) * 100 : 0;
    case 'day_change_percentage': return h.day_change_percentage;
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────


function HoldingsSkeleton() {
  return (
    <>
      {[...Array(4)].map((_, i) => (
        <tr key={i} className="border-b border-outline-variant/30">
          {[...Array(9)].map((_, j) => (
            <td key={j} className="p-3">
              <div className="h-3 bg-surface-container-high rounded animate-pulse" style={{ width: j === 0 ? '60%' : '80%' }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [activeUsers, setActiveUsers]       = useState<ActiveUser[]>([]);
  const [selectedKiteId, setSelectedKiteId] = useState<string>('');
  const [holdings, setHoldings]             = useState<KiteHolding[]>([]);
  const [loadingUsers, setLoadingUsers]     = useState(true);
  const [loadingHoldings, setLoadingHoldings] = useState(false);
  const [holdingsError, setHoldingsError]   = useState<string | null>(null);
  const [sortKey, setSortKey]     = useState<SortKey>('pnl_pct');
  const [sortDir, setSortDir]     = useState<SortDir>('desc');
  const [dropdownOpen, setDropdownOpen]   = useState(false);
  const [searchQuery, setSearchQuery]     = useState('');
  const [filterText, setFilterText]       = useState('');
  const [focusedUserIndex, setFocusedUserIndex] = useState(-1);
  const dropdownRef  = useRef<HTMLDivElement>(null);
  const searchRef    = useRef<HTMLInputElement>(null);
  const userListRef  = useRef<HTMLDivElement>(null);
  const userItemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (dropdownOpen) {
      setTimeout(() => searchRef.current?.focus(), 50);
    } else {
      setSearchQuery('');
      setFocusedUserIndex(-1);
    }
  }, [dropdownOpen]);

  useEffect(() => {
    setFocusedUserIndex(-1);
    userItemRefs.current = [];
  }, [searchQuery]);

  useEffect(() => {
    if (focusedUserIndex >= 0 && userItemRefs.current[focusedUserIndex]) {
      userItemRefs.current[focusedUserIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedUserIndex]);

  // Fetch active users on mount
  useEffect(() => {
    fetch('/api/users/active')
      .then(r => r.json())
      .then(({ data }) => {
        setActiveUsers(data ?? []);
        if (data?.length) setSelectedKiteId(data[0].zerodha_user_id);
      })
      .catch(() => setActiveUsers([]))
      .finally(() => setLoadingUsers(false));
  }, []);

  // Fetch holdings whenever the selected user changes
  useEffect(() => {
    if (!selectedKiteId) return;
    setLoadingHoldings(true);
    setHoldingsError(null);
    fetch(`/api/users/${encodeURIComponent(selectedKiteId)}/holdings`)
      .then(r => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then(({ data }) => setHoldings(data ?? []))
      .catch(e => setHoldingsError(`Failed to load holdings: ${e.message}`))
      .finally(() => setLoadingHoldings(false));
  }, [selectedKiteId]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedHoldings = useMemo(() => {
    return [...holdings].sort((a, b) => {
      const av = getSortValue(a, sortKey);
      const bv = getSortValue(b, sortKey);
      const cmp = typeof av === 'string'
        ? av.localeCompare(bv as string)
        : (av as number) - (bv as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [holdings, sortKey, sortDir]);

  const summary = useMemo(() => {
    const calc = (hs: KiteHolding[]) => {
      const totalInvested = hs.reduce((s, h) => s + h.quantity * h.average_price, 0);
      const totalCurVal   = hs.reduce((s, h) => s + h.last_price * h.quantity, 0);
      const totalPnl      = hs.reduce((s, h) => s + h.pnl, 0);
      const totalPnlPct   = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
      return { totalInvested, totalCurVal, totalPnl, totalPnlPct };
    };
    return {
      overall: calc(holdings),
      profit:  calc(holdings.filter(h => h.pnl > 0)),
    };
  }, [holdings]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return activeUsers.filter(u =>
      !q ||
      u.zerodha_user_id.toLowerCase().includes(q) ||
      (u.name ?? '').toLowerCase().includes(q)
    );
  }, [activeUsers, searchQuery]);

  function handleUserKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedUserIndex(i => Math.min(i + 1, filteredUsers.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedUserIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = focusedUserIndex >= 0 ? filteredUsers[focusedUserIndex] : filteredUsers[0];
      if (target) { setSelectedKiteId(target.zerodha_user_id); setDropdownOpen(false); }
    } else if (e.key === 'Escape') {
      setDropdownOpen(false);
    }
  }

  return (
    <div className="p-6 min-h-full overflow-y-auto bg-background">
      <div className="max-w-[1600px] mx-auto space-y-6">

        {/* Portfolio Summary Row */}
        <div className="flex gap-4">

          {/* Profit Only */}
          <div className="flex-1 bg-surface-container border border-outline-variant rounded-sm p-4">
            <div className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-4 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: '16px' }}>trending_up</span>
              Profit Only
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-on-surface-variant mb-1.5">Total Investment</div>
                <div className="text-2xl font-semibold text-on-surface tabular-nums">{inrInt(summary.profit.totalInvested)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-on-surface-variant mb-1.5">Current Value</div>
                <div className="text-2xl font-semibold text-on-surface tabular-nums">{inrInt(summary.profit.totalCurVal)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-on-surface-variant mb-1.5">Total P&amp;L</div>
                <div className="text-2xl font-semibold tabular-nums text-secondary">+{inrInt(summary.profit.totalPnl)}</div>
                <div className="text-xs mt-1 text-secondary">+{summary.profit.totalPnlPct.toFixed(2)}%</div>
              </div>
            </div>
          </div>

          {/* Overall */}
          <div className="flex-1 bg-surface-container border border-outline-variant rounded-sm p-4">
            <div className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-4 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: '16px' }}>donut_small</span>
              Overall
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-on-surface-variant mb-1.5">Total Investment</div>
                <div className="text-2xl font-semibold text-on-surface tabular-nums">{inrInt(summary.overall.totalInvested)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-on-surface-variant mb-1.5">Current Value</div>
                <div className="text-2xl font-semibold text-on-surface tabular-nums">{inrInt(summary.overall.totalCurVal)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-on-surface-variant mb-1.5">Total P&amp;L</div>
                <div className={`text-2xl font-semibold tabular-nums ${summary.overall.totalPnl >= 0 ? 'text-secondary' : 'text-tertiary'}`}>
                  {summary.overall.totalPnl >= 0 ? '+' : ''}{inrInt(summary.overall.totalPnl)}
                </div>
                <div className={`text-xs mt-1 ${summary.overall.totalPnlPct >= 0 ? 'text-secondary' : 'text-tertiary'}`}>
                  {summary.overall.totalPnlPct >= 0 ? '+' : ''}{summary.overall.totalPnlPct.toFixed(2)}%
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Holdings + Allocation */}
        <div className="grid grid-cols-12 gap-4">

          {/* Holdings Table */}
          <div className="col-span-12 bg-surface-container border border-outline-variant rounded-sm flex flex-col">
            <div className="p-4 border-b border-outline-variant flex flex-wrap justify-between items-center gap-3 min-w-0">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold text-on-surface">Portfolio Holdings</h2>

                {/* User selector */}
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-on-surface-variant uppercase tracking-wider whitespace-nowrap">
                    Kite User
                  </label>
                  {loadingUsers ? (
                    <div className="h-8 w-52 bg-surface-container-high rounded-sm animate-pulse" />
                  ) : activeUsers.length === 0 ? (
                    <span className="text-sm text-on-surface-variant">No active users</span>
                  ) : (
                    <div ref={dropdownRef} className="relative">
                      {/* Trigger */}
                      <button
                        onClick={() => setDropdownOpen(o => !o)}
                        className="flex items-center justify-between gap-3 min-w-52 px-3 py-2 text-sm text-on-surface bg-surface-container-high border border-outline-variant rounded-sm hover:border-primary transition-colors focus:outline-none focus:border-primary"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: '16px' }}>person</span>
                          <span className="truncate">
                            {(() => {
                              const u = activeUsers.find(u => u.zerodha_user_id === selectedKiteId);
                              return u ? (u.name ? `${u.name} (${u.zerodha_user_id})` : u.zerodha_user_id) : selectedKiteId;
                            })()}
                          </span>
                        </div>
                        <span
                          className="material-symbols-outlined text-on-surface-variant flex-shrink-0 transition-transform duration-200"
                          style={{ fontSize: '18px', transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        >expand_more</span>
                      </button>

                      {/* Dropdown list */}
                      {dropdownOpen && (
                        <div className="absolute left-0 top-full mt-1 min-w-full w-max z-50 bg-surface-container-high border border-outline-variant rounded-sm shadow-xl overflow-hidden">
                          {/* Search input */}
                          <div className="flex items-center gap-2 px-3 py-2 border-b border-outline-variant bg-surface-container">
                            <span className="material-symbols-outlined text-on-surface-variant flex-shrink-0" style={{ fontSize: '16px' }}>search</span>
                            <input
                              ref={searchRef}
                              type="text"
                              value={searchQuery}
                              onChange={e => setSearchQuery(e.target.value)}
                              onKeyDown={handleUserKeyDown}
                              placeholder="Search user..."
                              className="flex-1 bg-transparent text-sm text-on-surface placeholder-on-surface-variant/50 outline-none"
                            />
                            {searchQuery && (
                              <button onClick={() => setSearchQuery('')}>
                                <span className="material-symbols-outlined text-on-surface-variant hover:text-on-surface transition-colors" style={{ fontSize: '15px' }}>close</span>
                              </button>
                            )}
                          </div>

                          {/* Filtered list */}
                          <div ref={userListRef} className="max-h-60 overflow-y-auto">
                            {filteredUsers.length === 0 ? (
                              <div className="px-3 py-4 text-sm text-on-surface-variant text-center">
                                No users match "{searchQuery}"
                              </div>
                            ) : filteredUsers.map((u, i) => {
                              const label = u.name ? `${u.name} (${u.zerodha_user_id})` : u.zerodha_user_id;
                              const isSelected = u.zerodha_user_id === selectedKiteId;
                              const isFocused = focusedUserIndex === i;
                              return (
                                <button
                                  key={u.zerodha_user_id}
                                  ref={el => { userItemRefs.current[i] = el; }}
                                  onClick={() => { setSelectedKiteId(u.zerodha_user_id); setDropdownOpen(false); }}
                                  onMouseEnter={() => setFocusedUserIndex(i)}
                                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left transition-colors border-l-2
                                    ${isSelected
                                      ? 'bg-primary/20 text-primary border-primary'
                                      : isFocused
                                        ? 'bg-surface-variant text-on-surface border-primary'
                                        : 'text-on-surface border-transparent'
                                    }`}
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: '15px', opacity: isSelected ? 1 : 0.4 }}>person</span>
                                  {label}
                                  {isSelected && (
                                    <span className="material-symbols-outlined text-primary ml-auto" style={{ fontSize: '15px' }}>check</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Instrument filter */}
              <div className="flex items-center gap-2 w-64 bg-surface-container-high border border-outline-variant rounded-sm px-3 py-2 focus-within:border-primary transition-colors">
                <span className="material-symbols-outlined text-on-surface-variant flex-shrink-0" style={{ fontSize: '16px' }}>search</span>
                <input
                  type="text"
                  value={filterText}
                  onChange={e => setFilterText(e.target.value)}
                  placeholder="Filter by instrument..."
                  className="bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none flex-1 min-w-0"
                />
                <button onClick={() => setFilterText('')} className="flex-shrink-0" style={{ visibility: filterText ? 'visible' : 'hidden' }}>
                  <span className="material-symbols-outlined text-on-surface-variant hover:text-on-surface transition-colors" style={{ fontSize: '15px' }}>close</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-high border-b border-outline-variant">
                    {COLS.map(col => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        className={`p-3 text-sm font-bold uppercase tracking-wider text-on-surface-variant cursor-pointer select-none whitespace-nowrap hover:text-on-surface transition-colors ${col.right ? 'text-right' : ''}`}
                      >
                        <span className={`inline-flex items-center gap-1 w-full ${col.right ? 'justify-end' : 'justify-start'}`}>
                          {col.right ? (
                            <>
                              {sortKey === col.key ? (
                                <span className="material-symbols-outlined text-primary" style={{ fontSize: '14px' }}>
                                  {sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                                </span>
                              ) : (
                                <span className="material-symbols-outlined text-outline" style={{ fontSize: '14px' }}>unfold_more</span>
                              )}
                              {col.label}
                            </>
                          ) : (
                            <>
                              {col.label}
                              {sortKey === col.key ? (
                                <span className="material-symbols-outlined text-primary" style={{ fontSize: '14px' }}>
                                  {sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                                </span>
                              ) : (
                                <span className="material-symbols-outlined text-outline" style={{ fontSize: '14px' }}>unfold_more</span>
                              )}
                            </>
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="font-data-mono text-sm divide-y divide-outline-variant/30">
                  {loadingHoldings ? (
                    <HoldingsSkeleton />
                  ) : holdingsError ? (
                    <tr>
                      <td colSpan={9} className="p-6 text-center text-on-surface-variant text-xs">
                        <span className="material-symbols-outlined text-error align-middle mr-1">error</span>
                        {holdingsError}
                      </td>
                    </tr>
                  ) : holdings.length === 0 && selectedKiteId ? (
                    <tr>
                      <td colSpan={9} className="p-6 text-center text-on-surface-variant text-xs">
                        No holdings found for {selectedKiteId}.
                      </td>
                    </tr>
                  ) : holdings.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-6 text-center text-on-surface-variant text-xs">
                        Select an active Kite user to view their holdings.
                      </td>
                    </tr>
                  ) : (<>
                    {sortedHoldings.filter(h => h.tradingsymbol.toLowerCase().includes(filterText.toLowerCase())).map(h => {
                      const pnlPos  = h.pnl >= 0;
                      const pct     = h.average_price > 0 ? ((h.last_price - h.average_price) / h.average_price) * 100 : 0;
                      const dayPos  = h.day_change_percentage >= 0;
                      const invested = h.quantity * h.average_price;
                      const curVal  = h.last_price * h.quantity;
                      return (
                        <tr key={h.tradingsymbol} className="hover:bg-surface-variant transition-colors">
                          <td className="p-3 text-on-surface">{h.tradingsymbol}</td>
                          <td className="p-3 text-right text-on-surface">{inrQty(h.quantity)}</td>
                          <td className="p-3 text-right text-on-surface">{inr(h.average_price)}</td>
                          <td className={`p-3 text-right ${pnlPos ? 'text-secondary' : 'text-tertiary'}`}>
                            {inr(h.last_price)}
                          </td>
                          <td className="p-3 text-right text-on-surface">{inrInt(invested)}</td>
                          <td className="p-3 text-right text-on-surface">{inrInt(curVal)}</td>
                          <td className={`p-3 text-right ${pnlPos ? 'text-secondary' : 'text-tertiary'}`}>
                            {pnlPos ? '+' : ''}{inrInt(h.pnl)}
                          </td>
                          <td className="p-3 text-right">
                            <span className={`px-2 py-0.5 rounded text-sm ${pnlPos ? 'bg-secondary/10 text-secondary' : 'bg-tertiary/10 text-tertiary'}`}>
                              {pnlPos ? '+' : ''}{pct.toFixed(2)}%
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <span className={`px-2 py-0.5 rounded text-sm ${dayPos ? 'bg-secondary/10 text-secondary' : 'bg-tertiary/10 text-tertiary'}`}>
                              {dayPos ? '+' : ''}{h.day_change_percentage.toFixed(2)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}

                    {/* Summary row */}
                    {(() => {
                      const { totalInvested, totalCurVal, totalPnl, totalPnlPct } = summary.overall;
                      const pnlPos = totalPnl >= 0;
                      const pctPos = totalPnlPct >= 0;
                      return (
                        <tr className="border-t-2 border-outline-variant bg-surface-container-high font-semibold">
                          <td className="p-3 text-on-surface text-sm uppercase tracking-wider">Total</td>
                          <td className="p-3" />
                          <td className="p-3" />
                          <td className="p-3" />
                          <td className="p-3 text-right text-on-surface">{inrInt(totalInvested)}</td>
                          <td className="p-3 text-right text-on-surface">{inrInt(totalCurVal)}</td>
                          <td className={`p-3 text-right ${pnlPos ? 'text-secondary' : 'text-tertiary'}`}>
                            {pnlPos ? '+' : ''}{inrInt(totalPnl)}
                          </td>
                          <td className="p-3 text-right">
                            <span className={`px-2 py-0.5 rounded text-sm ${pctPos ? 'bg-secondary/10 text-secondary' : 'bg-tertiary/10 text-tertiary'}`}>
                              {pctPos ? '+' : ''}{totalPnlPct.toFixed(2)}%
                            </span>
                          </td>
                          <td className="p-3" />
                        </tr>
                      );
                    })()}
                  </>)}

                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>

      {/* FAB */}
      <button
        className="fixed bottom-6 right-6 w-14 h-14 bg-primary text-on-primary rounded-full shadow-lg flex items-center justify-center z-50 hover:scale-105 transition-transform"
        title="Add chart"
      >
        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>add_chart</span>
      </button>
    </div>
  );
}
