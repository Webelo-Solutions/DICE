import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Participant, RoomRole } from '../types/room'

// What this client knows about the room it belongs to. The token is the bearer
// credential (same model as M1). Persisted so a refresh rejoins the same room.
export interface Membership {
  code:          string
  token:         string
  role:          RoomRole
  participantId: string
  displayName:   string
  roomName:      string
}

// A player action relayed by the server to the facilitator's client for
// processing (Option A: auto-process through the game engine).
export interface IncomingAction {
  text:        string
  characterId: string
  displayName: string
}

interface RoomStore {
  membership:   Membership | null
  participants: Participant[]   // live, from the WebSocket lobby broadcasts
  connected:    boolean         // WebSocket connection state
  incomingAction: IncomingAction | null   // facilitator-side inbox for a player's turn
  streamingNarration: string    // live DM narration streamed from the server (typewriter)

  setMembership:   (m: Membership) => void
  clearMembership: () => void
  setParticipants: (p: Participant[]) => void
  setConnected:    (c: boolean) => void
  setIncomingAction:   (a: IncomingAction) => void
  clearIncomingAction: () => void
  setStreamingNarration:   (t: string) => void
  clearStreamingNarration: () => void
}

export const useRoomStore = create<RoomStore>()(
  persist(
    (set) => ({
      membership:     null,
      participants:   [],
      connected:      false,
      incomingAction: null,
      streamingNarration: '',
      setMembership:   (membership) => set({ membership }),
      clearMembership: () => set({ membership: null, participants: [], connected: false, incomingAction: null, streamingNarration: '' }),
      setParticipants: (participants) => set({ participants }),
      setConnected:    (connected) => set({ connected }),
      setIncomingAction:   (incomingAction) => set({ incomingAction }),
      clearIncomingAction: () => set({ incomingAction: null }),
      setStreamingNarration:   (streamingNarration) => set({ streamingNarration }),
      clearStreamingNarration: () => set({ streamingNarration: '' }),
    }),
    { name: 'dice-room-store', partialize: (s) => ({ membership: s.membership }) },
  ),
)
