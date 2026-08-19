// Drives CPE attendance against a running DICE server, over the real HTTP +
// WebSocket API — run with `npm run verify:cpe:live [port]`.
//
// verify:cpe pins the arithmetic; this pins the thing the arithmetic runs on.
// Attendance is reconstructed from presence events that only exist because a
// socket opened or closed, so it cannot be exercised without real sockets:
// unit checks would happily pass over a server that never records a `present`
// event at all.
//
//   $env:DICE_DB_PATH="...\cpetest.db"; $env:DICE_TLS="off"; npm run server
//   npx tsx scripts/live-cpe-test.ts 3001

import { buildSessionCpeReport, attendedMinutes } from '../src/utils/cpe'
import type { ParticipantTally } from '../src/types/report'
import type { CharacterClass } from '../src/types/game'

const PORT = Number(process.argv[2] ?? 3001)
const BASE = `http://127.0.0.1:${PORT}/api`
const WS_BASE = `ws://127.0.0.1:${PORT}/api`

let failures = 0
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail && !ok ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}
const section = (t: string) => console.log(`\n\x1b[1m${t}\x1b[0m`)
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function api<T>(path: string, opts: { method?: string; token?: string; body?: unknown } = {}): Promise<{ status: number; body: T }> {
  const res = await fetch(BASE + path, {
    method: opts.method ?? 'GET',
    headers: { 'content-type': 'application/json', ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  })
  const text = await res.text()
  return { status: res.status, body: (text ? JSON.parse(text) : null) as T }
}

// Opens a participant socket and resolves once the server has acknowledged it,
// so a test step never races the connection it just made.
function connect(code: string, token: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`${WS_BASE}/rooms/${code}/ws?token=${encodeURIComponent(token)}`)
    const timer = setTimeout(() => reject(new Error('socket did not open')), 5000)
    socket.addEventListener('message', () => { clearTimeout(timer); resolve(socket) }, { once: true })
    socket.addEventListener('error', (e) => { clearTimeout(timer); reject(e) })
  })
}

const PW = 'cpe-live-pw-2026'
const CAST: Array<{ user: string; name: string; role: CharacterClass }> = [
  { user: 'cpe_ana', name: 'Ana Reyes',  role: 'Analyst' },
  { user: 'cpe_ben', name: 'Ben Okafor', role: 'Hunter'  },
  { user: 'cpe_gia', name: 'Gia Marsh',  role: 'Responder' },
]

