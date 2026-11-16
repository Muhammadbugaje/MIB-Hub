/**
 * Replacement sounds for every player of a game (table game_sound; Django
 * GlobalSound). Only the row lives here; the file itself is in storage
 * (apps/web/.data/uploads/sounds in development, R2 later) under `fileKey`.
 */
import { and, asc, eq } from "drizzle-orm";
import { gameSound } from "../schema/index.ts";
import type { AppDb } from "../types.ts";

export type GameSound = typeof gameSound.$inferSelect;

/** Sound names as in the old site: lower-case letters, digits and _ . : - (max 80). */
export const SOUND_NAME_RE = /^[a-z0-9_][a-z0-9_.:-]{0,79}$/;
/** Limits from the old sounds.py: 2 MB, 0.05 to 120 seconds. */
export const SOUND_MAX_BYTES = 2 * 1024 * 1024;
export const SOUND_MIN_SECONDS = 0.05;
export const SOUND_MAX_SECONDS = 120;

export function gameSoundsRepo(db: AppDb) {
  return {
    async list(gameSlug?: string): Promise<GameSound[]> {
      return db
        .select()
        .from(gameSound)
        .where(gameSlug ? eq(gameSound.gameSlug, gameSlug) : undefined)
        .orderBy(asc(gameSound.gameSlug), asc(gameSound.name));
    },
    async getById(id: string): Promise<GameSound | undefined> {
      return (await db.select().from(gameSound).where(eq(gameSound.id, id)).limit(1))[0];
    },
    async get(gameSlug: string, name: string): Promise<GameSound | undefined> {
      return (
        await db
          .select()
          .from(gameSound)
          .where(and(eq(gameSound.gameSlug, gameSlug), eq(gameSound.name, name)))
          .limit(1)
      )[0];
    },
    /**
     * Save (or replace) a sound. Replacing bumps the version. Returns the row
     * and the old file key, so the caller can delete the old file.
     */
    async save(input: {
      gameSlug: string;
      name: string;
      fileKey: string;
      contentType: string;
      size: number;
      duration: number;
      originalName?: string;
      uploadedBy?: string | null;
    }): Promise<{ sound: GameSound; previousFileKey: string | null }> {
      if (!SOUND_NAME_RE.test(input.name)) throw new Error("Sound names use lower-case letters, digits and _ . : - only.");
      const existing = await this.get(input.gameSlug, input.name);
      const values = {
        fileKey: input.fileKey,
        contentType: input.contentType,
        size: input.size,
        duration: input.duration,
        originalName: input.originalName ?? "",
        uploadedBy: input.uploadedBy ?? null,
      };
      if (existing) {
        const rows = await db
          .update(gameSound)
          .set({ ...values, version: existing.version + 1, updatedAt: new Date() })
          .where(eq(gameSound.id, existing.id))
          .returning();
        return { sound: rows[0]!, previousFileKey: existing.fileKey };
      }
      const rows = await db
        .insert(gameSound)
        .values({ gameSlug: input.gameSlug, name: input.name, ...values })
        .returning();
      return { sound: rows[0]!, previousFileKey: null };
    },
    async remove(id: string): Promise<GameSound | undefined> {
      return (await db.delete(gameSound).where(eq(gameSound.id, id)).returning())[0];
    },
  };
}
