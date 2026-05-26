import { useState } from 'react';

interface UpdateResult {
  updated: string[];
  notFound: string[];
}

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-container border border-outline-variant rounded-sm">
      <div className="px-5 py-3 border-b border-outline-variant flex items-center gap-2">
        <span className="material-symbols-outlined text-primary" style={{ fontSize: '18px' }}>{icon}</span>
        <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface">{title}</h2>
      </div>
      <div className="px-5 py-5">{children}</div>
    </div>
  );
}

export default function KitePage() {
  const [raw,       setRaw]       = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsed,    setParsed]    = useState<Record<string, string> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result,    setResult]    = useState<UpdateResult | null>(null);
  const [apiError,  setApiError]  = useState<string | null>(null);

  function handleChange(value: string) {
    setRaw(value);
    setResult(null);
    setApiError(null);
    if (!value.trim()) { setParsed(null); setParseError(null); return; }
    try {
      const obj = JSON.parse(value);
      if (typeof obj !== 'object' || Array.isArray(obj) || obj === null)
        throw new Error('Must be a JSON object');
      const entries = Object.entries(obj);
      if (entries.length === 0) throw new Error('Object is empty');
      for (const [k, v] of entries) {
        if (typeof k !== 'string' || !k.trim()) throw new Error('Keys must be non-empty strings');
        if (typeof v !== 'string' || !(v as string).trim()) throw new Error(`Value for "${k}" must be a non-empty string`);
      }
      setParsed(obj as Record<string, string>);
      setParseError(null);
    } catch (e: any) {
      setParsed(null);
      setParseError(e.message || 'Invalid JSON');
    }
  }

  async function submit() {
    if (!parsed) return;
    setSubmitting(true);
    setApiError(null);
    setResult(null);
    try {
      const res = await fetch('/api/kite/bulk-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens: parsed }),
      });
      const data = await res.json() as any;
      if (!res.ok) { setApiError(data?.error || 'Update failed'); return; }
      setResult({ updated: data.updated, notFound: data.notFound });
      setRaw('');
      setParsed(null);
    } catch {
      setApiError('Network error');
    } finally {
      setSubmitting(false);
    }
  }

  const userCount = parsed ? Object.keys(parsed).length : 0;

  return (
    <div className="p-6 min-h-full overflow-y-auto bg-background">
      <div className="max-w-2xl mx-auto space-y-6">

        <div>
          <h1 className="text-xl font-bold text-on-surface tracking-tight">Kite Token Manager</h1>
          <p className="text-xs text-on-surface-variant mt-1">Bulk update Zerodha access tokens for active users.</p>
        </div>

        <SectionCard title="Paste Token JSON" icon="key">
          <div className="space-y-4">
            <p className="text-xs text-on-surface-variant">
              Paste a JSON object where each key is a <span className="font-mono text-on-surface">zerodha_user_id</span> and the value is the new access token.
            </p>
            <div className="bg-surface-container-lowest border border-outline-variant rounded-sm px-3 py-2 text-xs text-on-surface-variant font-mono">
              {`{\n  "RA1144": "ozbfjFDRZ...",\n  "UT0149": "0vUNyLM9+FE..."\n}`}
            </div>

            <textarea
              value={raw}
              onChange={e => handleChange(e.target.value)}
              rows={10}
              spellCheck={false}
              placeholder={'{\n  "USER_ID": "access_token_here"\n}'}
              className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-mono text-xs px-3 py-2.5 focus:outline-none focus:border-primary resize-y rounded-sm placeholder:text-on-surface-variant/40"
            />

            {parseError && (
              <div className="flex items-center gap-2 p-2.5 bg-error/10 border border-error/30 text-error text-xs rounded-sm">
                <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '14px' }}>error</span>
                {parseError}
              </div>
            )}

            {parsed && !parseError && (
              <div className="flex items-center gap-2 p-2.5 bg-secondary/10 border border-secondary/30 text-secondary text-xs rounded-sm">
                <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '14px' }}>check_circle</span>
                Valid JSON — <span className="font-bold">{userCount} user{userCount !== 1 ? 's' : ''}</span> will be updated:
                <span className="font-mono text-on-surface ml-1">{Object.keys(parsed).join(', ')}</span>
              </div>
            )}

            {apiError && (
              <div className="flex items-center gap-2 p-2.5 bg-error/10 border border-error/30 text-error text-xs rounded-sm">
                <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '14px' }}>error</span>
                {apiError}
              </div>
            )}

            <button
              onClick={submit}
              disabled={!parsed || submitting}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-primary/15 border border-primary/40 text-primary rounded-sm hover:bg-primary/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>sync</span>
              {submitting ? 'Updating…' : `Update ${userCount > 0 ? userCount : ''} Token${userCount !== 1 ? 's' : ''}`}
            </button>
          </div>
        </SectionCard>

        {result && (
          <SectionCard title="Update Result" icon="task_alt">
            <div className="space-y-4">
              {result.updated.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-secondary mb-2">
                    Updated ({result.updated.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {result.updated.map(id => (
                      <span key={id} className="flex items-center gap-1 px-2.5 py-1 bg-secondary/10 border border-secondary/30 text-secondary text-xs font-mono rounded-sm">
                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>check</span>
                        {id}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {result.notFound.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-tertiary mb-2">
                    Not Found ({result.notFound.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {result.notFound.map(id => (
                      <span key={id} className="flex items-center gap-1 px-2.5 py-1 bg-tertiary/10 border border-tertiary/30 text-tertiary text-xs font-mono rounded-sm">
                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>person_off</span>
                        {id}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {result.updated.length === 0 && result.notFound.length === 0 && (
                <p className="text-xs text-on-surface-variant">No tokens were processed.</p>
              )}
            </div>
          </SectionCard>
        )}

      </div>
    </div>
  );
}
