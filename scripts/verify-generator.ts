// Verifies the campaign generator against the real catalogue.
//   npm run verify:generator
//
// The catalogue is sparse across category x difficulty and heavily skewed
// toward the low end, so the interesting failures are all constraint failures:
// asking for more Elite scenarios than exist, a per-session cap that empties a
// difficulty band, or a category that stops at difficulty 3.
import { ALL_SCENARIOS } from '../src/data/scenarios'
import { generateCampaign, rerollSlot, difficultyRamp, newSeed } from '../src/utils/campaignGenerator'
import type { GeneratorOptions } from '../src/utils/campaignGenerator'
import type { SessionRecord } from '../src/types/history'

let failures = 0
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail && !ok ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}
const section = (t: string) => console.log(`\n${t}`)

const EIGHT = ['malware', 'ransomware', 'phishing', 'identity', 'network', 'cloud', 'insider', 'ai_fraud']
const base = (over: Partial<GeneratorOptions> = {}): GeneratorOptions => ({
  count: 15, categories: EIGHT, minDifficulty: 1, maxDifficulty: 5,
  totalBudget: null, perSessionCap: null, preferNovel: false, seed: 'TESTSEED', ...over,
})

section('Basic draw')
{
  const r = generateCampaign(ALL_SCENARIOS, [], base())
  check('returns the requested number of scenarios', r.slots.length === 15, `${r.slots.length}`)
  check('every scenario is distinct', new Set(r.slots.map((s) => s.scenario.id)).size === 15)
  check('no two scenarios share a title',
    new Set(r.slots.map((s) => s.scenario.title.toLowerCase())).size === 15,
    r.slots.map((s) => s.scenario.title).join(' | '))
  check('sorted by difficulty ascending',
    r.slots.every((s, i) => i === 0 || r.slots[i - 1].scenario.difficulty <= s.scenario.difficulty))
  check('stays within the requested categories',
    r.slots.every((s) => EIGHT.includes(s.scenario.category ?? '')))
  check('reports total minutes', r.totalMinutes > 0 && r.totalMinutes === r.slots.reduce((n, s) => n + s.scenario.estimatedMinutes, 0))
  console.log(`     ${r.slots.length} scenarios · ${Math.floor(r.totalMinutes / 60)}h ${r.totalMinutes % 60}m · difficulty ${r.slots[0].scenario.difficulty}->${r.slots[14].scenario.difficulty}`)
}

section('Determinism')
{
  const a = generateCampaign(ALL_SCENARIOS, [], base({ seed: 'ALPHA' }))
  const b = generateCampaign(ALL_SCENARIOS, [], base({ seed: 'ALPHA' }))
  const c = generateCampaign(ALL_SCENARIOS, [], base({ seed: 'BRAVO' }))
  const ids = (r: typeof a) => r.slots.map((s) => s.scenario.id).join(',')
  check('the same seed reproduces the same campaign', ids(a) === ids(b))
  check('a different seed gives a different campaign', ids(a) !== ids(c))
}

section('The ramp')
{
  const r = generateCampaign(ALL_SCENARIOS, [], base())
  const byDiff = [1, 2, 3, 4, 5].map((d) => r.slots.filter((s) => s.scenario.difficulty === d).length)
  check('spans the full requested difficulty range', byDiff[0] > 0 && byDiff[4] > 0, byDiff.join('/'))
  check('is front-loaded rather than flat (more easy than hard)', byDiff[0] >= byDiff[4], byDiff.join('/'))
  console.log(`     difficulty spread ${byDiff.join(' / ')}`)

  // The ramp helper must never ask for more than the catalogue holds.
  const clamped = difficultyRamp(20, 1, 5, { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2 })
  const total = Object.values(clamped).reduce((a, b) => a + b, 0)
  check('clamps to availability instead of over-asking', total === 10, `${total} of a possible 10`)
  check('never exceeds any level\'s availability', Object.entries(clamped).every(([, n]) => n <= 2))
}

section('Per-session cap')
{
  const r = generateCampaign(ALL_SCENARIOS, [], base({ perSessionCap: 45 }))
  check('no scenario exceeds the cap', r.slots.every((s) => s.scenario.estimatedMinutes <= 45),
    r.slots.map((s) => s.scenario.estimatedMinutes).join(','))
  check('says how many scenarios the cap excluded', r.notes.some((n) => n.includes('longer than 45 minutes')), r.notes.join(' | '))
  console.log(`     ${r.slots.length} scenarios fit under 45 min each`)
}

