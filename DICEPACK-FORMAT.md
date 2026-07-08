# `.dicepack` — DICE Content Pack Format

**Status:** Draft v1 (spec only — not yet implemented)
**Schema version:** `1`
**Last updated:** 2026-05-24

A **content pack** lets anyone publish and share DICE scenarios and characters as a
single file that other people can import into a running DICE install — **no
reinstall, no recompile.** This document is the authoritative format spec; the
runtime validator (Zod schemas) and the import pipeline should be derived from it.

---

## 1. Goals & principles

- **Data, never code.** A pack contains only declarative content. Nothing in a
  pack is ever executed, `eval`'d, or used as a template in an executable context.
  All text is rendered through React (auto-escaped). This keeps the attack surface
  minimal: the worst a malformed pack can do is fail validation.
- **Self-contained.** One file holds everything needed (character headshots are
  embedded as base64, exactly as the app already stores them).
- **Forward-compatible.** `schemaVersion` and optional fields let newer apps read
  older packs, and let the format grow (campaigns, org profiles) without breaking
  existing packs.
- **Cleanly removable.** Every item carries enough provenance that an installed
  pack can be disabled or uninstalled without leaving orphans.

---

## 2. File basics

| Property | Value |
|---|---|
| Extension | `.dicepack` |
| Encoding | UTF-8, no BOM |
| Content | A single JSON object (the **pack envelope**, §3) |
| MIME (informal) | `application/json` |
| Compression | None in v1. (A future revision may define a zipped container for packs bundling large binary assets; such packs would use the same envelope as `manifest.json` inside the archive.) |

---

## 3. Top-level structure (the envelope)

```jsonc
{
  "format": "dicepack",     // literal string, identifies the file type
  "schemaVersion": 1,       // integer; the format contract this file targets
  "pack": { /* Manifest (§4) */ },
  "content": {
    "scenarios":  [ /* PackScenario[] (§5) */ ],
    "characters": [ /* PackCharacter[] (§6) */ ]
  }
}
```

- `format` **MUST** equal `"dicepack"`. Importers reject anything else.
- `schemaVersion` **MUST** be an integer the importing app understands. An app
  rejects a pack whose `schemaVersion` is greater than the maximum it supports, and
  may migrate packs with a lower one.
- `pack` is required (§4).
- `content` is required and **MUST** contain at least one non-empty array.
  Both `scenarios` and `characters` are arrays; either may be empty, but not both.

Unknown top-level keys **SHOULD** be ignored by importers (forward-compat), but the
exporter **MUST NOT** emit keys outside this spec.

---

## 4. The manifest (`pack`)

```jsonc
"pack": {
  "id":            "com.kyerrid.ot-threats",   // REQUIRED, globally unique
  "name":          "OT & ICS Threat Pack",     // REQUIRED, display name
  "version":       "1.0.0",                     // REQUIRED, semver
  "author":        "Your Name",                 // REQUIRED
  "description":   "Six OT scenarios + 3 operators.",  // optional
  "minAppVersion": "1.0.0",                     // optional, advisory
  "createdAt":     "2026-06-06T00:00:00Z",      // optional, ISO 8601 UTC
  "tags":          ["ot", "ics", "manufacturing"]      // optional
}
```

| Field | Type | Req | Rule |
|---|---|---|---|
| `id` | string | ✓ | **Pack identity.** Globally unique and stable across versions. Recommended forms: reverse-DNS (`com.author.packname`) or a UUID. Pattern: `^[a-zA-Z0-9][a-zA-Z0-9._-]{2,63}$`. This is the namespace key for all the pack's items (§7). |
| `name` | string | ✓ | 1–80 chars. Human-readable. |
| `version` | string | ✓ | Semantic version `MAJOR.MINOR.PATCH`. Used to detect updates (§8). |
| `author` | string | ✓ | 1–80 chars. |
| `description` | string | – | ≤ 500 chars. |
| `minAppVersion` | string | – | Semver. **Advisory:** if the running app is older, it warns the user but the actual gate is `schemaVersion`. |
| `createdAt` | string | – | ISO 8601 UTC timestamp. |
| `tags` | string[] | – | ≤ 12 tags, each ≤ 24 chars. For filtering/search. |

