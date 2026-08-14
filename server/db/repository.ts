import type { Character, CriticalInjectCatalogEntry } from '../../src/types/game'
import type { Campaign, CustomScenario, SaveSlot } from '../../src/types/campaign'
import type { SessionRecord } from '../../src/types/history'
import type { OrgState } from '../../src/types/orgState'
import type { OrgProfile } from '../../src/types/orgProfile'
import { rooms, participants, roomSessions, contentPacks, users, authSessions } from './schema'
import type { Dicepack } from '../../src/content/dicepackSchema'

// Row types inferred from the schema (include server-only fields like hashes).
export type RoomRow = typeof rooms.$inferSelect
export type RoomInsert = typeof rooms.$inferInsert
export type ParticipantRow = typeof participants.$inferSelect
export type ParticipantInsert = typeof participants.$inferInsert
export type RoomSessionRow = typeof roomSessions.$inferSelect
export type ContentPackRow = typeof contentPacks.$inferSelect

export type UserRow = typeof users.$inferSelect
export type UserInsert = typeof users.$inferInsert
export type AuthSessionRow = typeof authSessions.$inferSelect
export type AuthSessionInsert = typeof authSessions.$inferInsert

// The single data-access contract for the app. Nothing above this layer should
// import a database driver or Drizzle directly — swap the implementation (e.g.
// to Postgres) without touching callers. Methods are synchronous because
// better-sqlite3 is synchronous; an async impl can return resolved promises if
// the interface is later widened.

export interface DiceRepository {
  // ── Roster ──────────────────────────────────────────────
  // User-scoped: each user sees their own (and any NULL-owner legacy rows).
  // listLibraryCharacters() stays unscoped — pack-imported chars are install-wide.
  listCharacters(userId: string): Character[]   // user-authored/cloned (pack_id NULL)
  listLibraryCharacters(): Character[]          // imported from content packs (pack_id set)
  upsertCharacter(character: Character, userId: string): void
  // Returns true iff a row was actually deleted — false means either the id
  // doesn't exist or (more likely) it exists but isn't owned by this user.
  // Callers must surface false as a failure rather than treating the call as
  // having succeeded; silently swallowing it makes a permanently-failing
  // delete look identical to a working one.
  deleteCharacter(id: string, userId: string): boolean

  // ── Campaigns ───────────────────────────────────────────
  listCampaigns(userId: string): Campaign[]
  upsertCampaign(campaign: Campaign, userId: string): void
  deleteCampaign(id: string, userId: string): boolean

  // ── Custom scenarios ────────────────────────────────────
  // Returns: the user's own custom scenarios + ALL pack-imported scenarios
  // (those are install-wide; pack_id IS NOT NULL) + ALL admin-authored/global
  // scenarios (is_global = true).
  listCustomScenarios(userId: string): CustomScenario[]
  upsertCustomScenario(scenario: CustomScenario, userId: string): void
  deleteCustomScenario(id: string, userId: string): boolean

  // Admin/reporting: cross-user, unscoped access to every custom scenario
  // (used by the admin scenario editor). adminUpsertCustomScenario always
  // marks the row is_global so it's visible to every user afterward.
  listAllCustomScenarios(): CustomScenario[]
  adminUpsertCustomScenario(scenario: CustomScenario): void
  adminDeleteCustomScenario(id: string): void

  // ── Injects catalog ──────────────────────────────────────
  // Global, install-wide critical-hit/fail inject entries managed via the
  // admin panel — scenarios reference these by id rather than embedding them.
  listInjectsCatalog(): CriticalInjectCatalogEntry[]
  getInjectCatalogEntry(id: string): CriticalInjectCatalogEntry | null
  upsertInjectCatalogEntry(entry: CriticalInjectCatalogEntry): void
  deleteInjectCatalogEntry(id: string): void

  // ── Content packs ───────────────────────────────────────
  listContentPacks(): ContentPackRow[]
  getContentPack(id: string): ContentPackRow | null
  installContentPack(pack: Dicepack): ContentPackRow   // upsert pack + (re)insert its items
  setContentPackEnabled(id: string, enabled: boolean): void
  uninstallContentPack(id: string): void

  // ── Save slots ──────────────────────────────────────────
  listSaves(userId: string): SaveSlot[]
  addSave(slot: SaveSlot, userId: string): void
  deleteSave(id: string, userId: string): boolean

  // ── Session history ─────────────────────────────────────
  listSessionHistory(userId: string): SessionRecord[]
  recordSession(record: SessionRecord, userId: string): void
  clearSessionHistory(userId: string): void
  // Admin/reporting: cross-user reads, unscoped. ownerUserId is attached
  // alongside each record so callers can attribute it to a user.
  listAllSessionHistory(): Array<SessionRecord & { ownerUserId: string | null }>
  getSessionHistoryById(id: string): (SessionRecord & { ownerUserId: string | null }) | null

  // ── Singletons / live state ─────────────────────────────
  getOrgState(): OrgState | null
  setOrgState(state: OrgState): void
  getActiveOrgProfile(): OrgProfile | null
  setActiveOrgProfile(profile: OrgProfile | null): void

  // Generic key/value for remaining live state (current session, feed,
  // result, comm config). Callers own the value shape via the type param.
  getKv<T>(key: string): T | null
  setKv<T>(key: string, value: T): void
  deleteKv(key: string): void

  // ── Multiplayer: rooms & participants ───────────────────
  createRoom(row: RoomInsert): void
  getRoomByCode(code: string): RoomRow | null
  getRoomById(id: string): RoomRow | null
  setRoomStatus(id: string, status: string): void

  addParticipant(row: ParticipantInsert): void
  getParticipantByTokenHash(tokenHash: string): ParticipantRow | null
  listParticipants(roomId: string): ParticipantRow[]
  touchParticipant(id: string): void

  getRoomSession(roomId: string): RoomSessionRow | null
  upsertRoomSession(roomId: string, session: unknown, feed: unknown): void

  // ── App users + auth sessions (multi-user-per-install, Phase 0) ──────────
  countUsers(): number
  listUsers(): UserRow[]
  getUserById(id: string): UserRow | null
  getUserByUsername(username: string): UserRow | null
  createUser(row: UserInsert): void
  updateUserLastLogin(id: string, when: number): void
  setUserActive(id: string, active: boolean): void
  setUserPassword(id: string, passwordHash: string): void
  setUserDisplayName(id: string, displayName: string): void
  setUserRole(id: string, role: string): void

  createAuthSession(row: AuthSessionInsert): void
  getAuthSessionByTokenHash(tokenHash: string): AuthSessionRow | null
  touchAuthSession(tokenHash: string, when: number): void
  deleteAuthSession(tokenHash: string): void
  deleteAuthSessionsForUser(userId: string): void
  // Revoke every session for the user EXCEPT the given token hash. Used by
  // self-service password change to invalidate stale tokens on other devices
  // while keeping the caller signed in on the device they just used.
  deleteAuthSessionsForUserExcept(userId: string, exceptTokenHash: string): void
  // Backfill helper: assign all currently-unowned rows in user-scoped tables
  // to the given user. Called once when the initial admin completes setup.
  claimUnownedRowsForUser(userId: string): void
}