async function main() {
  section('Setup')
  const me = await api<{ setupRequired?: boolean }>('/auth/me')
  const admin = me.body?.setupRequired
    ? await api<{ token: string }>('/auth/setup', { method: 'POST', body: { username: 'cpe_facil', displayName: 'Kim Facilitator', password: PW } })
    : await api<{ token: string }>('/auth/login', { method: 'POST', body: { username: 'cpe_facil', password: PW } })
  const adminToken = admin.body.token
  check('facilitator signed in', !!adminToken)

  const tokens = new Map<string, string>()
  for (const person of CAST) {
    await api('/admin/users', { method: 'POST', token: adminToken, body: { username: person.user, displayName: person.name, password: PW, role: 'user' } })
    const login = await api<{ token: string }>('/auth/login', { method: 'POST', body: { username: person.user, password: PW } })
    tokens.set(person.user, login.body.token)
  }
  check('participant accounts signed in', [...tokens.values()].every(Boolean))

  const created = await api<{ room: { code: string }; token: string }>('/rooms', {
    method: 'POST', token: adminToken,
    body: { name: 'CPE Attendance Drill', passphrase: 'facilpass', mode: 'departmental', departments: ['Blue Team'] },
  })
  const code = created.body.room.code
  const facilToken = created.body.token
  check('departmental room created', !!code)

  const joinTokens = new Map<string, string>()
  const participantIds = new Map<string, string>()
  for (const person of CAST) {
    const r = await api<{ token: string; participant: { id: string } }>(`/rooms/${code}/join`, {
      method: 'POST', token: tokens.get(person.user)!,
      body: { gameRole: person.role, departmentId: null, displayName: person.name },
    })
    joinTokens.set(person.user, r.body.token)
    participantIds.set(person.user, r.body.participant.id)
  }
  check('participants joined', joinTokens.size === CAST.length)

  // ── Attendance ─────────────────────────────────────────────────────────────
  section('Attendance capture')

  // Ana and Ben are connected before the exercise starts; Gia arrives late.
  const anaSocket = await connect(code, joinTokens.get('cpe_ana')!)
  const benSocket = await connect(code, joinTokens.get('cpe_ben')!)
  check('two participants connected before the session', !!anaSocket && !!benSocket)

  const sessionId = `cpe-live-${Date.now()}`
  const startedAt = Date.now()
  const session = { id: sessionId, status: 'active', round: 1, mode: 'departmental' }
  const put = await api(`/rooms/${code}/session`, { method: 'PUT', token: facilToken, body: { session, feed: [] } })
  check('the facilitator started the session', put.status === 200, String(put.status))

  await wait(600)

  // Gia arrives after the start — she should be credited from her arrival, not
  // from the beginning.
  const giaSocket = await connect(code, joinTokens.get('cpe_gia')!)
  await wait(600)

  // Ben drops and does not come back.
  benSocket.close()
  await wait(800)

  const endedAt = Date.now()

  const talliesRes = await api<{ tallies: ParticipantTally[] }>(`/rooms/${code}/tallies?sessionId=${sessionId}`, { token: facilToken })
  check('the facilitator can read the ledger', talliesRes.status === 200, String(talliesRes.status))
  const tallies = talliesRes.body.tallies
  const forUser = (user: string) => tallies.find((t) => t.participantId === participantIds.get(user))!

  // The core claim: presence was recorded at all. Without the `present` event
  // emitted at session start, everyone connected beforehand would read as absent.
  check('someone connected before the start has presence recorded',
    (forUser('cpe_ana').presence?.length ?? 0) > 0, JSON.stringify(forUser('cpe_ana').presence))
  check('a late arrival has presence recorded',
    (forUser('cpe_gia').presence?.length ?? 0) > 0, JSON.stringify(forUser('cpe_gia').presence))
  check('someone who dropped has a closed span',
    (forUser('cpe_ben').presence ?? []).every((s) => s.to <= endedAt), JSON.stringify(forUser('cpe_ben').presence))
  check('the ledger carries the account behind each seat',
    tallies.every((t) => !!t.ownerUserId), JSON.stringify(tallies.map((t) => t.ownerUserId)))
  check('a drop is counted', forUser('cpe_ben').disconnects === 1, String(forUser('cpe_ben').disconnects))

  const anaMs = attendedMinutes(forUser('cpe_ana').presence ?? [], startedAt, endedAt) * 60000
  const benMs = attendedMinutes(forUser('cpe_ben').presence ?? [], startedAt, endedAt) * 60000
  const giaMs = attendedMinutes(forUser('cpe_gia').presence ?? [], startedAt, endedAt) * 60000
  console.log(`     measured: Ana ${Math.round(anaMs)}ms · Ben ${Math.round(benMs)}ms · Gia ${Math.round(giaMs)}ms`)

  check('the person who stayed throughout has the most time', anaMs > benMs && anaMs > giaMs)
  check('the late arrival has less than the whole session', giaMs < anaMs)
  check('the person who left early has less than the whole session', benMs < anaMs)
  check('nobody is credited beyond the session window', [anaMs, benMs, giaMs].every((ms) => ms <= endedAt - startedAt + 50))

  anaSocket.close()
  giaSocket.close()

  // ── Certificate ────────────────────────────────────────────────────────────
  // The live session above lasts seconds, which correctly earns zero credit, so
  // the certificate path is exercised against a record with real durations.
  section('Certificate issue')
  const HOUR = 3600_000
  const base = Date.now() - 3 * HOUR
  const cpe = buildSessionCpeReport('Operation Blackout', base, base + 2 * HOUR, [
    { ...forUser('cpe_ana'), presence: [{ from: base, to: base + 2 * HOUR }] },
    { ...forUser('cpe_gia'), presence: [{ from: base, to: base + 10 * 60000 }] },
  ])
  const recordId = `cpe-cert-${Date.now()}`
  const record = {
    id: recordId, scenarioId: 'sc-1', scenarioTitle: 'Operation Blackout', difficulty: 3,
    outcome: 'victory', playerCount: 2, players: [], learningPath: [], playedAt: base + 2 * HOUR,
    result: { roundsPlayed: 6, xpAwarded: 100, criticalHits: 1, criticalFails: 0, startedAt: base, endedAt: base + 2 * HOUR, xpByPlayer: {} },
    cpe,
  }
  const stored = await api(`/session-history`, { method: 'POST', token: adminToken, body: record })
  check('the session record stores its CPE block', stored.status === 200, String(stored.status))

  const anaId = participantIds.get('cpe_ana')!
  const giaId = participantIds.get('cpe_gia')!

  const certRes = await fetch(`${BASE}/session-history/${recordId}/cpe/${anaId}/certificate.pdf`, {
    headers: { authorization: `Bearer ${adminToken}` },
  })
  const pdf = Buffer.from(await certRes.arrayBuffer())
  check('a certificate is issued for a full attendee', certRes.status === 200, String(certRes.status))
  check('it is a PDF', pdf.subarray(0, 4).toString() === '%PDF', pdf.subarray(0, 8).toString())
  check('it is a real document, not an empty page', pdf.length > 1000, `${pdf.length} bytes`)
  check('it is offered as a download named for the attendee',
    (certRes.headers.get('content-disposition') ?? '').includes('Ana-Reyes'),
    certRes.headers.get('content-disposition') ?? '')

  // Refusing is the right answer here: a certificate reading 0.0 CPE looks like
  // a claim, and issuing one would invite it being submitted.
  const noCredit = await api(`/session-history/${recordId}/cpe/${giaId}/certificate.pdf`, { token: adminToken })
  check('no certificate for someone who earned nothing', noCredit.status === 409, String(noCredit.status))

  const unknown = await api(`/session-history/${recordId}/cpe/not-a-participant/certificate.pdf`, { token: adminToken })
  check('an unknown participant is a 404', unknown.status === 404, String(unknown.status))

  const otherUser = await api(`/session-history/${recordId}/cpe/${anaId}/certificate.pdf`, { token: tokens.get('cpe_ben')! })
  check('someone else cannot pull a certificate from this record', otherUser.status === 403, String(otherUser.status))

  const anon = await api(`/session-history/${recordId}/cpe/${anaId}/certificate.pdf`)
  check('an anonymous caller is refused', anon.status === 401, String(anon.status))

  console.log(failures === 0 ? '\nCPE attendance and certificates hold.\n' : `\n${failures} FAILED\n`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
