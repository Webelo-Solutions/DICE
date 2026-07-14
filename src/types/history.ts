import type { SessionResult, LearningPathItem, LearningPriority, FeedEntry } from './game'

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
}

export interface GapFrequency {
  area:           string
  count:          number           // number of sessions this gap appeared in
  priority:       LearningPriority // highest priority seen across those sessions
  recommendation: string           // from the most recent session
  nistRef:        string
  lastSeen:       number           // Unix ms of most recent session
}
