import type { FeedEntry, TraitName } from '../types/game'

// 'system' feed entries carry the trait name as their speaker — set at the
// point each trait actually fires (GameSession.tsx / gameStore.ts).
const SYSTEM_TRAIT_SPEAKERS: Record<string, TraitName> = {
  'COMPOSURE':      'Composure',
  'RALLY':          'Rally',
  'SECOND WIND':    'Second Wind',
  'TRUSTED VOICE':  'Trusted Voice',
}

export interface TraitUsageCount {
  trait: TraitName
  count: number
}

// Tallies how many times each trait actually fired across a session's feed —
// both the "announced" traits (Composure/Rally/Second Wind/Trusted Voice,
// via their system feed entries) and the silent modifier traits recorded on
// RollRecord.traitsApplied (Ghost Protocol/Command Presence/Momentum/Eagle
// Eye/Digital Bloodhound/First Responder/Calm Under Pressure).
export function summarizeTraitUsage(feed: FeedEntry[]): TraitUsageCount[] {
  const counts = new Map<TraitName, number>()
  const bump = (t: TraitName, n = 1) => counts.set(t, (counts.get(t) ?? 0) + n)

  for (const entry of feed) {
    if (entry.type === 'system') {
      const trait = SYSTEM_TRAIT_SPEAKERS[entry.speaker]
      if (trait) bump(trait)
    }
    if (entry.type === 'roll_result' && entry.roll?.traitsApplied) {
      for (const t of entry.roll.traitsApplied) bump(t)
    }
  }

  return [...counts.entries()]
    .map(([trait, count]) => ({ trait, count }))
    .sort((a, b) => b.count - a.count)
}

// Aggregates trait usage across many sessions (personal or program Analytics).
// Records without a stored feed (saved before SessionRecord.feed existed)
// contribute nothing rather than erroring.
export function aggregateTraitUsage(records: { feed?: FeedEntry[] }[]): TraitUsageCount[] {
  const counts = new Map<TraitName, number>()
  for (const record of records) {
    for (const { trait, count } of summarizeTraitUsage(record.feed ?? [])) {
      counts.set(trait, (counts.get(trait) ?? 0) + count)
    }
  }
  return [...counts.entries()]
    .map(([trait, count]) => ({ trait, count }))
    .sort((a, b) => b.count - a.count)
}
