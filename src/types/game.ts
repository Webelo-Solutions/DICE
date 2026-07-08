import type { AdversaryState } from './adversary'
import type { NPCState, NPCRole } from './npc'

// ─── Character ───────────────────────────────────────────────────────────────

export type CharacterClass =
  | 'Analyst'
  | 'Hunter'
  | 'Responder'
  | 'Engineer'
  | 'Intel Officer'
  | 'Commander'

export type StatKey = 'vigilance' | 'agility' | 'analysis' | 'fortitude' | 'stealth' | 'command'

export interface CharacterStats {
  vigilance: number
  agility:   number
  analysis:  number
  fortitude: number
  stealth:   number
  command:   number
}

export type SkillName =
  | 'Log Analysis'
  | 'Malware Triage'
  | 'Network Forensics'
  | 'Endpoint Forensics'
  | 'Threat Intelligence'
  | 'OSINT'
  | 'Scripting/Automation'
  | 'Cloud IR'
  | 'Escalation/Comms'
  | 'Active Defense'
  | 'Threat Hunting'
  | 'Lateral Movement Tracking'
  | 'Behavioral Analysis'
  | 'Memory Forensics'
  | 'Malware Reversing'
  | 'Detection Engineering'
  | 'Threat Attribution'
  | 'Identity Forensics'
  | 'Data Loss Prevention'
  | 'Crisis Communications'

export interface Skill {
  name:  SkillName
  level: 1 | 2 | 3
}

export type TraitName =
  | 'First Responder'
  | 'Eagle Eye'
  | 'Calm Under Pressure'
  | 'Digital Bloodhound'
  | 'Composure'
  | 'Rally'

export interface TraitDefinition {
  name:        TraitName
  description: string
  effect:      string
}

export interface Character {
  id:       string
  name:     string
  class:    CharacterClass
  stats:    CharacterStats
  skills:   Skill[]
  traits:   TraitName[]
  level:    number
  xp:       number
  headshot?: string   // base64 data URL
}

// ─── Scenario ─────────────────────────────────────────────────────────────────

export type OutcomeTier =
  | 'critical_hit'
  | 'success'
  | 'partial'
  | 'failure'
  | 'critical_fail'

export interface Inject {
  id:               string
  act:              number
  trigger:          'mandatory' | 'discretion'
  description:      string
  mechanicalEffect: string
}

export interface Clue {
  text:           string
  techniqueId?:   string   // e.g. "T1059.001"
  techniqueName?: string   // e.g. "PowerShell"
}

export interface ScenarioAct {
  number:           number
  seed:             string
  primaryObjective: string
  clues:            Clue[]
  bossEvent:        string | null
  injectIds:        string[]
}

export interface ScenarioPack {
  id:                 string
  category?:          string
  title:              string
  threatType:         string
  difficulty:         1 | 2 | 3 | 4 | 5
  recommendedPlayers: string
  estimatedMinutes:   number
  scenarioClockStart: number
  summary:            string
  victoryCondition:   string
  failureCondition:   string
  killChainStages:    string[]
  acts:               ScenarioAct[]
  injects:            Inject[]
  // NPCs cast into this scenario. Omitted/empty = no stakeholders appear
  // (NPCs are hidden by default and opt-in per scenario). Phase 3 populates these.
  npcRoles?:          NPCRole[]
}

// ─── Timer Difficulty ─────────────────────────────────────────────────────────

export type TimerDifficulty = 'rookie' | 'analyst' | 'senior' | 'elite' | 'none'

export const TIMER_DIFFICULTY_SECONDS: Record<TimerDifficulty, number> = {
  rookie:  180,
  analyst: 120,
  senior:  90,
  elite:   60,
  none:    0,
}

// ─── Live Game State ──────────────────────────────────────────────────────────

export interface RollRecord {
  player:   string
  raw:      number
  modifier: number
  total:    number
  dc:       number
  outcome:  OutcomeTier
}

export interface GameSession {
  id:                        string
  scenario:                  ScenarioPack
  players:                   Character[]
  mode:                      'solo' | 'team' | 'adversary'
  initiativeOrder:           string[]   // defender players only in adversary mode
  currentTurnPlayerId:       string
  act:                       number
  round:                     number
  scenarioClockRemaining:    number
  attackerProgress:          string[]
  activeComplications:       string[]
  lastRoll:                  RollRecord | null
  roundTimerExpired:         boolean
  phase:                     'init' | 'turn'
  status:                    'setup' | 'active' | 'victory' | 'defeat'
  timerDifficulty:           TimerDifficulty
  startedAt:                 number   // Unix ms — set when initSession fires
  adversary?:                AdversaryState
  npcs:                      NPCState[]
}

// ─── Narrative Feed ───────────────────────────────────────────────────────────

export type FeedEntryType =
  | 'dm_narration'
  | 'player_action'
  | 'roll_result'
  | 'inject'
  | 'hint'
  | 'system'
  | 'adversary_action'
  | 'adversary_narration'

export interface FeedEntry {
  id:        string
  type:      FeedEntryType
  speaker:   string
  text:      string
  timestamp: number
  roll?:     RollRecord
  outcome?:  OutcomeTier
}

// ─── Session End ──────────────────────────────────────────────────────────────

export interface SessionResult {
  outcome:             'victory' | 'partial' | 'defeat'
  xpAwarded:           number
  criticalHits:        number
  criticalFails:       number
  injectsSurvived:     number
  clockRemaining:      number
  roundsPlayed:        number
  // Audit fields
  startedAt:           number   // Unix ms
  endedAt:             number   // Unix ms
  actsCompleted:       number
  finalAttackerStage:  string
  hintsUsed:                number
  timerExpiries:            number
  // Adversary mode metrics (optional)
  adversaryStealthScore?:   number
  adversaryObjectives?:     number
  adversaryRoundsActive?:   number
}

// ─── Learning Path ────────────────────────────────────────────────────────────

export type LearningPriority = 'critical' | 'high' | 'medium' | 'low'

export interface LearningPathItem {
  area:           string
  gapIdentified:  string
  recommendation: string
  nistRef:        string
  priority:       LearningPriority
}
