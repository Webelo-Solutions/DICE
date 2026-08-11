import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core'

// Hybrid schema: queryable key columns plus a JSON `data` blob holding the full
// typed object. This mirrors how the app already persists whole entities (the
// Zustand stores serialized them to localStorage), so the rich nested types in
// src/types survive without premature normalization. The `data` column is the
// source of truth for the object; the scalar columns exist for indexing,
// listing, and filtering.

export const characters = sqliteTable('characters', {
  id:        text('id').primaryKey(),
  name:      text('name').notNull(),
  class:     text('class').notNull(),
  level:     integer('level').notNull().default(1),
  xp:        integer('xp').notNull().default(0),
  data:      text('data', { mode: 'json' }).notNull(),
  updatedAt: integer('updated_at').notNull(),
  // Provenance: the content pack this character was imported from (NULL =
  // user-authored). Lets a pack's characters be removed cleanly on uninstall.
  packId:    text('pack_id'),
  // Owning user (NULL until Phase 2 enforces scoping). On first-run setup, all
  // pre-existing rows are backfilled to the initial admin's id.
  ownerUserId: text('owner_user_id'),
})

export const campaigns = sqliteTable('campaigns', {
  id:        text('id').primaryKey(),
  name:      text('name').notNull(),
  status:    text('status').notNull(),
  data:      text('data', { mode: 'json' }).notNull(),
  updatedAt: integer('updated_at').notNull(),
  ownerUserId: text('owner_user_id'),
})

export const customScenarios = sqliteTable('custom_scenarios', {
  id:         text('id').primaryKey(),
  title:      text('title').notNull(),
  difficulty: integer('difficulty').notNull(),
  data:       text('data', { mode: 'json' }).notNull(),
  updatedAt:  integer('updated_at').notNull(),
  // Provenance: the content pack this scenario was imported from (NULL =
  // user-authored). Lets a pack's scenarios be removed cleanly on uninstall.
  packId:     text('pack_id'),
  ownerUserId: text('owner_user_id'),
  // Admin-authored/curated scenarios, visible to every user regardless of
  // owner or pack provenance (see server/auth/admin-routes.ts scenario routes).
  isGlobal:   integer('is_global', { mode: 'boolean' }).notNull().default(false),
})

// Global, install-wide catalog of critical-hit/fail inject entries, managed via
// the admin panel. Scenarios reference entries here by id (ScenarioPack's
// criticalHitInjectIds/criticalFailInjectIds) instead of embedding full copies,
// so the same entry can be curated once and reused across scenarios. No
// owner/pack scoping — this table is inherently shared, same as content_packs.
export const injectsCatalog = sqliteTable('injects_catalog', {
  id:        text('id').primaryKey(),
  kind:      text('kind').notNull(), // 'critical_hit' | 'critical_fail'
  data:      text('data', { mode: 'json' }).notNull(), // description + effect fields
  updatedAt: integer('updated_at').notNull(),
})

// Installed content packs (see DICEPACK-FORMAT.md). The `data` blob holds the
// full validated Dicepack so a disabled pack can be re-enabled without the
// original file. Items live in characters/custom_scenarios tagged with pack_id;
// disabling deletes those rows (keeping this one), uninstalling deletes both.
export const contentPacks = sqliteTable('content_packs', {
  id:             text('id').primaryKey(),     // = manifest pack.id
  name:           text('name').notNull(),
  version:        text('version').notNull(),
  author:         text('author').notNull(),
  enabled:        integer('enabled', { mode: 'boolean' }).notNull().default(true),
  scenarioCount:  integer('scenario_count').notNull().default(0),
  characterCount: integer('character_count').notNull().default(0),
  installedAt:    integer('installed_at').notNull(),
  data:           text('data', { mode: 'json' }).notNull(),
})

export const saves = sqliteTable('saves', {
  id:         text('id').primaryKey(),
  name:       text('name').notNull(),
  campaignId: text('campaign_id'),
  savedAt:    integer('saved_at').notNull(),
  data:       text('data', { mode: 'json' }).notNull(),
  ownerUserId: text('owner_user_id'),
})

