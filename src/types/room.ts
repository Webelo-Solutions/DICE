// Multiplayer room types, shared between server and client.

import type { Character, CharacterClass } from './game'

// facilitator — runs the DM, authoritative over the live session
// dept_lead   — a player who additionally manages their own department:
//               reassigns the actor within it and sees its engagement.
//               No DM control and no scenario control (decision D8).
// player      — takes a turn when the rotation picks them
export type RoomRole = 'facilitator' | 'dept_lead' | 'player'
export type RoomStatus = 'lobby' | 'active' | 'ended'

// standard     — up to 6 players, one character each (the original model)
// departmental — up to ~24 participants fanned into the 6 roles; the ROLE takes
//   the turn and a shuffled rotation picks who acts for it (decision D1), so
//   the initiative order stays 6 entries long no matter the headcount.
export type RoomMode = 'standard' | 'departmental'

// Roles are the mechanical unit in departmental mode. Departments are not.
export const GAME_ROLES: CharacterClass[] = [
  'Analyst', 'Hunter', 'Responder', 'Engineer', 'Intel Officer', 'Commander',
]

// Hard cap on a departmental room. Six roles × four keeps every rotation pool
// small enough that a participant is still guaranteed a turn inside four
// rounds; past this, airtime per person falls below two turns per scenario.
export const MAX_DEPARTMENTAL_PARTICIPANTS = 24

// Public room shape (never exposes the facilitator secret hash).
export interface Room {
  id:        string
  code:      string
  name:      string
  status:    RoomStatus
  mode:      RoomMode
  createdAt: number
  updatedAt: number
}

// An organisational grouping inside a room. Structural only — see decision D2.
export interface Department {
  id:                string
  roomId:            string
  name:              string
  leadParticipantId: string | null
  createdAt:         number
}

// Public participant shape (never exposes the token hash).
export interface Participant {
  id:          string
  roomId:      string
  role:        RoomRole
  displayName: string
  characterId: string | null
  character:   Character | null   // each player IS their character (Option B)
  lastSeenAt:  number
  createdAt:   number
  connected:   boolean   // has at least one open WebSocket in this room right now
  // ── Departmental mode (null/false in a standard room) ──
  gameRole:     CharacterClass | null
  departmentId: string | null
  usesTemplate: boolean   // acts on the role's baseline sheet; earns no persisted XP
}

// Returned to a client when it creates or joins a room. The raw token is shown
// exactly once and stored by the client (localStorage bearer); only its hash is
// persisted server-side.
export interface RoomMembership {
  room:        Room
  participant: Participant
  token:       string
}

// How many participants currently staff each of the six roles. Drives the join
// screen's role picker and the lobby's staffing panel — an unstaffed role is
// skipped entirely in play (decision D7), so seeing the zeroes before the
// session starts is the only chance to fix it.
export type RoleStaffing = Record<CharacterClass, number>

export function emptyStaffing(): RoleStaffing {
  return {
    'Analyst': 0, 'Hunter': 0, 'Responder': 0,
    'Engineer': 0, 'Intel Officer': 0, 'Commander': 0,
  }
}

export function countStaffing(participants: Participant[]): RoleStaffing {
  const staffing = emptyStaffing()
  for (const p of participants) {
    if (p.role !== 'facilitator' && p.gameRole) staffing[p.gameRole]++
  }
  return staffing
}
