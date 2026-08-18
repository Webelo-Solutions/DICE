# Building the DICE installer

Produces `DICE-Setup.exe` — a self-contained Windows installer that installs DICE
as a local web app (a small bundled server + the SPA), with no prerequisites for
the end user (Node is bundled).

## What the installer does for the end user

- Installs per-user to `%LOCALAPPDATA%\Programs\DICE` (no admin prompt).
- Creates a **DICE** Start Menu shortcut (and optional desktop shortcut).
- Launching it starts the bundled local server and opens `https://127.0.0.1:3001`
  in the default browser. A small titled **"DICE Server"** window appears
  (minimized) — closing it stops DICE.
- The database is created at `%LOCALAPPDATA%\DICE\dice.db` on first run and is
  preserved across reinstalls/upgrades. The app's LLM API key stays in the
  browser's local storage (never in the database).
- **First-run authentication.** The very first visit routes to a setup screen
  to create an administrator account (username + display name + password, 8+
  chars). From that point on every page requires sign-in. The administrator can
  create additional users at **Admin → Users** in-app; each user has their own
  roster, campaigns, custom scenarios, save slots, and session history. Content
  packs and the active organizational profile remain shared across all users
  on the install. End-user docs: `docs/DICE-Setup-Guide.{docx,pdf}` Sections 5–8.

## Network scope — trusted LAN only

DICE is designed to run on a **single machine** or a **trusted local network**, and
**must not be exposed to the internet.** The host's own LLM API key pays for every
DM call, so reachability must be limited to people on a network you control —
otherwise anonymous users could run up the host's token bill.

- **Default is localhost-only.** The server binds to `127.0.0.1`; nobody else can
  reach it unless LAN access is explicitly enabled.
- **To allow other devices on a trusted LAN (installed app):** launch via the
  **"DICE (LAN Host)"** Start Menu shortcut, which sets `DICE_LAN=1` so the server
  binds `0.0.0.0` (the normal shortcut stays localhost-only). The browser still
  opens at `127.0.0.1`. Players open `https://<host-LAN-IP>:3001` (the lobby's
  QR code and join link now carry the right scheme automatically). Windows Firewall
  may prompt to allow Node on **Private** networks the first time — allow it (or add
  a rule manually, below).
- **Running from source (dev):** set `HOST=0.0.0.0` before `npm run server`. If
  Windows doesn't prompt, add the firewall rule on the **Private profile only**:
  ```powershell
  New-NetFirewallRule -DisplayName "DICE (port 3001)" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3001 -Profile Private
  ```
- **Never** port-forward port 3001, run DICE on untrusted/guest Wi-Fi, or otherwise
  make it reachable from the internet.

## Transport security (TLS)

DICE serves **HTTPS by default**. On first run it generates a local certificate
authority and a server certificate into `%LOCALAPPDATA%\DICE\certs\`, covering
`localhost`, the machine name, and every non-loopback IPv4 address the host has.
Nothing needs configuring, and WebSockets follow automatically (`wss://`).

Because that CA signs itself, browsers warn until it is trusted. Two ways out:

- **Trust it once per device.** DICE prints the path at startup and serves the
  CA at `/api/tls-ca`. Import it into *Trusted Root Certification Authorities*
  (or push it by GPO). Because a long-lived CA signs short-lived server
  certificates, this survives certificate rotation — you do not re-import.
- **Click through.** Acceptable for a one-off, but a security exercise that
  trains twenty people to dismiss certificate warnings is teaching the wrong
  reflex. `Strict-Transport-Security` is deliberately **not** sent for
  self-signed certificates precisely so this remains possible — with HSTS the
  browser offers no "Proceed" at all.

