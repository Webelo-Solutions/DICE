// Generates editable Word, PDF, AND Markdown documents into ./docs from a
// single shared content model (so the formats never drift):
//   DICE-Setup-Guide.docx / .pdf    — install & first-run guide
//   DICE-User-Manual.docx / .pdf    — how to play
//   DICE-User-Guide.docx  / .md     — everything above, merged, updated, and
//                                     expanded to cover every current feature
// Run: npm run build:docs
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun, TableOfContents,
} from 'docx'
import PDFDocument from 'pdfkit'
import { writeFileSync, mkdirSync, readFileSync, existsSync, createWriteStream } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const OUT = resolve(root, 'docs')
mkdirSync(OUT, { recursive: true })

const BANNER = resolve(root, 'public', 'banner.png')
const bannerBuf = existsSync(BANNER) ? readFileSync(BANNER) : null
const BANNER_W = 1602, BANNER_H = 572   // native px

// ── Shared content model ──────────────────────────────────────────────────────
// Block helpers return plain data; renderers below turn them into docx / pdf.
const h1 = (text) => ({ t: 'h1', text })
const h2 = (text) => ({ t: 'h2', text })
const h3 = (text) => ({ t: 'h3', text })
const p  = (text) => ({ t: 'p', text })
const lead = (label, rest) => ({ t: 'lead', label, rest })
const bullet = (text) => ({ t: 'bullet', text })
const num = (ref, text) => ({ t: 'num', ref, text })
const table = (headers, rows, weights) => ({ t: 'table', headers, rows, weights })
const spacer = () => ({ t: 'spacer' })

function setupGuide() {
  return {
    meta: { title: 'DICE Setup Guide', subtitle: 'Installation & First-Run Guide' },
    blocks: [
      h1('1. About DICE'),
      p('DICE (Defensive Incident Containment Exercises) is a tabletop-style cybersecurity incident-response training game. An AI "Dungeon Master" narrates a live security incident while you and your team make decisions, roll dice, and race a clock to contain the threat. DICE installs and runs entirely on your own computer as a local web application — your browser is the interface, and a small bundled server keeps everything on your machine.'),
      p('A single DICE install can serve an entire team. Each person signs in with their own username and password and has their own characters, campaigns, and session history; shared content (imported scenario packs, the active organizational profile) is available to everyone on the install.'),

      h1('2. System Requirements'),
      bullet('Windows 10 or 11 (64-bit).'),
      bullet('A modern web browser (Edge, Chrome, or Firefox).'),
      bullet('Roughly 200 MB of free disk space.'),
      bullet('An internet connection and an AI provider API key (see Section 6). The AI Dungeon Master runs through your chosen provider.'),
      lead('No prerequisites: ', 'DICE bundles its own runtime — you do NOT need to install Node.js, a database, or anything else.'),

      h1('3. Installing DICE'),
      num('install', 'Download DICE-Setup.exe from the website.'),
      num('install', 'Double-click DICE-Setup.exe to start the installer.'),
      num('install', 'If Windows shows a "Windows protected your PC" (SmartScreen) message, click "More info" then "Run anyway." This appears for newly published software and is expected.'),
      num('install', 'Follow the wizard. DICE installs for your user account only — no administrator password is required.'),
      num('install', 'Leave "Launch DICE now" checked and click Finish.'),

      h1('4. First Launch'),
      num('firstrun', 'Open DICE from the Start Menu (or the desktop shortcut, if you created one).'),
      num('firstrun', 'A small window titled "DICE Server" appears, minimized. Keep it open — it is the local engine. Closing it stops DICE.'),
      num('firstrun', 'Your default browser opens automatically to http://127.0.0.1:3001. If it does not, open that address manually.'),
      num('firstrun', 'The very first time, you will land on a setup screen to create the administrator account (see Section 5). After that, the home screen is behind a sign-in page.'),

      h1('5. First User Setup (Administrator)'),
      p('The very first time DICE opens after install, no users exist yet. DICE will not let you do anything else until you create the administrator account. The administrator is the person who can later create accounts for other players.'),
      num('auth', 'On first launch, your browser opens to a screen titled "Set up DICE".'),
      num('auth', 'Enter a username — lowercase letters, numbers, and ._- only, 2–32 characters. This is what you type at the sign-in screen.'),
      num('auth', 'Enter a display name (1–64 characters). This is what other players see during a session.'),
      num('auth', 'Enter a password of at least 8 characters. Write it down somewhere safe — there is no automated recovery mechanism. If you forget it, the only way back is to wipe the database (see Section 11).'),
      num('auth', 'Click Create administrator account. You are signed in immediately and the setup screen will not appear again.'),
      p('If something interrupts setup before you finish (browser closed, power loss), the setup screen reappears the next time you launch — the install is not considered "done" until an administrator exists.'),

      h1('6. Connecting an AI Provider (Required)'),
      p('The AI Dungeon Master needs an API key from one supported provider. Without it, scenarios cannot be narrated. Each user enters their own key in their own browser; the key is not shared between users.'),
      num('apikey', 'In DICE, open Settings (the provider/settings option in the app).'),
      num('apikey', 'Choose your provider: Anthropic, OpenAI, Microsoft Azure, or Google Gemini.'),
      num('apikey', 'Paste your API key and select a model.'),
      num('apikey', 'Save. The key is stored privately in your browser on this machine and is never written to the DICE database or sent anywhere except your chosen AI provider.'),
      spacer(),
      p('Where to get a key (you pay your provider directly for AI usage):'),
      table(['Provider', 'Models available (default listed first)', 'Where to get a key'], [
        ['Anthropic', 'Claude Sonnet 4.6 (default), Claude Opus 4.7, Claude Haiku 4.5', 'console.anthropic.com'],
        ['OpenAI', 'GPT-4o (default), GPT-4o Mini, GPT-4 Turbo', 'platform.openai.com'],
        ['Microsoft Azure', 'Your GPT-4o deployment (default), GPT-4o Mini, GPT-4', 'Azure OpenAI resource'],
        ['Google Gemini', 'Gemini 2.0 Flash (default), Gemini 1.5 Pro, Gemini 1.5 Flash', 'aistudio.google.com'],
      ], [2, 3, 3]),

      h1('7. Adding More Users (Administrator)'),
      p('Only the administrator can create other accounts — players cannot self-register. This is intentional: DICE is a closed-team training tool, not a public service.'),
      num('addusers', 'From the home screen, click the Admin chip in the top-right corner.'),
      num('addusers', 'On the Users page, click + New User.'),
      num('addusers', 'Enter the new user’s username, display name, an initial password (at least 8 characters), and choose a role:'),
      num('addusers', 'Save. Give the new user their username and initial password through a secure channel (do not email them in plain text). They sign in at the same URL you do.'),
      table(['Role', 'What they can do'], [
        ['Player', 'Play scenarios, manage their own characters and campaigns, see their own session history. This is the right choice for most users.'],
        ['Admin', 'Everything a Player can do, plus create and manage other users. Keep the number of admins small.'],
      ], [1, 4]),
      h2('Managing existing users'),
      lead('Disable an account: ', 'immediately revokes every active session for that user; they are signed out everywhere and cannot sign in again until you re-enable them. Use this when someone leaves the team.'),
      lead('Reset a password: ', 'sets a new password you choose. As a security measure, every active session for that user is also signed out.'),
      lead('Sign someone out everywhere: ', "revokes all of their active sessions without changing their password — useful if their laptop is lost or they're handing off a shared workstation."),
      lead('Change a user’s role: ', 'promote a Player to Admin or demote an Admin to Player.'),
      lead('Safety rails: ', 'you cannot deactivate yourself, sign yourself out, or demote yourself. This is by design — the install can never end up with no working administrator.'),

      h1('8. Signing In and Account Settings'),
      p('Once your administrator has created your account, you sign in at the same URL as the host. Each sign-in stays valid for 30 days per device.'),
      lead('Sign in: ', 'open the DICE address in your browser and enter your username and password.'),
      lead('Change your own password: ', 'click the Account chip in the top-right of any screen, enter your current password, then your new one twice. Saving signs every OTHER device that is signed in as you out — your current device stays signed in.'),
      lead('Forgot your password: ', 'ask the administrator to reset it. They cannot read your existing password — they can only set a new one.'),
      lead('Locked out: ', 'five failed sign-in attempts on the same username lock that account for fifteen minutes. The lock clears automatically when the timer expires, or the administrator can restart the DICE server (which clears all locks immediately).'),
      lead('Session expired: ', 'if your sign-in expires while you have a page open, the next action you take routes you back to the sign-in screen with a "Your session expired" notice. Sign in again to continue.'),

      h1('9. Where Your Data Lives'),
      p('All DICE data — every user’s data combined — lives in a single database file at %LOCALAPPDATA%\\DICE\\dice.db. Within that file, content is split between per-user and shared:'),
      lead('Private to each user: ', 'your roster, your campaigns, your custom scenarios, your save slots, and your session history. Other users on the same install cannot see them.'),
      lead('Shared by everyone on the install: ', 'content packs you import, the active organizational profile, and the master list of built-in scenarios.'),
      lead('Backups: ', 'close DICE first, then copy dice.db somewhere safe. DICE keeps recent changes in a companion file named dice.db-wal until it shuts down, so copying dice.db while DICE is still running can miss your latest sessions. If you must copy it while DICE is open, take dice.db, dice.db-wal and dice.db-shm together. To restore, close DICE and copy the files back. They contain everyone’s data and all accounts — guard them accordingly.'),
      lead('Your API key: ', "kept separately in your browser's local storage (not in the database), so it is never included in a database backup. Each person's browser holds their own key."),

      h1('10. Network & Hosting — Trusted LAN Only'),
      p('DICE runs on a single machine or a trusted local network and must NOT be exposed to the internet. The host’s AI provider key pays for every DM call, so access is intentionally limited to people on a network you control — otherwise unknown users could run up the host’s costs. Sign-in protects against casual access; it does not make the app safe to expose publicly.'),
      lead('Default — localhost only: ', 'out of the box the app is reachable only on the host computer.'),
      lead('Playing across a trusted LAN: ', 'launch DICE with the "DICE (LAN Host)" Start Menu shortcut instead of the normal one — it binds the server to your network so other devices can join. Find the host PC address by running "ipconfig" (the IPv4 address, usually 192.168.x.x); players open http://<host-IP>:3001 in a browser on the same network and sign in with the account the administrator created for them. The first launch may prompt Windows Firewall to allow access on Private networks — allow it. Use only on a trusted network such as a training room or private office — never on guest or public Wi-Fi.'),
      lead('Never expose to the internet: ', 'do not port-forward the app or otherwise make it reachable from outside your local network.'),

      h1('11. Stopping, Updating, Uninstalling'),
      h3('Stopping DICE'),
      p('Close the minimized "DICE Server" window. The app in the browser will stop responding once the server is closed.'),
      h3('Updating'),
      p('Download the newer DICE-Setup.exe and run it. Your database in %LOCALAPPDATA%\\DICE — including all user accounts and per-user data — is preserved across updates.'),
      h3('Uninstalling'),
      p('Use Windows "Add or remove programs" and uninstall DICE. Your saved data is intentionally kept. To remove it too — including every user account — delete the folder %LOCALAPPDATA%\\DICE.'),
      h3('Lost administrator password / full reset'),
      p('There is no automated administrator-password recovery. If the only administrator forgets their password and no other administrator exists, the only path back is to delete %LOCALAPPDATA%\\DICE (which wipes the database) and start over. To avoid this, create at least one extra administrator account in advance.'),

      h1('12. Troubleshooting'),
      lead('The browser did not open: ', 'manually visit http://127.0.0.1:3001.'),
      lead('"This site can’t be reached": ', 'the server may still be starting (wait a few seconds and refresh) or the "DICE Server" window was closed — relaunch DICE.'),
      lead('Port already in use: ', 'another program is using port 3001. Close it, or relaunch DICE.'),
      lead('The setup screen reappears every launch: ', 'the first-run administrator setup did not complete. Finish the form (Section 5) to create the administrator account; until then, the install is not considered done.'),
      lead('"Invalid credentials" when I know my password is correct: ', 'check caps-lock; usernames are case-insensitive but passwords are case-sensitive. If you fumble it five times, the account is locked for 15 minutes — see the "Locked out" lead in Section 8.'),
      lead('I forgot my password: ', 'ask the administrator to reset it (Section 7). Administrators cannot recover an existing password — they can only set a new one.'),
      lead('I am the administrator and I forgot the password: ', 'see "Lost administrator password / full reset" in Section 11. Plan ahead by creating a second administrator account.'),
      lead('The DM does not respond / errors about the model or key: ', 'recheck your API key and selected model in Settings (Section 6), and confirm your provider account has available credit.'),
      lead('Nothing saves / data looks empty: ', 'confirm the "DICE Server" window is open; the app needs it running to read and write your data. Also confirm you are signed in as the right user — each user’s roster and history is private to them.'),
    ],
  }
}

