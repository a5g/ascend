import { useState, useEffect, useRef, useMemo } from 'react';

interface AppSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  searchable?: boolean;
  className?: string;
  listMaxHeight?: string;   // tailwind max-h-* class, default 'max-h-52'
}

export default function AppSelect({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  searchable = false,
  className = '',
  listMaxHeight = 'max-h-52',
}: AppSelectProps) {
  const [open,        setOpen]        = useState(false);
  const [query,       setQuery]       = useState('');
  const [focusedIdx,  setFocusedIdx]  = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef    = useRef<HTMLInputElement>(null);
  const listRef      = useRef<HTMLDivElement>(null);
  const itemRefs     = useRef<(HTMLButtonElement | null)[]>([]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus search when opened; reset when closed
  useEffect(() => {
    if (open) {
      setQuery('');
      setFocusedIdx(-1);
      if (searchable) setTimeout(() => searchRef.current?.focus(), 30);
    }
  }, [open, searchable]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIdx >= 0) itemRefs.current[focusedIdx]?.scrollIntoView({ block: 'nearest' });
  }, [focusedIdx]);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(o => o.toLowerCase().includes(q));
  }, [options, query]);

  function select(opt: string) {
    onChange(opt);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); }
      return;
    }
    if (e.key === 'Escape')     { setOpen(false); return; }
    if (e.key === 'ArrowDown')  { e.preventDefault(); setFocusedIdx(i => Math.min(i + 1, filtered.length - 1)); return; }
    if (e.key === 'ArrowUp')    { e.preventDefault(); setFocusedIdx(i => Math.max(i - 1, 0)); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      const target = focusedIdx >= 0 ? filtered[focusedIdx] : filtered[0];
      if (target) select(target);
    }
  }

  const displayValue = value || placeholder;

  return (
    <div ref={containerRef} className={`relative ${className}`} onKeyDown={handleKeyDown}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs bg-surface-container-high border border-outline-variant text-on-surface hover:border-primary focus:outline-none focus:border-primary transition-colors"
      >
        <span className={`truncate font-data-mono ${value ? 'text-on-surface' : 'text-on-surface-variant/50'}`}>
          {displayValue}
        </span>
        <span
          className="material-symbols-outlined text-on-surface-variant flex-shrink-0 transition-transform duration-150"
          style={{ fontSize: '16px', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >expand_more</span>
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute left-0 top-full mt-1 min-w-full w-max z-50 bg-surface-container-high border border-outline-variant shadow-xl overflow-hidden">
          {searchable && (
            <div className="flex items-center gap-2 px-3 py-2 border-b border-outline-variant bg-surface-container">
              <span className="material-symbols-outlined text-on-surface-variant flex-shrink-0" style={{ fontSize: '14px' }}>search</span>
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); setFocusedIdx(-1); }}
                placeholder="Search…"
                className="flex-1 bg-transparent text-xs text-on-surface placeholder:text-on-surface-variant/50 outline-none font-data-mono"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')}>
                  <span className="material-symbols-outlined text-on-surface-variant hover:text-on-surface transition-colors" style={{ fontSize: '14px' }}>close</span>
                </button>
              )}
            </div>
          )}

          <div ref={listRef} className={`${listMaxHeight} overflow-y-auto`}>
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-xs text-on-surface-variant text-center">No options found</div>
            ) : filtered.map((opt, i) => {
              const isSelected = opt === value;
              const isFocused  = focusedIdx === i;
              return (
                <button
                  key={opt}
                  type="button"
                  ref={el => { itemRefs.current[i] = el; }}
                  onClick={() => select(opt)}
                  onMouseEnter={() => setFocusedIdx(i)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs text-left transition-colors border-l-2 font-data-mono ${
                    isSelected
                      ? 'bg-primary/20 text-primary border-primary'
                      : isFocused
                        ? 'bg-surface-container text-on-surface border-primary'
                        : 'text-on-surface border-transparent hover:bg-surface-container'
                  }`}
                >
                  {opt}
                  {isSelected && (
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: '14px' }}>check</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
