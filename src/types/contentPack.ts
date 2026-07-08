// Lightweight view of an installed content pack (the full Dicepack snapshot
// stays server-side). Returned by the /content-packs endpoints. See
// DICEPACK-FORMAT.md and src/content/dicepackSchema.ts.
export interface ContentPackSummary {
  id:             string
  name:           string
  version:        string
  author:         string
  enabled:        boolean
  scenarioCount:  number
  characterCount: number
  installedAt:    number
}

// Result of an import attempt — validation errors surface to the user verbatim.
export type ContentPackImportResult =
  | { ok: true;  pack: ContentPackSummary }
  | { ok: false; errors: string[] }
