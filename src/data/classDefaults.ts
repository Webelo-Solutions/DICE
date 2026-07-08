import type { Character, CharacterClass, CharacterStats, SkillName, StatKey } from '../types/game'

// Per-class defaults used to auto-generate a character when a player joins a
// multiplayer room (Option B: each player is their own character). Shared by the
// client (class picker) and the server (character generation).

interface ClassDefault {
  class:        CharacterClass
  description:  string
  primaryStats: StatKey[]
  starterSkill: SkillName
}

export const CLASS_DEFAULTS: ClassDefault[] = [
  { class: 'Analyst',       description: 'Fast triage, broad SIEM coverage.',           primaryStats: ['vigilance', 'analysis'], starterSkill: 'Log Analysis' },
  { class: 'Hunter',        description: 'Hypothesis-driven threat hunting.',           primaryStats: ['stealth', 'analysis'],   starterSkill: 'Threat Hunting' },
  { class: 'Responder',     description: 'Containment, isolation, timeline control.',   primaryStats: ['agility', 'fortitude'],  starterSkill: 'Active Defense' },
  { class: 'Engineer',      description: 'Deploys countermeasures, scripts solutions.', primaryStats: ['analysis', 'agility'],   starterSkill: 'Scripting/Automation' },
  { class: 'Intel Officer', description: 'Attribution, OSINT, actor profiling.',        primaryStats: ['stealth', 'command'],    starterSkill: 'OSINT' },
  { class: 'Commander',     description: 'Stakeholder bridge, escalation owner.',       primaryStats: ['command', 'fortitude'],  starterSkill: 'Escalation/Comms' },
]

export const CHARACTER_CLASSES: CharacterClass[] = CLASS_DEFAULTS.map((c) => c.class)

export function isCharacterClass(value: unknown): value is CharacterClass {
  return typeof value === 'string' && CHARACTER_CLASSES.includes(value as CharacterClass)
}

// Builds a level-1 character for a class: baseline 2 in every stat, 4 in the
// class's two primary stats, one starter skill, no traits yet.
export function makeDefaultCharacter(id: string, name: string, charClass: CharacterClass): Character {
  const def = CLASS_DEFAULTS.find((c) => c.class === charClass) ?? CLASS_DEFAULTS[0]
  const stats: CharacterStats = { vigilance: 2, agility: 2, analysis: 2, fortitude: 2, stealth: 2, command: 2 }
  for (const s of def.primaryStats) stats[s] = 4
  return {
    id,
    name,
    class:  def.class,
    stats,
    skills: [{ name: def.starterSkill, level: 1 }],
    traits: [],
    level:  1,
    xp:     0,
  }
}
