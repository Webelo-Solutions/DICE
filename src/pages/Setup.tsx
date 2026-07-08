import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { apiAuth } from '../api/auth'
import { useUserStore } from '../store/userStore'
import { hydrateFromApi } from '../api/sync'

export function Setup() {
  const navigate      = useNavigate()
  const setSession    = useUserStore((s) => s.setSession)
  const user          = useUserStore((s) => s.user)
  const setupRequired = useUserStore((s) => s.setupRequired)

  // Guard against direct navigation to /setup when setup is already done.
  if (user)            return <Navigate to="/" replace />
  if (!setupRequired)  return <Navigate to="/login" replace />

  const [username,    setUsername]    = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password,    setPassword]    = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [error,       setError]       = useState<string | null>(null)
  const [busy,        setBusy]        = useState(false)

  const valid =
    /^[a-z0-9][a-z0-9._-]{1,31}$/i.test(username) &&
    displayName.trim().length >= 1 &&
    password.length >= 8 &&
    password === confirm

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || busy) return
    setError(null); setBusy(true)
    try {
      const { token, user } = await apiAuth.setup({
        username:    username.trim(),
        displayName: displayName.trim(),
        password,
      })
      setSession(token, user)
      // Pick up the freshly-backfilled rosters/history (owned by the new admin).
      await hydrateFromApi()
      navigate('/', { replace: true })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-terminal-bg font-mono flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-md space-y-5">
        <div className="text-center">
          <div className="text-[10px] text-terminal-dim tracking-widest uppercase">First-run setup</div>
          <h1 className="text-2xl font-bold text-white mt-1">Create the admin account</h1>
          <p className="text-xs text-terminal-dim mt-3 leading-relaxed">
            This is the first time DICE is running on this install. The first user becomes the admin
            and owns all existing rosters, campaigns, and session history. Additional users can be
            added later from the admin panel.
          </p>
        </div>

        <div className="space-y-3">
          <Field label="Username" hint="Lowercase letters, numbers, ._- — 2–32 chars">
            <input
              value={username} onChange={(e) => setUsername(e.target.value)}
              autoFocus autoComplete="username"
              className={inputClass} placeholder="alice"
            />
          </Field>
          <Field label="Display Name">
            <input
              value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
              className={inputClass} placeholder="Alice Smith"
            />
          </Field>
          <Field label="Password" hint="At least 8 characters">
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className={inputClass} placeholder="••••••••"
            />
          </Field>
          <Field label="Confirm Password">
            <input
              type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              className={inputClass} placeholder="••••••••"
            />
          </Field>
        </div>

        {error && (
          <div className="rounded border border-terminal-red/40 bg-terminal-red/10 text-terminal-red px-3 py-2 text-xs">
            {error}
          </div>
        )}
        {password.length > 0 && password.length < 8 && (
          <div className="text-[10px] text-terminal-amber">Password is too short (need 8+)</div>
        )}
        {confirm.length > 0 && password !== confirm && (
          <div className="text-[10px] text-terminal-amber">Passwords don't match yet</div>
        )}

        <button
          type="submit" disabled={!valid || busy}
          className="w-full py-3 rounded border border-terminal-green bg-terminal-green/10 text-terminal-green
            font-bold text-sm tracking-widest uppercase hover:bg-terminal-green/20
            disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          {busy ? 'Creating account…' : '▶ Create Admin Account'}
        </button>

        <p className="text-center text-[10px] text-terminal-dim/60 tracking-widest uppercase">
          DICE — Defensive Incident Containment Exercises
        </p>
      </form>
    </div>
  )
}

const inputClass = `w-full bg-terminal-surface border border-terminal-green/40 focus:border-terminal-green
  text-white px-3 py-2 rounded focus:outline-none text-sm placeholder-terminal-dim/50`

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[10px] text-terminal-dim tracking-widest uppercase">{label}</span>
        {hint && <span className="text-[9px] text-terminal-dim/50">{hint}</span>}
      </div>
      {children}
    </label>
  )
}
