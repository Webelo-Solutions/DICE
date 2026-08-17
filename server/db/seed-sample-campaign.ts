// Seeds one example campaign for the install's first admin account — a
// 10-scenario onboarding arc for a junior security analyst, meant to be
// opened in the Campaign Builder and used as a concrete model for building
// further campaigns (scenario sequencing, pacing, and how to use the notes
// field to document the "why" behind the order). Runs once per install:
// skipped once that admin has any campaign at all, so deleting or editing
// this one is final — it will not reappear on the next server restart.
import { eq, asc } from 'drizzle-orm'
import { db } from './client'
import { users } from './schema'
import { repository } from './sqlite-repository'
import type { Campaign } from '../../src/types/campaign'
import { INITIAL_ORG_PROFILE } from '../../src/types/orgProfile'

const SAMPLE_CAMPAIGN_ID = 'SAMPLE-JUNIOR-ANALYST-ONBOARDING'

function buildSampleCampaign(): Campaign {
  const now = Date.now()
  return {
    id:          SAMPLE_CAMPAIGN_ID,
    name:        'Junior Analyst Onboarding: SOC Foundations',
    description:
      'A ten-scenario onboarding arc for a brand-new SOC analyst. Opens with a fully-guided ' +
      'tutorial alert, spends nine sessions at Novice difficulty rotating through the core ' +
      'incident types a junior analyst meets in their first months — malware, phishing, ' +
      'identity, network, cloud, ransomware, and insider threat — then closes with a ' +
      'multi-source correlation exercise that previews Analyst-tier work. Built as a ' +
      'reference for structuring your own campaigns; see the Notes field for the design rationale.',
    scenarioSequence: [
      'TUTORIAL-01', // First Alert (onboarding tutorial) — fundamentals, 15m
      'NOVICE-06',   // Triage Queue — fundamentals, 20m
      'NOVICE-02',   // Contained (RAT) — malware, 25m
      'NOVICE-09',   // Reset Required — phishing, 25m
      'NOVICE-03',   // Wrong Place — identity, 20m
      'NOVICE-04',   // Loud Neighbor — network, 25m
      'NOVICE-13',   // Public by Default — cloud, 30m
      'NOVICE-05',   // Day Zero — ransomware, 30m
      'NOVICE-14',   // Two Weeks Notice — insider, 30m
      'ANALYST-11',  // Three Sources, One Story — fundamentals/correlation, 45m, difficulty 2
    ],
    characterIds:         [],
    status:               'draft',
    currentScenarioIndex: 0,
    scenarioResults:      [],
    notes:
      'Design notes for this sample campaign (edit or delete freely):\n\n' +
      '• Scenario 1 is the literal onboarding tutorial. Any new-hire campaign should open ' +
      'with a zero-stakes, fully-guided scenario before anything with a real failure condition.\n\n' +
      '• Scenarios 2-9 stay entirely at Novice difficulty and rotate through one distinct ' +
      'incident category each (malware, phishing, identity, network, cloud, ransomware, ' +
      'insider) — nine different first-exposure moments rather than nine variations on one ' +
      'theme. Breadth before depth.\n\n' +
      '• Runtime climbs gently across the sequence (15 to 30 minutes) so early sessions fit ' +
      'inside a short onboarding block and later ones can run as a full practice session.\n\n' +
      '• Scenario 10 is the only Analyst-tier (difficulty 2) entry, and it is deliberately a ' +
      'correlation exercise rather than a new threat type — it asks the analyst to connect ' +
      'signals across sources they already know, so it reads as "graduation," not "jump in ' +
      'the deep end."\n\n' +
      '• characterIds is intentionally empty and status is \'draft\' — assign a roster ' +
      'character before starting, the same way you would for any campaign built from scratch.\n\n' +
      'To model a new campaign on this one: pick a theme or target tier, open with one guided ' +
      'or low-stakes scenario, give broad single-category exposure across the middle, and close ' +
      'with one stretch scenario that asks players to combine what came before rather than learn ' +
      'something entirely new.',
    orgProfile: { ...INITIAL_ORG_PROFILE },
    createdAt:  now,
    updatedAt:  now,
  }
}

// Shared by both call sites below: safe to call any number of times for the
// same user, since it's a no-op once they own at least one campaign.
function seedSampleCampaignForUserIfEmpty(userId: string): void {
  if (repository.listCampaigns(userId).length > 0) return
  repository.upsertCampaign(buildSampleCampaign(), userId)
}

// Called once at server boot (server/index.ts). Covers installs upgrading
// from a version before this seed existed, where an admin already exists but
// has never received the sample campaign. No-ops on a brand-new install
// (no admin yet) — that case is covered by seedSampleCampaignForNewAdmin below.
export function seedSampleCampaignIfEmpty(): void {
  const firstAdmin = db.select().from(users)
    .where(eq(users.role, 'admin'))
    .orderBy(asc(users.createdAt))
    .limit(1)
    .all()[0]
  if (!firstAdmin) return

  seedSampleCampaignForUserIfEmpty(firstAdmin.id)
}

// Called from the first-run /auth/setup route right after the admin account
// is created, so a brand-new install gets the sample campaign immediately
// instead of waiting for a future server restart.
export function seedSampleCampaignForNewAdmin(userId: string): void {
  seedSampleCampaignForUserIfEmpty(userId)
}
