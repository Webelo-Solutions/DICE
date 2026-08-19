import type { Character, CriticalInjectCatalogEntry } from '../types/game'
import type { Campaign, CustomScenario, SaveSlot } from '../types/campaign'
import type { SessionRecord } from '../types/history'
import type { OrgState } from '../types/orgState'
import type { OrgProfile } from '../types/orgProfile'
import type { ContentPackSummary, ContentPackImportResult } from '../types/contentPack'
import { useUserStore } from '../store/userStore'

// Same-origin in production; the Vite dev server proxies /api to Fastify.
const BASE = '/api'

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  // Pull the current token at call time (not import time) — Zustand's getState
  // is sync and reflects the latest sign-in/sign-out without any subscription.
  const store = useUserStore.getState()
  const token = store.token
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...((init?.headers as Record<string, string> | undefined) ?? {}),
  }
  const res = await fetch(BASE + path, { ...init, headers })
  if (!res.ok) {
    // Mid-session 401: the server rejected our token (revoked by an admin,
    // password reset, or the rolling expiry elapsed). Clear the session so the
    // RequireAuth layout sends the user to /login, where a friendly banner
    // explains what happened. Only triggers when we ACTUALLY sent a token —
    // avoids ping-ponging on calls that legitimately return 401 (login form).
    if (res.status === 401 && token && store.user) {
      store.clearSession('expired')
    }
    const detail = await res.text().catch(() => '')
    throw new Error(`API ${init?.method ?? 'GET'} ${path} failed: ${res.status} ${detail}`)
  }
  // 204 / empty bodies → null
  const text = await res.text()
  return (text ? JSON.parse(text) : null) as T
}

const put   = <T>(path: string, body: unknown) => req<T>(path, { method: 'PUT', body: JSON.stringify(body) })
const post  = <T>(path: string, body: unknown) => req<T>(path, { method: 'POST', body: JSON.stringify(body) })
const patch = <T>(path: string, body: unknown) => req<T>(path, { method: 'PATCH', body: JSON.stringify(body) })
const del   = (path: string) => req<unknown>(path, { method: 'DELETE' })

// Triggers a browser download for an authenticated file endpoint (PDF/JSON/CSV
// exports). A plain `<a href>` can't carry the bearer token, so this fetches
// as a blob and saves it via a temporary object URL. Exported for reuse by
// src/api/admin.ts (the admin analytics CSV export lives under /admin, not
// under BASE's other endpoints, but needs the same authenticated-download
// mechanics).
export async function downloadFile(path: string, fallbackFilename: string): Promise<void> {
  const token = useUserStore.getState().token
  const res = await fetch(BASE + path, { headers: token ? { authorization: `Bearer ${token}` } : {} })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Download failed: ${res.status} ${detail}`)
  }
  const blob = await res.blob()
  const match = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')
  const filename = match ? match[1] : fallbackFilename
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
}

export const api = {
  // ── Roster ──
  listCharacters:   () => req<Character[]>('/characters'),
  listLibraryCharacters: () => req<Character[]>('/library-characters'),
  upsertCharacter:  (c: Character) => put<Character>(`/characters/${encodeURIComponent(c.id)}`, c),
  deleteCharacter:  (id: string) => del(`/characters/${encodeURIComponent(id)}`),

  // ── Campaigns ──
  listCampaigns:    () => req<Campaign[]>('/campaigns'),
  upsertCampaign:   (c: Campaign) => put<Campaign>(`/campaigns/${encodeURIComponent(c.id)}`, c),
  deleteCampaign:   (id: string) => del(`/campaigns/${encodeURIComponent(id)}`),

  // ── Custom scenarios ──
  listCustomScenarios:  () => req<CustomScenario[]>('/custom-scenarios'),
  upsertCustomScenario: (s: CustomScenario) => put<CustomScenario>(`/custom-scenarios/${encodeURIComponent(s.id)}`, s),
  deleteCustomScenario: (id: string) => del(`/custom-scenarios/${encodeURIComponent(id)}`),

  // ── Injects catalog (read-only here; management is admin-gated) ──
  listInjectsCatalog: () => req<CriticalInjectCatalogEntry[]>('/injects-catalog'),

  // ── Content packs ──
  listContentPacks: () => req<ContentPackSummary[]>('/content-packs'),
  // Import returns structured validation errors (not just a thrown HTTP error)
  // so the import UI can show the user exactly what's wrong with a pack file.
  importContentPack: async (pack: unknown): Promise<ContentPackImportResult> => {
    // This endpoint is auth-guarded server-side, so it must carry the bearer
    // token like req() does. It uses a raw fetch (not req()) only to surface the
    // server's structured validation errors instead of throwing on non-2xx.
    const store = useUserStore.getState()
    const token = store.token
    const res = await fetch(`${BASE}/content-packs/import`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(pack),
    })
    if (res.ok) return { ok: true, pack: (await res.json()) as ContentPackSummary }
    // Mirror req()'s mid-session 401 handling: a rejected token means the session
    // is dead, so clear it and let RequireAuth route the user back to /login.
    if (res.status === 401 && token && store.user) store.clearSession('expired')
    const body = await res.json().catch(() => ({})) as { error?: string; details?: string[] }
    return { ok: false, errors: body.details ?? [body.error ?? `Import failed (${res.status})`] }
  },
  setContentPackEnabled: (id: string, enabled: boolean) =>
    patch<{ id: string; enabled: boolean }>(`/content-packs/${encodeURIComponent(id)}`, { enabled }),
  uninstallContentPack: (id: string) => del(`/content-packs/${encodeURIComponent(id)}`),

  // ── Saves ──
  listSaves:  () => req<SaveSlot[]>('/saves'),
  addSave:    (s: SaveSlot) => post<SaveSlot>('/saves', s),
  deleteSave: (id: string) => del(`/saves/${encodeURIComponent(id)}`),

  // ── Session history ──
  listSessionHistory: () => req<SessionRecord[]>('/session-history'),
  recordSession:      (r: SessionRecord) => post<SessionRecord>('/session-history', r),
  clearSessionHistory: () => del('/session-history'),
  downloadSessionReport: (id: string) => downloadFile(`/session-history/${encodeURIComponent(id)}/report.pdf`, 'DICE-Report.pdf'),
  downloadSessionJson:   (id: string) => downloadFile(`/session-history/${encodeURIComponent(id)}/export.json`, 'DICE-Session.json'),
  downloadSessionHistoryCsv: () => downloadFile('/session-history/export.csv', 'DICE-Session-History.csv'),
  // One attendee's CPE certificate for one session (departmental sessions only).
  downloadCpeCertificate: (sessionId: string, participantId: string) =>
    downloadFile(
      `/session-history/${encodeURIComponent(sessionId)}/cpe/${encodeURIComponent(participantId)}/certificate.pdf`,
      'DICE-CPE-Certificate.pdf',
    ),

  // ── Org state / profile ──
  getOrgState:  () => req<OrgState | null>('/org-state'),
  setOrgState:  (s: OrgState) => put<OrgState>('/org-state', s),
  getOrgProfile: () => req<OrgProfile | null>('/org-profile'),
  setOrgProfile: (p: OrgProfile | null) => put<OrgProfile | null>('/org-profile', p),

  // ── Generic key/value (live session, feed, result) ──
  getKv: <T>(key: string) => req<T | null>(`/kv/${encodeURIComponent(key)}`),
  setKv: <T>(key: string, value: T) => put<T>(`/kv/${encodeURIComponent(key)}`, value),
  deleteKv: (key: string) => del(`/kv/${encodeURIComponent(key)}`),
}
