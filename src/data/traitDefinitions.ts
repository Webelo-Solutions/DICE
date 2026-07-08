import type { TraitName } from '../types/game'

export interface TraitDefinition {
  name:            TraitName
  description:     string
  mechanicalEffect: string
}

export const TRAIT_DEFINITIONS: Record<TraitName, TraitDefinition> = {
  'First Responder': {
    name:             'First Responder',
    description:      'Trained to react the instant an incident hits.',
    mechanicalEffect: '+1 to all rolls in round 1. Priority placement in initiative (Agility +3 for initiative roll).',
  },
  'Eagle Eye': {
    name:             'Eagle Eye',
    description:      "Nothing slips past this analyst's gaze — patterns emerge before others notice anything's wrong.",
    mechanicalEffect: '+1 to all Vigilance-based rolls (log analysis, alert triage, SIEM queries, IOC identification).',
  },
  'Calm Under Pressure': {
    name:             'Calm Under Pressure',
    description:      'The timer is a mind game — and this character has already won it.',
    mechanicalEffect: 'Negates the DC increase from round timer expiry. Effectively absorbs the full +4 DC timer penalty.',
  },
  'Digital Bloodhound': {
    name:             'Digital Bloodhound',
    description:      'Follows attacker trails across systems no matter how well the tracks are covered.',
    mechanicalEffect: '+1 to all Analysis-based rolls (threat hunting, forensics, correlation, attribution).',
  },
  'Composure': {
    name:             'Composure',
    description:      'Even on the worst possible roll, this character finds a way to salvage something.',
    mechanicalEffect: 'Once per session, convert one Critical Fail into a standard Failure instead.',
  },
  'Rally': {
    name:             'Rally',
    description:      'A word at the right moment can turn the tide for the whole team.',
    mechanicalEffect: 'Once per session, grant +2 to another player\'s next roll as a free action (declare before their roll).',
  },
}
