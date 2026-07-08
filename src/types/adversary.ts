// ─── Adversary Class Definitions ────────────────────────────────────────────

export type AdversaryClass =
  | 'ransomware_operator'
  | 'apt_actor'
  | 'insider_threat'
  | 'hacktivist'

export interface AdversaryClassDef {
  id:             AdversaryClass
  name:           string
  description:    string
  playstyle:      string
  specialAbility: string
  evasionBonus:   number   // modifier added to evasion rolls (+1 – +4)
  aggressionTier: 1 | 2 | 3 | 4   // how fast they advance kill chain
  color:          string   // tailwind color class for text
  borderColor:    string
  bgColor:        string
  glyph:          string
}

export const ADVERSARY_CLASSES: AdversaryClassDef[] = [
  {
    id:             'ransomware_operator',
    name:           'Ransomware Operator',
    description:    'A financially-motivated criminal deploying ransomware for maximum impact. Fast, noisy, and ruthless — encrypt before containment.',
    playstyle:      'High aggression. Accept detection risk for speed. Target backup systems and domain controllers early.',
    specialAbility: 'Double Tap: Once per act, advance two kill chain stages on a successful evasion roll.',
    evasionBonus:   1,
    aggressionTier: 4,
    color:          'text-terminal-red',
    borderColor:    'border-terminal-red/50',
    bgColor:        'bg-terminal-red/10',
    glyph:          '⚡',
  },
  {
    id:             'apt_actor',
    name:           'APT Actor',
    description:    'A nation-state threat actor with patience and precision. Blend into the environment, exfiltrate data, and leave no trace.',
    playstyle:      'Low profile. Prioritize stealth over speed. Live off the land — abuse legitimate tools only.',
    specialAbility: 'Phantom Presence: When your evasion roll fails, defenders must also succeed on DC 15 to receive the clue (otherwise the trail goes cold).',
    evasionBonus:   4,
    aggressionTier: 1,
    color:          'text-purple-400',
    borderColor:    'border-purple-500/50',
    bgColor:        'bg-purple-500/10',
    glyph:          '◈',
  },
  {
    id:             'insider_threat',
    name:           'Insider Threat',
    description:    'A malicious insider with legitimate credentials and intimate environmental knowledge. You know where the crown jewels are and how to reach them without alarms.',
    playstyle:      'Abuse authorized access. Misdirect the investigation. Exploit trust relationships.',
    specialAbility: 'Authorized Access: Your first action each act has Detection DC reduced by 4.',
    evasionBonus:   3,
    aggressionTier: 2,
    color:          'text-terminal-amber',
    borderColor:    'border-terminal-amber/50',
    bgColor:        'bg-terminal-amber/10',
    glyph:          '◉',
  },
  {
    id:             'hacktivist',
    name:           'Hacktivist',
    description:    'An ideologically-driven attacker focused on disruption, defacement, and public embarrassment. Willing to sacrifice stealth for maximum chaos.',
    playstyle:      'Maximize noise. Add complications. Force defenders to react to your agenda instead of their own.',
    specialAbility: 'Maximum Chaos: On a critical evasion hit (nat 20), add two complications to the defenders instead of one.',
    evasionBonus:   2,
    aggressionTier: 3,
    color:          'text-sky-400',
    borderColor:    'border-sky-400/50',
    bgColor:        'bg-sky-400/10',
    glyph:          '◎',
  },
]

// ─── Adversary Turn Types ─────────────────────────────────────────────────────

export interface AdversaryTacticOption {
  id:          string
  text:        string        // what the adversary attempts
  detectionDC: number        // DC adversary must meet/beat to evade detection
  targetStage: string | null // kill chain stage this may advance
  stealthCost: number        // stealth score penalty on failure (detection)
  tooltip:     string        // MITRE ATT&CK technique reference
}

export interface AdversaryRollRecord {
  round:        number
  action:       string
  raw:          number
  modifier:     number
  total:        number
  detectionDC:  number
  evaded:       boolean      // true = adversary succeeded, defenders don't get a full clue
  stageAdvanced: string | null
  stealthDelta: number
}

// ─── Live Adversary State ─────────────────────────────────────────────────────

export interface AdversaryState {
  playerId:            string           // which Character.id is the adversary
  adversaryClass:      AdversaryClass
  objectivesCompleted: string[]
  stealthScore:        number           // starts 100, decreases on detection
  rollHistory:         AdversaryRollRecord[]
  firstActionThisAct:  boolean          // tracks insider_threat special ability
}
