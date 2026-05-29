import { useState, useEffect, useMemo } from 'react';

// ── Formatters ────────────────────────────────────────────────────────────────

const inrInt = (v: number) => Math.round(v).toLocaleString('en-IN');
const inrDec = (v: number, d = 2) =>
  v.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });

// ── Constants ─────────────────────────────────────────────────────────────────

const CAGR_RATES = [2, 4, 5, 6, 8, 10, 15, 20, 25, 30, 40];
const CAGR_YEARS = [1, 2, 3, 4, 5, 7.5, 10, 15, 20, 25, 30];
const SIP_YEARS  = 30;

// ── Shared UI ─────────────────────────────────────────────────────────────────

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="px-5 py-4 border-b border-outline-variant bg-surface-container-high">
      <h2 className="text-sm font-bold text-on-surface uppercase tracking-widest">{title}</h2>
      {sub && <p className="text-[10px] text-on-surface-variant mt-0.5 font-label-caps uppercase">{sub}</p>}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-label-caps uppercase text-on-surface-variant tracking-wider">{label}</label>
      <input
        type={type}
        inputMode="decimal"
        value={value}
        onChange={e => onChange(e.target.value.replace(/[^0-9.]/g, ''))}
        placeholder={placeholder ?? '0'}
        className="bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-3 py-2 text-sm focus:outline-none focus:border-primary w-full"
      />
    </div>
  );
}

