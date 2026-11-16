/**
 * Offline play: results and saves made with no internet, sent later.
 *
 *   offline_submission  one row per item a device sent (a result, a score).
 *                       The device makes the id (`cid`), so sending the same
 *                       item twice (a retry, two tabs, Background Sync and the
 *                       page at once) is counted once.
 *
 * How a submission is counted, safely:
 *
 *   1. claim(profile, cid)    insert the row. The unique index on `cid` makes
 *                             this atomic: only one request can win.
 *   2. do the work            (rewards, score)
 *   3. settle(...)            note how it went (ok, or the reason it was refused)
 *      or release(...)        the work crashed: forget the claim so a retry runs
 *
 * The stored `cid` is "<profileId>:<device id>", so one player can never
 * block another player's ids.
 *
 * saveIfUnchanged() is the cloud save with a version check (optimistic
 * locking): it only overwrites a save the device has already seen, so a
 * device that was offline cannot silently replace newer progress.
 *
 * Runs on local SQLite and on Cloudflare D1 (single statements, no
 * interactive transactions).
 */
import { and, desc, eq, lt, lte } from "drizzle-orm";
import { offlineSubmission, progress } from "../schema/index.ts";
import type { AppDb } from "../types.ts";
import type { Progress, SaveSlot } from "./players.ts";

export type OfflineSubmission = typeof offlineSubmission.$inferSelect;

/** A device id: 8 to 64 of a-z, A-Z, 0-9, "_" and "-" (a UUID fits). */
export const OFFLINE_CID_RE = /^[a-zA-Z0-9_-]{8,64}$/;

const key = (profileId: string, cid: string) => `${profileId}:${cid}`;

export function offlineRepo(db: AppDb) {
  return {
    /**
     * Claim a device id for a profile. True: this is the first time (go ahead
     * and count it). False: it was already sent (do not count it again).
     */
    async claim(input: { profileId: string; cid: string; gameSlug?: string; playedAt?: Date | null }): Promise<boolean> {
      if (!OFFLINE_CID_RE.test(input.cid)) throw new Error("Bad offline id.");
      const rows = await db
        .insert(offlineSubmission)
        .values({
          cid: key(input.profileId, input.cid),
          profileId: input.profileId,
          gameSlug: (input.gameSlug ?? "").slice(0, 80),
          playedAt: input.playedAt ?? null,
          ok: true,
        })
        .onConflictDoNothing()
        .returning({ id: offlineSubmission.id });
      return rows.length === 1;
    },

    /** Record how a claimed item went: counted (ok) or refused, with the reason. */
    async settle(profileId: string, cid: string, outcome: { ok: boolean; note?: string }): Promise<void> {
      await db
        .update(offlineSubmission)
        .set({ ok: outcome.ok, note: (outcome.note ?? "").slice(0, 200) })
        .where(eq(offlineSubmission.cid, key(profileId, cid)));
    },

    /** Forget a claim (the work failed for a reason that a retry may fix). */
    async release(profileId: string, cid: string): Promise<void> {
      await db.delete(offlineSubmission).where(eq(offlineSubmission.cid, key(profileId, cid)));
    },

    async get(profileId: string, cid: string): Promise<OfflineSubmission | undefined> {
      const rows = await db.select().from(offlineSubmission).where(eq(offlineSubmission.cid, key(profileId, cid))).limit(1);
      return rows[0];
    },

    /** A player's most recent offline submissions, newest first. */
    async listForProfile(profileId: string, limit = 50): Promise<OfflineSubmission[]> {
      return db
        .select()
        .from(offlineSubmission)
        .where(eq(offlineSubmission.profileId, profileId))
        .orderBy(desc(offlineSubmission.createdAt))
        .limit(Math.max(1, Math.min(500, limit)));
    },

    /** Delete rows older than `before` (devices only resend for a few weeks). Returns how many went. */
    async prune(before: Date): Promise<number> {
      const rows = await db
        .delete(offlineSubmission)
        .where(lt(offlineSubmission.createdAt, before))
        .returning({ id: offlineSubmission.id });
      return rows.length;
    },

    /**
     * Write a save slot only if the cloud copy has not changed since the
     * device last saw it. `base` is the version (updatedAt in ms) the device
     * built on; 0 means "I have never seen a cloud save".
     *
     *   { ok: true, row }        written
     *   { ok: false, current }   someone else saved first: merge and try again
     */
    async saveIfUnchanged(input: {
      profileId: string;
      gameSlug: string;
      slot?: SaveSlot;
      data: Record<string, unknown>;
      saveVersion?: number;
      summary?: string;
      base: number;
    }): Promise<{ ok: true; row: Progress } | { ok: false; current: Progress }> {
      const slot = input.slot ?? "auto";
      // Never move the version backwards, even if this server's clock is behind the last writer's.
      const now = new Date(Math.max(Date.now(), input.base + 1));
      const rows = await db
        .insert(progress)
        .values({
          profileId: input.profileId,
          gameSlug: input.gameSlug,
          slot,
          data: input.data,
          saveVersion: input.saveVersion ?? 1,
          summary: input.summary ?? "",
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [progress.profileId, progress.gameSlug, progress.slot],
          set: { data: input.data, saveVersion: input.saveVersion ?? 1, summary: input.summary ?? "", updatedAt: now },
          setWhere: lte(progress.updatedAt, new Date(Math.max(0, input.base))),
        })
        .returning();
      if (rows[0]) return { ok: true, row: rows[0] };
      const current = await db
        .select()
        .from(progress)
        .where(and(eq(progress.profileId, input.profileId), eq(progress.gameSlug, input.gameSlug), eq(progress.slot, slot)))
        .limit(1);
      return { ok: false, current: current[0]! };
    },
  };
}
