import { api } from './client'
import { useGameStore } from '../store/gameStore'
import { useCampaignStore } from '../store/campaignStore'
import { useRoomStore } from '../store/roomStore'
import { useToastStore } from '../store/toastStore'
import { useInjectsCatalogStore } from '../store/injectsCatalogStore'
import { INITIAL_ORG_STATE, normalizeNpcReputation } from '../types/orgState'

// In a room, the live session/feed are synced through the room (see roomSync.ts),
// not the solo kv store — so the solo write-through skips them while in a room.
const inRoom = () => !!useRoomStore.getState().membership

// Live-state kv keys (the singletons that change throughout a session).
const KV_SESSION           = 'session'
const KV_FEED              = 'feed'
const KV_RESULT            = 'result'
const KV_CAMPAIGN_CONTEXT  = 'campaignContext'

const logErr = (e: unknown) => console.error('[api-sync]', e)

// The session record is the durable artefact behind the after-action report and
// every export. When its write fails the record still sits in the local store,
// so the history list looks right and the loss only reveals itself later as an
// export claiming the session does not exist. Say so at the time instead.
const recordFailed = (e: unknown) => {
  logErr(e)
  useToastStore.getState().push(
    'This session could not be saved to the server — its report and exports will be unavailable.',
    'error',
  )
}

// ─── Hydration ────────────────────────────────────────────────────────────────
// Load everything from the API into the stores before the app renders. Runs
// once at startup. setState merges, so locally-persisted secrets (providerConfig,
// commConfig from the gameStore's localStorage) are preserved.
export async function hydrateFromApi(): Promise<void> {
  const [
    roster, library, sessionHistory, orgState, activeOrgProfile,
    session, feed, result, campaignContext,
    campaigns, customScenarios, saves,
    injectsCatalog,
  ] = await Promise.all([
    api.listCharacters(),
    api.listLibraryCharacters(),
    api.listSessionHistory(),
    api.getOrgState(),
    api.getOrgProfile(),
    api.getKv<ReturnType<typeof useGameStore.getState>['session']>(KV_SESSION),
    api.getKv<ReturnType<typeof useGameStore.getState>['feed']>(KV_FEED),
    api.getKv<ReturnType<typeof useGameStore.getState>['result']>(KV_RESULT),
    api.getKv<ReturnType<typeof useGameStore.getState>['activeCampaignContext']>(KV_CAMPAIGN_CONTEXT),
    api.listCampaigns(),
    api.listCustomScenarios(),
    api.listSaves(),
    api.listInjectsCatalog(),
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
    activeCampaignContext: campaignContext ?? null,
  })

  // Older campaigns persisted before per-scenario outcome tracking was added
  // have no scenarioResults array — default it so readers never see undefined.
  useCampaignStore.setState({
    campaigns: campaigns.map((c) => ({ ...c, scenarioResults: c.scenarioResults ?? [] })),
    customScenarios,
    saves,
  })
  useInjectsCatalogStore.setState({ entries: injectsCatalog })
}

// Re-pull the injects catalog after an admin creates/edits/deletes an entry,
// so the change is reflected without a page reload (same idea as refreshLibrary).
export async function refreshInjectsCatalog(): Promise<void> {
  useInjectsCatalogStore.setState({ entries: await api.listInjectsCatalog() })
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

const writeSession  = debounced((v: unknown) => api.setKv(KV_SESSION, v))
const writeFeed     = debounced((v: unknown) => api.setKv(KV_FEED, v))
const writeResult   = debounced((v: unknown) => api.setKv(KV_RESULT, v))
const writeCampaignContext = debounced((v: unknown) => api.setKv(KV_CAMPAIGN_CONTEXT, v))
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
        // Diff by reference, not by id: a record can be rewritten after it is
        // first stored — a departmental session records immediately and then
        // enriches with the per-person report once the ledger arrives. Keying
        // on "id is new" skipped that second write, so the server kept the
        // unenriched copy and the exported report lost its departmental
        // section. recordSession upserts, so re-posting is safe.
        const prevById = new Map(prev.sessionHistory.map((r) => [r.id, r]))
        for (const rec of state.sessionHistory) {
          if (prevById.get(rec.id) !== rec) api.recordSession(rec).catch(recordFailed)
        }
      }
    }

    if (prev.session !== state.session && !inRoom()) writeSession(state.session)
    if (prev.feed !== state.feed && !inRoom()) writeFeed(state.feed)
    if (prev.result !== state.result && !inRoom()) writeResult(state.result)
    if (prev.activeCampaignContext !== state.activeCampaignContext) writeCampaignContext(state.activeCampaignContext)
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
