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

/**
 * The browser side of the platform services.
 * TODO(games-port): build the matching API routes under src/pages/api/games/[slug]/
 * (progress, score, cheat, hero) using repos.progress / scores / cheats / heroes,
 * each protected with guardApi(). Until then these calls reject.
 */
function browserPlatform(slug: string): GamePlatform {
  const notYet = (what: string) => Promise.reject(new Error(`${what} is not built yet (game "${slug}").`));
  return {
    saveProgress: () => notYet("saveProgress"),
    loadProgress: () => notYet("loadProgress"),
    submitScore: () => notYet("submitScore"),
    checkCheat: () => notYet("checkCheat"),
    checkHero: () => notYet("checkHero"),
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
