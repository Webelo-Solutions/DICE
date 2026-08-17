import type { RoomMembership, Room, Participant, Department, RoomMode } from '../types/room'
import type { CharacterClass } from '../types/game'
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
  // `mode` is fixed at creation because the join flow branches on it before any
  // session exists. `departments` seeds a departmental room's list — members
  // pick from it rather than typing a name, so the roster can't fragment into
  // near-duplicate departments.
  create: (name: string, passphrase: string, userToken: string, mode: RoomMode = 'standard', departments: string[] = []) =>
    req<RoomMembership>('/rooms', {
      method: 'POST', headers: { authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ name, passphrase, mode, departments }),
    }),

  // Standard rooms: a character is required — XP earned carries back to it.
  // Departmental rooms: the role is required and the character is optional;
  // without one the participant acts on the role's baseline template sheet.
  join: (code: string, userToken: string, body: {
    characterId?: string
    gameRole?:    CharacterClass
    departmentId?: string | null
    displayName?: string
  }) =>
    req<RoomMembership>(`/rooms/${encodeURIComponent(code)}/join`, {
      method: 'POST', headers: { authorization: `Bearer ${userToken}` }, body: JSON.stringify(body),
    }),

  claimFacilitator: (code: string, passphrase: string, userToken: string, displayName?: string) =>
    req<RoomMembership>(`/rooms/${encodeURIComponent(code)}/claim-facilitator`, {
      method: 'POST', headers: { authorization: `Bearer ${userToken}` }, body: JSON.stringify({ passphrase, displayName }),
    }),

  getLobby: (code: string) =>
    req<{ room: Room; participants: Participant[]; departments: Department[] }>(`/rooms/${encodeURIComponent(code)}`),

  // ── Departments (facilitator only; organisational grouping — decision D2) ──
  addDepartment: (code: string, token: string, name: string) =>
    req<{ departments: Department[] }>(`/rooms/${encodeURIComponent(code)}/departments`, {
      method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ name }),
    }),

  // Setting leadParticipantId also promotes that person to the dept_lead room
  // role (and demotes whoever held it), so the pointer and the powers stay in
  // step. Pass null to clear the lead.
  updateDepartment: (code: string, token: string, id: string, updates: { name?: string; leadParticipantId?: string | null }) =>
    req<{ departments: Department[] }>(`/rooms/${encodeURIComponent(code)}/departments/${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(updates),
    }),

  deleteDepartment: (code: string, token: string, id: string) =>
    req<{ departments: Department[] }>(`/rooms/${encodeURIComponent(code)}/departments/${encodeURIComponent(id)}`, {
      method: 'DELETE', headers: { authorization: `Bearer ${token}` },
    }),

  // Facilitator fixes a seat someone set wrong at join, or rebalances staffing.
  updateParticipant: (code: string, token: string, id: string, updates: { gameRole?: CharacterClass; departmentId?: string | null }) =>
    req<{ participants: Participant[] }>(`/rooms/${encodeURIComponent(code)}/participants/${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(updates),
    }),

  // Writes session-earned XP back to each player's own persisted character
  // (facilitator-only; uses the room participant token like /action, /dm).
  endRoom: (code: string, roomToken: string, awards: { characterId: string; xpAwarded: number }[]) =>
    req<{ ok: boolean }>(`/rooms/${encodeURIComponent(code)}/end`, {
      method: 'POST', headers: { authorization: `Bearer ${roomToken}` }, body: JSON.stringify({ awards }),
    }),

  // `adoptedFrom` is the participant whose suggestion the actor took, so the
  // credit lands on the person who gave the advice rather than the one who
  // typed it in.
  submitAction: (code: string, token: string, text: string, adoptedFrom?: string) =>
    req<{ ok: boolean }>(`/rooms/${encodeURIComponent(code)}/action`, {
      method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ text, adoptedFrom }),
    }),

  // Facilitator-only: record that a drawn actor let their turn lapse. The
  // server cannot see the round timer, and a forfeit leaves no trace in the
  // feed, so it has to be reported for the ledger to be complete.
  recordForfeit: (code: string, token: string, participantId: string, round: number) =>
    req<{ ok: boolean }>(`/rooms/${encodeURIComponent(code)}/forfeit`, {
      method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ participantId, round }),
    }),

  // Push a suggested action to whoever is currently up (departmental only).
  // The server authorises this against the live session's deliberation scope.
  suggest: (code: string, token: string, text: string) =>
    req<{ ok: boolean; id: string }>(`/rooms/${encodeURIComponent(code)}/suggest`, {
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
