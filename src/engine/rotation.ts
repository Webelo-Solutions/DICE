import type { CharacterClass, Character, DepartmentalSeat, RotationPool, CurrentActor } from '../types/game'
import { GAME_ROLES } from '../types/room'

// ─── Departmental rotation ────────────────────────────────────────────────────
//
// In departmental mode the ROLE takes the turn, not the person (decision D1).
// That is what keeps a 20-person session the same length as a 6-person one:
// the initiative order is at most six entries no matter how many humans joined.
//
// Who acts for a role each round is drawn from that role's pool WITHOUT
// replacement (decision D3) — the pool drains completely before it refills, so
// everyone staffing a role acts once before anyone acts twice. Pure per-round
// randomness would let someone attend a whole session and never be called on,
// which is unacceptable when attendance is mandatory.

function shuffle<T>(items: T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function seatsForRole(seats: DepartmentalSeat[], role: CharacterClass): DepartmentalSeat[] {
  return seats.filter((s) => s.gameRole === role)
}

// Roles with at least one person staffing them, in the canonical order. An
// unstaffed role never enters the initiative order at all (decision D7): its
// turn is skipped silently, and the capability is simply absent from play.
export function staffedRoles(seats: DepartmentalSeat[]): CharacterClass[] {
  return GAME_ROLES.filter((role) => seatsForRole(seats, role).length > 0)
}

// Roles have no agility of their own, so a role's initiative is taken from the
// quickest person staffing it — matching how a standard session rolls initiative
// per character (agility, +3 for First Responder, plus a d20). Rolled once at
// session start and then fixed, so the order does not churn as the rotation
// moves through different people (assumption A1).
export function orderRolesByInitiative(seats: DepartmentalSeat[], players: Character[]): CharacterClass[] {
  const byId = new Map(players.map((p) => [p.id, p]))
  const score = (role: CharacterClass): number => {
    const rolls = seatsForRole(seats, role).map((seat) => {
      const char = byId.get(seat.characterId)
      if (!char) return 0
      return char.stats.agility + (char.traits.includes('First Responder') ? 3 : 0)
    })
    return Math.max(...rolls, 0) + Math.floor(Math.random() * 20) + 1
  }
  return staffedRoles(seats)
    .map((role) => ({ role, score: score(role) }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.role)
}

export function buildRotation(seats: DepartmentalSeat[]): Record<string, RotationPool> {
  const rotation: Record<string, RotationPool> = {}
  for (const role of staffedRoles(seats)) {
    rotation[role] = { pool: shuffle(seatsForRole(seats, role).map((s) => s.participantId)), drawn: [] }
  }
  return rotation
}

export interface DrawResult {
  actor:    CurrentActor
  rotation: Record<string, RotationPool>
}

// Picks who acts for `role` this round and returns the advanced rotation.
//
// `connected` is the set of participants with an open socket. They are skipped
// at selection rather than being handed a turn nobody is there to take
// (decision D14) — but they stay IN the pool, so they still get their turn once
// they are back rather than losing their place in the cycle.
//
// Returns null when the role cannot act at all (nobody staffing it is
// connected), in which case the caller should move on to the next role.
export function drawActor(
  rotation:  Record<string, RotationPool>,
  role:      CharacterClass,
  seats:     DepartmentalSeat[],
  connected: Set<string> | null,
): DrawResult | null {
  const roleSeats = seatsForRole(seats, role)
  if (roleSeats.length === 0) return null

  // A null `connected` means "connectivity unknown" (e.g. a solo facilitator
  // replaying), so treat everyone as available rather than stalling the session.
  const isEligible = (id: string): boolean => connected === null || connected.has(id)

  let current = rotation[role] ?? { pool: shuffle(roleSeats.map((s) => s.participantId)), drawn: [] }
  let candidate = current.pool.find(isEligible)

  // Nobody left in this cycle is available — the cycle is spent as far as this
  // round is concerned, so refill and reshuffle for the next pass.
  if (!candidate) {
    current = { pool: shuffle(roleSeats.map((s) => s.participantId)), drawn: [] }
    candidate = current.pool.find(isEligible)
  }
  if (!candidate) return null   // the whole role is offline

  const seat = roleSeats.find((s) => s.participantId === candidate)
  if (!seat) return null

  return {
    actor: { role, participantId: seat.participantId, characterId: seat.characterId },
    rotation: {
      ...rotation,
      [role]: {
        pool:  current.pool.filter((id) => id !== candidate),
        drawn: [...current.drawn, candidate],
      },
    },
  }
}

// Advances to the next staffed role that can actually field someone, wrapping
// to the start of the order. Returns the drawn actor, the advanced rotation,
// and whether the wrap happened (which is what increments the round).
export interface AdvanceResult {
  actor:      CurrentActor | null
  rotation:   Record<string, RotationPool>
  wrapped:    boolean
}

export function advanceRole(
  roleInitiative: CharacterClass[],
  fromRole:       CharacterClass | null,
  rotation:       Record<string, RotationPool>,
  seats:          DepartmentalSeat[],
  connected:      Set<string> | null,
): AdvanceResult {
  if (roleInitiative.length === 0) return { actor: null, rotation, wrapped: false }

  const startIndex = fromRole ? roleInitiative.indexOf(fromRole) : -1
  let wrapped = false

  // Walk forward at most one full lap. A role whose entire staff is offline is
  // passed over rather than stalling the session on an empty seat.
  for (let step = 1; step <= roleInitiative.length; step++) {
    const index = (startIndex + step) % roleInitiative.length
    // Passing back through the top of the order is what ends a round — but only
    // when we were already somewhere in it. The opening draw of a session
    // starts AT the top and must not count as having come round again.
    if (index === 0 && fromRole !== null) wrapped = true
    const result = drawActor(rotation, roleInitiative[index], seats, connected)
    if (result) return { actor: result.actor, rotation: result.rotation, wrapped }
  }
  // Every role is offline — hold position and let the facilitator sort it out.
  return { actor: null, rotation, wrapped: false }
}
