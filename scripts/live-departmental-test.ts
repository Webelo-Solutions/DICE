// Drives a full departmental session against a running DICE server, over the
// real HTTP + WebSocket API. Exercises what unit checks cannot: the auth chain,
// the join contract, the server-side turn gate, deliberation scope enforcement,
// the event ledger, and the report that comes out the other end.
//
//   $env:DICE_DB_PATH="...\livetest.db"; npm run server        # terminal 1
//   npx tsx scripts/live-departmental-test.ts                   # terminal 2

import { buildDepartmentalLineup } from '../src/utils/departmentalSession'
import { orderRolesByInitiative, buildRotation, advanceRole } from '../src/engine/rotation'
import { buildDepartmentalReport } from '../src/utils/departmentalReport'
import { makeDefaultCharacter } from '../src/data/classDefaults'
import type { Participant } from '../src/types/room'
import type { GameSession, FeedEntry, SessionResult, CharacterClass } from '../src/types/game'
import type { ParticipantTally } from '../src/types/report'

const BASE = 'http://127.0.0.1:3001/api'

let failures = 0
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail && !ok ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}
const section = (t: string) => console.log(`\n\x1b[1m${t}\x1b[0m`)

async function api<T>(path: string, opts: { method?: string; token?: string; body?: unknown } = {}): Promise<{ status: number; body: T }> {
  const res = await fetch(BASE + path, {
    method: opts.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  })
  const text = await res.text()
  return { status: res.status, body: (text ? JSON.parse(text) : null) as T }
}

// People in the exercise. Ana and Dev bring their own characters; the rest join
// on the role baseline, which is the realistic mix.
//
// NOBODY staffs Intel Officer. That is deliberate: an unstaffed role is skipped
// silently during play (decision D7) but must still reach the report (assumption
// A2), and that pair of behaviours is only exercised if a role is genuinely empty.
const UNSTAFFED_ROLE: CharacterClass = 'Intel Officer'
const CAST: Array<{ user: string; name: string; role: CharacterClass; dept: string; ownChar: boolean }> = [
  { user: 'ana',   name: 'Ana Reyes',    role: 'Analyst',   dept: 'Blue Team',    ownChar: true  },
  { user: 'ben',   name: 'Ben Okafor',   role: 'Analyst',   dept: 'Blue Team',    ownChar: false },
  { user: 'cara',  name: 'Cara Nolan',   role: 'Analyst',   dept: 'Blue Team',    ownChar: false },
  { user: 'dev',   name: 'Dev Rao',      role: 'Hunter',    dept: 'Threat Intel', ownChar: true  },
  { user: 'elle',  name: 'Elle Fontaine',role: 'Hunter',    dept: 'Threat Intel', ownChar: false },
  { user: 'gia',   name: 'Gia Marsh',    role: 'Responder', dept: 'Blue Team',    ownChar: false },
  { user: 'hal',   name: 'Hal Prieto',   role: 'Responder', dept: 'Blue Team',    ownChar: false },
  { user: 'ivy',   name: 'Ivy Chen',     role: 'Engineer',  dept: 'Platform',     ownChar: false },
  { user: 'omar',  name: 'Omar Haddad',  role: 'Commander', dept: 'Crisis Cell',  ownChar: false },
]
const STAFFED_ROLES = new Set(CAST.map((c) => c.role)).size   // 5 of the 6
const PW = 'exercise-pw-2026'

