import { api } from './client'
import { useGameStore } from '../store/gameStore'
import { useCampaignStore } from '../store/campaignStore'
import { useRoomStore } from '../store/roomStore'
import { INITIAL_ORG_STATE, normalizeNpcReputation } from '../types/orgState'

// In a room, the live session/feed are synced through the room (see roomSync.ts),
// not the solo kv store — so the solo write-through skips them while in a room.
const inRoom = () => !!useRoomStore.getState().membership

// Live-state kv keys (the singletons that change throughout a session).
const KV_SESSION = 'session'
const KV_FEED    = 'feed'
const KV_RESULT  = 'result'

const logErr = (e: unknown) => console.error('[api-sync]', e)

// ─── Hydration ────────────────────────────────────────────────────────────────
// Load everything from the API into the stores before the app renders. Runs
// once at startup. setState merges, so locally-persisted secrets (providerConfig,
// commConfig from the gameStore's localStorage) are preserved.
export async function hydrateFromApi(): Promise<void> {
  const [
    roster, library, sessionHistory, orgState, activeOrgProfile,
    session, feed, result,
    campaigns, customScenarios, saves,
  ] = await Promise.all([
    api.listCharacters(),
    api.listLibraryCharacters(),
    api.listSessionHistory(),
    api.getOrgState(),
    api.getOrgProfile(),
    api.getKv<ReturnType<typeof useGameStore.getState>['session']>(KV_SESSION),
    api.getKv<ReturnType<typeof useGameStore.getState>['feed']>(KV_FEED),
    api.getKv<ReturnType<typeof useGameStore.getState>['result']>(KV_RESULT),
    api.listCampaigns(),
    api.listCustomScenarios(),
    api.listSaves(),
  ])

  useGameStore.setState({
    roster,
    library,
    sessionHistory,
    orgState: orgState
      ? { ...orgState, npcReputation: normalizeNpcReputation(orgState.npcReputation) }
      : INITIAL_ORG_STATE,
    activeOrgProfile: activeOrgProfile ?? null,
    session: session ?? null,
    feed: feed ?? [],
    result: result ?? null,
  })

  useCampaignStore.setState({ campaigns, customScenarios, saves })
}

// Re-pull the library collections (roster + custom scenarios) from the API after
// a content-pack import / enable / uninstall, so newly added or removed items
// appear without a page reload. Pack-sourced rows keep their pack_id server-side;
// the write-through upserts that follow never set pack_id, so provenance is safe.
export async function refreshLibrary(): Promise<void> {
  const [roster, library, customScenarios] = await Promise.all([
    api.listCharacters(),
    api.listLibraryCharacters(),
    api.listCustomScenarios(),
  ])
  useGameStore.setState({ roster, library })
  useCampaignStore.setState({ customScenarios })
}

// ─── Write-through ──────────────────────────────────────────────────────────--
// Per-entity upsert/delete for collections by diffing prev vs next (the stores
// update immutably, so a changed item is a new reference). Centralizing sync
// here keeps the stores' action code untouched.
function syncCollection<T extends { id: string }>(
  prev: T[], next: T[],
  upsert: (x: T) => Promise<unknown>,
  remove: (id: string) => Promise<unknown>,
) {
  if (prev === next) return
  const prevById = new Map(prev.map((x) => [x.id, x]))
  for (const item of next) {
    if (prevById.get(item.id) !== item) upsert(item).catch(logErr)
  }
  const nextIds = new Set(next.map((x) => x.id))
  for (const item of prev) {
    if (!nextIds.has(item.id)) remove(item.id).catch(logErr)
  }
}

// Debounced singleton writers so a burst of session/feed mutations (e.g. every
// turn) collapses into one write.
function debounced<T>(fn: (v: T) => Promise<unknown>, ms = 400) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let latest: T
  return (v: T) => {
    latest = v
    clearTimeout(timer)
    timer = setTimeout(() => { fn(latest).catch(logErr) }, ms)
  }
}

const writeSession = debounced((v: unknown) => api.setKv(KV_SESSION, v))
const writeFeed    = debounced((v: unknown) => api.setKv(KV_FEED, v))
const writeResult  = debounced((v: unknown) => api.setKv(KV_RESULT, v))
const writeOrgState = debounced((v: Parameters<typeof api.setOrgState>[0]) => api.setOrgState(v))
const writeOrgProfile = debounced((v: Parameters<typeof api.setOrgProfile>[0]) => api.setOrgProfile(v))

// Start write-through. Call AFTER hydrateFromApi so the initial population does
// not echo back as writes. Returns an unsubscribe function.
export function startApiSync(): () => void {
  const unsubGame = useGameStore.subscribe((state, prev) => {
    syncCollection(prev.roster, state.roster, api.upsertCharacter, api.deleteCharacter)

    if (prev.sessionHistory !== state.sessionHistory) {
      if (state.sessionHistory.length === 0 && prev.sessionHistory.length > 0) {
        api.clearSessionHistory().catch(logErr)
      } else {
        const prevIds = new Set(prev.sessionHistory.map((r) => r.id))
        for (const rec of state.sessionHistory) {
          if (!prevIds.has(rec.id)) api.recordSession(rec).catch(logErr)
        }
      }
    }

    if (prev.session !== state.session && !inRoom()) writeSession(state.session)
    if (prev.feed !== state.feed && !inRoom()) writeFeed(state.feed)
    if (prev.result !== state.result && !inRoom()) writeResult(state.result)
    if (prev.orgState !== state.orgState) writeOrgState(state.orgState)
    if (prev.activeOrgProfile !== state.activeOrgProfile) writeOrgProfile(state.activeOrgProfile)
  })

  const unsubCampaign = useCampaignStore.subscribe((state, prev) => {
    syncCollection(prev.campaigns, state.campaigns, api.upsertCampaign, api.deleteCampaign)
    syncCollection(prev.customScenarios, state.customScenarios, api.upsertCustomScenario, api.deleteCustomScenario)
    syncCollection(prev.saves, state.saves, api.addSave, api.deleteSave)
  })

  return () => { unsubGame(); unsubCampaign() }
}
