// Multiplayer room types, shared between server and client.

import type { Character } from './game'

export type RoomRole = 'facilitator' | 'player'
export type RoomStatus = 'lobby' | 'active' | 'ended'

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
}

// Returned to a client when it creates or joins a room. The raw token is shown
// exactly once and stored by the client (localStorage bearer); only its hash is
// persisted server-side.
export interface RoomMembership {
  room:        Room
  participant: Participant
  token:       string
}
