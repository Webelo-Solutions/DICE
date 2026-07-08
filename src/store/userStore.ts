import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Mirrors server/auth/routes.ts → AuthUserPublic. Never includes the password
// hash or the bearer token (token lives separately at the store root).
export interface AuthUserPublic {
  id:          string
  username:    string
  displayName: string
  role:        string   // 'admin' | 'player'
}

// Why the user was last signed out — drives the message on the Login page.
//   'manual'  — explicit click on "Sign out" (or never signed in)
//   'expired' — server returned 401 mid-session (token revoked or aged out)
//   'locked'  — login attempt hit the per-username lockout (returned 423)
export type SignOutReason = 'manual' | 'expired' | 'locked'

interface UserStore {
  // Persisted across reloads
  token: string | null
  user:  AuthUserPublic | null
  // Derived at bootstrap from GET /api/auth/me — not persisted
  setupRequired: boolean
  hydrated:      boolean
  // Why we last cleared the session — not persisted, only useful inside the
  // tab where the sign-out happened (Login reads it on mount and clears it).
  lastSignOutReason: SignOutReason | null

  setSession:           (token: string, user: AuthUserPublic) => void
  clearSession:         (reason?: SignOutReason) => void
  setSetupRequired:     (v: boolean) => void
  setHydrated:          (v: boolean) => void
  consumeSignOutReason: () => SignOutReason | null
}

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      token: null,
      user:  null,
      setupRequired: false,
      hydrated:      false,
      lastSignOutReason: null,

      setSession:       (token, user) =>
        set({ token, user, setupRequired: false, lastSignOutReason: null }),
      // Default reason is 'manual' so explicit Sign Out clicks don't show the
      // "session expired" banner. The 401 interceptor passes 'expired'; the
      // Login page passes 'locked' on a 423.
      clearSession:     (reason: SignOutReason = 'manual') =>
        set({ token: null, user: null, lastSignOutReason: reason }),
      setSetupRequired: (v) => set({ setupRequired: v }),
      setHydrated:      (v) => set({ hydrated: v }),
      consumeSignOutReason: () => {
        const r = get().lastSignOutReason
        if (r) set({ lastSignOutReason: null })
        return r
      },
    }),
    {
      name: 'dice-user-store',
      // Only the durable bits — flags like setupRequired/hydrated are re-derived
      // at bootstrap from /api/auth/me on every page load.
      partialize: (s) => ({ token: s.token, user: s.user }),
    },
  ),
)
