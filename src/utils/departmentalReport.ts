import { GAME_ROLES } from '../types/room'
import type { GameSession, FeedEntry, SessionResult, CharacterClass } from '../types/game'
import type { ParticipantTally, ParticipantScorecard, RoleBenchDepth, DepartmentalReport } from '../types/report'

// Builds the departmental after-action report by joining three sources that
// each know something the others do not:
//   the event ledger  — who was drawn, who forfeited, who advised whom
//   the session       — who sat in which seat, on whose sheet, at what level
//   the narrative feed — how the rolls actually went
//
// None of them can answer the report's questions alone: the feed cannot see a
// suggestion nobody took, and the ledger cannot see whether a roll succeeded.

// Deliberately does NOT consider disconnects. A bad connection is not
// disengagement, and folding network trouble into a judgement about a named
// employee's participation would be unfair and indefensible. Drop counts are
// reported as their own column so a reader can weigh them knowingly.
function engagementBand(turnsTaken: number, offered: number, timesDrawn: number): ParticipantScorecard['engagement'] {
  const contributions = turnsTaken + offered
  if (contributions === 0) return 'low'
  // Someone the rotation reached repeatedly who let half or more of those turns
  // lapse, and never advised anyone either, is not engaged — however many turns
  // they happened to be handed.
  if (timesDrawn > 0 && turnsTaken / timesDrawn <= 0.5 && offered === 0) return 'low'
  if (contributions >= 4) return 'active'
  return contributions >= 2 ? 'moderate' : 'low'
}

export function buildDepartmentalReport(
  session: GameSession,
  feed:    FeedEntry[],
  result:  SessionResult,
  tallies: ParticipantTally[],
): DepartmentalReport {
  const seats = session.seats ?? []
  const byCharacterId = new Map(session.players.map((p) => [p.id, p]))

  // Roll outcomes are attributed to a CHARACTER in the feed; the seat map is
  // what turns that back into a person.
  const rollsByCharacter = new Map<string, { rolls: number; successes: number; crits: number; fails: number }>()
  for (const entry of feed) {
    if (entry.type !== 'roll_result' || !entry.roll) continue
    const charId = entry.roll.player
    const acc = rollsByCharacter.get(charId) ?? { rolls: 0, successes: 0, crits: 0, fails: 0 }
    acc.rolls++
    if (entry.roll.outcome === 'success' || entry.roll.outcome === 'critical_hit') acc.successes++
    if (entry.roll.outcome === 'critical_hit')  acc.crits++
    if (entry.roll.outcome === 'critical_fail') acc.fails++
    rollsByCharacter.set(charId, acc)
  }

  const scorecards: ParticipantScorecard[] = seats.map((seat) => {
    const tally = tallies.find((t) => t.participantId === seat.participantId)
    const character = byCharacterId.get(seat.characterId)
    const rolls = rollsByCharacter.get(seat.characterId) ?? { rolls: 0, successes: 0, crits: 0, fails: 0 }
    const turnsTaken     = tally?.turnsTaken ?? 0
    const turnsForfeited = tally?.turnsForfeited ?? 0
    const offered        = tally?.suggestionsOffered ?? 0
    const timesDrawn     = turnsTaken + turnsForfeited

    return {
      participantId:      seat.participantId,
      displayName:        seat.displayName,
      gameRole:           seat.gameRole,
      departmentName:     tally?.departmentName ?? null,
      turnsTaken,
      turnsForfeited,
      suggestionsOffered: offered,
      suggestionsAdopted: tally?.suggestionsAdopted ?? 0,
      disconnects:        tally?.disconnects ?? 0,
      characterName:      character?.name ?? seat.displayName,
      usesTemplate:       seat.usesTemplate,
      level:              character?.level ?? 1,
      rolls:              rolls.rolls,
      successes:          rolls.successes,
      criticalHits:       rolls.crits,
      criticalFails:      rolls.fails,
      // Baseline seats earn no persisted XP (decision D5), so reporting the
      // number they notionally accrued would imply progression that never
      // reaches their roster.
      xpEarned:           seat.usesTemplate ? 0 : (result.xpByPlayer[seat.characterId] ?? 0),
      timesDrawn,
      engagement:         engagementBand(turnsTaken, offered, timesDrawn),
    }
  })

  // Every role is reported, including ones nobody staffed — those are skipped
  // silently in play, which is exactly why the report has to name them.
  const bench: RoleBenchDepth[] = GAME_ROLES.map((role) => {
    const inRole = scorecards.filter((s) => s.gameRole === role)
    const rolls     = inRole.reduce((n, s) => n + s.rolls, 0)
    const successes = inRole.reduce((n, s) => n + s.successes, 0)
    const levels    = inRole.map((s) => s.level)
    return {
      role,
      staffed:        inRole.length,
      unstaffed:      inRole.length === 0,
      onOwnCharacter: inRole.filter((s) => !s.usesTemplate).length,
      onTemplate:     inRole.filter((s) => s.usesTemplate).length,
      neverActed:     inRole.filter((s) => s.timesDrawn === 0).length,
      turnsTaken:     inRole.reduce((n, s) => n + s.turnsTaken, 0),
      successRate:    rolls > 0 ? successes / rolls : null,
      highestLevel:   levels.length ? Math.max(...levels) : 0,
      lowestLevel:    levels.length ? Math.min(...levels) : 0,
    }
  })

  return {
    scorecards: [...scorecards].sort((a, b) =>
      (b.turnsTaken + b.suggestionsOffered) - (a.turnsTaken + a.suggestionsOffered)
      || a.displayName.localeCompare(b.displayName)),
    bench,
    unstaffedRoles: bench.filter((b) => b.unstaffed).map((b) => b.role),
    totals: {
      participants:       scorecards.length,
      turnsTaken:         scorecards.reduce((n, s) => n + s.turnsTaken, 0),
      turnsForfeited:     scorecards.reduce((n, s) => n + s.turnsForfeited, 0),
      suggestionsOffered: scorecards.reduce((n, s) => n + s.suggestionsOffered, 0),
      suggestionsAdopted: scorecards.reduce((n, s) => n + s.suggestionsAdopted, 0),
    },
  }
}

// A role with exactly one person on a real character is a single point of
// failure however many people are nominally staffing it.
export function benchWarnings(bench: RoleBenchDepth[]): string[] {
  const warnings: string[] = []
  for (const row of bench) {
    if (row.unstaffed) {
      warnings.push(`${row.role} was unstaffed — that capability was absent from the incident entirely.`)
      continue
    }
    if (row.onOwnCharacter === 0) {
      warnings.push(`${row.role} was staffed entirely by people on the standard sheet — nobody is building depth in it.`)
    } else if (row.onOwnCharacter === 1 && row.staffed > 1) {
      warnings.push(`${row.role} has ${row.staffed} people but only one on a character of their own.`)
    }
    if (row.neverActed > 0) {
      warnings.push(`${row.neverActed} of ${row.staffed} in ${row.role} never got a turn.`)
    }
  }
  return warnings
}

export function roleOf(report: DepartmentalReport, role: CharacterClass): RoleBenchDepth | undefined {
  return report.bench.find((b) => b.role === role)
}
