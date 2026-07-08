// Runtime validation for `.dicepack` content packs (see DICEPACK-FORMAT.md).
//
// This is the single source of truth that turns an untrusted imported file into
// a typed, trusted Dicepack — or a list of human-readable errors. Enums are
// derived from the engine's own runtime constants (skills, NPC roles, classes,
// traits) so the validator can never drift from what the game actually accepts.
//
// Packs are DATA, never code: this module only parses and validates JSON. It
// never executes pack content.
import { z } from 'zod'
import { ALL_SKILLS } from '../data/skills'
import { NPC_ROLES } from '../types/npc'
import type { NPCRole } from '../types/npc'
import { CHARACTER_CLASSES } from '../data/classDefaults'
import { TRAIT_DEFINITIONS } from '../data/traitDefinitions'
import type { SkillName, CharacterClass, TraitName } from '../types/game'

// The format contract this module implements. Bump only on breaking changes.
export const DICEPACK_SCHEMA_VERSION = 1

// ── Enums sourced from the engine (kept in lockstep automatically) ────────────--
const asTuple = <T extends string>(arr: readonly T[]) => arr as [T, ...T[]]

const TRAIT_NAMES = Object.keys(TRAIT_DEFINITIONS) as TraitName[]

const zSkillName  = z.enum(asTuple<SkillName>(ALL_SKILLS))
const zNpcRole    = z.enum(asTuple<NPCRole>(NPC_ROLES))
const zClass      = z.enum(asTuple<CharacterClass>(CHARACTER_CLASSES))
const zTraitName  = z.enum(asTuple<TraitName>(TRAIT_NAMES))

// ── Small helpers ─────────────────────────────────────────────────────────────
const str = (min: number, max: number) => z.string().trim().min(min).max(max)
const semver = z.string().regex(/^\d+\.\d+\.\d+$/, 'must be a semantic version (e.g. 1.0.0)')

// Pack item ids (scenarios, injects, characters): permissive enough to accept
// real authored ids (UUIDs, "CUSTOM-A3F9", "RANSOMWARE-01"), but "::" is reserved
// as the namespacing separator applied at import time, so it can't appear here.
const packItemId = z.string().min(1).max(64)
  .refine((s) => !s.includes('::'), '"::" is reserved for pack namespacing and cannot appear in an id')

const MAX_HEADSHOT_BYTES = 512 * 1024
const HEADSHOT_RE = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+=*)$/

// ── Manifest (§4) ─────────────────────────────────────────────────────────────
export const ManifestSchema = z.object({
  id:            z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,63}$/,
                   'must be 3–64 chars; reverse-DNS or UUID recommended'),
  name:          str(1, 80),
  version:       semver,
  author:        str(1, 80),
  description:   z.string().trim().max(500).optional(),
  minAppVersion: semver.optional(),
  createdAt:     z.string().datetime({ message: 'must be an ISO 8601 UTC timestamp' }).optional(),
  tags:          z.array(str(1, 24)).max(12).optional(),
})

// ── Scenario building blocks (§5) ─────────────────────────────────────────────
const ClueSchema = z.object({
  text:          str(1, 500),
  techniqueId:   z.string().regex(/^T\d{4}(\.\d{3})?$/, 'must be a MITRE ATT&CK ID (e.g. T1059.001)').optional(),
  techniqueName: z.string().trim().max(100).optional(),
})

const InjectSchema = z.object({
  id:               packItemId,
  act:              z.number().int().min(1).max(8),
  trigger:          z.enum(['mandatory', 'discretion']),
  description:      str(1, 1000),
  mechanicalEffect: str(1, 500),
})

const ActSchema = z.object({
  number:           z.number().int().min(1).max(8),
  seed:             str(1, 2000),
  primaryObjective: str(1, 500),
  clues:            z.array(ClueSchema).max(24),
  bossEvent:        z.string().trim().max(1000).nullable(),
  injectIds:        z.array(z.string()).max(16),
})

