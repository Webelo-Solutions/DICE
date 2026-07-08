# Scenario Pack: RANSOMWARE-01
# "Double Tap"

---

## Metadata

| Field           | Value                                    |
|-----------------|------------------------------------------|
| ID              | RANSOMWARE-01                            |
| Title           | Double Tap                               |
| Threat Type     | Ransomware (Human-Operated)              |
| Threat Actor    | FIN-7 inspired — financially motivated  |
| Difficulty      | 2 / 5                                    |
| Recommended Players | 1–3                                 |
| Estimated Duration  | 60–90 minutes                       |
| Scenario Clock  | 90 minutes                               |

---

## Summary

A finance workstation begins executing unusual PowerShell commands at 2:14 AM. What looks like a single compromised endpoint is the visible tip of a pre-staged ransomware deployment. The attacker has had two weeks of dwell time and has already moved laterally. The team must scope the incident, identify the staging server, and contain the spread before the ransomware payload deploys across the environment.

---

## Victory Condition

Identify and isolate all compromised endpoints, neutralize the C2 channel, and remove the staging server before the ransomware payload executes.

## Failure Condition

Ransomware deploys to more than 50% of endpoints, or the attacker successfully exfiltrates the finance database before containment.

---

## Kill Chain Stages (Attacker Progress Tracker)

1. `initial_access` — Phishing email opened 14 days prior; Cobalt Strike beacon established
2. `execution` — PowerShell cradle executing in memory on patient zero
3. `persistence` — Scheduled task and registry run key planted on three hosts
4. `privilege_escalation` — Local admin credentials harvested; Kerberoasting attempt underway
5. `lateral_movement` — Beacon spread to file server and backup server via pass-the-hash
6. `collection` — Finance database identified; staging directory created on file server
7. `exfiltration` — Data being chunked and sent to C2 over HTTPS (port 443)
8. `impact` — Ransomware payload deployed; encryption begins

---

## Acts

### ACT I — The First Alert
**Seed:** A Tier 1 analyst flags an unusual PowerShell execution alert on FINWKS-04, a finance department workstation. The alert fired at 2:14 AM. The workstation belongs to a finance analyst who is currently on vacation.

**Primary Objective:** Determine if this is a true positive and identify the initial execution vector.

**Clue Set:**
- EDR alert: `powershell.exe -enc [base64 string]` spawned from `outlook.exe`
- Email logs: A phishing email with a macro-enabled attachment was opened 14 days ago
- Parent process on FINWKS-04: `OUTLOOK.EXE → powershell.exe → rundll32.exe`
- Network logs: Outbound HTTPS to `cdn-update.microsoftedge-cdn[.]com` (C2 domain, typosquatted)

**Boss Event:** None in Act I — this act is orientation.

**Attacker Advance Condition:** If no containment action is taken against FINWKS-04 by end of Act I, beacon beaconing interval drops from 60s to 5s (attacker becomes more active — increase DC on all subsequent network analysis by 2).

---

### ACT II — The Scope Problem
**Seed:** EDR telemetry shows FINWKS-04 made internal SMB connections to FILESVR-01 and BKPSVR-02 at 3:00 AM. The beacon is no longer unique to one host.

**Primary Objective:** Map the full blast radius — identify all compromised endpoints before attempting containment.

**Clue Set:**
- AD logs: A service account (`svc_backup`) authenticated to FILESVR-01 and BKPSVR-02 with a pass-the-hash technique
- EDR: Cobalt Strike artifacts found in memory on FILESVR-01 (`C:\Windows\Temp\svchost32.exe`)
- Scheduled task on FILESVR-01: `\Microsoft\Windows\Update\WindowsUpdateHelper` — runs `svchost32.exe` at boot
- BKPSVR-02: EDR agent is silent — agent was uninstalled remotely via the compromised service account

**Boss Event:** At the start of Act II, the CISO calls demanding a status update within 15 minutes. A Commander class player can handle this with a DC 10 Command roll. Failure adds the complication `executive_pressure` (+2 DC to all Analysis rolls for 2 rounds due to distraction).

**Inject Table (Act II):**
1. `IT_CHANGE_CONFLICT` — The IT team tells you they have a scheduled maintenance window starting in 30 minutes for FILESVR-01. Isolating it now will be blamed on the SOC.
2. `SECOND_PHISH` — A second phishing email is detected in the mail queue, targeting three more finance users. Do they block it now or wait to trace the campaign?
3. `EDR_OVERLOAD` — The EDR console is slow due to a simultaneous IR on a separate incident (ransomware drill gone wrong in the test environment). All EDR queries take twice as long this round (DC+2 for EDR-based actions).

---

### ACT III — The Clock Accelerates
**Seed:** Velociraptor hunt results show `svchost32.exe` running on BKPSVR-02 and a third host: DCSVR-01, a domain controller. The attacker has domain controller access.

**Primary Objective:** Neutralize the attacker's foothold on the domain controller before Kerberoasting yields domain admin credentials.

