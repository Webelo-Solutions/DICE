import { create } from 'zustand'
import type { CriticalInjectCatalogEntry } from '../types/game'

// The global, install-wide injects catalog — admin-write, everyone-read.
// Fetched once (see hydrateFromApi in src/api/sync.ts) and refetched after an
// admin edit (see refreshInjectsCatalog below). Deliberately NOT a
// write-through/persisted store like campaignStore — regular clients only
// ever read this to resolve a scenario's criticalHitInjectIds/criticalFailInjectIds
// at initSession time (see gameStore.ts).
interface InjectsCatalogStore {
  entries: CriticalInjectCatalogEntry[]
  setEntries: (entries: CriticalInjectCatalogEntry[]) => void
}

export const useInjectsCatalogStore = create<InjectsCatalogStore>()((set) => ({
  entries: [],
  setEntries: (entries) => set({ entries }),
}))
