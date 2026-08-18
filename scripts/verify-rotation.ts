// Verifies the departmental rotation invariants — run with `npm run verify:rotation`.
//
// The rotation is the load-bearing new logic in departmental mode and the only
// part where a subtle bug is invisible in play: a session would simply run, and
// someone would quietly never be called on. These checks pin the guarantees the
// design actually promises, above all "everyone acts before anyone repeats."
import { buildRotation, advanceRole, drawActor, staffedRoles } from '../src/engine/rotation'
import type { DepartmentalSeat, Character, CharacterClass } from '../src/types/game'
import { makeDefaultCharacter } from '../src/data/classDefaults'

let failures = 0
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail && !ok ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

// 20 participants across the six roles: 4/4/4/3/3/2.
const STAFFING: Array<[CharacterClass, number]> = [
  ['Analyst', 4], ['Hunter', 4], ['Responder', 4], ['Engineer', 3], ['Intel Officer', 3], ['Commander', 2],
]
const seats: DepartmentalSeat[] = []
const players: Character[] = []
for (const [role, n] of STAFFING) {
  for (let i = 0; i < n; i++) {
    const pid = `${role}-${i}`
    const char = makeDefaultCharacter(`tmpl:${pid}`, pid, role)
    players.push(char)
    seats.push({ participantId: pid, characterId: char.id, gameRole: role, displayName: pid, usesTemplate: true })
  }
}
console.log(`\n${seats.length} participants, ${staffedRoles(seats).length} staffed roles\n`)

// ── 1. Drain before refill: nobody acts twice until everyone in the role has ──
{
  let rotation = buildRotation(seats)
  const drawnOrder: string[] = []
  for (let i = 0; i < 4; i++) {
    const r = drawActor(rotation, 'Analyst', seats, null)!
    rotation = r.rotation
    drawnOrder.push(r.actor.participantId)
  }
  check('a 4-person pool yields 4 distinct people before repeating',
    new Set(drawnOrder).size === 4, drawnOrder.join(','))

  const fifth = drawActor(rotation, 'Analyst', seats, null)!
  check('the 5th draw refills the pool and returns a valid member',
    fifth.actor.participantId.startsWith('Analyst-'), fifth.actor.participantId)
  check('after refill the pool holds the other 3',
    fifth.rotation['Analyst'].pool.length === 3, String(fifth.rotation['Analyst'].pool.length))
}

// ── 2. Round length is independent of headcount ──
{
  const roleInit = staffedRoles(seats)
  let rotation = buildRotation(seats)
  let from: CharacterClass | null = null
  let turns = 0
  let round = 1   // sessions start on round 1, as initSession does
  for (let i = 0; i < 60; i++) {
    const r = advanceRole(roleInit, from, rotation, seats, null)
    if (!r.actor) break
    if (r.wrapped) round++
    rotation = r.rotation
    from = r.actor.role
    turns++
  }
  // 60 turns is exactly 10 cycles of 6 roles. The counter starts at 1 and only
  // wraps on re-entering the top of the order, so it takes 9 wraps to read 10 —
  // the 10th wrap is the first turn of round 11.
  check('60 turns land on round 10 with 6 staffed roles',
    turns === 60 && round === 10, `turns=${turns} round=${round}`)
}

// ── 3. The opening draw is not a wrap (would start the session on round 2) ──
{
  const roleInit = staffedRoles(seats)
  const first = advanceRole(roleInit, null, buildRotation(seats), seats, null)
  check('the opening draw does not count as a wrap', first.wrapped === false)
  check('the opening draw lands on the first role in the order',
    first.actor?.role === roleInit[0], String(first.actor?.role))
}

// ── 4. Everyone gets a turn within a bounded number of rounds ──
{
  const roleInit = staffedRoles(seats)
  let rotation = buildRotation(seats)
  let from: CharacterClass | null = null
  const seen = new Set<string>()
  let rounds = 0
  for (let i = 0; i < 6 * 4 && seen.size < seats.length; i++) {
    const r = advanceRole(roleInit, from, rotation, seats, null)
    if (!r.actor) break
    if (r.wrapped) rounds++
    seen.add(r.actor.participantId)
    rotation = r.rotation
    from = r.actor.role
  }
  check('all 20 participants act within 4 rounds (deepest pool = 4)',
    seen.size === seats.length && rounds <= 4, `seen=${seen.size} rounds=${rounds}`)
}

// ── 5. Disconnected members are skipped but keep their place in the pool ──
{
  const online = new Set(seats.map((s) => s.participantId))
  online.delete('Analyst-0'); online.delete('Analyst-1')
  let rotation = buildRotation(seats)
  const drawn: string[] = []
  for (let i = 0; i < 2; i++) {
    const r = drawActor(rotation, 'Analyst', seats, online)!
    rotation = r.rotation
    drawn.push(r.actor.participantId)
  }
  check('offline members are never drawn',
    !drawn.includes('Analyst-0') && !drawn.includes('Analyst-1'), drawn.join(','))
  check('offline members remain in the pool awaiting reconnect',
    rotation['Analyst'].pool.includes('Analyst-0') && rotation['Analyst'].pool.includes('Analyst-1'),
    rotation['Analyst'].pool.join(','))

  // With both online members spent, the next draw must refill rather than
  // deadlocking on the two offline entries.
  const next = drawActor(rotation, 'Analyst', seats, online)
  check('a pool holding only offline members refills instead of deadlocking',
    next !== null && online.has(next.actor.participantId), String(next?.actor.participantId))
}

// ── 6. A wholly-offline role is passed over, not stalled on ──
{
  const roleInit = staffedRoles(seats)
  const online = new Set(seats.filter((s) => s.gameRole !== roleInit[1]).map((s) => s.participantId))
  const r = advanceRole(roleInit, roleInit[0], buildRotation(seats), seats, online)
  check('an entirely offline role is skipped to the next one',
    r.actor?.role === roleInit[2], `${String(r.actor?.role)} (expected ${roleInit[2]})`)
}

// ── 7. Nobody online anywhere → hold, do not blank the actor or bump the round ──
{
  const roleInit = staffedRoles(seats)
  const r = advanceRole(roleInit, roleInit[0], buildRotation(seats), seats, new Set())
  check('a fully offline room holds position', r.actor === null && r.wrapped === false)
}

// ── 8. Unstaffed roles never enter the order (decision D7) ──
{
  const partial = seats.filter((s) => s.gameRole === 'Analyst' || s.gameRole === 'Commander')
  const roles = staffedRoles(partial)
  check('only staffed roles enter the initiative order',
    roles.length === 2 && roles.includes('Analyst') && roles.includes('Commander'), roles.join(','))
  const r = advanceRole(roles, 'Commander', buildRotation(partial), partial, null)
  check('a 2-role session wraps after 2 turns, not 6', r.wrapped === true && r.actor?.role === 'Analyst',
    `${String(r.actor?.role)} wrapped=${r.wrapped}`)
}

console.log(failures === 0 ? '\nAll rotation invariants hold.\n' : `\n${failures} FAILED\n`)
process.exit(failures === 0 ? 0 : 1)