function userManual() {
  return {
    meta: { title: 'DICE User Manual', subtitle: 'How to Play' },
    blocks: [
      h1('1. What Is DICE?'),
      p('DICE is a tabletop-style cybersecurity incident-response game for 1–4 players. An AI Dungeon Master (DM) narrates an unfolding security incident, reacts to your decisions, adjudicates dice rolls, throws in curveballs ("injects"), and drives the scenario to a win or a loss. It is part role-play, part strategy, and part training exercise: every action maps to a real defensive technique.'),
      p('A DICE install is shared by your team — each player signs in with their own account and keeps their own characters, campaigns, and session history. Your administrator (the person who set up DICE) creates accounts for everyone else. If you do not yet have one, ask them. See the Setup Guide for sign-in, password changes, and account management.'),

      h1('2. Core Concepts'),
      lead('The Dungeon Master (DM): ', 'the AI narrator and referee. It describes what is happening and decides how hard each action is.'),
      lead('The Scenario: ', 'the incident you are responding to, told across several Acts with a victory condition and a failure condition.'),
      lead('The Kill Chain: ', 'the attacker’s progress, shown as a series of stages. Your job is to contain them before they reach the end.'),
      lead('The Scenario Clock: ', 'a countdown. Achieve the objective before it runs out.'),
      lead('Rounds & Initiative: ', 'play proceeds in rounds; each player takes a turn in initiative order.'),
      lead('Injects: ', 'sudden complications the DM (or facilitator) introduces mid-incident.'),
      lead('Complications: ', 'ongoing penalties (shown as a warning badge with a count) that make actions harder until resolved.'),

      h1('3. Getting Started'),
      num('start', 'Create one or more characters in the Roster (see Section 4).'),
      num('start', 'Choose a scenario from Select Scenario, or build a Campaign to chain several together.'),
      num('start', 'Assign your character(s) and choose a game mode and timer pressure.'),
      num('start', 'Start the session. The DM sets the scene and play begins.'),

      h1('4. Your Character'),
      h2('Archetypes (Classes)'),
      p('Each character belongs to one of six archetypes. Your archetype determines which actions are "primary" (your specialty, no penalty) versus "secondary" (possible but harder).'),
      table(['Archetype', 'Role'], [
        ['Analyst', 'Alert triage, log analysis, SIEM queries, identifying indicators of compromise.'],
        ['Hunter', 'Proactive threat hunting, pivoting on indicators, forensics, tracing lateral movement.'],
        ['Responder', 'Containment: isolating hosts, blocking traffic, quarantining, deploying countermeasures.'],
        ['Engineer', 'Automation and infrastructure: scripts, firewall changes, patching, system restoration.'],
        ['Intel Officer', 'OSINT, attribution, dark-web reconnaissance, threat-actor profiling, intel reporting.'],
        ['Commander', 'Coordination: directing the team, briefing leadership, declaring incidents, allocating resources.'],
      ], [1, 3]),
      h2('Stats'),
      p('Six stats modify your rolls. Each point above 2 in the stat a given action uses adds +1 to that roll.'),
      table(['Stat', 'Used for'], [
        ['Vigilance', 'Spotting things: log review, alert triage, monitoring.'],
        ['Agility', 'Speed: rapid containment, quick scripted actions.'],
        ['Analysis', 'Deep reasoning: hunting, forensics, correlation, attribution.'],
        ['Fortitude', 'Endurance under pressure: recovery, sustained operations.'],
        ['Stealth', 'Working quietly: OSINT, covert investigation, not tipping off the attacker.'],
        ['Command', 'Leadership: coordination, briefings, stakeholder management.'],
      ], [1, 3]),
      h2('Skills'),
      p('Characters hold skills at Level 1–3. When your declared action matches one of your skills, it adds +2 (Level 1–2) or +3 (Level 3) to the roll — the DM matches the words in your action to the skill, so describing what you actually do is what earns the bonus. At Level 3 you may also use a Special Action: a guaranteed success (no critical possible). You pick three skills at character creation from the twenty below, grouped here by focus area.'),
      table(['Focus area', 'Skills'], [
        ['Detection & Analysis', 'Log Analysis, Behavioral Analysis, Detection Engineering, Threat Intelligence'],
        ['Threat Hunting', 'Threat Hunting, Lateral Movement Tracking, Threat Attribution'],
        ['Forensics & Malware', 'Endpoint Forensics, Network Forensics, Memory Forensics, Malware Triage, Malware Reversing'],
        ['Identity & Cloud', 'Identity Forensics, Cloud IR, OSINT'],
        ['Response & Coordination', 'Active Defense, Scripting/Automation, Data Loss Prevention, Escalation/Comms, Crisis Communications'],
      ], [1, 3]),
      h2('Traits'),
      p('Traits are special perks. A character can earn more as they level up.'),
      table(['Trait', 'Effect'], [
        ['First Responder', '+1 to all rolls in round 1; priority placement in initiative.'],
        ['Eagle Eye', '+1 to all Vigilance-based rolls.'],
        ['Calm Under Pressure', 'Negates the difficulty increase from the round timer expiring.'],
        ['Digital Bloodhound', '+1 to all Analysis-based rolls.'],
        ['Composure', 'Once per session, turn a Critical Fail into an ordinary Failure.'],
        ['Rally', 'Once per session, give another player +2 to their next roll (free action).'],
      ], [1, 2]),

      h1('5. How a Turn Works'),
      num('turn', 'On your turn, pick an action from the menu. Primary actions (your archetype’s specialty) carry no penalty; secondary actions are possible but add +2 to the difficulty.'),
      num('turn', 'Optionally pick a "quick-fill" sub-action to pre-write your rationale, then edit it to describe exactly what you do.'),
      num('turn', 'Roll the d20. Your stat and any matching skill/traits add modifiers; the DM sets a Difficulty Class (DC) based on how hard the action is right now.'),
      num('turn', 'Compare your total to the DC to determine the outcome (below).'),
      h2('Outcomes'),
      table(['Result', 'When', 'Effect'], [
        ['Critical Hit', 'Natural 20', 'Exceptional success — may reveal intel, remove a complication, or buy time.'],
        ['Success', 'Total ≥ DC', 'The action works as intended; the scene advances.'],
        ['Partial', 'Up to 3 below DC', 'Half-works or creates a new minor problem.'],
        ['Failure', '4+ below DC', 'The action fails; the attacker may advance and a complication is added.'],
        ['Critical Fail', 'Natural 1', 'Something goes badly wrong.'],
      ], [2, 2, 4]),
      lead('Difficulty guide: ', 'DC 8 is easy, 10 moderate, 12 challenging, 14 hard, 16 very hard, 18 extreme. The DM raises the DC under time pressure, active complications, or a fast-advancing attacker.'),

      h1('6. The Clock & Timer Pressure'),
      p('Two clocks matter. The Scenario Clock is the overall countdown to contain the incident. A per-round timer adds pressure to each turn; if it expires, that action becomes harder (DC +4). You choose the timer pressure when starting a session:'),
      table(['Setting', 'Time per turn'], [
        ['Rookie', '180 seconds'], ['Analyst', '120 seconds'], ['Senior', '90 seconds'], ['Elite', '60 seconds'], ['None', 'No timer'],
      ], [1, 2]),

      h1('7. Stakeholders & Other Characters (NPCs)'),
      p('Most scenarios cast a handful of non-player characters (NPCs) — people who are not the attacker but who shape your incident: executives, regulators, reporters, system owners, outside experts, and more. They force real tradeoffs about where you spend your time and attention. Which NPCs appear depends on the scenario; not every NPC is in every game.'),
      lead('Trust & stance: ', 'each NPC has a trust level (0–100) that maps to a stance — Hostile, Skeptical, Neutral, Supportive, or Advocate. Their stance changes how hard related actions are, from +4 to the difficulty (hostile) down to −3 (advocate). How you treat an NPC moves their trust up or down during the session, and their reputation carries forward between sessions.'),
      p('NPCs come in three kinds, and each is played differently:'),
      table(['Kind', 'How they behave', 'Examples'], [
        ['Allies', 'On your side when engaged. Consult, brief, or request help to gain intelligence or make a related action easier. Build trust through good coordination; they cool off if blamed or ignored.', 'Industry Expert, Intel Contact, System Owner, IT Ops Lead'],
        ['Pressure', 'Cannot be "won over" — they must be managed. Keep them serviced; neglect them while the incident escalates and they leak information, escalate their demands, or push dangerous shortcuts.', 'Investigative Reporter, Overbearing Executive, Business-Unit Owner, Regulator'],
        ['Wildcards', 'Double-edged. They can help, but always with a string attached — an evidence hold, a reporting demand, a churn threat, or a risk-averse veto.', 'Law Enforcement, Key Client, Vendor Rep, CISO'],
      ], [1, 3, 2]),
      h2('Who You See, and When'),
      lead('Known from the start: ', 'internal and adjacent people you would already be working with — the CISO, IT Ops, System Owner, Intel Contact, and Executive — appear from the opening scene, so you can engage them proactively.'),
      lead('Emergent: ', 'outside or surprise parties — a Reporter, Regulator, Law Enforcement, a Key Client, a Vendor, or a Business-Unit Owner — stay hidden until they enter the story. When one appears, treat it like an inject: a new pressure has just walked into the room.'),
      lead('Playing them well: ', 'brief the people you can reach early, because trust earned now makes later crisis actions easier — and keep an eye on the pressure NPCs, because ignoring a reporter or a regulator while the clock runs has consequences.'),

      h1('8. Scenarios'),
      p('Each scenario unfolds across Acts, each with a primary objective, clues mapped to real MITRE ATT&CK techniques, and sometimes a high-stakes "boss event." Win by meeting the victory condition; lose if the failure condition triggers.'),
      h2('Difficulty Tiers'),
      table(['Tier', 'Who it’s for'], [
        ['Novice', 'First-timers — short, guided, single-threat incidents.'],
        ['Analyst', 'Core SOC skills — multi-step investigations.'],
        ['Senior', 'Complex, multi-threat incidents with heavy stakeholder pressure.'],
        ['Expert', 'Sophisticated adversaries, simultaneous crises, tight coordination.'],
        ['Elite', 'Apex / nation-state threats — brutal, with no clean wins.'],
      ], [1, 3]),
      h2('Categories'),
      p('Scenarios span nine categories: Fundamentals, Malware, Ransomware, Phishing & BEC, Identity & Access, Network Threats, Cloud Security, Insider Threat, and Advanced Threats (APT).'),

      h1('9. Game Modes'),
      lead('Solo: ', 'one player runs the whole response.'),
      lead('Team: ', 'multiple players take turns, each contributing their archetype’s strengths.'),
      lead('Adversary: ', 'one player acts as the attacker, trying to evade detection while the defenders hunt them.'),
      lead('Multiplayer (LAN): ', 'a facilitator hosts a room on a trusted local network; players join from their own devices with a room code, each playing their own character while the facilitator runs the DM. For use on trusted local networks only — never over the internet (the host pays for AI usage).'),

      h1('10. Campaigns & Custom Content'),
      p('The Campaign Builder lets you chain scenarios into a narrative arc, assign a roster, author your own custom scenarios, and define an Organizational Profile.'),
      h2('Organizational Profile'),
      p('Set your real security tool stack — your SIEM, EDR, identity provider, and so on. The DM then narrates using the tools you actually own and avoids referencing tools you do not, making the exercise feel like your own environment. Leave a field blank to signal a capability gap, which the DM treats as a real constraint.'),

      h1('11. Facilitator Mode'),
      p('A facilitator (instructor) can open a control panel during a session to:'),
      bullet('Adjust the scenario clock up or down.'),
      bullet('Override the attacker’s kill-chain stage.'),
      bullet('Add or remove complications.'),
      bullet('Fire pre-written injects to escalate the situation.'),
      bullet('Add notes to the session log.'),
      bullet('Save the session, or generate a snapshot Hot Wash report mid-exercise.'),

      h1('12. After the Game: the Hot Wash Report'),
      p('When a session ends, DICE produces a printable / exportable after-action report including:'),
      bullet('Performance metrics (success rate, critical hits/fails, injects survived, timer expiries).'),
      bullet('A decision log with letter grades for each action.'),
      bullet('An AI assessment of decision quality, independent of dice luck.'),
      bullet('An "Optimal Response Path" — the highest-leverage actions per act, with where the team diverged.'),
      bullet('A recommended learning path and the MITRE ATT&CK techniques encountered.'),
      p('Use the Print / Export PDF button to save or share the report.'),

      h1('13. Character Progression'),
      p('Characters earn XP from sessions and advance through six levels (XP thresholds: 0, 150, 350, 650, 1050, 1500). On level-up you choose one improvement: upgrade a skill (up to Level 3), gain a new trait, or raise a stat (up to 5). Carry characters across many sessions and campaigns to build a seasoned team.'),

      h1('14. Tips'),
      bullet('Brief your stakeholders early — trust earned now makes later crisis actions easier.'),
      bullet('Play to your archetype: primary actions are far more reliable than secondary ones.'),
      bullet('Against patient or advanced adversaries, loud actions can tip them off — stealth matters.'),
      bullet('Don’t panic at a bad roll; a Partial or even a Failure often opens a new path. Traits like Composure and Rally exist for the worst moments.'),
      bullet('Read the Hot Wash report after every game — the Optimal Path and learning recommendations are where the real training happens.'),
    ],
  }
}

