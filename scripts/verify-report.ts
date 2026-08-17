// Verifies the departmental after-action report — run with `npm run verify:report`.
//
// The builder joins three sources that each know something the others do not
// (the event ledger, the seat map, the narrative feed), and its output is what
// a training manager acts on. A mis-join here does not crash anything — it just
// quietly credits the wrong person, which is worse.
import { buildDepartmentalReport, benchWarnings } from '../src/utils/departmentalReport'
import { makeDefaultCharacter } from '../src/data/classDefaults'
import type { GameSession, FeedEntry, SessionResult, DepartmentalSeat, Character } from '../src/types/game'
import type { ParticipantTally } from '../src/types/report'

let failures = 0
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail && !ok ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

// Cara brought her own Analyst; Ben and Gia are on the role baseline. Hunter is
// staffed by Dev alone. Responder, Engineer, Intel and Commander are unstaffed.
const cara: Character = { ...makeDefaultCharacter('char-cara', 'Vex', 'Analyst'), level: 3 }
const ben  = makeDefaultCharacter('tmpl:p-ben', 'Ben Okafor', 'Analyst')
const gia  = makeDefaultCharacter('tmpl:p-gia', 'Gia Marsh', 'Analyst')
const dev  = makeDefaultCharacter('tmpl:p-dev', 'Dev Rao', 'Hunter')

const seats: DepartmentalSeat[] = [
  { participantId: 'p-cara', characterId: cara.id, gameRole: 'Analyst', displayName: 'Cara Nolan', usesTemplate: false },
  { participantId: 'p-ben',  characterId: ben.id,  gameRole: 'Analyst', displayName: 'Ben Okafor', usesTemplate: true },
  { participantId: 'p-gia',  characterId: gia.id,  gameRole: 'Analyst', displayName: 'Gia Marsh',  usesTemplate: true },
  { participantId: 'p-dev',  characterId: dev.id,  gameRole: 'Hunter',  displayName: 'Dev Rao',    usesTemplate: true },
]

const session = {
  id: 's1', players: [cara, ben, gia, dev], seats, mode: 'departmental',
} as unknown as GameSession

const roll = (charId: string, outcome: FeedEntry['outcome']): FeedEntry => ({
  id: `${charId}-${Math.random()}`, type: 'roll_result', speaker: charId, text: '', timestamp: 0,
  roll: { player: charId, raw: 10, modifier: 5, total: 15, dc: 12, outcome: outcome! },
})

const feed: FeedEntry[] = [
  roll(cara.id, 'success'), roll(cara.id, 'critical_hit'), roll(cara.id, 'failure'),
  roll(ben.id, 'failure'),  roll(ben.id, 'critical_fail'),
  roll(dev.id, 'success'),
]

const result = {
  xpByPlayer: { [cara.id]: 210, [ben.id]: 90, [gia.id]: 0, [dev.id]: 120 },
} as unknown as SessionResult

const tallies: ParticipantTally[] = [
  { participantId: 'p-cara', displayName: 'Cara Nolan', gameRole: 'Analyst', departmentName: 'Blue Team',
    turnsTaken: 3, turnsForfeited: 0, suggestionsOffered: 2, suggestionsAdopted: 1, disconnects: 0 },
  { participantId: 'p-ben', displayName: 'Ben Okafor', gameRole: 'Analyst', departmentName: 'Blue Team',
    turnsTaken: 2, turnsForfeited: 2, suggestionsOffered: 0, suggestionsAdopted: 0, disconnects: 3 },
  { participantId: 'p-gia', displayName: 'Gia Marsh', gameRole: 'Analyst', departmentName: 'Blue Team',
    turnsTaken: 0, turnsForfeited: 0, suggestionsOffered: 5, suggestionsAdopted: 4, disconnects: 0 },
  { participantId: 'p-dev', displayName: 'Dev Rao', gameRole: 'Hunter', departmentName: null,
    turnsTaken: 1, turnsForfeited: 0, suggestionsOffered: 0, suggestionsAdopted: 0, disconnects: 0 },
]

