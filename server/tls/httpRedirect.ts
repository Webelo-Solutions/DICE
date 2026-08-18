import { createServer } from 'node:http'
import type { Server } from 'node:http'

// ─── The plain-HTTP listener ──────────────────────────────────────────────────
//
// Two jobs, both of which have to happen on port 80 specifically:
//   1. Redirect anyone who typed http:// to the HTTPS port. Without this a host
//      who shares "192.168.1.166:3001" gets a blank connection failure, which
//      reads as "DICE is broken" rather than "use https".
//   2. Answer Let's Encrypt HTTP-01 challenges. The CA always connects to port
//      80 of the domain; that is not configurable.

/**
 * Live HTTP-01 challenge responses, keyed by token. Populated by the ACME
 * client while an order is in flight and cleared afterwards, so the endpoint
 * exposes nothing between renewals.
 */
const challengeResponses = new Map<string, string>()

export function setChallengeResponse(token: string, keyAuthorization: string): void {
  challengeResponses.set(token, keyAuthorization)
}
export function clearChallengeResponse(token: string): void {
  challengeResponses.delete(token)
}

const ACME_PREFIX = '/.well-known/acme-challenge/'

export interface HttpListenerOptions {
  port:       number
  host:       string
  httpsPort:  number
  /** Answer ACME challenges. Only enabled for Let's Encrypt mode. */
  acme:       boolean
}

/**
 * Starts the listener. Resolves with the server, or null if the port could not
 * be bound — a desktop may well already have IIS, Skype or another app on 80,
 * and for a self-signed LAN install the redirect is a convenience, not a
 * requirement. The caller decides whether that is fatal (it is for ACME).
 */
export function startHttpListener(opts: HttpListenerOptions): Promise<Server | null> {
  return new Promise((resolvePromise) => {
    const server = createServer((req, res) => {
      const url = req.url ?? '/'

      if (opts.acme && url.startsWith(ACME_PREFIX)) {
        const token = url.slice(ACME_PREFIX.length)
        const body = challengeResponses.get(token)
        if (body) {
          res.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': Buffer.byteLength(body) })
          res.end(body)
          return
        }
        res.writeHead(404).end()
        return
      }

      // Preserve the path and query so a shared join link survives the hop.
      // The Host header carries the name the player actually typed, which is
      // the one their certificate check will use — rewriting it to a local
      // address would produce a name mismatch.
      const hostHeader = (req.headers.host ?? '').replace(/:\d+$/, '')
      const suffix = opts.httpsPort === 443 ? '' : `:${opts.httpsPort}`
      const target = `https://${hostHeader}${suffix}${url}`

      // 302, not 301: a permanent redirect is cached by browsers effectively
      // forever, and a host who later turns TLS off would find their users
      // stuck on an https:// URL that no longer answers.
      res.writeHead(302, { location: target, 'cache-control': 'no-store' })
      res.end()
    })

    server.on('error', () => resolvePromise(null))
    server.listen(opts.port, opts.host, () => resolvePromise(server))
  })
}
