// Generates editable Word AND PDF documents into ./docs from a single shared
// content model (so the two formats never drift):
//   DICE-Setup-Guide.docx / .pdf   — install & first-run guide
//   DICE-User-Manual.docx  / .pdf   — how to play
// Run: npm run build:docs
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun,
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
      lead('Backups: ', 'simply copy dice.db somewhere safe. To restore, copy it back. The file contains everyone’s data and all accounts — guard it accordingly.'),
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

// ── DOCX renderer ─────────────────────────────────────────────────────────────
const numberingConfig = {
  config: ['install', 'firstrun', 'auth', 'apikey', 'addusers', 'turn', 'start'].map((reference) => ({
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

function toDocx({ meta, blocks }) {
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

// ── build all four files ──────────────────────────────────────────────────────
const docs = [
  ['DICE-Setup-Guide', setupGuide()],
  ['DICE-User-Manual', userManual()],
]
for (const [name, content] of docs) {
  writeFileSync(resolve(OUT, `${name}.docx`), await Packer.toBuffer(toDocx(content)))
  await toPdf(content, resolve(OUT, `${name}.pdf`))
}
console.log('✓ Wrote .docx and .pdf for: ' + docs.map((d) => d[0]).join(', ') + (bannerBuf ? '  (with banner)' : '  (no banner found)'))
