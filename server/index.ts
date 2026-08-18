import { buildApp } from './app'
import { runMigrations } from './db/run-migrations'
import { seedInjectsCatalogIfEmpty } from './db/seed-injects-catalog'
import { seedSampleCampaignIfEmpty } from './db/seed-sample-campaign'
import { resolveTlsConfig, describeTls } from './tls/config'
import { ensureSelfSignedCert, caCertPath } from './tls/selfSigned'
import { ensureLetsEncryptCert, scheduleRenewal } from './tls/acme'
import { startHttpListener } from './tls/httpRedirect'
import type { CertPair } from './tls/store'

const host = process.env.HOST ?? '127.0.0.1'
const tls  = resolveTlsConfig()

// Self-initialize the database: apply any pending migrations before serving.
// A fresh install thus creates its schema automatically on first launch.
runMigrations()
// Only inserts when the catalog is empty — safe on every subsequent boot.
seedInjectsCatalogIfEmpty()
// Only inserts for an existing admin with zero campaigns — safe on every
// subsequent boot. Brand-new installs are covered separately at first-run
// setup (see seedSampleCampaignForNewAdmin in server/auth/routes.ts).
seedSampleCampaignIfEmpty()

// Plain console lines (not the JSON pino log) so the important facts are
// obvious at a glance in the "DICE Server" window — this is the only place a
// host confirms what actually happened.
const say = (msg: string) => console.log(`[DICE] ${msg}`)

async function acquireCertificate(): Promise<{ pair: CertPair; trusted: boolean } | null> {
  if (tls.mode === 'off') return null

  if (tls.mode === 'letsencrypt') {
    if (!tls.domain) {
      say("DICE_TLS=letsencrypt needs DICE_DOMAIN set to a public domain name — falling back to a self-signed certificate")
    } else {
      try {
        const pair = await ensureLetsEncryptCert({
          domain: tls.domain, email: tls.acmeEmail, staging: tls.acmeStaging, log: say,
        })
        return { pair, trusted: !tls.acmeStaging }
      } catch (e) {
        // A failed renewal must not take the app down: an exercise running on a
        // self-signed certificate is far better than one that will not start.
        say(`Let's Encrypt failed (${e instanceof Error ? e.message : String(e)})`)
        say('falling back to a self-signed certificate — check that port 80 is reachable from the internet for this domain')
      }
    }
  }

  const { pair, issued } = await ensureSelfSignedCert(tls.subjectAltNames)
  if (issued) say(`generated a self-signed certificate at ${caCertPath()}`)
  return { pair, trusted: false }
}

async function main() {
  const acquired = await acquireCertificate()
  const app = buildApp(
    acquired
      // HSTS only with a genuinely trusted certificate — see BuildAppOptions.
      ? { https: acquired.pair, hsts: acquired.trusted }
      : {},
  )

  await app.listen({ port: tls.httpsPort, host })

  const scheme = acquired ? 'https' : 'http'
  const reach  = host === '127.0.0.1' ? 'local only — not reachable from other devices' : 'LAN mode'
  say(`Listening on ${scheme}://${host}:${tls.httpsPort} — ${reach}`)
  say(describeTls(tls))

  if (acquired && !acquired.trusted) {
    say(`browsers will warn until this certificate is trusted — import ${caCertPath()} once per device to stop the warnings`)
  }

  // The redirect/challenge listener. Required for Let's Encrypt; a courtesy
  // otherwise, so a failed bind is only fatal in the former case.
  if (tls.httpPort !== null && acquired) {
    const server = await startHttpListener({
      port: tls.httpPort, host, httpsPort: tls.httpsPort, acme: tls.mode === 'letsencrypt',
    })
    if (server) {
      say(`http://${host}:${tls.httpPort} redirects to https`)
    } else if (tls.mode === 'letsencrypt') {
      say(`WARNING: could not bind port ${tls.httpPort}. Let's Encrypt renewal will fail until it is free.`)
    } else {
      say(`port ${tls.httpPort} is in use — no http redirect (https still works)`)
    }
  }

  if (tls.mode === 'letsencrypt' && tls.domain && acquired?.trusted) {
    scheduleRenewal(
      { domain: tls.domain, email: tls.acmeEmail, staging: tls.acmeStaging, log: say },
      // Swapping the TLS context renews without dropping anyone mid-exercise.
      (pair) => {
        // buildApp types `server` as a plain http.Server (see the note there);
        // at runtime it is a tls.Server whenever a certificate was supplied.
        const secure = app.server as unknown as { setSecureContext?: (o: { key: string; cert: string }) => void }
        try {
          if (typeof secure.setSecureContext !== 'function') throw new Error('not a TLS server')
          secure.setSecureContext({ key: pair.key, cert: pair.cert })
          say('renewed certificate applied without a restart')
        } catch {
          say('certificate renewed — restart DICE to apply it')
        }
      },
    )
  }
}

main().catch((err) => {
  console.error('[DICE] failed to start:', err)
  process.exit(1)
})
