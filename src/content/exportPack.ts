import type { Character } from '../types/game'
import type { CustomScenario } from '../types/campaign'
import { validateDicepack, DICEPACK_SCHEMA_VERSION, type DicepackValidation } from './dicepackSchema'

export interface PackManifestInput {
  id:           string
  name:         string
  version:      string
  author:       string
  description?: string
}

// Strip the `${packId}::` namespace prefix added on import, returning the bare
// authored id so the item re-namespaces cleanly under whatever pack imports it.
function deNamespace(id: string): string {
  const i = id.lastIndexOf('::')
  return i >= 0 ? id.slice(i + 2) : id
}

// Assemble a .dicepack envelope from authored content and validate it. The
// schema's tolerant read drops custom-scenario-only fields (isCustom/createdAt/
// updatedAt); ids are de-namespaced here so a re-import namespaces them afresh.
// Returns the SAME validation result shape as import, so the caller downloads
// `result.pack` (canonical, stripped) on success or shows `result.errors`.
export function buildPackForExport(
  manifest:   PackManifestInput,
  scenarios:  CustomScenario[],
  characters: Character[],
): DicepackValidation {
  const candidate = {
    format:        'dicepack',
    schemaVersion: DICEPACK_SCHEMA_VERSION,
    pack: {
      id:        manifest.id.trim(),
      name:      manifest.name.trim(),
      version:   manifest.version.trim(),
      author:    manifest.author.trim(),
      ...(manifest.description?.trim() ? { description: manifest.description.trim() } : {}),
      createdAt: new Date().toISOString(),
    },
    content: {
      scenarios:  scenarios.map((s) => ({ ...s, id: deNamespace(s.id) })),
      characters: characters.map((c) => ({ ...c, id: deNamespace(c.id) })),
    },
  }
  return validateDicepack(candidate)
}

// Trigger a browser download of a validated pack as a .dicepack file.
export function downloadPack(pack: unknown, packId: string): void {
  const slug = (packId.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'content') + '.dicepack'
  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = slug
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
