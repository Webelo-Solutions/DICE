import { useGameStore } from '../store/gameStore'
import { ALL_SCENARIOS } from '../data/scenarios'
import type { Campaign, CustomScenario } from '../types/campaign'

// Launches a campaign's current scenario: builds the placeholder session that
// RosterPage's initSession will replace, and sets the org-profile/campaign
// context state the launch needs. Shared by CampaignBuilder's "Play Next" and
// SessionEnd's "Continue Campaign" so both stay in sync with GameSession's
// required shape. Returns false (no state change) if the scenario id can't
// be resolved, so callers know not to navigate.
export function launchCampaignScenario(campaign: Campaign, customScenarios: CustomScenario[]): boolean {
  const allScenarios = [...ALL_SCENARIOS, ...customScenarios]
  const sc = allScenarios.find((s) => s.id === campaign.scenarioSequence[campaign.currentScenarioIndex])
  if (!sc) return false

  useGameStore.setState((s) => ({
    session: {
      id:                     'pending',
      scenario:               sc,
      players:                s.roster.filter((r) => campaign.characterIds.includes(r.id)),
      mode:                   campaign.characterIds.length > 1 ? 'team' : 'solo',
      initiativeOrder:        [],
      currentTurnPlayerId:    '',
      act:                    1,
      round:                  1,
      scenarioClockRemaining: sc.scenarioClockStart,
      attackerProgress:       [sc.killChainStages[0]],
      activeComplications:    [],
      lastRoll:               null,
      roundTimerExpired:      false,
      activeEffects:          [],
      scriptedCriticalEffect: null,
      critHitInjectsDrawn:    [],
      critFailInjectsDrawn:   [],
      resolvedCriticalHitInjects:  [],
      resolvedCriticalFailInjects: [],
      phase:                  'init',
      status:                 'setup',
      timerDifficulty:        'analyst',
      startedAt:              0,
      npcs:                   [],
      usedOnceTraits:         {},
    },
    activeOrgProfile:      campaign.orgProfile ?? null,
    activeCampaignContext: { campaignId: campaign.id, scenarioIndex: campaign.currentScenarioIndex },
  }))
  return true
}
