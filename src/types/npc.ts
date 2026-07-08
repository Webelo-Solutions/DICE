export type NPCRole =
  // 🟢 Allies — engage to unlock help (build trust)
  | 'consultant'       // Industry Consultant / Expert
  | 'intel_contact'    // Threat-Intel / ISAC Contact
  | 'system_owner'     // System / Application Owner
  | 'it_ops'           // IT Ops / Helpdesk Lead
  // 🔴 Pressure — must be serviced or your standing degrades (manage exposure)
  | 'reporter'         // Investigative Reporter
  | 'executive'        // Overbearing Executive
  | 'business_owner'   // Business-Unit Owner
  | 'regulator'        // Regulator / Compliance Officer
  // 🟡 Wildcards — help with strings attached (double-edged)
  | 'law_enforcement'  // Law Enforcement
  | 'customer'         // Major Customer / Key Client
  | 'vendor'           // Vendor Rep
  | 'ciso'             // CISO

// How an NPC's standing behaves:
//  - trust-build:     engage to raise trust → stance improves → easier related rolls
//  - manage-exposure: keep them serviced; neglect erodes standing → leaks/pressure
//  - double-edged:    helps when on-side, but imposes constraints regardless
export type NPCMode = 'trust-build' | 'manage-exposure' | 'double-edged'

export const NPC_MODE_LABEL: Record<NPCMode, string> = {
  'trust-build':     'Ally',
  'manage-exposure': 'Pressure',
  'double-edged':    'Wildcard',
}

// When the team becomes aware of an NPC:
//  - known:    visible from session start; the team can engage them proactively
//  - emergent: hidden until the DM introduces them (external/surprise parties)
export type NPCVisibility = 'known' | 'emergent'

export type NPCStance = 'hostile' | 'skeptical' | 'neutral' | 'supportive' | 'advocate'

export const NPC_STANCE_DC_MOD: Record<NPCStance, number> = {
  hostile:    +4,
  skeptical:  +2,
  neutral:     0,
  supportive: -1,
  advocate:   -3,
}

export const NPC_STANCE_LABEL: Record<NPCStance, string> = {
  hostile:    'Hostile',
  skeptical:  'Skeptical',
  neutral:    'Neutral',
  supportive: 'Supportive',
  advocate:   'Advocate',
}

export const NPC_STANCE_COLOR: Record<NPCStance, string> = {
  hostile:    'text-terminal-red',
  skeptical:  'text-terminal-amber',
  neutral:    'text-terminal-dim',
  supportive: 'text-terminal-green/70',
  advocate:   'text-terminal-green',
}

// Standing is a single 0–100 meter where higher is always better for the team.
// For manage-exposure NPCs, high standing reads as "well-managed / low exposure"
// and low standing as "hostile / leak risk" — neglect erodes it over time.
export function trustToStance(trust: number): NPCStance {
  if (trust >= 80) return 'advocate'
  if (trust >= 65) return 'supportive'
  if (trust >= 40) return 'neutral'
  if (trust >= 20) return 'skeptical'
  return 'hostile'
}

export interface NPCInteraction {
  round:      number
  act:        number
  summary:    string
  trustDelta: number
}

export interface NPCState {
  role:             NPCRole
  trust:            number      // 0–100
  stance:           NPCStance
  awareness:        string[]    // facts this NPC knows about the incident
  interactions:     NPCInteraction[]
  lastActiveRound:  number | null  // round when an inject last involved this NPC
  introduced:       boolean     // shown to the team yet? known NPCs start true; emergent flip true on first DM update
}

export interface NPCProfile {
  role:        NPCRole
  mode:        NPCMode
  visibility:  NPCVisibility
  title:       string
  glyph:       string
  description: string
  concern:     string
}

