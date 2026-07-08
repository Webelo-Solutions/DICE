// Per-username login lockout. Kept in-memory: a single DICE install doesn't
// serve enough auth traffic to need a persisted counter, and a server restart
// (the admin path) clears it — which is the right escape hatch if a legit
// user locks themselves out.
//
// Policy: 5 failed attempts inside a 15-minute window locks the account for
// 15 minutes. Successful login clears the counter.
//
// We lock by USERNAME (not IP) so an attacker can't lock out a colleague by
// flooding their account from elsewhere on the LAN — but the cost is that a
// 423 reply tells an attacker the username exists. Acceptable trade-off for a
// trusted-LAN internal app where the threat is automated guessing, not
// username enumeration.

const FAIL_WINDOW_MS = 15 * 60 * 1000
const MAX_FAILS      = 5
const LOCKOUT_MS     = 15 * 60 * 1000

interface Entry { count: number; firstFailAt: number; lockedUntil: number }
const state = new Map<string, Entry>()

// Returns the ms timestamp the lock lifts, or null if not locked.
export function lockedUntil(username: string): number | null {
  const e = state.get(username)
  if (!e) return null
  if (e.lockedUntil > Date.now()) return e.lockedUntil
  return null
}

export function recordFailure(username: string): void {
  const now = Date.now()
  const e = state.get(username) ?? { count: 0, firstFailAt: now, lockedUntil: 0 }
  // If the previous window has fully elapsed, start a fresh count.
  if (now - e.firstFailAt > FAIL_WINDOW_MS) { e.count = 0; e.firstFailAt = now }
  e.count++
  if (e.count >= MAX_FAILS) {
    e.lockedUntil = now + LOCKOUT_MS
    e.count = 0     // reset so a single further fail post-unlock doesn't immediately re-lock
  }
  state.set(username, e)
}

export function recordSuccess(username: string): void {
  state.delete(username)
}

// Test/admin escape hatch — unused in production code paths.
export function _resetAll(): void { state.clear() }
