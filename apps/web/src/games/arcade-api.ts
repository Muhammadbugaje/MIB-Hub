/**
 * The server side of the play bridge: what used to be the old site's
 * /arcade/api/ endpoints, rebuilt on MIB-Hub's repositories.
 *
 * Every handler takes a `PlayCtx` (repos, viewer, switches, clock, cookies)
 * instead of importing the database, so the tests can run them against an
 * in-memory database. The API routes in src/pages/api/games/ are thin
 * wrappers that build the context and call these.
 *
 *   GET  me/                 the player's arcade profile (coins, XP, badges, shop)
 *   POST result/             a finished match or level: rewards + score
 *   POST sync/               results played offline, sent later in one batch
 *   POST buy/  equip/        the cosmetic shop
 *   POST privacy/            show or hide me on leaderboards
 *   POST hero/               check the secret character's code
 *   GET  sounds/<slug>/      replacement sounds uploaded by staff
 *   GET/POST <slug>/save     the cloud save (signed-in players)
 *   POST <slug>/cheat        which cheat a typed or dialled code unlocks
 *   POST <slug>/score        a score from a contract (TypeScript) game
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { CheatInfo, Game, HeroInfo, PlayerProfile, Repos } from "@mib/db";
import type { Viewer } from "../lib/guard.ts";
import type { Switches } from "../lib/site.ts";
import { isLegacyGame, isSaveKey } from "./legacy.ts";
import {
  Rejected,
  applyResult,
  asDict,
  badgeInfo,
  buyItem,
  cleanResult,
  equipItem,
  levelFor,
  readState,
  writeState,
} from "./progression.ts";

export interface PlayCtx {
  repos: Repos;
  viewer: Viewer;
  switches: Switches;
  /** Milliseconds since 1970. */
  now: number;
  /** Secret for signing the "hero unlocked" cookie. */
  secret: string;
  cookies: { get(name: string): string | undefined; set(name: string, value: string, maxAgeS: number): void };
  /** For rate limits: true when this caller has gone over `limit` calls in `windowMs`. */
  limited(key: string, limit: number, windowMs: number): boolean;
}

export interface Reply {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

const ok = (body: unknown, status = 200): Reply => ({ status, body });
const err = (error: string, status = 400): Reply => ({ status, body: { ok: false, error } });

export const SIGN_IN_TO_SAVE = "Sign in to save your scores and progress.";
/** Biggest cloud save accepted (Freshers School Life keeps small pictures in its slots). */
export const MAX_SAVE_BYTES = 1_500_000;
export const SYNC_MAX_ITEMS = 40;
export const HERO_TRIES = 8;
export const HERO_WINDOW_MS = 10 * 60_000;

/* ---------------------------------------------------------------- access */

export type GateResult = { ok: true; game: Game } | { ok: false; status: number; error: string };

/** May this viewer play (and report results for) this game right now? */
export function playGate(game: Game | undefined, viewer: Viewer, switches: Switches): GateResult {
  if (!game) return { ok: false, status: 404, error: "No such game." };
  const preview = viewer.permissions.has("games.preview");
  if ((!game.enabled || game.status === "hidden") && !preview) return { ok: false, status: 404, error: "No such game." };
  if (switches.maintenance && !viewer.permissions.has("admin.access")) {
    return { ok: false, status: 503, error: "The site is under maintenance. Please try again soon." };
  }
  if (!viewer.user && !switches.guestPlay) return { ok: false, status: 401, error: "Sign in to play." };
  return { ok: true, game };
}

/** Is a cheat's or hero's access rule met by this viewer? */
export function accessAllows(
  access: string | null | undefined,
  viewer: Viewer,
  allowedUserIds: readonly string[] = [],
): boolean {
  switch (access ?? "everyone") {
    case "everyone":
    case "code":
      return true;
    case "signed":
      return !!viewer.user;
    case "staff":
      return viewer.permissions.has("cheats.staff");
    case "named":
      return !!viewer.user && (allowedUserIds.includes(viewer.user.id) || viewer.permissions.has("cheats.staff"));
    default:
      return false;
  }
}

/* ------------------------------------------------------- page config */

export interface CheatsSettings {
  cheatsEnabled: boolean;
  heroEnabled: boolean;
  cheatsOnBoards: boolean;
  heroReveal: { name: string; combo: string; swipe: string; powers: string };
  rules: Record<string, unknown>;
}

/** Read a game's effective settings (see repos.gameSettings.effective) plus the site default. */
export function cheatsSettings(settings: Record<string, unknown>, siteCheatsOnBoards: unknown): CheatsSettings {
  const hr = (settings.heroReveal ?? {}) as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    cheatsEnabled: settings.cheatsEnabled !== false,
    heroEnabled: settings.heroEnabled !== false,
    cheatsOnBoards: typeof settings.cheatsOnBoards === "boolean" ? settings.cheatsOnBoards : siteCheatsOnBoards === true,
    heroReveal: { name: s(hr.name) || "M.I. BUGAJE", combo: s(hr.combo), swipe: s(hr.swipe), powers: s(hr.powers) },
    rules: settings.rules && typeof settings.rules === "object" ? (settings.rules as Record<string, unknown>) : {},
  };
}

