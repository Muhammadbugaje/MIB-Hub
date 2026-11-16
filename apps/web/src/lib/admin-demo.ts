/**
 * Sample ("demo") analytics for the admin dashboard, so the charts can be
 * seen before real players arrive. Every row is marked demo = true and the
 * dashboard's "Clear sample data" button deletes them all
 * (repos.analytics.clearDemo), leaving real plays untouched.
 *
 * This file is pure (no database), so it is easy to test.
 */

export interface DemoGame {
  slug: string;
  /** Rough popularity, 0..1 (higher = more plays). */
  weight?: number;
}

export interface DemoEvent {
  gameSlug: string;
  kind: "start" | "end" | "level_start" | "level_complete" | "level_fail";
  level: string;
  sessionId: string;
  guestId: string;
  durationMs: number | null;
  score: number | null;
  device: string;
  demo: true;
  createdAt: Date;
}

export interface DemoLike {
  gameSlug: string;
  level: string;
  voter: string;
  demo: true;
}

/** A small seeded random generator, so tests are repeatable. */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

const DEVICES = ["desktop", "desktop", "mobile", "mobile", "mobile", "tablet"];

/**
 * Build `days` days of sample plays for these games: sessions with level
 * attempts (later levels fail more often), session lengths and likes.
 */
export function buildDemoData(
  games: DemoGame[],
  opts: { days?: number; now?: Date; rand?: () => number; sessionsPerDay?: number } = {},
): { events: DemoEvent[]; likes: DemoLike[] } {
  const days = opts.days ?? 30;
  const now = opts.now ?? new Date();
  const rand = opts.rand ?? Math.random;
  const perDay = opts.sessionsPerDay ?? 14;
  const events: DemoEvent[] = [];
  const likes = new Map<string, DemoLike>();
  const players = Array.from({ length: 80 }, (_, i) => `demo-${i}`);

  games.forEach((g, gi) => {
    const weight = g.weight ?? Math.max(0.15, 1 - gi * 0.07);
    for (let d = days - 1; d >= 0; d--) {
      // A gentle upward trend plus weekend bumps.
      const day = new Date(now.getTime() - d * 86_400_000);
      const weekend = day.getDay() === 0 || day.getDay() === 6 ? 1.35 : 1;
      const trend = 0.6 + 0.4 * ((days - d) / days);
      const sessions = Math.round(perDay * weight * weekend * trend * (0.6 + rand() * 0.8));
      for (let s = 0; s < sessions; s++) {
        const player = players[Math.floor(rand() * players.length)]!;
        const sessionId = `demo-${g.slug}-${d}-${s}-${Math.floor(rand() * 1e6)}`;
        const device = DEVICES[Math.floor(rand() * DEVICES.length)]!;
        const start = new Date(day.getTime() - Math.floor(rand() * 20) * 3_600_000);
        const base = { gameSlug: g.slug, sessionId, guestId: player, device, demo: true as const };
        events.push({ ...base, kind: "start", level: "", durationMs: null, score: null, createdAt: start });
        let t = start.getTime();
        const maxLevel = 1 + Math.floor(rand() * 6);
        for (let lvl = 1; lvl <= maxLevel; lvl++) {
          const level = String(lvl);
          t += 20_000 + Math.floor(rand() * 90_000);
          events.push({ ...base, kind: "level_start", level, durationMs: null, score: null, createdAt: new Date(t) });
          const failChance = Math.min(0.85, 0.08 + lvl * 0.11 + (gi % 3) * 0.04);
          const failed = rand() < failChance;
          t += 30_000 + Math.floor(rand() * 120_000);
          events.push({
            ...base,
            kind: failed ? "level_fail" : "level_complete",
            level,
            durationMs: null,
            score: failed ? null : Math.floor(100 * lvl + rand() * 400),
            createdAt: new Date(t),
          });
          if (rand() < 0.06) likes.set(`${g.slug}|${level}|${player}`, { gameSlug: g.slug, level, voter: `guest:${player}`, demo: true });
          if (failed) break;
        }
        events.push({ ...base, kind: "end", level: "", durationMs: t - start.getTime(), score: null, createdAt: new Date(t) });
        if (rand() < 0.08) likes.set(`${g.slug}||${player}`, { gameSlug: g.slug, level: "", voter: `guest:${player}`, demo: true });
      }
    }
  });
  return { events, likes: [...likes.values()] };
}