const report = buildDepartmentalReport(session, feed, result, tallies)
const card = (id: string) => report.scorecards.find((s) => s.participantId === id)!
const bench = (role: string) => report.bench.find((b) => b.role === role)!

console.log('')

// ── Rolls must reach the right person through the seat map ──
check('rolls are attributed through the seat map',
  card('p-cara').rolls === 3 && card('p-ben').rolls === 2 && card('p-dev').rolls === 1,
  `cara=${card('p-cara').rolls} ben=${card('p-ben').rolls} dev=${card('p-dev').rolls}`)
check('a critical hit counts as a success',
  card('p-cara').successes === 2 && card('p-cara').criticalHits === 1,
  `successes=${card('p-cara').successes} crits=${card('p-cara').criticalHits}`)
check('critical fails are counted separately', card('p-ben').criticalFails === 1)
check('someone who never rolled shows zero, not a crash', card('p-gia').rolls === 0)

// ── Template seats earn no persisted XP (D5) ──
check('own-character seats report their XP', card('p-cara').xpEarned === 210)
check('baseline seats report no XP even when the engine awarded some',
  card('p-ben').xpEarned === 0, String(card('p-ben').xpEarned))

// ── Drawn vs taken ──
check('timesDrawn is turns taken plus forfeited',
  card('p-ben').timesDrawn === 4 && card('p-cara').timesDrawn === 3,
  `ben=${card('p-ben').timesDrawn}`)
check('someone never reached by the rotation shows zero drawn', card('p-gia').timesDrawn === 0)

// ── Engagement reflects contribution, not turns handed out ──
check('a busy actor reads as active', card('p-cara').engagement === 'active', card('p-cara').engagement)
check('someone who only ever advised still reads as active',
  card('p-gia').engagement === 'active', card('p-gia').engagement)
check('forfeiting half your turns with no advice reads as low',
  card('p-ben').engagement === 'low', card('p-ben').engagement)

// ── Bench depth ──
check('unstaffed roles are still reported (assumption A2)',
  report.unstaffedRoles.length === 4 && report.unstaffedRoles.includes('Commander'),
  report.unstaffedRoles.join(','))
check('all six roles appear in the bench table', report.bench.length === 6)
check('own-character vs baseline split is counted',
  bench('Analyst').onOwnCharacter === 1 && bench('Analyst').onTemplate === 2,
  `own=${bench('Analyst').onOwnCharacter} tmpl=${bench('Analyst').onTemplate}`)
check('people the rotation never reached are flagged',
  bench('Analyst').neverActed === 1, String(bench('Analyst').neverActed))
check('role success rate spans everyone in the role',
  bench('Analyst').successRate === 2 / 5, String(bench('Analyst').successRate))
check('a role that took no rolls reports null, not NaN',
  bench('Commander').successRate === null, String(bench('Commander').successRate))
check('level spread is reported across the role',
  bench('Analyst').lowestLevel === 1 && bench('Analyst').highestLevel === 3,
  `${bench('Analyst').lowestLevel}-${bench('Analyst').highestLevel}`)

// ── Warnings are the actionable output ──
const warnings = benchWarnings(report.bench)
check('an unstaffed role produces a warning',
  warnings.some((w) => w.startsWith('Commander was unstaffed')), warnings.join(' | '))
check('a role one-deep on real characters is flagged',
  warnings.some((w) => w.includes('only one on a character of their own')))
check('people who never got a turn are flagged',
  warnings.some((w) => w.includes('never got a turn')))

// ── Totals and ordering ──
check('totals sum the per-person counts',
  report.totals.turnsTaken === 6 && report.totals.turnsForfeited === 2
  && report.totals.suggestionsOffered === 7 && report.totals.suggestionsAdopted === 5,
  JSON.stringify(report.totals))
check('scorecards are ordered by contribution',
  report.scorecards[0].participantId === 'p-gia' || report.scorecards[0].participantId === 'p-cara',
  report.scorecards.map((s) => s.displayName).join(' > '))

console.log(failures === 0 ? '\nDepartmental report holds.\n' : `\n${failures} FAILED\n`)
process.exit(failures === 0 ? 0 : 1)