type PageCode = Awaited<ReturnType<Repos["cheats"]["pageCodes"]>>[number];

/**
 * What the old runtime reads from the stage's data-gm-config attribute.
 * Plain codes never appear: only the old unsalted hashes, for cheats whose
 * code has not been changed (others are checked by the server, see cheat()).
 */
export function pageConfig(codes: PageCode[], cs: CheatsSettings, viewer: Viewer) {
  const byKey = new Map<string, { id: string; typed: string; dial: string }>();
  if (cs.cheatsEnabled) {
    for (const c of codes) {
      if (!accessAllows(c.access, viewer)) continue;
      const row = byKey.get(c.key) ?? { id: c.key, typed: "", dial: "" };
      const h = c.legacyHash ?? "";
      if (c.channel === "typed" || c.channel === "any") row.typed ||= h;
      if (c.channel === "dial" || c.channel === "any") row.dial ||= h;
      byKey.set(c.key, row);
    }
  }
  const cheats = [...byKey.values()];
  // An empty list makes the old runtime fall back to each game's built-in codes,
  // so "cheats off" (or none allowed) is sent as one entry that matches nothing.
  if (cheats.length === 0) cheats.push({ id: "-", typed: "", dial: "" });
  const heroOn = cs.heroEnabled;
  return {
    cheats,
    cheatsEnabled: cs.cheatsEnabled,
    cheatsOnBoards: cs.cheatsOnBoards,
    rules: cs.rules,
    hero: {
      enabled: heroOn,
      name: cs.heroReveal.name,
      combo: heroOn ? cs.heroReveal.combo : "",
      swipe: heroOn ? cs.heroReveal.swipe : "",
    },
  };
}

/* ------------------------------------------------------------ players */

async function profileOf(ctx: PlayCtx): Promise<PlayerProfile | null> {
  const u = ctx.viewer.user;
  if (!u) return null;
  return ctx.repos.profiles.getOrCreateForUser(u.id, u.name);
}

async function loadGameSettings(ctx: PlayCtx, slug: string): Promise<CheatsSettings> {
  const all = await ctx.repos.siteSettings.all();
  return cheatsSettings(await ctx.repos.gameSettings.effective(slug), all["games.cheatsOnLeaderboards"]);
}

/** Record one result for a profile; used by result/ and sync/. */
async function recordResult(ctx: PlayCtx, prof: PlayerProfile, data: Record<string, unknown>, nowS: number) {
  const r = cleanResult(data);
  const gate = playGate(await ctx.repos.games.getBySlug(r.game), ctx.viewer, ctx.switches);
  if (!gate.ok) throw new Rejected(gate.status === 404 ? "This game is switched off." : gate.error);
  const cs = await loadGameSettings(ctx, r.game);
  const out = applyResult(readState(prof.stats), prof.xp, r, { now: nowS, cheatsOnBoards: cs.cheatsOnBoards });
  await ctx.repos.profiles.update(prof.id, { stats: writeState(prof.stats, out.state) });
  const after = await ctx.repos.profiles.addRewards(prof.id, { coins: out.earnedCoins, xp: out.earnedXp });
  if (out.score !== null && ctx.viewer.permissions.has("scores.submit")) {
    await ctx.repos.scores.submit({
      profileId: prof.id,
      gameSlug: r.game,
      score: out.score,
      cheated: r.cheated,
      details: { stage: r.stage, result: r.result, mode: r.mode },
    });
  }
  return {
    ...asDict(out.state, after),
    earned_coins: out.earnedCoins,
    earned_xp: out.earnedXp,
    levelled_up: levelFor(after.xp) > levelFor(prof.xp),
    cheated: r.cheated,
    counted: out.counted,
    new_badges: out.newBadges.map(badgeInfo),
  };
}

