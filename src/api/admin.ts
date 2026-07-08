import { useUserStore } from '../store/userStore'

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
}