// One comprehensive, up-to-date guide: setup + configuration + administration
// + full gameplay, in one document. Supersedes nothing (the two docs above
// keep being generated as-is); this is the "everything, one place" version.
function userGuide() {
  return {
    meta: { title: 'DICE User Guide', subtitle: 'Complete Setup, Configuration & Feature Guide' },
    blocks: [
      h1('1. About DICE'),
      p('DICE (Defensive Incident Containment Exercises) is a tabletop-style cybersecurity incident-response training game. An AI "Dungeon Master" narrates a live security incident while you and your team make decisions, roll dice, and race a clock to contain the threat. DICE installs and runs entirely on your own computer as a local web application — your browser is the interface, and a small bundled server keeps everything on your machine.'),
      p('A single DICE install can serve an entire team. Each person signs in with their own username and password and has their own characters, campaigns, custom scenarios, and session history; shared content (imported content packs, admin-authored global scenarios, the injects catalog, and the active organizational profile) is available to everyone on the install.'),
      p('This guide covers everything in one place: installing and configuring DICE, administering an install (users, analytics, shared content), and playing the game itself — from your first character to hosting a multiplayer session across a LAN.'),

      h1('2. System Requirements'),
      bullet('Windows 10 or 11 (64-bit).'),
      bullet('A modern web browser (Edge, Chrome, or Firefox).'),
      bullet('Roughly 200 MB of free disk space.'),
      bullet('An internet connection and an AI provider API key (see Section 6). The AI Dungeon Master runs through your chosen provider.'),
      lead('No prerequisites: ', 'DICE bundles its own runtime — you do NOT need to install Node.js, a database, or anything else.'),

      h1('3. Installing DICE'),
      num('install', 'Download DICE-Setup.exe from the website.'),
      num('install', 'Double-click DICE-Setup.exe to start the installer.'),
      num('install', 'If Windows shows a "Windows protected your PC" (SmartScreen) message, click "More info" then "Run anyway." This appears for newly published software and is expected.'),
      num('install', 'Follow the wizard. DICE installs for your user account only — no administrator password is required.'),
      num('install', 'Leave "Launch DICE now" checked and click Finish.'),

      h1('4. First Launch'),
      num('firstrun', 'Open DICE from the Start Menu (or the desktop shortcut, if you created one).'),
      num('firstrun', 'A small window titled "DICE Server" appears, minimized. Keep it open — it is the local engine. Closing it stops DICE.'),
      num('firstrun', 'Your default browser opens automatically to http://127.0.0.1:3001. If it does not, open that address manually.'),
      num('firstrun', 'The very first time, you will land on a setup screen to create the administrator account (see Section 5). After that, the home screen is behind a sign-in page.'),

      h1('5. First User Setup (Administrator)'),
      p('The very first time DICE opens after install, no users exist yet. DICE will not let you do anything else until you create the administrator account. The administrator is the person who can later create accounts for other players, enable self-registration, and manage install-wide content.'),
      num('auth', 'On first launch, your browser opens to a screen titled "Set up DICE".'),
      num('auth', 'Enter a username — lowercase letters, numbers, and ._- only, 2–32 characters. This is what you type at the sign-in screen.'),
      num('auth', 'Enter a display name (1–64 characters). This is what other players see during a session.'),
      num('auth', 'Enter a password of at least 8 characters. Write it down somewhere safe — there is no automated recovery mechanism. If you forget it, the only way back is to wipe the database (see Section 15).'),
      num('auth', 'Click Create administrator account. You are signed in immediately and the setup screen will not appear again.'),
      p('If something interrupts setup before you finish (browser closed, power loss), the setup screen reappears the next time you launch — the install is not considered "done" until an administrator exists.'),

      h1('6. Connecting an AI Provider (Required)'),
      p('The AI Dungeon Master needs an API key from one supported provider. Without it, scenarios cannot be narrated. Each user enters their own key in their own browser; the key is not shared between users and is never written to the DICE database.'),
      num('apikey', 'In DICE, open Settings (the provider/settings option in the app).'),
      num('apikey', 'Choose your provider: Anthropic, OpenAI, Microsoft Azure, or Google Gemini.'),
      num('apikey', 'Paste your API key and choose a model (for Azure, enter your endpoint and deployment name instead of picking a model from a list).'),
      num('apikey', 'Save. The key is stored privately in your browser on this machine and is never written to the DICE database or sent anywhere except your chosen AI provider.'),
      spacer(),
      p('Where to get a key (you pay your provider directly for AI usage):'),
      table(['Provider', 'Models available (default listed first)', 'Where to get a key'], [
        ['Anthropic', 'Claude Sonnet 5 (default), Claude Opus 5, Claude Fable 5, Claude Haiku 4.5, Claude Sonnet 4.6, Claude Opus 4.7', 'console.anthropic.com'],
        ['OpenAI', 'GPT-5.6 Sol (default), GPT-5.6 Terra, GPT-5.6 Luna, GPT-4o, GPT-4o Mini', 'platform.openai.com'],
        ['Microsoft Azure', 'GPT-5.6 Sol (default), GPT-4o, GPT-4o Mini, GPT-4 — configured via your own endpoint + deployment name', 'Azure OpenAI resource'],
        ['Google Gemini', 'Gemini 3.7 Flash (default), Gemini 3.5 Flash, Gemini 3.1 Pro (Preview), Gemini 2.5 Flash', 'aistudio.google.com'],
      ], [2, 3, 3]),

      h1('7. Adding Users (Administrator-Created Accounts)'),
      p('Only the administrator can create accounts this way — the default, controlled way to add teammates. Section 8 covers the alternative: letting people create their own accounts with a shared invite code.'),
      num('addusers', 'From the home screen, click the Admin chip in the top-right corner.'),
      num('addusers', 'On the Users page, click + New User.'),
      num('addusers', 'Enter the new user\'s username, display name, an initial password (at least 8 characters), and choose a role:'),
      num('addusers', 'Save. Give the new user their username and initial password through a secure channel (do not email them in plain text). They sign in at the same URL you do.'),
      table(['Role', 'What they can do'], [
        ['Player', 'Play scenarios, manage their own characters and campaigns, see their own session history. This is the right choice for most users.'],
        ['Admin', 'Everything a Player can do, plus create and manage other users, control self-registration, view program analytics, and manage the install-wide injects catalog and scenario library. Keep the number of admins small.'],
      ], [1, 4]),
      h2('Managing existing users'),
      lead('Disable an account: ', 'immediately revokes every active session for that user; they are signed out everywhere and cannot sign in again until you re-enable them. Use this when someone leaves the team.'),
      lead('Reset a password: ', 'sets a new password you choose. As a security measure, every active session for that user is also signed out.'),
      lead('Sign someone out everywhere: ', "revokes all of their active sessions without changing their password — useful if their laptop is lost or they're handing off a shared workstation."),
      lead('Change a user\'s role: ', 'promote a Player to Admin or demote an Admin to Player.'),
      lead('Safety rails: ', 'you cannot deactivate yourself, sign yourself out, or demote yourself. This is by design — the install can never end up with no working administrator.'),

      h1('8. Self-Registration (Invite Code)'),
      p('By default, self-registration is OFF and only an administrator can create accounts (Section 7). For larger teams, an administrator can instead turn on self-registration and share one invite code — anyone who has the code can create their own account, always as a Player. Self-registration can never create an Admin account.'),
      h2('Turning it on (Administrator)'),
      lead('Where: ', 'Admin → Users, in the Registration Code card.'),
      lead('Enable: ', 'set an invite code (4–64 characters) and save. Anyone with the code can now create their own account at the Register page.'),
      lead('Disable: ', 'clear the code and save. Self-registration turns back off immediately; the Register page then refuses new accounts.'),
      h2('Creating your own account (Player)'),
      num('selfreg', 'Get the invite code from your administrator.'),
      num('selfreg', 'Open the DICE address and go to the Register page (or use a link your administrator shares).'),
      num('selfreg', 'Enter the Invite Code, a Username (2+ characters), a Display Name, and a Password (8+ characters).'),
      num('selfreg', 'Click "Create Account". You are signed in immediately as a Player.'),
      lead('If the code is wrong: ', 'you will see "invalid invite code" — check with your administrator.'),
      lead('If self-registration is off: ', 'the page tells you self-registration is disabled on this install — ask your administrator to create your account instead (Section 7) or to enable self-registration.'),

      h1('9. Signing In and Account Settings'),
      p('Once your account exists — whether an administrator created it or you self-registered — you sign in at the same URL as everyone else on the install. Each sign-in stays valid for 30 days per device.'),
      lead('Sign in: ', 'open the DICE address in your browser and enter your username and password.'),
      lead('Change your own password: ', 'click the Account chip in the top-right of any screen, enter your current password, then your new one twice. Saving signs every OTHER device that is signed in as you out — your current device stays signed in.'),
      lead('Forgot your password: ', 'ask the administrator to reset it. They cannot read your existing password — they can only set a new one.'),
      lead('Locked out: ', 'five failed sign-in attempts on the same username lock that account for fifteen minutes. The lock clears automatically when the timer expires, or the administrator can restart the DICE server (which clears all locks immediately).'),
      lead('Session expired: ', 'if your sign-in expires while you have a page open, the next action you take routes you back to the sign-in screen with a "Your session expired" notice. Sign in again to continue.'),

      h1('10. Where Your Data Lives'),
      p('All DICE data — every user\'s data combined — lives in a single database file at %LOCALAPPDATA%\\DICE\\dice.db. Within that file, content is split between per-user and shared:'),
      lead('Private to each user: ', 'your roster, your campaigns, your custom scenarios, your save slots, and your session history. Other users on the same install cannot see them.'),
      lead('Shared by everyone on the install: ', 'content packs you import (Section 28), admin-authored global scenarios (Section 14), the injects catalog (Section 13), the active organizational profile, and the master list of built-in scenarios.'),
      lead('Backups: ', 'close DICE first, then copy dice.db somewhere safe. DICE keeps recent changes in a companion file named dice.db-wal until it shuts down, so copying dice.db while DICE is still running can miss your latest sessions. If you must copy it while DICE is open, take dice.db, dice.db-wal and dice.db-shm together. To restore, close DICE and copy the files back. They contain everyone\'s data and all accounts — guard them accordingly.'),
      lead('Your API key: ', "kept separately in your browser's local storage (not in the database), so it is never included in a database backup. Each person's browser holds their own key."),

      h1('11. Network & Hosting — Trusted LAN Only'),
      p('DICE runs on a single machine or a trusted local network and must NOT be exposed to the internet. The host\'s AI provider key pays for every DM call, so access is intentionally limited to people on a network you control — otherwise unknown users could run up the host\'s costs. Sign-in protects against casual access; it does not make the app safe to expose publicly.'),
      lead('Default — localhost only: ', 'out of the box the app is reachable only on the host computer.'),
      lead('Playing across a trusted LAN: ', 'launch DICE with the "DICE (LAN Host)" Start Menu shortcut instead of the normal one — it binds the server to your network so other devices can join. The first launch may prompt Windows Firewall to allow access on Private networks — allow it. Use only on a trusted network such as a training room or private office — never on guest or public Wi-Fi.'),
      lead('Join links & QR codes: ', 'when hosting a multiplayer room (Section 25), the Lobby screen detects the host\'s LAN address and shows two QR codes so players can scan instead of typing an IP address: a Join link (opens Join Game with the room code pre-filled) and a Watch link (opens the read-only spectator view). The room code is still shown in plain text as a manual fallback.'),
      lead('Never expose to the internet: ', 'do not port-forward the app or otherwise make it reachable from outside your local network.'),

      h1('12. Program Analytics (Administrator)'),
      p('Admin → Analytics ("Program Analytics — All Users") gives an administrator a program-wide view across every user on the install — useful for proving a training program is happening and finding where the gaps are.'),
      bullet('Four summary tiles: Sessions Run, Program Win Rate, Total XP Earned, Scenarios Covered.'),
      bullet('Exercise Cadence: an admin-editable target (in days, default 90 — chosen to align with common compliance cycles such as PCI-DSS, SOC 2, ISO 27001, and NIST CSF) and a per-user table showing Sessions, Win Rate, Last Exercised, and a Status of Never exercised / Overdue / Due soon / On track.'),
      bullet('Program-Wide Recurring Gaps: skill areas that come up as weaknesses in two or more sessions across the whole team, not just one person.'),
      bullet('Scenario Coverage: a grid showing which scenarios have and have not been played by anyone on the install.'),
      lead('Export: ', 'the "Export Program CSV" button downloads the full cross-user dataset for reporting outside DICE.'),
      p('Every user also has their own personal Analytics page (Section 29) showing only their own history — Program Analytics is the administrator-only, all-users view.'),

      h1('13. Injects Catalog (Administrator)'),
      p('Admin → Injects Catalog is an install-wide, centrally curated library of "critical" story beats — the special complications or breaks that can fire on a natural 20 (critical hit) or a natural 1 (critical fail). DICE ships with 24 default entries; an administrator can edit or extend them at any time.'),
      bullet('Entries are grouped into two tables: Critical Hit and Critical Fail.'),
      bullet('Each entry has a Description and an optional NPC effect. Edit either field and click Save — the change applies everywhere the entry is used, immediately, with no reinstall or redeploy needed.'),
      bullet('Deleting an entry asks for confirmation because it removes it from any scenario that references it.'),
      p('Scenario authors (in the Campaign Builder, Section 27, or Admin Scenario Authoring, Section 14) do not write critical-hit/fail text inline — they pick from this catalog with a checkbox list, so a library of well-tested critical moments can be reused and improved across every scenario on the install.'),

      h1('14. Scenario Authoring (Administrator)'),
      p('Admin → Scenarios uses the exact same scenario editor as the player-facing Campaign Builder (Section 27), with one key difference: what you save here is saved as a global scenario, visible to and playable by every user on the install — not just you.'),
      bullet('An administrator can open, edit, or delete any scenario on the install through this page, including scenarios other players authored privately in their own Campaign Builder — a way for admins to curate or fix custom content.'),
      bullet('Use this when a custom scenario should join the shared library everyone sees in Select Scenario — for example, an incident tailored to your organization\'s real tool stack (Section 27, Organizational Profile) that the whole team should train on.'),
      lead('Player-authored vs. admin-authored: ', 'a scenario a Player builds in their own Campaign Builder stays private to them unless an administrator promotes it here, or the player exports it as a content pack (Section 28) for others to import individually.'),

      h1('15. Stopping, Updating, Uninstalling'),
      h3('Stopping DICE'),
      p('Close the minimized "DICE Server" window. The app in the browser will stop responding once the server is closed.'),
      h3('Updating'),
      p('Download the newer DICE-Setup.exe and run it. Your database in %LOCALAPPDATA%\\DICE — including all user accounts and per-user data — is preserved across updates.'),
      h3('Uninstalling'),
      p('Use Windows "Add or remove programs" and uninstall DICE. Your saved data is intentionally kept. To remove it too — including every user account — delete the folder %LOCALAPPDATA%\\DICE.'),
      h3('Lost administrator password / full reset'),
      p('There is no automated administrator-password recovery. If the only administrator forgets their password and no other administrator exists, the only path back is to delete %LOCALAPPDATA%\\DICE (which wipes the database) and start over. To avoid this, create at least one extra administrator account in advance.'),

      h1('16. Setup & Account Troubleshooting'),
      lead('The browser did not open: ', 'manually visit http://127.0.0.1:3001.'),
      lead('"This site can\'t be reached": ', 'the server may still be starting (wait a few seconds and refresh) or the "DICE Server" window was closed — relaunch DICE.'),
      lead('Port already in use: ', 'another program is using port 3001. Close it, or relaunch DICE.'),
      lead('The setup screen reappears every launch: ', 'the first-run administrator setup did not complete. Finish the form (Section 5) to create the administrator account; until then, the install is not considered done.'),
      lead('"Invalid credentials" when I know my password is correct: ', 'check caps-lock; usernames are case-insensitive but passwords are case-sensitive. If you fumble it five times, the account is locked for 15 minutes — see the "Locked out" lead in Section 9.'),
      lead('"self-registration is disabled on this install": ', 'ask your administrator to either give you an admin-created account (Section 7) or turn on self-registration and share the invite code (Section 8).'),
      lead('"invalid invite code": ', 'double-check the code with your administrator — it may have been changed or cleared since you got it.'),
      lead('I forgot my password: ', 'ask the administrator to reset it (Section 7). Administrators cannot recover an existing password — they can only set a new one.'),
      lead('I am the administrator and I forgot the password: ', 'see "Lost administrator password / full reset" in Section 15. Plan ahead by creating a second administrator account.'),
      lead('The DM does not respond / errors about the model or key: ', 'recheck your API key and selected model in Settings (Section 6), and confirm your provider account has available credit.'),
      lead('Nothing saves / data looks empty: ', 'confirm the "DICE Server" window is open; the app needs it running to read and write your data. Also confirm you are signed in as the right user — each user\'s roster and history is private to them.'),

      h1('17. Core Concepts'),
      lead('The Dungeon Master (DM): ', 'the AI narrator and referee. It describes what is happening and decides how hard each action is.'),
      lead('The Scenario: ', 'the incident you are responding to, told across several Acts with a victory condition and a failure condition.'),
      lead('The Kill Chain: ', 'the attacker\'s progress, shown as a series of stages. Your job is to contain them before they reach the end.'),
      lead('The Scenario Clock: ', 'a countdown. Achieve the objective before it runs out.'),
      lead('Rounds & Initiative: ', 'play proceeds in rounds; each player takes a turn in initiative order.'),
      lead('Injects: ', 'sudden complications the DM (or facilitator) introduces mid-incident, including the critical-hit/fail moments described in Section 13.'),
      lead('Complications: ', 'ongoing penalties (shown as a warning badge with a count) that make actions harder until resolved.'),

      h1('18. Getting Started — Quick Start'),
      num('start', 'Create one or more characters in the Roster (see Section 19).'),
      num('start', 'Choose a scenario from Select Scenario, or build a Campaign to chain several together (Section 27).'),
      num('start', 'Assign your character(s) and choose a game mode and timer pressure.'),
      num('start', 'Start the session. The DM sets the scene and play begins.'),

      h1('19. Your Character'),
      h2('Archetypes (Classes)'),
      p('Each character belongs to one of six archetypes. Your archetype determines which actions are "primary" (your specialty, no penalty) versus "secondary" (possible but harder).'),
      table(['Archetype', 'Role'], [
        ['Analyst', 'Alert triage, log analysis, SIEM queries, identifying indicators of compromise.'],
        ['Hunter', 'Proactive threat hunting, pivoting on indicators, forensics, tracing lateral movement.'],
        ['Responder', 'Containment: isolating hosts, blocking traffic, quarantining, deploying countermeasures.'],
        ['Engineer', 'Automation and infrastructure: scripts, firewall changes, patching, system restoration.'],
        ['Intel Officer', 'OSINT, attribution, dark-web reconnaissance, threat-actor profiling, intel reporting.'],
        ['Commander', 'Coordination: directing the team, briefing leadership, declaring incidents, allocating resources.'],
      ], [1, 3]),
      h2('Stats'),
      p('Six stats modify your rolls. Each point above 2 in the stat a given action uses adds +1 to that roll.'),
      table(['Stat', 'Used for'], [
        ['Vigilance', 'Spotting things: log review, alert triage, monitoring.'],
        ['Agility', 'Speed: rapid containment, quick scripted actions.'],
        ['Analysis', 'Deep reasoning: hunting, forensics, correlation, attribution.'],
        ['Fortitude', 'Endurance under pressure: recovery, sustained operations.'],
        ['Stealth', 'Working quietly: OSINT, covert investigation, not tipping off the attacker.'],
        ['Command', 'Leadership: coordination, briefings, stakeholder management.'],
      ], [1, 3]),
      h2('Skills'),
      p('Characters hold skills at Level 1–3. When your declared action matches one of your skills, it adds +2 (Level 1–2) or +3 (Level 3) to the roll — the DM matches the words in your action to the skill, so describing what you actually do is what earns the bonus. At Level 3 you may also use a Special Action: a guaranteed success (no critical possible). You pick three skills at character creation from the twenty below, grouped here by focus area.'),
      table(['Focus area', 'Skills'], [
        ['Detection & Analysis', 'Log Analysis, Behavioral Analysis, Detection Engineering, Threat Intelligence'],
        ['Threat Hunting', 'Threat Hunting, Lateral Movement Tracking, Threat Attribution'],
        ['Forensics & Malware', 'Endpoint Forensics, Network Forensics, Memory Forensics, Malware Triage, Malware Reversing'],
        ['Identity & Cloud', 'Identity Forensics, Cloud IR, OSINT'],
        ['Response & Coordination', 'Active Defense, Scripting/Automation, Data Loss Prevention, Escalation/Comms, Crisis Communications'],
      ], [1, 3]),
      h2('Traits'),
      p('Traits are special perks. A character can earn more as they level up.'),
      table(['Trait', 'Effect'], [
        ['First Responder', '+1 to all rolls in round 1; priority placement in initiative.'],
        ['Eagle Eye', '+1 to all Vigilance-based rolls.'],
        ['Calm Under Pressure', 'Negates the difficulty increase from the round timer expiring.'],
        ['Digital Bloodhound', '+1 to all Analysis-based rolls.'],
        ['Composure', 'Once per session, turn a Critical Fail into an ordinary Failure.'],
        ['Rally', 'Once per session, give another player +2 to their next roll (free action).'],
      ], [1, 2]),

      h1('20. How a Turn Works'),
      num('turn', 'On your turn, pick an action from the menu. Primary actions (your archetype\'s specialty) carry no penalty; secondary actions are possible but add +2 to the difficulty.'),
      num('turn', 'Optionally pick a "quick-fill" sub-action to pre-write your rationale, then edit it to describe exactly what you do.'),
      num('turn', 'Roll the d20. Your stat and any matching skill/traits add modifiers; the DM sets a Difficulty Class (DC) based on how hard the action is right now.'),
      num('turn', 'Compare your total to the DC to determine the outcome (below).'),
      h2('Outcomes'),
      table(['Result', 'When', 'Effect'], [
        ['Critical Hit', 'Natural 20', 'Exceptional success — may reveal intel, remove a complication, or buy time.'],
        ['Success', 'Total ≥ DC', 'The action works as intended; the scene advances.'],
        ['Partial', 'Up to 3 below DC', 'Half-works or creates a new minor problem.'],
        ['Failure', '4+ below DC', 'The action fails; the attacker may advance and a complication is added.'],
        ['Critical Fail', 'Natural 1', 'Something goes badly wrong.'],
      ], [2, 2, 4]),
      lead('Difficulty guide: ', 'DC 8 is easy, 10 moderate, 12 challenging, 14 hard, 16 very hard, 18 extreme. The DM raises the DC under time pressure, active complications, or a fast-advancing attacker.'),

      h1('21. The Clock & Timer Pressure'),
      p('Two clocks matter. The Scenario Clock is the overall countdown to contain the incident. A per-round timer adds pressure to each turn; if it expires, that action becomes harder (DC +4). You choose the timer pressure when starting a session:'),
      table(['Setting', 'Time per turn'], [
        ['Rookie', '180 seconds'], ['Analyst', '120 seconds'], ['Senior', '90 seconds'], ['Elite', '60 seconds'], ['None', 'No timer'],
      ], [1, 2]),

      h1('22. Stakeholders & Other Characters (NPCs)'),
      p('Most scenarios cast a handful of non-player characters (NPCs) — people who are not the attacker but who shape your incident: executives, regulators, reporters, system owners, outside experts, and more. They force real tradeoffs about where you spend your time and attention. Which NPCs appear depends on the scenario; not every NPC is in every game.'),
      lead('Trust & stance: ', 'each NPC has a trust level (0–100) that maps to a stance — Hostile, Skeptical, Neutral, Supportive, or Advocate. Their stance changes how hard related actions are, from +4 to the difficulty (hostile) down to −3 (advocate). How you treat an NPC moves their trust up or down during the session, and their reputation carries forward between sessions.'),
      p('NPCs come in three kinds, and each is played differently:'),
      table(['Kind', 'How they behave', 'Examples'], [
        ['Allies', 'On your side when engaged. Consult, brief, or request help to gain intelligence or make a related action easier. Build trust through good coordination; they cool off if blamed or ignored.', 'Industry Expert, Intel Contact, System Owner, IT Ops Lead'],
        ['Pressure', 'Cannot be "won over" — they must be managed. Keep them serviced; neglect them while the incident escalates and they leak information, escalate their demands, or push dangerous shortcuts.', 'Investigative Reporter, Overbearing Executive, Business-Unit Owner, Regulator'],
        ['Wildcards', 'Double-edged. They can help, but always with a string attached — an evidence hold, a reporting demand, a churn threat, or a risk-averse veto.', 'Law Enforcement, Key Client, Vendor Rep, CISO'],
      ], [1, 3, 2]),
      h2('Who You See, and When'),
      lead('Known from the start: ', 'internal and adjacent people you would already be working with — the CISO, IT Ops, System Owner, Intel Contact, and Executive — appear from the opening scene, so you can engage them proactively.'),
      lead('Emergent: ', 'outside or surprise parties — a Reporter, Regulator, Law Enforcement, a Key Client, a Vendor, or a Business-Unit Owner — stay hidden until they enter the story. When one appears, treat it like an inject: a new pressure has just walked into the room.'),
      lead('Playing them well: ', 'brief the people you can reach early, because trust earned now makes later crisis actions easier — and keep an eye on the pressure NPCs, because ignoring a reporter or a regulator while the clock runs has consequences.'),

      h1('23. Scenarios'),
      p('Each scenario unfolds across Acts, each with a primary objective, clues mapped to real MITRE ATT&CK techniques, and sometimes a high-stakes "boss event." Win by meeting the victory condition; lose if the failure condition triggers.'),
      h2('Difficulty Tiers'),
      table(['Tier', 'Who it\'s for'], [
        ['Novice', 'First-timers — short, guided, single-threat incidents.'],
        ['Analyst', 'Core SOC skills — multi-step investigations.'],
        ['Senior', 'Complex, multi-threat incidents with heavy stakeholder pressure.'],
        ['Expert', 'Sophisticated adversaries, simultaneous crises, tight coordination.'],
        ['Elite', 'Apex / nation-state threats — brutal, with no clean wins.'],
      ], [1, 3]),
      h2('Categories'),
      p('Scenarios span fourteen categories, each shown as its own folder in Select Scenario:'),
      table(['Category', 'Focus'], [
        ['Fundamentals', 'Introductory training and core SOC mechanics.'],
        ['Malware', 'Malware triage, RAT detection, and endpoint threats.'],
        ['Ransomware', 'Ransomware detection, containment, and recovery.'],
        ['Phishing & BEC', 'Credential phishing, account takeover, and business email compromise.'],
        ['Identity & Access', 'Authentication anomalies, credential stuffing, and access abuse.'],
        ['Network Threats', 'Reconnaissance, lateral movement, and network-based attacks.'],
        ['Cloud Security', 'Cloud misconfiguration, data breach, and infrastructure threats.'],
        ['Insider Threat', 'Privileged access abuse, data theft, and insider-driven incidents.'],
        ['Advanced Threats', 'Nation-state actors, zero-days, and advanced persistent threats.'],
        ['AI-Enabled Threats', 'Jailbreaks, prompt injection, model/data poisoning, and AI-driven fraud.'],
        ['Supply Chain', 'Compromised dependencies, CI/CD pipelines, and vendor software.'],
        ['Third-Party & Vendor Risk', 'Vendor breaches, managed service provider abuse, and trusted-access compromise.'],
        ['OT / ICS', 'Industrial control systems, physical safety, and operational technology intrusions.'],
        ['DDoS & Extortion', 'Denial of service, availability attacks, and extortion threats.'],
      ], [2, 3]),
      lead('Custom: ', 'scenarios you or an administrator author (Sections 14 and 27) appear in their own Custom folder if they don\'t use one of the categories above.'),

      h1('24. Game Modes'),
      lead('Solo: ', 'one player runs the whole response.'),
      lead('Team: ', 'multiple players take turns, each contributing their archetype\'s strengths.'),
      lead('Adversary: ', 'one player acts as the attacker, trying to evade detection while the defenders hunt them.'),
      lead('Multiplayer (LAN): ', 'a facilitator hosts a room on a trusted local network; players join from their own devices with a room code, each playing their own character while the facilitator runs the DM. See Section 25 for the full hosting/joining walkthrough, spectator view, and facilitator handoff. For use on trusted local networks only — never over the internet (the host pays for AI usage).'),

      h1('25. Hosting and Joining Multiplayer Rooms'),
      h2('Hosting a room (Facilitator)'),
      num('host', 'From the home screen, choose Host Game.'),
      num('host', 'Enter a room name and set a facilitator passphrase — you will need this if you ever have to reclaim facilitator control mid-session (see "Facilitator handoff" below).'),
      num('host', 'Share the room code shown in the Lobby with your players — read it aloud, or on a LAN show the Join QR code (Section 11) so they can scan it instead of typing an IP address.'),
      num('host', 'Watch the Lobby fill in as players join; each participant shows a live presence dot (green = connected, gray = offline).'),
      num('host', 'When everyone is in, start the session from the Lobby. You run the DM from the Facilitator Panel throughout.'),
      h2('Joining a room (Player)'),
      num('join', 'From the home screen, choose Join Game.'),
      num('join', 'Enter the room code the facilitator gave you (or scan the Join QR code, which pre-fills it for you).'),
      num('join', 'Pick which character from your Roster you are playing this session.'),
      num('join', 'Wait in the Lobby with the rest of the team until the facilitator starts the session.'),
      h2('Presence'),
      p('Both the Lobby and the Facilitator Panel show a live green/gray presence dot next to every participant, so the facilitator always knows who is actually connected — useful mid-session if someone\'s laptop drops off Wi-Fi.'),
      h2('"Your turn" alerts'),
      p('If it becomes your turn while your browser tab isn\'t focused, DICE speaks "It\'s your turn" (if voice is enabled) and flashes the browser tab\'s title as "▶ YOUR TURN" until you switch back or act.'),
      h2('Skip Turn (Facilitator)'),
      p('If a player goes AFK mid-turn, the facilitator can use "Skip Turn" in the Facilitator Panel to advance to the next player without waiting. It is disabled while the DM is actively thinking or a dice roll is pending, and it logs a note in the session feed so the skip is visible in the after-action report.'),
      h2('Facilitator handoff'),
      p('If the facilitator\'s device disconnects mid-session (presence goes gray with no reconnect), any player in the Lobby sees a "Facilitator offline — reclaim control" prompt. Entering the facilitator passphrase set at hosting time claims facilitator control for that device, and the session resumes from wherever it left off — including jumping straight into an already-active game.'),
      h2('Spectator / audience view'),
      p('For a conference demo or a classroom audience, the facilitator can share the Watch QR code / link (Section 11) — anyone who opens it lands on a read-only view at /watch/<code> with no DICE account required. It shows the live narration feed (including streamed DM text), dice-roll animations, and the end-of-session outcome banner, but has no way to take any action or see private information — perfect for a screen at the back of the room.'),

      h1('26. Facilitator Mode — In-Session Control Panel'),
      p('A facilitator (instructor) can open a control panel during a session to:'),
      bullet('Adjust the scenario clock up or down.'),
      bullet('Override the attacker\'s kill-chain stage.'),
      bullet('Add or remove complications.'),
      bullet('Fire pre-written injects to escalate the situation.'),
      bullet('Skip a player\'s turn if they\'ve gone AFK (Section 25).'),
      bullet('See live presence for every connected participant (Section 25).'),
      bullet('Add notes to the session log.'),
      bullet('Save the session, or generate a snapshot Hot Wash report mid-exercise.'),

      h1('27. Campaigns & Custom Content'),
      p('The Campaign Builder lets you chain scenarios into a narrative arc, assign a roster, author your own custom scenarios, and define an Organizational Profile.'),
      h2('Organizational Profile'),
      p('Set your real security tool stack — your SIEM, EDR, identity provider, and so on. The DM then narrates using the tools you actually own and avoids referencing tools you do not, making the exercise feel like your own environment. Leave a field blank to signal a capability gap, which the DM treats as a real constraint.'),
      h2('Authoring a custom scenario'),
      p('Custom scenarios you build stay private to your account by default — they show up only for you, in a Custom folder in Select Scenario. When picking critical-hit/critical-fail moments for your scenario, you choose from the shared Injects Catalog (Section 13) rather than writing new text from scratch.'),
      lead('Sharing it with your whole team: ', 'either ask an administrator to open it in Admin → Scenarios (Section 14) and save it, which makes it a global scenario visible to everyone, or export it as a content pack (Section 28) for others to import individually.'),

      h1('28. Content Packs — Import & Export'),
      p('Content Packs (.dicepack files) are a portable way to share custom scenarios and roster characters between DICE installs or between users, without needing administrator access.'),
      lead('Import: ', 'Content Packs page → "Import a .dicepack file". Accepts .dicepack or .json files; anything that isn\'t valid JSON is rejected with an explicit error rather than silently failing.'),
      lead('Export: ', '"Export .dicepack" bundles your own custom scenarios and roster characters into a single shareable JSON file you can send to a teammate or another DICE install.'),
      p('Imported content lands in your own account, shared with everyone on the install the same way any shared content pack is — it doesn\'t require an administrator to promote it, unlike Section 14\'s global scenario authoring.'),

      h1('29. After the Game — Reports & Analytics'),
      h2('The Hot Wash Report'),
      p('When a session ends, DICE produces a printable, on-screen after-action report including:'),
      bullet('Performance metrics (success rate, critical hits/fails, injects survived, timer expiries).'),
      bullet('A decision log with letter grades for each action.'),
      bullet('An AI assessment of decision quality, independent of dice luck.'),
      bullet('An "Optimal Response Path" — the highest-leverage actions per act, with where the team diverged.'),
      bullet('A recommended learning path and the MITRE ATT&CK techniques encountered.'),
      p('Use the Print / Export PDF button on this screen to save or share the report via your browser\'s print dialog.'),
      h2('Your personal Analytics page'),
      p('Analytics (in the main menu) shows your own session history, recurring skill gaps, and per-session export buttons:'),
      lead('PDF: ', 'downloads a formatted after-action report for that session — a title banner, a colored outcome banner (Contained / Partial / Breach), exercise details (facilitator, difficulty, players, date, duration, rounds, acts, final attacker stage), the same metrics as the Hot Wash report, per-player letter grades, learning path items, and the full session timeline.'),
      lead('JSON: ', 'downloads the raw session record, useful if you want to analyze your history outside DICE.'),
      p('An administrator sees the same kind of data but for the whole team at once — see Section 12, Program Analytics.'),

      h1('30. Character Progression'),
      p('Characters earn XP from sessions and advance through six levels (XP thresholds: 0, 150, 350, 650, 1050, 1500). On level-up you choose one improvement: upgrade a skill (up to Level 3), gain a new trait, or raise a stat (up to 5). Carry characters across many sessions and campaigns to build a seasoned team.'),

      h1('31. Tips for New Teams'),
      bullet('Brief your stakeholders early — trust earned now makes later crisis actions easier.'),
      bullet('Play to your archetype: primary actions are far more reliable than secondary ones.'),
      bullet('Against patient or advanced adversaries, loud actions can tip them off — stealth matters.'),
      bullet('Don\'t panic at a bad roll; a Partial or even a Failure often opens a new path. Traits like Composure and Rally exist for the worst moments.'),
      bullet('Read the Hot Wash report after every game — the Optimal Path and learning recommendations are where the real training happens.'),
      bullet('Set up a second administrator account early, and if your team is larger than a handful of people, turn on self-registration (Section 8) instead of hand-creating every account.'),
    ],
  }
}

