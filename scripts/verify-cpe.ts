// Verifies the ISC² CPE calculation — run with `npm run verify:cpe`.
//
// A credit number goes onto a certificate that someone submits to ISC² against
// a credential they hold. Nothing here crashes when it is wrong; it just prints
// a number that cannot be defended, which is the worse failure. The arithmetic,
// the attendance reconstruction and the rounding direction are all pinned here.
import {
  creditsForMinutes, attendedMinutes, buildSessionCpeReport, buildCpeLedger,
  MINUTES_PER_CREDIT, CREDIT_INCREMENT,
} from '../src/utils/cpe'
import type { ParticipantTally } from '../src/types/report'
import type { SessionCpeReport } from '../src/types/cpe'

let failures = 0
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail && !ok ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

const MIN = 60_000
const T0 = 1_760_000_000_000          // session start
const T = (minutes: number) => T0 + minutes * MIN

// ── The rules themselves ─────────────────────────────────────────────────────
console.log('\nISC² rules')
check('one credit per hour', MINUTES_PER_CREDIT === 60)
check('half-credit increments', CREDIT_INCREMENT === 0.5)

// ── Minutes to credits ───────────────────────────────────────────────────────
console.log('\nCredit arithmetic')
check('a full hour is one credit', creditsForMinutes(60) === 1)
check('90 minutes is 1.5', creditsForMinutes(90) === 1.5)
check('three hours is three', creditsForMinutes(180) === 3)
check('29 minutes earns nothing', creditsForMinutes(29) === 0)
check('30 minutes earns a half credit', creditsForMinutes(30) === 0.5)
// The rounding direction is the whole defensibility argument: never credit
// time that was not attended.
check('59 minutes rounds down to 0.5, not up to 1', creditsForMinutes(59) === 0.5)
check('119 minutes rounds down to 1.5', creditsForMinutes(119) === 1.5)
check('zero is zero', creditsForMinutes(0) === 0)
check('negative time is zero, not negative credit', creditsForMinutes(-30) === 0)
check('nonsense input is zero', creditsForMinutes(NaN) === 0)
// Floats: 0.5-steps summed naively drift, and a certificate reading 2.9999999
// would be indefensible.
check('no float dust on the result', Number.isInteger(creditsForMinutes(90) * 2))

// ── Attendance reconstruction ────────────────────────────────────────────────
console.log('\nAttendance measurement')
const window = { from: T0, to: T(120) }

check('a span covering the whole session is the whole session',
  attendedMinutes([{ from: T0, to: T(120) }], window.from, window.to) === 120)

check('time before the session started does not count',
  attendedMinutes([{ from: T(-45), to: T(60) }], window.from, window.to) === 60)

check('time after the session ended does not count',
  attendedMinutes([{ from: T(60), to: T(300) }], window.from, window.to) === 60)

check('two separate stretches add up',
  attendedMinutes([{ from: T0, to: T(30) }, { from: T(60), to: T(90) }], window.from, window.to) === 60)

// Two tabs open, or a reconnect logged before the drop it replaces. Double
// counting here would silently inflate someone's credit.
check('overlapping spans are not counted twice',
  attendedMinutes([{ from: T0, to: T(60) }, { from: T(30), to: T(90) }], window.from, window.to) === 90)

check('a span entirely outside the window contributes nothing',
  attendedMinutes([{ from: T(200), to: T(260) }], window.from, window.to) === 0)

check('no spans is no attendance',
  attendedMinutes([], window.from, window.to) === 0)

check('an empty window is zero, not negative',
  attendedMinutes([{ from: T0, to: T(60) }], T(60), T0) === 0)

// ── The session report ───────────────────────────────────────────────────────
console.log('\nSession CPE report')
const tally = (id: string, name: string, presence: Array<{ from: number; to: number }>, extra: Partial<ParticipantTally> = {}): ParticipantTally => ({
  participantId: id, displayName: name, gameRole: 'Analyst', departmentName: 'SOC',
  turnsTaken: 0, turnsForfeited: 0, suggestionsOffered: 0, suggestionsAdopted: 0,
  disconnects: 0, presence, ...extra,
})

