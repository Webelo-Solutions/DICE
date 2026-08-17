import type { Character, OutcomeTier, RollRecord, StatKey, TraitName } from '../types/game'
import { SKILL_KEYWORDS } from '../data/skills'

export function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1
}

// Relevant stat keys per action keyword — DM assigns DC; we apply modifiers
const ACTION_STAT_MAP: { keywords: string[]; stat: StatKey }[] = [
  { keywords: ['log', 'alert', 'siem', 'splunk', 'sentinel', 'detect', 'monitor'], stat: 'vigilance' },
  { keywords: ['isolate', 'contain', 'block', 'quarantine', 'firewall', 'deploy', 'script', 'automate'], stat: 'agility' },
  { keywords: ['forensic', 'analyze', 'investigate', 'correlate', 'hunt', 'velociraptor', 'edr', 'memory'], stat: 'analysis' },
  { keywords: ['escalate', 'notify', 'communicate', 'report', 'brief', 'ciso', 'legal', 'management'], stat: 'command' },
  { keywords: ['passive', 'observe', 'quiet', 'stealth', 'covert', 'watch', 'track without'], stat: 'stealth' },
  { keywords: ['recover', 'restore', 'resist', 'withstand', 'maintain', 'keep'], stat: 'fortitude' },
]

export function inferStatFromAction(action: string): StatKey {
  const lower = action.toLowerCase()
  for (const { keywords, stat } of ACTION_STAT_MAP) {
    if (keywords.some((k) => lower.includes(k))) return stat
  }
  return 'analysis' // default
}

export interface RollContext {
  round:        number
  timerExpired: boolean
  // Momentum: how many consecutive Success/Critical Hit outcomes this
  // character has landed in a row, BEFORE this roll. Tracked by the caller
  // (GameSession.tsx) since it spans multiple rolls, not just this one.
  consecutiveSuccesses?: number
}

export interface ModifierResult {
  modifier:      number
  // Passive traits that actually contributed a bonus to this specific roll —
  // lets reports show trait usage without re-deriving these conditions.
  traitsApplied: TraitName[]
}

export function computeModifier(
  character:   Character,
  action:      string,
  dc:          number,
  statOverride?: StatKey,
  ctx?:        RollContext,
): ModifierResult {
  let modifier = 0
  const traitsApplied: TraitName[] = []
  const has = (t: TraitName) => character.traits.includes(t)
  const apply = (t: TraitName, bonus: number) => { modifier += bonus; traitsApplied.push(t) }
  const lower = action.toLowerCase()

  // Stat bonus: each point above 2 grants +1
  const relevantStat = statOverride ?? inferStatFromAction(action)
  const statVal = character.stats[relevantStat]
  if (statVal > 2) modifier += statVal - 2

  // Skill bonus — match the action text against each skill's keyword set
  for (const skill of character.skills) {
    const keywords = SKILL_KEYWORDS[skill.name] ?? []
    if (keywords.some((k) => lower.includes(k))) {
      modifier += skill.level === 3 ? 3 : 2
      break // only one skill bonus applies
    }
  }

  // ── Trait bonuses ────────────────────────────────────────────────────────────
  // Eagle Eye: +1 to all vigilance-based rolls
  if (has('Eagle Eye') && relevantStat === 'vigilance') apply('Eagle Eye', 1)

  // Digital Bloodhound: +1 to all analysis-based rolls
  if (has('Digital Bloodhound') && relevantStat === 'analysis') apply('Digital Bloodhound', 1)

  // First Responder: +1 to all rolls in round 1
  if (has('First Responder') && ctx?.round === 1) apply('First Responder', 1)

  // Calm Under Pressure: absorb the timer-expiry DC spike by granting an equivalent modifier boost
  if (has('Calm Under Pressure') && ctx?.timerExpired) apply('Calm Under Pressure', 4)

  // Ghost Protocol: +1 to all stealth-based rolls
  if (has('Ghost Protocol') && relevantStat === 'stealth') apply('Ghost Protocol', 1)

  // Command Presence: +1 to all command-based rolls
  if (has('Command Presence') && relevantStat === 'command') apply('Command Presence', 1)

  // Momentum: +1 per consecutive Success/Critical Hit landed so far, capped at +3
  if (has('Momentum') && ctx?.consecutiveSuccesses) {
    apply('Momentum', Math.min(ctx.consecutiveSuccesses, 3))
  }

  void dc
  return { modifier, traitsApplied }
}

export function adjudicateRoll(raw: number, modifier: number, dc: number): OutcomeTier {
  if (raw === 20) return 'critical_hit'
  if (raw === 1)  return 'critical_fail'
  const total = raw + modifier
  if (total >= dc)         return 'success'
  if (total >= dc - 3)     return 'partial'
  return 'failure'
}

// Accepts the raw d20 value from the caller (typically the DiceRollOverlay's
// own roll, surfaced via onRollComplete) so the recorded RollRecord cannot
// disagree with the die face the player just watched land. Never call rollD20()
// here — it would create a second independent roll and re-introduce the bug.
export function buildRollRecord(
  raw:         number,
  playerId:    string,
  character:   Character,
  action:      string,
  dc:          number,
  statOverride?: StatKey,
  ctx?:        RollContext,
): RollRecord {
  const { modifier, traitsApplied } = computeModifier(character, action, dc, statOverride, ctx)
  const total   = raw + modifier
  const outcome = adjudicateRoll(raw, modifier, dc)
  return { player: playerId, raw, modifier, total, dc, outcome, traitsApplied: traitsApplied.length > 0 ? traitsApplied : undefined }
}

export function outcomeTierLabel(tier: OutcomeTier): string {
  switch (tier) {
    case 'critical_hit':  return 'CRITICAL HIT'
    case 'success':       return 'SUCCESS'
    case 'partial':       return 'PARTIAL'
    case 'failure':       return 'FAILURE'
    case 'critical_fail': return 'CRITICAL FAIL'
  }
}

export function outcomeTierColor(tier: OutcomeTier): string {
  switch (tier) {
    case 'critical_hit':  return 'text-terminal-green'
    case 'success':       return 'text-terminal-blue'
    case 'partial':       return 'text-terminal-amber'
    case 'failure':       return 'text-orange-500'
    case 'critical_fail': return 'text-terminal-red'
  }
}

export function roundTimerSeconds(character: Character): number {
  // Base 60s + 8s per Agility point above 1
  return 60 + Math.max(0, character.stats.agility - 1) * 8
}
