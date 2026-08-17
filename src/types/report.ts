import type { CharacterClass } from './game'

// ─── Departmental after-action reporting ──────────────────────────────────────
//
// A standard session reports on six characters. A departmental one has to
// report on up to twenty PEOPLE, which is a different question: not "how did
// the team do" but "who contributed what, and where is the bench thin."

// Raw per-participant counts as tallied from the server-side event ledger.
// Everything else in this file is derived from these plus the session itself.
export interface ParticipantTally {
  participantId:      string
  displayName:        string
  gameRole:           CharacterClass | null
  departmentName:     string | null
  turnsTaken:         number
  turnsForfeited:     number
  suggestionsOffered: number
  suggestionsAdopted: number
  disconnects:        number
}

// One person's line in the after-action report.
export interface ParticipantScorecard extends ParticipantTally {
  characterName:  string
  usesTemplate:   boolean
  level:          number
  // Rolls this person made, derived from the narrative feed by mapping each
  // roll's character id back through the seat map.
  rolls:          number
  successes:      number
  criticalHits:   number
  criticalFails:  number
  xpEarned:       number
  // turnsTaken + turnsForfeited — how often the rotation actually reached them.
  timesDrawn:     number
  // How engaged this person was, by what they did rather than by a timer.
  // Sampling true idle time would need presence polling we do not do, so this
  // deliberately measures contribution and says so in the UI.
  engagement:     'active' | 'moderate' | 'low'
}

// Whether a role has real depth or one capable person and a queue behind them.
export interface RoleBenchDepth {
  role:            CharacterClass
  staffed:         number
  // Unstaffed roles are skipped silently during play (decision D7) — but an
  // absent capability is the strongest bench finding there is, so it is still
  // reported (assumption A2).
  unstaffed:       boolean
  onOwnCharacter:  number   // people with a real character, not the role baseline
  onTemplate:      number
  neverActed:      number   // staffed, but the rotation never reached them
  turnsTaken:      number
  successRate:     number | null   // null when the role took no rolls
  highestLevel:    number
  lowestLevel:     number
}

export interface DepartmentalReport {
  scorecards:  ParticipantScorecard[]
  bench:       RoleBenchDepth[]
  // Roles nobody staffed. Duplicated out of `bench` so a reader (and the PDF)
  // can lead with it — it is the finding a training manager acts on first.
  unstaffedRoles: CharacterClass[]
  totals: {
    participants:       number
    turnsTaken:         number
    turnsForfeited:     number
    suggestionsOffered: number
    suggestionsAdopted: number
  }
}
