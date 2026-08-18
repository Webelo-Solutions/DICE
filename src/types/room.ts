// Multiplayer room types, shared between server and client.

import type { Character } from './game'

export type RoomRole = 'facilitator' | 'player'
export type RoomStatus = 'lobby' | 'active' | 'ended'

// Length of a newly-generated room code, and the input cap on the join screen.
// Shared so the generator and the form cannot drift apart. Rooms created before
// this became 8 have 6-character codes and still work — lookup is an exact
// match, so nothing assumes a length.
export const ROOM_CODE_LENGTH = 8

// Public room shape (never exposes the facilitator secret hash).
export interface Room {
  id:        string
  code:      string
  name:      string
  status:    RoomStatus
  createdAt: number
  updatedAt: number
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
}

// Returned to a client when it creates or joins a room. The raw token is shown
// exactly once and stored by the client (localStorage bearer); only its hash is
// persisted server-side.
export interface RoomMembership {
  room:        Room
  participant: Participant
  token:       string
}
