import type { SessionResult, LearningPathItem, LearningPriority, FeedEntry } from './game'
import type { DepartmentalReport } from './report'

export interface SessionRecord {
  id:            string
  scenarioId:    string
  scenarioTitle: string
  difficulty:    1 | 2 | 3 | 4 | 5
  outcome:       'victory' | 'partial' | 'defeat'
  playerCount:   number
  players:       { id: string; name: string; class: string }[]
  result:        SessionResult
  learningPath:  LearningPathItem[]
  playedAt:      number   // Unix ms — result.endedAt
  // Full narrative transcript at the moment the session ended — persisted so
  // after-action reports and exports can include the timeline later, not just
  // the summary. Optional: records written before this field existed have none.
  feed?:         FeedEntry[]
  // Per-person contribution and bench-depth findings. Present only for
  // departmental sessions — a standard session reports on six characters, not
  // on twenty people, and has nothing to put here. Built at session end
  // because it needs the server-side event ledger, which the client cannot
  // reconstruct afterwards.
  departmental?: DepartmentalReport
}

export interface GapFrequency {
  area:           string
  count:          number           // number of sessions this gap appeared in
  priority:       LearningPriority // highest priority seen across those sessions
  recommendation: string           // from the most recent session
  nistRef:        string
  lastSeen:       number           // Unix ms of most recent session
}