export const NPC_PROFILES: NPCProfile[] = [
  // 🟢 Allies ──────────────────────────────────────────────────────────────────
  {
    role:        'consultant',
    mode:        'trust-build',
    visibility:  'known',
    title:       'Industry Expert',
    glyph:       '◆',
    description: 'Outside Consultant / Subject-Matter Expert',
    concern:     'Lending hard-won expertise — but the team must do the learning',
  },
  {
    role:        'intel_contact',
    mode:        'trust-build',
    visibility:  'known',
    title:       'Intel Contact',
    glyph:       '⊕',
    description: 'Threat-Intel / ISAC Liaison',
    concern:     'Sharing indicators and campaign context when asked',
  },
  {
    role:        'system_owner',
    mode:        'trust-build',
    visibility:  'known',
    title:       'System Owner',
    glyph:       '▣',
    description: 'System / Application Owner',
    concern:     'Protecting their systems and uptime; cooperative if not blamed',
  },
  {
    role:        'it_ops',
    mode:        'trust-build',
    visibility:  'known',
    title:       'IT Ops Lead',
    glyph:       '⚙',
    description: 'IT Operations / Helpdesk Lead',
    concern:     'Executing changes fast without breaking the business',
  },
  // 🔴 Pressure ────────────────────────────────────────────────────────────────
  {
    role:        'reporter',
    mode:        'manage-exposure',
    visibility:  'emergent',
    title:       'Reporter',
    glyph:       '✎',
    description: 'Investigative Reporter',
    concern:     'Breaking the story; probes for leaks and unconfirmed details',
  },
  {
    role:        'executive',
    mode:        'manage-exposure',
    visibility:  'known',
    title:       'Executive',
    glyph:       '★',
    description: 'Overbearing Executive',
    concern:     'Frequent status updates and visible progress',
  },
  {
    role:        'business_owner',
    mode:        'manage-exposure',
    visibility:  'emergent',
    title:       'Business Owner',
    glyph:       '⬢',
    description: 'Business-Unit Owner',
    concern:     'Restoring operations now — pushes to recover before it is safe',
  },
  {
    role:        'regulator',
    mode:        'manage-exposure',
    visibility:  'emergent',
    title:       'Regulator',
    glyph:       '⚖',
    description: 'Regulator / Compliance Officer',
    concern:     'Disclosure obligations and notification deadlines',
  },
  // 🟡 Wildcards ─────────────────────────────────────────────────────────────────
  {
    role:        'law_enforcement',
    mode:        'double-edged',
    visibility:  'emergent',
    title:       'Law Enforcement',
    glyph:       '⚑',
    description: 'Law Enforcement Liaison',
    concern:     'Investigation and evidence — may impose holds that slow the team',
  },
  {
    role:        'customer',
    mode:        'double-edged',
    visibility:  'emergent',
    title:       'Key Client',
    glyph:       '◍',
    description: 'Major Customer / Key Client',
    concern:     'Their data and trust; threatens to churn, pressures disclosure',
  },
  {
    role:        'vendor',
    mode:        'double-edged',
    visibility:  'emergent',
    title:       'Vendor Rep',
    glyph:       '⊟',
    description: 'Vendor / Tooling Representative',
    concern:     'Selling their solution; consumes attention with low-value help',
  },
  {
    role:        'ciso',
    mode:        'double-edged',
    visibility:  'known',
    title:       'CISO',
    glyph:       '◈',
    description: 'Chief Information Security Officer',
    concern:     'Risk posture and board reporting; advocates but is risk-averse',
  },
]

// Canonical ordering of every NPC role (drives reputation maps, defaults, etc.).
export const NPC_ROLES: NPCRole[] = NPC_PROFILES.map((p) => p.role)

export function npcProfile(role: NPCRole): NPCProfile {
  return NPC_PROFILES.find((p) => p.role === role) ?? NPC_PROFILES[0]
}

export function initialNPCState(role: NPCRole): NPCState {
  return {
    role,
    trust:           50,
    stance:          'neutral',
    awareness:       [],
    interactions:    [],
    lastActiveRound: null,
    introduced:      npcProfile(role).visibility === 'known',
  }
}