export const sessionHistory = sqliteTable('session_history', {
  id:            text('id').primaryKey(),
  scenarioId:    text('scenario_id').notNull(),
  scenarioTitle: text('scenario_title').notNull(),
  difficulty:    integer('difficulty').notNull(),
  outcome:       text('outcome').notNull(),
  playedAt:      integer('played_at').notNull(),
  data:          text('data', { mode: 'json' }).notNull(),
  ownerUserId:   text('owner_user_id'),
})

// Single-row-per-key store for app singletons and live state that the app
// treats as one blob: orgState, activeOrgProfile, the current session, the
// current feed, the latest result, and comm config. Keyed access keeps this
// flexible without a table per singleton.
export const kvState = sqliteTable('kv_state', {
  key:       text('key').primaryKey(),
  value:     text('value', { mode: 'json' }).notNull(),
  updatedAt: integer('updated_at').notNull(),
})

// ── Multiplayer (M1: rooms + identity) ──────────────────────────────────────--
// A room is a facilitator-hosted game lobby that players join by code. Live play
// (session + feed) is scoped per room; library data (roster, campaigns, etc.)
// stays facilitator-global.
export const rooms = sqliteTable('rooms', {
  id:                    text('id').primaryKey(),
  code:                  text('code').notNull(),
  name:                  text('name').notNull(),
  facilitatorSecretHash: text('facilitator_secret_hash').notNull(),  // scrypt salt:hash
  status:                text('status').notNull().default('lobby'),  // lobby | active | ended
  createdAt:             integer('created_at').notNull(),
  updatedAt:             integer('updated_at').notNull(),
}, (t) => ({
  codeIdx: uniqueIndex('rooms_code_idx').on(t.code),
}))

export const participants = sqliteTable('participants', {
  id:          text('id').primaryKey(),
  roomId:      text('room_id').notNull(),
  role:        text('role').notNull(),          // facilitator | player
  displayName: text('display_name').notNull(),
  characterId: text('character_id'),            // the player's character id (= character.id)
  character:   text('character', { mode: 'json' }),  // snapshot of the player's persisted character at join time
  ownerUserId: text('owner_user_id'),           // the DICE account this participant joined as (null for pre-auth legacy rows)
  tokenHash:   text('token_hash').notNull(),    // sha-256 of the bearer token
  lastSeenAt:  integer('last_seen_at').notNull(),
  createdAt:   integer('created_at').notNull(),
}, (t) => ({
  tokenIdx: uniqueIndex('participants_token_idx').on(t.tokenHash),
  roomIdx:  index('participants_room_idx').on(t.roomId),
}))

// One row per room holding that room's live session + feed.
export const roomSessions = sqliteTable('room_sessions', {
  roomId:    text('room_id').primaryKey(),
  session:   text('session', { mode: 'json' }),
  feed:      text('feed', { mode: 'json' }),
  updatedAt: integer('updated_at').notNull(),
})

// ── App users + auth sessions (Internal Multi-User, Phase 0) ────────────────--
// DICE installs go from "one implicit user" to "many authenticated users per
// install." Each user has their own roster, history, etc. (Phase 2 enforces
// scoping; the owner_user_id columns above are added now and backfilled when
// the first admin is created.) Passwords are scrypt-hashed using the same
// salt:hash format as `rooms.facilitator_secret_hash`.
export const users = sqliteTable('users', {
  id:            text('id').primaryKey(),
  username:      text('username').notNull(),
  displayName:   text('display_name').notNull(),
  passwordHash:  text('password_hash').notNull(),    // scrypt: salt:hash
  role:          text('role').notNull().default('player'),  // 'admin' | 'player'
  active:        integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt:     integer('created_at').notNull(),
  lastLoginAt:   integer('last_login_at'),
}, (t) => ({
  usernameIdx: uniqueIndex('users_username_idx').on(t.username),
}))

// Issued on login; the bearer token's SHA-256 is the primary key (matches the
// pattern used by room participants). Rolling expiry — `lastSeenAt` is bumped
// on each authenticated request; revocation = DELETE on this row.
export const authSessions = sqliteTable('auth_sessions', {
  tokenHash:   text('token_hash').primaryKey(),
  userId:      text('user_id').notNull(),
  createdAt:   integer('created_at').notNull(),
  lastSeenAt:  integer('last_seen_at').notNull(),
  expiresAt:   integer('expires_at').notNull(),
  userAgent:   text('user_agent'),
}, (t) => ({
  userIdx: index('auth_sessions_user_idx').on(t.userId),
}))
