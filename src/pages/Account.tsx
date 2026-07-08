import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUserStore } from '../store/userStore'
import { apiAuth, AuthApiError } from '../api/auth'

// Self-service account page. The only privileged action here is changing
// the password — everything else (display name, role, active) is admin-only
// and lives at /admin/users.
//
// Successful password change revokes every OTHER session for this user
// (server-side). The current session/token stays valid.
export function Account() {
  const navigate = useNavigate()
  const user     = useUserStore((s) => s.user)
  const token    = useUserStore((s) => s.token)

  const [current,    setCurrent]    = useState('')
  const [next,       setNext]       = useState('')
  const [confirm,    setConfirm]    = useState('')
  const [error,      setError]      = useState<string | null>(null)
  const [success,    setSuccess]    = useState<string | null>(null)
  const [busy,       setBusy]       = useState(false)

  if (!user || !token) return null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError(null); setSuccess(null)
    if (next.length < 8) {
      setError('New password must be at least 8 characters'); return
    }
    if (next !== confirm) {
      setError('Confirmation does not match new password'); return
    }
    if (next === current) {
      setError('New password must differ from current password'); return
    }
    setBusy(true)
    try {
      await apiAuth.changePassword(token, { currentPassword: current, newPassword: next })
      setSuccess('Password updated. Other devices have been signed out.')
      setCurrent(''); setNext(''); setConfirm('')
    } catch (e) {
      setError(e instanceof AuthApiError ? e.message : (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-terminal-bg font-mono p-6 pt-16">
      <div className="max-w-2xl mx-auto space-y-8">
        <header className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Account</h1>
            <p className="text-xs text-terminal-dim mt-1">Manage your DICE sign-in</p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="text-xs text-terminal-dim hover:text-terminal-green tracking-widest uppercase"
          >
            ← Back
          </button>
        </header>

        {/* Identity card — read-only summary of the current user. */}
        <section className="rounded border border-terminal-border bg-terminal-surface p-5">
          <h2 className="text-[10px] tracking-widest uppercase text-terminal-dim mb-3">Profile</h2>
          <dl className="grid grid-cols-[100px_1fr] gap-y-2 text-sm">
            <dt className="text-terminal-dim/70">Username</dt>
            <dd className="text-white">{user.username}</dd>
            <dt className="text-terminal-dim/70">Display name</dt>
            <dd className="text-white">{user.displayName}</dd>
            <dt className="text-terminal-dim/70">Role</dt>
            <dd className="text-terminal-green uppercase tracking-widest text-xs">{user.role}</dd>
          </dl>
          <p className="text-[10px] text-terminal-dim/60 mt-4">
            Display name and role can only be changed by an administrator.
          </p>
        </section>

        {/* Change password */}
        <section className="rounded border border-terminal-border bg-terminal-surface p-5">
          <h2 className="text-[10px] tracking-widest uppercase text-terminal-dim mb-3">Change password</h2>
          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="text-[10px] text-terminal-dim tracking-widest uppercase">Current password</span>
              <input
                type="password" autoComplete="current-password"
                value={current} onChange={(e) => setCurrent(e.target.value)}
                className="mt-1 w-full bg-terminal-bg border border-terminal-green/40 focus:border-terminal-green
                  text-white px-3 py-2 rounded focus:outline-none text-sm placeholder-terminal-dim/50"
                placeholder="••••••••"
              />
            </label>
            <label className="block">
              <span className="text-[10px] text-terminal-dim tracking-widest uppercase">New password</span>
              <input
                type="password" autoComplete="new-password"
                value={next} onChange={(e) => setNext(e.target.value)}
                className="mt-1 w-full bg-terminal-bg border border-terminal-green/40 focus:border-terminal-green
                  text-white px-3 py-2 rounded focus:outline-none text-sm placeholder-terminal-dim/50"
                placeholder="at least 8 characters"
              />
            </label>
            <label className="block">
              <span className="text-[10px] text-terminal-dim tracking-widest uppercase">Confirm new password</span>
              <input
                type="password" autoComplete="new-password"
                value={confirm} onChange={(e) => setConfirm(e.target.value)}
                className="mt-1 w-full bg-terminal-bg border border-terminal-green/40 focus:border-terminal-green
                  text-white px-3 py-2 rounded focus:outline-none text-sm placeholder-terminal-dim/50"
                placeholder="repeat new password"
              />
            </label>

            {error && (
              <div className="rounded border border-terminal-red/40 bg-terminal-red/10 text-terminal-red px-3 py-2 text-xs">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded border border-terminal-green/40 bg-terminal-green/10 text-terminal-green px-3 py-2 text-xs">
                {success}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <p className="text-[10px] text-terminal-dim/60">
                After updating, other devices will need to sign in again.
              </p>
              <button
                type="submit"
                disabled={busy || !current || !next || !confirm}
                className="px-4 py-2 rounded border border-terminal-green bg-terminal-green/10 text-terminal-green
                  text-xs font-bold tracking-widest uppercase hover:bg-terminal-green/20
                  disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                {busy ? 'Saving…' : 'Update password'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  )
}
