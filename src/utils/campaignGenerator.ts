import type { ScenarioPack } from '../types/game'
import type { SessionRecord } from '../types/history'
import { scenarioTechniques, encounteredTechniques } from './techniqueCoverage'

// ─── Campaign generator ───────────────────────────────────────────────────────
//
// Builds a ready-to-play scenario sequence from a few constraints, so a
// facilitator can have a credible campaign in seconds instead of hand-picking
// from a 144-scenario catalogue.
//
// Two things make this more than a shuffle. The catalogue is SPARSE across
// category × difficulty — AI-Enabled Threats, for instance, has nothing above
// difficulty 3 — so naive random selection dead-ends or silently returns fewer
// scenarios than asked for. And a good campaign is a RAMP, not a random spread:
// it should open on short fundamentals and close on something that hurts.

export interface GeneratorOptions {
  count:             number
  /** Category ids to draw from. Empty = the whole catalogue. */
  categories:        string[]
  minDifficulty:     number
  maxDifficulty:     number
  /** Total play time to stay within, in minutes. Null = no budget. */
  totalBudget:       number | null
  /** Reject any single scenario longer than this. Null = no cap. */
  perSessionCap:     number | null
  /** Prefer scenarios covering MITRE techniques this team has never met. */
  preferNovel:       boolean
  seed:              string
}

export interface GeneratedSlot {
  scenario:   ScenarioPack
  /** Difficulty this slot was targeting — may differ if availability forced a swap. */
  targetDifficulty: number
  /** MITRE techniques here that appear in no prior session. */
  novelTechniques:  number
}

export interface GeneratorResult {
  slots:        GeneratedSlot[]
  seed:         string
  totalMinutes: number
  /** Anything the constraints could not deliver, stated plainly. */
  notes:        string[]
}

