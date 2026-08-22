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
  | 'Ghost Protocol'
  | 'Command Presence'
  | 'Cross-Trained'
  | 'Trusted Voice'
  | 'Momentum'
  | 'Second Wind'

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
  // Set when a room-hosted session awards enough XP to cross a level
  // threshold — the skill/trait/stat choice itself is deferred to when the
  // player next views their roster (solo mode resolves this immediately via
  // SessionEnd's LevelUpModal instead, so this stays unset there).
  pendingLevelUp?: { newLevel: number } | null
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

// Scenario-level (not act-scoped) tables drawn on a natural 20 / natural 1
// skill-check roll. Unlike Inject.mechanicalEffect (free text a human/DM
// interprets), these fields are applied directly by resolveCriticalInject in
// gameStore.ts.
export interface CriticalInjectNPCEffect {
  role:             NPCRole
  trustDelta:       number
  // Only flips NPCState.introduced to true when explicitly set — unlike the
  // DM's own npcUpdates handling, which always reveals the NPC on any update.
  forceIntroduced?: boolean
  awarenessAdded?:  string[]
}

export interface CriticalInjectTemporaryEffect {
  description:    string   // surfaced to the DM every turn while active
  durationRounds: number   // available through session.round + durationRounds
}

export interface CriticalInjectEntry {
  id:                     string
  description:            string   // dramatic feed text, appended verbatim
  advanceKillChainStage?: boolean
  complicationsAdded?:    string[]
  complicationsRemoved?:  string[]
  npcEffect?:             CriticalInjectNPCEffect
  temporaryEffect?:       CriticalInjectTemporaryEffect
}

// As stored/managed in the global injects catalog (admin-curated, install-wide
// — see server/db/schema.ts injectsCatalog). Scenarios reference catalog
// entries by id (ScenarioPack.criticalHitInjectIds/criticalFailInjectIds)
// rather than embedding them; `kind` says which table an entry belongs to.
export interface CriticalInjectCatalogEntry extends CriticalInjectEntry {
  kind: 'critical_hit' | 'critical_fail'
}

// A temporary effect currently in play, generalized beyond critical injects
// (expires once session.round passes expiresRound).
export interface ActiveEffect {
  id:           string
  description:  string
  expiresRound: number
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
  // References into the global injects catalog (CriticalInjectCatalogEntry),
  // resolved into GameSession.resolvedCriticalHitInjects/resolvedCriticalFailInjects
  // at initSession time. Omitted/empty, or ids that don't resolve = the DM
  // improvises its own crit bonus/penalty as before.
  criticalHitInjectIds?:  string[]
  criticalFailInjectIds?: string[]
}

// Display names for ScenarioPack.difficulty, indexed by the value itself —
// index 0 is unused padding so DIFFICULTY_LABELS[3] reads as "difficulty 3".
export const DIFFICULTY_LABELS = ['', 'Novice', 'Analyst', 'Senior', 'Expert', 'Elite'] as const

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
  // Silent modifier-contributing traits that fired on this roll (Ghost
  // Protocol, Command Presence, Momentum) — traits with their own visible
  // feed entry (Composure, Second Wind, Rally, Trusted Voice) aren't
  // repeated here. Absent/empty on rolls before this field existed.
  traitsApplied?: TraitName[]
}

// ─── Departmental mode ────────────────────────────────────────────────────────
// One seat = one human. Several people staff the same role, and the role is what
// takes a turn (decision D1) — so the seat map is how the engine gets from
// "the Analyst turn came up" to "…and Cara is taking it, on her own sheet."
export interface DepartmentalSeat {
  participantId: string
  characterId:   string          // their own character, or an instantiated role template
  gameRole:      CharacterClass
  displayName:   string
  usesTemplate:  boolean         // on the role baseline: earns no persisted XP (D5)
}

// One role's draw state. `pool` drains as people are picked and only refills
// once empty, so everyone staffing the role acts before anyone repeats (D3).
export interface RotationPool {
  pool:  string[]   // participantIds not yet drawn this cycle
  drawn: string[]   // participantIds drawn this cycle
}

export interface CurrentActor {
  role:          CharacterClass
  participantId: string
  characterId:   string
}