// ── DOCX renderer ─────────────────────────────────────────────────────────────
const numberingConfig = {
  config: ['install', 'firstrun', 'auth', 'apikey', 'addusers', 'selfreg', 'host', 'join', 'turn', 'start'].map((reference) => ({
    reference,
    levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.START }],
  })),
}

function docxCell(text, { header = false, bold = false } = {}) {
  return new TableCell({
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    shading: header ? { fill: '1F2937' } : undefined,
    children: [new Paragraph({ children: [new TextRun({ text, bold: bold || header, color: header ? 'FFFFFF' : '000000' })] })],
  })
}
function docxTable(headers, rows) {
  const b = { style: BorderStyle.SINGLE, size: 4, color: 'B0B7C3' }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b },
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h) => docxCell(h, { header: true })) }),
      ...rows.map((r) => new TableRow({ children: r.map((c, i) => docxCell(c, { bold: i === 0 })) })),
    ],
  })
}

function toDocx({ meta, blocks }, { toc = false } = {}) {
  const children = []
  if (bannerBuf) {
    const w = 460, h = Math.round((w * BANNER_H) / BANNER_W)
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 600, after: 200 },
      children: [new ImageRun({ data: bannerBuf, type: 'png', transformation: { width: w, height: h } })] }))
  }
  children.push(
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: bannerBuf ? 0 : 800, after: 60 },
      children: [new TextRun({ text: meta.title, bold: true, size: 52, color: '0B5FFF' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 },
      children: [new TextRun({ text: meta.subtitle, size: 28, color: '374151' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 },
      children: [new TextRun({ text: 'Defensive Incident Containment Exercises', italics: true, size: 22, color: '6B7280' })] }),
  )
  if (toc) {
    children.push(
      new Paragraph({ text: 'Table of Contents', heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 120 }, pageBreakBefore: true }),
      new TableOfContents('Table of Contents', { hyperlink: true, headingStyleRange: '1-2' }),
      new Paragraph({ text: '', pageBreakBefore: true }),
    )
  }
  for (const blk of blocks) {
    switch (blk.t) {
      case 'h1': children.push(new Paragraph({ text: blk.text, heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 140 } })); break
      case 'h2': children.push(new Paragraph({ text: blk.text, heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 } })); break
      case 'h3': children.push(new Paragraph({ text: blk.text, heading: HeadingLevel.HEADING_3, spacing: { before: 180, after: 80 } })); break
      case 'p': children.push(new Paragraph({ children: [new TextRun(blk.text)], spacing: { after: 120 } })); break
      case 'lead': children.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: blk.label, bold: true }), new TextRun(blk.rest)] })); break
      case 'bullet': children.push(new Paragraph({ text: blk.text, bullet: { level: 0 }, spacing: { after: 60 } })); break
      case 'num': children.push(new Paragraph({ text: blk.text, numbering: { reference: blk.ref, level: 0 }, spacing: { after: 60 } })); break
      case 'table': children.push(docxTable(blk.headers, blk.rows)); children.push(new Paragraph({ text: '' })); break
      case 'spacer': children.push(new Paragraph({ text: '' })); break
    }
  }
  return new Document({ numbering: numberingConfig, sections: [{ children }] })
}

