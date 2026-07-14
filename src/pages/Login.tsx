import { useState, useEffect } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import { apiAuth, AuthApiError } from '../api/auth'
import { useUserStore, type SignOutReason } from '../store/userStore'
import { hydrateFromApi } from '../api/sync'

export function Login() {
  const navigate             = useNavigate()
  const setSession           = useUserStore((s) => s.setSession)
  const clearSession         = useUserStore((s) => s.clearSession)
  const user                 = useUserStore((s) => s.user)
  const setupRequired        = useUserStore((s) => s.setupRequired)
  const consumeSignOutReason = useUserStore((s) => s.consumeSignOutReason)

  const [username, setUsername]     = useState('')
  const [password, setPassword]     = useState('')
  const [error,    setError]        = useState<string | null>(null)
  const [busy,     setBusy]         = useState(false)
  // Captured once on mount so a redirect from a 401/423 elsewhere can show
  // its banner here. Manual sign-outs deliberately render no banner.
  const [reason,   setReason]       = useState<SignOutReason | null>(null)
  useEffect(() => {
    const r = consumeSignOutReason()
    if (r && r !== 'manual') setReason(r)
  }, [consumeSignOutReason])

  // Guards: signed-in users skip login; pre-setup installs go to /setup.
  if (setupRequired) return <Navigate to="/setup" replace />
  if (user)          return <Navigate to="/" replace />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy || !username || !password) return
    setError(null); setBusy(true)
    try {
      const { token, user } = await apiAuth.login({ username: username.trim(), password })
      setSession(token, user)
      // Hydrate the data stores with the new user's data BEFORE navigating —
      // otherwise the previous user's roster/history would briefly persist.
      await hydrateFromApi()
      navigate('/', { replace: true })
    } catch (e) {
      // 423 = account locked. Flag the store so a later mount still shows the
      // banner if the user navigates away and back. Other statuses use the
      // server's "invalid credentials" string verbatim (no user enumeration).
      if (e instanceof AuthApiError && e.status === 423) {
        clearSession('locked')
        setReason('locked')
        setError(e.message)
      } else {
        setError((e as Error).message)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-terminal-bg font-mono flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Sign in to DICE</h1>
          <p className="text-xs text-terminal-dim mt-2">Defensive Incident Containment Exercises</p>
        </div>

        {reason === 'expired' && (
          <div className="rounded border border-terminal-blue/40 bg-terminal-blue/10 text-terminal-blue px-3 py-2 text-xs">
            Your session expired. Please sign in again.
          </div>
        )}
        {reason === 'locked' && (
          <div className="rounded border border-terminal-amber/40 bg-terminal-amber/10 text-terminal-amber px-3 py-2 text-xs">
            Too many failed attempts. Account locked for 15 minutes.
          </div>
        )}

        <div className="space-y-3">
          <label className="block">
            <span className="text-[10px] text-terminal-dim tracking-widest uppercase">Username</span>
            <input
              value={username} onChange={(e) => setUsername(e.target.value)}
              autoFocus autoComplete="username"
              className="mt-1 w-full bg-terminal-surface border border-terminal-green/40 focus:border-terminal-green
                text-white px-3 py-2 rounded focus:outline-none text-sm placeholder-terminal-dim/50"
              placeholder="alice"
            />
          </label>
          <label className="block">
            <span className="text-[10px] text-terminal-dim tracking-widest uppercase">Password</span>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="mt-1 w-full bg-terminal-surface border border-terminal-green/40 focus:border-terminal-green
                text-white px-3 py-2 rounded focus:outline-none text-sm placeholder-terminal-dim/50"
              placeholder="••••••••"
            />
          </label>
        </div>

        {error && (
          <div className="rounded border border-terminal-red/40 bg-terminal-red/10 text-terminal-red px-3 py-2 text-xs">
            {error}
          </div>
        )}

        <button
          type="submit" disabled={busy || !username || !password}
          className="w-full py-3 rounded border border-terminal-green bg-terminal-green/10 text-terminal-green
            font-bold text-sm tracking-widest uppercase hover:bg-terminal-green/20
            disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          {busy ? 'Signing in…' : '▶ Sign in'}
        </button>

        <p className="text-center text-[10px] text-terminal-dim/60 tracking-wide">
          Need an account? <Link to="/register" className="text-terminal-green/80 hover:text-terminal-green">Create one</Link> with an invite code, or ask your DICE administrator.
        </p>
      </form>
    </div>
  )
}
