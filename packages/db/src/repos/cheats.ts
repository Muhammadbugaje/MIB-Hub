/**
 * Cheat codes and the secret character ("hero").
 *
 * Plain codes go in, hashes are stored, plain codes never come back out.
 * The admin panel can only set a new code, never read the old one.
 */
import { and, asc, eq, inArray } from "drizzle-orm";
import { hashCode, newSalt, normaliseCode, verifyCode } from "../crypto.ts";
import { cheat, hero } from "../schema/index.ts";
import type { AppDb, PasswordHasher } from "../types.ts";
import { ALL_GAMES } from "./games.ts";

export type Cheat = typeof cheat.$inferSelect;
/** A cheat as shown to admins: without the hash and salt. */
export type CheatInfo = Omit<Cheat, "codeHash" | "codeSalt">;
export type Hero = typeof hero.$inferSelect;
export type HeroInfo = Omit<Hero, "passwordHash">;

/** Shortest allowed code (Django MIN_CODE). */
export const MIN_CODE_LENGTH = 4;

function hideSecret({ codeHash: _h, codeSalt: _s, ...rest }: Cheat): CheatInfo {
  return rest;
}

function checkCode(code: string): string {
  const norm = normaliseCode(code);
  if (norm.length < MIN_CODE_LENGTH) throw new Error(`A code needs at least ${MIN_CODE_LENGTH} letters or digits.`);
  return norm;
}

export function cheatsRepo(db: AppDb) {
  return {
    async list(gameSlug: string): Promise<CheatInfo[]> {
      const rows = await db.select().from(cheat).where(eq(cheat.gameSlug, gameSlug)).orderBy(asc(cheat.key));
      return rows.map(hideSecret);
    },

    async create(input: {
      gameSlug: string;
      key: string;
      label: string;
      code: string;
      channel?: Cheat["channel"];
      how?: string;
      effect?: Record<string, unknown>;
      access?: Cheat["access"];
    }): Promise<CheatInfo> {
      const salt = newSalt();
      const codeHash = await hashCode(input.gameSlug, checkCode(input.code), salt);
      const rows = await db
        .insert(cheat)
        .values({
          gameSlug: input.gameSlug,
          key: input.key,
          label: input.label,
          channel: input.channel ?? "any",
          how: input.how ?? "",
          effect: input.effect ?? {},
          access: input.access ?? null,
          codeHash,
          codeSalt: salt,
        })
        .returning();
      return hideSecret(rows[0]!);
    },

    /** Give a cheat a new code (a fresh salt every time). */
    async setCode(id: string, code: string): Promise<void> {
      const rows = await db.select().from(cheat).where(eq(cheat.id, id)).limit(1);
      const row = rows[0];
      if (!row) throw new Error("No such cheat.");
      const salt = newSalt();
      const codeHash = await hashCode(row.gameSlug, checkCode(code), salt);
      await db.update(cheat).set({ codeHash, codeSalt: salt, updatedAt: new Date() }).where(eq(cheat.id, id));
    },

    async setEnabled(id: string, enabled: boolean): Promise<void> {
      await db.update(cheat).set({ enabled, updatedAt: new Date() }).where(eq(cheat.id, id));
    },

    async remove(id: string): Promise<void> {
      await db.delete(cheat).where(eq(cheat.id, id));
    },

    /**
     * Which enabled cheat (if any) does this code unlock in this game?
     * Checks every enabled cheat of the game (each has its own salt).
     */
    async match(gameSlug: string, code: string, channel: "typed" | "dial" = "typed"): Promise<CheatInfo | null> {
      const rows = await db
        .select()
        .from(cheat)
        .where(and(eq(cheat.gameSlug, gameSlug), eq(cheat.enabled, true), inArray(cheat.channel, [channel, "any"])));
      for (const row of rows) {
        if (await verifyCode(gameSlug, code, row.codeSalt, row.codeHash)) return hideSecret(row);
      }
      return null;
    },
  };
}

export function heroesRepo(db: AppDb, hasher: PasswordHasher) {
  function hide({ passwordHash: _p, ...rest }: Hero): HeroInfo {
    return rest;
  }
  return {
    /** Heroes for a game, plus the site-wide ones ("*"). */
    async list(gameSlug: string): Promise<HeroInfo[]> {
      const rows = await db
        .select()
        .from(hero)
        .where(inArray(hero.gameSlug, [gameSlug, ALL_GAMES]))
        .orderBy(asc(hero.name));
      return rows.map(hide);
    },

    async create(input: {
      name: string;
      code: string;
      gameSlug?: string;
      fullName?: string;
      access?: Hero["access"];
      details?: Record<string, string>;
    }): Promise<HeroInfo> {
      const rows = await db
        .insert(hero)
        .values({
          name: input.name,
          fullName: input.fullName ?? "",
          gameSlug: input.gameSlug ?? ALL_GAMES,
          access: input.access ?? "code",
          details: input.details ?? {},
          passwordHash: await hasher.hash(checkCode(input.code)),
        })
        .returning();
      return hide(rows[0]!);
    },

    async setCode(id: string, code: string): Promise<void> {
      await db
        .update(hero)
        .set({ passwordHash: await hasher.hash(checkCode(code)), updatedAt: new Date() })
        .where(eq(hero.id, id));
    },

    /** The enabled hero this code unlocks in this game (game's own first, then site-wide). */
    async verify(gameSlug: string, code: string): Promise<HeroInfo | null> {
      const rows = await db
        .select()
        .from(hero)
        .where(and(inArray(hero.gameSlug, [gameSlug, ALL_GAMES]), eq(hero.enabled, true)));
      rows.sort((a, b) => Number(b.gameSlug === gameSlug) - Number(a.gameSlug === gameSlug));
      const norm = normaliseCode(code);
      for (const row of rows) {
        if (await hasher.verify(row.passwordHash, norm)) return hide(row);
      }
      return null;
    },
  };
}