**Clue Set:**
- AD Security log: Kerberos TGS requests for three high-value service accounts in the last 10 minutes
- FILESVR-01 staging directory: `C:\ProgramData\temp\` contains 47GB of compressed files — finance database backup
- Network: Outbound connections from FILESVR-01 to the C2 over HTTPS ramping up — exfil has begun
- DCSVR-01: `mimikatz` artifacts in memory; LSASS access logged

**Boss Event:** The attacker detects an active investigation (triggered by any failed stealth-based action in Act II or III). They accelerate the ransomware deployment timeline by 20 minutes (reduce scenario clock by 20 minutes). DM narration: *"Something shifts. The beacon intervals spike. They know you're watching."*

**Inject Table (Act III):**
1. `LEGAL_HOLD` — Legal counsel instructs the team not to touch FILESVR-01 until they can assess regulatory exposure. Containment of FILESVR-01 now requires a DC 14 Command roll to override.
2. `VPN_PIVOT` — A new C2 channel opens through the corporate VPN from a remote employee's machine. Was their credentials stolen? Is it the attacker? Is it the employee?
3. `BACKUP_CORRUPT` — Recovery is going to be harder: BKPSVR-02's backups for the last 5 days are encrypted. The attacker pre-staged this. Remove 10 minutes from the scenario clock.

---

### ACT IV — Containment or Catastrophe
**Seed:** The team has enough intelligence to attempt full containment, but every action now carries risk. The ransomware payload is staged and waiting for a trigger. The attacker is watching.

**Primary Objective:** Execute a coordinated containment — isolate all compromised hosts simultaneously to prevent the attacker from triggering early deployment.

**Clue Set:**
- The ransomware trigger: A scheduled task on DCSVR-01 fires at the top of each hour. The next trigger window is in 12 minutes.
- The kill switch: The ransomware binary checks for a specific mutex (`{8F4D3A2C-1B7E-4F9A-8C5D-2E6B3F1A7D4E}`) before executing. Creating this mutex on all endpoints will prevent execution — but requires deploying a script enterprise-wide in under 12 minutes.
- C2 blocklist: The C2 domain resolves to a Cloudflare-proxied IP. Blocking at the firewall requires escalation to the network team.

**Boss Event:** With 5 minutes remaining, the attacker manually triggers the ransomware rather than waiting for the scheduled task. The team has one round to stop it. All actions this round are DC+4. A Critical Hit in this round ends the game in victory.

**Inject Table (Act IV):**
1. `CEO_LAPTOP` — The CEO's laptop is detected in the blast radius. Any containment action that takes down the CEO's machine requires a DC 16 Command roll for authorization.
2. `RANSOM_NOTE_DRAFT` — An analyst finds a pre-staged ransom note on FILESVR-01. The attacker's ransom demand is $4.2M in Monero. Does this change the team's approach?
3. `THREAT_INTEL_HIT` — A threat intel platform identifies the C2 domain as associated with the "BlackMatter" successor group. Two other companies in the same sector were hit this week. This is a campaign.

---

### ACT V — Resolution
**Seed:** The containment actions are complete — or failed. The scene is either an environment being restored, or an environment being encrypted.

**Outcome A (Victory):** All compromised hosts isolated. C2 channel severed. Ransomware payload neutralized. The attacker is evicted. Begin eradication and recovery planning.
**Outcome B (Partial Victory):** Containment was incomplete. One or two hosts were encrypted, but the domain controller and file server were saved. Recovery is painful but possible.
**Outcome C (Defeat):** Ransomware deployed to more than 50% of endpoints. Recovery will take weeks. Backups are partially corrupt.

**Scoring:**
- Base XP: 100 (participation)
- Full victory: +150 XP
- Partial victory: +75 XP
- Injects survived: +15 XP each
- Scenario clock remaining at close: +1 XP per minute remaining
- Critical Hits landed: +20 XP each
- Critical Fails: -10 XP each

---

## Inject Master Table

| ID | Act | Trigger | Description | Mechanical Effect |
|----|-----|---------|-------------|-------------------|
| IT_CHANGE_CONFLICT | II | DM discretion | IT maintenance window conflict | +2 DC to containment actions on FILESVR-01 for 1 round |
| SECOND_PHISH | II | DM discretion | Second phishing campaign in queue | Forces a decision — block now or observe; choosing observe adds complication `potential_new_victims` |
| EDR_OVERLOAD | II | DM discretion | EDR console degraded | +2 DC to all EDR-based actions for 2 rounds |
| LEGAL_HOLD | III | DM discretion | Legal blocks FILESVR-01 touch | DC 14 Command required to override |
| VPN_PIVOT | III | 50% clock | New C2 channel via VPN | New investigation thread; adds complication `vPN_pivot_unknown` |
| BACKUP_CORRUPT | III | 50% clock | Backups pre-encrypted | -10 minutes from scenario clock |
| CEO_LAPTOP | IV | DM discretion | CEO in blast radius | DC 16 Command required for containment of CEO device |
| RANSOM_NOTE_DRAFT | IV | DM discretion | Ransom demand found | Role-play inject — no mechanical effect unless team changes approach |
| THREAT_INTEL_HIT | IV | 25% clock | Attribution identified | +2 to all Stealth-based rolls for 2 rounds (knowing their TTPs helps) |
| CISO_UPDATE | II | Boss Event | CISO demands status | DC 10 Command; failure adds `executive_pressure` complication |
| ATTACKER_DETECTS | III | Boss Event | Attacker notices investigation | -20 minutes from scenario clock |
| MANUAL_TRIGGER | IV | Boss Event | Attacker triggers early | DC+4 all actions for 1 round |