export const ScenarioSchema = z.object({
  id:                 packItemId,
  title:              str(1, 100),
  category:           z.string().trim().max(40).optional(), // advisory; unknown → "Uncategorized"
  threatType:         str(1, 100),
  difficulty:         z.number().int().min(1).max(5),
  recommendedPlayers: str(1, 16),
  estimatedMinutes:   z.number().int().min(1).max(600),
  scenarioClockStart: z.number().int().min(1).max(1440),
  summary:            str(1, 2000),
  victoryCondition:   str(1, 1000),
  failureCondition:   str(1, 1000),
  killChainStages:    z.array(str(1, 48)).min(1).max(16),
  acts:               z.array(ActSchema).min(1).max(8),
  injects:            z.array(InjectSchema).max(40),
  npcRoles:           z.array(zNpcRole).max(8).optional(),
}).superRefine((sc, ctx) => {
  // Cross-reference: every act injectIds value must resolve to a real inject (§5.3).
  const injectIds = new Set(sc.injects.map((i) => i.id))
  sc.acts.forEach((act, ai) => {
    act.injectIds.forEach((ref, ri) => {
      if (!injectIds.has(ref)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['acts', ai, 'injectIds', ri],
          message: `references unknown inject id "${ref}"`,
        })
      }
    })
  })
  // Inject ids must be unique within the scenario.
  const seen = new Set<string>()
  sc.injects.forEach((inj, i) => {
    if (seen.has(inj.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['injects', i, 'id'], message: `duplicate inject id "${inj.id}"` })
    }
    seen.add(inj.id)
  })
})

// ── Character (§6) ────────────────────────────────────────────────────────────
const stat = z.number().int().min(1).max(5)
const StatsSchema = z.object({
  vigilance: stat, agility: stat, analysis: stat,
  fortitude: stat, stealth: stat, command: stat,
})

const SkillSchema = z.object({
  name:  zSkillName,
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
})

const headshot = z.string()
  .refine((s) => HEADSHOT_RE.test(s), 'must be a base64 data URL (image/png, image/jpeg, or image/webp)')
  .refine((s) => {
    const b64 = s.slice(s.indexOf(',') + 1)
    const bytes = Math.floor((b64.length * 3) / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0)
    return bytes <= MAX_HEADSHOT_BYTES
  }, `decoded headshot exceeds ${MAX_HEADSHOT_BYTES} bytes`)

export const CharacterSchema = z.object({
  id:       packItemId,
  name:     str(1, 24),
  class:    zClass,
  stats:    StatsSchema,
  skills:   z.array(SkillSchema).max(6),
  traits:   z.array(zTraitName).max(6),
  level:    z.number().int().min(1).max(6),
  xp:       z.number().int().min(0),
  headshot: headshot.optional(),
}).superRefine((ch, ctx) => {
  const skillNames = ch.skills.map((s) => s.name)
  if (new Set(skillNames).size !== skillNames.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['skills'], message: 'duplicate skill names' })
  }
  if (new Set(ch.traits).size !== ch.traits.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['traits'], message: 'duplicate traits' })
  }
})

// ── Envelope (§3) ─────────────────────────────────────────────────────────────
const ContentSchema = z.object({
  scenarios:  z.array(ScenarioSchema).max(100).default([]),
  characters: z.array(CharacterSchema).max(100).default([]),
}).superRefine((content, ctx) => {
  if (content.scenarios.length === 0 && content.characters.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'content must include at least one scenario or character' })
  }
  // IDs must be unique within the pack (namespacing makes them globally unique, §7).
  const dupes = (ids: string[]) => ids.filter((id, i) => ids.indexOf(id) !== i)
  const sDupes = dupes(content.scenarios.map((s) => s.id))
  if (sDupes.length) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['scenarios'], message: `duplicate scenario ids: ${[...new Set(sDupes)].join(', ')}` })
  const cDupes = dupes(content.characters.map((c) => c.id))
  if (cDupes.length) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['characters'], message: `duplicate character ids: ${[...new Set(cDupes)].join(', ')}` })
})

export const DicepackSchema = z.object({
  format:        z.literal('dicepack'),
  schemaVersion: z.number().int().min(1).max(DICEPACK_SCHEMA_VERSION),
  pack:          ManifestSchema,
  content:       ContentSchema,
})

export type Dicepack       = z.infer<typeof DicepackSchema>
export type DicepackManifest = z.infer<typeof ManifestSchema>

// ── Public API ────────────────────────────────────────────────────────────────
export type DicepackValidation =
  | { ok: true;  pack: Dicepack }
  | { ok: false; errors: string[] }

/** Validate an already-parsed object against the dicepack schema. */
export function validateDicepack(input: unknown): DicepackValidation {
  const res = DicepackSchema.safeParse(input)
  if (res.success) return { ok: true, pack: res.data }
  return {
    ok: false,
    errors: res.error.issues.map((i) => {
      const where = i.path.length ? i.path.join('.') : '(root)'
      return `${where}: ${i.message}`
    }),
  }
}

/** Parse a raw `.dicepack` file's text, then validate. Catches malformed JSON. */
export function parseDicepack(text: string): DicepackValidation {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    return { ok: false, errors: [`invalid JSON: ${(e as Error).message}`] }
  }
  return validateDicepack(parsed)
}