---

## 5. Pack scenarios (`content.scenarios[]`)

Each entry is a **`ScenarioPack`** object exactly as the engine consumes it (see
`src/types/game.ts`). The pack format adds no new scenario fields — it carries the
native type. Fields and constraints:

| Field | Type | Req | Rule |
|---|---|---|---|
| `id` | string | ✓ | Unique **within the pack**, 1–64 chars, and may not contain `::` (reserved for namespacing, §7). Any authored id works (e.g. `OT-PHISH-01`, a `CUSTOM-A3F9`, or a UUID); becomes globally unique on import via namespacing. |
| `title` | string | ✓ | 1–100 chars. |
| `category` | string | – | One of the known categories (§9.1). Unknown categories are accepted but filed under "Uncategorized". |
| `threatType` | string | ✓ | 1–100 chars. Free text (e.g. "Human-Operated Ransomware"). |
| `difficulty` | integer | ✓ | `1`–`5` (Novice → Elite). |
| `recommendedPlayers` | string | ✓ | e.g. `"1–3"`. ≤ 16 chars. |
| `estimatedMinutes` | integer | ✓ | 1–600. |
| `scenarioClockStart` | integer | ✓ | 1–1440 (minutes). |
| `summary` | string | ✓ | 1–2000 chars. |
| `victoryCondition` | string | ✓ | 1–1000 chars. |
| `failureCondition` | string | ✓ | 1–1000 chars. |
| `killChainStages` | string[] | ✓ | 1–16 stages, each ≤ 48 chars. |
| `acts` | Act[] | ✓ | 1–8 acts (§5.1). |
| `injects` | Inject[] | ✓ | 0–40 injects (§5.2). |
| `npcRoles` | string[] | – | 0–8 entries, each a valid NPC role (§9.3). Omit or `[]` for no cast. |

### 5.1 Act (`acts[]`)

| Field | Type | Req | Rule |
|---|---|---|---|
| `number` | integer | ✓ | 1–8. Should be sequential within the scenario. |
| `seed` | string | ✓ | 1–2000 chars. The DM's scene-setting prompt for the act. |
| `primaryObjective` | string | ✓ | 1–500 chars. |
| `clues` | Clue[] | ✓ | 0–24 clues (§5.3). |
| `bossEvent` | string \| null | ✓ | `null` or ≤ 1000 chars. |
| `injectIds` | string[] | ✓ | 0–16. Each value **MUST** match an `id` in this scenario's `injects[]` (§5.2). |

### 5.2 Inject (`injects[]`)

| Field | Type | Req | Rule |
|---|---|---|---|
| `id` | string | ✓ | Unique within the scenario, 1–64 chars, no `::` (UUIDs and `UPPER_SNAKE` both fine). |
| `act` | integer | ✓ | 1–8. The act this inject belongs to. |
| `trigger` | string | ✓ | `"mandatory"` or `"discretion"`. |
| `description` | string | ✓ | 1–1000 chars. |
| `mechanicalEffect` | string | ✓ | 1–500 chars. |

### 5.3 Clue (`clues[]`)

| Field | Type | Req | Rule |
|---|---|---|---|
| `text` | string | ✓ | 1–500 chars. |
| `techniqueId` | string | – | MITRE ATT&CK technique ID, e.g. `T1059.001`. Pattern: `^T\d{4}(\.\d{3})?$`. |
| `techniqueName` | string | – | ≤ 100 chars, e.g. `PowerShell`. |

**Cross-reference rule:** every value in any act's `injectIds` must resolve to an
`injects[].id` in the same scenario. Importers reject dangling references.

---

## 6. Pack characters (`content.characters[]`)

Each entry is a **`Character`** object (see `src/types/game.ts`).