/* ---------------------------------------------------- the old endpoints */

/**
 * Dispatch one call to the old runtime's API (data-gm-api + path).
 * `path` is what follows /api/games/arcade/, e.g. "me", "result", "sounds/wavefront".
 */
export async function arcadeCall(ctx: PlayCtx, method: string, path: string, body: Record<string, unknown>): Promise<Reply> {
  const parts = path.split("/").filter(Boolean);
  const what = parts[0] ?? "";
  try {
    if (what === "sounds" && method === "GET") return await sounds(ctx, parts[1] ?? "");
    if (what === "hero" && method === "POST") return await hero(ctx, body);
    if (what === "me" && method === "GET") {
      const prof = await profileOf(ctx);
      if (!prof) return err(SIGN_IN_TO_SAVE, 401);
      return ok(asDict(readState(prof.stats), prof));
    }
    if (method !== "POST") return err("Not found.", 404);
    if (what === "room") return err("Wi-Fi play is not available on this site.", 404);
    const prof = await profileOf(ctx);
    if (!prof) return err(SIGN_IN_TO_SAVE, 401);
    if (!ctx.viewer.permissions.has("progress.save")) return err("Your account cannot save progress.", 403);
    switch (what) {
      case "result":
        if (ctx.limited(`result:${prof.id}`, 30, 60_000)) return err("Too many results. Slow down a little.", 429);
        return ok(await recordResult(ctx, prof, body, Math.floor(ctx.now / 1000)));
      case "sync":
        return ok(await sync(ctx, prof, body));
      case "buy": {
        const { state, price } = buyItem(readState(prof.stats), prof.coins, String(body.item ?? ""));
        await ctx.repos.profiles.update(prof.id, { stats: writeState(prof.stats, state) });
        return ok(asDict(state, await ctx.repos.profiles.addRewards(prof.id, { coins: -price })));
      }
      case "equip": {
        const state = equipItem(readState(prof.stats), String(body.item ?? ""));
        const p = (await ctx.repos.profiles.update(prof.id, { stats: writeState(prof.stats, state) })) ?? prof;
        return ok(asDict(state, p));
      }
      case "privacy": {
        const p = (await ctx.repos.profiles.update(prof.id, { onLeaderboard: Boolean(body.on_leaderboard) })) ?? prof;
        return ok(asDict(readState(p.stats), p));
      }
      default:
        return err("Not found.", 404);
    }
  } catch (e) {
    if (e instanceof Rejected) return err(e.message, 400);
    throw e;
  }
}

