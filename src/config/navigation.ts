// Single source of truth for the sidebar (AppShell) and command palette, so the
// two nav surfaces can't drift apart. Deliberately limited to standalone
// destinations — mid-flow/gated routes (/create, /adversary, /game, /end,
// /report, /lobby, /play) are reached via in-page flow, not global nav.

export interface NavEntry {
  label: string
  path: string
  glyph: string
  group: 'play' | 'admin'
}

export const NAV_ENTRIES: NavEntry[] = [
  { label: 'Home',            path: '/',                     glyph: '⌂', group: 'play' },
  { label: 'Scenarios',       path: '/scenarios',             glyph: '🎯', group: 'play' },
  { label: 'Roster',          path: '/roster',                glyph: '🪖', group: 'play' },
  { label: 'Campaigns',       path: '/campaigns',             glyph: '📁', group: 'play' },
  { label: 'Content Packs',   path: '/content-packs',         glyph: '📦', group: 'play' },
  { label: 'Analytics',       path: '/analytics',             glyph: '📈', group: 'play' },
  { label: 'Host Game',       path: '/host',                  glyph: '📡', group: 'play' },
  { label: 'Join Game',       path: '/join',                  glyph: '🔗', group: 'play' },
  { label: 'Account',         path: '/account',               glyph: '👤', group: 'play' },
  { label: 'Users',           path: '/admin/users',           glyph: '👥', group: 'admin' },
  { label: 'Scenario Library', path: '/admin/scenarios',      glyph: '🗂', group: 'admin' },
  { label: 'Injects Catalog', path: '/admin/injects-catalog', glyph: '⚡', group: 'admin' },
  { label: 'Admin Analytics', path: '/admin/analytics',       glyph: '📊', group: 'admin' },
]