| Field | Type | Req | Rule |
|---|---|---|---|
| `id` | string | ✓ | Unique within the pack, 1–64 chars, no `::` (a UUID is fine). Namespaced on import (§7). |
| `name` | string | ✓ | 1–24 chars (matches the in-app name cap). |
| `class` | string | ✓ | One of the 6 archetypes (§9.2). |
| `stats` | object | ✓ | Exactly the 6 keys `vigilance, agility, analysis, fortitude, stealth, command`, each an integer `1`–`5`. |
| `skills` | Skill[] | ✓ | 0–6 entries. Each `{ "name": <valid SkillName §9.4>, "level": 1\|2\|3 }`. No duplicate skill names. |
| `traits` | string[] | ✓ | 0–6 entries, each a valid trait (§9.5). No duplicates. |
| `level` | integer | ✓ | 1–6. |
| `xp` | integer | ✓ | ≥ 0. |
| `headshot` | string | – | A base64 **data URL** (`data:image/png;base64,…` or `image/jpeg`/`image/webp`). Max **512 KB** decoded. Omit for the default avatar. |

> **Roster vs. library note (design, not format):** the live app keeps a 4-slot
> active roster. Imported characters should land in a **character library** the user
> draws from, not the active 4 slots. This is an app behavior to settle during
> implementation; it does not change the pack format.

---

## 7. IDs & namespacing

Pack item IDs only need to be unique **within their pack**. On import, the app
makes them globally unique by namespacing with the pack `id`:

```
storedId = `${pack.id}::${item.id}`
```

- The original `item.id` is preserved as a **display ID**.
- Built-in content and user-authored content keep their bare IDs (no namespace);
  only pack-sourced items are namespaced.
- **Collision handling on import:** if a `storedId` already exists from a *different*
  pack version, the importer surfaces a conflict and offers overwrite (update) or
  skip. Two different packs can both contain `RANSOMWARE-01` without colliding,
  because their pack IDs differ.

---

## 8. Versioning & compatibility

- **`schemaVersion`** is the hard contract. An app supporting up to schema *N*
  accepts packs with `schemaVersion ≤ N` and rejects `> N` with a clear "update DICE
  to install this pack" message.
- **`pack.version`** (semver) drives **updates**: importing a pack whose `id` is
  already installed at a lower version is an update; same version is a no-op (or
  reinstall); lower version warns about downgrade.
- **Optional fields are the growth path.** New optional fields (like `npcRoles`,
  added in a recent release) don't require a `schemaVersion` bump — older packs that
  omit them validate fine. Only *breaking* changes (new required fields, removed
  fields, changed types) bump `schemaVersion`.

---

## 9. Controlled vocabularies

These mirror the engine's enums. Validators **MUST** check membership (except
§9.1, which is advisory).

### 9.1 Scenario categories (advisory)
`fundamentals`, `malware`, `ransomware`, `phishing`, `identity`, `network`,
`cloud`, `insider`, `apt`. Unknown values are accepted and shown as "Uncategorized".

### 9.2 Character classes (strict)
`Analyst`, `Hunter`, `Responder`, `Engineer`, `Intel Officer`, `Commander`.

### 9.3 NPC roles (strict)
`consultant`, `intel_contact`, `system_owner`, `it_ops`, `reporter`, `executive`,
`business_owner`, `regulator`, `law_enforcement`, `customer`, `vendor`, `ciso`.

### 9.4 Skill names (strict)
`Log Analysis`, `Malware Triage`, `Network Forensics`, `Endpoint Forensics`,
`Threat Intelligence`, `OSINT`, `Scripting/Automation`, `Cloud IR`,
`Escalation/Comms`, `Active Defense`, `Threat Hunting`,
`Lateral Movement Tracking`, `Behavioral Analysis`, `Memory Forensics`,
`Malware Reversing`, `Detection Engineering`, `Threat Attribution`,
`Identity Forensics`, `Data Loss Prevention`, `Crisis Communications`.

### 9.5 Trait names (strict)
`First Responder`, `Eagle Eye`, `Calm Under Pressure`, `Digital Bloodhound`,
`Composure`, `Rally`.

---

## 10. Validation & limits (importer rules)

An importer **MUST** reject a pack — with a specific, human-readable reason — if any
of the following fails:

