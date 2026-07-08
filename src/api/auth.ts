import type { AuthUserPublic } from '../store/userStore'

// Auth endpoints are separate from the data API in api/client.ts so that they
// can run BEFORE the userStore is populated (chicken-and-egg) and surface
// clean error messages on validation failures.

const BASE = '/api/auth'

export interface MeResponse {
  authenticated: boolean
  setupRequired: boolean
  user?:         AuthUserPublic
}

// Thrown on any non-2xx response. Carries the HTTP status so callers can
// distinguish 401 (bad credentials) from 423 (locked) from 400 (validation).
export class AuthApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'AuthApiError'
  }
}

async function call<T>(
  path: string,
  method: 'GET' | 'POST',
  body?: unknown,
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (token)              headers['authorization'] = `Bearer ${token}`
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => ({})) as { error?: string }
    throw new AuthApiError(res.status, detail.error ?? `${method} ${path} failed (${res.status})`)
  }
  const text = await res.text()
  return (text ? JSON.parse(text) : null) as T
}

export const apiAuth = {
  me:    (token: string | null) => call<MeResponse>('/me', 'GET', undefined, token),
  setup: (body: { username: string; displayName: string; password: string }) =>
    call<{ token: string; user: AuthUserPublic }>('/setup', 'POST', body),
  login: (body: { username: string; password: string }) =>
    call<{ token: string; user: AuthUserPublic }>('/login', 'POST', body),
  logout: (token: string) => call<{ ok: boolean }>('/logout', 'POST', undefined, token),
  changePassword: (token: string, body: { currentPassword: string; newPassword: string }) =>
    call<{ ok: boolean }>('/change-password', 'POST', body, token),
}
