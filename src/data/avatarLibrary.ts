import type { CharacterClass } from '../types/game'

// ─── Auto-discovery via Vite glob ─────────────────────────────────────────────
// Drop image files into src/assets/avatars/<folder>/ and they appear here
// automatically on the next build / hot-reload. Supported: png, jpg, jpeg,
// webp, gif, svg.

const CLASS_FOLDER: Record<CharacterClass, string> = {
  'Analyst':       'analyst',
  'Hunter':        'hunter',
  'Responder':     'responder',
  'Engineer':      'engineer',
  'Intel Officer': 'intel-officer',
  'Commander':     'commander',
}

// Vite resolves these at build time → values are hashed asset URLs
const RAW = import.meta.glob(
  '/src/assets/avatars/**/*.{png,jpg,jpeg,webp,gif,svg}',
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>

export interface AvatarEntry {
  url:   string
  label: string
  class: CharacterClass | null   // null = shared / unclassified
}

function folderToClass(folder: string): CharacterClass | null {
  const entry = (Object.entries(CLASS_FOLDER) as [CharacterClass, string][])
    .find(([, f]) => f === folder)
  return entry ? entry[0] : null
}

function filename(path: string): string {
  return path.split('/').pop()?.replace(/\.[^.]+$/, '') ?? path
}

export const AVATAR_LIBRARY: AvatarEntry[] = Object.entries(RAW)
  .filter(([path]) => !path.endsWith('.gitkeep'))
  .map(([path, url]) => {
    // path looks like /src/assets/avatars/analyst/my-avatar.png
    const parts  = path.split('/')
    const folder = parts[parts.length - 2]   // e.g. "analyst"
    return {
      url,
      label: filename(path),
      class: folderToClass(folder),
    }
  })
  .sort((a, b) => {
    // Class-specific first, then shared
    if (a.class && !b.class) return -1
    if (!a.class && b.class) return 1
    return a.label.localeCompare(b.label)
  })

export function avatarsForClass(cls: CharacterClass): AvatarEntry[] {
  return AVATAR_LIBRARY.filter((a) => a.class === cls || a.class === null)
}

export { CLASS_FOLDER }