/** Results played offline: { items: [{ cid, kind: "result", at, data }] }. Each item is counted once. */
async function sync(ctx: PlayCtx, prof: PlayerProfile, body: Record<string, unknown>) {
  const items = Array.isArray(body.items) ? body.items.slice(0, SYNC_MAX_ITEMS) : null;
  if (!items) throw new Rejected("Bad JSON.");
  const nowS = Math.floor(ctx.now / 1000);
  const done: string[] = [];
  const rejected: { cid: string; error: string }[] = [];
  const clean = items
    .filter((it): it is Record<string, unknown> => !!it && typeof it === "object")
    .map((it) => {
      const cid = String(it.cid ?? "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
      const at = Number(it.at) / 1000;
      const when = Number.isFinite(at) && at >= nowS - 14 * 86400 && at <= nowS + 60 ? Math.min(at, nowS) : nowS;
      return { cid, at: Math.floor(when), it };
    })
    .filter((x) => x.cid.length >= 8)
    .sort((a, b) => a.at - b.at);
  let current = prof;
  for (const { cid, at, it } of clean) {
    if (ctx.limited(`sync-seen:${prof.id}:${cid}`, 1, 30 * 86400_000)) {
      done.push(cid); // already counted
      continue;
    }
    try {
      if (it.kind !== "result") throw new Rejected("Unknown item.");
      const data = it.data && typeof it.data === "object" ? (it.data as Record<string, unknown>) : {};
      await recordResult(ctx, current, data, at);
      current = (await ctx.repos.profiles.getForUser(ctx.viewer.user!.id)) ?? current;
      done.push(cid);
    } catch (e) {
      if (!(e instanceof Rejected)) throw e;
      rejected.push({ cid, error: e.message });
    }
  }
  return { done, rejected, me: asDict(readState(current.stats), current) };
}

/* ------------------------------------------------------------- hero */

export function heroToken(secret: string, slug: string, who: string): string {
  return createHmac("sha256", secret).update(`hero:${slug}:${who}`).digest("hex");
}

function sameToken(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const heroCookie = (slug: string) => `mib_hero_${slug.replace(/[^a-z0-9-]/g, "")}`;

/**
 * { slug, code } checks a code; { slug, check: true } asks "is this device
 * still unlocked?" (a signed cookie set after the last correct code).
 */
async function hero(ctx: PlayCtx, body: Record<string, unknown>): Promise<Reply> {
  const slug = String(body.slug ?? "").slice(0, 80);
  const gate = playGate(await ctx.repos.games.getBySlug(slug), ctx.viewer, ctx.switches);
  if (!gate.ok) return err("This game is not open to you.", 400);
  const cs = await loadGameSettings(ctx, slug);
  if (!cs.heroEnabled) return ok({ ok: false });
  const who = ctx.viewer.user?.id ?? "guest";
  if (body.check === true) {
    const c = ctx.cookies.get(heroCookie(slug)) ?? "";
    return ok({ ok: !!c && sameToken(c, heroToken(ctx.secret, slug, who)) });
  }
  const tryKey = `hero:${slug}:${who}`;
  if (ctx.limited(tryKey, HERO_TRIES, HERO_WINDOW_MS)) return ok({ ok: false, wait: true, error: "Too many tries. Wait ten minutes." });
  const found: HeroInfo | null = await ctx.repos.heroes.verify(slug, String(body.code ?? "").slice(0, 80));
  if (!found || !accessAllows(found.access, ctx.viewer, found.allowedUserIds)) return ok({ ok: false });
  ctx.cookies.set(heroCookie(slug), heroToken(ctx.secret, slug, who), 365 * 86400);
  return ok({ ok: true, name: found.name });
}

/* ------------------------------------------------------------ cheats */

/** POST <slug>/cheat { code, channel }: the cheat id, or null. */
export async function cheat(ctx: PlayCtx, slug: string, body: Record<string, unknown>): Promise<Reply> {
  const gate = playGate(await ctx.repos.games.getBySlug(slug), ctx.viewer, ctx.switches);
  if (!gate.ok) return err(gate.error, gate.status);
  const cs = await loadGameSettings(ctx, slug);
  if (!cs.cheatsEnabled) return ok({ ok: true, key: null });
  const who = ctx.viewer.user?.id ?? "guest";
  if (ctx.limited(`cheat:${slug}:${who}`, 30, 60_000)) return err("Too many tries. Wait a minute.", 429);
  const channel = body.channel === "dial" ? "dial" : "typed";
  const code = String(body.code ?? "").slice(0, 40);
  const found: CheatInfo | null = code.replace(/\s+/g, "").length >= 4 ? await ctx.repos.cheats.match(slug, code, channel) : null;
  if (!found || !accessAllows(found.access, ctx.viewer)) return ok({ ok: true, key: null });
  return ok({ ok: true, key: found.key, effect: found.effect });
}

/* -------------------------------------------------------------- saves */

/** The cloud save of a legacy game: the game's own localStorage keys. */
export function cleanLegacySave(slug: string, data: unknown): { keys: Record<string, string>; at: number } {
  const d = (data ?? {}) as Record<string, unknown>;
  const keys: Record<string, string> = {};
  if (d.keys && typeof d.keys === "object") {
    for (const [k, v] of Object.entries(d.keys as Record<string, unknown>)) {
      if (typeof v === "string" && isSaveKey(slug, k)) keys[k] = v;
    }
  }
  const at = Number(d.at);
  return { keys, at: Number.isFinite(at) && at > 0 ? Math.trunc(at) : 0 };
}

const SLOT_RE = /^(auto|[1-5])$/;

/** GET <slug>/save?slot= */
export async function loadSave(ctx: PlayCtx, slug: string, slot = "auto"): Promise<Reply> {
  const gate = playGate(await ctx.repos.games.getBySlug(slug), ctx.viewer, ctx.switches);
  if (!gate.ok) return err(gate.error, gate.status);
  if (!SLOT_RE.test(slot)) return err("Unknown save slot.");
  const prof = await profileOf(ctx);
  if (!prof) return err(SIGN_IN_TO_SAVE, 401);
  const row = await ctx.repos.progress.load(prof.id, slug, slot as "auto");
  return ok({
    ok: true,
    save: row ? { data: row.data, saveVersion: row.saveVersion, summary: row.summary, updatedAt: row.updatedAt } : null,
  });
}

/** POST <slug>/save { slot?, data, saveVersion?, summary? } */
export async function storeSave(ctx: PlayCtx, slug: string, body: Record<string, unknown>, rawBytes: number): Promise<Reply> {
  const gate = playGate(await ctx.repos.games.getBySlug(slug), ctx.viewer, ctx.switches);
  if (!gate.ok) return err(gate.error, gate.status);
  if (rawBytes > MAX_SAVE_BYTES) return err("This save is too big to keep online.", 413);
  const prof = await profileOf(ctx);
  if (!prof) return err(SIGN_IN_TO_SAVE, 401);
  if (!ctx.viewer.permissions.has("progress.save")) return err("Your account cannot save progress.", 403);
  if (ctx.limited(`save:${prof.id}`, 30, 60_000)) return err("Saving too often. Wait a moment.", 429);
  const slot = String(body.slot ?? "auto");
  if (!SLOT_RE.test(slot)) return err("Unknown save slot.");
  let data: Record<string, unknown>;
  if (isLegacyGame(slug)) data = cleanLegacySave(slug, body.data);
  else if (body.data && typeof body.data === "object" && !Array.isArray(body.data)) data = body.data as Record<string, unknown>;
  else return err("Nothing to save.");
  const sv = Number(body.saveVersion);
  const row = await ctx.repos.progress.save({
    profileId: prof.id,
    gameSlug: slug,
    slot: slot as "auto",
    data,
    saveVersion: Number.isInteger(sv) && sv > 0 ? sv : 1,
    summary: String(body.summary ?? "").slice(0, 120),
  });
  return ok({ ok: true, updatedAt: row.updatedAt });
}

/* ------------------------------------------------------------- scores */

/** POST <slug>/score { score, cheated?, details? } (contract games; legacy games use result/). */
export async function submitScore(ctx: PlayCtx, slug: string, body: Record<string, unknown>): Promise<Reply> {
  const gate = playGate(await ctx.repos.games.getBySlug(slug), ctx.viewer, ctx.switches);
  if (!gate.ok) return err(gate.error, gate.status);
  const prof = await profileOf(ctx);
  if (!prof) return err(SIGN_IN_TO_SAVE, 401);
  if (!ctx.viewer.permissions.has("scores.submit")) return err("Your account cannot submit scores.", 403);
  if (ctx.limited(`score:${prof.id}:${slug}`, 10, 60_000)) return err("Too many scores. Slow down a little.", 429);
  const score = Number(body.score);
  if (!Number.isFinite(score) || score < 0) return err("A score must be a number of 0 or more.");
  const details = body.details && typeof body.details === "object" ? (body.details as Record<string, unknown>) : {};
  const row = await ctx.repos.scores.submit({
    profileId: prof.id,
    gameSlug: slug,
    score: Math.min(1_000_000_000, score),
    cheated: Boolean(body.cheated),
    details,
  });
  return ok({ ok: true, id: row.id, best: await ctx.repos.scores.bestFor(prof.id, slug) });
}

/* ------------------------------------------------------------- sounds */

/** GET sounds/<slug>/: staff-uploaded replacement sounds every player hears. */
async function sounds(ctx: PlayCtx, slug: string): Promise<Reply> {
  if (!slug) return err("Not found.", 404);
  const rows = await ctx.repos.sounds.list(slug);
  return ok({
    can_global: false,
    sounds: rows.map((s) => ({
      name: s.name,
      v: s.version,
      type: s.contentType,
      size: s.size,
      at: s.updatedAt,
      url: `/api/games/arcade/sounds/${encodeURIComponent(slug)}/file/${encodeURIComponent(s.name)}?v=${s.version}`,
    })),
  });
}
