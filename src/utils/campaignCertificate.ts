import type { Campaign, CustomScenario } from '../types/campaign'
import type { Character, ScenarioPack, SessionResult } from '../types/game'
import type { SessionRecord } from '../types/history'
import { DIFFICULTY_LABELS } from '../types/game'
import { ALL_SCENARIOS } from '../data/scenarios'

// Builds the printable record of a finished campaign. Deliberately a pure
// function of stored state: what the certificate says is whatever was recorded
// while the campaign was played, so reprinting it a year later says the same
// thing it said the day it was earned.

// A scenario that ran longer than this almost certainly sat idle overnight
// rather than being played — a browser tab left open across a break produces a
// startedAt/endedAt span of days. Counting it would inflate the headline hours
// figure, which is the one number on this certificate someone might rely on.
const MAX_CREDIBLE_SESSION_MS = 12 * 3_600_000

export interface CertificateScenarioLine {
  position:        number   // 1-based place in the campaign sequence
  scenarioId:      string
  title:           string
  difficulty:      1 | 2 | 3 | 4 | 5
  difficultyLabel: string
  threatType:      string
  outcome:         SessionResult['outcome']
  completedAt:     number
  playedMs:        number   // 0 when no session timing could be resolved
  hours:           number   // playedMs floored to whole hours, per spec
  timed:           boolean  // false = duration unknown, not zero
}

export interface CampaignCertificate {
  recipientName:   string
  campaignName:    string
  description:     string
  startedAt:       number
  completedAt:     number
  scenarios:       CertificateScenarioLine[]
  // Floored from the exact summed milliseconds, so it can exceed the sum of the
  // per-scenario floored hours. The rendered certificate footnotes this.
  totalHours:      number
  totalPlayedMs:   number
  untimedCount:    number
  characters:      { name: string; class: string; level: number }[]
  outcomeCounts:   Record<SessionResult['outcome'], number>
  totalXp:         number
  averageDifficulty: number
  certificateId:   string
}

// Resolves the play window for one campaign scenario result. Prefers the
// timing recorded on the result itself; for results written before those
// fields existed, falls back to the session-history entry for the same
// scenario that finished nearest this result's completedAt.
function resolvePlayedMs(
  result:  Campaign['scenarioResults'][number],
  history: SessionRecord[],
): number {
  if (result.startedAt != null && result.endedAt != null) {
    const span = result.endedAt - result.startedAt
    return span > 0 && span <= MAX_CREDIBLE_SESSION_MS ? span : 0
  }

  const byId = result.sessionId && history.find((r) => r.id === result.sessionId)
  const match = byId || history
    .filter((r) => r.scenarioId === result.scenarioId)
    .sort((a, b) =>
      Math.abs(a.playedAt - result.completedAt) - Math.abs(b.playedAt - result.completedAt))[0]
  if (!match) return 0

  const span = match.result.endedAt - match.result.startedAt
  return span > 0 && span <= MAX_CREDIBLE_SESSION_MS ? span : 0
}

// Returns null when the campaign is not certifiable — every scenario in the
// sequence must have a recorded result, which is what "completed in its
// entirety" means. A campaign flipped to 'completed' by hand in the builder
// without playing it out therefore earns nothing.
export function buildCampaignCertificate(
  campaign:        Campaign,
  recipientName:   string,
  customScenarios: CustomScenario[],
  history:         SessionRecord[],
  roster:          Character[],
): CampaignCertificate | null {
  if (campaign.scenarioSequence.length === 0) return null

  const catalog: ScenarioPack[] = [...ALL_SCENARIOS, ...customScenarios]

  const scenarios: CertificateScenarioLine[] = []
  for (let i = 0; i < campaign.scenarioSequence.length; i++) {
    const result = campaign.scenarioResults.find((r) => r.scenarioIndex === i)
    if (!result) return null

    const pack = catalog.find((s) => s.id === result.scenarioId)
    const playedMs = resolvePlayedMs(result, history)
    const difficulty = pack?.difficulty ?? 1
    scenarios.push({
      position:        i + 1,
      scenarioId:      result.scenarioId,
      // A scenario deleted from the library after being played still belongs on
      // the certificate; it just can't contribute a title or difficulty.
      title:           pack?.title ?? 'Scenario no longer in library',
      difficulty,
      difficultyLabel: DIFFICULTY_LABELS[difficulty],
      threatType:      pack?.threatType ?? '—',
      outcome:         result.outcome,
      completedAt:     result.completedAt,
      playedMs,
      hours:           Math.floor(playedMs / 3_600_000),
      timed:           playedMs > 0,
    })
  }

  const totalPlayedMs = scenarios.reduce((n, s) => n + s.playedMs, 0)
  const completedAt   = Math.max(...scenarios.map((s) => s.completedAt))

  // The campaign's start is when play actually began, not when the campaign was
  // drafted in the builder — those can be months apart. Fall back to createdAt
  // only when nothing recorded a real start.
  const starts = campaign.scenarioResults
    .map((r) => r.startedAt)
    .filter((t): t is number => typeof t === 'number')
  const startedAt = starts.length > 0 ? Math.min(...starts) : campaign.createdAt

  const outcomeCounts = { victory: 0, partial: 0, defeat: 0 }
  for (const s of scenarios) outcomeCounts[s.outcome]++

  // XP is credited from the sessions themselves; a campaign whose sessions have
  // aged out of history simply reports 0 rather than a guess.
  const sessionIds = new Set(
    campaign.scenarioResults.map((r) => r.sessionId).filter(Boolean) as string[],
  )
  const totalXp = history
    .filter((r) => sessionIds.has(r.id))
    .reduce((n, r) => n + r.result.xpAwarded, 0)

  return {
    recipientName,
    campaignName: campaign.name || 'Untitled Campaign',
    description:  campaign.description,
    startedAt,
    completedAt,
    scenarios,
    totalHours:    Math.floor(totalPlayedMs / 3_600_000),
    totalPlayedMs,
    untimedCount:  scenarios.filter((s) => !s.timed).length,
    characters:    campaign.characterIds
      .map((id) => roster.find((c) => c.id === id))
      .filter((c): c is Character => Boolean(c))
      .map((c) => ({ name: c.name, class: c.class, level: c.level })),
    outcomeCounts,
    totalXp,
    averageDifficulty:
      scenarios.reduce((n, s) => n + s.difficulty, 0) / scenarios.length,
    // Stable and derived, not random: reprinting the same campaign produces the
    // same reference, which is the point of putting one on the document.
    certificateId: `${campaign.id.slice(0, 8)}-${completedAt.toString(36)}`.toUpperCase(),
  }
}

// True when the campaign is finished and every scenario has a recorded result.
export function isCampaignCertifiable(campaign: Campaign): boolean {
  return campaign.status === 'completed'
    && campaign.scenarioSequence.length > 0
    && campaign.scenarioSequence.every((_, i) =>
      campaign.scenarioResults.some((r) => r.scenarioIndex === i))
}
