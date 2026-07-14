import type { RoomMembership, Room, Participant } from '../types/room'
import type { CharacterClass, GameSession } from '../types/game'
import type { ProviderConfig } from '../types/provider'
import type { DMResponse } from '../types/dm'
import type { OrgState } from '../types/orgState'
import type { OrgProfile } from '../types/orgProfile'

const BASE = '/api'

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, { ...init, headers: { 'content-type': 'application/json', ...init?.headers } })
  const text = await res.text()
  const body = text ? JSON.parse(text) : null
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`)
  return body as T
}

export const roomApi = {
  create: (name: string, passphrase: string) =>
    req<RoomMembership>('/rooms', { method: 'POST', body: JSON.stringify({ name, passphrase }) }),

  join: (code: string, displayName: string, charClass: CharacterClass) =>
    req<RoomMembership>(`/rooms/${encodeURIComponent(code)}/join`, { method: 'POST', body: JSON.stringify({ displayName, class: charClass }) }),

  claimFacilitator: (code: string, passphrase: string, displayName?: string) =>
    req<RoomMembership>(`/rooms/${encodeURIComponent(code)}/claim-facilitator`, { method: 'POST', body: JSON.stringify({ passphrase, displayName }) }),

  getLobby: (code: string) =>
    req<{ room: Room; participants: Participant[] }>(`/rooms/${encodeURIComponent(code)}`),

  claimCharacter: (code: string, token: string, characterId: string | null) =>
    req<{ ok: boolean }>(`/rooms/${encodeURIComponent(code)}/claim-character`, {
      method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ characterId }),
    }),

  submitAction: (code: string, token: string, text: string) =>
    req<{ ok: boolean }>(`/rooms/${encodeURIComponent(code)}/action`, {
      method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ text }),
    }),

  // Facilitator registers the AI key with the server (held in memory).
  setDmProvider: (code: string, token: string, config: ProviderConfig) =>
    req<{ ok: boolean }>(`/rooms/${encodeURIComponent(code)}/dm-provider`, {
      method: 'PUT', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(config),
    }),

  // Run the DM on the server (facilitator only).
  runServerDM: (code: string, token: string, payload: { session: GameSession; action: string; phase: 'init' | 'turn'; orgState: OrgState; orgProfile: OrgProfile | null }) =>
    req<DMResponse>(`/rooms/${encodeURIComponent(code)}/dm`, {
      method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(payload),
    }),

  // LAN address + port the server is bound to, so the Lobby can build a
  // shareable join link/QR instead of the host having to run `ipconfig`.
  getNetworkInfo: () => req<{ port: number; addresses: string[] }>('/network-info'),
}
