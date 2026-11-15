/**
 * Games catalogue and per-game settings.
 */
import { and, asc, eq, inArray } from "drizzle-orm";
import { game, gameSetting, type GameStatus } from "../schema/index.ts";
import type { AppDb } from "../types.ts";

export type Game = typeof game.$inferSelect;
export type NewGame = typeof game.$inferInsert;

/** The slug of the site-wide settings row (as in Django). */
export const ALL_GAMES = "*";

export function gamesRepo(db: AppDb) {
  return {
    /** Games for the public games page: live or demo, enabled, in sort order. */
    async listPublic(): Promise<Game[]> {
      const visible: GameStatus[] = ["live", "demo"];
      return db
        .select()
        .from(game)
        .where(and(inArray(game.status, visible), eq(game.enabled, true)))
        .orderBy(asc(game.sort), asc(game.title));
    },

    /** Every game, for the admin panel. */
    async listAll(): Promise<Game[]> {
      return db.select().from(game).orderBy(asc(game.sort), asc(game.title));
    },

    async getBySlug(slug: string): Promise<Game | undefined> {
      const rows = await db.select().from(game).where(eq(game.slug, slug)).limit(1);
      return rows[0];
    },

    /** Create the game, or update it if the slug exists. Returns the saved row. */
    async upsert(input: NewGame): Promise<Game> {
      const { id: _ignored, createdAt: _c, ...changes } = input;
      const rows = await db
        .insert(game)
        .values(input)
        .onConflictDoUpdate({ target: game.slug, set: { ...changes, updatedAt: new Date() } })
        .returning();
      return rows[0]!;
    },

    async update(slug: string, changes: Partial<Omit<NewGame, "id" | "slug">>): Promise<Game | undefined> {
      const rows = await db
        .update(game)
        .set({ ...changes, updatedAt: new Date() })
        .where(eq(game.slug, slug))
        .returning();
      return rows[0];
    },

    async remove(slug: string): Promise<void> {
      await db.delete(game).where(eq(game.slug, slug));
    },
  };
}

export function gameSettingsRepo(db: AppDb) {
  async function read(slug: string): Promise<Record<string, unknown>> {
    const rows = await db.select().from(gameSetting).where(eq(gameSetting.gameSlug, slug)).limit(1);
    return rows[0]?.data ?? {};
  }

  return {
    /** The owner's overrides for one game ({} if none). */
    get: read,

    /** Site-wide values (the "*" row). */
    getGlobal: () => read(ALL_GAMES),

    /**
     * The effective settings for a game: the game's defaults, then the
     * site-wide overrides, then the game's own overrides (later wins).
     */
    async effective(slug: string, defaults: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
      return { ...defaults, ...(await read(ALL_GAMES)), ...(await read(slug)) };
    },

    /** Merge `patch` into the stored overrides. A value of null removes that key. */
    async update(slug: string, patch: Record<string, unknown>, actorId: string | null = null) {
      const next: Record<string, unknown> = { ...(await read(slug)) };
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) delete next[k];
        else next[k] = v;
      }
      await db
        .insert(gameSetting)
        .values({ gameSlug: slug, data: next, updatedBy: actorId })
        .onConflictDoUpdate({ target: gameSetting.gameSlug, set: { data: next, updatedBy: actorId, updatedAt: new Date() } });
      return next;
    },
  };
}
