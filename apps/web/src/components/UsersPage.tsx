import { useState, useEffect, useMemo, useRef, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface User {
  id:                   number;
  name:                 string | null;
  email:                string;
  role:                 string;
  is_active:            boolean;
  zerodha_user_id:      string | null;
  capital:              number | null;
  zerodha_access_token: string | null;
  zerodha_password:     string | null;
}

interface ApiResponse {
  data:       User[];
  total:      number;
  page:       number;
  totalPages: number;
}

type SortKey = keyof Omit<User, 'id' | 'zerodha_password'>;
type SortDir = 'asc' | 'desc';

const SORT_COLS: { key: SortKey; label: string; right?: boolean; width?: number }[] = [
  { key: 'name',                 label: 'Name'            },
  { key: 'email',                label: 'Email'           },
  { key: 'role',                 label: 'Role'            },
  { key: 'is_active',            label: 'Status'          },
  { key: 'zerodha_user_id',      label: 'Zerodha User ID', width: 100 },
  { key: 'capital',              label: 'Capital',  right: true },
  { key: 'zerodha_access_token', label: 'Access Token'    },
];

const EMPTY_ADD = {
  name: '', email: '', password: '', role: 'user',
  zerodha_user_id: '', capital: '', zerodha_access_token: '',
  zerodha_password: '', is_active: false,
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtCapital(v: number | null) {
  if (v == null) return '—';
  return Math.floor(Number(v)).toLocaleString('en-IN');
}

function truncateToken(t: string | null) {
  if (!t) return null;
  if (t.length <= 16) return t;
  return `${t.slice(0, 8)}…${t.slice(-6)}`;
}

// ── Custom dropdown — matches Dashboard "Kite User" dropdown style ─────────────

interface DropdownOption { value: string; label: string; icon: string }

function DropdownSelect({
  value,
  onChange,
  options,
  triggerIcon,
}: {
  value: string;
  onChange: (v: string) => void;
  options: DropdownOption[];
  triggerIcon: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const selected = options.find(o => o.value === value) ?? options[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between gap-3 px-3 py-2 text-sm text-on-surface bg-surface-container-high border border-outline-variant rounded-sm hover:border-primary transition-colors focus:outline-none focus:border-primary whitespace-nowrap"
      >
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: '16px' }}>{triggerIcon}</span>
          <span>{selected.label}</span>
        </div>
        <span
          className="material-symbols-outlined text-on-surface-variant flex-shrink-0 transition-transform duration-200"
          style={{ fontSize: '18px', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >expand_more</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 min-w-full w-max z-50 bg-surface-container-high border border-outline-variant rounded-sm shadow-xl overflow-hidden">
          {options.map(opt => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left transition-colors
                  ${isSelected
                    ? 'bg-primary/20 text-primary border-l-2 border-primary'
                    : 'text-on-surface hover:bg-surface-variant border-l-2 border-transparent'
                  }`}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: '15px', opacity: isSelected ? 1 : 0.4 }}
                >{opt.icon}</span>
                <span className="flex-1">{opt.label}</span>
                {isSelected && (
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: '15px' }}>check</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const ROLE_OPTIONS: DropdownOption[] = [
  { value: '',      label: 'All Roles', icon: 'group'                },
  { value: 'admin', label: 'Admin',     icon: 'admin_panel_settings' },
  { value: 'user',  label: 'User',      icon: 'person'               },
];

const STATUS_OPTIONS: DropdownOption[] = [
  { value: '',      label: 'All Status', icon: 'radio_button_unchecked' },
  { value: 'true',  label: 'Active',     icon: 'check_circle'           },
  { value: 'false', label: 'Inactive',   icon: 'cancel'                 },
];

// ── Shared field renderer ──────────────────────────────────────────────────────

type FieldOpts = { type?: string; placeholder?: string; mandatory?: boolean; wide?: boolean; as?: 'select'; options?: { value: string; label: string }[] };

function formField(
  label: string,
  value: string | boolean,
  onChange: (v: string | boolean) => void,
  opts: FieldOpts = {}
) {
  const base = 'bg-surface-container border border-outline-variant rounded-sm px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:border-primary transition-colors';
  return (
    <div className={`flex flex-col gap-1.5 ${opts.wide ? 'col-span-2' : ''}`}>
      <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">
        {label}{opts.mandatory && <span className="text-tertiary ml-0.5">*</span>}
      </label>
      {opts.as === 'select' ? (
        <select
          value={String(value)}
          onChange={e => onChange(e.target.value)}
          style={{ colorScheme: 'dark' }}
          className={base}
        >
          {opts.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : opts.type === 'checkbox' ? (
        <label className="flex items-center gap-2 cursor-pointer mt-1">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={e => onChange(e.target.checked)}
            className="w-4 h-4 accent-primary"
          />
          <span className="text-sm text-on-surface-variant">Active</span>
        </label>
      ) : (
        <input
          type={opts.type ?? 'text'}
          placeholder={opts.placeholder}
          value={String(value)}
          onChange={e => onChange(e.target.value)}
          className={base}
        />
      )}
    </div>
  );
}

// ── Add User Modal ─────────────────────────────────────────────────────────────

function AddUserModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (msg: string) => void }) {
  const [form, setForm]     = useState({ ...EMPTY_ADD });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const set = (k: keyof typeof EMPTY_ADD) => (v: string | boolean) =>
    setForm(f => ({ ...f, [k]: v }));

  const canSave = form.email.trim() && form.password.trim();

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:                form.email.trim().toLowerCase(),
          password:             form.password,
          name:                 form.name.trim() || null,
          role:                 form.role,
          is_active:            form.is_active,
          zerodha_user_id:      form.zerodha_user_id.trim() || null,
          capital:              form.capital ? parseFloat(form.capital) : null,
          zerodha_access_token: form.zerodha_access_token.trim() || null,
          zerodha_password:     form.zerodha_password.trim() || null,
        }),
      });
      if (!res.ok) { setError((await res.json()).error ?? 'Failed to create user'); return; }
      onSuccess('User created successfully');
      onClose();
    } catch { setError('Network error — please try again'); }
    finally   { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(2px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-xl mx-4 bg-surface-container-high border border-outline-variant rounded-sm shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: '20px' }}>person_add</span>
            <h2 className="text-base font-bold text-on-surface">Add User</h2>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors p-0.5">
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 grid grid-cols-2 gap-4 overflow-y-auto">
          {formField('Email', form.email, set('email'), { mandatory: true, placeholder: 'user@example.com', wide: true })}
          {formField('Password', form.password, set('password'), { type: 'password', mandatory: true, placeholder: '••••••••' })}
          {formField('Role', form.role, set('role'), { as: 'select', options: [{ value: 'user', label: 'User' }, { value: 'admin', label: 'Admin' }] })}
          {formField('Name', form.name, set('name'), { placeholder: 'Full Name' })}
          {formField('Capital', form.capital, set('capital'), { type: 'number', placeholder: '100000' })}
          {formField('Zerodha User ID', form.zerodha_user_id, set('zerodha_user_id'), { placeholder: 'ZR1234' })}
          {formField('Zerodha Password', form.zerodha_password, set('zerodha_password'), { type: 'password', placeholder: '••••••••' })}
          {formField('Access Token', form.zerodha_access_token, set('zerodha_access_token'), { placeholder: 'Paste token here', wide: true })}
          <div className="col-span-2">
            {formField('', form.is_active, set('is_active'), { type: 'checkbox' })}
          </div>
        </div>

        {error && (
          <div className="mx-5 mb-3 flex items-center gap-2 px-3 py-2.5 rounded-sm text-sm flex-shrink-0"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
            <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '16px' }}>error</span>
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-outline-variant flex-shrink-0">
          <p className="text-xs text-on-surface-variant"><span className="text-tertiary">*</span> Required fields</p>
          <div className="flex gap-3">
            <button onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-on-surface-variant bg-surface-container border border-outline-variant rounded-sm hover:border-outline hover:text-on-surface transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={!canSave || saving}
              className={`flex items-center gap-1.5 px-5 py-2 text-sm font-semibold rounded-sm transition-all
                ${canSave && !saving ? 'bg-primary text-on-primary hover:opacity-90' : 'bg-surface-container text-on-surface-variant/40 border border-outline-variant cursor-not-allowed'}`}>
              {saving
                ? <><span className="material-symbols-outlined animate-spin" style={{ fontSize: '16px' }}>progress_activity</span>Saving…</>
                : <><span className="material-symbols-outlined" style={{ fontSize: '16px' }}>person_add</span>Add User</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Edit User Modal ────────────────────────────────────────────────────────────

function EditUserModal({ user, onClose, onSuccess }: { user: User; onClose: () => void; onSuccess: (u: User) => void }) {
  const [form, setForm] = useState({
    name:                 user.name ?? '',
    email:                user.email,
    password:             '',
    role:                 user.role,
    is_active:            user.is_active,
    zerodha_user_id:      user.zerodha_user_id ?? '',
    capital:              user.capital != null ? String(user.capital) : '',
    zerodha_access_token: user.zerodha_access_token ?? '',
    zerodha_password:     user.zerodha_password ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const set = (k: keyof typeof form) => (v: string | boolean) =>
    setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true); setError(null);
    try {
      const body: Record<string, any> = {
        name:                 form.name.trim() || null,
        email:                form.email.trim().toLowerCase(),
        role:                 form.role,
        is_active:            form.is_active,
        zerodha_user_id:      form.zerodha_user_id.trim() || null,
        capital:              form.capital ? parseFloat(form.capital) : null,
        zerodha_access_token: form.zerodha_access_token.trim() || null,
        zerodha_password:     form.zerodha_password.trim() || null,
      };
      if (form.password.trim()) body.password = form.password;

      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { setError((await res.json()).error ?? 'Failed to update user'); return; }
      const { data } = await res.json();
      onSuccess(data);
      onClose();
    } catch { setError('Network error — please try again'); }
    finally   { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(2px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-xl mx-4 bg-surface-container-high border border-outline-variant rounded-sm shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: '20px' }}>manage_accounts</span>
            <div>
              <h2 className="text-base font-bold text-on-surface">Edit User</h2>
              <p className="text-xs text-on-surface-variant">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors p-0.5">
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 grid grid-cols-2 gap-4 overflow-y-auto">
          {formField('Email', form.email, set('email'), { mandatory: true, placeholder: 'user@example.com', wide: true })}
          {formField('New Password', form.password, set('password'), { type: 'password', placeholder: 'Leave blank to keep current' })}
          {formField('Role', form.role, set('role'), { as: 'select', options: [{ value: 'user', label: 'User' }, { value: 'admin', label: 'Admin' }] })}
          {formField('Name', form.name, set('name'), { placeholder: 'Full Name' })}
          {formField('Capital', form.capital, set('capital'), { type: 'number', placeholder: '100000' })}
          {formField('Zerodha User ID', form.zerodha_user_id, set('zerodha_user_id'), { placeholder: 'ZR1234' })}
          {formField('Zerodha Password', form.zerodha_password, set('zerodha_password'), { type: 'password', placeholder: '••••••••' })}
          {formField('Access Token', form.zerodha_access_token, set('zerodha_access_token'), { placeholder: 'Paste token here', wide: true })}
          <div className="col-span-2">
            {formField('', form.is_active, set('is_active'), { type: 'checkbox' })}
          </div>
        </div>

        {error && (
          <div className="mx-5 mb-3 flex items-center gap-2 px-3 py-2.5 rounded-sm text-sm flex-shrink-0"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
            <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '16px' }}>error</span>
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-outline-variant flex-shrink-0">
          <button onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-on-surface-variant bg-surface-container border border-outline-variant rounded-sm hover:border-outline hover:text-on-surface transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className={`flex items-center gap-1.5 px-5 py-2 text-sm font-semibold rounded-sm transition-all
              ${!saving ? 'bg-primary text-on-primary hover:opacity-90' : 'opacity-60 cursor-not-allowed bg-primary text-on-primary'}`}>
            {saving
              ? <><span className="material-symbols-outlined animate-spin" style={{ fontSize: '16px' }}>progress_activity</span>Saving…</>
              : <><span className="material-symbols-outlined" style={{ fontSize: '16px' }}>save</span>Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirm Modal ───────────────────────────────────────────────────────

function DeleteUserModal({ user, onCancel, onDeleted }: { user: User; onCancel: () => void; onDeleted: (id: number) => void }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onCancel]);

  const handleDelete = async () => {
    setDeleting(true); setError(null);
    try {
      const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' });
      if (!res.ok) { setError((await res.json()).error ?? 'Failed to delete user'); return; }
      onDeleted(user.id);
    } catch { setError('Network error — please try again'); }
    finally   { setDeleting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(2px)' }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="w-full max-w-sm mx-4 bg-surface-container-high border border-outline-variant rounded-sm shadow-2xl">

        <div className="flex items-center gap-3 px-5 py-4 border-b border-outline-variant">
          <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '22px', color: '#f87171' }}>warning</span>
          <h2 className="text-base font-bold text-on-surface">Delete User</h2>
        </div>

        <div className="px-5 py-5 space-y-3">
          <p className="text-sm text-on-surface-variant">
            Are you sure you want to delete this user? This action cannot be undone.
          </p>
          <div className="px-3 py-2.5 rounded-sm border border-outline-variant bg-surface-container">
            <div className="text-sm font-semibold text-on-surface">{user.name ?? '(no name)'}</div>
            <div className="text-xs text-on-surface-variant mt-0.5">{user.email}</div>
          </div>
          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-sm text-sm"
              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
              <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '16px' }}>error</span>
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-outline-variant">
          <button onClick={onCancel} disabled={deleting}
            className="px-4 py-2 text-sm font-semibold text-on-surface-variant bg-surface-container border border-outline-variant rounded-sm hover:border-outline hover:text-on-surface transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold rounded-sm disabled:opacity-60"
            style={{ background: '#dc2626', color: '#fff' }}>
            {deleting
              ? <><span className="material-symbols-outlined animate-spin" style={{ fontSize: '16px' }}>progress_activity</span>Deleting…</>
              : <><span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>Delete</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function UsersPage() {
  const [users, setUsers]           = useState<User[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading]       = useState(false);

  // Filters
  const [search, setSearch]               = useState('');
  const [searchInput, setSearchInput]     = useState('');
  const [roleFilter, setRoleFilter]       = useState('');
  const [statusFilter, setStatusFilter]   = useState('');

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Modals
  const [showAdd, setShowAdd]         = useState(false);
  const [editTarget, setEditTarget]   = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  // Inline access-token editing: maps user id → draft value
  const [inlineEdit, setInlineEdit] = useState<{ id: number; value: string } | null>(null);
  const [inlineSaving, setInlineSaving] = useState(false);
  const inlineRef = useRef<HTMLInputElement>(null);

  // Toast
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null);
  const toastTimer               = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceRef              = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string, ok = true) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, ok });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchPage = useCallback((p: number, q: string, role: string, status: string) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p) });
    if (q)      params.set('search',    q);
    if (role)   params.set('role',      role);
    if (status) params.set('is_active', status);
    fetch(`/api/users?${params}`)
      .then(r => r.json())
      .then((res: ApiResponse) => {
        setUsers(res.data ?? []);
        setTotal(res.total ?? 0);
        setTotalPages(res.totalPages ?? 1);
      })
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchPage(page, search, roleFilter, statusFilter); }, [page, search, roleFilter, statusFilter, fetchPage]);

  // ── Debounced search ───────────────────────────────────────────────────────

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      setSearch(value.trim());
    }, 350);
  };

  const handleFilterChange = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  // ── Client-side sort ───────────────────────────────────────────────────────

  const sorted = useMemo(() => {
    return [...users].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp = typeof av === 'boolean' && typeof bv === 'boolean'
        ? (av === bv ? 0 : av ? -1 : 1)
        : typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [users, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  // ── Inline token save ──────────────────────────────────────────────────────

  const startInlineEdit = (user: User) => {
    setInlineEdit({ id: user.id, value: user.zerodha_access_token ?? '' });
    setTimeout(() => inlineRef.current?.focus(), 0);
  };

  const saveInlineToken = async () => {
    if (!inlineEdit || inlineSaving) return;
    setInlineSaving(true);
    try {
      const res = await fetch(`/api/users/${inlineEdit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zerodha_access_token: inlineEdit.value.trim() || null }),
      });
      if (!res.ok) { showToast('Failed to update token', false); return; }
      const { data } = await res.json();
      setUsers(prev => prev.map(u => u.id === data.id ? data : u));
      showToast('Access token updated');
      setInlineEdit(null);
    } catch { showToast('Network error', false); }
    finally   { setInlineSaving(false); }
  };

  // ── CRUD callbacks ─────────────────────────────────────────────────────────

  const handleAdded = (msg: string) => {
    showToast(msg);
    setPage(1);
    setSearch(''); setSearchInput(''); setRoleFilter(''); setStatusFilter('');
    fetchPage(1, '', '', '');
  };

  const handleEdited = (updated: User) => {
    setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
    showToast('User updated successfully');
  };

  const handleDeleted = (id: number) => {
    setDeleteTarget(null);
    setUsers(prev => prev.filter(u => u.id !== id));
    setTotal(t => t - 1);
    showToast('User deleted successfully');
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 min-h-full overflow-y-auto bg-background">
      <div className="max-w-[1400px] mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-on-surface">Users</h1>
            <p className="text-sm text-on-surface-variant mt-0.5">
              {total > 0 ? `${total} user${total !== 1 ? 's' : ''}` : loading ? 'Loading…' : 'No users'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="flex items-center gap-2 w-64 bg-surface-container-high border border-outline-variant rounded-sm px-3 py-2 focus-within:border-primary transition-colors">
              <span className="material-symbols-outlined text-on-surface-variant flex-shrink-0" style={{ fontSize: '16px' }}>search</span>
              <input
                type="text"
                value={searchInput}
                onChange={e => handleSearchChange(e.target.value)}
                placeholder="Search name or email…"
                className="bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none flex-1 min-w-0"
              />
              {searchInput && (
                <button type="button" onClick={() => { setSearchInput(''); setPage(1); setSearch(''); }}>
                  <span className="material-symbols-outlined text-on-surface-variant hover:text-on-surface" style={{ fontSize: '15px' }}>close</span>
                </button>
              )}
            </div>

            {/* Role filter */}
            <DropdownSelect
              value={roleFilter}
              onChange={v => handleFilterChange(setRoleFilter)(v)}
              options={ROLE_OPTIONS}
              triggerIcon="badge"
            />

            {/* Status filter */}
            <DropdownSelect
              value={statusFilter}
              onChange={v => handleFilterChange(setStatusFilter)(v)}
              options={STATUS_OPTIONS}
              triggerIcon="toggle_on"
            />

            {/* Add User */}
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-primary text-on-primary rounded-sm hover:opacity-90 transition-opacity">
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>person_add</span>
              Add User
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-surface-container border border-outline-variant rounded-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-high border-b border-outline-variant">
                  {SORT_COLS.map(col => (
                    <th key={col.key} onClick={() => handleSort(col.key)}
                      style={col.width ? { width: `${col.width}px` } : undefined}
                      className={`p-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant cursor-pointer select-none whitespace-nowrap hover:text-on-surface transition-colors ${col.right ? 'text-right' : ''}`}>
                      <span className={`inline-flex items-center gap-1 ${col.right ? 'justify-end' : ''}`}>
                        {col.right ? (
                          <>
                            {sortKey === col.key
                              ? <span className="material-symbols-outlined text-primary" style={{ fontSize: '13px' }}>{sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>
                              : <span className="material-symbols-outlined text-outline" style={{ fontSize: '13px' }}>unfold_more</span>}
                            {col.label}
                          </>
                        ) : (
                          <>
                            {col.label}
                            {sortKey === col.key
                              ? <span className="material-symbols-outlined text-primary" style={{ fontSize: '13px' }}>{sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>
                              : <span className="material-symbols-outlined text-outline" style={{ fontSize: '13px' }}>unfold_more</span>}
                          </>
                        )}
                      </span>
                    </th>
                  ))}
                  <th className="p-3 w-20 text-xs font-bold uppercase tracking-wider text-on-surface-variant text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(8)].map((_, i) => (
                    <tr key={i} className="border-b border-outline-variant/30">
                      {[...Array(8)].map((_, j) => (
                        <td key={j} className="p-3">
                          <div className="h-3 bg-surface-container-high rounded animate-pulse" style={{ width: j < 2 ? '70%' : '50%' }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : sorted.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-on-surface-variant text-sm">
                      {search ? `No users matching "${search}"` : 'No users found'}
                    </td>
                  </tr>
                ) : sorted.map(u => (
                  <tr key={u.id} className="border-b border-outline-variant/30 hover:bg-surface-container-high/50 transition-colors group">
                    {/* Name */}
                    <td className="p-3 text-sm text-on-surface whitespace-nowrap">{u.name ?? <span className="text-on-surface-variant italic">—</span>}</td>

                    {/* Email */}
                    <td className="p-3 text-sm text-on-surface-variant font-mono whitespace-nowrap">{u.email}</td>

                    {/* Role badge */}
                    <td className="p-3">
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-sm
                        ${u.role === 'admin'
                          ? 'bg-primary/15 text-primary border border-primary/30'
                          : 'bg-surface-container-high text-on-surface-variant border border-outline-variant'}`}>
                        {u.role}
                      </span>
                    </td>

                    {/* Status badge */}
                    <td className="p-3">
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-sm
                        ${u.is_active
                          ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                          : 'bg-surface-container-high text-on-surface-variant border border-outline-variant'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {/* Zerodha User ID */}
                    <td className="p-3 text-sm font-mono text-on-surface-variant whitespace-nowrap">
                      {u.zerodha_user_id ?? <span className="italic">—</span>}
                    </td>

                    {/* Capital */}
                    <td className="p-3 text-sm tabular-nums text-on-surface text-right whitespace-nowrap">
                      {fmtCapital(u.capital)}
                    </td>

                    {/* Access Token — inline edit */}
                    <td className="p-3 text-sm">
                      {inlineEdit?.id === u.id ? (
                        <div className="flex items-center gap-1.5 min-w-[220px]">
                          <input
                            ref={inlineRef}
                            value={inlineEdit.value}
                            onChange={e => setInlineEdit(ie => ie ? { ...ie, value: e.target.value } : ie)}
                            onKeyDown={e => { if (e.key === 'Enter') saveInlineToken(); if (e.key === 'Escape') setInlineEdit(null); }}
                            className="flex-1 bg-surface-container border border-primary rounded-sm px-2 py-1 text-xs text-on-surface font-mono outline-none min-w-0"
                            placeholder="Paste token…"
                          />
                          <button onClick={saveInlineToken} disabled={inlineSaving}
                            title="Save token"
                            className="p-1 rounded-sm text-green-400 hover:bg-green-500/10 transition-colors disabled:opacity-50">
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check</span>
                          </button>
                          <button onClick={() => setInlineEdit(null)} title="Cancel"
                            className="p-1 rounded-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors">
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group/token">
                          <span className="font-mono text-xs text-on-surface-variant">
                            {truncateToken(u.zerodha_access_token) ?? <span className="italic">—</span>}
                          </span>
                          <button
                            onClick={() => startInlineEdit(u)}
                            title="Edit access token"
                            className="opacity-0 group-hover/token:opacity-100 transition-opacity p-0.5 rounded-sm text-on-surface-variant hover:text-primary hover:bg-primary/10">
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>edit</span>
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditTarget(u)} title="Edit user"
                          className="p-1 rounded-sm text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors">
                          <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>edit</span>
                        </button>
                        <button onClick={() => setDeleteTarget(u)} title="Delete user"
                          className="p-1 rounded-sm hover:bg-red-500/10 transition-colors" style={{ color: '#f87171' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-outline-variant">
              <span className="text-sm text-on-surface-variant">Page {page} of {totalPages} &middot; {total} records</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(1)} disabled={page === 1}
                  className="p-1.5 rounded-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high disabled:opacity-30 transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>first_page</span>
                </button>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-1.5 rounded-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high disabled:opacity-30 transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_left</span>
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                  const p = start + i;
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-sm text-sm font-semibold transition-colors
                        ${p === page ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}`}>
                      {p}
                    </button>
                  );
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="p-1.5 rounded-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high disabled:opacity-30 transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_right</span>
                </button>
                <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                  className="p-1.5 rounded-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high disabled:opacity-30 transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>last_page</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showAdd     && <AddUserModal    onClose={() => setShowAdd(false)}     onSuccess={handleAdded} />}
      {editTarget  && <EditUserModal   user={editTarget}  onClose={() => setEditTarget(null)}   onSuccess={handleEdited} />}
      {deleteTarget && <DeleteUserModal user={deleteTarget} onCancel={() => setDeleteTarget(null)} onDeleted={handleDeleted} />}

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
