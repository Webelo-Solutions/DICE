import type { RoomMembership, Room, Participant } from '../types/room'
import type { GameSession } from '../types/game'
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
  // Room membership (create/join/claim-facilitator) authenticates with the
  // caller's DICE account bearer token — every page that reaches these calls
  // is already behind RequireAuth, so this just threads that identity through
  // to the server, which uses it to own the resulting participant row.
  create: (name: string, passphrase: string, userToken: string) =>
    req<RoomMembership>('/rooms', {
      method: 'POST', headers: { authorization: `Bearer ${userToken}` }, body: JSON.stringify({ name, passphrase }),
    }),

  // Players bring one of their own persisted roster characters (characterId)
  // rather than generating a throwaway one from a class pick.
  join: (code: string, userToken: string, characterId: string) =>
    req<RoomMembership>(`/rooms/${encodeURIComponent(code)}/join`, {
      method: 'POST', headers: { authorization: `Bearer ${userToken}` }, body: JSON.stringify({ characterId }),
    }),

  claimFacilitator: (code: string, passphrase: string, userToken: string, displayName?: string) =>
    req<RoomMembership>(`/rooms/${encodeURIComponent(code)}/claim-facilitator`, {
      method: 'POST', headers: { authorization: `Bearer ${userToken}` }, body: JSON.stringify({ passphrase, displayName }),
    }),

  getLobby: (code: string) =>
    req<{ room: Room; participants: Participant[] }>(`/rooms/${encodeURIComponent(code)}`),

  // Writes session-earned XP back to each player's own persisted character
  // (facilitator-only; uses the room participant token like /action, /dm).
  endRoom: (code: string, roomToken: string, awards: { characterId: string; xpAwarded: number }[]) =>
    req<{ ok: boolean }>(`/rooms/${encodeURIComponent(code)}/end`, {
      method: 'POST', headers: { authorization: `Bearer ${roomToken}` }, body: JSON.stringify({ awards }),
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
