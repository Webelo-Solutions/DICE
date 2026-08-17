import { makeDefaultCharacter } from '../data/classDefaults'
import type { Participant } from '../types/room'
import type { Character, DepartmentalSeat } from '../types/game'

// Turns the joined room roster into the two things a departmental session needs:
// the characters that will resolve rolls, and the seat map from participant to
// character and role.

export interface DepartmentalLineup {
  seats:   DepartmentalSeat[]
  players: Character[]
}

// A template character id is namespaced so it can never collide with a real
// roster character, and so the XP write-back can recognise and discard it
// without needing the participant row (decision D5).
export const TEMPLATE_ID_PREFIX = 'tmpl:'

export function isTemplateCharacterId(id: string): boolean {
  return id.startsWith(TEMPLATE_ID_PREFIX)
}

// Characters carry an optional base64 headshot, capped at 512KB by the pack
// schema. A session's `players` array is JSON-persisted to room_sessions AND
// broadcast to every socket on every turn — at six players that is already
// heavy, and at twenty it would be tens of megabytes per round. Departmental
// sessions therefore travel without avatars; the roster and character sheets
// still show them, because those read from the roster rather than the session.
function stripHeadshot(character: Character): Character {
  if (!character.headshot) return character
  const { headshot: _omitted, ...rest } = character
  return rest
}

export function buildDepartmentalLineup(participants: Participant[]): DepartmentalLineup {
  const seats: DepartmentalSeat[] = []
  const players: Character[] = []

  for (const p of participants) {
    if (p.role === 'facilitator' || !p.gameRole) continue

    // Their own character resolves the roll (decision D4) — but only if it is
    // actually that kind of specialist. A facilitator can reassign someone's
    // role in the lobby after they joined, and an Analyst sheet answering a
    // Hunter's turn would be incoherent, so a mismatch falls back to the role
    // baseline exactly as if they had never brought a character.
    const own = p.character && p.character.class === p.gameRole ? p.character : null
    const character = own
      ? stripHeadshot(own)
      : makeDefaultCharacter(`${TEMPLATE_ID_PREFIX}${p.id}`, p.displayName, p.gameRole)

    players.push(character)
    seats.push({
      participantId: p.id,
      characterId:   character.id,
      gameRole:      p.gameRole,
      displayName:   p.displayName,
      usesTemplate:  !own,
    })
  }

  return { seats, players }
}
