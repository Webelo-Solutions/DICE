import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Participant, Department, Suggestion, RoomRole, RoomMode } from '../types/room'

// What this client knows about the room it belongs to. The token is the bearer
// credential (same model as M1). Persisted so a refresh rejoins the same room.
export interface Membership {
  code:          string
  token:         string
  role:          RoomRole
  participantId: string
  displayName:   string
  roomName:      string
  // Which flow this room runs (decision D1). Optional on the type because
  // memberships persisted before departmental mode existed have no such key —
  // read it through `roomMode()` below rather than directly, so an older
  // localStorage entry resolves to 'standard' instead of undefined.
  mode?:         RoomMode
}

// Safe read of a possibly-legacy persisted membership.
export function roomMode(m: Membership | null): RoomMode {
  return m?.mode ?? 'standard'
}

// A player action relayed by the server to the facilitator's client for
// processing (Option A: auto-process through the game engine).
export interface IncomingAction {
  text:        string
  characterId: string
  displayName: string
  // Departmental sessions match the relayed action against the participant who
  // holds the turn, not the character: several people staff the same role, so
  // the character id cannot distinguish them.
  participantId: string
}

interface RoomStore {
  membership:   Membership | null
  participants: Participant[]   // live, from the WebSocket lobby broadcasts
  departments:  Department[]    // live, broadcast alongside participants
  // Suggestions for the turn in progress. Deliberately transient — advice is
  // about the decision in front of the room right now, and carrying it into
  // the next turn would put words in the next actor's mouth. The durable copy
  // lives server-side in participant_events.
  suggestions:  Suggestion[]
  connected:    boolean         // WebSocket connection state
  incomingAction: IncomingAction | null   // facilitator-side inbox for a player's turn
  streamingNarration: string    // live DM narration streamed from the server (typewriter)

  setMembership:   (m: Membership) => void
  clearMembership: () => void
  setParticipants: (p: Participant[]) => void
  setDepartments:  (d: Department[]) => void
  addSuggestion:   (s: Suggestion) => void
  // Called when the turn moves on, so the next actor starts from a clean slate.
  clearSuggestions: () => void
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
      departments:    [],
      suggestions:    [],
      connected:      false,
      incomingAction: null,
      streamingNarration: '',
      setMembership:   (membership) => set({ membership }),
      clearMembership: () => set({ membership: null, participants: [], departments: [], suggestions: [], connected: false, incomingAction: null, streamingNarration: '' }),
      setParticipants: (participants) => set({ participants }),
      setDepartments:  (departments) => set({ departments }),
      // Ignore a duplicate id — a reconnect can replay a broadcast, and the
      // same advice appearing twice reads as two people agreeing.
      addSuggestion:   (suggestion) => set((s) => s.suggestions.some((x) => x.id === suggestion.id)
        ? {}
        : { suggestions: [...s.suggestions, suggestion] }),
      clearSuggestions: () => set({ suggestions: [] }),
      setConnected:    (connected) => set({ connected }),
      setIncomingAction:   (incomingAction) => set({ incomingAction }),
      clearIncomingAction: () => set({ incomingAction: null }),
      setStreamingNarration:   (streamingNarration) => set({ streamingNarration }),
      clearStreamingNarration: () => set({ streamingNarration: '' }),
    }),
    { name: 'dice-room-store', partialize: (s) => ({ membership: s.membership }) },
  ),
)
