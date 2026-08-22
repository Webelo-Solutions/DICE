import type { ScenarioPack, GameSession, FeedEntry, SessionResult } from './game'
import type { OrgProfile } from './orgProfile'

// ─── Custom Scenario ──────────────────────────────────────────────────────────

export interface CustomScenario extends ScenarioPack {
  isCustom:  true
  createdAt: number
  updatedAt: number
  // Admin-authored/curated, visible to every user regardless of owner or pack
  // provenance (see server/db/schema.ts customScenarios.isGlobal). Absent/false
  // for ordinary player-authored scenarios.
  isGlobal?: boolean
}

// ─── Save Slot ────────────────────────────────────────────────────────────────

export interface SaveSlot {
  id:          string
  name:        string          // user-given or auto-generated label
  campaignId?: string          // linked campaign if applicable
  savedAt:     number          // Unix ms
  session:     GameSession     // full session snapshot
  feed:        FeedEntry[]     // full narrative history
}

// ─── Campaign ─────────────────────────────────────────────────────────────────

export type CampaignStatus = 'draft' | 'active' | 'completed' | 'abandoned'

// One entry per scenario played to completion within a campaign, keyed by its
// position in scenarioSequence (not just scenarioId) so a scenario repeated
// later in the sequence, or replayed, has its own distinct record.
export interface CampaignScenarioResult {
  scenarioIndex: number
  scenarioId:    string
  outcome:       SessionResult['outcome']
  completedAt:   number
  // Play-time provenance, written at completion from the session that produced
  // this result. Absent on results recorded before these fields existed; the
  // completion certificate backfills those from session history by scenario id
  // (see src/utils/campaignCertificate.ts) rather than inventing a duration.
  sessionId?:    string
  startedAt?:    number
  endedAt?:      number
}

export interface Campaign {
  id:                     string
  name:                   string
  description:            string
  scenarioSequence:       string[]   // ordered scenario IDs (built-in or custom)
  characterIds:           string[]   // roster character IDs assigned to this campaign
  status:                 CampaignStatus
  currentScenarioIndex:   number
  scenarioResults:        CampaignScenarioResult[]
  notes:                  string
  orgProfile?:            OrgProfile   // tech stack profile; optional so legacy campaigns load
  createdAt:              number
  updatedAt:              number
}
