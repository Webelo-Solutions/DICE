# DICE — Defensive Incident Containment Exercises

DICE is an AI‑driven tabletop game for **cybersecurity incident‑response training**.
An LLM acts as the Dungeon Master, narrating a live security incident while players
take on defender archetypes, declare actions, and roll to resolve them. It turns
tabletop exercises into something closer to a role‑playing game — with acts, a
scenario clock, an adversary working against you, and a post‑exercise hot‑wash.

> ⚠️ **For authorized training exercises only. Not for operational use.**
> DICE is designed to run on a single machine or a **trusted local network** and
> **must not be exposed to the internet** — the host's own LLM API key pays for
> every DM call. See [Network scope](#network-scope--trusted-lan-only).

---

## Features

- **AI Dungeon Master** — narrates the incident, adjudicates outcomes, escalates
  through acts, and reacts to player choices. Pluggable LLM providers (Anthropic,
  OpenAI, Azure OpenAI, Google Gemini).
- **Defender archetypes** — each player picks a class with its own stats and
  archetype actions; a d20 + modifiers vs. a difficulty check drives every turn.
- **Difficulty tiers** — Rookie, Analyst, Senior, Elite, and a no‑timer training
  mode, with hints available on the lower tiers.
- **Adversary mode** — an AI (or human) threat actor advances a kill chain against
  the defenders, choosing tactics and rolling for evasion.
- **NPCs & stakeholders** — a roster of stakeholders with competing priorities who
  surface as the incident unfolds.
- **Campaigns & scenarios** — multi‑act scenarios plus a campaign builder; author
  your own or import shareable **`.dicepack`** content packs.
- **LAN multiplayer** — a facilitator hosts a room over the local network; each
  player joins from their own device and plays their own character.
- **Debrief** — a live XP scorecard during play and a hot‑wash report at the end.
- **Multi‑user** — first‑run creates an admin account; each user gets their own
  roster, campaigns, custom scenarios, saves, and history.

## Tech stack

| Layer | Stack |
|---|---|
| Frontend | React 18 + TypeScript, Vite, Tailwind CSS, Zustand, Framer Motion |
| Backend | Fastify 5, Drizzle ORM, SQLite (better‑sqlite3), WebSockets |
| AI | Anthropic / OpenAI / Azure OpenAI / Google Gemini SDKs (DM runs server‑side) |
| Packaging | esbuild + Inno Setup → self‑contained Windows installer |

---

## Getting started (development)

**Prerequisites:** Node.js (built and tested on Node 24.x) on Windows x64.

```bash
npm install
```

Run the frontend dev server (Vite, hot reload) at http://localhost:5173:

```bash
npm run dev
```

Run the backend (Fastify API + static host) at http://localhost:3001:

```bash
npm run server        # production-style
npm run server:dev    # watch mode
```

For full local play you typically run the backend and open http://localhost:3001.
The DM's LLM API key is entered in‑app and stored in the browser's local storage —
it is never written to the database or committed to the repo.

### Useful scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server (frontend, hot reload) |
| `npm run build` | Type‑check and build the SPA into `dist/` |
| `npm run server` / `server:dev` | Run the backend (Fastify) |
| `npm run db:generate` / `db:migrate` | Drizzle migrations |
| `npm run build:release` | Assemble the self‑contained runtime into `release/app` |
| `npm run build:docs` | Regenerate the setup guide docs |

---

## Building the distributable installer

`npm run build:release` assembles a self‑contained payload (bundled server, built
SPA, server‑only dependencies, and an ABI‑matched `node.exe`) into `release/app`.
Compiling `installer/dice.iss` with Inno Setup 6 then produces
`release/installer/DICE-Setup-<version>.exe` — a per‑user Windows installer that
needs no prerequisites on the end user's machine (Node is bundled).

The installer version is single‑sourced from `version` in `package.json`.
Full build and code‑signing instructions live in
[INSTALL_BUILD.md](INSTALL_BUILD.md).

---

## Network scope — trusted LAN only

DICE uses plain HTTP (no TLS) and is meant for a single machine or a trusted local
network. **Never** port‑forward it, run it on untrusted Wi‑Fi, or otherwise make it
reachable from the internet.

- **Default is localhost‑only** — the server binds `127.0.0.1`.
- **To host on a trusted LAN**, launch the **"DICE (LAN Host)"** shortcut (sets
  `DICE_LAN=1`, binds `0.0.0.0`); from source, set `HOST=0.0.0.0` before
  `npm run server`. Players connect to `http://<host-LAN-IP>:3001`.

## Data & privacy

- The SQLite database is created on first run and holds rosters, sessions, history,
  rooms, and imported content packs. In the installed app it lives at
  `%LOCALAPPDATA%\DICE\dice.db` and is preserved across upgrades.
- The **LLM API key stays in the browser's local storage**, never in the database.
- Local data (`data/`, `*.db`), build output (`dist/`, `release/`), and secrets
  (`.env`) are git‑ignored and never committed.

## Project structure

```
src/           React SPA (pages, components, engine, stores, data)
server/        Fastify backend, Drizzle schema + migrations, auth
scenarios/     Scenario source
prompts/       DM system prompts
scripts/       Release/doc build tooling
installer/     Inno Setup definition + launchers
```

---

*DICE — for authorized training exercises only. Not for operational use.*
