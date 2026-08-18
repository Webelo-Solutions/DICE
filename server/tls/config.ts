import { networkInterfaces, hostname } from 'node:os'

// ─── TLS configuration ────────────────────────────────────────────────────────
//
// DICE serves HTTPS by default. A fresh install generates its own certificate on
// first boot and needs no configuration; a host exposing DICE to the internet
// points DICE_DOMAIN at a public name and gets a Let's Encrypt certificate
// instead. Everything is environment-driven so the Start Menu launchers can set
// it, matching how LAN mode already works (DICE_LAN=1).

export type TlsMode = 'self-signed' | 'letsencrypt' | 'off'

export interface TlsConfig {
  mode: TlsMode
  /** Port the application itself listens on. */
  httpsPort: number
  /**
   * Port for the plain-HTTP listener that redirects to HTTPS and answers ACME
   * HTTP-01 challenges. Null disables it entirely.
   */
  httpPort: number | null
  /** Public domain — required for Let's Encrypt, unused otherwise. */
  domain: string | null
  /** Contact address Let's Encrypt uses for expiry warnings. */
  acmeEmail: string | null
  /** Let's Encrypt staging environment: untrusted certs, far higher rate limits. */
  acmeStaging: boolean
  /** Names and IPs baked into a self-signed certificate's SANs. */
  subjectAltNames: string[]
}

function envFlag(name: string): boolean {
  const v = process.env[name]
  return v === '1' || v?.toLowerCase() === 'true'
}

function parseMode(): TlsMode {
  const raw = (process.env.DICE_TLS ?? '').trim().toLowerCase()
  if (raw === 'off' || raw === '0' || raw === 'false') return 'off'
  if (raw === 'letsencrypt' || raw === 'acme') return 'letsencrypt'
  if (raw === 'self-signed' || raw === 'selfsigned' || raw === '1' || raw === 'true') return 'self-signed'
  // Unset: a configured domain means the host intends a real certificate;
  // otherwise generate our own. TLS on by default either way.
  return process.env.DICE_DOMAIN?.trim() ? 'letsencrypt' : 'self-signed'
}

/**
 * Every name a browser might use to reach this host. A certificate is only
 * accepted for names in its SAN list, and the lobby hands players a LAN IP —
 * so the IPs matter as much as the hostnames.
 */
export function localSubjectAltNames(domain?: string | null): string[] {
  const names = new Set<string>(['localhost', '127.0.0.1', '::1'])
  const host = hostname()
  if (host) {
    names.add(host)
    // Windows machine names resolve bare and as .local on many networks.
    if (!host.includes('.')) names.add(`${host}.local`)
  }
  for (const iface of Object.values(networkInterfaces())) {
    for (const addr of iface ?? []) {
      if (!addr.internal) names.add(addr.address)
    }
  }
  if (domain) names.add(domain)
  return [...names]
}

export function resolveTlsConfig(): TlsConfig {
  const mode = parseMode()
  const domain = process.env.DICE_DOMAIN?.trim() || null

  // The app keeps its historical port so existing shortcuts, firewall rules,
  // QR codes and documentation stay correct. A host who has gone to the trouble
  // of pointing a public domain here wants the standard port instead, since
  // nobody types :3001 on a public URL.
  const defaultHttpsPort = mode === 'letsencrypt' ? 443 : 3001
  const httpsPort = Number(process.env.PORT ?? defaultHttpsPort)

  // Port 80 is not optional for Let's Encrypt: HTTP-01 validation always
  // connects there. For self-signed use it is only a courtesy redirect, and a
  // desktop may well have something else on 80 — a failed bind is tolerated.
  const httpPortRaw = process.env.DICE_HTTP_PORT?.trim()
  const httpPort = httpPortRaw === 'off' || httpPortRaw === '0'
    ? null
    : Number(httpPortRaw || 80)

  return {
    mode,
    httpsPort,
    httpPort: mode === 'off' ? null : httpPort,
    domain,
    acmeEmail: process.env.DICE_ACME_EMAIL?.trim() || null,
    acmeStaging: envFlag('DICE_ACME_STAGING'),
    subjectAltNames: localSubjectAltNames(domain),
  }
}

/** Human-readable summary for the "DICE Server" console window. */
export function describeTls(cfg: TlsConfig): string {
  if (cfg.mode === 'off') return 'TLS off — traffic is unencrypted'
  if (cfg.mode === 'letsencrypt') return `TLS via Let's Encrypt for ${cfg.domain}${cfg.acmeStaging ? ' (STAGING — not trusted)' : ''}`
  return 'TLS with a self-signed certificate — browsers will warn until it is trusted'
}
