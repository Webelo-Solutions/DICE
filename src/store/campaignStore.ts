import { create } from 'zustand'
import type { Campaign, CustomScenario, SaveSlot } from '../types/campaign'

const MAX_SAVES = 20

interface CampaignStore {
  campaigns:       Campaign[]
  customScenarios: CustomScenario[]
  saves:           SaveSlot[]

  // Campaign CRUD
  addCampaign:    (c: Campaign)                           => void
  updateCampaign: (id: string, updates: Partial<Campaign>) => void
  deleteCampaign: (id: string)                            => void

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