// ── PDF renderer (pdfkit) ─────────────────────────────────────────────────────
function toPdf({ meta, blocks }, outPath) {
  return new Promise((resolveDone, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margins: { top: 60, bottom: 60, left: 64, right: 64 } })
    const stream = createWriteStream(outPath)
    doc.pipe(stream)
    stream.on('finish', resolveDone)
    stream.on('error', reject)

    const left = doc.page.margins.left
    const contentW = doc.page.width - doc.page.margins.left - doc.page.margins.right
    const bottomY = () => doc.page.height - doc.page.margins.bottom
    const ensure = (need) => { if (doc.y + need > bottomY()) doc.addPage() }
    const counters = {}

    // Title page
    if (bannerBuf) {
      const w = 360, h = (w * BANNER_H) / BANNER_W
      doc.image(bannerBuf, (doc.page.width - w) / 2, 120, { width: w })
      doc.y = 120 + h + 30
    } else { doc.y = 200 }
    doc.font('Helvetica-Bold').fontSize(30).fillColor('#0B5FFF').text(meta.title, { align: 'center' })
    doc.moveDown(0.3).font('Helvetica').fontSize(15).fillColor('#374151').text(meta.subtitle, { align: 'center' })
    doc.moveDown(0.3).font('Helvetica-Oblique').fontSize(11).fillColor('#6B7280').text('Defensive Incident Containment Exercises', { align: 'center' })
    doc.addPage()
    doc.fillColor('#000000')

    function pdfTable(headers, rows, weights) {
      const w = weights || headers.map(() => 1)
      const sum = w.reduce((a, b) => a + b, 0)
      const colW = w.map((x) => (contentW * x) / sum)
      const pad = 5
      const drawRow = (cells, header) => {
        doc.fontSize(9).font(header ? 'Helvetica-Bold' : 'Helvetica')
        let rh = 0
        cells.forEach((c, i) => { rh = Math.max(rh, doc.heightOfString(String(c), { width: colW[i] - 2 * pad })) })
        rh += 2 * pad
        if (doc.y + rh > bottomY()) doc.addPage()
        const y = doc.y
        let x = left
        cells.forEach((c, i) => {
          if (header) doc.rect(x, y, colW[i], rh).fill('#1F2937')
          doc.font(header || i === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor(header ? '#FFFFFF' : '#000000')
          doc.text(String(c), x + pad, y + pad, { width: colW[i] - 2 * pad })
          doc.rect(x, y, colW[i], rh).lineWidth(0.5).strokeColor('#B0B7C3').stroke()
          x += colW[i]
        })
        doc.fillColor('#000000')
        doc.y = y + rh
        doc.x = left
      }
      drawRow(headers, true)
      rows.forEach((r) => drawRow(r, false))
      doc.moveDown(0.6)
    }

    for (const blk of blocks) {
      switch (blk.t) {
        case 'h1': ensure(40); doc.moveDown(0.6).font('Helvetica-Bold').fontSize(16).fillColor('#0B5FFF').text(blk.text); doc.moveDown(0.2).fillColor('#000000'); break
        case 'h2': ensure(34); doc.moveDown(0.4).font('Helvetica-Bold').fontSize(13).fillColor('#111827').text(blk.text); doc.moveDown(0.15).fillColor('#000000'); break
        case 'h3': ensure(28); doc.moveDown(0.3).font('Helvetica-Bold').fontSize(11).fillColor('#374151').text(blk.text); doc.moveDown(0.1).fillColor('#000000'); break
        case 'p': ensure(24); doc.font('Helvetica').fontSize(10.5).fillColor('#000000').text(blk.text, { align: 'left' }); doc.moveDown(0.5); break
        case 'lead':
          ensure(24); doc.fontSize(10.5).fillColor('#000000')
          doc.font('Helvetica-Bold').text(blk.label, { continued: true }).font('Helvetica').text(blk.rest)
          doc.moveDown(0.4); break
        case 'bullet':
          ensure(20); doc.font('Helvetica').fontSize(10.5).fillColor('#000000')
          doc.text('•  ' + blk.text, { indent: 12 }); doc.moveDown(0.2); break
        case 'num': {
          counters[blk.ref] = (counters[blk.ref] || 0) + 1
          ensure(20); doc.font('Helvetica').fontSize(10.5).fillColor('#000000')
          doc.text(counters[blk.ref] + '.  ' + blk.text, { indent: 12 }); doc.moveDown(0.2); break
        }
        case 'table': ensure(60); pdfTable(blk.headers, blk.rows, blk.weights); break
        case 'spacer': doc.moveDown(0.4); break
      }
    }
    doc.end()
  })
}

