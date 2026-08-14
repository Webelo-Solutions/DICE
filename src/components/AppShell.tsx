import { useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useUserStore } from '../store/userStore'
import { apiAuth } from '../api/auth'
import { NAV_ENTRIES } from '../config/navigation'
import { useCommandPaletteStore } from '../store/commandPaletteStore'
import { CommandPalette } from './CommandPalette'
import { ToastStack } from './ToastStack'

const COLLAPSE_KEY = 'dice-sidebar-collapsed'
const EXPANDED_PX  = 224
const COLLAPSED_PX = 56

// Dense in-session screens force the sidebar down to an icon rail so they get
// full width back. This does not overwrite the user's saved preference.
function routeForcesCollapse(pathname: string): boolean {
  return pathname === '/game' || pathname === '/play'
}

// Persistent left sidebar + mount point for the command palette and toast
// stack. Rendered once inside RequireAuth, wrapping every protected route.
// Replaces the old fixed top-right UserChip — its account/admin/sign-out
// controls now live in the sidebar footer.
export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const user     = useUserStore((s) => s.user)
  const token    = useUserStore((s) => s.token)
  const clearSession   = useUserStore((s) => s.clearSession)
  const openPalette    = useCommandPaletteStore((s) => s.setOpen)

  const [collapsedPref, setCollapsedPref] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem(COLLAPSE_KEY) === '1',
  )
  // Ephemeral per-visit override so a user can still expand a force-collapsed
  // route (e.g. to jump elsewhere mid-session) without changing their saved
  // preference. Resets whenever the route changes.
  const [override, setOverride] = useState<boolean | null>(null)
  useEffect(() => { setOverride(null) }, [location.pathname])

  const [busy, setBusy] = useState(false)

  if (!user) return <>{children}</>

  const forced    = routeForcesCollapse(location.pathname)
  const collapsed = override !== null ? override : forced || collapsedPref
  const widthPx   = collapsed ? COLLAPSED_PX : EXPANDED_PX

  const toggleCollapsed = () => {
    if (forced) { setOverride(!collapsed); return }
    const next = !collapsedPref
    setCollapsedPref(next)
    localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
  }

  const signOut = async () => {
    if (busy) return
    setBusy(true)
    if (token) { try { await apiAuth.logout(token) } catch { /* ignore — client still drops credentials */ } }
    clearSession()
    navigate('/login', { replace: true })
  }

  const isAdmin = user.role === 'admin'
  const playEntries  = NAV_ENTRIES.filter((e) => e.group === 'play')
  const adminEntries = NAV_ENTRIES.filter((e) => e.group === 'admin')

  const renderGroup = (label: string, entries: typeof NAV_ENTRIES) => (
    <div className="mb-4">
      {!collapsed && (
        <div className="px-3 mb-1 text-[9px] text-terminal-dim/50 tracking-widest uppercase">{label}</div>
      )}
      {entries.map((entry) => {
        const active = location.pathname === entry.path
        return (
          <button
            key={entry.path}
            onClick={() => navigate(entry.path)}
            title={entry.label}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${
              active
                ? 'bg-terminal-green/10 text-terminal-green border-l-2 border-terminal-green'
                : 'text-terminal-dim/70 border-l-2 border-transparent hover:text-white hover:bg-terminal-muted/40'
            } ${collapsed ? 'justify-center' : ''}`}
          >
            <span className="text-sm flex-shrink-0">{entry.glyph}</span>
            {!collapsed && <span className="truncate">{entry.label}</span>}
          </button>
        )
      })}
    </div>
  )

  return (
    <>
      <aside
        style={{ width: widthPx }}
        className="fixed left-0 top-0 bottom-0 z-40 flex flex-col border-r border-terminal-border
          bg-terminal-surface transition-all duration-200 overflow-hidden"
      >
        <div className="flex items-center gap-2 px-3 py-3 border-b border-terminal-border flex-shrink-0">
          <span className="text-terminal-green font-bold text-sm flex-shrink-0">▣</span>
          {!collapsed && <span className="text-white font-bold text-sm tracking-widest">DICE</span>}
          <button
            onClick={toggleCollapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="ml-auto flex-shrink-0 w-6 h-6 flex items-center justify-center rounded border
              border-terminal-border text-terminal-dim/70 text-xs
              hover:border-terminal-green/60 hover:text-terminal-green hover:bg-terminal-green/5 transition-colors"
          >
            {collapsed ? '»' : '«'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin py-3">
          {renderGroup('Play', playEntries)}
          {isAdmin && renderGroup('Admin', adminEntries)}
        </div>

        {!collapsed && (
          <div className="px-3 py-2 border-t border-terminal-border flex-shrink-0">
            <button
              onClick={() => openPalette(true)}
              title="Open command palette"
              className="w-full flex items-center justify-between px-2 py-1.5 rounded border border-terminal-border
                text-[10px] text-terminal-dim/60 hover:border-terminal-green/40 hover:text-terminal-green transition-colors"
            >
              <span>Search…</span>
              <span className="font-mono">Ctrl K</span>
            </button>
          </div>
        )}

        <div className="px-3 py-3 border-t border-terminal-border flex-shrink-0 text-[10px] font-mono">
          {!collapsed ? (
            <>
              <div className="text-terminal-dim truncate">
                <span className="text-terminal-green font-bold">{user.displayName}</span>
                <span className="text-terminal-dim/40 ml-1 uppercase tracking-widest">[{user.role}]</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => navigate('/account')}
                  className="flex-1 px-2 py-1 rounded border border-terminal-dim/30 text-terminal-dim/70 tracking-widest uppercase
                    hover:border-terminal-green/60 hover:text-terminal-green transition-colors"
                >
                  Account
                </button>
                <button
                  onClick={signOut} disabled={busy}
                  className="flex-1 px-2 py-1 rounded border border-terminal-dim/30 text-terminal-dim/70 tracking-widest uppercase
                    hover:border-terminal-red/50 hover:text-terminal-red/80
                    disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {busy ? '…' : 'Sign out'}
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={signOut} disabled={busy}
              title="Sign out"
              className="w-full text-center text-terminal-dim/70 hover:text-terminal-red/80 disabled:opacity-40"
            >
              ⏻
            </button>
          )}
        </div>
      </aside>

      <div style={{ paddingLeft: widthPx }} className="transition-all duration-200 min-h-screen">
        {children}
      </div>

      <CommandPalette />
      <ToastStack />
    </>
  )
}