1. `format !== "dicepack"` or `schemaVersion` is unsupported.
2. The manifest is missing a required field or violates a pattern/length rule.
3. `content` is absent or both arrays are empty.
4. Any scenario or character fails its field rules (§5, §6) or enum checks (§9.2–9.5).
5. Any act `injectIds` value has no matching inject in the same scenario (§5.3).
6. A `headshot` exceeds the size cap or isn't a recognized image data URL.

Recommended **size guardrails** (tune during implementation):

| Limit | Suggested cap |
|---|---|
| Total decompressed pack size | 10 MB |
| Scenarios per pack | 100 |
| Characters per pack | 100 |
| Single headshot (decoded) | 512 KB |

Unknown object keys **SHOULD** be stripped rather than cause rejection (tolerant
read), so older apps can load packs authored by newer ones where the only difference
is additive optional fields.

---

## 11. Security model

- Packs are **inert data**. The import path deserializes JSON, validates it, and
  stores it. No field is ever interpreted as code, a path, a URL to fetch, or a
  template.
- All pack text reaches the UI and the DM prompt as plain strings; React escapes it
  on render, and the DM prompt treats it as content, not instructions.
- Strict validation + size caps bound resource use and prevent malformed data from
  reaching the engine.
- **Integrity/authenticity (future, optional):** a detached checksum or author
  signature could support "verified packs." Out of scope for v1 because inert data
  carries low risk; revisit if a public pack ecosystem forms.

---

## 12. Reserved for future revisions

The format is intentionally extensible. Planned additive areas (would arrive as new
optional `content` arrays, no `schemaVersion` bump if purely additive):

- `content.campaigns[]` — chained scenario arcs (already a DB entity).
- `content.orgProfiles[]` — pre-defined organizational tool-stack profiles.

Authors and importers should ignore `content` arrays they don't recognize.

---

## 13. Minimal complete example

```json
{
  "format": "dicepack",
  "schemaVersion": 1,
  "pack": {
    "id": "com.example.starter",
    "name": "Starter Sample Pack",
    "version": "1.0.0",
    "author": "Example Author",
    "description": "One tiny scenario and one pre-built analyst.",
    "createdAt": "2026-06-06T00:00:00Z",
    "tags": ["sample"]
  },
  "content": {
    "scenarios": [
      {
        "id": "SAMPLE-01",
        "category": "phishing",
        "title": "First Contact",
        "threatType": "Credential Phishing",
        "difficulty": 1,
        "recommendedPlayers": "1–2",
        "estimatedMinutes": 30,
        "scenarioClockStart": 60,
        "summary": "A user reports a suspicious login prompt after clicking an email link.",
        "victoryCondition": "Revoke the session and reset credentials before mailbox rules are created.",
        "failureCondition": "The attacker exports the mailbox or pivots to a second account.",
        "killChainStages": ["initial_access", "credential_access", "collection"],
        "npcRoles": ["it_ops"],
        "acts": [
          {
            "number": 1,
            "seed": "A help-desk ticket lands: 'I think I typed my password into a fake Microsoft page.'",
            "primaryObjective": "Confirm whether the credential was used and from where.",
            "clues": [
              { "text": "Sign-in log: success from a residential IP in another country", "techniqueId": "T1078", "techniqueName": "Valid Accounts" }
            ],
            "bossEvent": null,
            "injectIds": ["NEW_INBOX_RULE"]
          }
        ],
        "injects": [
          {
            "id": "NEW_INBOX_RULE",
            "act": 1,
            "trigger": "discretion",
            "description": "A mailbox rule auto-forwarding finance email to an external address appears.",
            "mechanicalEffect": "Add complication: data_exfil risk until the rule is removed."
          }
        ]
      }
    ],
    "characters": [
      {
        "id": "11111111-1111-4111-8111-111111111111",
        "name": "Sam Rivera",
        "class": "Analyst",
        "stats": { "vigilance": 4, "agility": 2, "analysis": 4, "fortitude": 2, "stealth": 1, "command": 2 },
        "skills": [
          { "name": "Log Analysis", "level": 2 },
          { "name": "Identity Forensics", "level": 1 },
          { "name": "Threat Intelligence", "level": 1 }
        ],
        "traits": ["Eagle Eye"],
        "level": 1,
        "xp": 0
      }
    ]
  }
}
```