// ── Markdown renderer ──────────────────────────────────────────────────────────
function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function toMarkdown({ meta, blocks }) {
  const toc = blocks.filter((b) => b.t === 'h1').map((b) => `- [${b.text}](#${slugify(b.text)})`)
  const lines = [
    `# ${meta.title}`, '', `*${meta.subtitle}*`, '', '_Defensive Incident Containment Exercises_', '',
    '## Table of Contents', '', ...toc, '',
  ]
  const counters = {}
  for (let i = 0; i < blocks.length; i++) {
    const blk = blocks[i]
    const next = blocks[i + 1]
    switch (blk.t) {
      case 'h1': lines.push(`## ${blk.text}`); break
      case 'h2': lines.push(`### ${blk.text}`); break
      case 'h3': lines.push(`#### ${blk.text}`); break
      case 'p': lines.push(blk.text); break
      case 'lead': lines.push(`**${blk.label}**${blk.rest}`); break
      case 'bullet': lines.push(`- ${blk.text}`); break
      case 'num': counters[blk.ref] = (counters[blk.ref] || 0) + 1; lines.push(`${counters[blk.ref]}. ${blk.text}`); break
      case 'table':
        lines.push(`| ${blk.headers.join(' | ')} |`)
        lines.push(`| ${blk.headers.map(() => '---').join(' | ')} |`)
        for (const row of blk.rows) lines.push(`| ${row.map((c) => String(c).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')).join(' | ')} |`)
        break
      case 'spacer': break
    }
    const sameListContinues = (blk.t === 'bullet' && next?.t === 'bullet') ||
      (blk.t === 'num' && next?.t === 'num' && next.ref === blk.ref)
    if (!sameListContinues) lines.push('')
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

// ── build all files ────────────────────────────────────────────────────────────
const docs = [
  ['DICE-Setup-Guide', setupGuide()],
  ['DICE-User-Manual', userManual()],
]
for (const [name, content] of docs) {
  writeFileSync(resolve(OUT, `${name}.docx`), await Packer.toBuffer(toDocx(content)))
  await toPdf(content, resolve(OUT, `${name}.pdf`))
}

const guide = userGuide()
writeFileSync(resolve(OUT, 'DICE-User-Guide.docx'), await Packer.toBuffer(toDocx(guide, { toc: true })))
writeFileSync(resolve(OUT, 'DICE-User-Guide.md'), toMarkdown(guide))

console.log('✓ Wrote .docx and .pdf for: ' + docs.map((d) => d[0]).join(', ') + (bannerBuf ? '  (with banner)' : '  (no banner found)'))
console.log('✓ Wrote DICE-User-Guide.docx and DICE-User-Guide.md (combined setup + configuration + full feature guide)')