section('Total budget')
{
  const r = generateCampaign(ALL_SCENARIOS, [], base({ count: 8, totalBudget: 300 }))
  console.log(`     asked 8 scenarios in 300 min, got ${r.slots.length} in ${r.totalMinutes} min`)
  check('respects the budget, or says plainly that it could not',
    r.totalMinutes <= 300 || r.notes.some((n) => n.includes('over the 300-minute budget')),
    `${r.totalMinutes} min, notes: ${r.notes.join(' | ')}`)

  // An impossible budget must be reported, never silently ignored.
  const tight = generateCampaign(ALL_SCENARIOS, [], base({ count: 10, totalBudget: 30 }))
  check('an impossible budget produces an explicit note',
    tight.totalMinutes <= 30 || tight.notes.some((n) => n.includes('over the')),
    `${tight.totalMinutes} min, notes: ${tight.notes.join(' | ')}`)
}

section('Sparse and impossible constraints')
{
  // AI-Enabled Threats has nothing above difficulty 3.
  const ai = generateCampaign(ALL_SCENARIOS, [], base({ count: 5, categories: ['ai_fraud'], minDifficulty: 4, maxDifficulty: 5 }))
  check('an empty category x difficulty cell returns nothing rather than throwing', ai.slots.length === 0, `${ai.slots.length}`)
  check('and explains why', ai.notes.some((n) => n.includes('No scenarios match')), ai.notes.join(' | '))

  // More Elite scenarios than the catalogue holds.
  const elite = generateCampaign(ALL_SCENARIOS, [], base({ count: 30, minDifficulty: 5, maxDifficulty: 5 }))
  check('asking for more than exists returns what exists', elite.slots.length > 0 && elite.slots.length < 30, `${elite.slots.length}`)
  check('and says so rather than under-delivering silently',
    elite.notes.some((n) => n.includes('shorter than the 30 requested')), elite.notes.join(' | '))
  console.log(`     asked 30 Elite, catalogue holds ${elite.slots.length}`)

  const single = generateCampaign(ALL_SCENARIOS, [], base({ count: 1, categories: ['insider'] }))
  check('a single-scenario campaign works', single.slots.length === 1)
}

section('Novelty preference')
{
  // A team that has played nothing, versus one that has played the low end.
  const played: SessionRecord[] = ALL_SCENARIOS.filter((s) => s.difficulty === 1).slice(0, 12)
    .map((s) => ({ id: `h-${s.id}`, scenarioId: s.id, scenarioTitle: s.title, difficulty: s.difficulty,
      outcome: 'victory', playerCount: 4, players: [], result: {} as never, learningPath: [], playedAt: 1 }))
  const fresh   = generateCampaign(ALL_SCENARIOS, [],     base({ preferNovel: true, seed: 'NOVEL' }))
  const veteran = generateCampaign(ALL_SCENARIOS, played, base({ preferNovel: true, seed: 'NOVEL' }))
  const overlap = veteran.slots.filter((s) => played.some((p) => p.scenarioId === s.scenario.id)).length
  check('prior history changes the draw', fresh.slots.map((s) => s.scenario.id).join() !== veteran.slots.map((s) => s.scenario.id).join())
  check('avoids scenarios the team already played where it can', overlap <= 2, `${overlap} replayed`)
  check('reports novel technique counts', veteran.slots.every((s) => s.novelTechniques >= 0))
}

section('Slot reroll')
{
  const opts = base()
  const r = generateCampaign(ALL_SCENARIOS, [], opts)
  const before = r.slots.map((s) => s.scenario.id)
  const after = rerollSlot(ALL_SCENARIOS, r.slots, 3, opts)
  const changed = after.filter((s, i) => s.scenario.id !== before[i]).length
  check('rerolling one slot changes the draw', after.map((s) => s.scenario.id).join() !== before.join())
  check('and moves EXACTLY one row — the rest must not shift', changed === 1, `${changed} rows differ`)
  check('the replacement lands in the same position', after[3].scenario.id !== before[3])
  check('at the same difficulty, so the ramp still holds',
    after[3].scenario.difficulty === r.slots[3].scenario.difficulty)
  check('and the sequence is still ordered by difficulty',
    after.every((s, i) => i === 0 || after[i - 1].scenario.difficulty <= s.scenario.difficulty))
  check('never introduces a duplicate', new Set(after.map((s) => s.scenario.id)).size === after.length)
}

section('Random seeds')
{
  // Ten unseeded draws must all be valid — this is what catches a solver that
  // dead-ends only on particular orderings.
  let bad = 0
  for (let i = 0; i < 10; i++) {
    const r = generateCampaign(ALL_SCENARIOS, [], base({ seed: newSeed() }))
    if (r.slots.length !== 15 || new Set(r.slots.map((s) => s.scenario.id)).size !== 15) bad++
  }
  check('ten independent draws all produce 15 distinct scenarios', bad === 0, `${bad} bad draws`)
}

console.log(failures === 0 ? '\nCampaign generator verified.\n' : `\n${failures} FAILED\n`)
process.exit(failures === 0 ? 0 : 1)
