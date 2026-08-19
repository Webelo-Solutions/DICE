// ─── ISC² Continuing Professional Education (CPE) ────────────────────────────
//
// A departmental exercise is a group training activity, and the people who sat
// in it can claim CPE credit for the time they spent. This models what ISC²
// asks a provider to be able to show: who attended, for how long, on what
// date, and under which activity — with the arithmetic reproducible from the
// stored record rather than recalculated by hand later.
//
// Scope note: credit is issued to departmental PARTICIPANTS only. A standard
// or solo session identifies characters, not people, so there is no attendee
// to name on a certificate.

import type { CharacterClass } from './game'

// ISC² sorts CPE into two groups. Group A is domain-related — work that maps to
// the domains of the credential being maintained. Group B is professional
// development outside those domains (management, presentation skills, and so
// on). A cyber incident-response tabletop is domain work, so DICE issues
// Group A and does not offer a way to mark it otherwise.
export type CpeGroup = 'A' | 'B'

// One person's presence during a session, as reconstructed from the
// participant event ledger. Half-open: present from `from` up to `to`.
export interface PresenceSpan {
  from: number   // Unix ms
  to:   number   // Unix ms
}

// One attendee's credit for one session — everything a certificate prints and
// everything an auditor would ask to see behind the number.
export interface CpeAward {
  participantId:  string
  // The DICE account this seat joined as, when there was one. The ledger groups
  // by this so a person's credits accumulate across sessions even if they typed
  // their display name differently each time.
  ownerUserId:    string | null
  attendeeName:   string
  gameRole:       CharacterClass | null
  departmentName: string | null

  // Attendance evidence. `attendedMinutes` is measured connected time clamped
  // to the session window — not the session's length, and not a self-report.
  attendedMinutes: number
  spans:           number   // how many separate stretches of presence
  disconnects:     number

  // The award itself.
  credits: number    // ISC² CPE credits, in CREDIT_INCREMENT steps
  group:   CpeGroup
}

export interface SessionCpeReport {
  // Denormalized onto the report so a certificate can be rendered from the
  // stored record alone, without re-reading the session.
  activityTitle:   string
  activityDate:    number   // Unix ms — session end
  sessionMinutes:  number   // the session's own length, for context
  awards:          CpeAward[]
  // The rules this report was computed under. Recorded rather than assumed:
  // if the constants below are ever revised, an old record still explains the
  // number it printed.
  rules: {
    minutesPerCredit: number
    creditIncrement:  number
    rounding:         'floor'
    group:            CpeGroup
  }
}
