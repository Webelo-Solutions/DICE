// ─── ISC² CPE calculation ────────────────────────────────────────────────────
//
// Every rule that decides a credit number lives in this file, in one block, so
// there is exactly one place to check it against the handbook and one place to
// change when the handbook changes. Nothing else in the codebase should encode
// a conversion from minutes to credits.

import type { ParticipantTally } from '../types/report'
import type { CpeAward, CpeGroup, PresenceSpan, SessionCpeReport } from '../types/cpe'

// ── The rules ────────────────────────────────────────────────────────────────
//
// VERIFY THESE AGAINST THE CURRENT ISC² CPE HANDBOOK BEFORE RELYING ON THEM
// FOR A SUBMISSION. They reflect the standard reading — one credit per contact
// hour, claimed in half-credit steps — but ISC² revises the handbook, and a
// number printed on a certificate is only as good as the rule behind it.

// One CPE credit per hour of attendance.
export const MINUTES_PER_CREDIT = 60

// Credits are claimed in half-credit steps rather than to the minute.
export const CREDIT_INCREMENT = 0.5

// Always round DOWN to the increment. This is the conservative direction on
// purpose: under-claiming a half credit is a nuisance, while crediting time an
// attendee cannot be shown to have spent is an audit finding. One consequence
// worth stating plainly — a session under 30 minutes earns nothing.
export const ROUNDING: 'floor' = 'floor'

// A cyber incident-response exercise is domain-related work.
export const DEFAULT_GROUP: CpeGroup = 'A'

// Converts measured contact time into ISC² credits. Exported on its own so the
// verification suite can exercise the arithmetic directly.
export function creditsForMinutes(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return 0
  const raw = minutes / MINUTES_PER_CREDIT
  const steps = Math.floor(raw / CREDIT_INCREMENT)
  // Re-multiplying floats reintroduces the error the floor just removed, so
  // snap the result back to the increment's precision.
  return Math.round(steps * CREDIT_INCREMENT * 100) / 100
}

// ── Attendance ───────────────────────────────────────────────────────────────

// Clamps spans to the window, drops empties, and merges overlaps.
function normalizeSpans(spans: PresenceSpan[], windowFrom: number, windowTo: number): PresenceSpan[] {
  const clamped = spans
    .map((s) => ({ from: Math.max(s.from, windowFrom), to: Math.min(s.to, windowTo) }))
    .filter((s) => s.to > s.from)
    .sort((a, b) => a.from - b.from)

  const merged: PresenceSpan[] = []
  for (const span of clamped) {
    const last = merged[merged.length - 1]
    // Overlapping or touching spans become one: a participant with two tabs
    // open, or a reconnect recorded before the drop it replaces, must not be
    // credited twice for the same minute.
    if (last && span.from <= last.to) last.to = Math.max(last.to, span.to)
    else merged.push({ ...span })
  }
  return merged
}

// Total minutes of presence inside the window.
export function attendedMinutes(spans: PresenceSpan[], windowFrom: number, windowTo: number): number {
  if (windowTo <= windowFrom) return 0
  return normalizeSpans(spans, windowFrom, windowTo)
    .reduce((total, s) => total + (s.to - s.from), 0) / 60000
}

// ── Report ───────────────────────────────────────────────────────────────────