// Who may push a suggestion to whoever is currently acting.
//   role       — only the other people staffing the acting role (the default)
//   department — everyone in the acting person's department
//   anyone     — the whole room
// Open scope across twenty people is a firehose in a 90-second window, which is
// why it is not the default (assumption A3).
export type DeliberationScope = 'role' | 'department' | 'anyone'

// Deliberation is the answer to "what do the other nineteen people do?"
// (decision D10). It is a per-session facilitator choice, because some
// exercises want the coaching layer and others want individuals unaided.
export interface DeliberationConfig {
  enabled: boolean
  scope:   DeliberationScope
}

export interface GameSession {
  id:                        string
  scenario:                  ScenarioPack
  players:                   Character[]
  mode:                      'solo' | 'team' | 'adversary' | 'departmental'
  initiativeOrder:           string[]   // defender players only in adversary mode
  currentTurnPlayerId:       string
  act:                       number
  round:                     number
  scenarioClockRemaining:    number
  attackerProgress:          string[]
  activeComplications:       string[]
  lastRoll:                  RollRecord | null
  roundTimerExpired:         boolean
  // Critical-inject state (see CriticalInjectEntry) — activeEffects are
  // expiring temporary effects (cleared in advanceTurn); scriptedCriticalEffect
  // is this turn's resolved description, consumed by buildPayload then reset
  // to null; the drawn-id lists back the no-repeat-until-exhausted draw.
  activeEffects:             ActiveEffect[]
  scriptedCriticalEffect:    string | null
  critHitInjectsDrawn:       string[]
  critFailInjectsDrawn:      string[]
  // Resolved once at initSession by looking up scenario.criticalHitInjectIds/
  // criticalFailInjectIds against the global injects catalog — resolveCriticalInject
  // reads these, not the scenario's raw id references.
  resolvedCriticalHitInjects:  CriticalInjectEntry[]
  resolvedCriticalFailInjects: CriticalInjectEntry[]
  phase:                     'init' | 'turn'
  // 'timeout' = the engine force-concluded the session because real elapsed
  // time blew past the scenario's estimatedMinutes well beyond what the DM's
  // own pacing (scenarioClockDeltaMinutes / sessionOutcome) resolved on its
  // own — a backstop independent of the DM's cooperation. Maps to a 'partial'
  // SessionResult outcome, not a loss.
  status:                    'setup' | 'active' | 'victory' | 'defeat' | 'timeout'
  timerDifficulty:           TimerDifficulty
  startedAt:                 number   // Unix ms — set when initSession fires
  adversary?:                AdversaryState
  npcs:                      NPCState[]
  // Once-per-session trait consumption (Composure, Rally, Second Wind), keyed
  // by the player id who used the trait. Absent/missing entries mean unused —
  // sessions saved before this field existed simply have no key for anyone,
  // which reads the same as "nothing used yet."
  usedOnceTraits:            Record<string, TraitName[]>
  // ── Departmental mode only; absent in solo/team/adversary sessions, and
  //    absent from any session saved before departmental mode existed. ──
  // Staffed roles in initiative order — at most six entries however many people
  // joined, which is what keeps a 20-person round the same length as a 6-person
  // one. currentTurnPlayerId still holds the acting character's id so the DM
  // prompt, dice, and XP paths need no special-casing; currentActor is what
  // says WHO is behind it.
  seats?:                    DepartmentalSeat[]
  roleInitiative?:           CharacterClass[]
  rotation?:                 Record<string, RotationPool>
  currentActor?:             CurrentActor | null
  // Lives on the session rather than the room so the server can authorise a
  // suggestion against the same state every client is already rendering, and
  // so the facilitator can change it mid-session without a second sync path.
  deliberation?:             DeliberationConfig
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
  // Character id this entry is attributed to — set on the system entries
  // raised by Composure/Second Wind/Rally/Trusted Voice so reports can
  // count trait usage per player without parsing entry text.
  player?:   string
}

// ─── Session End ──────────────────────────────────────────────────────────────

export interface SessionResult {
  outcome:             'victory' | 'partial' | 'defeat'
  xpAwarded:           number
  // Actual XP each player earned from their own rolls this session, keyed by
  // character id — xpAwarded above is just the sum, shown as a team stat.
  xpByPlayer:          Record<string, number>
  criticalHits:        number
  criticalFails:       number
  injectsSurvived:     number
  criticalInjectsFired: number
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
