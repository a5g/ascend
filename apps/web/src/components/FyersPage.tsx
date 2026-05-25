import { useState, useEffect } from 'react';

interface FyersConfig {
  id: number;
  fyer_id: string | null;
  app_id: string;
  secret: string | null;
  has_access_token: boolean;
  has_refresh_token: boolean;
  access_token_preview: string | null;
  refresh_token_preview: string | null;
  access_token: string | null;
  refresh_token: string | null;
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`px-2 py-0.5 text-xs font-semibold rounded-sm ${
      ok
        ? 'bg-secondary/15 text-secondary border border-secondary/30'
        : 'bg-surface-container-high text-on-surface-variant border border-outline-variant'
    }`}>{label}</span>
  );
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

export default function FyersPage() {
  const [config, setConfig]     = useState<FyersConfig | null>(null);
  const [loading, setLoading]   = useState(true);

  // Config form
  const [appId, setAppId]   = useState('');
  const [secret, setSecret] = useState('');
  const [fyerId, setFyerId] = useState('');
  const [saving, setSaving] = useState(false);

  // Auth URL
  const [authUrl, setAuthUrl]         = useState<string | null>(null);
  const [authUrlLoading, setAuthUrlLoading] = useState(false);

  // Token generation
  const [authCode, setAuthCode]     = useState('');
  const [tokenLoading, setTokenLoading] = useState(false);

  // Copy state
  const [copied, setCopied] = useState<'access' | 'refresh' | null>(null);

  async function copyToken(token: string, which: 'access' | 'refresh') {
    await navigator.clipboard.writeText(token);
    setCopied(which);
    setTimeout(() => setCopied(null), 1500);
  }

  // Toast
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    fetch('/api/fyers')
      .then(r => r.json())
      .then(res => {
        setConfig(res.data);
        if (res.data) {
          setAppId(res.data.app_id);
          setFyerId(res.data.fyer_id ?? '');
        } else {
          setAppId('KNDJDFEVN6-100');
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function saveConfig() {
    if (!appId.trim() || !secret.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/fyers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: appId.trim(), secret: secret.trim(), fyer_id: fyerId.trim() || undefined }),
      });
      const data = await res.json() as any;
      if (!res.ok) { showToast(data.error || 'Save failed', false); return; }
      showToast('Configuration saved');
      setSecret('');
      // Refresh config
      const r2 = await fetch('/api/fyers').then(r => r.json());
      setConfig(r2.data);
    } catch { showToast('Network error', false); }
    finally { setSaving(false); }
  }

  async function generateAuthUrl() {
    setAuthUrlLoading(true);
    setAuthUrl(null);
    try {
      const res = await fetch('/api/fyers/auth-url');
      const data = await res.json() as any;
      if (!res.ok) { showToast(data.error || 'Failed to generate URL', false); return; }
      setAuthUrl(data.data.url);
    } catch { showToast('Network error', false); }
    finally { setAuthUrlLoading(false); }
  }

  async function generateToken() {
    if (!authCode.trim()) return;
    setTokenLoading(true);
    try {
      const res = await fetch('/api/fyers/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth_code: authCode.trim() }),
      });
      const data = await res.json() as any;
      if (!res.ok) { showToast(data.error || 'Token generation failed', false); return; }
      showToast('Tokens generated and saved successfully');
      setAuthCode('');
      setAuthUrl(null);
      // Refresh config
      const r2 = await fetch('/api/fyers').then(r => r.json());
      setConfig(r2.data);
    } catch { showToast('Network error', false); }
    finally { setTokenLoading(false); }
  }

  const inputCls = 'w-full bg-surface-container border border-outline-variant rounded-sm px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:border-primary transition-colors font-mono';
  const labelCls = 'text-xs font-medium text-on-surface-variant uppercase tracking-wider';
  const btnPrimary = 'flex items-center gap-1.5 px-5 py-2 text-sm font-semibold bg-primary text-on-primary rounded-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed';

  if (loading) {
    return (
      <div className="p-6 min-h-full bg-background flex items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-primary" style={{ fontSize: '32px' }}>progress_activity</span>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-full overflow-y-auto bg-background">
      <div className="max-w-[680px] mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Fyers Integration</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Configure Fyers API credentials to enable real-time stock price data.
          </p>
        </div>

        {/* Token Status */}
        {config && (
          <div className="bg-surface-container border border-outline-variant rounded-sm px-5 py-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-on-surface-variant uppercase tracking-wider font-medium">App ID</span>
              <span className="font-mono text-sm text-on-surface">{config.app_id}</span>
            </div>
            {config.fyer_id && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-on-surface-variant uppercase tracking-wider font-medium">Fyer ID</span>
                <span className="font-mono text-sm text-on-surface">{config.fyer_id}</span>
              </div>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <StatusBadge ok={config.has_access_token} label={config.has_access_token ? `Access Token: ${config.access_token_preview}` : 'No Access Token'} />
              <StatusBadge ok={config.has_refresh_token} label={config.has_refresh_token ? `Refresh Token: ${config.refresh_token_preview}` : 'No Refresh Token'} />
            </div>
          </div>
        )}

        {/* Step 1 — Configuration */}
        <SectionCard title="Step 1 — API Credentials" icon="key">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>App ID <span className="text-tertiary">*</span></label>
                <input value={appId} onChange={e => setAppId(e.target.value)}
                  placeholder="KNDJDFEVN6-100" className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Fyer ID</label>
                <input value={fyerId} onChange={e => setFyerId(e.target.value)}
                  placeholder="Your Fyers client ID" className={inputCls} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Secret Key <span className="text-tertiary">*</span></label>
              <input type="password" value={secret} onChange={e => setSecret(e.target.value)}
                placeholder={config ? 'Leave blank to keep current secret' : 'P7B8YQ60OM'} className={inputCls} />
            </div>
            <div className="flex justify-end">
              <button onClick={saveConfig} disabled={!appId.trim() || (!secret.trim() && !config) || saving}
                className={btnPrimary}>
                {saving
                  ? <><span className="material-symbols-outlined animate-spin" style={{ fontSize: '16px' }}>progress_activity</span>Saving…</>
                  : <><span className="material-symbols-outlined" style={{ fontSize: '16px' }}>save</span>Save Configuration</>}
              </button>
            </div>
          </div>
        </SectionCard>

        {/* Step 2 — Auth URL */}
        <SectionCard title="Step 2 — Generate Auth URL" icon="open_in_new">
          <div className="space-y-4">
            <p className="text-sm text-on-surface-variant">
              Click the button to generate a Fyers login URL. Open it in your browser, log in with your Fyers credentials, and you will be redirected to <code className="text-primary bg-primary/10 px-1 rounded text-xs">google.com</code>. Copy the <code className="text-primary bg-primary/10 px-1 rounded text-xs">auth_code</code> value from that redirect URL.
            </p>
            <button onClick={generateAuthUrl} disabled={!config || authUrlLoading}
              className={btnPrimary}>
              {authUrlLoading
                ? <><span className="material-symbols-outlined animate-spin" style={{ fontSize: '16px' }}>progress_activity</span>Generating…</>
                : <><span className="material-symbols-outlined" style={{ fontSize: '16px' }}>link</span>Generate Auth URL</>}
            </button>

            {authUrl && (
              <div className="space-y-2">
                <div className="bg-surface-container-high border border-outline-variant rounded-sm px-3 py-2">
                  <p className="text-xs text-on-surface-variant mb-1 uppercase tracking-wider font-medium">Auth URL</p>
                  <p className="font-mono text-xs text-on-surface break-all">{authUrl}</p>
                </div>
                <a href={authUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-primary border border-primary/40 rounded-sm hover:bg-primary/10 transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>open_in_new</span>
                  Open in Browser
                </a>
              </div>
            )}
          </div>
        </SectionCard>

        {/* Step 3 — Token Generation */}
        <SectionCard title="Step 3 — Generate Access Token" icon="token">
          <div className="space-y-4">
            <p className="text-sm text-on-surface-variant">
              From the Google redirect URL, copy the value of <code className="text-primary bg-primary/10 px-1 rounded text-xs">auth_code</code> and paste it below. Example: <code className="text-on-surface-variant/70 text-xs">https://www.google.com/?auth_code=<strong>eyJ…</strong>&amp;state=…</code>
            </p>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Auth Code <span className="text-tertiary">*</span></label>
              <input value={authCode} onChange={e => setAuthCode(e.target.value)}
                placeholder="Paste auth_code from redirect URL"
                className={inputCls} />
            </div>
            <div className="flex justify-end">
              <button onClick={generateToken} disabled={!authCode.trim() || !config || tokenLoading}
                className={btnPrimary}>
                {tokenLoading
                  ? <><span className="material-symbols-outlined animate-spin" style={{ fontSize: '16px' }}>progress_activity</span>Generating…</>
                  : <><span className="material-symbols-outlined" style={{ fontSize: '16px' }}>token</span>Generate &amp; Save Tokens</>}
              </button>
            </div>
          </div>
        </SectionCard>

        {/* Tokens */}
        {config && (config.access_token || config.refresh_token) && (
          <SectionCard title="Active Tokens" icon="token">
            <div className="space-y-3">
              {[
                { label: 'Access Token',  value: config.access_token,  which: 'access'  as const },
                { label: 'Refresh Token', value: config.refresh_token, which: 'refresh' as const },
              ].map(({ label, value, which }) => value && (
                <div key={which} className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">{label}</span>
                  <div className="flex items-center gap-2 bg-surface-container-high border border-outline-variant rounded-sm px-3 py-2">
                    <span className="font-mono text-xs text-on-surface break-all flex-1 select-all">{value}</span>
                    <button
                      onClick={() => copyToken(value, which)}
                      title={`Copy ${label}`}
                      className="flex-shrink-0 p-1 text-on-surface-variant hover:text-primary transition-colors"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                        {copied === which ? 'check' : 'content_copy'}
                      </span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-5 py-3 rounded-sm shadow-xl text-sm font-semibold z-50 whitespace-nowrap"
          style={toast.ok
            ? { background: '#166534', color: '#dcfce7', border: '1px solid #15803d' }
            : { background: '#7f1d1d', color: '#fecaca', border: '1px solid #991b1b' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
            {toast.ok ? 'check_circle' : 'error'}
          </span>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