function ResultBadge({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center px-5 py-3 border ${accent ? 'border-primary/40 bg-primary/10' : 'border-outline-variant bg-surface-container-high'}`}>
      <span className="text-[10px] font-label-caps uppercase text-on-surface-variant tracking-wider mb-1">{label}</span>
      <span className={`text-lg font-bold font-data-mono ${accent ? 'text-primary' : 'text-on-surface'}`}>{value}</span>
    </div>
  );
}

// ── Trade Methods ─────────────────────────────────────────────────────────────

function TradeMethods() {
  const [methods, setMethods]   = useState<string[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName]   = useState('');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState<string | null>(null);

  useEffect(() => { fetchMethods(); }, []);

  function fetchMethods() {
    setLoading(true);
    fetch('/api/trade-journal/methods')
      .then(r => r.json())
      .then(res => setMethods(res.data ?? []))
      .catch(() => setMethods([]))
      .finally(() => setLoading(false));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true); setError(null); setSuccess(null);
    try {
      const res = await fetch('/api/trade-journal/methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? 'Failed');
      else { setSuccess(`"${data.data}" added`); setNewName(''); setShowForm(false); fetchMethods(); }
    } catch { setError('Network error'); }
    finally { setSaving(false); }
  }

  return (
    <section className="bg-surface-container border border-outline-variant rounded-sm">
      <div className="px-5 py-4 border-b border-outline-variant flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-on-surface uppercase tracking-widest">Trade Methods</h2>
          <p className="text-[10px] text-on-surface-variant mt-0.5 font-label-caps uppercase">All available trading strategy types</p>
        </div>
        <button
          onClick={() => { setShowForm(s => !s); setError(null); setSuccess(null); setNewName(''); }}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary text-xs font-bold uppercase tracking-wider hover:brightness-110 transition-all"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>add</span>
          Add Method
        </button>
      </div>

      {showForm && (
        <div className="px-5 py-4 border-b border-outline-variant bg-surface-container-high">
          <form onSubmit={handleCreate} className="flex items-start gap-3">
            <div className="flex-1 space-y-1">
              <input autoFocus type="text" value={newName}
                onChange={e => { setNewName(e.target.value); setError(null); }}
                maxLength={20} placeholder="Method name (max 20 chars)"
                className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
              {error && <p className="text-[10px] text-tertiary font-label-caps">{error}</p>}
            </div>
            <button type="submit" disabled={saving || !newName.trim()}
              className="px-4 py-2 bg-secondary text-on-secondary text-xs font-bold uppercase tracking-wider hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button"
              onClick={() => { setShowForm(false); setError(null); setNewName(''); }}
              className="px-4 py-2 bg-surface-container text-on-surface-variant border border-outline-variant text-xs font-bold uppercase tracking-wider hover:text-on-surface transition-colors">
              Cancel
            </button>
          </form>
        </div>
      )}

      {success && (
        <div className="px-5 py-3 border-b border-outline-variant bg-secondary/10 text-secondary text-xs font-data-mono flex items-center gap-2">
          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>check_circle</span>{success}
        </div>
      )}

      {loading ? (
        <div className="px-5 py-8 text-center text-on-surface-variant text-sm font-label-caps">Loading…</div>
      ) : methods.length === 0 ? (
        <div className="px-5 py-8 text-center text-on-surface-variant text-sm font-label-caps">No methods found. Add one to get started.</div>
      ) : (
        <ul className="divide-y divide-outline-variant/30">
          {methods.map((m, i) => (
            <li key={m} className="flex items-center gap-3 px-5 py-3">
              <span className="text-xs text-on-surface-variant font-data-mono w-6 text-right">{i + 1}.</span>
              <span className="text-sm font-data-mono text-on-surface">{m}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── CAGR / PV-FV Calculator ───────────────────────────────────────────────────

function CagrCalculator() {
  type SolveFor = 'fv' | 'pv' | 'rate' | 'years';
  const [pv,        setPv]        = useState('100000');
  const [fv,        setFv]        = useState('200000');
  const [rate,      setRate]      = useState('12');
  const [years,     setYears]     = useState('10');
  const [solveFor,  setSolveFor]  = useState<SolveFor>('rate');

  const result = useMemo(() => {
    const pvN = parseFloat(pv);
    const fvN = parseFloat(fv);
    const rN  = parseFloat(rate) / 100;
    const nN  = parseFloat(years);
    try {
      switch (solveFor) {
        case 'fv':
          if ([pvN, rN, nN].some(isNaN) || nN <= 0) return null;
          return { label: 'Future Value (FV)', value: inrDec(pvN * Math.pow(1 + rN, nN)), unit: '₹' };
        case 'pv':
          if ([fvN, rN, nN].some(isNaN) || nN <= 0) return null;
          return { label: 'Present Value (PV)', value: inrDec(fvN / Math.pow(1 + rN, nN)), unit: '₹' };
        case 'rate':
          if ([pvN, fvN, nN].some(isNaN) || nN <= 0 || pvN <= 0 || fvN <= 0) return null;
          return { label: 'CAGR Rate', value: ((Math.pow(fvN / pvN, 1 / nN) - 1) * 100).toFixed(4), unit: '%' };
        case 'years':
          if ([pvN, fvN, rN].some(isNaN) || rN <= 0 || pvN <= 0 || fvN <= 0) return null;
          return { label: 'Years', value: (Math.log(fvN / pvN) / Math.log(1 + rN)).toFixed(2), unit: 'yrs' };
      }
    } catch { return null; }
  }, [pv, fv, rate, years, solveFor]);

  const SOLVE_OPTIONS: { key: SolveFor; label: string }[] = [
    { key: 'rate',  label: 'Solve Rate'  },
    { key: 'years', label: 'Solve Years' },
    { key: 'fv',    label: 'Solve FV'    },
    { key: 'pv',    label: 'Solve PV'    },
  ];

  return (
    <section className="bg-surface-container border border-outline-variant rounded-sm">
      <SectionHeader title="CAGR / Present & Future Value Calculator" sub="Compound Annual Growth Rate — solve for any variable" />
      <div className="p-5 space-y-5">
        {/* Solve For toggle */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-label-caps uppercase text-on-surface-variant tracking-wider w-20 shrink-0">Solve For</span>
          <div className="flex bg-surface-container-lowest border border-outline-variant p-0.5">
            {SOLVE_OPTIONS.map(o => (
              <button key={o.key} onClick={() => setSolveFor(o.key)}
                className={`px-4 py-1.5 text-[10px] font-label-caps uppercase transition-colors ${
                  solveFor === o.key ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                }`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-4 gap-4">
          <div className={solveFor === 'pv' ? 'opacity-40 pointer-events-none' : ''}>
            <Field label="Present Value (₹)" value={pv} onChange={setPv} placeholder="e.g. 100000" />
          </div>
          <div className={solveFor === 'fv' ? 'opacity-40 pointer-events-none' : ''}>
            <Field label="Future Value (₹)" value={fv} onChange={setFv} placeholder="e.g. 200000" />
          </div>
          <div className={solveFor === 'rate' ? 'opacity-40 pointer-events-none' : ''}>
            <Field label="Annual Rate (%)" value={rate} onChange={setRate} placeholder="e.g. 12" />
          </div>
          <div className={solveFor === 'years' ? 'opacity-40 pointer-events-none' : ''}>
            <Field label="Years" value={years} onChange={setYears} placeholder="e.g. 10" />
          </div>
        </div>

        {/* Result */}
        {result ? (
          <div className="flex items-stretch gap-4">
            <ResultBadge label={result.label} value={`${result.unit === '₹' ? '₹' : ''}${result.value}${result.unit !== '₹' ? ' ' + result.unit : ''}`} accent />
            {solveFor === 'fv' && parseFloat(pv) > 0 && parseFloat(years) > 0 && (
              <ResultBadge label="Total Gain" value={`₹${inrDec(parseFloat(pv) * Math.pow(1 + parseFloat(rate) / 100, parseFloat(years)) - parseFloat(pv))}`} />
            )}
            {solveFor === 'fv' && parseFloat(pv) > 0 && (
              <ResultBadge label="Multiplier" value={`${(Math.pow(1 + parseFloat(rate) / 100, parseFloat(years))).toFixed(2)}×`} />
            )}
          </div>
        ) : (
          <div className="px-4 py-3 bg-surface-container-high border border-outline-variant/30 text-xs text-on-surface-variant font-label-caps">
            Enter valid inputs to compute result
          </div>
        )}
      </div>
    </section>
  );
}

// ── Compound Interest Reference Table ─────────────────────────────────────────

function CompoundInterestTable() {
  const [principal, setPrincipal] = useState('100000');

  const tableData = useMemo(() => {
    const p = parseFloat(principal);
    if (isNaN(p) || p <= 0) return [];
    return CAGR_YEARS.map(y => ({
      years: y,
      values: CAGR_RATES.map(r => p * Math.pow(1 + r / 100, y)),
    }));
  }, [principal]);

  const highlight = (r: number) => r >= 20;

  return (
    <section className="bg-surface-container border border-outline-variant rounded-sm">
      <SectionHeader title="Compound Interest Reference Table" sub="Growth of lump sum at various rates over years" />
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-label-caps uppercase text-on-surface-variant tracking-wider">Principal (₹)</span>
          <input
            type="text" inputMode="numeric" value={principal}
            onChange={e => setPrincipal(e.target.value.replace(/[^0-9]/g, ''))}
            className="bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-3 py-1.5 text-sm focus:outline-none focus:border-primary w-40"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="text-xs font-data-mono border-collapse w-full">
            <thead>
              <tr className="bg-surface-container-high border-b border-outline-variant">
                <th className="px-4 py-2.5 text-left text-on-surface-variant font-label-caps uppercase tracking-wider whitespace-nowrap">
                  ₹{inrInt(parseFloat(principal) || 0)}
                </th>
                {CAGR_RATES.map(r => (
                  <th key={r} className={`px-3 py-2.5 text-right font-bold whitespace-nowrap ${highlight(r) ? 'text-secondary' : 'text-primary'}`}>
                    {r}%
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {tableData.map(row => (
                <tr key={row.years} className="hover:bg-surface-container-high transition-colors">
                  <td className="px-4 py-2 text-primary font-bold">{row.years}</td>
                  {row.values.map((v, i) => (
                    <td key={i} className={`px-3 py-2 text-right ${highlight(CAGR_RATES[i]) ? 'text-secondary' : 'text-on-surface'}`}>
                      {inrInt(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// ── Percentage Calculator ─────────────────────────────────────────────────────

function PercentageCalculator() {
  const [startVal, setStartVal] = useState('800');
  const [endVal,   setEndVal]   = useState('1160');
  const [xVal,     setXVal]     = useState('90');
  const [xPct,     setXPct]     = useState('15');

  const changeCalc = useMemo(() => {
    const s = parseFloat(startVal);
    const e = parseFloat(endVal);
    if (isNaN(s) || isNaN(e) || s === 0) return null;
    const gain      = e - s;
    const startToEnd = (gain / s) * 100;
    const endToStart = e !== 0 ? ((s - e) / e) * 100 : 0;
    return { gain, startToEnd, endToStart };
  }, [startVal, endVal]);

  const xPctCalc = useMemo(() => {
    const v = parseFloat(xVal);
    const p = parseFloat(xPct);
    if (isNaN(v) || isNaN(p)) return null;
    const gain  = v * p / 100;
    return { gain, final: v + gain };
  }, [xVal, xPct]);

  const cellCls = 'px-4 py-2 font-data-mono text-sm border-b border-outline-variant/20';
  const labelCls = 'px-4 py-2 text-[10px] font-label-caps uppercase text-on-surface-variant tracking-wider border-b border-outline-variant/20';

  return (
    <section className="bg-surface-container border border-outline-variant rounded-sm">
      <SectionHeader title="Percentage Calculator" sub="Value change and x-percent of value" />
      <div className="p-5">
        <div className="grid grid-cols-2 gap-6">

          {/* Left: Start → End change */}
          <div className="space-y-0 border border-outline-variant">
            <div className="bg-surface-container-high px-4 py-2.5 border-b border-outline-variant">
              <span className="text-[10px] font-label-caps uppercase text-on-surface font-bold tracking-wider">Value Change</span>
            </div>
            <table className="w-full">
              <tbody>
                <tr>
                  <td className={labelCls}>Start Value</td>
                  <td className={`${cellCls} text-right`}>
                    <input type="text" inputMode="decimal" value={startVal}
                      onChange={e => setStartVal(e.target.value.replace(/[^0-9.]/g, ''))}
                      className="bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-2 py-1 text-sm focus:outline-none focus:border-primary w-32 text-right" />
                  </td>
                </tr>
                <tr>
                  <td className={labelCls}>End Value</td>
                  <td className={`${cellCls} text-right`}>
                    <input type="text" inputMode="decimal" value={endVal}
                      onChange={e => setEndVal(e.target.value.replace(/[^0-9.]/g, ''))}
                      className="bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-2 py-1 text-sm focus:outline-none focus:border-primary w-32 text-right" />
                  </td>
                </tr>
                <tr>
                  <td className={labelCls}>Gain / Loss</td>
                  <td className={`${cellCls} text-right font-bold ${changeCalc ? (changeCalc.gain >= 0 ? 'text-secondary' : 'text-tertiary') : 'text-on-surface-variant'}`}>
                    {changeCalc ? inrDec(changeCalc.gain) : '—'}
                  </td>
                </tr>
                <tr>
                  <td className={labelCls}>Start → End %</td>
                  <td className={`${cellCls} text-right font-bold ${changeCalc ? (changeCalc.startToEnd >= 0 ? 'text-secondary' : 'text-tertiary') : 'text-on-surface-variant'}`}>
                    {changeCalc ? `${changeCalc.startToEnd >= 0 ? '+' : ''}${changeCalc.startToEnd.toFixed(2)}%` : '—'}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-[10px] font-label-caps uppercase text-on-surface-variant tracking-wider">End → Start %</td>
                  <td className={`px-4 py-2 font-data-mono text-sm text-right font-bold ${changeCalc ? (changeCalc.endToStart >= 0 ? 'text-secondary' : 'text-tertiary') : 'text-on-surface-variant'}`}>
                    {changeCalc ? `${changeCalc.endToStart >= 0 ? '+' : ''}${changeCalc.endToStart.toFixed(2)}%` : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Right: x% of value */}
          <div className="space-y-0 border border-outline-variant">
            <div className="bg-surface-container-high px-4 py-2.5 border-b border-outline-variant">
              <span className="text-[10px] font-label-caps uppercase text-on-surface font-bold tracking-wider">X Percent of Value</span>
            </div>
            <table className="w-full">
              <tbody>
                <tr>
                  <td className={labelCls}>Value</td>
                  <td className={`${cellCls} text-right`}>
                    <input type="text" inputMode="decimal" value={xVal}
                      onChange={e => setXVal(e.target.value.replace(/[^0-9.]/g, ''))}
                      className="bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-2 py-1 text-sm focus:outline-none focus:border-primary w-32 text-right" />
                  </td>
                </tr>
                <tr>
                  <td className={labelCls}>Percent (%)</td>
                  <td className={`${cellCls} text-right`}>
                    <input type="text" inputMode="decimal" value={xPct}
                      onChange={e => setXPct(e.target.value.replace(/[^0-9.\-]/g, '').replace(/(?!^)-/g, ''))}
                      className="bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-2 py-1 text-sm focus:outline-none focus:border-primary w-32 text-right" />
                  </td>
                </tr>
                <tr>
                  <td className={labelCls}>Gain Amount</td>
                  <td className={`${cellCls} text-right font-bold ${xPctCalc ? (xPctCalc.gain >= 0 ? 'text-secondary' : 'text-tertiary') : 'text-on-surface-variant'}`}>
                    {xPctCalc ? inrDec(xPctCalc.gain) : '—'}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-[10px] font-label-caps uppercase text-on-surface-variant tracking-wider">Final Value</td>
                  <td className="px-4 py-2 font-data-mono text-sm text-right font-bold text-primary">
                    {xPctCalc ? inrDec(xPctCalc.final) : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </section>
  );
}

// ── SIP Calculator ────────────────────────────────────────────────────────────

function SipCalculator() {
  const [sipAmt,    setSipAmt]    = useState('2500');
  const [annualPct, setAnnualPct] = useState('15');

  const data = useMemo(() => {
    const pmt = parseFloat(sipAmt);
    const ann = parseFloat(annualPct);
    if (isNaN(pmt) || isNaN(ann) || pmt <= 0 || ann <= 0) return null;
    const r = ann / 12 / 100;

    const summary = Array.from({ length: SIP_YEARS }, (_, i) => {
      const y = i + 1;
      const n = 12 * y;
      const invested = pmt * n;
      const fv = pmt * (Math.pow(1 + r, n) - 1) / r * (1 + r);
      return { year: y, invested, fv, gain: fv - invested, returnPct: ((fv - invested) / invested) * 100 };
    });

    const detailed = Array.from({ length: SIP_YEARS }, (_, i) => {
      const y = i + 1;
      const months = Array.from({ length: 12 }, (_, m) => pmt * Math.pow(1 + r, 12 * (y - 1) + (m + 1)));
      return { year: y, months, total: summary[i].fv };
    });

    return { r, summary, detailed };
  }, [sipAmt, annualPct]);

  const milestones = new Set([5, 10, 15, 20, 25, 30]);

  return (
    <section className="bg-surface-container border border-outline-variant rounded-sm">
      <SectionHeader title="SIP Calculator" sub="Systematic Investment Plan — annuity due (beginning of month)" />
      <div className="p-5 space-y-6">

        {/* Inputs */}
        <div className="flex items-end gap-6">
          <div className="w-48">
            <Field label="Monthly SIP (₹)" value={sipAmt} onChange={setSipAmt} placeholder="e.g. 2500" />
          </div>
          <div className="w-40">
            <Field label="Annual Return (%)" value={annualPct} onChange={setAnnualPct} placeholder="e.g. 15" />
          </div>
          {data && (
            <div className="flex gap-4">
              <div className="flex flex-col">
                <span className="text-[10px] font-label-caps uppercase text-on-surface-variant tracking-wider mb-1">Monthly Rate</span>
                <span className="font-data-mono text-sm text-on-surface font-bold">{(data.r * 100).toFixed(4)}%</span>
              </div>
            </div>
          )}
        </div>

        {!data ? (
          <div className="px-4 py-3 bg-surface-container-high border border-outline-variant/30 text-xs text-on-surface-variant font-label-caps">
            Enter valid SIP amount and return rate to compute
          </div>
        ) : (
          <>
            {/* Summary Table */}
            <div>
              <p className="text-[10px] font-label-caps uppercase text-on-surface-variant tracking-wider mb-2">Summary — Yearly Snapshot</p>
              <div className="overflow-x-auto">
                <table className="text-xs font-data-mono border-collapse">
                  <thead>
                    <tr className="bg-surface-container-high border-b border-outline-variant">
                      <th className="px-4 py-2 text-left text-on-surface-variant font-label-caps uppercase tracking-wider whitespace-nowrap">Years</th>
                      <th className="px-4 py-2 text-right text-on-surface-variant font-label-caps uppercase tracking-wider">Invested</th>
                      <th className="px-4 py-2 text-right text-on-surface-variant font-label-caps uppercase tracking-wider">Final Value</th>
                      <th className="px-4 py-2 text-right text-on-surface-variant font-label-caps uppercase tracking-wider">Gain</th>
                      <th className="px-4 py-2 text-right text-on-surface-variant font-label-caps uppercase tracking-wider">Return %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {data.summary.map(row => (
                      <tr key={row.year}
                        className={`transition-colors ${milestones.has(row.year) ? 'bg-primary/10 font-bold' : 'hover:bg-surface-container-high'}`}>
                        <td className={`px-4 py-2 ${milestones.has(row.year) ? 'text-primary font-bold' : 'text-on-surface-variant'}`}>{row.year}</td>
                        <td className="px-4 py-2 text-right text-on-surface">{inrInt(row.invested)}</td>
                        <td className={`px-4 py-2 text-right font-bold ${milestones.has(row.year) ? 'text-primary' : 'text-on-surface'}`}>{inrInt(row.fv)}</td>
                        <td className="px-4 py-2 text-right text-secondary">{inrInt(row.gain)}</td>
                        <td className={`px-4 py-2 text-right ${milestones.has(row.year) ? 'text-secondary font-bold' : 'text-secondary'}`}>{row.returnPct.toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Detailed Monthly Table */}
            <div>
              <p className="text-[10px] font-label-caps uppercase text-on-surface-variant tracking-wider mb-2">
                Detailed Calculation — Monthly SIP Value at End of Each Year
              </p>
              <div className="overflow-x-auto max-h-[520px] overflow-y-auto border border-outline-variant">
                <table className="text-xs font-data-mono border-collapse min-w-full">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-surface-container-high border-b border-outline-variant">
                      <th className="px-3 py-2 text-left text-on-surface-variant font-label-caps uppercase tracking-wider whitespace-nowrap sticky left-0 bg-surface-container-high">Yr / Mo</th>
                      {Array.from({ length: 12 }, (_, m) => (
                        <th key={m} className="px-2 py-2 text-right text-on-surface-variant font-label-caps uppercase tracking-wider">{m + 1}</th>
                      ))}
                      <th className="px-3 py-2 text-right text-primary font-label-caps uppercase tracking-wider">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {data.detailed.map(row => (
                      <tr key={row.year}
                        className={`transition-colors ${milestones.has(row.year) ? 'bg-primary/10' : 'hover:bg-surface-container-high'}`}>
                        <td className={`px-3 py-2 sticky left-0 font-bold ${milestones.has(row.year) ? 'text-primary bg-primary/10' : 'text-on-surface-variant bg-surface-container'}`}>
                          {row.year}
                        </td>
                        {row.months.map((v, m) => (
                          <td key={m} className={`px-2 py-2 text-right ${milestones.has(row.year) ? 'text-on-surface font-bold' : 'text-on-surface'}`}>
                            {inrInt(v)}
                          </td>
                        ))}
                        <td className={`px-3 py-2 text-right font-bold ${milestones.has(row.year) ? 'text-primary' : 'text-on-surface'}`}>
                          {inrInt(row.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseSectors(raw: string): { name: string; stocks: string[] }[] {
  return raw.split(/###/).map(s => s.trim()).filter(Boolean).map(chunk => {
    const tokens = chunk.split(',').map(t => t.trim()).filter(Boolean);
    const name   = tokens[0] ?? '';
    const stocks = tokens.slice(1).map(t => t.startsWith('NSE:') ? t.slice(4) : t).filter(Boolean);
    return { name, stocks };
  });
}

function extractStocks(raw: string): string[] {
  const hasSectors = raw.includes('###');
  if (hasSectors) {
    return parseSectors(raw).flatMap(s => s.stocks);
  }
  return raw.split(/[\n,]/).map(t => t.trim()).filter(Boolean)
    .map(t => t.startsWith('NSE:') ? t.slice(4) : t).filter(Boolean);
}

// ── Trending Sectors ──────────────────────────────────────────────────────────

// ── Fyers Watchlist ───────────────────────────────────────────────────────────

function FyersWatchlist() {
  const [input,    setInput]    = useState('');
  const [output,   setOutput]   = useState('');
  const [sectors,  setSectors]  = useState<{ name: string; display: string[]; stocks: string[] }[] | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [errors,   setErrors]   = useState<string[]>([]);
  const [copied,        setCopied]        = useState(false);
  const [copiedTop7,    setCopiedTop7]    = useState(false);
  const [copiedSector,  setCopiedSector]  = useState<string | null>(null);

  async function process() {
    setLoading(true); setOutput(''); setSectors(null); setErrors([]); setCopied(false);
    const hasSectors = input.includes('###');
    const parsed     = hasSectors ? parseSectors(input) : null;
    const allSymbols = [...new Set(extractStocks(input))];

    try {
      const res  = await fetch('/api/securities/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: allSymbols }),
      });
      const data = await res.json() as { data: Record<string, { exchange: string; series: string }> };
      const map  = data.data ?? {};

      const errs: string[] = [];
      function format(sym: string): string {
        const info = map[sym.toUpperCase()];
        if (!info) { errs.push(sym); return `NSE:${sym}-EQ`; }
        return `${info.exchange}:${sym}-${info.series}`;
      }

      if (hasSectors && parsed) {
        setSectors(parsed.map(s => ({ name: s.name, display: s.stocks, stocks: s.stocks.map(format) })));
        setOutput(parsed.map(s => s.stocks.map(format).join(',')).join(','));
      } else {
        const formatted = allSymbols.map(format);
        setOutput(formatted.join(','));
      }
      setErrors(errs);
    } catch {
      setErrors(['Network error — could not reach securities API']);
    } finally {
      setLoading(false);
    }
  }

  function copy() {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function copyTop7() {
    if (!sectors) return;
    const top7 = sectors.slice(0, 7).flatMap(s => s.stocks).join(',');
    navigator.clipboard.writeText(top7);
    setCopiedTop7(true);
    setTimeout(() => setCopiedTop7(false), 2000);
  }

  function copySector(name: string, stocks: string[]) {
    navigator.clipboard.writeText(stocks.join(','));
    setCopiedSector(name);
    setTimeout(() => setCopiedSector(null), 2000);
  }

  return (
    <section className="bg-surface-container border border-outline-variant rounded-sm">
      <SectionHeader title="Fyers Watchlist" sub="Format stock symbols with exchange and series from securities table" />
      <div className="p-5 space-y-4">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          rows={5}
          placeholder="Paste sectors-trending text or plain stock list (one per line or comma-separated)…"
          className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono px-3 py-2 text-xs focus:outline-none focus:border-primary resize-y"
        />
        <div className="flex items-center gap-2">
          <button onClick={process} disabled={loading || !input.trim()}
            className="px-5 py-2 bg-primary text-on-primary text-xs font-bold uppercase tracking-wider hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? 'Parsing…' : 'Parse'}
          </button>
          {output && (
            <>
              {sectors && sectors.length > 0 && (
                <button onClick={copyTop7}
                  className="flex items-center gap-1.5 px-3 py-2 border border-primary/40 text-xs font-label-caps uppercase text-primary hover:bg-primary/10 transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                    {copiedTop7 ? 'check' : 'content_copy'}
                  </span>
                  {copiedTop7 ? 'Copied' : 'Copy Top 7 Sectors'}
                </button>
              )}
              <button onClick={copy}
                className="flex items-center gap-1.5 px-3 py-2 border border-outline-variant text-xs font-label-caps uppercase text-on-surface-variant hover:text-on-surface transition-colors">
                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                  {copied ? 'check' : 'content_copy'}
                </span>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </>
          )}
        </div>

        {errors.length > 0 && (
          <div className="px-3 py-2 bg-tertiary/10 border border-tertiary/30 text-tertiary text-xs font-data-mono space-y-0.5">
            <p className="font-label-caps uppercase font-bold mb-1">Not found in securities table (defaulted to -EQ):</p>
            {errors.map(e => <p key={e}>{e}</p>)}
          </div>
        )}

        {output && (
          <div className="space-y-4">
            {sectors && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-on-surface-variant font-label-caps uppercase">
                    {sectors.length} sectors · {sectors.reduce((n, s) => n + s.display.length, 0)} stocks
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-3">
                {sectors.map(sec => (
                  <div key={sec.name} className="border border-outline-variant bg-surface-container-high">
                    <div className="px-3 py-2 border-b border-outline-variant bg-surface-container flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-on-surface truncate">{sec.name}</span>
                      <button onClick={() => copySector(sec.name, sec.stocks)}
                        title="Copy stocks"
                        className="shrink-0 text-on-surface-variant hover:text-primary transition-colors">
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                          {copiedSector === sec.name ? 'check' : 'content_copy'}
                        </span>
                      </button>
                    </div>
                    <ul className="px-3 py-2 space-y-0.5">
                      {sec.display.map(s => (
                        <li key={s} className="text-xs font-data-mono text-on-surface-variant">{s}</li>
                      ))}
                    </ul>
                  </div>
                ))}
                </div>
              </>
            )}

            <div className="space-y-2">
              <span className="text-[10px] font-label-caps uppercase text-on-surface-variant">Combined Output</span>
              <div className="bg-surface-container-lowest border border-outline-variant px-3 py-3 font-data-mono text-xs text-on-surface break-all">
                {output}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = 'calculators' | 'scanner';

export default function MiscellaneousPage() {
  const [tab, setTab] = useState<Tab>('calculators');

  return (
    <div className="p-6 min-h-full overflow-y-auto bg-background">
      <div className="max-w-[1400px] mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-on-surface">Miscellaneous</h1>

        {/* Tab bar */}
        <div className="flex border-b border-outline-variant">
          {([
            { id: 'calculators', label: 'Calculators', icon: 'calculate'  },
            { id: 'scanner',     label: 'Scanner',     icon: 'radar'      },
          ] as { id: Tab; label: string; icon: string }[]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-6 py-3 text-xs font-label-caps uppercase tracking-wider transition-colors border-b-2 ${
                tab === t.id
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/50'
              }`}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'calculators' && (
          <div className="space-y-8">
            <CagrCalculator />
            <CompoundInterestTable />
            <PercentageCalculator />
            <SipCalculator />
            <TradeMethods />
          </div>
        )}

        {tab === 'scanner' && (
          <div className="space-y-8">
            <FyersWatchlist />
          </div>
        )}

      </div>
    </div>
  );
}
