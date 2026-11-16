/**
 * Replacement sounds for every player of a game (table game_sound; Django
 * GlobalSound). Only the row lives here; the file itself is in storage
 * (apps/web/.data/uploads/sounds in development, R2 later) under `fileKey`.
 */
import { and, asc, desc, eq, max } from "drizzle-orm";
import { gameSound, gameSoundSetting, gameSoundVersion, type SoundVersionSource } from "../schema/index.ts";
import type { AppDb } from "../types.ts";

export { SOUND_VERSION_SOURCES, type SoundVersionSource } from "../schema/index.ts";

export type GameSound = typeof gameSound.$inferSelect;
export type GameSoundVersion = typeof gameSoundVersion.$inferSelect;
export type GameSoundSetting = typeof gameSoundSetting.$inferSelect;

/** Older versions beyond this many (per sound) are pruned; their files can then be deleted. */
export const SOUND_KEEP_VERSIONS = 12;
/** Per-sound volume range (1 = as made). */
export const SOUND_MIN_VOLUME = 0;
export const SOUND_MAX_VOLUME = 2;

export interface SoundFileInput {
  gameSlug: string;
  name: string;
  fileKey: string;
  contentType: string;
  size: number;
  duration: number;
  originalName?: string;
  uploadedBy?: string | null;
}

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

    /* ---------- the sound manager: history, revert and volume ---------- */

    /**
     * Add a new file for a sound (uploaded, recorded or edited) and make it the
     * one players hear. Keeps the history; versions beyond SOUND_KEEP_VERSIONS
     * (never the live one) are pruned and their file keys returned, so the
     * caller can delete those files.
     */
    async addVersion(
      input: SoundFileInput & { source?: SoundVersionSource; note?: string },
    ): Promise<{ sound: GameSound; version: GameSoundVersion; before: GameSound | null; pruned: string[] }> {
      if (!SOUND_NAME_RE.test(input.name)) throw new Error("Sound names use lower-case letters, digits and _ . : - only.");
      const before = (await this.get(input.gameSlug, input.name)) ?? null;
      const top = await db
        .select({ v: max(gameSoundVersion.version) })
        .from(gameSoundVersion)
        .where(and(eq(gameSoundVersion.gameSlug, input.gameSlug), eq(gameSoundVersion.name, input.name)));
      const number = Math.max(top[0]?.v ?? 0, before?.version ?? 0) + 1;
      const version = (
        await db
          .insert(gameSoundVersion)
          .values({
            gameSlug: input.gameSlug,
            name: input.name,
            version: number,
            fileKey: input.fileKey,
            contentType: input.contentType,
            size: input.size,
            duration: input.duration,
            originalName: input.originalName ?? "",
            source: input.source ?? "upload",
            note: (input.note ?? "").slice(0, 200),
            uploadedBy: input.uploadedBy ?? null,
          })
          .returning()
      )[0]!;
      const sound = await this.point(version, before);
      const pruned = await this.prune(input.gameSlug, input.name, sound.fileKey);
      return { sound, version, before, pruned };
    },
    /** Make game_sound play this version (insert or update). */
    async point(v: GameSoundVersion, before?: GameSound | null): Promise<GameSound> {
      const values = {
        fileKey: v.fileKey,
        contentType: v.contentType,
        size: v.size,
        duration: v.duration,
        originalName: v.originalName,
        uploadedBy: v.uploadedBy,
        version: v.version,
      };
      const cur = before === undefined ? await this.get(v.gameSlug, v.name) : before;
      if (cur) {
        return (await db.update(gameSound).set({ ...values, updatedAt: new Date() }).where(eq(gameSound.id, cur.id)).returning())[0]!;
      }
      return (await db.insert(gameSound).values({ gameSlug: v.gameSlug, name: v.name, ...values }).returning())[0]!;
    },
    async prune(gameSlug: string, name: string, liveKey: string): Promise<string[]> {
      const all = await this.versions(gameSlug, name);
      const drop = all.slice(SOUND_KEEP_VERSIONS).filter((v) => v.fileKey !== liveKey);
      for (const v of drop) await db.delete(gameSoundVersion).where(eq(gameSoundVersion.id, v.id));
      return drop.map((v) => v.fileKey);
    },
    /** Every saved version of one sound, newest first. */
    async versions(gameSlug: string, name: string): Promise<GameSoundVersion[]> {
      return db
        .select()
        .from(gameSoundVersion)
        .where(and(eq(gameSoundVersion.gameSlug, gameSlug), eq(gameSoundVersion.name, name)))
        .orderBy(desc(gameSoundVersion.version));
    },
    /** Every version for a game (for counts on the list page). */
    async versionsForGame(gameSlug: string): Promise<GameSoundVersion[]> {
      return db.select().from(gameSoundVersion).where(eq(gameSoundVersion.gameSlug, gameSlug)).orderBy(asc(gameSoundVersion.name), desc(gameSoundVersion.version));
    },
    async getVersion(id: string): Promise<GameSoundVersion | undefined> {
      return (await db.select().from(gameSoundVersion).where(eq(gameSoundVersion.id, id)).limit(1))[0];
    },
    /** Players hear this older version again. Returns the row before and after. */
    async useVersion(id: string): Promise<{ before: GameSound | null; sound: GameSound } | null> {
      const v = await this.getVersion(id);
      if (!v) return null;
      const before = (await this.get(v.gameSlug, v.name)) ?? null;
      return { before, sound: await this.point(v, before) };
    },
    /** Back to the game's own (synthesised or recorded) sound. The history is kept. */
    async useOriginal(gameSlug: string, name: string): Promise<GameSound | null> {
      const cur = await this.get(gameSlug, name);
      if (!cur) return null;
      await db.delete(gameSound).where(eq(gameSound.id, cur.id));
      return cur;
    },
    /** Delete one saved version (not the live one). Returns it, so the caller can delete its file. */
    async removeVersion(id: string): Promise<GameSoundVersion | null> {
      const v = await this.getVersion(id);
      if (!v) return null;
      const cur = await this.get(v.gameSlug, v.name);
      if (cur && cur.fileKey === v.fileKey) throw new Error("That version is playing now. Switch to another one (or the original) first.");
      await db.delete(gameSoundVersion).where(eq(gameSoundVersion.id, id));
      return v;
    },
    /** Delete a sound's whole history and override. Returns every file key to delete. */
    async purge(gameSlug: string, name: string): Promise<string[]> {
      const keys = new Set((await this.versions(gameSlug, name)).map((v) => v.fileKey));
      const cur = await this.get(gameSlug, name);
      if (cur) keys.add(cur.fileKey);
      await db.delete(gameSoundVersion).where(and(eq(gameSoundVersion.gameSlug, gameSlug), eq(gameSoundVersion.name, name)));
      await db.delete(gameSound).where(and(eq(gameSound.gameSlug, gameSlug), eq(gameSound.name, name)));
      await db.delete(gameSoundSetting).where(and(eq(gameSoundSetting.gameSlug, gameSlug), eq(gameSoundSetting.name, name)));
      return [...keys];
    },
    async settings(gameSlug: string): Promise<GameSoundSetting[]> {
      return db.select().from(gameSoundSetting).where(eq(gameSoundSetting.gameSlug, gameSlug)).orderBy(asc(gameSoundSetting.name));
    },
    async getSetting(gameSlug: string, name: string): Promise<GameSoundSetting | undefined> {
      return (
        await db
          .select()
          .from(gameSoundSetting)
          .where(and(eq(gameSoundSetting.gameSlug, gameSlug), eq(gameSoundSetting.name, name)))
          .limit(1)
      )[0];
    },
    /** Set the volume every player hears for one sound (0 to 2). Volume 1 removes the setting. */
    async setVolume(gameSlug: string, name: string, volume: number, by?: string | null): Promise<{ before: GameSoundSetting | null; after: GameSoundSetting | null }> {
      if (!SOUND_NAME_RE.test(name)) throw new Error("Sound names use lower-case letters, digits and _ . : - only.");
      if (!Number.isFinite(volume)) throw new Error("Volume must be a number.");
      const v = Math.round(Math.min(SOUND_MAX_VOLUME, Math.max(SOUND_MIN_VOLUME, volume)) * 100) / 100;
      const before = (await this.getSetting(gameSlug, name)) ?? null;
      if (v === 1) {
        if (before) await db.delete(gameSoundSetting).where(eq(gameSoundSetting.id, before.id));
        return { before, after: null };
      }
      if (before) {
        const after = (await db.update(gameSoundSetting).set({ volume: v, updatedBy: by ?? null, updatedAt: new Date() }).where(eq(gameSoundSetting.id, before.id)).returning())[0]!;
        return { before, after };
      }
      const after = (await db.insert(gameSoundSetting).values({ gameSlug, name, volume: v, updatedBy: by ?? null }).returning())[0]!;
      return { before: null, after };
    },
  };
}
