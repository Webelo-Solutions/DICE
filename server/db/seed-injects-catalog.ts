// Seed data for the global injects catalog — inserts any entry below whose id
// isn't already in the table, so it's safe to call on every startup: existing
// rows (including ones an admin has since edited) are left untouched, and a
// newly-added seed entry lands on the next boot without needing a fresh
// install. The first 4 entries were originally authored inline on
// RANSOMWARE_01 (src/data/scenarios.ts) before the catalog existed; that
// scenario now references them by id instead.
import { repository } from './sqlite-repository'
import type { CriticalInjectCatalogEntry } from '../../src/types/game'

const SEED_ENTRIES: CriticalInjectCatalogEntry[] = [
  {
    id:          'CH_OUTSIDE_CONSULTANT',
    kind:        'critical_hit',
    description: 'A former colleague now at an IR consultancy picks up your call and, off the clock, walks you through exactly how to spot the persistence mechanism.',
    temporaryEffect: {
      description:    'An outside consultant is on the line and can walk the team through solving a complication.',
      durationRounds: 1,
    },
  },
  {
    id:          'CH_CISO_CONFIDENCE',
    kind:        'critical_hit',
    description: 'The CISO watches the team work the problem cleanly and visibly relaxes — for the first time tonight, they sound like they believe this is going to be fine.',
    npcEffect: {
      role:       'ciso',
      trustDelta: 15,
    },
  },
  {
    id:                    'CF_ATTACKER_ADAPTS',
    kind:                  'critical_fail',
    description:           'The attacker notices the investigation and immediately pivots — a new persistence mechanism appears on a host you thought was clean.',
    advanceKillChainStage: true,
  },
  {
    id:          'CF_REPORTER_CALLS',
    kind:        'critical_fail',
    description: 'A local tech reporter calls the CISO\'s direct line asking to confirm "reports of a ransomware incident." The CISO did not give this number out — now they are fielding press questions on top of everything else.',
    npcEffect: {
      role:            'ciso',
      trustDelta:      -10,
      forceIntroduced: true,
      awarenessAdded:  ['A reporter is asking questions about the incident'],
    },
  },

  // ── Batch 2: general-purpose positive/negative table, added on request ──
  {
    id:          'CH_VENDOR_INTEL_SHARE',
    kind:        'critical_hit',
    description: "Your EDR vendor's threat research team proactively reaches out with fresh indicators matching what you're seeing.",
    npcEffect: {
      role:           'vendor',
      trustDelta:     15,
      awarenessAdded: ['Vendor has correlated this activity with a known campaign'],
    },
  },
  {
    id:          'CH_SYSTEM_OWNER_ACCESS',
    kind:        'critical_hit',
    description: 'The system owner grants full read access to the affected environment without waiting for a change ticket.',
    npcEffect: {
      role:       'system_owner',
      trustDelta: 15,
    },
  },
  {
    id:                   'CH_CLEAN_SWEEP',
    kind:                 'critical_hit',
    description:          'A single well-aimed script kills the malicious process across every host in one pass — no stragglers.',
    complicationsRemoved: ['legacy_asset_exposure'],
  },
  {
    id:          'CH_LE_FAST_TRACK',
    kind:        'critical_hit',
    description: 'Law enforcement expedites the legal process, cutting through the paperwork that usually stalls containment.',
    npcEffect: {
      role:       'law_enforcement',
      trustDelta: 10,
    },
    temporaryEffect: {
      description:    'Legal is fast-tracking authorization — containment actions needing sign-off move faster this window.',
      durationRounds: 2,
    },
  },
  {
    id:          'CH_EXEC_TOP_COVER',
    kind:        'critical_hit',
    description: 'The executive team publicly backs the response effort, buying the room to work without second-guessing from above.',
    npcEffect: {
      role:       'executive',
      trustDelta: 15,
    },
  },
  {
    id:          'CH_CUSTOMER_GRACE',
    kind:        'critical_hit',
    description: 'A major client grants an unplanned extension on the SLA, easing the clock pressure.',
    npcEffect: {
      role:       'customer',
      trustDelta: 10,
    },
    temporaryEffect: {
      description:    'The client has granted a grace window — the usual SLA pressure is paused.',
      durationRounds: 2,
    },
  },
  {
    id:          'CH_CONSULTANT_ON_CALL',
    kind:        'critical_hit',
    description: 'An outside IR consultant, reached through a personal contact, walks the team through the exact next step.',
    temporaryEffect: {
      description:    'A consultant is on the line and can walk the team through solving a complication.',
      durationRounds: 1,
    },
  },
  {
    id:          'CH_REGULATOR_LEEWAY',
    kind:        'critical_hit',
    description: "The regulator, satisfied by the team's transparency so far, quietly extends the compliance deadline.",
    npcEffect: {
      role:       'regulator',
      trustDelta: 15,
    },
  },
  {
    id:          'CH_FRESH_IOC_FEED',
    kind:        'critical_hit',
    description: 'The intel contact pushes a fresh indicator feed that lines up perfectly with what\'s on screen.',
    npcEffect: {
      role:           'intel_contact',
      trustDelta:     10,
      awarenessAdded: ["A matching IOC feed just confirmed the attacker's toolset"],
    },
  },
  {
    id:          'CH_TEAM_SYNC',
    kind:        'critical_hit',
    description: 'Every analyst calls the same conclusion within seconds of each other — the room clicks into total sync.',
  },
  {
    id:          'CF_REGULATOR_INQUIRY',
    kind:        'critical_fail',
    description: "The regulator opens a formal inquiry, unconvinced by the team's account of events.",
    npcEffect: {
      role:            'regulator',
      trustDelta:      -15,
      forceIntroduced: true,
      awarenessAdded:  ['A formal regulatory inquiry has been opened'],
    },
  },
  {
    id:                 'CF_PATCH_BACKFIRES',
    kind:               'critical_fail',
    description:        "The vendor's emergency patch conflicts with production systems, causing a second outage.",
    complicationsAdded: ['vendor_patch_fallout'],
  },
  {
    id:                 'CF_OWNER_PANIC_SHUTDOWN',
    kind:               'critical_fail',
    description:        'The business owner panics and unilaterally shuts down customer-facing systems without warning the team.',
    complicationsAdded: ['unplanned_customer_outage'],
    npcEffect: {
      role:       'business_owner',
      trustDelta: -15,
    },
  },
  {
    id:                 'CF_EVIDENCE_SEIZED',
    kind:               'critical_fail',
    description:        "Law enforcement seizes a key system as evidence mid-investigation, taking it out of the team's hands.",
    complicationsAdded: ['key_asset_unavailable'],
    npcEffect: {
      role:       'law_enforcement',
      trustDelta: -10,
    },
  },
  {
    id:          'CF_CUSTOMER_GOES_PUBLIC',
    kind:        'critical_fail',
    description: "A major client posts about the incident on social media before anyone's briefed them.",
    npcEffect: {
      role:            'customer',
      trustDelta:      -15,
      forceIntroduced: true,
      awarenessAdded:  ['The client has gone public about the incident'],
    },
  },
  {
    id:                 'CF_EVIDENCE_DESTROYED',
    kind:               'critical_fail',
    description:        'A well-meaning but panicked employee wipes a machine that held key evidence.',
    complicationsAdded: ['evidence_lost'],
  },
  {
    id:                     'CF_DECOY_DEPLOYED',
    kind:                   'critical_fail',
    description:            "What looked like the main thread was a decoy — the attacker was already a step further while the team chased it.",
    advanceKillChainStage:  true,
  },
  {
    id:          'CF_CISO_LOSES_FACE',
    kind:        'critical_fail',
    description: 'The CISO is blindsided in front of the executive team and visibly loses confidence in the response.',
    npcEffect: {
      role:       'ciso',
      trustDelta: -15,
    },
  },
  {
    id:          'CF_TOOLING_DEGRADED',
    kind:        'critical_fail',
    description: 'The primary SIEM console starts throwing errors under load — query results are slow and unreliable.',
    temporaryEffect: {
      description:    'The SIEM is degraded — log queries are slower and less reliable this window.',
      durationRounds: 2,
    },
  },
  {
    id:          'CF_REPORTER_BREAKS_STORY',
    kind:        'critical_fail',
    description: "A reporter runs an unconfirmed story about the incident before the team has a chance to get ahead of it.",
    npcEffect: {
      role:            'reporter',
      trustDelta:      -15,
      forceIntroduced: true,
      awarenessAdded:  ['A reporter has published an unconfirmed story about the incident'],
    },
  },
]

export function seedInjectsCatalogIfEmpty(): void {
  const existingIds = new Set(repository.listInjectsCatalog().map((e) => e.id))
  for (const entry of SEED_ENTRIES) {
    if (!existingIds.has(entry.id)) repository.upsertInjectCatalogEntry(entry)
  }
}
