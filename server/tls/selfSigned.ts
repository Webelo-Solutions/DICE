import { generate } from 'selfsigned'
import { isIP } from 'node:net'
import { hostname } from 'node:os'
import { readCertPair, writeCertPair, certUsableFor, inspectCert, certPaths } from './store'
import type { CertPair } from './store'

// ─── Self-signed certificates ─────────────────────────────────────────────────
//
// Two certificates, not one. A long-lived local CA signs a short-lived server
// certificate, so a host can distribute the CA once — import it on twenty
// devices, or push it by GPO — and every subsequent server certificate is
// trusted automatically. A bare self-signed certificate would have to be
// re-imported on every rotation, which in practice means nobody imports
// anything and twenty people are taught to click through TLS warnings instead.

const CA_NAME     = 'dice-ca'
const SERVER_NAME = 'dice'

const CA_DAYS     = 3650   // ten years: the trust anchor should outlive the install
const SERVER_DAYS = 398    // the ceiling browsers accept for a server certificate

// sha1 is the library default and is rejected by modern browsers.
const ALGORITHM = 'sha256'

function altNameEntries(names: string[]) {
  return names.map((name) => isIP(name)
    ? { type: 7 as const, ip: name }
    : { type: 2 as const, value: name })
}

async function generateCa(): Promise<CertPair> {
  const pems = await generate(
    [
      { name: 'commonName',       value: `DICE Local CA (${hostname()})` },
      { name: 'organizationName', value: 'DICE' },
    ],
    {
      algorithm: ALGORITHM,
      keySize: 2048,
      notAfterDate: new Date(Date.now() + CA_DAYS * 86_400_000),
      extensions: [
        { name: 'basicConstraints', cA: true, critical: true },
        { name: 'keyUsage', keyCertSign: true, cRLSign: true, digitalSignature: true, critical: true },
      ],
    },
  )
  return { key: pems.private, cert: pems.cert }
}

async function generateServerCert(ca: CertPair, names: string[]): Promise<CertPair> {
  // The common name is legacy — browsers have validated against SANs alone for
  // years — but a readable one helps whoever inspects the certificate.
  const primary = names.find((n) => !isIP(n) && n !== 'localhost') ?? names[0] ?? 'localhost'
  const pems = await generate(
    [
      { name: 'commonName',       value: primary },
      { name: 'organizationName', value: 'DICE' },
    ],
    {
      algorithm: ALGORITHM,
      keySize: 2048,
      notAfterDate: new Date(Date.now() + SERVER_DAYS * 86_400_000),
      ca: { key: ca.key, cert: ca.cert },
      extensions: [
        { name: 'basicConstraints', cA: false, critical: true },
        { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, critical: true },
        { name: 'extKeyUsage', serverAuth: true },
        { name: 'subjectAltName', altNames: altNameEntries(names) },
      ],
    },
  )
  // Serve the chain so a client that trusts the CA can build a path even
  // without having the CA cached from a previous connection.
  return { key: pems.private, cert: `${pems.cert}\n${ca.cert}` }
}

export interface SelfSignedResult {
  pair:      CertPair
  caCertPem: string
  /** True when something was issued on this boot, for the startup log. */
  issued:    boolean
}

/**
 * Returns a usable server certificate, generating the CA and/or the server
 * certificate only when needed. Safe to call on every boot.
 *
 * Regeneration is triggered by expiry OR by the host gaining a name it cannot
 * currently serve — a laptop that joins a new network gets a fresh certificate
 * rather than handing players a name-mismatch error.
 */
export async function ensureSelfSignedCert(names: string[]): Promise<SelfSignedResult> {
  let issued = false

  let ca = readCertPair(CA_NAME)
  // A CA within a year of expiry is replaced now rather than mid-exercise;
  // that does mean re-distributing it, which is why it is valid for a decade.
  if (!ca || !certUsableFor(ca.cert, [], 365)) {
    ca = await generateCa()
    writeCertPair(CA_NAME, ca)
    issued = true
  }

  let server = readCertPair(SERVER_NAME)
  const caChanged = issued
  if (!server || caChanged || !certUsableFor(server.cert, names)) {
    server = await generateServerCert(ca, names)
    writeCertPair(SERVER_NAME, server)
    issued = true
  }

  return { pair: server, caCertPem: ca.cert, issued }
}

/** Where the CA certificate lives, for the download link and setup docs. */
export function caCertPath(): string {
  return certPaths(CA_NAME).certPath
}

/**
 * The CA certificate itself, for handing to players so they can trust this
 * install once rather than dismissing a warning on every device. Null when no
 * local CA exists — a Let's Encrypt host has nothing to distribute.
 */
export function readCaCertPem(): string | null {
  return readCertPair(CA_NAME)?.cert ?? null
}

export function describeCurrentCert(): string {
  const server = readCertPair(SERVER_NAME)
  const info = server && inspectCert(server.cert)
  if (!info) return 'no certificate yet'
  return `${info.subject} — expires in ${info.daysRemaining} day${info.daysRemaining === 1 ? '' : 's'}`
}
