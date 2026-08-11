import { useUserStore } from '../store/userStore'
import { downloadFile } from './client'
import type { SessionRecord } from '../types/history'
import type { CriticalInjectCatalogEntry } from '../types/game'
import type { CustomScenario } from '../types/campaign'

// Sanitized user shape returned by /api/admin/users — never includes password
// hash. Mirrors server/auth/admin-routes.ts → userPublic().
export interface AdminUserRow {
  id:          string
  username:    string
  displayName: string
  role:        string   // 'admin' | 'player'
  active:      boolean
  createdAt:   number
  lastLoginAt: number | null
}

const BASE = '/api/admin'

async function call<T>(path: string, method: string, body?: unknown): Promise<T> {
  const token = useUserStore.getState().token
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  }
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(detail.error ?? `${method} ${path} failed (${res.status})`)
  }
  const text = await res.text()
  return (text ? JSON.parse(text) : null) as T
}

export const apiAdmin = {
  listUsers:  () => call<AdminUserRow[]>('/users', 'GET'),
  createUser: (body: { username: string; displayName: string; password: string; role: string }) =>
    call<AdminUserRow>('/users', 'POST', body),
  updateUser: (id: string, body: { displayName?: string; role?: string; active?: boolean }) =>
    call<AdminUserRow>(`/users/${encodeURIComponent(id)}`, 'PATCH', body),
  resetPassword: (id: string, password: string) =>
    call<{ ok: boolean }>(`/users/${encodeURIComponent(id)}/reset-password`, 'POST', { password }),
  signOutAll: (id: string) =>
    call<{ ok: boolean }>(`/users/${encodeURIComponent(id)}/sign-out`, 'POST'),

  // Self-service registration invite code — null/absent means registration is
  // disabled. Setting code to null (or '') via setRegistrationCode disables it.
  getRegistrationCode: () => call<{ code: string | null }>('/registration-code', 'GET'),
  setRegistrationCode: (code: string | null) =>
    call<{ code: string | null }>('/registration-code', 'PUT', { code }),

  // Program-wide analytics — every user's session history + the configured
  // compliance-cadence target.
  getAnalytics: () => call<{ sessions: Array<SessionRecord & { ownerUserId: string | null }>; cadenceDays: number }>('/analytics', 'GET'),
  setCadenceDays: (cadenceDays: number) => call<{ cadenceDays: number }>('/analytics/cadence-days', 'PUT', { cadenceDays }),
  downloadTeamCsv: () => downloadFile('/admin/analytics/export.csv', 'DICE-Program-Session-History.csv'),

  // Injects catalog — full CRUD (regular users only get the read-only
  // GET /api/injects-catalog via src/api/client.ts).
  listInjectsCatalog: () => call<CriticalInjectCatalogEntry[]>('/injects-catalog', 'GET'),
  upsertInjectCatalogEntry: (entry: CriticalInjectCatalogEntry) =>
    call<CriticalInjectCatalogEntry>(`/injects-catalog/${encodeURIComponent(entry.id)}`, 'PUT', entry),
  deleteInjectCatalogEntry: (id: string) =>
    call<{ deleted: string }>(`/injects-catalog/${encodeURIComponent(id)}`, 'DELETE'),

  // Scenarios — full editor, unscoped (every scenario on the install, not just
  // the caller's own). Saves always mark the scenario is_global.
  listAllScenarios: () => call<CustomScenario[]>('/scenarios', 'GET'),
  upsertScenario: (s: CustomScenario) => call<CustomScenario>(`/scenarios/${encodeURIComponent(s.id)}`, 'PUT', s),
  deleteScenario: (id: string) => call<{ deleted: string }>(`/scenarios/${encodeURIComponent(id)}`, 'DELETE'),
}
