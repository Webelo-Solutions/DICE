import type { Character, Skill, SkillName, StatKey, TraitName } from '../types/game'

// ─── Level thresholds ─────────────────────────────────────────────────────────

export const LEVEL_THRESHOLDS = [0, 150, 350, 650, 1050, 1500] as const
// Level:                         1    2    3    4     5     6

export function levelForXp(xp: number): number {
  let level = 1
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1
  }
  return level
}

export function xpToNextLevel(xp: number): { next: number | null; current: number; needed: number } {
  const current = levelForXp(xp)
  if (current >= LEVEL_THRESHOLDS.length) return { next: null, current, needed: 0 }
  const next = LEVEL_THRESHOLDS[current] // index = level (0-based vs 1-based offset)
  return { next, current, needed: Math.max(0, next - xp) }
}

// ─── Level-up choices ─────────────────────────────────────────────────────────

export type LevelUpChoiceType = 'skill_upgrade' | 'new_trait' | 'stat_increase'

export interface SkillUpgradeChoice {
  type:      'skill_upgrade'
  skillName: SkillName
  fromLevel: 1 | 2
  toLevel:   2 | 3
}

export interface NewTraitChoice {
  type:      'new_trait'
  traitName: TraitName
}

export interface StatIncreaseChoice {
  type:    'stat_increase'
  stat:    StatKey
  fromVal: number
  toVal:   number
}

export type LevelUpChoice = SkillUpgradeChoice | NewTraitChoice | StatIncreaseChoice

// ─── Available upgradable skills for a character ──────────────────────────────

export function availableSkillUpgrades(character: Character): SkillUpgradeChoice[] {
  return character.skills
    .filter((s) => s.level < 3)
    .map((s) => ({
      type:      'skill_upgrade' as const,
      skillName: s.name,
      fromLevel: s.level as 1 | 2,
      toLevel:   (s.level + 1) as 2 | 3,
    }))
}

// All stats that can be increased (cap at 5)
const ALL_STATS: StatKey[] = ['vigilance', 'agility', 'analysis', 'fortitude', 'stealth', 'command']

export function availableStatIncreases(character: Character): StatIncreaseChoice[] {
  return ALL_STATS
    .filter((s) => character.stats[s] < 5)
    .map((s) => ({
      type:    'stat_increase' as const,
      stat:    s,
      fromVal: character.stats[s],
      toVal:   character.stats[s] + 1,
    }))
}

// All traits not yet held by the character
const ALL_TRAITS: TraitName[] = [
  'First Responder',
  'Eagle Eye',
  'Calm Under Pressure',
  'Digital Bloodhound',
  'Composure',
  'Rally',
]

export function availableNewTraits(character: Character): NewTraitChoice[] {
  return ALL_TRAITS
    .filter((t) => !character.traits.includes(t))
    .map((t) => ({ type: 'new_trait' as const, traitName: t }))
}

// ─── Apply a level-up choice to a character ───────────────────────────────────

export function applyLevelUp(character: Character, newLevel: number, choice: LevelUpChoice): Partial<Character> {
  if (choice.type === 'skill_upgrade') {
    const skills: Skill[] = character.skills.map((s) =>
      s.name === choice.skillName ? { ...s, level: choice.toLevel } : s
    )
    return { level: newLevel, skills }
  } else if (choice.type === 'new_trait') {
    return { level: newLevel, traits: [...character.traits, choice.traitName] }
  } else {
    return { level: newLevel, stats: { ...character.stats, [choice.stat]: choice.toVal } }
  }
}

// ─── Detect level-up from XP award ───────────────────────────────────────────

export interface LevelUpEvent {
  characterId: string
  oldLevel:    number
  newLevel:    number
}

export function detectLevelUps(
  characters: Character[],
  xpAwarded: number,
): LevelUpEvent[] {
  return characters
    .map((c) => {
      const oldLevel = c.level
      const newLevel = levelForXp(c.xp + xpAwarded)
      return newLevel > oldLevel ? { characterId: c.id, oldLevel, newLevel } : null
    })
    .filter((e): e is LevelUpEvent => e !== null)
}
