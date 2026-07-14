import { useState } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import { apiAuth, AuthApiError } from '../api/auth'
import { useUserStore } from '../store/userStore'
import { hydrateFromApi } from '../api/sync'

// Self-service account creation — off by default on any install. Only
// succeeds if an admin has set an invite code (PUT /api/admin/registration-code
// in AdminUsers.tsx); the server 403s otherwise. Always creates a 'player'
// account — role escalation isn't possible from this form.
export function Register() {
  const navigate       = useNavigate()
  const setSession     = useUserStore((s) => s.setSession)
  const user           = useUserStore((s) => s.user)
  const setupRequired  = useUserStore((s) => s.setupRequired)

  const [username,    setUsername]    = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password,    setPassword]    = useState('')
  const [inviteCode,  setInviteCode]  = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy,  setBusy]  = useState(false)

  if (setupRequired) return <Navigate to="/setup" replace />
  if (user)          return <Navigate to="/" replace />

  const valid = username.trim().length >= 2 && displayName.trim().length >= 1 && password.length >= 8 && inviteCode.trim().length > 0

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy || !valid) return
    setError(null); setBusy(true)
    try {
      const { token, user } = await apiAuth.register({
        username: username.trim(), displayName: displayName.trim(), password, inviteCode: inviteCode.trim(),
      })
      setSession(token, user)
      await hydrateFromApi()
      navigate('/', { replace: true })
    } catch (e) {
      setError(e instanceof AuthApiError ? e.message : (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-terminal-bg font-mono flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Create your DICE account</h1>
          <p className="text-xs text-terminal-dim mt-2">Requires an invite code from your DICE administrator.</p>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-[10px] text-terminal-dim tracking-widest uppercase">Invite Code</span>
            <input
              value={inviteCode} onChange={(e) => setInviteCode(e.target.value)}
              autoFocus
              className="mt-1 w-full bg-terminal-surface border border-terminal-green/40 focus:border-terminal-green
                text-white px-3 py-2 rounded focus:outline-none text-sm placeholder-terminal-dim/50"
              placeholder="Ask your administrator"
            />
          </label>
          <label className="block">
            <span className="text-[10px] text-terminal-dim tracking-widest uppercase">Username</span>
            <input
              value={username} onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="mt-1 w-full bg-terminal-surface border border-terminal-green/40 focus:border-terminal-green
                text-white px-3 py-2 rounded focus:outline-none text-sm placeholder-terminal-dim/50"
              placeholder="alice"
            />
          </label>
          <label className="block">
            <span className="text-[10px] text-terminal-dim tracking-widest uppercase">Display Name</span>
            <input
              value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 w-full bg-terminal-surface border border-terminal-green/40 focus:border-terminal-green
                text-white px-3 py-2 rounded focus:outline-none text-sm placeholder-terminal-dim/50"
              placeholder="Alice Smith"
            />
          </label>
          <label className="block">
            <span className="text-[10px] text-terminal-dim tracking-widest uppercase">Password</span>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="mt-1 w-full bg-terminal-surface border border-terminal-green/40 focus:border-terminal-green
                text-white px-3 py-2 rounded focus:outline-none text-sm placeholder-terminal-dim/50"
              placeholder="••••••••"
            />
            <span className="text-[9px] text-terminal-dim/50 mt-1 block">≥ 8 characters</span>
          </label>
        </div>

        {error && (
          <div className="rounded border border-terminal-red/40 bg-terminal-red/10 text-terminal-red px-3 py-2 text-xs">
            {error}
          </div>
        )}

        <button
          type="submit" disabled={busy || !valid}
          className="w-full py-3 rounded border border-terminal-green bg-terminal-green/10 text-terminal-green
            font-bold text-sm tracking-widest uppercase hover:bg-terminal-green/20
            disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          {busy ? 'Creating account…' : '▶ Create Account'}
        </button>

        <p className="text-center text-[10px] text-terminal-dim/60 tracking-wide">
          Already have an account? <Link to="/login" className="text-terminal-green/80 hover:text-terminal-green">Sign in</Link>
        </p>
      </form>
    </div>
  )
}
