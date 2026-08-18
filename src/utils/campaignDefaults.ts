import type { Campaign } from '../types/campaign'
import type { OrgProfile } from '../types/orgProfile'
import { INITIAL_ORG_PROFILE } from '../types/orgProfile'

// What a brand-new campaign starts life with: a codename, and the org profile
// carried over from the team's previous campaign. Kept out of the Campaign
// Builder component so both are plain, testable functions.

// ─── Campaign codenames ───────────────────────────────────────────────────────
//
// A new campaign arrives already named, in the register the app is written in:
// military operation codenames crossed with cyberpunk. An empty "Campaign Name"
// field asks a facilitator to be creative before they have even chosen a
// scenario, and what they type under that pressure is usually "Test 2".
//
// The generated name is a starting point, not a decision — it lands in the
// normal editable field and can be typed straight over.

// Operation codenames are traditionally evocative but neutral: they should not
// describe the operation. These lean cold, structural and slightly ominous.
const ADJECTIVES = [
  'Iron', 'Silent', 'Crimson', 'Cobalt', 'Obsidian', 'Vigilant', 'Hollow', 'Severed',
  'Fractured', 'Distant', 'Sable', 'Ashen', 'Granite', 'Broken', 'Cold', 'Pale',
  'Northern', 'Winter', 'Long', 'Grim', 'Quiet', 'Standing', 'Burning', 'Falling',
  'Neon', 'Chrome', 'Static', 'Neural', 'Rogue', 'Phantom', 'Synthetic', 'Encrypted',
  'Fractal', 'Wired', 'Dark', 'Null', 'Ghost', 'Zero', 'Blind', 'Severing',
]

const NOUNS = [
  // Military
  'Sentinel', 'Vanguard', 'Bastion', 'Citadel', 'Anvil', 'Talon', 'Lance', 'Rampart',
  'Bulwark', 'Aegis', 'Hammer', 'Spear', 'Gauntlet', 'Redoubt', 'Reveille', 'Sabre',
  'Falcon', 'Harrier', 'Warden', 'Herald', 'Sentry', 'Watchtower', 'Palisade', 'Muster',
  // Cyberpunk
  'Blackout', 'Cipher', 'Daemon', 'Firewall', 'Cascade', 'Signal', 'Circuit', 'Lattice',
  'Vector', 'Payload', 'Kernel', 'Nexus', 'Uplink', 'Relay', 'Substrate', 'Overwrite',
  'Blacksite', 'Deadzone', 'Nullspace', 'Handshake', 'Checksum', 'Blackbox', 'Deadlock', 'Rootkit',
]

// "Arc" reads as a multi-session story, which is what a campaign is.
const SUFFIXES = ['Arc', 'Protocol', 'Directive', 'Initiative', 'Cycle']

const pick = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)]

function compose(): string {
  const roll = Math.random()
  // Weighted toward the two-word shapes: "Operation Silent Lattice Directive"
  // is a mouthful nobody says out loud twice.
  if (roll < 0.40) return `Operation ${pick(NOUNS)} ${pick(SUFFIXES)}`
  if (roll < 0.80) return `Operation ${pick(ADJECTIVES)} ${pick(NOUNS)}`
  if (roll < 0.92) return `Operation ${pick(NOUNS)}`
  return `Operation ${pick(ADJECTIVES)} ${pick(NOUNS)} ${pick(SUFFIXES)}`
}

/**
 * A codename not already in `existingNames`.
 *
 * The combination space is large enough that collisions are rare, but a
 * facilitator with two identically-named campaigns in the sidebar cannot tell
 * them apart — so retry, and only if that somehow fails fall back to a suffixed
 * variant rather than returning a duplicate.
 */
export function generateCampaignName(existingNames: string[] = []): string {
  const taken = new Set(existingNames.map((n) => n.trim().toLowerCase()))
  for (let i = 0; i < 40; i++) {
    const name = compose()
    if (!taken.has(name.toLowerCase())) return name
  }
  for (let n = 2; ; n++) {
    const name = `${compose()} ${n}`
    if (!taken.has(name.toLowerCase())) return name
  }
}

/** Distinct names this generator can produce, for the verification checks. */
export function nameSpaceSize(): number {
  return NOUNS.length * SUFFIXES.length          // Operation {Noun} {Suffix}
    + ADJECTIVES.length * NOUNS.length            // Operation {Adj} {Noun}
    + NOUNS.length                                // Operation {Noun}
    + ADJECTIVES.length * NOUNS.length * SUFFIXES.length
}

// ─── Organisational profile carry-over ────────────────────────────────────────

/**
 * How many stack fields a profile actually names. `notes` is excluded — a
 * profile carrying only a note has told us nothing about the tooling.
 */
export function orgProfileFieldCount(profile: OrgProfile | undefined): number {
  if (!profile) return 0
  return Object.entries(profile)
    .filter(([k, v]) => k !== 'notes' && typeof v === 'string' && v.trim().length > 0).length
}

/**
 * The org profile a new campaign should start from: the most recently updated
 * campaign that actually has one.
 *
 * Deliberately NOT gameStore's `activeOrgProfile`, even though that is
 * install-wide and already persisted — it is reset to null on every ad-hoc
 * launch (see App.tsx), so a team's stack would silently evaporate the first
 * time somebody played a one-off scenario. Reading it back off the campaigns
 * themselves means it survives anything short of deleting every campaign.
 *
 * Returns a COPY: editing the new campaign's profile must not reach back into
 * the campaign it was inherited from.
 */
export function inheritedOrgProfile(campaigns: Campaign[]): OrgProfile {
  const source = [...campaigns]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .find((c) => orgProfileFieldCount(c.orgProfile) > 0)
  return source?.orgProfile ? { ...source.orgProfile } : { ...INITIAL_ORG_PROFILE }
}