// Builds the CPE block stored on the session record. Tallies carry the presence
// spans reconstructed server-side from the participant event ledger; the window
// is the session's own start and end, so time spent connected in the lobby
// before the exercise began earns nothing.
export function buildSessionCpeReport(
  activityTitle: string,
  startedAt: number,
  endedAt: number,
  tallies: ParticipantTally[],
): SessionCpeReport {
  const awards: CpeAward[] = tallies.map((t) => {
    const spans = t.presence ?? []
    const minutes = attendedMinutes(spans, startedAt, endedAt)
    return {
      participantId:   t.participantId,
      ownerUserId:     t.ownerUserId ?? null,
      attendeeName:    t.displayName,
      gameRole:        t.gameRole,
      departmentName:  t.departmentName,
      attendedMinutes: Math.round(minutes),
      spans:           normalizeSpans(spans, startedAt, endedAt).length,
      disconnects:     t.disconnects,
      credits:         creditsForMinutes(minutes),
      group:           DEFAULT_GROUP,
    }
  })
  // Most credit first: someone reading this table is looking for who earned
  // enough to be worth submitting, not for who sorts first alphabetically.
  awards.sort((a, b) => b.credits - a.credits || b.attendedMinutes - a.attendedMinutes)

  return {
    activityTitle,
    activityDate:   endedAt,
    sessionMinutes: Math.max(0, Math.round((endedAt - startedAt) / 60000)),
    awards,
    rules: {
      minutesPerCredit: MINUTES_PER_CREDIT,
      creditIncrement:  CREDIT_INCREMENT,
      rounding:         ROUNDING,
      group:            DEFAULT_GROUP,
    },
  }
}

// ── Ledger ───────────────────────────────────────────────────────────────────

// One person's accumulated credit across every session they attended.
export interface CpeLedgerEntry {
  key:              string   // ownerUserId when known, else the display name
  attendeeName:     string
  ownerUserId:      string | null
  sessionsAttended: number
  totalCredits:     number
  totalMinutes:     number
  creditsThisYear:  number
  lastAttendedAt:   number
  // Per-session detail, newest first, so a row can be opened into the sessions
  // behind it and each certificate downloaded.
  sessions: Array<{
    sessionId:       string
    activityTitle:   string
    activityDate:    number
    participantId:   string
    attendedMinutes: number
    credits:         number
    group:           CpeGroup
  }>
}

// Rolls session records up per person. Records with no CPE block — standard and
// solo sessions, and any departmental session predating this feature —
// contribute nothing rather than appearing as zero-credit rows.
export function buildCpeLedger(
  records: Array<{ id: string; cpe?: SessionCpeReport }>,
  yearStart: number,
): CpeLedgerEntry[] {
  const byKey = new Map<string, CpeLedgerEntry>()

  for (const record of records) {
    const cpe = record.cpe
    if (!cpe) continue
    for (const award of cpe.awards) {
      // Someone credited nothing did not attend in any meaningful sense, and a
      // ledger full of zero rows buries the people who did.
      if (award.credits <= 0) continue
      // Group by account where there is one, so a person's credits accumulate
      // across sessions even if they typed their display name differently.
      const key = award.ownerUserId ?? `name:${award.attendeeName.toLowerCase()}`
      const entry = byKey.get(key) ?? {
        key,
        attendeeName:     award.attendeeName,
        ownerUserId:      award.ownerUserId,
        sessionsAttended: 0,
        totalCredits:     0,
        totalMinutes:     0,
        creditsThisYear:  0,
        lastAttendedAt:   0,
        sessions:         [],
      }
      entry.sessionsAttended += 1
      entry.totalCredits     += award.credits
      entry.totalMinutes     += award.attendedMinutes
      if (cpe.activityDate >= yearStart) entry.creditsThisYear += award.credits
      entry.lastAttendedAt = Math.max(entry.lastAttendedAt, cpe.activityDate)
      entry.sessions.push({
        sessionId:       record.id,
        activityTitle:   cpe.activityTitle,
        activityDate:    cpe.activityDate,
        participantId:   award.participantId,
        attendedMinutes: award.attendedMinutes,
        credits:         award.credits,
        group:           award.group,
      })
      byKey.set(key, entry)
    }
  }

  const entries = [...byKey.values()]
  for (const entry of entries) {
    // Float addition drifts across many half-credit sums.
    entry.totalCredits    = Math.round(entry.totalCredits * 100) / 100
    entry.creditsThisYear = Math.round(entry.creditsThisYear * 100) / 100
    entry.sessions.sort((a, b) => b.activityDate - a.activityDate)
  }
  entries.sort((a, b) => b.totalCredits - a.totalCredits || a.attendeeName.localeCompare(b.attendeeName))
  return entries
}