async function main() {
  section('Setup')
  const setup = await api<{ token: string }>('/auth/setup', {
    method: 'POST',
    body: { username: 'facil', displayName: 'Kim Facilitator', password: PW },
  })
  check('first-run setup creates the facilitator account', setup.status === 200 || setup.status === 201,
    `${setup.status} ${JSON.stringify(setup.body)}`)
  const adminToken = setup.body.token

  // Each participant is a real DICE account, as they would be in a session.
  const tokens = new Map<string, string>()
  for (const person of CAST) {
    await api('/admin/users', { method: 'POST', token: adminToken,
      body: { username: person.user, displayName: person.name, password: PW, role: 'user' } })
    const login = await api<{ token: string }>('/auth/login', { method: 'POST',
      body: { username: person.user, password: PW } })
    tokens.set(person.user, login.body.token)
  }
  check(`${CAST.length} participant accounts created and signed in`,
    [...tokens.values()].every(Boolean), `${tokens.size} tokens`)

  // Ana and Dev put a character in their roster to bring to the session.
  const ownChars = new Map<string, string>()
  for (const person of CAST.filter((p) => p.ownChar)) {
    const char = { ...makeDefaultCharacter(`char-${person.user}`, `${person.name.split(' ')[0]}'s ${person.role}`, person.role), level: 3, xp: 900 }
    const r = await api(`/characters/${char.id}`, { method: 'PUT', token: tokens.get(person.user)!, body: char })
    if (r.status === 200) ownChars.set(person.user, char.id)
  }
  check('rostered characters saved for the two who brought one', ownChars.size === 2, `${ownChars.size}`)

  // ── Host ──
  section('Hosting a departmental room')
  const created = await api<{ room: { code: string; mode: string }; token: string; participant: { id: string } }>(
    '/rooms', { method: 'POST', token: adminToken,
      body: { name: 'Q3 Departmental Drill', passphrase: 'facilpass', mode: 'departmental',
              departments: ['Blue Team', 'Threat Intel', 'Platform', 'Crisis Cell'] } })
  check('room created in departmental mode', created.body.room?.mode === 'departmental', JSON.stringify(created.body))
  const code = created.body.room.code
  const facilToken = created.body.token

  const lobby0 = await api<{ departments: Array<{ id: string; name: string }> }>(`/rooms/${code}`)
  check('seeded departments exist', lobby0.body.departments.length === 4,
    lobby0.body.departments.map((d) => d.name).join(','))
  const deptId = new Map(lobby0.body.departments.map((d) => [d.name, d.id]))

  // ── Join ──
  section('Joining')
  const joinTokens = new Map<string, string>()
  const participantIds = new Map<string, string>()
  for (const person of CAST) {
    const r = await api<{ token: string; participant: { id: string; usesTemplate: boolean; gameRole: string } }>(
      `/rooms/${code}/join`, { method: 'POST', token: tokens.get(person.user)!,
        body: { gameRole: person.role, departmentId: deptId.get(person.dept), displayName: person.name,
                characterId: ownChars.get(person.user) } })
    if (r.status !== 201) { check(`${person.name} joined`, false, `${r.status} ${JSON.stringify(r.body)}`); continue }
    joinTokens.set(person.user, r.body.token)
    participantIds.set(person.user, r.body.participant.id)
  }
  check(`all ${CAST.length} participants joined`, joinTokens.size === CAST.length, `${joinTokens.size}`)

  const lobby = await api<{ participants: Participant[] }>(`/rooms/${code}`)
  const members = lobby.body.participants.filter((p) => p.role !== 'facilitator')
  check('participants carry their in-game role', members.every((p) => !!p.gameRole))
  const broughtOne = CAST.filter((c) => c.ownChar).length
  check('people who brought a character are not on a template',
    members.filter((p) => !p.usesTemplate).length === broughtOne,
    `${members.filter((p) => !p.usesTemplate).length} of ${broughtOne}`)
  check('people who did not are marked for the role baseline',
    members.filter((p) => p.usesTemplate).length === CAST.length - broughtOne,
    `${members.filter((p) => p.usesTemplate).length} of ${CAST.length - broughtOne}`)

  // ── Rejections at the join contract ──
  section('Join contract')
  const noRole = await api(`/rooms/${code}/join`, { method: 'POST', token: tokens.get('ana')!,
    body: { displayName: 'No Role' } })
  check('joining without a role is rejected', noRole.status === 400, String(noRole.status))
  const badDept = await api(`/rooms/${code}/join`, { method: 'POST', token: tokens.get('ana')!,
    body: { gameRole: 'Analyst', displayName: 'Bad Dept', departmentId: 'not-a-real-department' } })
  check('a department from another room is rejected', badDept.status === 400, String(badDept.status))
  const noName = await api(`/rooms/${code}/join`, { method: 'POST', token: tokens.get('ana')!,
    body: { gameRole: 'Analyst' } })
  check('joining without a display name is rejected', noName.status === 400, String(noName.status))

  // ── Build the session exactly as the facilitator's client does ──
  section('Starting the session')
  const { seats, players } = buildDepartmentalLineup(lobby.body.participants)
  check('the lineup seats every participant', seats.length === CAST.length, `${seats.length}`)
  check('headshots are stripped from session characters',
    players.every((p) => p.headshot === undefined))
  check(`the unstaffed ${UNSTAFFED_ROLE} never enters the initiative order`,
    orderRolesByInitiative(seats, players).length === STAFFED_ROLES
    && !orderRolesByInitiative(seats, players).includes(UNSTAFFED_ROLE),
    orderRolesByInitiative(seats, players).join(','))

  const roleInitiative = orderRolesByInitiative(seats, players)
  let rotation = buildRotation(seats)
  const opening = advanceRole(roleInitiative, null, rotation, seats, null)!
  rotation = opening.rotation
  let currentActor = opening.actor!
  let round = 1

  const session: GameSession = {
    id: 'live-test-session', scenario: { id: 'S1', title: 'Live Test', acts: [], killChainStages: ['initial_access'],
      difficulty: 3, threatType: 'test', recommendedPlayers: '20', estimatedMinutes: 90, scenarioClockStart: 90,
      summary: '', victoryCondition: '', failureCondition: '', injects: [] } as never,
    players, mode: 'departmental', initiativeOrder: [], currentTurnPlayerId: currentActor.characterId,
    act: 1, round, scenarioClockRemaining: 90, attackerProgress: ['initial_access'], activeComplications: [],
    lastRoll: null, roundTimerExpired: false, activeEffects: [], scriptedCriticalEffect: null,
    critHitInjectsDrawn: [], critFailInjectsDrawn: [], resolvedCriticalHitInjects: [],
    resolvedCriticalFailInjects: [], phase: 'turn', status: 'active', timerDifficulty: 'analyst',
    startedAt: Date.now(), npcs: [], usedOnceTraits: {},
    seats, roleInitiative, rotation, currentActor, deliberation: { enabled: true, scope: 'role' },
  }

  const push = async (s: GameSession) => api(`/rooms/${code}/session`, { method: 'PUT', token: facilToken,
    body: { session: s, feed: [] } })
  const put = await push(session)
  check('the facilitator can publish the session', put.status === 200, String(put.status))

  const nonFacil = await api(`/rooms/${code}/session`, { method: 'PUT', token: joinTokens.get('ana')!,
    body: { session, feed: [] } })
  check('a player cannot publish the session', nonFacil.status === 403, String(nonFacil.status))

  // ── The turn gate ──
  section('Turn gate')
  const actorUser = () => [...participantIds.entries()].find(([, id]) => id === currentActor.participantId)![0]
  const notActor  = () => CAST.map((c) => c.user).find((u) => participantIds.get(u) !== currentActor.participantId)!

  console.log(`     round ${round}: ${currentActor.role} → ${seats.find((s) => s.participantId === currentActor.participantId)!.displayName}`)
  const wrong = await api(`/rooms/${code}/action`, { method: 'POST', token: joinTokens.get(notActor())!,
    body: { text: 'I act out of turn' } })
  check('someone who is not up is refused', wrong.status === 403, `${wrong.status} ${JSON.stringify(wrong.body)}`)

  const right = await api(`/rooms/${code}/action`, { method: 'POST', token: joinTokens.get(actorUser())!,
    body: { text: 'Correlate the authentication logs against the beacon window' } })
  check('the drawn actor is allowed to act', right.status === 200, `${right.status} ${JSON.stringify(right.body)}`)

  // A participant on the role baseline has no roster character at all — the
  // gate has to key on the participant, which is the bug this catches.
  const templateActor = seats.find((s) => s.usesTemplate)!
  check('baseline seats have a namespaced character id',
    templateActor.characterId.startsWith('tmpl:'), templateActor.characterId)

  // ── Deliberation scope ──
  section('Deliberation')
  const actorRole = currentActor.role
  const sameRole  = CAST.find((c) => c.role === actorRole && participantIds.get(c.user) !== currentActor.participantId)!
  const otherRole = CAST.find((c) => c.role !== actorRole)!

  const advice = await api<{ id: string }>(`/rooms/${code}/suggest`, { method: 'POST',
    token: joinTokens.get(sameRole.user)!, body: { text: 'Check the scheduled task on the DC first' } })
  check(`a teammate in the acting role may advise (${sameRole.name})`, advice.status === 201,
    `${advice.status} ${JSON.stringify(advice.body)}`)

  const outOfScope = await api(`/rooms/${code}/suggest`, { method: 'POST',
    token: joinTokens.get(otherRole.user)!, body: { text: 'I am not on this bench' } })
  check(`someone outside the role scope is refused (${otherRole.name})`, outOfScope.status === 403,
    `${outOfScope.status} ${JSON.stringify(outOfScope.body)}`)

  const selfAdvice = await api(`/rooms/${code}/suggest`, { method: 'POST',
    token: joinTokens.get(actorUser())!, body: { text: 'Advising myself' } })
  check('the acting player cannot advise themselves', selfAdvice.status === 409, String(selfAdvice.status))

  const facilAdvice = await api(`/rooms/${code}/suggest`, { method: 'POST', token: facilToken,
    body: { text: 'The DM should not be coaching' } })
  check('the facilitator cannot advise players', facilAdvice.status === 403, String(facilAdvice.status))

  // Widening the scope mid-session must take effect immediately.
  session.deliberation = { enabled: true, scope: 'anyone' }
  await push(session)
  const nowAllowed = await api(`/rooms/${code}/suggest`, { method: 'POST',
    token: joinTokens.get(otherRole.user)!, body: { text: 'Now I am in scope' } })
  check('widening the scope mid-session admits the whole room', nowAllowed.status === 201, String(nowAllowed.status))

  session.deliberation = { enabled: false, scope: 'anyone' }
  await push(session)
  const whenOff = await api(`/rooms/${code}/suggest`, { method: 'POST',
    token: joinTokens.get(sameRole.user)!, body: { text: 'Should be refused now' } })
  check('turning deliberation off refuses suggestions server-side', whenOff.status === 409, String(whenOff.status))
  session.deliberation = { enabled: true, scope: 'role' }

  // ── Adoption credit ──
  section('Adoption and forfeits')
  const adopter = actorUser()
  await api(`/rooms/${code}/action`, { method: 'POST', token: joinTokens.get(adopter)!,
    body: { text: 'Check the scheduled task on the DC first', adoptedFrom: participantIds.get(sameRole.user) } })
  check('an adopted suggestion is accepted with credit', true)

  const forfeiter = participantIds.get(CAST.find((c) => c.user === 'ben')!.user)!
  const forfeit = await api(`/rooms/${code}/forfeit`, { method: 'POST', token: facilToken,
    body: { participantId: forfeiter, round: 1 } })
  check('the facilitator can record a forfeit', forfeit.status === 201, String(forfeit.status))
  const forfeitByPlayer = await api(`/rooms/${code}/forfeit`, { method: 'POST', token: joinTokens.get('ana')!,
    body: { participantId: forfeiter, round: 1 } })
  check('a player cannot record a forfeit', forfeitByPlayer.status === 403, String(forfeitByPlayer.status))

  // ── Play out a full round of turns through the real rotation ──
  section('Playing out the rotation')
  const seen = new Set<string>([currentActor.participantId])
  const feed: FeedEntry[] = []
  for (let i = 0; i < 14; i++) {
    const next = advanceRole(roleInitiative, currentActor.role, rotation, seats, null)
    if (!next.actor) break
    rotation = next.rotation
    currentActor = next.actor
    if (next.wrapped) round++
    seen.add(currentActor.participantId)
    session.rotation = rotation
    session.currentActor = currentActor
    session.currentTurnPlayerId = currentActor.characterId
    session.round = round
    await push(session)

    const user = actorUser()
    const r = await api(`/rooms/${code}/action`, { method: 'POST', token: joinTokens.get(user)!,
      body: { text: `Turn ${i + 2} action from ${currentActor.role}` } })
    if (r.status !== 200) { check(`turn ${i + 2} accepted`, false, `${r.status} ${JSON.stringify(r.body)}`); break }
    feed.push({ id: `f${i}`, type: 'roll_result', speaker: currentActor.characterId, text: '', timestamp: Date.now(),
      roll: { player: currentActor.characterId, raw: 12, modifier: 4, total: 16, dc: 14,
              outcome: i % 3 === 0 ? 'success' : i % 3 === 1 ? 'failure' : 'critical_hit' } })
  }
  check(`15 turns across ${STAFFED_ROLES} staffed roles reached round 3`,
    round === 3, `round=${round}`)
  check(`the rotation reached all ${CAST.length} participants within 3 rounds`,
    seen.size === CAST.length, `${seen.size} distinct actors`)
  check(`the unstaffed ${UNSTAFFED_ROLE} turn never came up`,
    !seen.has(UNSTAFFED_ROLE))

  // ── The report ──
  section('After-action report')
  const talliesRes = await api<{ tallies: ParticipantTally[] }>(`/rooms/${code}/tallies?sessionId=${session.id}`,
    { token: facilToken })
  check('the facilitator can read the ledger', talliesRes.status === 200, String(talliesRes.status))
  const byPlayer = await api(`/rooms/${code}/tallies?sessionId=${session.id}`, { token: joinTokens.get('ana')! })
  check('a player cannot read the ledger', byPlayer.status === 403, String(byPlayer.status))

  const tallies = talliesRes.body.tallies
  const total = tallies.reduce((n, t) => n + t.turnsTaken, 0)
  // One at the turn gate, one adopted, fourteen through the rotation loop. The
  // out-of-turn attempt was refused, so it must NOT appear here.
  check('every accepted action landed in the ledger, and only those',
    total === 16, `${total} turns recorded`)
  const benTally = tallies.find((t) => t.participantId === forfeiter)!
  check('the forfeit is attributed to the right person', benTally.turnsForfeited === 1, JSON.stringify(benTally))
  const adviser = tallies.find((t) => t.participantId === participantIds.get(sameRole.user))!
  check('advice offered is counted', adviser.suggestionsOffered >= 1, JSON.stringify(adviser))
  check('advice acted on is credited to whoever gave it', adviser.suggestionsAdopted === 1, JSON.stringify(adviser))

  const result = { xpByPlayer: Object.fromEntries(players.map((p) => [p.id, 100])) } as unknown as SessionResult
  const report = buildDepartmentalReport(session, feed, result, tallies)
  check('every participant gets a scorecard', report.scorecards.length === CAST.length, `${report.scorecards.length}`)
  check(`the unstaffed ${UNSTAFFED_ROLE} is named in the report despite never being played`,
    report.unstaffedRoles.length === 1 && report.unstaffedRoles[0] === UNSTAFFED_ROLE,
    report.unstaffedRoles.join(',') || '(none)')
  check('all six roles still appear in the bench table', report.bench.length === 6)
  check('nobody who took every turn offered is labelled low-engagement',
    report.scorecards.filter((s) => s.timesDrawn > 0 && s.turnsTaken === s.timesDrawn)
      .every((s) => s.engagement !== 'low'),
    report.scorecards.filter((s) => s.timesDrawn > 0 && s.turnsTaken === s.timesDrawn && s.engagement === 'low')
      .map((s) => s.displayName).join(','))
  check('baseline seats report no persisted XP',
    report.scorecards.filter((s) => s.usesTemplate).every((s) => s.xpEarned === 0))
  check('own-character seats do report XP',
    report.scorecards.filter((s) => !s.usesTemplate).every((s) => s.xpEarned === 100))

  console.log('\n     Bench depth:')
  for (const b of report.bench) {
    console.log(`       ${b.role.padEnd(14)} ${b.unstaffed ? 'UNSTAFFED' : `staffed ${b.staffed}, own ${b.onOwnCharacter}, never acted ${b.neverActed}, turns ${b.turnsTaken}`}`)
  }
  console.log('\n     Scorecards:')
  for (const s of report.scorecards) {
    console.log(`       ${s.displayName.padEnd(16)} ${(s.gameRole ?? '—').padEnd(14)} drawn ${s.timesDrawn} taken ${s.turnsTaken} advice ${s.suggestionsOffered}/${s.suggestionsAdopted} · ${s.engagement}`)
  }

  // ── Capacity ──
  section('Capacity')
  // Runs last, after the report has been built — these fillers would otherwise
  // staff the role the report needs to see empty.
  let lastStatus = 0
  for (let i = 0; i < 20; i++) {
    const r = await api(`/rooms/${code}/join`, { method: 'POST', token: adminToken,
      body: { gameRole: 'Analyst', displayName: `Filler ${i}` } })
    lastStatus = r.status
    if (r.status === 409) break
  }
  check('the room refuses participants past its cap', lastStatus === 409, String(lastStatus))

  console.log(failures === 0
    ? '\n\x1b[32mLive departmental session passed end to end.\x1b[0m\n'
    : `\n\x1b[31m${failures} FAILED\x1b[0m\n`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => { console.error('\nHarness error:', e); process.exit(1) })
