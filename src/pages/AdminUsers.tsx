import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiAdmin, type AdminUserRow } from '../api/admin'
import { useUserStore } from '../store/userStore'

// /admin/users — gated by RequireAdmin in App.tsx. Lets the admin list, create,
// edit, reset-password, and force-sign-out other users. Self-protect guards on
// the server prevent the admin from deactivating or demoting themselves; this
// UI also greys out the dangerous actions on the current user.
export function AdminUsers() {
  const navigate = useNavigate()
  const self = useUserStore((s) => s.user)
  const [users, setUsers]     = useState<AdminUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg]         = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  // Modals
  const [createOpen, setCreateOpen] = useState(false)
  const [resetFor,   setResetFor]   = useState<AdminUserRow | null>(null)

  const load = async () => {
    setLoading(true)
    try { setUsers(await apiAdmin.listUsers()) }
    catch (e) { setMsg({ kind: 'error', text: (e as Error).message }) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const flash = (kind: 'success' | 'error', text: string) => {
    setMsg({ kind, text })
    setTimeout(() => setMsg((m) => (m?.text === text ? null : m)), 4000)
  }

  const toggleActive = async (u: AdminUserRow) => {
    try {
      await apiAdmin.updateUser(u.id, { active: !u.active })
      flash('success', `${u.username} ${u.active ? 'disabled' : 'enabled'}`)
      load()
    } catch (e) { flash('error', (e as Error).message) }
  }

  const changeRole = async (u: AdminUserRow, role: string) => {
    try {
      await apiAdmin.updateUser(u.id, { role })
      flash('success', `${u.username} role → ${role}`)
      load()
    } catch (e) { flash('error', (e as Error).message) }
  }

  const signOutAll = async (u: AdminUserRow) => {
    if (!window.confirm(`Sign ${u.displayName} out of all active sessions?`)) return
    try {
      await apiAdmin.signOutAll(u.id)
      flash('success', `${u.username} signed out everywhere`)
    } catch (e) { flash('error', (e as Error).message) }
  }

  return (
    <div className="min-h-screen bg-terminal-bg font-mono p-6 pt-12">
      <div className="w-full max-w-3xl mx-auto space-y-6">
        <button onClick={() => navigate('/')} className="text-xs text-terminal-dim hover:text-terminal-green transition-colors">
          ← Back to Home
        </button>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] text-terminal-dim tracking-widest uppercase">Admin</div>
            <h1 className="text-xl font-bold text-white">Users</h1>
            <p className="text-[11px] text-terminal-dim mt-1">
              Create, disable, reset passwords, and revoke sessions for users on this DICE install.
            </p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold tracking-widest uppercase
              bg-terminal-green/10 border border-terminal-green/40 text-terminal-green
              hover:bg-terminal-green/20 hover:border-terminal-green rounded transition-all"
          >
            + New User
          </button>
        </div>

        {msg && (
          <div className={`rounded border p-3 text-[11px] ${msg.kind === 'success'
            ? 'border-terminal-green/40 bg-terminal-green/10 text-terminal-green'
            : 'border-terminal-red/40 bg-terminal-red/10 text-terminal-red'}`}>
            {msg.text}
          </div>
        )}

        <div className="rounded border border-terminal-border bg-terminal-surface/60 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-terminal-border flex items-center justify-between">
            <span className="text-xs font-bold text-terminal-green tracking-widest uppercase">User Accounts</span>
            <span className="text-[10px] text-terminal-dim">{users.length}</span>
          </div>
          <div className="divide-y divide-terminal-border">
            {loading && <div className="px-4 py-3 text-xs text-terminal-dim italic">Loading…</div>}
            {!loading && users.length === 0 && (
              <div className="px-4 py-3 text-xs text-terminal-dim italic">No users (impossible from this view).</div>
            )}
            {users.map((u) => {
              const isSelf = self?.id === u.id
              return (
                <div key={u.id} className="px-4 py-3 grid grid-cols-12 gap-3 items-center text-[11px]">
                  <div className="col-span-3 min-w-0">
                    <div className="text-sm text-white font-semibold truncate">
                      {u.displayName} {isSelf && <span className="text-[9px] text-terminal-green/70">(you)</span>}
                    </div>
                    <div className="text-[10px] text-terminal-dim truncate">{u.username}</div>
                  </div>
                  <div className="col-span-2">
                    <select
                      value={u.role} onChange={(e) => changeRole(u, e.target.value)}
                      disabled={isSelf && u.role === 'admin'}
                      title={isSelf && u.role === 'admin' ? "You can't demote yourself" : ''}
                      className="bg-terminal-bg border border-terminal-border text-white text-xs px-2 py-1 rounded
                        focus:outline-none focus:border-terminal-blue disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="admin">admin</option>
                      <option value="player">player</option>
                    </select>
                  </div>
                  <div className="col-span-2 text-[10px] text-terminal-dim">
                    <span className={u.active ? 'text-terminal-green' : 'text-terminal-red'}>
                      {u.active ? 'active' : 'disabled'}
                    </span>
                    {u.lastLoginAt && (
                      <div className="text-terminal-dim/60 mt-0.5">
                        last seen {new Date(u.lastLoginAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <div className="col-span-5 flex flex-wrap items-center gap-1.5 justify-end">
                    <button
                      onClick={() => setResetFor(u)}
                      className="text-[10px] px-2 py-1 rounded border border-terminal-border text-terminal-dim
                        hover:text-white hover:border-terminal-dim transition-all"
                    >
                      Reset password
                    </button>
                    <button
                      onClick={() => signOutAll(u)}
                      className="text-[10px] px-2 py-1 rounded border border-terminal-amber/30 text-terminal-amber/80
                        hover:border-terminal-amber hover:text-terminal-amber transition-all"
                    >
                      Sign out all
                    </button>
                    <button
                      onClick={() => toggleActive(u)}
                      disabled={isSelf}
                      title={isSelf ? "You can't disable yourself" : ''}
                      className={`text-[10px] px-2 py-1 rounded border transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                        u.active
                          ? 'border-terminal-red/30 text-terminal-red/80 hover:border-terminal-red hover:text-terminal-red'
                          : 'border-terminal-green/40 text-terminal-green hover:bg-terminal-green/10'
                      }`}
                    >
                      {u.active ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {createOpen && <CreateUserModal onClose={() => setCreateOpen(false)} onCreated={(text) => { flash('success', text); load() }} onError={(text) => flash('error', text)} />}
      {resetFor && <ResetPasswordModal user={resetFor} onClose={() => setResetFor(null)} onDone={(text) => { flash('success', text); setResetFor(null) }} onError={(text) => flash('error', text)} />}
    </div>
  )
}

// ── Create user modal ─────────────────────────────────────────────────────────

function CreateUserModal({ onClose, onCreated, onError }:
  { onClose: () => void; onCreated: (text: string) => void; onError: (text: string) => void }) {
  const [username,    setUsername]    = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password,    setPassword]    = useState('')
  const [role,        setRole]        = useState('player')
  const [busy,        setBusy]        = useState(false)

  const valid =
    /^[a-z0-9][a-z0-9._-]{1,31}$/i.test(username) &&
    displayName.trim().length >= 1 &&
    password.length >= 8

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    try {
      const u = await apiAdmin.createUser({
        username: username.trim().toLowerCase(),
        displayName: displayName.trim(),
        password, role,
      })
      onCreated(`Created ${u.username}`)
      onClose()
    } catch (e) { onError((e as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <ModalShell title="Create User" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <ModalInput label="Username" value={username} onChange={setUsername} placeholder="e.g. bob" hint="2–32 chars, alphanumerics + ._-" autoFocus />
        <ModalInput label="Display Name" value={displayName} onChange={setDisplayName} placeholder="e.g. Bob Smith" />
        <ModalInput label="Initial Password" type="password" value={password} onChange={setPassword} hint="≥ 8 characters; share with the user out-of-band" />
        <label className="block">
          <span className="text-[10px] text-terminal-dim tracking-widest uppercase">Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value)}
            className="mt-1 w-full bg-terminal-bg border border-terminal-border text-white text-sm px-3 py-2 rounded focus:outline-none focus:border-terminal-blue">
            <option value="player">player</option>
            <option value="admin">admin</option>
          </select>
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs tracking-widest uppercase border border-terminal-border text-terminal-dim hover:text-white rounded">
            Cancel
          </button>
          <button type="submit" disabled={!valid || busy}
            className="px-3 py-1.5 text-xs font-semibold tracking-widest uppercase
              bg-terminal-green/10 border border-terminal-green/40 text-terminal-green
              hover:bg-terminal-green/20 disabled:opacity-30 disabled:cursor-not-allowed rounded">
            {busy ? 'Creating…' : 'Create User'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

// ── Reset password modal ──────────────────────────────────────────────────────

function ResetPasswordModal({ user, onClose, onDone, onError }:
  { user: AdminUserRow; onClose: () => void; onDone: (text: string) => void; onError: (text: string) => void }) {
  const [password, setPassword] = useState('')
  const [busy,     setBusy]     = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8 || busy) return
    setBusy(true)
    try {
      await apiAdmin.resetPassword(user.id, password)
      onDone(`Password reset for ${user.username}; active sessions revoked`)
    } catch (e) { onError((e as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <ModalShell title={`Reset password — ${user.displayName}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-[11px] text-terminal-dim leading-relaxed">
          The new password takes effect immediately. <span className="text-terminal-amber">All of {user.username}'s active sessions will be revoked.</span> Share the new password with them out-of-band.
        </p>
        <ModalInput label="New password" type="password" value={password} onChange={setPassword} hint="≥ 8 characters" autoFocus />
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs tracking-widest uppercase border border-terminal-border text-terminal-dim hover:text-white rounded">
            Cancel
          </button>
          <button type="submit" disabled={password.length < 8 || busy}
            className="px-3 py-1.5 text-xs font-semibold tracking-widest uppercase
              bg-terminal-amber/10 border border-terminal-amber/40 text-terminal-amber
              hover:bg-terminal-amber/20 disabled:opacity-30 disabled:cursor-not-allowed rounded">
            {busy ? 'Resetting…' : 'Reset Password'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

// ── Small shared bits ────────────────────────────────────────────────────────

function ModalShell({ title, children, onClose }:
  { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div className="w-full max-w-md rounded border border-terminal-border bg-terminal-surface p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-terminal-dim hover:text-white text-xs">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ModalInput({ label, value, onChange, type='text', placeholder, hint, autoFocus }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; hint?: string; autoFocus?: boolean
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[10px] text-terminal-dim tracking-widest uppercase">{label}</span>
        {hint && <span className="text-[9px] text-terminal-dim/50">{hint}</span>}
      </div>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus} placeholder={placeholder} autoComplete="off"
        className="w-full bg-terminal-bg border border-terminal-border focus:border-terminal-blue
          text-white px-3 py-2 rounded focus:outline-none text-sm placeholder-terminal-dim/50"
      />
    </label>
  )
}
