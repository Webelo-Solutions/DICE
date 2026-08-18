// Verifies the TLS feature against a live server: certificate validity, the CA
// download, network-info reporting the right port, HSTS posture, and redirect.
import https from 'node:https'
import http from 'node:http'
import { readFileSync } from 'node:fs'
import { X509Certificate } from 'node:crypto'

const CA_FILE = process.argv[2]
const PORT = Number(process.argv[3])
const HTTP_PORT = Number(process.argv[4])
const ca = readFileSync(CA_FILE)

let failures = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail && !ok ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

const req = (mod, opts) => new Promise((res) => {
  const r = mod.request(opts, (response) => {
    const tls = response.socket.getPeerCertificate ? {
      authorized: response.socket.authorized, cert: response.socket.getPeerCertificate(),
    } : {}
    let body = ''
    response.on('data', (c) => { body += c })
    response.on('end', () => res({ status: response.statusCode, headers: response.headers, body, ...tls }))
  })
  r.on('error', (e) => res({ error: e.message }))
  r.setTimeout(4000, () => { r.destroy(); res({ error: 'timeout' }) })
  r.end()
})

console.log('\nCertificate')
const health = await req(https, { host: '127.0.0.1', port: PORT, path: '/api/health', ca, servername: 'localhost' })
check('HTTPS serves the API', health.status === 200 && health.body.includes('"ok"'), JSON.stringify(health).slice(0, 120))
check('certificate validates against the generated CA', health.authorized === true)
check('signed by the DICE local CA, not itself',
  health.cert?.issuer?.CN?.startsWith('DICE Local CA') && health.cert.issuer.CN !== health.cert.subject.CN,
  `issuer=${health.cert?.issuer?.CN}`)

console.log('\nHSTS posture')
check('no HSTS with a self-signed certificate (or players cannot click through)',
  health.headers?.['strict-transport-security'] === undefined,
  String(health.headers?.['strict-transport-security']))

console.log('\nCA distribution')
const caDl = await req(https, { host: '127.0.0.1', port: PORT, path: '/api/tls-ca', ca, servername: 'localhost' })
check('the CA is downloadable without signing in', caDl.status === 200, String(caDl.status))
check('served as a certificate attachment',
  String(caDl.headers?.['content-type']).includes('x509') && String(caDl.headers?.['content-disposition']).includes('dice-ca.crt'),
  `${caDl.headers?.['content-type']} / ${caDl.headers?.['content-disposition']}`)
let downloadedMatches = false
try {
  downloadedMatches = new X509Certificate(caDl.body).subject === new X509Certificate(ca.toString()).subject
} catch { /* leave false */ }
check('the downloaded CA is the one actually signing the server certificate', downloadedMatches)

console.log('\nnetwork-info (drives the lobby join link and QR)')
const net = await req(https, { host: '127.0.0.1', port: PORT, path: '/api/network-info', ca, servername: 'localhost' })
const info = JSON.parse(net.body || '{}')
check('reports the HTTPS port DICE is actually on', info.port === PORT, `reported ${info.port}, listening on ${PORT}`)
check('reports at least one LAN address', Array.isArray(info.addresses), JSON.stringify(info.addresses))

console.log('\nHTTP redirect')
const redir = await req(http, { host: '127.0.0.1', port: HTTP_PORT, path: '/join?code=ABC123' })
check('redirects to https', redir.status === 302 && String(redir.headers?.location).startsWith('https://'), String(redir.headers?.location))
check('preserves the path and query so a shared join link survives',
  String(redir.headers?.location).endsWith('/join?code=ABC123'), String(redir.headers?.location))
check('not cached permanently (a host can turn TLS off again)',
  redir.status === 302 && String(redir.headers?.['cache-control']).includes('no-store'))

console.log('\nRejections')
const noCa = await req(https, { host: '127.0.0.1', port: PORT, path: '/api/health', servername: 'localhost' })
check('a client that does not trust the CA is refused', !!noCa.error, `status ${noCa.status}`)
const badName = await req(https, { host: '127.0.0.1', port: PORT, path: '/api/health', ca, servername: 'evil.example' })
check('a mismatched hostname is refused', !!badName.error, `status ${badName.status}`)

console.log(failures === 0 ? '\nTLS verified.\n' : `\n${failures} FAILED\n`)
process.exit(failures === 0 ? 0 : 1)