| Variable | Default | Meaning |
|---|---|---|
| `DICE_TLS` | `self-signed` | `self-signed`, `letsencrypt`, or `off` |
| `PORT` | `3001` (`443` for Let's Encrypt) | HTTPS listen port |
| `DICE_HTTP_PORT` | `80` | Redirect + ACME listener; `off` to disable |
| `DICE_DOMAIN` | — | Public domain; required for Let's Encrypt |
| `DICE_ACME_EMAIL` | — | Contact for expiry warnings |
| `DICE_ACME_STAGING` | — | `1` to use the staging CA while testing |

Port 80 redirects to HTTPS and preserves the path, so a shared join link still
works if someone types `http://`. A failed bind on 80 is tolerated for
self-signed use (desktops often have it taken) — HTTPS still serves.

### Public internet hosting (Let's Encrypt)

Use the **"DICE (Secure Internet Host)"** shortcut, after editing
`DICE-Internet.cmd` with your domain and email. It requires:

1. A DNS A record pointing at this machine's public IP.
2. Inbound TCP **80 and 443** forwarded to this machine. Port 80 is not
   optional — HTTP-01 validation connects to it.
3. Nothing else listening on either port.

Certificates renew automatically (checked twice daily, renewed 30 days out) and
are applied without dropping anyone mid-session. A failed renewal falls back to
a self-signed certificate rather than refusing to start. Test with
`DICE_ACME_STAGING=1` first: the production service rate-limits a domain for a
week after a handful of failures.

**Exposing DICE to the internet remains a deliberate, consequential choice.**
TLS protects the traffic; it does not change who can reach you. Your API key
still pays for every DM call anyone triggers. Host publicly only for sessions
you intend to pay for, and take the host down between exercises.

### Room codes

A room code is the only thing protecting a session from a stranger, because the
spectator view (`/watch/:code`) is deliberately login-free. Three things guard it:

- **8 characters** from a 32-symbol alphabet — 32⁸ ≈ 1.1 × 10¹², a thousand
  times the old 6-character space. Codes issued before this change are 6
  characters and still work; lookup is an exact match and assumes no length.
- **`GET /api/rooms/:code` is rate limited to 20/min per IP**, far below the
  global 300/min. A real client calls it once per code it was handed.
- **Anonymous callers get the room and nothing else.** Participant display names
  are real people's names; they are returned only to a signed-in DICE user.

Joining still requires a DICE account, so a guessed code alone cannot take a
turn or spend your tokens — but it can still be used to *watch*. If that matters
for a public session, do not share the watch link, and end rooms you are not
running.

Verify with `node scripts/verify-room-codes.mjs <port> [ca.crt]` against a
server that has not yet had its admin created.

Verify a running install with `node scripts/verify-tls.mjs <ca.crt> <port> <httpPort>`.

## Prerequisites (build machine only)

1. **Node.js** — build on **Windows x64**. The build copies the build machine's
   own `node.exe` into the package so its ABI matches the native `better-sqlite3`
   binary. (Built here with Node v24.x.) If you build on a different Node major,
   just rebuild — the matching `node.exe` is copied automatically.
2. **Inno Setup 6** — free, from <https://jrsoftware.org/isdl.php>. Provides the
   `ISCC.exe` compiler used in step 3.

## Build steps

```powershell
# 1. Assemble the runtime payload into release\app
#    (builds the SPA, bundles the server, installs server-only prod deps,
#     copies migrations + launcher, and bundles a matching node.exe)
npm run build:release

# 2. Compile the installer (adjust the path to ISCC.exe if different)
& "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer\dice.iss
```

Output: `release\installer\DICE-Setup.exe` — upload that to your website.

## Optional polish

- **App icon:** drop a `dice.ico` into `installer\` and into `release\app\`
  (or add a copy line to `scripts/build-release.mjs`), then uncomment
  `SetupIconFile=dice.ico` in `installer\dice.iss`. The shortcuts already point
  at `{app}\dice.ico`.
- **Version:** bump `#define AppVersion` in `installer\dice.iss`.

## Code signing (important for website distribution)

Unsigned installers trigger **Windows SmartScreen** ("Windows protected your PC").
To avoid it, sign both `DICE-Setup.exe` and the bundled `node.exe`/launcher with an
Authenticode code-signing certificate (an EV cert clears SmartScreen reputation
immediately; a standard cert builds reputation over time). Sign after step 2:

```powershell
signtool sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 /a release\installer\DICE-Setup.exe
```

## Full data wipe (for testing)

Uninstalling leaves user data in place by design. To wipe it:

```powershell
Remove-Item "$env:LOCALAPPDATA\DICE" -Recurse -Force
```

## How the pieces fit

| Path | Role |
|---|---|
| `scripts/build-release.mjs` | Assembles `release/app` (SPA + server bundle + deps + node.exe + launcher) |
| `installer/DICE.cmd` | Launcher: sets data path + TLS defaults, starts server (localhost), opens browser |
| `installer/DICE-LAN.cmd` | LAN host launcher: sets `DICE_LAN=1` (binds `0.0.0.0`), then calls `DICE.cmd` |
| `installer/DICE-Internet.cmd` | Public host launcher: Let's Encrypt for a real domain; refuses to start on the placeholder |
| `server/tls/` | Certificate generation (`selfSigned.ts`), ACME (`acme.ts`), storage (`store.ts`), redirect listener (`httpRedirect.ts`) |
| `installer/dice.iss` | Inno Setup definition → `DICE-Setup.exe` |
| `release/app/` | The exact files the installer ships |

## Authentication (quick reference for debugging)

| Concern | Where |
|---|---|
| User + session tables | `users`, `auth_sessions` in `dice.db` (migration `0004_fresh_nitro.sql`) |
| Password hashing | scrypt via Node built-in `crypto` — no extra dependency (`server/auth/tokens.ts`) |
| Bearer token storage | Random 32-byte token issued to client; only the SHA-256 hash is stored server-side |
| Session lifetime | 30 days from issue; `lastSeenAt` rolls on every authenticated request |
| Login rate limiting | IP-based via `@fastify/rate-limit` (10/15-min) AND per-username lockout (5 fails / 15-min, in-memory) |
| Self-service password change | `POST /api/auth/change-password` — verifies current pw; revokes every OTHER session for the user |
| Admin endpoints | All under `requireAdmin` decorator: `GET/POST /api/admin/users`, `PATCH /api/admin/users/:id`, password reset, sign-out-all |
| Per-user data scoping | `owner_user_id` column on `characters`, `campaigns`, `custom_scenarios`, `saves`, `session_history`; pack content stays NULL-owner (install-wide) |
| Server-side lockout reset | Lockout state is in-memory; restarting the server (closing the "DICE Server" window) clears all per-username locks |
| Recovering a lost-admin install | Delete `%LOCALAPPDATA%\DICE` to wipe the database and re-run first-run setup |
