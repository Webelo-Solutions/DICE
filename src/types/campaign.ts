import type { ScenarioPack, GameSession, FeedEntry } from './game'
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

export interface Campaign {
  id:                     string
  name:                   string
  description:            string
  scenarioSequence:       string[]   // ordered scenario IDs (built-in or custom)
  characterIds:           string[]   // roster character IDs assigned to this campaign
  status:                 CampaignStatus
  currentScenarioIndex:   number
  completedScenarioIds:   string[]
  notes:                  string
  orgProfile?:            OrgProfile   // tech stack profile; optional so legacy campaigns load
  createdAt:              number
  updatedAt:              number
}
