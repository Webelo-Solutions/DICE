import acme from 'acme-client'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { certDir, readCertPair, writeCertPair, certUsableFor, inspectCert } from './store'
import type { CertPair } from './store'
import { setChallengeResponse, clearChallengeResponse } from './httpRedirect'

// ─── Let's Encrypt (ACME, HTTP-01) ────────────────────────────────────────────
//
// Obtains and renews a publicly-trusted certificate for a host that has pointed
// a real domain at this machine. HTTP-01 means the CA connects back to port 80
// of that domain, so the host must have forwarded it — there is no way around
// that with this challenge type.

const ACCOUNT_KEY = 'letsencrypt-account'
const CERT_NAME   = 'letsencrypt'

/** Renew this far ahead of expiry. Let's Encrypt issues for 90 days. */
const RENEW_DAYS_BEFORE = 30

function accountKeyPath(): string {
  return resolve(certDir(), `${ACCOUNT_KEY}.key`)
}

/**
 * The ACME account key identifies us to Let's Encrypt across renewals. Losing it
 * is not fatal — a new account is simply created — but reusing it keeps us
 * inside per-account rate limits.
 */
async function loadOrCreateAccountKey(): Promise<Buffer> {
  const path = accountKeyPath()
  if (existsSync(path)) {
    try { return readFileSync(path) } catch { /* fall through and regenerate */ }
  }
  const key = await acme.crypto.createPrivateKey()
  mkdirSync(certDir(), { recursive: true })
  writeFileSync(path, key)
  return key
}

export interface AcmeOptions {
  domain:  string
  email:   string | null
  staging: boolean
  log:     (msg: string) => void
}

/**
 * Returns a usable Let's Encrypt certificate, ordering one only if the stored
 * certificate is missing, expiring, or for a different domain.
 *
 * Throws on failure. The caller decides what to do about that — falling back to
 * a self-signed certificate keeps the exercise running, which matters more than
 * strict adherence to the configured mode.
 */
export async function ensureLetsEncryptCert(opts: AcmeOptions): Promise<CertPair> {
  const existing = readCertPair(CERT_NAME)
  if (existing && certUsableFor(existing.cert, [opts.domain], RENEW_DAYS_BEFORE)) {
    const info = inspectCert(existing.cert)
    opts.log(`certificate for ${opts.domain} valid for ${info?.daysRemaining ?? '?'} more days`)
    return existing
  }

  opts.log(`requesting a certificate for ${opts.domain}${opts.staging ? ' (staging)' : ''}…`)

  const client = new acme.Client({
    directoryUrl: opts.staging ? acme.directory.letsencrypt.staging : acme.directory.letsencrypt.production,
    accountKey: await loadOrCreateAccountKey(),
  })

  const [key, csr] = await acme.crypto.createCsr({ commonName: opts.domain })

  const cert = await client.auto({
    csr,
    // Let's Encrypt uses this only for expiry warnings; it is optional.
    email: opts.email ?? undefined,
    termsOfServiceAgreed: true,
    challengePriority: ['http-01'],
    challengeCreateFn: async (_authz, challenge, keyAuthorization) => {
      if (challenge.type !== 'http-01') throw new Error(`unsupported challenge type ${challenge.type}`)
      setChallengeResponse(challenge.token, keyAuthorization)
    },
    challengeRemoveFn: async (_authz, challenge) => {
      clearChallengeResponse(challenge.token)
    },
  })

  const pair: CertPair = { key: key.toString(), cert: cert.toString() }
  writeCertPair(CERT_NAME, pair)
  const info = inspectCert(pair.cert)
  opts.log(`certificate issued — expires ${info?.validTo.toISOString().slice(0, 10) ?? 'unknown'}`)
  return pair
}

/**
 * Checks for renewal on a timer. A DICE host may stay up for weeks between
 * exercises, so boot-time acquisition alone is not enough — a certificate would
 * silently expire under a long-running server.
 *
 * `onRenewed` receives the new pair. Node's TLS context can be swapped without
 * a restart, so a renewal does not interrupt play.
 */
export function scheduleRenewal(
  opts: AcmeOptions,
  onRenewed: (pair: CertPair) => void,
  intervalMs = 12 * 60 * 60 * 1000,
): NodeJS.Timeout {
  const timer = setInterval(() => {
    ensureLetsEncryptCert(opts)
      .then((pair) => { onRenewed(pair) })
      .catch((e) => opts.log(`renewal check failed: ${e instanceof Error ? e.message : String(e)}`))
  }, intervalMs)
  // Do not hold the process open purely for the renewal timer.
  timer.unref?.()
  return timer
}
