import { and, eq, isNull, isNotNull, ne, or, sql } from 'drizzle-orm'
import { db as defaultDb } from './client'
import type { DrizzleDb } from './client'
import {
  characters,
  campaigns,
  customScenarios,
  saves,
  sessionHistory,
  kvState,
  rooms,
  participants,
  roomSessions,
  contentPacks,
  users,
  authSessions,
} from './schema'
import type {
  DiceRepository, RoomRow, RoomInsert, ParticipantRow, ParticipantInsert, RoomSessionRow, ContentPackRow,
  UserRow, UserInsert, AuthSessionRow, AuthSessionInsert,
} from './repository'
import type { Character } from '../../src/types/game'
import type { Campaign, CustomScenario, SaveSlot } from '../../src/types/campaign'
import type { Dicepack } from '../../src/content/dicepackSchema'
import type { SessionRecord } from '../../src/types/history'
import type { OrgState } from '../../src/types/orgState'
import type { OrgProfile } from '../../src/types/orgProfile'

const ORG_STATE_KEY = 'orgState'
const ACTIVE_ORG_PROFILE_KEY = 'activeOrgProfile'

export class SqliteRepository implements DiceRepository {
  constructor(private readonly db: DrizzleDb = defaultDb) {}

  // ── Roster ──────────────────────────────────────────────
  // Roster = user-authored/cloned characters (pack_id IS NULL). Pack-imported
  // characters live in the library (listLibraryCharacters) so they don't crowd
  // the curated roster. Each user only sees their own roster.
  listCharacters(userId: string): Character[] {
    return this.db.select().from(characters)
      .where(and(isNull(characters.packId), eq(characters.ownerUserId, userId)))
      .all().map((r) => r.data as Character)
  }
  listLibraryCharacters(): Character[] {
    // Pack-imported characters are install-wide; not scoped by user.
    return this.db.select().from(characters).where(isNotNull(characters.packId)).all().map((r) => r.data as Character)
  }
  upsertCharacter(c: Character, userId: string): void {
    const now = Date.now()
    // On INSERT, set owner to the calling user. On UPDATE (conflict), do NOT
    // include ownerUserId in the SET — preserves the original owner so users
    // can't claim each other's rows via repeated upserts.
    this.db.insert(characters).values({
      id: c.id, name: c.name, class: c.class, level: c.level, xp: c.xp,
      data: c, updatedAt: now, ownerUserId: userId,
    }).onConflictDoUpdate({
      target: characters.id,
      set: { name: c.name, class: c.class, level: c.level, xp: c.xp, data: c, updatedAt: now },
    }).run()
  }
  deleteCharacter(id: string, userId: string): void {
    // Scope by owner so users can only delete their own rows.
    this.db.delete(characters).where(and(eq(characters.id, id), eq(characters.ownerUserId, userId))).run()
  }

