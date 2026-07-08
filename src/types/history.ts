import type { SessionResult, LearningPathItem, LearningPriority } from './game'

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
}

export interface GapFrequency {
  area:           string
  count:          number           // number of sessions this gap appeared in
  priority:       LearningPriority // highest priority seen across those sessions
  recommendation: string           // from the most recent session
  nistRef:        string
  lastSeen:       number           // Unix ms of most recent session
}
