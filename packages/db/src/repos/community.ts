/**
 * Repositories for the community, content and analytics tables
 * (schema/community.ts). Pages use these through `repos.*`; they never
 * write SQL themselves.
 */
import { and, asc, count, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import {
  ad,
  character,
  deal,
  event,
  faq,
  gameLike,
  history,
  order,
  person,
  playEvent,
  post,
  product,
  ticket,
  ticketMessage,
  type PLAY_EVENT_KINDS,
} from "../schema/index.ts";
import type { AppDb } from "../types.ts";

export type Post = typeof post.$inferSelect;
export type NewPost = typeof post.$inferInsert;
export type GameEvent = typeof event.$inferSelect;
export type NewGameEvent = typeof event.$inferInsert;
export type Deal = typeof deal.$inferSelect;
export type NewDeal = typeof deal.$inferInsert;
export type Ad = typeof ad.$inferSelect;
export type NewAd = typeof ad.$inferInsert;
export type Person = typeof person.$inferSelect;
export type NewPerson = typeof person.$inferInsert;
export type HistoryEntry = typeof history.$inferSelect;
export type NewHistoryEntry = typeof history.$inferInsert;
export type Faq = typeof faq.$inferSelect;
export type NewFaq = typeof faq.$inferInsert;
export type Ticket = typeof ticket.$inferSelect;
export type NewTicket = typeof ticket.$inferInsert;
export type TicketMessage = typeof ticketMessage.$inferSelect;
export type Character = typeof character.$inferSelect;
export type NewCharacter = typeof character.$inferInsert;
export type PlayEvent = typeof playEvent.$inferSelect;
export type NewPlayEvent = typeof playEvent.$inferInsert;
export type PlayEventKind = (typeof PLAY_EVENT_KINDS)[number];
export type Product = typeof product.$inferSelect;
export type NewProduct = typeof product.$inferInsert;
export type Order = typeof order.$inferSelect;
export type NewOrder = typeof order.$inferInsert;

const DAY = 86_400_000;

/** A short random reference like "MIB-4F2K9". */
export function makeRef(prefix: string): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${prefix}-${out}`;
}

/** "Hello, World!" -> "hello-world" */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/* ------------------------------------------------------------------ posts */

export function postsRepo(db: AppDb) {
  return {
    /** Published posts, newest first (pinned first). */
    async listPublished(opts: { kind?: Post["kind"]; limit?: number; gameSlug?: string } = {}): Promise<Post[]> {
      const where = [eq(post.status, "published"), lte(post.publishedAt, new Date())];
      if (opts.kind) where.push(eq(post.kind, opts.kind));
      if (opts.gameSlug) where.push(eq(post.gameSlug, opts.gameSlug));
      return db
        .select()
        .from(post)
        .where(and(...where))
        .orderBy(desc(post.pinned), desc(post.publishedAt))
        .limit(opts.limit ?? 50);
    },
    async listAll(): Promise<Post[]> {
      return db.select().from(post).orderBy(desc(post.updatedAt));
    },
    async getBySlug(slug: string): Promise<Post | undefined> {
      return (await db.select().from(post).where(eq(post.slug, slug)).limit(1))[0];
    },
    async getById(id: string): Promise<Post | undefined> {
      return (await db.select().from(post).where(eq(post.id, id)).limit(1))[0];
    },
    async upsertBySlug(input: NewPost): Promise<Post> {
      const { id: _i, createdAt: _c, ...changes } = input;
      return (
        await db
          .insert(post)
          .values(input)
          .onConflictDoUpdate({ target: post.slug, set: { ...changes, updatedAt: new Date() } })
          .returning()
      )[0]!;
    },
    async update(id: string, changes: Partial<NewPost>): Promise<Post | undefined> {
      return (await db.update(post).set({ ...changes, updatedAt: new Date() }).where(eq(post.id, id)).returning())[0];
    },
    async remove(id: string): Promise<void> {
      await db.delete(post).where(eq(post.id, id));
    },
    async addView(id: string): Promise<void> {
      await db.update(post).set({ views: sql`${post.views} + 1` }).where(eq(post.id, id));
    },
  };
}

/* ----------------------------------------------------------------- events */

export function eventsRepo(db: AppDb) {
  return {
    /** Published events that have not finished, soonest first. */
    async upcoming(limit = 20): Promise<GameEvent[]> {
      const now = new Date();
      return db
        .select()
        .from(event)
        .where(
          and(
            eq(event.status, "published"),
            or(gte(event.endsAt, now), and(isNull(event.endsAt), gte(event.startsAt, new Date(now.getTime() - DAY)))),
          ),
        )
        .orderBy(asc(event.startsAt))
        .limit(limit);
    },
    async past(limit = 20): Promise<GameEvent[]> {
      return db
        .select()
        .from(event)
        .where(and(eq(event.status, "published"), lte(event.endsAt, new Date())))
        .orderBy(desc(event.startsAt))
        .limit(limit);
    },
    async listAll(): Promise<GameEvent[]> {
      return db.select().from(event).orderBy(desc(event.startsAt));
    },
    async getBySlug(slug: string): Promise<GameEvent | undefined> {
      return (await db.select().from(event).where(eq(event.slug, slug)).limit(1))[0];
    },
    async getById(id: string): Promise<GameEvent | undefined> {
      return (await db.select().from(event).where(eq(event.id, id)).limit(1))[0];
    },
    async upsertBySlug(input: NewGameEvent): Promise<GameEvent> {
      const { id: _i, createdAt: _c, ...changes } = input;
      return (
        await db
          .insert(event)
          .values(input)
          .onConflictDoUpdate({ target: event.slug, set: { ...changes, updatedAt: new Date() } })
          .returning()
      )[0]!;
    },
    async update(id: string, changes: Partial<NewGameEvent>): Promise<GameEvent | undefined> {
      return (await db.update(event).set({ ...changes, updatedAt: new Date() }).where(eq(event.id, id)).returning())[0];
    },
    async remove(id: string): Promise<void> {
      await db.delete(event).where(eq(event.id, id));
    },
  };
}

/* ------------------------------------------------------------- deals, ads */

function scheduled<T extends { startsAt: unknown; endsAt: unknown }>(table: T) {
  const now = new Date();
  const t = table as unknown as typeof deal;
  return and(or(isNull(t.startsAt), lte(t.startsAt, now)), or(isNull(t.endsAt), gte(t.endsAt, now)));
}

export function dealsRepo(db: AppDb) {
  return {
    /** Active deals running now. */
    async listLive(): Promise<Deal[]> {
      return db
        .select()
        .from(deal)
        .where(and(eq(deal.active, true), scheduled(deal)))
        .orderBy(asc(deal.sort), desc(deal.createdAt));
    },
    async listAll(): Promise<Deal[]> {
      return db.select().from(deal).orderBy(asc(deal.sort), desc(deal.createdAt));
    },
    async getById(id: string): Promise<Deal | undefined> {
      return (await db.select().from(deal).where(eq(deal.id, id)).limit(1))[0];
    },
    async findByCode(code: string): Promise<Deal | undefined> {
      const live = await this.listLive();
      return live.find((d) => d.code && d.code.toUpperCase() === code.trim().toUpperCase());
    },
    async create(input: NewDeal): Promise<Deal> {
      return (await db.insert(deal).values(input).returning())[0]!;
    },
    async update(id: string, changes: Partial<NewDeal>): Promise<Deal | undefined> {
      return (await db.update(deal).set({ ...changes, updatedAt: new Date() }).where(eq(deal.id, id)).returning())[0];
    },
    async remove(id: string): Promise<void> {
      await db.delete(deal).where(eq(deal.id, id));
    },
  };
}

export function adsRepo(db: AppDb) {
  return {
    /** Live ads for a placement. */
    async forPlacement(placement: Ad["placement"]): Promise<Ad[]> {
      const now = new Date();
      return db
        .select()
        .from(ad)
        .where(
          and(
            eq(ad.placement, placement),
            eq(ad.active, true),
            or(isNull(ad.startsAt), lte(ad.startsAt, now)),
            or(isNull(ad.endsAt), gte(ad.endsAt, now)),
          ),
        )
        .orderBy(desc(ad.weight));
    },
    /** Pick one live ad for a placement (weighted random) and count an impression. */
    async pick(placement: Ad["placement"]): Promise<Ad | undefined> {
      const ads = await this.forPlacement(placement);
      if (!ads.length) return undefined;
      const total = ads.reduce((n, a) => n + Math.max(1, a.weight), 0);
      let r = Math.random() * total;
      const chosen = ads.find((a) => (r -= Math.max(1, a.weight)) < 0) ?? ads[0]!;
      await db.update(ad).set({ impressions: sql`${ad.impressions} + 1` }).where(eq(ad.id, chosen.id));
      return chosen;
    },
    async click(id: string): Promise<Ad | undefined> {
      return (await db.update(ad).set({ clicks: sql`${ad.clicks} + 1` }).where(eq(ad.id, id)).returning())[0];
    },
    async listAll(): Promise<Ad[]> {
      return db.select().from(ad).orderBy(asc(ad.placement), desc(ad.weight));
    },
    async getById(id: string): Promise<Ad | undefined> {
      return (await db.select().from(ad).where(eq(ad.id, id)).limit(1))[0];
    },
    async create(input: NewAd): Promise<Ad> {
      return (await db.insert(ad).values(input).returning())[0]!;
    },
    async update(id: string, changes: Partial<NewAd>): Promise<Ad | undefined> {
      return (await db.update(ad).set({ ...changes, updatedAt: new Date() }).where(eq(ad.id, id)).returning())[0];
    },
    async remove(id: string): Promise<void> {
      await db.delete(ad).where(eq(ad.id, id));
    },
  };
}

/* ------------------------------------------------- people, history, faq */

export function peopleRepo(db: AppDb) {
  return {
    async listVisible(group?: Person["group"]): Promise<Person[]> {
      const where = [eq(person.visible, true)];
      if (group) where.push(eq(person.group, group));
      return db
        .select()
        .from(person)
        .where(and(...where))
        .orderBy(asc(person.sort), asc(person.name));
    },
    async listAll(): Promise<Person[]> {
      return db.select().from(person).orderBy(asc(person.group), asc(person.sort), asc(person.name));
    },
    async getById(id: string): Promise<Person | undefined> {
      return (await db.select().from(person).where(eq(person.id, id)).limit(1))[0];
    },
    async findByName(name: string, group: Person["group"]): Promise<Person | undefined> {
      return (
        await db
          .select()
          .from(person)
          .where(and(eq(person.name, name), eq(person.group, group)))
          .limit(1)
      )[0];
    },
    async create(input: NewPerson): Promise<Person> {
      return (await db.insert(person).values(input).returning())[0]!;
    },
    async update(id: string, changes: Partial<NewPerson>): Promise<Person | undefined> {
      return (await db.update(person).set({ ...changes, updatedAt: new Date() }).where(eq(person.id, id)).returning())[0];
    },
    async remove(id: string): Promise<void> {
      await db.delete(person).where(eq(person.id, id));
    },
  };
}

export function historyRepo(db: AppDb) {
  return {
    async listVisible(): Promise<HistoryEntry[]> {
      return db.select().from(history).where(eq(history.visible, true)).orderBy(asc(history.date));
    },
    async listAll(): Promise<HistoryEntry[]> {
      return db.select().from(history).orderBy(asc(history.date));
    },
    async getById(id: string): Promise<HistoryEntry | undefined> {
      return (await db.select().from(history).where(eq(history.id, id)).limit(1))[0];
    },
    async findByTitle(title: string): Promise<HistoryEntry | undefined> {
      return (await db.select().from(history).where(eq(history.title, title)).limit(1))[0];
    },
    async create(input: NewHistoryEntry): Promise<HistoryEntry> {
      return (await db.insert(history).values(input).returning())[0]!;
    },
    async update(id: string, changes: Partial<NewHistoryEntry>): Promise<HistoryEntry | undefined> {
      return (await db.update(history).set({ ...changes, updatedAt: new Date() }).where(eq(history.id, id)).returning())[0];
    },
    async remove(id: string): Promise<void> {
      await db.delete(history).where(eq(history.id, id));
    },
  };
}

export function faqsRepo(db: AppDb) {
  return {
    async listPublished(): Promise<Faq[]> {
      return db.select().from(faq).where(eq(faq.published, true)).orderBy(asc(faq.category), asc(faq.sort));
    },
    async listAll(): Promise<Faq[]> {
      return db.select().from(faq).orderBy(asc(faq.category), asc(faq.sort));
    },
    async getById(id: string): Promise<Faq | undefined> {
      return (await db.select().from(faq).where(eq(faq.id, id)).limit(1))[0];
    },
    async findByQuestion(question: string): Promise<Faq | undefined> {
      return (await db.select().from(faq).where(eq(faq.question, question)).limit(1))[0];
    },
    async create(input: NewFaq): Promise<Faq> {
      return (await db.insert(faq).values(input).returning())[0]!;
    },
    async update(id: string, changes: Partial<NewFaq>): Promise<Faq | undefined> {
      return (await db.update(faq).set({ ...changes, updatedAt: new Date() }).where(eq(faq.id, id)).returning())[0];
    },
    async remove(id: string): Promise<void> {
      await db.delete(faq).where(eq(faq.id, id));
    },
  };
}

/* ---------------------------------------------------------------- tickets */

export function ticketsRepo(db: AppDb) {
  return {
    async create(input: Omit<NewTicket, "ref"> & { ref?: string }): Promise<Ticket> {
      return (await db.insert(ticket).values({ ...input, ref: input.ref ?? makeRef("MIB") }).returning())[0]!;
    },
    async list(opts: { status?: Ticket["status"]; kind?: Ticket["kind"]; limit?: number } = {}): Promise<Ticket[]> {
      const where = [];
      if (opts.status) where.push(eq(ticket.status, opts.status));
      if (opts.kind) where.push(eq(ticket.kind, opts.kind));
      return db
        .select()
        .from(ticket)
        .where(where.length ? and(...where) : undefined)
        .orderBy(desc(ticket.createdAt))
        .limit(opts.limit ?? 200);
    },
    async forUser(userId: string): Promise<Ticket[]> {
      return db.select().from(ticket).where(eq(ticket.userId, userId)).orderBy(desc(ticket.createdAt));
    },
    async getByRef(ref: string): Promise<Ticket | undefined> {
      return (await db.select().from(ticket).where(eq(ticket.ref, ref)).limit(1))[0];
    },
    async update(id: string, changes: Partial<NewTicket>): Promise<Ticket | undefined> {
      return (await db.update(ticket).set({ ...changes, updatedAt: new Date() }).where(eq(ticket.id, id)).returning())[0];
    },
    async messages(ticketId: string, opts: { includeInternal?: boolean } = {}): Promise<TicketMessage[]> {
      const where = [eq(ticketMessage.ticketId, ticketId)];
      if (!opts.includeInternal) where.push(eq(ticketMessage.internal, false));
      return db
        .select()
        .from(ticketMessage)
        .where(and(...where))
        .orderBy(asc(ticketMessage.createdAt));
    },
    async reply(input: typeof ticketMessage.$inferInsert): Promise<TicketMessage> {
      const msg = (await db.insert(ticketMessage).values(input).returning())[0]!;
      await db.update(ticket).set({ updatedAt: new Date() }).where(eq(ticket.id, input.ticketId));
      return msg;
    },
    /** Counts by status, for the dashboard. */
    async counts(): Promise<Record<Ticket["status"], number>> {
      const rows = await db.select({ status: ticket.status, n: count() }).from(ticket).groupBy(ticket.status);
      const out = { open: 0, pending: 0, resolved: 0, closed: 0 };
      for (const r of rows) out[r.status] = r.n;
      return out;
    },
  };
}

/* ------------------------------------------------------------- characters */

export function charactersRepo(db: AppDb) {
  return {
    async listPublic(gameSlug?: string): Promise<Character[]> {
      const where = [eq(character.enabled, true)];
      if (gameSlug) where.push(eq(character.gameSlug, gameSlug));
      return db
        .select()
        .from(character)
        .where(and(...where))
        .orderBy(asc(character.sort), asc(character.name));
    },
    async listAll(): Promise<Character[]> {
      return db.select().from(character).orderBy(asc(character.sort), asc(character.name));
    },
    async getByKey(key: string): Promise<Character | undefined> {
      return (await db.select().from(character).where(eq(character.key, key)).limit(1))[0];
    },
    async upsertByKey(input: NewCharacter): Promise<Character> {
      const { id: _i, createdAt: _c, ...changes } = input;
      return (
        await db
          .insert(character)
          .values(input)
          .onConflictDoUpdate({ target: character.key, set: { ...changes, updatedAt: new Date() } })
          .returning()
      )[0]!;
    },
    async update(key: string, changes: Partial<NewCharacter>): Promise<Character | undefined> {
      return (
        await db
          .update(character)
          .set({ ...changes, updatedAt: new Date() })
          .where(eq(character.key, key))
          .returning()
      )[0];
    },
  };
}

/* -------------------------------------------------------------- analytics */

export interface GameStat {
  gameSlug: string;
  plays: number;
  players: number;
  avgMinutes: number;
  likes: number;
}
export interface LevelStat {
  gameSlug: string;
  level: string;
  attempts: number;
  completions: number;
  fails: number;
  /** fails / attempts, 0..1 */
  failRate: number;
  likes: number;
}
export interface DayPoint {
  day: string; // YYYY-MM-DD
  plays: number;
  players: number;
}

export function analyticsRepo(db: AppDb) {
  const since = (days: number) => new Date(Date.now() - days * DAY);
  const player = sql<string>`coalesce(${playEvent.userId}, ${playEvent.guestId}, ${playEvent.sessionId})`;
  return {
    async track(input: NewPlayEvent): Promise<PlayEvent> {
      return (await db.insert(playEvent).values(input).returning())[0]!;
    },
    async trackMany(inputs: NewPlayEvent[]): Promise<void> {
      for (let i = 0; i < inputs.length; i += 200) await db.insert(playEvent).values(inputs.slice(i, i + 200));
    },

    /** Headline numbers for the dashboard. */
    async totals(days = 30): Promise<{ plays: number; players: number; minutes: number; completions: number }> {
      const from = since(days);
      const [p] = await db
        .select({ plays: count(), players: sql<number>`count(distinct ${player})` })
        .from(playEvent)
        .where(and(eq(playEvent.kind, "start"), gte(playEvent.createdAt, from)));
      const [m] = await db
        .select({ ms: sql<number>`coalesce(sum(${playEvent.durationMs}), 0)` })
        .from(playEvent)
        .where(and(eq(playEvent.kind, "end"), gte(playEvent.createdAt, from)));
      const [c] = await db
        .select({ n: count() })
        .from(playEvent)
        .where(and(eq(playEvent.kind, "level_complete"), gte(playEvent.createdAt, from)));
      return { plays: p?.plays ?? 0, players: p?.players ?? 0, minutes: Math.round((m?.ms ?? 0) / 60000), completions: c?.n ?? 0 };
    },

    /** Plays, distinct players, average session and likes per game. */
    async perGame(days = 30): Promise<GameStat[]> {
      const from = since(days);
      const starts = await db
        .select({ gameSlug: playEvent.gameSlug, plays: count(), players: sql<number>`count(distinct ${player})` })
        .from(playEvent)
        .where(and(eq(playEvent.kind, "start"), gte(playEvent.createdAt, from)))
        .groupBy(playEvent.gameSlug);
      const ends = await db
        .select({ gameSlug: playEvent.gameSlug, avgMs: sql<number>`avg(${playEvent.durationMs})` })
        .from(playEvent)
        .where(and(eq(playEvent.kind, "end"), gte(playEvent.createdAt, from)))
        .groupBy(playEvent.gameSlug);
      const likes = await db
        .select({ gameSlug: gameLike.gameSlug, n: count() })
        .from(gameLike)
        .where(eq(gameLike.level, ""))
        .groupBy(gameLike.gameSlug);
      const avg = new Map(ends.map((e) => [e.gameSlug, e.avgMs ?? 0]));
      const lk = new Map(likes.map((l) => [l.gameSlug, l.n]));
      return starts
        .map((s) => ({
          gameSlug: s.gameSlug,
          plays: s.plays,
          players: s.players,
          avgMinutes: Math.round(((avg.get(s.gameSlug) ?? 0) / 60000) * 10) / 10,
          likes: lk.get(s.gameSlug) ?? 0,
        }))
        .sort((a, b) => b.plays - a.plays);
    },

    /** Levels ranked by fail rate (hardest first), with at least `minAttempts` tries. */
    async hardestLevels(opts: { days?: number; gameSlug?: string; limit?: number; minAttempts?: number } = {}): Promise<LevelStat[]> {
      const where = [
        inArray(playEvent.kind, ["level_start", "level_complete", "level_fail"]),
        gte(playEvent.createdAt, since(opts.days ?? 90)),
        sql`${playEvent.level} <> ''`,
      ];
      if (opts.gameSlug) where.push(eq(playEvent.gameSlug, opts.gameSlug));
      const rows = await db
        .select({
          gameSlug: playEvent.gameSlug,
          level: playEvent.level,
          attempts: sql<number>`sum(case when ${playEvent.kind} = 'level_start' then 1 else 0 end)`,
          completions: sql<number>`sum(case when ${playEvent.kind} = 'level_complete' then 1 else 0 end)`,
          fails: sql<number>`sum(case when ${playEvent.kind} = 'level_fail' then 1 else 0 end)`,
        })
        .from(playEvent)
        .where(and(...where))
        .groupBy(playEvent.gameSlug, playEvent.level);
      const likes = await db
        .select({ gameSlug: gameLike.gameSlug, level: gameLike.level, n: count() })
        .from(gameLike)
        .where(sql`${gameLike.level} <> ''`)
        .groupBy(gameLike.gameSlug, gameLike.level);
      const lk = new Map(likes.map((l) => [`${l.gameSlug}|${l.level}`, l.n]));
      return rows
        .filter((r) => r.attempts >= (opts.minAttempts ?? 5))
        .map((r) => ({ ...r, failRate: r.attempts ? r.fails / r.attempts : 0, likes: lk.get(`${r.gameSlug}|${r.level}`) ?? 0 }))
        .sort((a, b) => b.failRate - a.failRate)
        .slice(0, opts.limit ?? 10);
    },

    /** Levels ranked by likes. */
    async mostLikedLevels(limit = 10): Promise<{ gameSlug: string; level: string; likes: number }[]> {
      const rows = await db
        .select({ gameSlug: gameLike.gameSlug, level: gameLike.level, likes: count() })
        .from(gameLike)
        .where(sql`${gameLike.level} <> ''`)
        .groupBy(gameLike.gameSlug, gameLike.level)
        .orderBy(desc(count()))
        .limit(limit);
      return rows;
    },

    /** Plays and players per day (for the trend chart). Days with no plays are filled with 0. */
    async daily(days = 30, gameSlug?: string): Promise<DayPoint[]> {
      const from = since(days);
      const where = [eq(playEvent.kind, "start"), gte(playEvent.createdAt, from)];
      if (gameSlug) where.push(eq(playEvent.gameSlug, gameSlug));
      const dayExpr = sql<string>`strftime('%Y-%m-%d', ${playEvent.createdAt} / 1000, 'unixepoch')`;
      const rows = await db
        .select({ day: dayExpr, plays: count(), players: sql<number>`count(distinct ${player})` })
        .from(playEvent)
        .where(and(...where))
        .groupBy(dayExpr);
      const byDay = new Map(rows.map((r) => [r.day, r]));
      const out: DayPoint[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * DAY).toISOString().slice(0, 10);
        const r = byDay.get(d);
        out.push({ day: d, plays: r?.plays ?? 0, players: r?.players ?? 0 });
      }
      return out;
    },

    /** Games whose plays grew most this week compared with last week. */
    async trending(limit = 5): Promise<{ gameSlug: string; thisWeek: number; lastWeek: number; growth: number }[]> {
      const rows = await db
        .select({
          gameSlug: playEvent.gameSlug,
          thisWeek: sql<number>`sum(case when ${playEvent.createdAt} >= ${since(7).getTime()} then 1 else 0 end)`,
          lastWeek: sql<number>`sum(case when ${playEvent.createdAt} < ${since(7).getTime()} then 1 else 0 end)`,
        })
        .from(playEvent)
        .where(and(eq(playEvent.kind, "start"), gte(playEvent.createdAt, since(14))))
        .groupBy(playEvent.gameSlug);
      return rows
        .map((r) => ({ ...r, growth: r.lastWeek ? (r.thisWeek - r.lastWeek) / r.lastWeek : r.thisWeek ? 1 : 0 }))
        .sort((a, b) => b.thisWeek - a.thisWeek || b.growth - a.growth)
        .slice(0, limit);
    },

    /** Device split of play starts. */
    async devices(days = 30): Promise<{ device: string; plays: number }[]> {
      return db
        .select({ device: playEvent.device, plays: count() })
        .from(playEvent)
        .where(and(eq(playEvent.kind, "start"), gte(playEvent.createdAt, since(days))))
        .groupBy(playEvent.device);
    },

    async hasDemoData(): Promise<boolean> {
      const [r] = await db.select({ n: count() }).from(playEvent).where(eq(playEvent.demo, true));
      return (r?.n ?? 0) > 0;
    },
    /** Delete every sample (demo) event and like. */
    async clearDemo(): Promise<void> {
      await db.delete(playEvent).where(eq(playEvent.demo, true));
      await db.delete(gameLike).where(eq(gameLike.demo, true));
    },
  };
}

/* ------------------------------------------------------------------ likes */

export function likesRepo(db: AppDb) {
  return {
    /** Like (or un-like) a game or a level. Returns the new state and total. */
    async toggle(gameSlug: string, voter: string, level = ""): Promise<{ liked: boolean; total: number }> {
      const where = and(eq(gameLike.gameSlug, gameSlug), eq(gameLike.level, level), eq(gameLike.voter, voter));
      const existing = (await db.select().from(gameLike).where(where).limit(1))[0];
      if (existing) await db.delete(gameLike).where(eq(gameLike.id, existing.id));
      else await db.insert(gameLike).values({ gameSlug, level, voter });
      return { liked: !existing, total: await this.count(gameSlug, level) };
    },
    async count(gameSlug: string, level = ""): Promise<number> {
      const [r] = await db
        .select({ n: count() })
        .from(gameLike)
        .where(and(eq(gameLike.gameSlug, gameSlug), eq(gameLike.level, level)));
      return r?.n ?? 0;
    },
    async hasLiked(gameSlug: string, voter: string, level = ""): Promise<boolean> {
      const r = await db
        .select({ id: gameLike.id })
        .from(gameLike)
        .where(and(eq(gameLike.gameSlug, gameSlug), eq(gameLike.level, level), eq(gameLike.voter, voter)))
        .limit(1);
      return r.length > 0;
    },
    async addMany(rows: (typeof gameLike.$inferInsert)[]): Promise<void> {
      for (let i = 0; i < rows.length; i += 200) await db.insert(gameLike).values(rows.slice(i, i + 200)).onConflictDoNothing();
    },
  };
}

/* ------------------------------------------------------- products, orders */

export function productsRepo(db: AppDb) {
  return {
    async listActive(gameSlug?: string): Promise<Product[]> {
      const where = [eq(product.active, true)];
      if (gameSlug) where.push(eq(product.gameSlug, gameSlug));
      return db
        .select()
        .from(product)
        .where(and(...where))
        .orderBy(asc(product.sort), asc(product.priceKobo));
    },
    async listAll(): Promise<Product[]> {
      return db.select().from(product).orderBy(asc(product.sort));
    },
    async getBySku(sku: string): Promise<Product | undefined> {
      return (await db.select().from(product).where(eq(product.sku, sku)).limit(1))[0];
    },
    async upsertBySku(input: NewProduct): Promise<Product> {
      const { id: _i, createdAt: _c, ...changes } = input;
      return (
        await db
          .insert(product)
          .values(input)
          .onConflictDoUpdate({ target: product.sku, set: { ...changes, updatedAt: new Date() } })
          .returning()
      )[0]!;
    },
    async update(sku: string, changes: Partial<NewProduct>): Promise<Product | undefined> {
      return (await db.update(product).set({ ...changes, updatedAt: new Date() }).where(eq(product.sku, sku)).returning())[0];
    },
  };
}

export function ordersRepo(db: AppDb) {
  return {
    async create(input: Omit<NewOrder, "ref"> & { ref?: string }): Promise<Order> {
      return (await db.insert(order).values({ ...input, ref: input.ref ?? makeRef("ORD") }).returning())[0]!;
    },
    async list(limit = 200): Promise<Order[]> {
      return db.select().from(order).orderBy(desc(order.createdAt)).limit(limit);
    },
    async forUser(userId: string): Promise<Order[]> {
      return db.select().from(order).where(eq(order.userId, userId)).orderBy(desc(order.createdAt));
    },
    async getByRef(ref: string): Promise<Order | undefined> {
      return (await db.select().from(order).where(eq(order.ref, ref)).limit(1))[0];
    },
    async setStatus(ref: string, status: Order["status"], providerRef?: string): Promise<Order | undefined> {
      const changes: Partial<NewOrder> = { status, updatedAt: new Date() };
      if (providerRef !== undefined) changes.providerRef = providerRef;
      return (await db.update(order).set(changes).where(eq(order.ref, ref)).returning())[0];
    },
    /** Paid revenue in kobo over the last `days`. */
    async revenue(days = 30): Promise<number> {
      const [r] = await db
        .select({ sum: sql<number>`coalesce(sum(${order.amountKobo}), 0)` })
        .from(order)
        .where(and(eq(order.status, "paid"), gte(order.createdAt, new Date(Date.now() - days * DAY))));
      return r?.sum ?? 0;
    },
  };
}