  // ── Campaigns ───────────────────────────────────────────
  listCampaigns(userId: string): Campaign[] {
    return this.db.select().from(campaigns).where(eq(campaigns.ownerUserId, userId)).all().map((r) => r.data as Campaign)
  }
  upsertCampaign(c: Campaign, userId: string): void {
    const now = Date.now()
    this.db.insert(campaigns).values({
      id: c.id, name: c.name, status: c.status, data: c, updatedAt: now, ownerUserId: userId,
    }).onConflictDoUpdate({
      target: campaigns.id,
      set: { name: c.name, status: c.status, data: c, updatedAt: now },
    }).run()
  }
  deleteCampaign(id: string, userId: string): void {
    this.db.delete(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.ownerUserId, userId))).run()
  }

  // ── Custom scenarios ────────────────────────────────────
  // Lists user-owned scenarios PLUS all pack-imported scenarios (which are
  // install-wide and visible to every user on the install).
  listCustomScenarios(userId: string): CustomScenario[] {
    return this.db.select().from(customScenarios)
      .where(or(eq(customScenarios.ownerUserId, userId), isNotNull(customScenarios.packId)))
      .all().map((r) => r.data as CustomScenario)
  }
  upsertCustomScenario(s: CustomScenario, userId: string): void {
    const now = Date.now()
    this.db.insert(customScenarios).values({
      id: s.id, title: s.title, difficulty: s.difficulty, data: s, updatedAt: now, ownerUserId: userId,
    }).onConflictDoUpdate({
      target: customScenarios.id,
      set: { title: s.title, difficulty: s.difficulty, data: s, updatedAt: now },
    }).run()
  }
  deleteCustomScenario(id: string, userId: string): void {
    // Pack-imported scenarios (NULL owner) are NOT deletable via this route;
    // they're removed via the content-pack uninstall flow.
    this.db.delete(customScenarios)
      .where(and(eq(customScenarios.id, id), eq(customScenarios.ownerUserId, userId))).run()
  }

  // ── Content packs ───────────────────────────────────────
  listContentPacks(): ContentPackRow[] {
    return this.db.select().from(contentPacks).all()
  }
  getContentPack(id: string): ContentPackRow | null {
    return this.db.select().from(contentPacks).where(eq(contentPacks.id, id)).get() ?? null
  }
  installContentPack(pack: Dicepack): ContentPackRow {
    const packId = pack.pack.id
    const now = Date.now()
    this.db.transaction(() => {
      // Reinstall/update: clear any prior items from this pack first.
      this.db.delete(customScenarios).where(eq(customScenarios.packId, packId)).run()
      this.db.delete(characters).where(eq(characters.packId, packId)).run()
      const row = {
        id:             packId,
        name:           pack.pack.name,
        version:        pack.pack.version,
        author:         pack.pack.author,
        enabled:        true,
        scenarioCount:  pack.content.scenarios.length,
        characterCount: pack.content.characters.length,
        installedAt:    now,
        data:           pack,
      }
      this.db.insert(contentPacks).values(row)
        .onConflictDoUpdate({ target: contentPacks.id, set: row }).run()
      this.insertPackItems(pack)
    })
    return this.getContentPack(packId)!
  }
  setContentPackEnabled(id: string, enabled: boolean): void {
    const existing = this.getContentPack(id)
    if (!existing) return
    this.db.transaction(() => {
      this.db.update(contentPacks).set({ enabled }).where(eq(contentPacks.id, id)).run()
      if (enabled) {
        this.insertPackItems(existing.data as Dicepack)
      } else {
        this.db.delete(customScenarios).where(eq(customScenarios.packId, id)).run()
        this.db.delete(characters).where(eq(characters.packId, id)).run()
      }
    })
  }
  uninstallContentPack(id: string): void {
    this.db.transaction(() => {
      this.db.delete(customScenarios).where(eq(customScenarios.packId, id)).run()
      this.db.delete(characters).where(eq(characters.packId, id)).run()
      this.db.delete(contentPacks).where(eq(contentPacks.id, id)).run()
    })
  }
  // Writes a pack's scenarios + characters into the shared tables, namespacing
  // their ids by pack id (§7 of DICEPACK-FORMAT.md) and tagging provenance.
  private insertPackItems(pack: Dicepack): void {
    const packId = pack.pack.id
    const now = Date.now()
    for (const sc of pack.content.scenarios) {
      const id = `${packId}::${sc.id}`
      const data = { ...sc, id, isCustom: true as const, createdAt: now, updatedAt: now } as unknown as CustomScenario
      const row = { id, title: sc.title, difficulty: sc.difficulty, data, updatedAt: now, packId }
      this.db.insert(customScenarios).values(row)
        .onConflictDoUpdate({ target: customScenarios.id, set: row }).run()
    }
    for (const ch of pack.content.characters) {
      const id = `${packId}::${ch.id}`
      const data = { ...ch, id } as unknown as Character
      const row = { id, name: ch.name, class: ch.class, level: ch.level, xp: ch.xp, data, updatedAt: now, packId }
      this.db.insert(characters).values(row)
        .onConflictDoUpdate({ target: characters.id, set: row }).run()
    }
  }

  // ── Save slots ──────────────────────────────────────────
  listSaves(userId: string): SaveSlot[] {
    return this.db.select().from(saves).where(eq(saves.ownerUserId, userId)).all().map((r) => r.data as SaveSlot)
  }
  addSave(s: SaveSlot, userId: string): void {
    this.db.insert(saves).values({
      id: s.id, name: s.name, campaignId: s.campaignId ?? null, savedAt: s.savedAt, data: s,
      ownerUserId: userId,
    }).onConflictDoUpdate({
      target: saves.id,
      set: { name: s.name, campaignId: s.campaignId ?? null, savedAt: s.savedAt, data: s },
    }).run()
  }
  deleteSave(id: string, userId: string): void {
    this.db.delete(saves).where(and(eq(saves.id, id), eq(saves.ownerUserId, userId))).run()
  }

  // ── Session history ─────────────────────────────────────
  listSessionHistory(userId: string): SessionRecord[] {
    return this.db.select().from(sessionHistory)
      .where(eq(sessionHistory.ownerUserId, userId)).all().map((r) => r.data as SessionRecord)
  }
  recordSession(r: SessionRecord, userId: string): void {
    this.db.insert(sessionHistory).values({
      id: r.id, scenarioId: r.scenarioId, scenarioTitle: r.scenarioTitle,
      difficulty: r.difficulty, outcome: r.outcome, playedAt: r.playedAt, data: r,
      ownerUserId: userId,
    }).onConflictDoUpdate({
      target: sessionHistory.id,
      set: {
        scenarioId: r.scenarioId, scenarioTitle: r.scenarioTitle,
        difficulty: r.difficulty, outcome: r.outcome, playedAt: r.playedAt, data: r,
      },
    }).run()
  }
  clearSessionHistory(userId: string): void {
    // Each user can only clear their own history.
    this.db.delete(sessionHistory).where(eq(sessionHistory.ownerUserId, userId)).run()
  }

  // ── Singletons / live state ─────────────────────────────
  getOrgState(): OrgState | null {
    return this.getKv<OrgState>(ORG_STATE_KEY)
  }
  setOrgState(state: OrgState): void {
    this.setKv(ORG_STATE_KEY, state)
  }
  getActiveOrgProfile(): OrgProfile | null {
    return this.getKv<OrgProfile>(ACTIVE_ORG_PROFILE_KEY)
  }
  setActiveOrgProfile(profile: OrgProfile | null): void {
    if (profile === null) this.deleteKv(ACTIVE_ORG_PROFILE_KEY)
    else this.setKv(ACTIVE_ORG_PROFILE_KEY, profile)
  }

  getKv<T>(key: string): T | null {
    const row = this.db.select().from(kvState).where(eq(kvState.key, key)).get()
    return row ? (row.value as T) : null
  }
  setKv<T>(key: string, value: T): void {
    const row = { key, value, updatedAt: Date.now() }
    this.db.insert(kvState).values(row)
      .onConflictDoUpdate({ target: kvState.key, set: { value, updatedAt: row.updatedAt } }).run()
  }
  deleteKv(key: string): void {
    this.db.delete(kvState).where(eq(kvState.key, key)).run()
  }

  // ── Multiplayer: rooms & participants ───────────────────
  createRoom(row: RoomInsert): void {
    this.db.insert(rooms).values(row).run()
  }
  getRoomByCode(code: string): RoomRow | null {
    return this.db.select().from(rooms).where(eq(rooms.code, code)).get() ?? null
  }
  getRoomById(id: string): RoomRow | null {
    return this.db.select().from(rooms).where(eq(rooms.id, id)).get() ?? null
  }
  setRoomStatus(id: string, status: string): void {
    this.db.update(rooms).set({ status, updatedAt: Date.now() }).where(eq(rooms.id, id)).run()
  }

  addParticipant(row: ParticipantInsert): void {
    this.db.insert(participants).values(row).run()
  }
  getParticipantByTokenHash(tokenHash: string): ParticipantRow | null {
    return this.db.select().from(participants).where(eq(participants.tokenHash, tokenHash)).get() ?? null
  }
  listParticipants(roomId: string): ParticipantRow[] {
    return this.db.select().from(participants).where(eq(participants.roomId, roomId)).all()
  }
  touchParticipant(id: string): void {
    this.db.update(participants).set({ lastSeenAt: Date.now() }).where(eq(participants.id, id)).run()
  }
  setParticipantCharacter(id: string, characterId: string | null): void {
    this.db.update(participants).set({ characterId }).where(eq(participants.id, id)).run()
  }

  getRoomSession(roomId: string): RoomSessionRow | null {
    return this.db.select().from(roomSessions).where(eq(roomSessions.roomId, roomId)).get() ?? null
  }
  upsertRoomSession(roomId: string, session: unknown, feed: unknown): void {
    const row = { roomId, session, feed, updatedAt: Date.now() }
    this.db.insert(roomSessions).values(row)
      .onConflictDoUpdate({ target: roomSessions.roomId, set: { session, feed, updatedAt: row.updatedAt } }).run()
  }

  // ── App users + auth sessions ───────────────────────────────────────────--
  countUsers(): number {
    const row = this.db.select({ n: sql<number>`count(*)` }).from(users).get()
    return row?.n ?? 0
  }
  listUsers(): UserRow[] {
    return this.db.select().from(users).all()
  }
  getUserById(id: string): UserRow | null {
    return this.db.select().from(users).where(eq(users.id, id)).get() ?? null
  }
  getUserByUsername(username: string): UserRow | null {
    return this.db.select().from(users).where(eq(users.username, username)).get() ?? null
  }
  createUser(row: UserInsert): void {
    this.db.insert(users).values(row).run()
  }
  updateUserLastLogin(id: string, when: number): void {
    this.db.update(users).set({ lastLoginAt: when }).where(eq(users.id, id)).run()
  }
  setUserActive(id: string, active: boolean): void {
    this.db.update(users).set({ active }).where(eq(users.id, id)).run()
  }
  setUserPassword(id: string, passwordHash: string): void {
    this.db.update(users).set({ passwordHash }).where(eq(users.id, id)).run()
  }
  setUserDisplayName(id: string, displayName: string): void {
    this.db.update(users).set({ displayName }).where(eq(users.id, id)).run()
  }
  setUserRole(id: string, role: string): void {
    this.db.update(users).set({ role }).where(eq(users.id, id)).run()
  }

  createAuthSession(row: AuthSessionInsert): void {
    this.db.insert(authSessions).values(row).run()
  }
  getAuthSessionByTokenHash(tokenHash: string): AuthSessionRow | null {
    return this.db.select().from(authSessions).where(eq(authSessions.tokenHash, tokenHash)).get() ?? null
  }
  touchAuthSession(tokenHash: string, when: number): void {
    this.db.update(authSessions).set({ lastSeenAt: when }).where(eq(authSessions.tokenHash, tokenHash)).run()
  }
  deleteAuthSession(tokenHash: string): void {
    this.db.delete(authSessions).where(eq(authSessions.tokenHash, tokenHash)).run()
  }
  deleteAuthSessionsForUser(userId: string): void {
    this.db.delete(authSessions).where(eq(authSessions.userId, userId)).run()
  }
  deleteAuthSessionsForUserExcept(userId: string, exceptTokenHash: string): void {
    this.db.delete(authSessions)
      .where(and(eq(authSessions.userId, userId), ne(authSessions.tokenHash, exceptTokenHash))).run()
  }
  // Backfills the new owner_user_id columns the very first time an admin
  // completes setup, so existing rosters / history don't get orphaned.
  claimUnownedRowsForUser(userId: string): void {
    this.db.transaction(() => {
      this.db.update(characters).set({ ownerUserId: userId }).where(isNull(characters.ownerUserId)).run()
      this.db.update(customScenarios).set({ ownerUserId: userId }).where(isNull(customScenarios.ownerUserId)).run()
      this.db.update(campaigns).set({ ownerUserId: userId }).where(isNull(campaigns.ownerUserId)).run()
      this.db.update(saves).set({ ownerUserId: userId }).where(isNull(saves.ownerUserId)).run()
      this.db.update(sessionHistory).set({ ownerUserId: userId }).where(isNull(sessionHistory.ownerUserId)).run()
    })
  }
}

// Default singleton instance over the default DB connection.
export const repository: DiceRepository = new SqliteRepository()