// ── Seeded RNG ───────────────────────────────────────────────────────────────
// Deterministic so a facilitator who regenerates before saving can get the same
// campaign back, and so a draw can be reproduced from the seed alone.
function hashSeed(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function newSeed(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

function shuffled<T>(items: T[], rand: () => number): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── Difficulty ramp ──────────────────────────────────────────────────────────
/**
 * How many slots each difficulty gets.
 *
 * Weighted toward the low end rather than spread evenly: a team needs more
 * repetitions of the fundamentals than of the set-piece disasters, and the
 * catalogue is shaped the same way (far more Novice than Elite scenarios), so
 * an even split would routinely ask for Elite scenarios that do not exist.
 *
 * `available` clamps the ask to reality; anything that will not fit spills to
 * the nearest difficulty that has room.
 */
export function difficultyRamp(
  count: number, lo: number, hi: number, available: Record<number, number>,
): Record<number, number> {
  const levels = []
  for (let d = lo; d <= hi; d++) levels.push(d)
  if (levels.length === 0) return {}

  const weights = levels.map((d) => hi - d + 1)
  const totalWeight = weights.reduce((a, b) => a + b, 0)

  const want: Record<number, number> = {}
  let assigned = 0
  levels.forEach((d, i) => {
    const n = Math.floor((count * weights[i]) / totalWeight)
    want[d] = n
    assigned += n
  })
  // Rounding leaves a remainder; give it to the easiest levels first.
  for (let i = 0; assigned < count; i = (i + 1) % levels.length) {
    want[levels[i]]++
    assigned++
  }

  // Clamp to what exists, then redistribute the overflow to whichever level
  // still has spare scenarios — nearest first, so the ramp stays recognisable.
  let overflow = 0
  for (const d of levels) {
    const room = available[d] ?? 0
    if (want[d] > room) { overflow += want[d] - room; want[d] = room }
  }
  while (overflow > 0) {
    const candidate = levels
      .filter((d) => want[d] < (available[d] ?? 0))
      .sort((a, b) => a - b)[0]
    if (candidate === undefined) break   // the catalogue simply has no more
    want[candidate]++
    overflow--
  }
  return want
}

// ── Selection ────────────────────────────────────────────────────────────────
export function generateCampaign(
  catalogue: ScenarioPack[],
  history:   SessionRecord[],
  opts:      GeneratorOptions,
): GeneratorResult {
  const rand = mulberry32(hashSeed(opts.seed))
  const notes: string[] = []

  const wantedCategories = opts.categories.length > 0 ? new Set(opts.categories) : null
  let pool = catalogue.filter((s) =>
    (!wantedCategories || wantedCategories.has(s.category ?? '')) &&
    s.difficulty >= opts.minDifficulty && s.difficulty <= opts.maxDifficulty)

  if (opts.perSessionCap !== null) {
    const before = pool.length
    pool = pool.filter((s) => s.estimatedMinutes <= opts.perSessionCap!)
    const removed = before - pool.length
    if (removed > 0) {
      notes.push(`${removed} scenario${removed === 1 ? '' : 's'} excluded for running longer than ${opts.perSessionCap} minutes.`)
    }
  }

  if (pool.length === 0) {
    return { slots: [], seed: opts.seed, totalMinutes: 0,
      notes: [...notes, 'No scenarios match these constraints. Widen the difficulty range, the categories, or the per-session cap.'] }
  }
  if (pool.length < opts.count) {
    notes.push(`Only ${pool.length} scenario${pool.length === 1 ? '' : 's'} match these constraints, so the campaign is shorter than the ${opts.count} requested.`)
  }

  const seen = opts.preferNovel ? encounteredTechniques(history) : new Set<string>()
  const playedIds = new Set(history.map((r) => r.scenarioId))
  const novelCount = (s: ScenarioPack) =>
    scenarioTechniques(s).filter((t) => !seen.has(t.id)).length

  const available: Record<number, number> = {}
  for (const s of pool) available[s.difficulty] = (available[s.difficulty] ?? 0) + 1
  const ramp = difficultyRamp(Math.min(opts.count, pool.length), opts.minDifficulty, opts.maxDifficulty, available)

  // Round-robin the categories so no single one dominates a draw.
  const categoriesInPool = [...new Set(pool.map((s) => s.category ?? ''))]
  const categoryUse = new Map<string, number>(categoriesInPool.map((c) => [c, 0]))

  const chosen: GeneratedSlot[] = []
  const usedIds = new Set<string>()
  const usedTitles = new Set<string>()
  let minutes = 0

  // Hardest first: those cells have the fewest candidates, and filling them
  // last is what makes a naive solver dead-end.
  const targets: number[] = []
  for (const d of Object.keys(ramp).map(Number).sort((a, b) => b - a)) {
    for (let i = 0; i < ramp[d]; i++) targets.push(d)
  }

  for (const target of targets) {
    let candidates = pool.filter((s) =>
      s.difficulty === target && !usedIds.has(s.id) &&
      // Two scenarios in the catalogue share a title; having both in one
      // campaign makes a session list ambiguous to whoever runs it.
      !usedTitles.has(s.title.toLowerCase()))
    if (candidates.length === 0) continue

    // Budget pressure: once the remaining allowance is tight, prefer the
    // scenarios that still fit rather than blowing through it and reporting a
    // failure afterwards.
    if (opts.totalBudget !== null) {
      const slotsLeft = targets.length - chosen.length
      const room = opts.totalBudget - minutes
      const fitting = candidates.filter((s) => s.estimatedMinutes <= room / Math.max(1, slotsLeft) * 1.5)
      if (fitting.length > 0) candidates = fitting
    }

    const ranked = shuffled(candidates, rand).sort((a, b) => {
      // Least-used category first, so coverage spreads without being rigid.
      const catDelta = (categoryUse.get(a.category ?? '') ?? 0) - (categoryUse.get(b.category ?? '') ?? 0)
      if (catDelta !== 0) return catDelta
      if (opts.preferNovel) {
        const novelDelta = novelCount(b) - novelCount(a)
        if (novelDelta !== 0) return novelDelta
        // A scenario this team has never played beats one they have.
        const playedDelta = Number(playedIds.has(a.id)) - Number(playedIds.has(b.id))
        if (playedDelta !== 0) return playedDelta
      }
      return 0
    })

    const pick = ranked[0]
    usedIds.add(pick.id)
    usedTitles.add(pick.title.toLowerCase())
    categoryUse.set(pick.category ?? '', (categoryUse.get(pick.category ?? '') ?? 0) + 1)
    minutes += pick.estimatedMinutes
    chosen.push({ scenario: pick, targetDifficulty: target, novelTechniques: novelCount(pick) })
  }

  // A campaign is a ramp — present it as one regardless of the fill order.
  chosen.sort((a, b) => a.scenario.difficulty - b.scenario.difficulty
    || a.scenario.estimatedMinutes - b.scenario.estimatedMinutes
    || a.scenario.title.localeCompare(b.scenario.title))

  if (chosen.length < opts.count && pool.length >= opts.count) {
    notes.push(`Selected ${chosen.length} of ${opts.count}: the remaining slots had no scenario left at the required difficulty.`)
  }
  if (opts.totalBudget !== null && minutes > opts.totalBudget) {
    notes.push(`Runs ${minutes - opts.totalBudget} minutes over the ${opts.totalBudget}-minute budget — the shortest available scenarios at these difficulties still add up to ${minutes}.`)
  }

  return { slots: chosen, seed: opts.seed, totalMinutes: minutes, notes }
}

/**
 * Replaces one slot with a different scenario at the same difficulty, leaving
 * the rest of the draw alone — a facilitator with thirteen good picks and two
 * wrong ones should not have to reroll the thirteen.
 */
export function rerollSlot(
  catalogue: ScenarioPack[],
  current:   GeneratedSlot[],
  index:     number,
  opts:      GeneratorOptions,
): GeneratedSlot[] {
  const slot = current[index]
  if (!slot) return current
  const wantedCategories = opts.categories.length > 0 ? new Set(opts.categories) : null
  const takenIds = new Set(current.map((s) => s.scenario.id))
  const takenTitles = new Set(current.filter((_, i) => i !== index).map((s) => s.scenario.title.toLowerCase()))

  const candidates = catalogue.filter((s) =>
    s.difficulty === slot.scenario.difficulty &&
    (!wantedCategories || wantedCategories.has(s.category ?? '')) &&
    (opts.perSessionCap === null || s.estimatedMinutes <= opts.perSessionCap) &&
    !takenIds.has(s.id) && !takenTitles.has(s.title.toLowerCase()))
  if (candidates.length === 0) return current

  // Seeded on the slot so repeated clicks walk the alternatives rather than
  // landing on the same replacement every time.
  const rand = mulberry32(hashSeed(`${opts.seed}:${index}:${slot.scenario.id}`))
  const pick = shuffled(candidates, rand)[0]
  const next = [...current]
  next[index] = { ...slot, scenario: pick }
  // Substituted in place, deliberately NOT re-sorted. The replacement has the
  // same difficulty, so the ramp still holds; re-sorting would let a different
  // runtime shuffle its neighbours and the facilitator would watch four rows
  // move when they asked to change one — which is precisely what rerolling a
  // single slot exists to avoid.
  return next
}
