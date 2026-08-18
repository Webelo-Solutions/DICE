import { X509Certificate } from 'node:crypto'
import { isIP } from 'node:net'
import { mkdirSync, readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Certificates live beside the database so a backup of the DICE data directory
// captures them, and so an upgrade never overwrites a working certificate.
// DICE_DB_PATH is the anchor because that is what the installer already sets.
const DEFAULT_DB = resolve(dirname(fileURLToPath(import.meta.url)), '../../data/dice.db')

export function certDir(): string {
  return resolve(dirname(process.env.DICE_DB_PATH ?? DEFAULT_DB), 'certs')
}

export interface CertPair {
  key:  string   // PEM private key
  cert: string   // PEM certificate (leaf first if a chain)
}

export interface CertPaths { keyPath: string; certPath: string }

export function certPaths(name: string): CertPaths {
  const dir = certDir()
  return { keyPath: resolve(dir, `${name}.key`), certPath: resolve(dir, `${name}.crt`) }
}

export function readCertPair(name: string): CertPair | null {
  const { keyPath, certPath } = certPaths(name)
  if (!existsSync(keyPath) || !existsSync(certPath)) return null
  try {
    return { key: readFileSync(keyPath, 'utf-8'), cert: readFileSync(certPath, 'utf-8') }
  } catch { return null }
}

export function writeCertPair(name: string, pair: CertPair): CertPaths {
  const dir = certDir()
  mkdirSync(dir, { recursive: true })
  const paths = certPaths(name)
  writeFileSync(paths.certPath, pair.cert, 'utf-8')
  writeFileSync(paths.keyPath, pair.key, 'utf-8')
  // The private key is the whole secret. This is advisory on Windows — NTFS
  // ACLs are what actually govern there — but it costs nothing and is correct
  // on the platforms where it does apply.
  try { chmodSync(paths.keyPath, 0o600) } catch { /* best effort */ }
  return paths
}

export interface CertInfo {
  subject:      string
  issuer:       string
  validFrom:    Date
  validTo:      Date
  daysRemaining: number
  selfSigned:   boolean
  altNames:     string[]
}

export function inspectCert(pem: string): CertInfo | null {
  try {
    const x = new X509Certificate(pem)
    const validTo = new Date(x.validTo)
    return {
      subject:       x.subject,
      issuer:        x.issuer,
      validFrom:     new Date(x.validFrom),
      validTo,
      daysRemaining: Math.floor((validTo.getTime() - Date.now()) / 86_400_000),
      selfSigned:    x.subject === x.issuer,
      altNames:      (x.subjectAltName ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    }
  } catch { return null }
}

/**
 * True when a stored certificate is still usable for `names`.
 *
 * Renewal is deliberately eager (30 days out): a certificate that expires
 * during a live exercise takes the whole room down at once, and there is no
 * operator watching a desktop app's logs.
 */
export function certUsableFor(pem: string, names: string[], minDaysRemaining = 30): boolean {
  const info = inspectCert(pem)
  if (!info) return false
  if (info.daysRemaining < minDaysRemaining) return false
  // A host that gained a network adapter since the certificate was issued needs
  // a new one, or players on that network get a name-mismatch error.
  //
  // Matching is delegated to OpenSSL rather than compared as strings: a SAN is
  // stored in canonical form, so "::1" comes back as "0:0:0:0:0:0:0:1" and a
  // naive comparison never matches — which silently reissues the certificate on
  // every single boot, invalidating any trust a host had distributed.
  try {
    const x = new X509Certificate(pem)
    return names.every((n) => (isIP(n) ? x.checkIP(n) : x.checkHost(n)) !== undefined)
  } catch { return false }
}
