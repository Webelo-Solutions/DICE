# DICE User Guide

*Complete Setup, Configuration & Feature Guide*

_Defensive Incident Containment Exercises_

## Table of Contents

- [1. About DICE](#1-about-dice)
- [2. System Requirements](#2-system-requirements)
- [3. Installing DICE](#3-installing-dice)
- [4. First Launch](#4-first-launch)
- [5. First User Setup (Administrator)](#5-first-user-setup-administrator)
- [6. Connecting an AI Provider (Required)](#6-connecting-an-ai-provider-required)
- [7. Adding Users (Administrator-Created Accounts)](#7-adding-users-administrator-created-accounts)
- [8. Self-Registration (Invite Code)](#8-self-registration-invite-code)
- [9. Signing In and Account Settings](#9-signing-in-and-account-settings)
- [10. Where Your Data Lives](#10-where-your-data-lives)
- [11. Network, Hosting & Encryption](#11-network-hosting-encryption)
- [12. Program Analytics (Administrator)](#12-program-analytics-administrator)
- [13. Injects Catalog (Administrator)](#13-injects-catalog-administrator)
- [14. Scenario Authoring (Administrator)](#14-scenario-authoring-administrator)
- [15. Stopping, Updating, Uninstalling](#15-stopping-updating-uninstalling)
- [16. Setup & Account Troubleshooting](#16-setup-account-troubleshooting)
- [17. Core Concepts](#17-core-concepts)
- [18. Getting Started — Quick Start](#18-getting-started-quick-start)
- [19. Your Character](#19-your-character)
- [20. How a Turn Works](#20-how-a-turn-works)
- [21. The Clock & Timer Pressure](#21-the-clock-timer-pressure)
- [22. Stakeholders & Other Characters (NPCs)](#22-stakeholders-other-characters-npcs)
- [23. Scenarios](#23-scenarios)
- [24. Game Modes](#24-game-modes)
- [25. Hosting and Joining Multiplayer Rooms](#25-hosting-and-joining-multiplayer-rooms)
- [26. Facilitator Mode — In-Session Control Panel](#26-facilitator-mode-in-session-control-panel)
- [27. Campaigns & Custom Content](#27-campaigns-custom-content)
- [28. Content Packs — Import & Export](#28-content-packs-import-export)
- [29. After the Game — Reports & Analytics](#29-after-the-game-reports-analytics)
- [30. Character Progression](#30-character-progression)
- [31. Tips for New Teams](#31-tips-for-new-teams)

## 1. About DICE

DICE (Defensive Incident Containment Exercises) is a tabletop-style cybersecurity incident-response training game. An AI "Dungeon Master" narrates a live security incident while you and your team make decisions, roll dice, and race a clock to contain the threat. DICE installs and runs entirely on your own computer as a local web application — your browser is the interface, and a small bundled server keeps everything on your machine.

A single DICE install can serve an entire team. Each person signs in with their own username and password and has their own characters, campaigns, custom scenarios, and session history; shared content (imported content packs, admin-authored global scenarios, the injects catalog, and the active organizational profile) is available to everyone on the install.

This guide covers everything in one place: installing and configuring DICE, administering an install (users, analytics, shared content), and playing the game itself — from your first character to hosting a multiplayer session across a LAN.

## 2. System Requirements

- Windows 10 or 11 (64-bit).
- A modern web browser (Edge, Chrome, or Firefox).
- Roughly 200 MB of free disk space.
- An internet connection and an AI provider API key (see Section 6). The AI Dungeon Master runs through your chosen provider.

**No prerequisites: **DICE bundles its own runtime — you do NOT need to install Node.js, a database, or anything else.

## 3. Installing DICE

1. Download DICE-Setup.exe from the website.
2. Double-click DICE-Setup.exe to start the installer.
3. If Windows shows a "Windows protected your PC" (SmartScreen) message, click "More info" then "Run anyway." This appears for newly published software and is expected.
4. Follow the wizard. DICE installs for your user account only — no administrator password is required.
5. Leave "Launch DICE now" checked and click Finish.

## 4. First Launch

1. Open DICE from the Start Menu (or the desktop shortcut, if you created one).
2. A small window titled "DICE Server" appears, minimized. Keep it open — it is the local engine. Closing it stops DICE.
3. Your default browser opens automatically to http://127.0.0.1:3001. If it does not, open that address manually.
4. The very first time, you will land on a setup screen to create the administrator account (see Section 5). After that, the home screen is behind a sign-in page.

## 5. First User Setup (Administrator)

The very first time DICE opens after install, no users exist yet. DICE will not let you do anything else until you create the administrator account. The administrator is the person who can later create accounts for other players, enable self-registration, and manage install-wide content.

1. On first launch, your browser opens to a screen titled "Set up DICE".
2. Enter a username — lowercase letters, numbers, and ._- only, 2–32 characters. This is what you type at the sign-in screen.
3. Enter a display name (1–64 characters). This is what other players see during a session.
4. Enter a password of at least 8 characters. Write it down somewhere safe — there is no automated recovery mechanism. If you forget it, the only way back is to wipe the database (see Section 15).
5. Click Create administrator account. You are signed in immediately and the setup screen will not appear again.

If something interrupts setup before you finish (browser closed, power loss), the setup screen reappears the next time you launch — the install is not considered "done" until an administrator exists.

## 6. Connecting an AI Provider (Required)

The AI Dungeon Master needs an API key from one supported provider. Without it, scenarios cannot be narrated. Each user enters their own key in their own browser; the key is not shared between users and is never written to the DICE database.

1. In DICE, open Settings (the provider/settings option in the app).
2. Choose your provider: Anthropic, OpenAI, Microsoft Azure, or Google Gemini.
3. Paste your API key and choose a model (for Azure, enter your endpoint and deployment name instead of picking a model from a list).
4. Save. The key is stored privately in your browser on this machine and is never written to the DICE database or sent anywhere except your chosen AI provider.

Where to get a key (you pay your provider directly for AI usage):

| Provider | Models available (default listed first) | Where to get a key |
| --- | --- | --- |
| Anthropic | Claude Sonnet 5 (default), Claude Opus 5, Claude Fable 5, Claude Haiku 4.5, Claude Sonnet 4.6, Claude Opus 4.7 | console.anthropic.com |
| OpenAI | GPT-5.6 Sol (default), GPT-5.6 Terra, GPT-5.6 Luna, GPT-4o, GPT-4o Mini | platform.openai.com |
| Microsoft Azure | GPT-5.6 Sol (default), GPT-4o, GPT-4o Mini, GPT-4 — configured via your own endpoint + deployment name | Azure OpenAI resource |
| Google Gemini | Gemini 3.7 Flash (default), Gemini 3.5 Flash, Gemini 3.1 Pro (Preview), Gemini 2.5 Flash | aistudio.google.com |

## 7. Adding Users (Administrator-Created Accounts)

Only the administrator can create accounts this way — the default, controlled way to add teammates. Section 8 covers the alternative: letting people create their own accounts with a shared invite code.

1. From the home screen, click the Admin chip in the top-right corner.
2. On the Users page, click + New User.
3. Enter the new user's username, display name, an initial password (at least 8 characters), and choose a role:
4. Save. Give the new user their username and initial password through a secure channel (do not email them in plain text). They sign in at the same URL you do.

| Role | What they can do |
| --- | --- |
| Player | Play scenarios, manage their own characters and campaigns, see their own session history. This is the right choice for most users. |
| Admin | Everything a Player can do, plus create and manage other users, control self-registration, view program analytics, and manage the install-wide injects catalog and scenario library. Keep the number of admins small. |

### Managing existing users

**Disable an account: **immediately revokes every active session for that user; they are signed out everywhere and cannot sign in again until you re-enable them. Use this when someone leaves the team.

**Reset a password: **sets a new password you choose. As a security measure, every active session for that user is also signed out.

**Sign someone out everywhere: **revokes all of their active sessions without changing their password — useful if their laptop is lost or they're handing off a shared workstation.

**Change a user's role: **promote a Player to Admin or demote an Admin to Player.

**Safety rails: **you cannot deactivate yourself, sign yourself out, or demote yourself. This is by design — the install can never end up with no working administrator.

## 8. Self-Registration (Invite Code)

By default, self-registration is OFF and only an administrator can create accounts (Section 7). For larger teams, an administrator can instead turn on self-registration and share one invite code — anyone who has the code can create their own account, always as a Player. Self-registration can never create an Admin account.

### Turning it on (Administrator)

**Where: **Admin → Users, in the Registration Code card.

**Enable: **set an invite code (4–64 characters) and save. Anyone with the code can now create their own account at the Register page.

**Disable: **clear the code and save. Self-registration turns back off immediately; the Register page then refuses new accounts.

### Creating your own account (Player)

1. Get the invite code from your administrator.
2. Open the DICE address and go to the Register page (or use a link your administrator shares).
3. Enter the Invite Code, a Username (2+ characters), a Display Name, and a Password (8+ characters).
4. Click "Create Account". You are signed in immediately as a Player.

**If the code is wrong: **you will see "invalid invite code" — check with your administrator.

**If self-registration is off: **the page tells you self-registration is disabled on this install — ask your administrator to create your account instead (Section 7) or to enable self-registration.

## 9. Signing In and Account Settings

Once your account exists — whether an administrator created it or you self-registered — you sign in at the same URL as everyone else on the install. Each sign-in stays valid for 30 days per device.

**Sign in: **open the DICE address in your browser and enter your username and password.

**Change your own password: **click the Account chip in the top-right of any screen, enter your current password, then your new one twice. Saving signs every OTHER device that is signed in as you out — your current device stays signed in.

**Forgot your password: **ask the administrator to reset it. They cannot read your existing password — they can only set a new one.

**Locked out: **five failed sign-in attempts on the same username lock that account for fifteen minutes. The lock clears automatically when the timer expires, or the administrator can restart the DICE server (which clears all locks immediately).

**Session expired: **if your sign-in expires while you have a page open, the next action you take routes you back to the sign-in screen with a "Your session expired" notice. Sign in again to continue.

## 10. Where Your Data Lives

All DICE data — every user's data combined — lives in a single database file at %LOCALAPPDATA%\DICE\dice.db. Within that file, content is split between per-user and shared:

**Private to each user: **your roster, your campaigns, your custom scenarios, your save slots, and your session history. Other users on the same install cannot see them.

**Shared by everyone on the install: **content packs you import (Section 28), admin-authored global scenarios (Section 14), the injects catalog (Section 13), the active organizational profile, and the master list of built-in scenarios.

**Backups: **simply copy dice.db somewhere safe. To restore, copy it back. The file contains everyone's data and all accounts — guard it accordingly.

**Your API key: **kept separately in your browser's local storage (not in the database), so it is never included in a database backup. Each person's browser holds their own key.

## 11. Network, Hosting & Encryption

DICE is designed for a single machine or a trusted local network. It CAN be hosted on the internet (see below), but that is a deliberate decision with real cost and exposure consequences, not the default. The host's AI provider key pays for every DM call, so access is intentionally limited to people on a network you control — otherwise unknown users could run up the host's costs. Sign-in protects against casual access; it does not make the app safe to expose publicly.

**Default — localhost only: **out of the box the app is reachable only on the host computer.

**Playing across a trusted LAN: **launch DICE with the "DICE (LAN Host)" Start Menu shortcut instead of the normal one — it binds the server to your network so other devices can join. The first launch may prompt Windows Firewall to allow access on Private networks — allow it. Use only on a trusted network such as a training room or private office — never on guest or public Wi-Fi.

**Join links & QR codes: **when hosting a multiplayer room (Section 25), the Lobby screen detects the host's LAN address and shows two QR codes so players can scan instead of typing an IP address: a Join link (opens Join Game with the room code pre-filled) and a Watch link (opens the read-only spectator view). The room code is still shown in plain text as a manual fallback.

**Encryption (HTTPS): **DICE serves HTTPS by default and creates its own certificate the first time it runs — there is nothing to set up. Because that certificate is issued by DICE itself rather than a public authority, browsers show a "not private" warning the first time each device connects. You can click through it, but the better answer is to trust it once: DICE prints the certificate file location when it starts, and it is available for download from the app. Import that one file into "Trusted Root Certification Authorities" on each device (or have IT push it) and the warning stops for good, including after DICE renews its certificate.

**Hosting on the internet: **use the "DICE (Secure Internet Host)" shortcut, after editing it with a domain name that points at your machine and your email address. DICE then obtains a genuine Let's Encrypt certificate, so players see no warning at all, and renews it automatically. You must forward ports 80 and 443 from your router to this machine — port 80 is required for the certificate check and is not optional.

**Before you host publicly: **encryption protects traffic in transit; it does not change who can reach you. Your AI provider key still pays for every DM call anyone triggers, and room codes are short enough to be guessed given enough attempts. Host publicly only for sessions you intend to pay for, use strong passwords, and take the host offline between exercises.

## 12. Program Analytics (Administrator)

Admin → Analytics ("Program Analytics — All Users") gives an administrator a program-wide view across every user on the install — useful for proving a training program is happening and finding where the gaps are.

- Four summary tiles: Sessions Run, Program Win Rate, Total XP Earned, Scenarios Covered.
- Exercise Cadence: an admin-editable target (in days, default 90 — chosen to align with common compliance cycles such as PCI-DSS, SOC 2, ISO 27001, and NIST CSF) and a per-user table showing Sessions, Win Rate, Last Exercised, and a Status of Never exercised / Overdue / Due soon / On track.
- Program-Wide Recurring Gaps: skill areas that come up as weaknesses in two or more sessions across the whole team, not just one person.
- Scenario Coverage: a grid showing which scenarios have and have not been played by anyone on the install.

**Export: **the "Export Program CSV" button downloads the full cross-user dataset for reporting outside DICE.

Every user also has their own personal Analytics page (Section 29) showing only their own history — Program Analytics is the administrator-only, all-users view.

## 13. Injects Catalog (Administrator)

Admin → Injects Catalog is an install-wide, centrally curated library of "critical" story beats — the special complications or breaks that can fire on a natural 20 (critical hit) or a natural 1 (critical fail). DICE ships with 24 default entries; an administrator can edit or extend them at any time.

- Entries are grouped into two tables: Critical Hit and Critical Fail.
- Each entry has a Description and an optional NPC effect. Edit either field and click Save — the change applies everywhere the entry is used, immediately, with no reinstall or redeploy needed.
- Deleting an entry asks for confirmation because it removes it from any scenario that references it.

Scenario authors (in the Campaign Builder, Section 27, or Admin Scenario Authoring, Section 14) do not write critical-hit/fail text inline — they pick from this catalog with a checkbox list, so a library of well-tested critical moments can be reused and improved across every scenario on the install.

## 14. Scenario Authoring (Administrator)

Admin → Scenarios uses the exact same scenario editor as the player-facing Campaign Builder (Section 27), with one key difference: what you save here is saved as a global scenario, visible to and playable by every user on the install — not just you.

- An administrator can open, edit, or delete any scenario on the install through this page, including scenarios other players authored privately in their own Campaign Builder — a way for admins to curate or fix custom content.
- Use this when a custom scenario should join the shared library everyone sees in Select Scenario — for example, an incident tailored to your organization's real tool stack (Section 27, Organizational Profile) that the whole team should train on.

**Player-authored vs. admin-authored: **a scenario a Player builds in their own Campaign Builder stays private to them unless an administrator promotes it here, or the player exports it as a content pack (Section 28) for others to import individually.

## 15. Stopping, Updating, Uninstalling

#### Stopping DICE

Close the minimized "DICE Server" window. The app in the browser will stop responding once the server is closed.

#### Updating

Download the newer DICE-Setup.exe and run it. Your database in %LOCALAPPDATA%\DICE — including all user accounts and per-user data — is preserved across updates.

#### Uninstalling

Use Windows "Add or remove programs" and uninstall DICE. Your saved data is intentionally kept. To remove it too — including every user account — delete the folder %LOCALAPPDATA%\DICE.

#### Lost administrator password / full reset

There is no automated administrator-password recovery. If the only administrator forgets their password and no other administrator exists, the only path back is to delete %LOCALAPPDATA%\DICE (which wipes the database) and start over. To avoid this, create at least one extra administrator account in advance.

## 16. Setup & Account Troubleshooting

**The browser did not open: **manually visit http://127.0.0.1:3001.

**"This site can't be reached": **the server may still be starting (wait a few seconds and refresh) or the "DICE Server" window was closed — relaunch DICE.

**Port already in use: **another program is using port 3001. Close it, or relaunch DICE.

**The setup screen reappears every launch: **the first-run administrator setup did not complete. Finish the form (Section 5) to create the administrator account; until then, the install is not considered done.

**"Invalid credentials" when I know my password is correct: **check caps-lock; usernames are case-insensitive but passwords are case-sensitive. If you fumble it five times, the account is locked for 15 minutes — see the "Locked out" lead in Section 9.

**"self-registration is disabled on this install": **ask your administrator to either give you an admin-created account (Section 7) or turn on self-registration and share the invite code (Section 8).

**"invalid invite code": **double-check the code with your administrator — it may have been changed or cleared since you got it.

**I forgot my password: **ask the administrator to reset it (Section 7). Administrators cannot recover an existing password — they can only set a new one.

**I am the administrator and I forgot the password: **see "Lost administrator password / full reset" in Section 15. Plan ahead by creating a second administrator account.

**The DM does not respond / errors about the model or key: **recheck your API key and selected model in Settings (Section 6), and confirm your provider account has available credit.

**Nothing saves / data looks empty: **confirm the "DICE Server" window is open; the app needs it running to read and write your data. Also confirm you are signed in as the right user — each user's roster and history is private to them.

## 17. Core Concepts

**The Dungeon Master (DM): **the AI narrator and referee. It describes what is happening and decides how hard each action is.

**The Scenario: **the incident you are responding to, told across several Acts with a victory condition and a failure condition.

**The Kill Chain: **the attacker's progress, shown as a series of stages. Your job is to contain them before they reach the end.

**The Scenario Clock: **a countdown. Achieve the objective before it runs out.

**Rounds & Initiative: **play proceeds in rounds; each player takes a turn in initiative order.

**Injects: **sudden complications the DM (or facilitator) introduces mid-incident, including the critical-hit/fail moments described in Section 13.

**Complications: **ongoing penalties (shown as a warning badge with a count) that make actions harder until resolved.

## 18. Getting Started — Quick Start

1. Create one or more characters in the Roster (see Section 19).
2. Choose a scenario from Select Scenario, or build a Campaign to chain several together (Section 27).
3. Assign your character(s) and choose a game mode and timer pressure.
4. Start the session. The DM sets the scene and play begins.

## 19. Your Character

### Archetypes (Classes)

Each character belongs to one of six archetypes. Your archetype determines which actions are "primary" (your specialty, no penalty) versus "secondary" (possible but harder).

| Archetype | Role |
| --- | --- |
| Analyst | Alert triage, log analysis, SIEM queries, identifying indicators of compromise. |
| Hunter | Proactive threat hunting, pivoting on indicators, forensics, tracing lateral movement. |
| Responder | Containment: isolating hosts, blocking traffic, quarantining, deploying countermeasures. |
| Engineer | Automation and infrastructure: scripts, firewall changes, patching, system restoration. |
| Intel Officer | OSINT, attribution, dark-web reconnaissance, threat-actor profiling, intel reporting. |
| Commander | Coordination: directing the team, briefing leadership, declaring incidents, allocating resources. |

### Stats

Six stats modify your rolls. Each point above 2 in the stat a given action uses adds +1 to that roll.

| Stat | Used for |
| --- | --- |
| Vigilance | Spotting things: log review, alert triage, monitoring. |
| Agility | Speed: rapid containment, quick scripted actions. |
| Analysis | Deep reasoning: hunting, forensics, correlation, attribution. |
| Fortitude | Endurance under pressure: recovery, sustained operations. |
| Stealth | Working quietly: OSINT, covert investigation, not tipping off the attacker. |
| Command | Leadership: coordination, briefings, stakeholder management. |

### Skills

Characters hold skills at Level 1–3. When your declared action matches one of your skills, it adds +2 (Level 1–2) or +3 (Level 3) to the roll — the DM matches the words in your action to the skill, so describing what you actually do is what earns the bonus. At Level 3 you may also use a Special Action: a guaranteed success (no critical possible). You pick three skills at character creation from the twenty below, grouped here by focus area.

| Focus area | Skills |
| --- | --- |
| Detection & Analysis | Log Analysis, Behavioral Analysis, Detection Engineering, Threat Intelligence |
| Threat Hunting | Threat Hunting, Lateral Movement Tracking, Threat Attribution |
| Forensics & Malware | Endpoint Forensics, Network Forensics, Memory Forensics, Malware Triage, Malware Reversing |
| Identity & Cloud | Identity Forensics, Cloud IR, OSINT |
| Response & Coordination | Active Defense, Scripting/Automation, Data Loss Prevention, Escalation/Comms, Crisis Communications |

### Traits

Traits are special perks. A character can earn more as they level up.

| Trait | Effect |
| --- | --- |
| First Responder | +1 to all rolls in round 1; priority placement in initiative. |
| Eagle Eye | +1 to all Vigilance-based rolls. |
| Calm Under Pressure | Negates the difficulty increase from the round timer expiring. |
| Digital Bloodhound | +1 to all Analysis-based rolls. |
| Composure | Once per session, turn a Critical Fail into an ordinary Failure. |
| Rally | Once per session, give another player +2 to their next roll (free action). |

## 20. How a Turn Works

1. On your turn, pick an action from the menu. Primary actions (your archetype's specialty) carry no penalty; secondary actions are possible but add +2 to the difficulty.
2. Optionally pick a "quick-fill" sub-action to pre-write your rationale, then edit it to describe exactly what you do.
3. Roll the d20. Your stat and any matching skill/traits add modifiers; the DM sets a Difficulty Class (DC) based on how hard the action is right now.
4. Compare your total to the DC to determine the outcome (below).

### Outcomes

| Result | When | Effect |
| --- | --- | --- |
| Critical Hit | Natural 20 | Exceptional success — may reveal intel, remove a complication, or buy time. |
| Success | Total ≥ DC | The action works as intended; the scene advances. |
| Partial | Up to 3 below DC | Half-works or creates a new minor problem. |
| Failure | 4+ below DC | The action fails; the attacker may advance and a complication is added. |
| Critical Fail | Natural 1 | Something goes badly wrong. |

**Difficulty guide: **DC 8 is easy, 10 moderate, 12 challenging, 14 hard, 16 very hard, 18 extreme. The DM raises the DC under time pressure, active complications, or a fast-advancing attacker.

## 21. The Clock & Timer Pressure

Two clocks matter. The Scenario Clock is the overall countdown to contain the incident. A per-round timer adds pressure to each turn; if it expires, that action becomes harder (DC +4). You choose the timer pressure when starting a session:

| Setting | Time per turn |
| --- | --- |
| Rookie | 180 seconds |
| Analyst | 120 seconds |
| Senior | 90 seconds |
| Elite | 60 seconds |
| None | No timer |

## 22. Stakeholders & Other Characters (NPCs)

Most scenarios cast a handful of non-player characters (NPCs) — people who are not the attacker but who shape your incident: executives, regulators, reporters, system owners, outside experts, and more. They force real tradeoffs about where you spend your time and attention. Which NPCs appear depends on the scenario; not every NPC is in every game.

**Trust & stance: **each NPC has a trust level (0–100) that maps to a stance — Hostile, Skeptical, Neutral, Supportive, or Advocate. Their stance changes how hard related actions are, from +4 to the difficulty (hostile) down to −3 (advocate). How you treat an NPC moves their trust up or down during the session, and their reputation carries forward between sessions.

NPCs come in three kinds, and each is played differently:

| Kind | How they behave | Examples |
| --- | --- | --- |
| Allies | On your side when engaged. Consult, brief, or request help to gain intelligence or make a related action easier. Build trust through good coordination; they cool off if blamed or ignored. | Industry Expert, Intel Contact, System Owner, IT Ops Lead |
| Pressure | Cannot be "won over" — they must be managed. Keep them serviced; neglect them while the incident escalates and they leak information, escalate their demands, or push dangerous shortcuts. | Investigative Reporter, Overbearing Executive, Business-Unit Owner, Regulator |
| Wildcards | Double-edged. They can help, but always with a string attached — an evidence hold, a reporting demand, a churn threat, or a risk-averse veto. | Law Enforcement, Key Client, Vendor Rep, CISO |

### Who You See, and When

**Known from the start: **internal and adjacent people you would already be working with — the CISO, IT Ops, System Owner, Intel Contact, and Executive — appear from the opening scene, so you can engage them proactively.

**Emergent: **outside or surprise parties — a Reporter, Regulator, Law Enforcement, a Key Client, a Vendor, or a Business-Unit Owner — stay hidden until they enter the story. When one appears, treat it like an inject: a new pressure has just walked into the room.

**Playing them well: **brief the people you can reach early, because trust earned now makes later crisis actions easier — and keep an eye on the pressure NPCs, because ignoring a reporter or a regulator while the clock runs has consequences.

## 23. Scenarios

Each scenario unfolds across Acts, each with a primary objective, clues mapped to real MITRE ATT&CK techniques, and sometimes a high-stakes "boss event." Win by meeting the victory condition; lose if the failure condition triggers.

### Difficulty Tiers

| Tier | Who it's for |
| --- | --- |
| Novice | First-timers — short, guided, single-threat incidents. |
| Analyst | Core SOC skills — multi-step investigations. |
| Senior | Complex, multi-threat incidents with heavy stakeholder pressure. |
| Expert | Sophisticated adversaries, simultaneous crises, tight coordination. |
| Elite | Apex / nation-state threats — brutal, with no clean wins. |

### Categories

Scenarios span fourteen categories, each shown as its own folder in Select Scenario:

| Category | Focus |
| --- | --- |
| Fundamentals | Introductory training and core SOC mechanics. |
| Malware | Malware triage, RAT detection, and endpoint threats. |
| Ransomware | Ransomware detection, containment, and recovery. |
| Phishing & BEC | Credential phishing, account takeover, and business email compromise. |
| Identity & Access | Authentication anomalies, credential stuffing, and access abuse. |
| Network Threats | Reconnaissance, lateral movement, and network-based attacks. |
| Cloud Security | Cloud misconfiguration, data breach, and infrastructure threats. |
| Insider Threat | Privileged access abuse, data theft, and insider-driven incidents. |
| Advanced Threats | Nation-state actors, zero-days, and advanced persistent threats. |
| AI-Enabled Threats | Jailbreaks, prompt injection, model/data poisoning, and AI-driven fraud. |
| Supply Chain | Compromised dependencies, CI/CD pipelines, and vendor software. |
| Third-Party & Vendor Risk | Vendor breaches, managed service provider abuse, and trusted-access compromise. |
| OT / ICS | Industrial control systems, physical safety, and operational technology intrusions. |
| DDoS & Extortion | Denial of service, availability attacks, and extortion threats. |

**Custom: **scenarios you or an administrator author (Sections 14 and 27) appear in their own Custom folder if they don't use one of the categories above.

## 24. Game Modes

**Solo: **one player runs the whole response.

**Team: **multiple players take turns, each contributing their archetype's strengths.

**Adversary: **one player acts as the attacker, trying to evade detection while the defenders hunt them.

**Multiplayer (LAN): **a facilitator hosts a room on a trusted local network; players join from their own devices with a room code, each playing their own character while the facilitator runs the DM. See Section 25 for the full hosting/joining walkthrough, spectator view, and facilitator handoff. For use on trusted local networks only — never over the internet (the host pays for AI usage).

## 25. Hosting and Joining Multiplayer Rooms

### Hosting a room (Facilitator)

1. From the home screen, choose Host Game.
2. Enter a room name and set a facilitator passphrase — you will need this if you ever have to reclaim facilitator control mid-session (see "Facilitator handoff" below).
3. Share the room code shown in the Lobby with your players — read it aloud, or on a LAN show the Join QR code (Section 11) so they can scan it instead of typing an IP address.
4. Watch the Lobby fill in as players join; each participant shows a live presence dot (green = connected, gray = offline).
5. When everyone is in, start the session from the Lobby. You run the DM from the Facilitator Panel throughout.

### Joining a room (Player)

1. From the home screen, choose Join Game.
2. Enter the room code the facilitator gave you (or scan the Join QR code, which pre-fills it for you).
3. Pick which character from your Roster you are playing this session.
4. Wait in the Lobby with the rest of the team until the facilitator starts the session.

### Presence

Both the Lobby and the Facilitator Panel show a live green/gray presence dot next to every participant, so the facilitator always knows who is actually connected — useful mid-session if someone's laptop drops off Wi-Fi.

### "Your turn" alerts

If it becomes your turn while your browser tab isn't focused, DICE speaks "It's your turn" (if voice is enabled) and flashes the browser tab's title as "▶ YOUR TURN" until you switch back or act.

### Skip Turn (Facilitator)

If a player goes AFK mid-turn, the facilitator can use "Skip Turn" in the Facilitator Panel to advance to the next player without waiting. It is disabled while the DM is actively thinking or a dice roll is pending, and it logs a note in the session feed so the skip is visible in the after-action report.

### Facilitator handoff

If the facilitator's device disconnects mid-session (presence goes gray with no reconnect), any player in the Lobby sees a "Facilitator offline — reclaim control" prompt. Entering the facilitator passphrase set at hosting time claims facilitator control for that device, and the session resumes from wherever it left off — including jumping straight into an already-active game.

### Spectator / audience view

For a conference demo or a classroom audience, the facilitator can share the Watch QR code / link (Section 11) — anyone who opens it lands on a read-only view at /watch/<code> with no DICE account required. It shows the live narration feed (including streamed DM text), dice-roll animations, and the end-of-session outcome banner, but has no way to take any action or see private information — perfect for a screen at the back of the room.

## 26. Facilitator Mode — In-Session Control Panel

A facilitator (instructor) can open a control panel during a session to:

- Adjust the scenario clock up or down.
- Override the attacker's kill-chain stage.
- Add or remove complications.
- Fire pre-written injects to escalate the situation.
- Skip a player's turn if they've gone AFK (Section 25).
- See live presence for every connected participant (Section 25).
- Add notes to the session log.
- Save the session, or generate a snapshot Hot Wash report mid-exercise.

## 27. Campaigns & Custom Content

The Campaign Builder lets you chain scenarios into a narrative arc, assign a roster, author your own custom scenarios, and define an Organizational Profile.

### Organizational Profile

Set your real security tool stack — your SIEM, EDR, identity provider, and so on. The DM then narrates using the tools you actually own and avoids referencing tools you do not, making the exercise feel like your own environment. Leave a field blank to signal a capability gap, which the DM treats as a real constraint.

### Authoring a custom scenario

Custom scenarios you build stay private to your account by default — they show up only for you, in a Custom folder in Select Scenario. When picking critical-hit/critical-fail moments for your scenario, you choose from the shared Injects Catalog (Section 13) rather than writing new text from scratch.

**Sharing it with your whole team: **either ask an administrator to open it in Admin → Scenarios (Section 14) and save it, which makes it a global scenario visible to everyone, or export it as a content pack (Section 28) for others to import individually.

## 28. Content Packs — Import & Export

Content Packs (.dicepack files) are a portable way to share custom scenarios and roster characters between DICE installs or between users, without needing administrator access.

**Import: **Content Packs page → "Import a .dicepack file". Accepts .dicepack or .json files; anything that isn't valid JSON is rejected with an explicit error rather than silently failing.

**Export: **"Export .dicepack" bundles your own custom scenarios and roster characters into a single shareable JSON file you can send to a teammate or another DICE install.

Imported content lands in your own account, shared with everyone on the install the same way any shared content pack is — it doesn't require an administrator to promote it, unlike Section 14's global scenario authoring.

## 29. After the Game — Reports & Analytics

### The Hot Wash Report

When a session ends, DICE produces a printable, on-screen after-action report including:

- Performance metrics (success rate, critical hits/fails, injects survived, timer expiries).
- A decision log with letter grades for each action.
- An AI assessment of decision quality, independent of dice luck.
- An "Optimal Response Path" — the highest-leverage actions per act, with where the team diverged.
- A recommended learning path and the MITRE ATT&CK techniques encountered.

Use the Print / Export PDF button on this screen to save or share the report via your browser's print dialog.

### Your personal Analytics page

Analytics (in the main menu) shows your own session history, recurring skill gaps, and per-session export buttons:

**PDF: **downloads a formatted after-action report for that session — a title banner, a colored outcome banner (Contained / Partial / Breach), exercise details (facilitator, difficulty, players, date, duration, rounds, acts, final attacker stage), the same metrics as the Hot Wash report, per-player letter grades, learning path items, and the full session timeline.

**JSON: **downloads the raw session record, useful if you want to analyze your history outside DICE.

An administrator sees the same kind of data but for the whole team at once — see Section 12, Program Analytics.

## 30. Character Progression

Characters earn XP from sessions and advance through six levels (XP thresholds: 0, 150, 350, 650, 1050, 1500). On level-up you choose one improvement: upgrade a skill (up to Level 3), gain a new trait, or raise a stat (up to 5). Carry characters across many sessions and campaigns to build a seasoned team.

## 31. Tips for New Teams

- Brief your stakeholders early — trust earned now makes later crisis actions easier.
- Play to your archetype: primary actions are far more reliable than secondary ones.
- Against patient or advanced adversaries, loud actions can tip them off — stealth matters.
- Don't panic at a bad roll; a Partial or even a Failure often opens a new path. Traits like Composure and Rally exist for the worst moments.
- Read the Hot Wash report after every game — the Optimal Path and learning recommendations are where the real training happens.
- Set up a second administrator account early, and if your team is larger than a handful of people, turn on self-registration (Section 8) instead of hand-creating every account.
