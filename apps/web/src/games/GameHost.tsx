/**
 * GameHost: the React island on /play/[slug] that loads and mounts a game.
 *
 *   <GameHost client:only="react" slug=... entry=... assetsPath=... settings=... player=... />
 *
 * It looks up `entry` in the registry, imports the game only now (in the
 * browser), and calls mount() inside a sized container. It unmounts the game
 * when the page goes away.
 *
 * Full screen: the shared window.MIBFull (public/play/_shared/mib/mib-full.js,
 * loaded by the play page) puts a "Play" cover on the stage, enters full
 * screen on that tap, and pauses the game (handle.pause) with a "Resume"
 * cover when the player leaves full screen. The game also pauses while the
 * tab is hidden.
 */
import { useEffect, useRef, useState } from "react";
import type { GameContext, GameHandle, GamePlatform, GamePlayer } from "./contract.ts";
import { fullScreen } from "./fullscreen.ts";
import { gameRegistry, hasGame } from "./registry.ts";

interface Props {
  slug: string;
  /** Shown on the "Play" cover. */
  title?: string;
  icon?: string;
  entry: string;
  assetsPath: string;
  settings: Record<string, unknown>;
  player: GamePlayer | null;
}

/** POST JSON to a site API and return the reply (throws with the server's message on failure). */
async function call(url: string, body?: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: body === undefined ? null : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : `Request failed (${res.status}).`);
  return json;
}

/**
 * The offline outbox (public/offline/mib-sync.js, on the play page as
 * window.MIBSync). Saves and scores that cannot reach the server wait there
 * and are sent later (Background Sync, or when the connection returns), with
 * an id so a score is counted once. Absent: offline calls simply fail.
 */
interface OfflineOutbox {
  outbox(): { put(item: unknown): Promise<void>; all(): Promise<Array<Record<string, unknown>>> };
  saveItem(o: Record<string, unknown>): { id: string; body: { data: unknown; saveVersion: number } };
  scoreItem(o: Record<string, unknown>): unknown;
}
const offline = (): OfflineOutbox | null => (typeof window !== "undefined" ? ((window as { MIBSync?: OfflineOutbox }).MIBSync ?? null) : null);
/** True when a request failed because there is no network (not because the server said no). */
const isNetworkError = (e: unknown) => e instanceof TypeError || (typeof navigator !== "undefined" && navigator.onLine === false);
async function queue(item: unknown): Promise<void> {
  await offline()!.outbox().put(item);
  const reg = await navigator.serviceWorker?.getRegistration?.().catch(() => undefined);
  await (reg as { sync?: { register(tag: string): Promise<void> } } | undefined)?.sync?.register("mib-outbox").catch(() => undefined);
}

/**
 * The browser side of the platform services, backed by the API routes in
 * src/pages/api/games/ (save, score, cheat) and /api/games/arcade/hero/.
 * With no network, saves and scores go to the offline outbox (see above).
 */
function browserPlatform(slug: string, owner: string): GamePlatform {
  const base = `/api/games/${encodeURIComponent(slug)}`;
  const versions = new Map<string, number>(); // slot -> the cloud version last seen (sent as `base`)
  return {
    async saveProgress(slot, data, opts) {
      const body = { slot, data, saveVersion: opts?.saveVersion, summary: opts?.summary };
      try {
        const r = await call(`${base}/save`, body);
        if (typeof r.version === "number") versions.set(slot, r.version);
      } catch (e) {
        if (!offline() || owner === "guest" || !isNetworkError(e)) throw e;
        await queue(offline()!.saveItem({ slug, owner, slot, data, summary: opts?.summary, saveVersion: opts?.saveVersion, base: versions.get(slot) ?? 0, at: Date.now() }));
      }
    },
    async loadProgress(slot) {
      try {
        const r = await call(`${base}/save?slot=${encodeURIComponent(slot)}`);
        const save = r.save as { data: unknown; saveVersion: number; version?: number } | null;
        if (save?.version) versions.set(slot, save.version);
        return save ? { data: save.data, saveVersion: save.saveVersion } : null;
      } catch (e) {
        if (!offline() || !isNetworkError(e)) throw e;
        // Offline: the newest save still waiting to be sent, if any.
        const id = offline()!.saveItem({ slug, owner, slot }).id;
        const waiting = (await offline()!.outbox().all()).find((i) => i.id === id) as { body?: { data: unknown; saveVersion: number } } | undefined;
        return waiting?.body ? { data: waiting.body.data, saveVersion: waiting.body.saveVersion } : null;
      }
    },
    async submitScore(score, opts) {
      const body = { score, cheated: opts?.cheated ?? false, details: opts?.details ?? {} };
      try {
        await call(`${base}/score`, body);
      } catch (e) {
        if (!offline() || owner === "guest" || !isNetworkError(e)) throw e;
        await queue(offline()!.scoreItem({ slug, owner, ...body, at: Date.now() }));
      }
    },
    async checkCheat(code, channel) {
      const r = await call(`${base}/cheat`, { code, channel });
      return typeof r.key === "string" ? { key: r.key, effect: (r.effect as Record<string, unknown>) ?? {} } : null;
    },
    async checkHero(code) {
      const r = await call("/api/games/arcade/hero/", { slug, code });
      return r.ok === true && typeof r.name === "string" ? { name: r.name, details: {} } : null;
    },
  };
}

export default function GameHost({ slug, title, icon, entry, assetsPath, settings, player }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "running" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!box.current || !hasGame(entry)) return;
    const controller = new AbortController();
    let handle: GameHandle | null = null;
    const owner = player ? `u${player.id}` : "guest";
    const ctx: GameContext = { slug, assetsPath, settings, player, platform: browserPlatform(slug, owner), signal: controller.signal };

    gameRegistry[entry]!()
      .then((mod) => mod.mount(box.current!, ctx))
      .then((h) => {
        if (controller.signal.aborted) h.unmount();
        else {
          handle = h;
          setState("running");
          const full = fullScreen();
          if (full && box.current) {
            full.attach(box.current, {
              title,
              icon,
              landscape: true,
              pause: () => {
                handle?.pause?.();
                return true;
              },
              resume: () => handle?.resume?.(),
            });
            full.cover("play");
          }
        }
      })
      .catch((err: unknown) => {
        setState("error");
        setMessage(err instanceof Error ? err.message : String(err));
      });

    // Pause while the tab is hidden; carry on when it is back (unless the Resume cover is waiting for a tap).
    const onVisibility = () => {
      if (document.hidden) handle?.pause?.();
      else if (!fullScreen()?.coverOpen()) handle?.resume?.();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      controller.abort();
      handle?.unmount();
    };
  }, [slug, title, icon, entry, assetsPath, settings, player]);

  if (!hasGame(entry)) return null;
  return (
    <div className="play-stage" ref={box} data-state={state} aria-busy={state === "loading"}>
      {state === "loading" && <p>Loading…</p>}
      {state === "error" && <p role="alert">This game could not start: {message}</p>}
    </div>
  );
}
