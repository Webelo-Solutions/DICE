import type { Character, OutcomeTier, RollRecord, StatKey } from '../types/game'
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
}

export function computeModifier(
  character:   Character,
  action:      string,
  dc:          number,
  statOverride?: StatKey,
  ctx?:        RollContext,
): number {
  let modifier = 0
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
  if (character.traits.includes('Eagle Eye') && relevantStat === 'vigilance') modifier += 1

  // Digital Bloodhound: +1 to all analysis-based rolls
  if (character.traits.includes('Digital Bloodhound') && relevantStat === 'analysis') modifier += 1

  // First Responder: +1 to all rolls in round 1
  if (character.traits.includes('First Responder') && ctx?.round === 1) modifier += 1

  // Calm Under Pressure: absorb the timer-expiry DC spike by granting an equivalent modifier boost
  if (character.traits.includes('Calm Under Pressure') && ctx?.timerExpired) modifier += 4

  void dc
  return modifier
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
  const modifier = computeModifier(character, action, dc, statOverride, ctx)
  const total    = raw + modifier
  const outcome  = adjudicateRoll(raw, modifier, dc)
  return { player: playerId, raw, modifier, total, dc, outcome }
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
