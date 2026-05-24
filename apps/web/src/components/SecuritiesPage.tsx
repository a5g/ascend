import { useState, useEffect, useMemo, useRef, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Security {
  id:               number;
  symbol:           string;
  name_of_company:  string;
  series:           string;
  date_of_listing:  string | null;
  paid_up_value:    number | null;
  market_lot:       number | null;
  isin_number:      string;
  face_value:       number | null;
}

interface ApiResponse {
  data:       Security[];
  total:      number;
  page:       number;
  totalPages: number;
}

type SortKey = keyof Omit<Security, 'id'>;
type SortDir = 'asc' | 'desc';

const COLS: { key: SortKey; label: string; right: boolean }[] = [
  { key: 'symbol',          label: 'Symbol',          right: false },
  { key: 'name_of_company', label: 'Name of Company', right: false },
  { key: 'series',          label: 'Series',          right: false },
  { key: 'date_of_listing', label: 'Date of Listing', right: false },
  { key: 'paid_up_value',   label: 'Paid Up Value',   right: true  },
  { key: 'market_lot',      label: 'Market Lot',      right: true  },
  { key: 'isin_number',     label: 'ISIN Number',     right: false },
  { key: 'face_value',      label: 'Face Value',      right: true  },
];

const EMPTY_FORM = {
  symbol:          '',
  name_of_company: '',
  series:          '',
  isin_number:     '',
  date_of_listing: '',
  paid_up_value:   '',
  market_lot:      '',
  face_value:      '',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(s: string | null) {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Add Security Modal ────────────────────────────────────────────────────────

interface AddModalProps {
  onClose:   () => void;
  onSuccess: (msg: string) => void;
}

function AddSecurityModal({ onClose, onSuccess }: AddModalProps) {
  const [form, setForm]     = useState({ ...EMPTY_FORM });
  const [adding, setAdding] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const canAdd = ['symbol', 'name_of_company', 'series', 'isin_number'].every(
    k => form[k as keyof typeof form]?.trim()
  );

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleAdd = async () => {
    if (!canAdd || adding) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch('/api/securities', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol:          form.symbol.trim().toUpperCase(),
          name_of_company: form.name_of_company.trim(),
          series:          form.series.trim().toUpperCase(),
          isin_number:     form.isin_number.trim().toUpperCase(),
          date_of_listing: form.date_of_listing || null,
          paid_up_value:   form.paid_up_value ? parseInt(form.paid_up_value, 10) : null,
          market_lot:      form.market_lot     ? parseInt(form.market_lot, 10)   : null,
          face_value:      form.face_value     ? parseInt(form.face_value, 10)   : null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? 'Failed to add security');
        return;
      }

      onSuccess('Security added successfully');
      onClose();
    } catch {
      setError('Network error — please try again');
    } finally {
      setAdding(false);
    }
  };

  const field = (
    label: string,
    key: keyof typeof EMPTY_FORM,
    opts?: { type?: string; placeholder?: string; mandatory?: boolean; wide?: boolean; step?: string }
  ) => (
    <div className={`flex flex-col gap-1.5 ${opts?.wide ? 'col-span-2' : ''}`}>
      <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">
        {label}{opts?.mandatory && <span className="text-tertiary ml-0.5">*</span>}
      </label>
      <input
        type={opts?.type ?? 'text'}
        placeholder={opts?.placeholder}
        step={opts?.step}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        style={opts?.type === 'date' ? { colorScheme: 'dark' } : undefined}
        className="bg-surface-container border border-outline-variant rounded-sm px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:border-primary transition-colors"
      />
    </div>
  );

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Dialog */}
      <div className="w-full max-w-lg mx-4 bg-surface-container-high border border-outline-variant rounded-sm shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: '20px' }}>add_circle</span>
            <h2 className="text-base font-bold text-on-surface">Add Security</h2>
          </div>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface transition-colors rounded-sm p-0.5"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
          </button>
        </div>

        {/* Form body */}
        <div className="px-5 py-5 grid grid-cols-2 gap-4">
          {field('Symbol',          'symbol',          { placeholder: 'RELIANCE',           mandatory: true  })}
          {field('Series',          'series',          { placeholder: 'EQ',                 mandatory: true  })}
          {field('Name of Company', 'name_of_company', { placeholder: 'Reliance Industries Ltd', mandatory: true, wide: true })}
          {field('ISIN Number',     'isin_number',     { placeholder: 'INE002A01018',       mandatory: true, wide: true })}
          {field('Date of Listing', 'date_of_listing', { type: 'date' })}
          {field('Paid Up Value',   'paid_up_value',   { type: 'number', placeholder: '10', step: '1' })}
          {field('Market Lot',      'market_lot',      { type: 'number', placeholder: '1',  step: '1' })}
          {field('Face Value',      'face_value',      { type: 'number', placeholder: '10', step: '1' })}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mb-3 flex items-center gap-2 px-3 py-2.5 rounded-sm text-sm"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
            <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '16px' }}>error</span>
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-outline-variant">
          <p className="text-xs text-on-surface-variant"><span className="text-tertiary">*</span> Required fields</p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-on-surface-variant bg-surface-container border border-outline-variant rounded-sm hover:border-outline hover:text-on-surface transition-colors"
            >Cancel</button>
            <button
              onClick={handleAdd}
              disabled={!canAdd || adding}
              className={`flex items-center gap-1.5 px-5 py-2 text-sm font-semibold rounded-sm transition-all
                ${canAdd && !adding
                  ? 'bg-primary text-on-primary hover:opacity-90 cursor-pointer'
                  : 'bg-surface-container text-on-surface-variant/40 border border-outline-variant cursor-not-allowed'
                }`}
            >
              {adding ? (
                <><span className="material-symbols-outlined animate-spin" style={{ fontSize: '16px' }}>progress_activity</span>Adding…</>
              ) : (
                <><span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>Add Security</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirm Modal ──────────────────────────────────────────────────────

interface DeleteModalProps {
  security:  Security;
  onCancel:  () => void;
  onDeleted: (id: number) => void;
}

function DeleteConfirmModal({ security, onCancel, onDeleted }: DeleteModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/securities/${security.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? 'Failed to delete security');
        return;
      }
      onDeleted(security.id);
    } catch {
      setError('Network error — please try again');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(2px)' }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="w-full max-w-sm mx-4 bg-surface-container-high border border-outline-variant rounded-sm shadow-2xl">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-outline-variant">
          <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '22px', color: '#f87171' }}>warning</span>
          <h2 className="text-base font-bold text-on-surface">Delete Security</h2>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-3">
          <p className="text-sm text-on-surface-variant">
            Are you sure you want to delete this security? This action cannot be undone.
          </p>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-sm border border-outline-variant bg-surface-container">
            <div>
              <div className="text-sm font-semibold font-mono text-on-surface">{security.symbol}</div>
              <div className="text-xs text-on-surface-variant mt-0.5">{security.name_of_company}</div>
            </div>
          </div>
          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-sm text-sm"
              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
              <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '16px' }}>error</span>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-outline-variant">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="px-4 py-2 text-sm font-semibold text-on-surface-variant bg-surface-container border border-outline-variant rounded-sm hover:border-outline hover:text-on-surface transition-colors disabled:opacity-50"
          >Cancel</button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold rounded-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: '#dc2626', color: '#fff' }}
          >
            {deleting
              ? <><span className="material-symbols-outlined animate-spin" style={{ fontSize: '16px' }}>progress_activity</span>Deleting…</>
              : <><span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>Delete</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SecuritiesPage() {
  const [securities, setSecurities] = useState<Security[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading]       = useState(false);
  const [search, setSearch]         = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [suggestions, setSuggestions] = useState<Security[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [sortKey, setSortKey]       = useState<SortKey>('symbol');
  const [sortDir, setSortDir]       = useState<SortDir>('asc');
  const [showModal, setShowModal]         = useState(false);
  const [deleteTarget, setDeleteTarget]   = useState<Security | null>(null);
  const [toast, setToast]                 = useState<{ msg: string; ok: boolean } | null>(null);
  const toastTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  // ── Click-outside: close suggestions ──────────────────────────────────────

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Fetch table data ───────────────────────────────────────────────────────

  const fetchPage = useCallback((p: number, q: string) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p) });
    if (q) params.set('search', q);
    fetch(`/api/securities?${params}`)
      .then(r => r.json())
      .then((res: ApiResponse) => {
        setSecurities(res.data ?? []);
        setTotal(res.total ?? 0);
        setTotalPages(res.totalPages ?? 1);
      })
      .catch(() => setSecurities([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchPage(page, search); }, [page, search, fetchPage]);

  // ── Live search: debounce table + fetch suggestions ────────────────────────

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    setActiveSuggestion(-1);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      setPage(1);
      setSearch('');
      return;
    }

    // Fetch symbol suggestions immediately
    fetch(`/api/securities?page=1&search=${encodeURIComponent(value.trim())}`)
      .then(r => r.json())
      .then((res: ApiResponse) => {
        setSuggestions((res.data ?? []).slice(0, 8));
        setShowSuggestions(true);
      })
      .catch(() => setSuggestions([]));

    // Debounce the table update
    debounceRef.current = setTimeout(() => {
      setPage(1);
      setSearch(value.trim());
    }, 350);
  };

  const selectSuggestion = (s: Security) => {
    setSearchInput(s.symbol);
    setSuggestions([]);
    setShowSuggestions(false);
    setPage(1);
    setSearch(s.symbol);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestion(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestion(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = activeSuggestion >= 0 ? suggestions[activeSuggestion] : suggestions[0];
      if (target) selectSuggestion(target);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const clearSearch = () => {
    setSearchInput('');
    setSuggestions([]);
    setShowSuggestions(false);
    setPage(1);
    setSearch('');
  };

  // ── Sort ──────────────────────────────────────────────────────────────────

  const sorted = useMemo(() => {
    return [...securities].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [securities, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  // ── Toast ─────────────────────────────────────────────────────────────────

  const showToast = (msg: string, ok = true) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, ok });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  const handleAddSuccess = (msg: string) => {
    showToast(msg, true);
    fetchPage(1, '');
    setPage(1);
    setSearch('');
    setSearchInput('');
  };

  const handleDeleted = (id: number) => {
    setDeleteTarget(null);
    setSecurities(prev => prev.filter(s => s.id !== id));
    setTotal(t => t - 1);
    showToast('Security deleted successfully', true);
  };

  return (
    <div className="p-6 min-h-full overflow-y-auto bg-background">
      <div className="max-w-[1600px] mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-on-surface">Securities</h1>
            <p className="text-sm text-on-surface-variant mt-0.5">
              {total > 0 ? `${total.toLocaleString('en-IN')} securities` : 'Loading…'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search with live symbol dropdown */}
            <div ref={searchBoxRef} className="relative">
              <div className="flex items-center gap-2 w-80 bg-surface-container-high border border-outline-variant rounded-sm px-3 py-2 focus-within:border-primary transition-colors">
                <span className="material-symbols-outlined text-on-surface-variant flex-shrink-0" style={{ fontSize: '16px' }}>search</span>
                <input
                  type="text"
                  value={searchInput}
                  onChange={e => handleSearchChange(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                  placeholder="Search by symbol…"
                  className="bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none flex-1 min-w-0"
                />
                {searchInput && (
                  <button type="button" onClick={clearSearch}>
                    <span className="material-symbols-outlined text-on-surface-variant hover:text-on-surface transition-colors" style={{ fontSize: '15px' }}>close</span>
                  </button>
                )}
              </div>

              {/* Suggestions dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute left-0 top-full mt-1 w-full z-40 bg-surface-container-high border border-outline-variant rounded-sm shadow-xl overflow-hidden">
                  {suggestions.map((s, idx) => (
                    <button
                      key={s.id}
                      onMouseDown={e => { e.preventDefault(); selectSuggestion(s); }}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm text-left transition-colors
                        ${idx === activeSuggestion
                          ? 'bg-primary/20 text-primary'
                          : 'text-on-surface hover:bg-surface-variant'
                        }`}
                    >
                      <span className="font-mono font-semibold">{s.symbol}</span>
                      <span className="text-on-surface-variant text-xs truncate">{s.name_of_company}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Add Security button */}
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-primary text-on-primary rounded-sm hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
              Add Security
            </button>
          </div>
        </div>

        {/* Table card */}
        <div className="bg-surface-container border border-outline-variant rounded-sm">
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
                            {sortKey === col.key
                              ? <span className="material-symbols-outlined text-primary" style={{ fontSize: '14px' }}>{sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>
                              : <span className="material-symbols-outlined text-outline" style={{ fontSize: '14px' }}>unfold_more</span>
                            }
                            {col.label}
                          </>
                        ) : (
                          <>
                            {col.label}
                            {sortKey === col.key
                              ? <span className="material-symbols-outlined text-primary" style={{ fontSize: '14px' }}>{sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>
                              : <span className="material-symbols-outlined text-outline" style={{ fontSize: '14px' }}>unfold_more</span>
                            }
                          </>
                        )}
                      </span>
                    </th>
                  ))}
                  <th className="p-3 text-sm font-bold uppercase tracking-wider text-on-surface-variant text-center w-16"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(10)].map((_, i) => (
                    <tr key={i} className="border-b border-outline-variant/30">
                      {COLS.map((_, j) => (
                        <td key={j} className="p-3">
                          <div className="h-3 bg-surface-container-high rounded animate-pulse" style={{ width: j === 0 || j === 1 ? '70%' : '50%' }} />
                        </td>
                      ))}
                      <td className="p-3"><div className="h-3 w-6 bg-surface-container-high rounded animate-pulse mx-auto" /></td>
                    </tr>
                  ))
                ) : sorted.length === 0 ? (
                  <tr>
                    <td colSpan={COLS.length + 1} className="p-10 text-center text-on-surface-variant text-sm">
                      {search ? `No securities matching "${search}"` : 'No securities found'}
                    </td>
                  </tr>
                ) : (
                  sorted.map(s => (
                    <tr key={s.id} className="border-b border-outline-variant/30 hover:bg-surface-container-high/50 transition-colors group">
                      <td className="p-3 text-sm font-mono text-on-surface whitespace-nowrap">{s.symbol}</td>
                      <td className="p-3 text-sm text-on-surface">{s.name_of_company}</td>
                      <td className="p-3 text-sm text-on-surface-variant">{s.series}</td>
                      <td className="p-3 text-sm text-on-surface-variant whitespace-nowrap">{fmtDate(s.date_of_listing)}</td>
                      <td className="p-3 text-sm text-on-surface tabular-nums text-right">{s.paid_up_value != null ? s.paid_up_value.toLocaleString('en-IN') : '—'}</td>
                      <td className="p-3 text-sm text-on-surface tabular-nums text-right">{s.market_lot ?? '—'}</td>
                      <td className="p-3 text-sm font-mono text-on-surface-variant whitespace-nowrap">{s.isin_number}</td>
                      <td className="p-3 text-sm text-on-surface tabular-nums text-right">{s.face_value != null ? s.face_value.toLocaleString('en-IN') : '—'}</td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => setDeleteTarget(s)}
                          title={`Delete ${s.symbol}`}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-sm hover:bg-red-500/10"
                          style={{ color: '#f87171' }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-outline-variant">
              <span className="text-sm text-on-surface-variant">
                Page {page} of {totalPages} &middot; {total.toLocaleString('en-IN')} records
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(1)} disabled={page === 1}
                  className="p-1.5 rounded-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>first_page</span>
                </button>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-1.5 rounded-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_left</span>
                </button>

                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                  const p = start + i;
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-sm text-sm font-semibold transition-colors
                        ${p === page ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}`}
                    >{p}</button>
                  );
                })}

                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="p-1.5 rounded-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_right</span>
                </button>
                <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                  className="p-1.5 rounded-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>last_page</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add modal */}
      {showModal && (
        <AddSecurityModal
          onClose={() => setShowModal(false)}
          onSuccess={handleAddSuccess}
        />
      )}

      {/* Delete modal */}
      {deleteTarget && (
        <DeleteConfirmModal
          security={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onDeleted={handleDeleted}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-5 py-3 rounded-sm shadow-xl text-sm font-semibold z-50 whitespace-nowrap"
          style={toast.ok
            ? { background: '#166534', color: '#dcfce7', border: '1px solid #15803d' }
            : { background: '#7f1d1d', color: '#fecaca', border: '1px solid #991b1b' }
          }
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
            {toast.ok ? 'check_circle' : 'error'}
          </span>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