const report = buildSessionCpeReport('Operation Blackout', T0, T(120), [
  // Stayed the whole way.
  tally('p-ana', 'Ana Reyes', [{ from: T0, to: T(120) }], { ownerUserId: 'u-ana' }),
  // Dropped at the halfway mark and came back for the last twenty minutes: 80
  // minutes present, so 1.0 after rounding down from 1.33.
  tally('p-ben', 'Ben Okafor', [{ from: T0, to: T(60) }, { from: T(100), to: T(120) }], { ownerUserId: 'u-ben', disconnects: 1 }),
  // Looked in for ten minutes.
  tally('p-gia', 'Gia Marsh', [{ from: T0, to: T(10) }], { ownerUserId: 'u-gia' }),
  // Never connected at all.
  tally('p-dev', 'Dev Rao', [], { ownerUserId: 'u-dev' }),
])

const award = (id: string) => report.awards.find((a) => a.participantId === id)!
check('a full attendee earns the session length', award('p-ana').credits === 2, String(award('p-ana').credits))
check('a partial attendee earns only their time', award('p-ben').credits === 1, String(award('p-ben').credits))
check('their measured minutes are reported, not the session length',
  award('p-ben').attendedMinutes === 80, String(award('p-ben').attendedMinutes))
check('a fragmented attendance reports its connection count', award('p-ben').spans === 2, String(award('p-ben').spans))
check('a brief look-in earns nothing', award('p-gia').credits === 0)
check('someone who never connected earns nothing', award('p-dev').credits === 0)
check('an absent person still appears, rather than vanishing from the report',
  report.awards.length === 4)
check('awards are ordered by credit', report.awards[0].participantId === 'p-ana')
check('everything is Group A', report.awards.every((a) => a.group === 'A'))
check('the session length is recorded for context', report.sessionMinutes === 120)
check('the activity is named for the certificate', report.activityTitle === 'Operation Blackout')
// Recorded on the report so an old certificate still explains its own number
// after the constants are revised.
check('the rules used are stored on the report',
  report.rules.minutesPerCredit === 60 && report.rules.creditIncrement === 0.5 && report.rules.rounding === 'floor')

// ── The ledger ───────────────────────────────────────────────────────────────
console.log('\nCPE ledger')
const yearStart = T0 - 30 * 24 * 60 * MIN     // the sessions below are "this year"
const older: SessionCpeReport = {
  ...buildSessionCpeReport('Prior Exercise', T0 - 400 * 24 * 60 * MIN, T0 - 400 * 24 * 60 * MIN + 90 * MIN, [
    tally('p-ana-2', 'Ana Reyes', [{ from: T0 - 400 * 24 * 60 * MIN, to: T0 - 400 * 24 * 60 * MIN + 90 * MIN }], { ownerUserId: 'u-ana' }),
  ]),
}
const ledger = buildCpeLedger(
  [{ id: 's1', cpe: report }, { id: 's0', cpe: older }, { id: 's-standard' }],
  yearStart,
)

const ana = ledger.find((e) => e.ownerUserId === 'u-ana')!
check('credits accumulate across sessions for one person', ana.totalCredits === 3.5, String(ana.totalCredits))
check('the year-to-date figure excludes last year', ana.creditsThisYear === 2, String(ana.creditsThisYear))
check('sessions attended is counted', ana.sessionsAttended === 2)
check('the per-session detail is carried for certificates', ana.sessions.length === 2)
check('session detail is newest first', ana.sessions[0].sessionId === 's1')
// Grouping by account, not by display name: the same person typing their name
// differently must not split into two rows.
check('a person is keyed by account', ana.key === 'u-ana')
check('people who earned nothing are left out', !ledger.some((e) => e.attendeeName === 'Dev Rao'))
check('a session with no CPE block contributes nothing', ledger.every((e) => e.sessions.every((s) => s.sessionId !== 's-standard')))
check('the ledger is ordered by total credit', ledger[0].ownerUserId === 'u-ana')
check('float dust does not accumulate across many sessions',
  buildCpeLedger(Array.from({ length: 7 }, (_, i) => ({
    id: `many-${i}`,
    cpe: buildSessionCpeReport('Repeat', T0, T(30), [tally('p-x', 'Repeat Attendee', [{ from: T0, to: T(30) }], { ownerUserId: 'u-x' })]),
  })), yearStart)[0].totalCredits === 3.5)

console.log(failures === 0 ? '\nCPE calculation holds.\n' : `\n${failures} FAILED\n`)
process.exit(failures === 0 ? 0 : 1)
