/**
 * Player profiles, scores and save progress.
 */
import { and, asc, desc, eq } from "drizzle-orm";
import { playerProfile, progress, score, user } from "../schema/index.ts";
import type { AppDb } from "../types.ts";

export type PlayerProfile = typeof playerProfile.$inferSelect;
export type Score = typeof score.$inferSelect;
export type Progress = typeof progress.$inferSelect;

/** Save slots: one auto slot and five manual slots (the old game's design). */
export const SAVE_SLOTS = ["auto", "1", "2", "3", "4", "5"] as const;
export type SaveSlot = (typeof SAVE_SLOTS)[number];

/** Leaderboard name: first name and last initial, e.g. "Amina B." */
export function leaderboardName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Player";
  const last = parts.length > 1 ? parts[parts.length - 1] : undefined;
  return last ? `${parts[0]} ${last[0]!.toUpperCase()}.` : parts[0]!;
}

export function profilesRepo(db: AppDb) {
  return {
    async getForUser(userId: string): Promise<PlayerProfile | undefined> {
      const rows = await db.select().from(playerProfile).where(eq(playerProfile.userId, userId)).limit(1);
      return rows[0];
    },

    /** The user's profile, made on first use. */
    async getOrCreateForUser(userId: string, displayName: string): Promise<PlayerProfile> {
      const existing = await this.getForUser(userId);
      if (existing) return existing;
      await db.insert(playerProfile).values({ userId, displayName }).onConflictDoNothing();
      return (await this.getForUser(userId))!;
    },

    /** Add (or, with a negative number, remove) coins and XP. Never below zero. */
    async addRewards(profileId: string, rewards: { coins?: number; xp?: number }): Promise<PlayerProfile> {
      const rows = await db.select().from(playerProfile).where(eq(playerProfile.id, profileId)).limit(1);
      const p = rows[0];
      if (!p) throw new Error("No such profile.");
      const updated = await db
        .update(playerProfile)
        .set({
          coins: Math.max(0, p.coins + Math.trunc(rewards.coins ?? 0)),
          xp: Math.max(0, p.xp + Math.trunc(rewards.xp ?? 0)),
          updatedAt: new Date(),
        })
        .where(eq(playerProfile.id, profileId))
        .returning();
      return updated[0]!;
    },
  };
}

export interface LeaderboardRow {
  profileId: string;
  name: string;
  score: number;
  createdAt: Date;
}

export function scoresRepo(db: AppDb) {
  return {
    async submit(input: {
      profileId: string;
      gameSlug: string;
      score: number;
      cheated?: boolean;
      details?: Record<string, unknown>;
    }): Promise<Score> {
      if (!Number.isFinite(input.score) || input.score < 0) throw new Error("A score must be a number of 0 or more.");
      const rows = await db
        .insert(score)
        .values({
          profileId: input.profileId,
          gameSlug: input.gameSlug,
          score: Math.trunc(input.score),
          cheated: input.cheated ?? false,
          details: input.details ?? {},
        })
        .returning();
      return rows[0]!;
    },

    /**
     * Top scores for a game. Cheated runs and players who opted out of
     * leaderboards are left out unless asked for.
     */
    async top(gameSlug: string, opts: { limit?: number; includeCheated?: boolean } = {}): Promise<LeaderboardRow[]> {
      const conditions = [eq(score.gameSlug, gameSlug), eq(playerProfile.onLeaderboard, true)];
      if (!opts.includeCheated) conditions.push(eq(score.cheated, false));
      const rows = await db
        .select({
          profileId: score.profileId,
          displayName: playerProfile.displayName,
          userName: user.name,
          score: score.score,
          createdAt: score.createdAt,
        })
        .from(score)
        .innerJoin(playerProfile, eq(playerProfile.id, score.profileId))
        .leftJoin(user, eq(user.id, playerProfile.userId))
        .where(and(...conditions))
        .orderBy(desc(score.score), asc(score.createdAt))
        .limit(opts.limit ?? 10);
      return rows.map((r) => ({
        profileId: r.profileId,
        name: leaderboardName(r.displayName || r.userName || ""),
        score: r.score,
        createdAt: r.createdAt,
      }));
    },

    async bestFor(profileId: string, gameSlug: string): Promise<number | null> {
      const rows = await db
        .select({ score: score.score })
        .from(score)
        .where(and(eq(score.profileId, profileId), eq(score.gameSlug, gameSlug), eq(score.cheated, false)))
        .orderBy(desc(score.score))
        .limit(1);
      return rows[0]?.score ?? null;
    },
  };
}

export function progressRepo(db: AppDb) {
  return {
    /** Save (or overwrite) one slot. */
    async save(input: {
      profileId: string;
      gameSlug: string;
      slot?: SaveSlot;
      data: Record<string, unknown>;
      saveVersion?: number;
      summary?: string;
    }): Promise<Progress> {
      const values = {
        profileId: input.profileId,
        gameSlug: input.gameSlug,
        slot: input.slot ?? "auto",
        data: input.data,
        saveVersion: input.saveVersion ?? 1,
        summary: input.summary ?? "",
      };
      const rows = await db
        .insert(progress)
        .values(values)
        .onConflictDoUpdate({
          target: [progress.profileId, progress.gameSlug, progress.slot],
          set: { data: values.data, saveVersion: values.saveVersion, summary: values.summary, updatedAt: new Date() },
        })
        .returning();
      return rows[0]!;
    },

    async load(profileId: string, gameSlug: string, slot: SaveSlot = "auto"): Promise<Progress | undefined> {
      const rows = await db
        .select()
        .from(progress)
        .where(and(eq(progress.profileId, profileId), eq(progress.gameSlug, gameSlug), eq(progress.slot, slot)))
        .limit(1);
      return rows[0];
    },

    async list(profileId: string, gameSlug: string): Promise<Progress[]> {
      return db
        .select()
        .from(progress)
        .where(and(eq(progress.profileId, profileId), eq(progress.gameSlug, gameSlug)))
        .orderBy(asc(progress.slot));
    },
  };
}
