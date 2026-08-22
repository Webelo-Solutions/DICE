import { create } from 'zustand'
import type { Campaign, CustomScenario, SaveSlot } from '../types/campaign'
import type { SessionResult } from '../types/game'

const MAX_SAVES = 20

interface CampaignStore {
  campaigns:       Campaign[]
  customScenarios: CustomScenario[]
  saves:           SaveSlot[]

  // Campaign CRUD
  addCampaign:    (c: Campaign)                           => void
  updateCampaign: (id: string, updates: Partial<Campaign>) => void
  deleteCampaign: (id: string)                            => void

  // Records the outcome of the scenario at `scenarioIndex` within a campaign's
  // sequence. If that index is the campaign's current one, advances to the
  // next scenario (or marks the campaign completed if it was the last).
  // `timing` carries the play window of the session that produced this result,
  // so a completion certificate can report real gameplay hours. Optional: a
  // result recorded without it still lands, it just has no measured duration.
  completeCampaignScenario: (
    campaignId:    string,
    scenarioIndex: number,
    scenarioId:    string,
    outcome:       SessionResult['outcome'],
    timing?:       { sessionId: string; startedAt: number; endedAt: number },
  ) => void

  // Custom scenario CRUD
  addCustomScenario:    (s: CustomScenario)                           => void
  updateCustomScenario: (id: string, updates: Partial<CustomScenario>) => void
  deleteCustomScenario: (id: string)                                  => void

  // Save slot CRUD
  addSave:    (slot: SaveSlot) => void
  deleteSave: (id: string)     => void
}

export const useCampaignStore = create<CampaignStore>()(
    (set) => ({
      campaigns:       [],
      customScenarios: [],
      saves:           [],

      addCampaign: (c) =>
        set((s) => ({ campaigns: [...s.campaigns, c] })),

      updateCampaign: (id, updates) =>
        set((s) => ({
          campaigns: s.campaigns.map((c) =>
            c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c,
          ),
        })),

      deleteCampaign: (id) =>
        set((s) => ({ campaigns: s.campaigns.filter((c) => c.id !== id) })),

      completeCampaignScenario: (campaignId, scenarioIndex, scenarioId, outcome, timing) =>
        set((s) => ({
          campaigns: s.campaigns.map((c) => {
            if (c.id !== campaignId) return c
            const scenarioResults = [
              ...c.scenarioResults.filter((r) => r.scenarioIndex !== scenarioIndex),
              { scenarioIndex, scenarioId, outcome, completedAt: Date.now(), ...timing },
            ]
            const isCurrent  = scenarioIndex === c.currentScenarioIndex
            const nextIndex  = isCurrent ? c.currentScenarioIndex + 1 : c.currentScenarioIndex
            return {
              ...c,
              scenarioResults,
              currentScenarioIndex: nextIndex,
              status:    nextIndex >= c.scenarioSequence.length ? 'completed' : 'active',
              updatedAt: Date.now(),
            }
          }),
        })),

      addCustomScenario: (scenario) =>
        set((s) => ({ customScenarios: [...s.customScenarios, scenario] })),

      updateCustomScenario: (id, updates) =>
        set((s) => ({
          customScenarios: s.customScenarios.map((sc) =>
            sc.id === id ? { ...sc, ...updates, updatedAt: Date.now() } : sc,
          ),
        })),

      deleteCustomScenario: (id) =>
        set((s) => ({ customScenarios: s.customScenarios.filter((sc) => sc.id !== id) })),

      addSave: (slot) =>
        set((s) => ({
          // Newest first; cap at MAX_SAVES
          saves: [slot, ...s.saves].slice(0, MAX_SAVES),
        })),

      deleteSave: (id) =>
        set((s) => ({ saves: s.saves.filter((sv) => sv.id !== id) })),
    }),
)
