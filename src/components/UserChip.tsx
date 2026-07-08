import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUserStore } from '../store/userStore'
import { apiAuth } from '../api/auth'

// Renders inside the RequireAuth layout, so it appears on every protected page.
// Absolute-positioned in the top-right corner; pages are responsible for not
// crashing into it visually (current Landing/etc. have headroom).
export function UserChip() {
  const navigate     = useNavigate()
  const user         = useUserStore((s) => s.user)
  const token        = useUserStore((s) => s.token)
  const clearSession = useUserStore((s) => s.clearSession)
  const [busy, setBusy] = useState(false)

  if (!user) return null

  const signOut = async () => {
    if (busy) return
    setBusy(true)
    // Best-effort revoke server-side. Even if the network call fails, the
    // client must still drop its credentials and go to /login.
    if (token) { try { await apiAuth.logout(token) } catch { /* ignore */ } }
    clearSession()
    navigate('/login', { replace: true })
  }

  return (
    <div className="fixed top-3 right-4 z-30 flex items-center gap-2 text-[10px] font-mono">
      <span className="text-terminal-dim">
        <span className="text-terminal-dim/60">Signed in as</span>{' '}
        <span className="text-terminal-green font-bold">{user.displayName}</span>
        <span className="text-terminal-dim/40 ml-1 uppercase tracking-widest">[{user.role}]</span>
      </span>
      <button
        onClick={() => navigate('/account')}
        title="Account settings"
        className="px-2 py-0.5 rounded border border-terminal-dim/30 text-terminal-dim/70 tracking-widest uppercase
          hover:border-terminal-green/60 hover:text-terminal-green transition-colors"
      >
        Account
      </button>
      {user.role === 'admin' && (
        <button
          onClick={() => navigate('/admin/users')}
          title="Manage users"
          className="px-2 py-0.5 rounded border border-terminal-blue/40 text-terminal-blue/80 tracking-widest uppercase
            hover:border-terminal-blue hover:text-terminal-blue transition-colors"
        >
          Admin
        </button>
      )}
      <button
        onClick={signOut} disabled={busy}
        title="Sign out of DICE"
        className="px-2 py-0.5 rounded border border-terminal-dim/30 text-terminal-dim/70 tracking-widest uppercase
          hover:border-terminal-red/50 hover:text-terminal-red/80
          disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {busy ? '…' : 'Sign out'}
      </button>
    </div>
  )
}
