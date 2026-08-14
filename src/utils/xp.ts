import type { Character, FeedEntry, OutcomeTier } from '../types/game'

// XP awarded per individual roll outcome — the single source of truth for
// both the live in-session scorecard (LiveXPScorecard) and the amount
// actually persisted to each player's roster character at session end.
export const OUTCOME_XP: Record<OutcomeTier, number> = {
  critical_hit:  25,
  success:       15,
  partial:       8,
  failure:       3,
  critical_fail: 1,
}

// Sums the XP a single character actually earned from their own rolls this
// session. Each roll_result feed entry records which character made it
// (roll.player), so contribution is tracked per player throughout the
// session — this is not a share of a team total.
export function computePlayerXp(playerId: string, feed: FeedEntry[]): number {
  return feed
    .filter((e) => e.type === 'roll_result' && e.roll?.player === playerId && e.outcome)
    .reduce((sum, e) => sum + (OUTCOME_XP[e.outcome as OutcomeTier] ?? 0), 0)
}

// Per-player XP for a whole session, plus a team total. Individuals keep
// their own earned amounts rather than being flattened to an even split.
// The minimum-reward floor only kicks in for the degenerate case where
// nobody rolled at all (e.g. an immediate timeout) — there's no individual
// data to differentiate on, so an even split of the floor is the only
// sane fallback.
export function computeXpAwards(
  players: Character[],
  feed:    FeedEntry[],
  outcome: 'victory' | 'partial' | 'defeat',
): { perPlayer: Record<string, number>; total: number } {
  const raw      = players.map((p) => computePlayerXp(p.id, feed))
  const rawTotal = raw.reduce((sum, x) => sum + x, 0)
  const floor    = outcome === 'victory' ? 50 : 20

  if (rawTotal === 0) {
    const share = Math.round(floor / Math.max(1, players.length))
    const perPlayer: Record<string, number> = {}
    players.forEach((p) => { perPlayer[p.id] = share })
    return { perPlayer, total: share * players.length }
  }

  const perPlayer: Record<string, number> = {}
  players.forEach((p, i) => { perPlayer[p.id] = raw[i] })
  return { perPlayer, total: Math.max(rawTotal, floor) }
}
