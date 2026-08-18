// Verifies the room-code hardening against a running server.
//   node scripts/verify-room-codes.mjs [port]
// Expects a server with no admin yet (it runs first-run setup).
import { readFileSync } from 'node:fs'
import https from 'node:https'
import http from 'node:http'

const PORT = Number(process.argv[2] ?? 3001)
const CA = process.argv[3]
const agent = CA ? new https.Agent({ ca: readFileSync(CA) }) : undefined
const mod = CA ? https : http
const scheme = CA ? 'https' : 'http'

let failures = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail && !ok ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

function call(path, { method = 'GET', token, body } = {}) {
  return new Promise((res) => {
    const r = mod.request({
      host: '127.0.0.1', port: PORT, path: `/api${path}`, method, agent, servername: 'localhost',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    }, (response) => {
      let text = ''
      response.on('data', (c) => { text += c })
      response.on('end', () => { let j = null; try { j = text ? JSON.parse(text) : null } catch {} ; res({ status: response.statusCode, body: j, raw: text }) })
    })
    r.on('error', (e) => res({ error: e.message }))
    r.end(body === undefined ? undefined : JSON.stringify(body))
  })
}

const me = await call('/auth/me')
let token = me.body?.setupRequired
  ? (await call('/auth/setup', { method: 'POST', body: { username: 'rc', displayName: 'RC', password: 'room-code-pw-2026' } })).body?.token
  : (await call('/auth/login', { method: 'POST', body: { username: 'rc', password: 'room-code-pw-2026' } })).body?.token
if (!token) { console.log('could not authenticate; aborting'); process.exit(1) }

console.log(`\nUsing ${scheme}://127.0.0.1:${PORT}`)

console.log('\nCode entropy')
const made = await call('/rooms', { method: 'POST', token, body: { name: 'Hardening Test', passphrase: 'testpass' } })
const code = made.body?.room?.code
check('a room is created', made.status === 201, JSON.stringify(made.body).slice(0, 120))
check('the code is 8 characters', code?.length === 8, `${code} (${code?.length})`)
check('the alphabet excludes ambiguous characters (0/O/1/I)',
  /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/.test(code ?? ''), code)
// 32^8 vs 32^6 — the point of the change.
console.log(`     keyspace ${(32 ** (code?.length ?? 0)).toExponential(2)} (was ${(32 ** 6).toExponential(2)})`)

console.log('\nDisclosure to an anonymous caller (what a guessed code yields)')
const anon = await call(`/rooms/${code}`)
check('the room itself is still visible (the spectator view needs it)', anon.status === 200, String(anon.status))
check('participant names are NOT disclosed', anon.body?.participants === undefined,
  JSON.stringify(anon.body?.participants))
check('no participant name appears anywhere in the response',
  !/facilitator/i.test(anon.raw ?? ''), (anon.raw ?? '').slice(0, 160))

console.log('\nDisclosure to a signed-in DICE user')
const authed = await call(`/rooms/${code}`, { token })
check('participants are returned', Array.isArray(authed.body?.participants), JSON.stringify(authed.body?.participants))
check('the facilitator is among them', (authed.body?.participants ?? []).some((p) => p.role === 'facilitator'))

console.log('\nEnumeration rate limit')
let limited = 0, ok200 = 0, notFound = 0
for (let i = 0; i < 30; i++) {
  const r = await call(`/rooms/ZZZZZZZ${String.fromCharCode(65 + (i % 26))}`)
  if (r.status === 429) limited++
  else if (r.status === 404) notFound++
  else if (r.status === 200) ok200++
}
check('guessing is throttled well before 30 attempts', limited > 0, `${notFound} x404, ${limited} x429`)
check('the throttle engages at roughly the configured 20/min', notFound <= 21, `${notFound} allowed through`)
console.log(`     ${notFound} rejected as not-found, ${limited} rate-limited, ${ok200} found`)

// The throttle must not break a legitimate client, which calls this rarely.
console.log('\nNormal use is unaffected')
check('the API at large is still responsive under the same IP', (await call('/health')).status === 200)

console.log(failures === 0 ? '\nRoom-code hardening verified.\n' : `\n${failures} FAILED\n`)
process.exit(failures === 0 ? 0 : 1)
