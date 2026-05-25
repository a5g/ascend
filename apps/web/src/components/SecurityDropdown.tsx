import { useState, useEffect, useRef } from 'react';

export interface SecurityOption {
  id: number;
  symbol: string;
  name_of_company: string;
  series: string;
  exchange: string;
}

interface SecurityDropdownProps {
  value: SecurityOption | null;
  onChange: (s: SecurityOption | null) => void;
  className?: string;
  placeholder?: string;
}

export default function SecurityDropdown({
  value,
  onChange,
  className = 'relative w-56',
  placeholder = 'Select security…',
}: SecurityDropdownProps) {
  const [open,         setOpen]         = useState(false);
  const [query,        setQuery]        = useState('');
  const [results,      setResults]      = useState<SecurityOption[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const ref      = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
    if (!open) setFocusedIndex(-1);
  }, [open]);

  useEffect(() => {
    setFocusedIndex(-1);
    itemRefs.current = [];
    if (!query.trim()) { setResults([]); return; }
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/securities?search=${encodeURIComponent(query.trim())}&page=1`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => { setResults((data.data ?? []).slice(0, 10)); setLoading(false); })
      .catch(() => setLoading(false));
    return () => controller.abort();
  }, [query]);

  useEffect(() => {
    if (focusedIndex >= 0) itemRefs.current[focusedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [focusedIndex]);

  function select(s: SecurityOption) {
    onChange(s); setOpen(false); setQuery(''); setResults([]); setFocusedIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocusedIndex(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setFocusedIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); const t = focusedIndex >= 0 ? results[focusedIndex] : results[0]; if (t) select(t); }
    else if (e.key === 'Escape') setOpen(false);
  }

  return (
    <div ref={ref} className={className}>
      <button type="button"
        onClick={() => { setOpen(o => !o); if (!open) { setQuery(''); setResults([]); } }}
        className="w-full flex items-center justify-between bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-3 py-1.5 text-xs focus:border-primary focus:outline-none hover:border-primary transition-colors"
      >
        <span className={value ? 'text-on-surface' : 'text-on-surface-variant/60'}>
          {value ? value.symbol : placeholder}
        </span>
        <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: '16px' }}>
          {open ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 w-full min-w-[280px] bg-surface-container border border-outline-variant shadow-lg mt-0.5">
          <div className="p-2 border-b border-outline-variant">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search symbol or company…"
              className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface text-xs px-2 py-1.5 focus:border-primary focus:outline-none font-data-mono"
            />
          </div>
          <div ref={listRef} className="max-h-48 overflow-y-auto">
            {loading && (
              <div className="px-3 py-2 text-[11px] text-on-surface-variant font-label-caps">Searching…</div>
            )}
            {!loading && query.trim() === '' && (
              <div className="px-3 py-2 text-[11px] text-on-surface-variant font-label-caps">Type to search securities</div>
            )}
            {!loading && query.trim() !== '' && results.length === 0 && (
              <div className="px-3 py-2 text-[11px] text-on-surface-variant font-label-caps">No results found</div>
            )}
            {results.map((s, i) => (
              <button
                key={s.id}
                ref={el => { itemRefs.current[i] = el; }}
                type="button"
                onClick={() => select(s)}
                onMouseEnter={() => setFocusedIndex(i)}
                className={`w-full text-left px-3 py-2 flex flex-col gap-0.5 transition-colors border-l-2 ${
                  value?.id === s.id
                    ? 'bg-primary/20 text-primary border-l-primary'
                    : focusedIndex === i
                      ? 'bg-surface-container-high border-l-primary text-on-surface'
                      : 'border-l-transparent text-on-surface'
                }`}
              >
                <span className="font-data-mono text-xs font-bold">{s.symbol}</span>
                <span className="text-[10px] text-on-surface-variant truncate">{s.name_of_company}</span>
              </button>
            ))}
          </div>
          {value && (
            <div className="border-t border-outline-variant p-1">
              <button type="button"
                onClick={() => { onChange(null); setOpen(false); setQuery(''); setResults([]); }}
                className="w-full text-center text-[10px] font-label-caps text-on-surface-variant hover:text-tertiary py-1 transition-colors">
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
