import type { OutcomeTier } from './game'
import type { NPCRole, NPCStance, NPCMode, NPCVisibility } from './npc'
import type { OrgProfile } from './orgProfile'

// Matches the JSON schema the DM system prompt guarantees

export interface DMNPCUpdate {
  role:           NPCRole
  trustDelta:     number    // negative = trust lost, positive = trust gained
  stance?:        NPCStance // optional override; if omitted, derived from new trust
  awarenessAdded: string[]  // new facts this NPC now knows
  summary:        string    // one sentence describing what happened
}

export interface DMStateChanges {
  attackerProgressAdded:     string[]
  complicationsAdded:        string[]
  complicationsRemoved:      string[]
  scenarioClockDeltaMinutes: number
  actChange:                 number | null
  npcUpdates:                DMNPCUpdate[]
  // Set when this turn's narration resolves the incident — 'victory' if the
  // scenario's victoryCondition was met, 'defeat' if failureCondition was met
  // or the attacker completed their kill chain. null while still ongoing.
  sessionOutcome:            'victory' | 'defeat' | null
}

export interface DMMechanicalOutcome {
  dcAssigned:    number
  modifierApplied: number
  effectiveRoll: number
  outcomeTier:   OutcomeTier
  rollSummary:   string
}

export interface DMInject {
  description:      string
  mechanicalEffect: string
}

export interface DMResponse {
  narration:         string
  mechanicalOutcome: DMMechanicalOutcome | null
  stateChanges:      DMStateChanges
  inject:            DMInject | null
  nextPrompt:        string
  dcHint:            number | null
}

// What we send to Claude each turn
export interface DMRequestPayload {
  phase:    'init' | 'turn'
  scenario: {
    id:                          string
    title:                       string
    act:                         number
    round:                       number
    scenarioClockRemainingMinutes: number
    attackerProgress:            string[]
    activeComplications:         string[]
    victoryCondition:            string
    failureCondition:            string
    actSeed:                     string
    bossEvent:                   string | null
    // Real-world pacing, independent of the in-fiction scenarioClock — lets
    // the DM see whether the table is running long against the scenario's
    // advertised playtime and adjust narration pace accordingly.
    estimatedMinutes:            number
    realElapsedMinutes:          number
  }
  players: {
    id:     string
    name:   string
    class:  string
    stats:  Record<string, number>
    skills: { name: string; level: number }[]
    traits: string[]
    level:  number
  }[]
  npcs: {
    role:         NPCRole
    title:        string
    mode:         NPCMode
    visibility:   NPCVisibility
    introduced:   boolean
    concern:      string
    trust:        number
    stance:       NPCStance
    dcMod:        number
    awareness:    string[]
    interactions: number
  }[]
  initiativeOrder:   string[]
  currentTurn:       string
  lastRoll:          {
    player:   string
    raw:      number
    modifier: number
    total:    number
    dc:       number
    outcome:  string
  } | null
  declaredAction:    string
  roundTimerExpired: boolean
  // Non-null only on the turn a scripted critical-hit/fail table entry fired
  // (see CriticalInjectEntry) — tells the DM to narrate this exact event
  // instead of inventing a competing crit bonus/penalty.
  scriptedCriticalEffect: string | null
  activeEffects: { description: string; roundsRemaining: number }[]
  orgContext: {
    securityPosture:       number
    sessionsPlayed:        number
    orgComplications:      { name: string; severity: string; description: string }[]
    persistentCompromises: { asset: string; detail: string }[]
    knownTTPs:             { techniqueId: string; techniqueName: string; threatType: string }[]
    npcReputation:         Record<NPCRole, number>
  } | null
  orgProfile: OrgProfile | null
}
