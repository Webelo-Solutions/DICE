import type { NPCRole } from './npc'
import { NPC_ROLES } from './npc'

// Every NPC role at zero carry-forward — the canonical reputation shape.
export const EMPTY_NPC_REPUTATION: Record<NPCRole, number> =
  Object.fromEntries(NPC_ROLES.map((r) => [r, 0])) as Record<NPCRole, number>

// Reconcile a persisted reputation map with the current role set: drop roles
// that no longer exist (e.g. retired Legal/Comms/Board) and default any new
// roles to 0. Saves predating the roster change load cleanly through this.
export function normalizeNpcReputation(
  rep: Partial<Record<string, number>> | undefined | null,
): Record<NPCRole, number> {
  const out = { ...EMPTY_NPC_REPUTATION }
  if (rep) {
    for (const role of NPC_ROLES) {
      const v = rep[role]
      if (typeof v === 'number') out[role] = v
    }
  }
  return out
}

export interface OrgComplication {
  id:                  string
  name:                string
  description:         string
  severity:            'minor' | 'moderate' | 'severe'
  sourceSessionId:     string
  sourceScenarioTitle: string
  addedAt:             number
}

export interface PersistentCompromise {
  id:            string
  asset:         string
  detail:        string
  sessionId:     string
  scenarioTitle: string
  addedAt:       number
}

export interface IdentifiedTTP {
  techniqueId:   string
  techniqueName: string
  threatType:    string
  sessionId:     string
}

export interface SessionLedgerEntry {
  sessionId:     string
  scenarioTitle: string
  outcome:       'victory' | 'partial' | 'defeat'
  postureChange: number
  timestamp:     number
  impact:        string
}

export interface OrgState {
  securityPosture:       number                        // 0–100, starts at 70
  sessionsPlayed:        number
  orgComplications:      OrgComplication[]
  persistentCompromises: PersistentCompromise[]
  identifiedTTPs:        IdentifiedTTP[]
  npcReputation:         Record<NPCRole, number>       // cumulative carry-forward trust delta
  sessionLedger:         SessionLedgerEntry[]
}

export const INITIAL_ORG_STATE: OrgState = {
  securityPosture:       70,
  sessionsPlayed:        0,
  orgComplications:      [],
  persistentCompromises: [],
  identifiedTTPs:        [],
  npcReputation:         { ...EMPTY_NPC_REPUTATION },
  sessionLedger:         [],
}
