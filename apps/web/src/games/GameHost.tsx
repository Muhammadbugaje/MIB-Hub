/**
 * GameHost: the React island on /play/[slug] that loads and mounts a game.
 *
 *   <GameHost client:only="react" slug=... entry=... assetsPath=... settings=... player=... />
 *
 * It looks up `entry` in the registry, imports the game only now (in the
 * browser), and calls mount() inside a sized container. It unmounts the game
 * when the page goes away.
 */
import { useEffect, useRef, useState } from "react";
import type { GameContext, GameHandle, GamePlatform, GamePlayer } from "./contract.ts";
import { gameRegistry, hasGame } from "./registry.ts";

interface Props {
  slug: string;
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
 * The browser side of the platform services, backed by the API routes in
 * src/pages/api/games/ (save, score, cheat) and /api/games/arcade/hero/.
 */
function browserPlatform(slug: string): GamePlatform {
  const base = `/api/games/${encodeURIComponent(slug)}`;
  return {
    async saveProgress(slot, data, opts) {
      await call(`${base}/save`, { slot, data, saveVersion: opts?.saveVersion, summary: opts?.summary });
    },
    async loadProgress(slot) {
      const r = await call(`${base}/save?slot=${encodeURIComponent(slot)}`);
      const save = r.save as { data: unknown; saveVersion: number } | null;
      return save ? { data: save.data, saveVersion: save.saveVersion } : null;
    },
    async submitScore(score, opts) {
      await call(`${base}/score`, { score, cheated: opts?.cheated ?? false, details: opts?.details ?? {} });
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

export default function GameHost({ slug, entry, assetsPath, settings, player }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "running" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!box.current || !hasGame(entry)) return;
    const controller = new AbortController();
    let handle: GameHandle | null = null;
    const ctx: GameContext = { slug, assetsPath, settings, player, platform: browserPlatform(slug), signal: controller.signal };

    gameRegistry[entry]!()
      .then((mod) => mod.mount(box.current!, ctx))
      .then((h) => {
        if (controller.signal.aborted) h.unmount();
        else {
          handle = h;
          setState("running");
        }
      })
      .catch((err: unknown) => {
        setState("error");
        setMessage(err instanceof Error ? err.message : String(err));
      });

    return () => {
      controller.abort();
      handle?.unmount();
    };
  }, [slug, entry, assetsPath, settings, player]);

  if (!hasGame(entry)) return null;
  return (
    <div className="play-stage" ref={box} data-state={state} aria-busy={state === "loading"}>
      {state === "loading" && <p>Loading…</p>}
      {state === "error" && <p role="alert">This game could not start: {message}</p>}
    </div>
  );
}
