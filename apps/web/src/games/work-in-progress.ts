/**
 * Work in Progress: the new open-world campus game (PlayCanvas).
 *
 * The game is built separately (games/work-in-progress, `npm run build:wip`)
 * into static files under public/play-files/work-in-progress/ (not
 * public/play/work-in-progress/: a static folder at the same path as the play
 * page would shadow the page on Cloudflare). This module shows
 * it inside the play page in an iframe, so its engine and assets load only
 * when someone opens the game, and reports plays to the site's tracker.
 *
 * Full screen: GameHost and mib-full.js make the iframe's container go full
 * screen (a "Play" cover first, an X to leave, "Resume" to go back). Inside
 * the game, a tap on Play / Continue / New game / Resume also asks for full
 * screen: the frame is same-origin, so this module listens to those taps, and
 * the game may also send `parent.postMessage({ type: "mib:fullscreen" })`.
 * When the player leaves full screen the game is sent `{ type: "mib:pause" }`,
 * and `{ type: "mib:resume" }` when they come back.
 */
import type { GameModule } from "./contract.ts";
import { fullScreen } from "./fullscreen.ts";

export const WIP_URL = "/play-files/work-in-progress/index.html";

/** Labels of the in-game buttons that start or resume play (they enter full screen on the same tap). */
export const WIP_START = /^\s*(play|continue|new game|resume|start|begin)\b/i;

function sessionId(): string {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

function track(slug: string, kind: "start" | "end", session: string, extra: Record<string, unknown> = {}): void {
  const body = JSON.stringify({ gameSlug: slug, kind, sessionId: session, ...extra });
  try {
    if (kind === "end" && navigator.sendBeacon) navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
    else void fetch("/api/track", { method: "POST", credentials: "same-origin", keepalive: true, headers: { "Content-Type": "application/json" }, body }).catch(() => undefined);
  } catch {
    /* tracking is best effort */
  }
}

const game: GameModule = {
  mount(container, ctx) {
    const session = sessionId();
    const started = Date.now();
    const frame = document.createElement("iframe");
    frame.src = WIP_URL;
    frame.title = "Work in Progress";
    frame.allow = "fullscreen; autoplay";
    frame.setAttribute("allowfullscreen", "");
    frame.style.cssText = "position:absolute;inset:0;width:100%;height:100%;border:0;display:block;background:#0d1014";
    // Add our own layer: React owns the container's other children (its "Loading…" text), so never remove them.
    const layer = document.createElement("div");
    layer.style.cssText = "position:absolute;inset:0;z-index:1";
    layer.append(frame);
    container.append(layer);
    const send = (type: string) => {
      try {
        frame.contentWindow?.postMessage({ type }, location.origin);
      } catch {
        /* the frame is gone */
      }
    };
    /** A tap inside the game on a Play / Continue / Resume button: go full screen on that same tap. */
    const onFrameTap = (e: Event) => {
      const full = fullScreen();
      if (!full || full.active()) return;
      const b = (e.target as Element | null)?.closest?.("button, [role=button], a");
      if (b && WIP_START.test(b.textContent ?? "")) full.enter();
    };
    frame.addEventListener("load", () => {
      frame.focus();
      try {
        frame.contentDocument?.addEventListener("click", onFrameTap, true);
      } catch {
        /* not same-origin (should not happen): the game can still post "mib:fullscreen" */
      }
    });
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.contentWindow || e.origin !== location.origin) return;
      const type = (e.data as { type?: unknown } | null)?.type;
      if (type === "mib:fullscreen" && !fullScreen()?.active()) fullScreen()?.enter();
    };
    window.addEventListener("message", onMessage);
    track(ctx.slug, "start", session, { meta: { signedIn: !!ctx.player } });
    const end = () => track(ctx.slug, "end", session, { durationMs: Date.now() - started });
    window.addEventListener("pagehide", end, { once: true });
    return {
      unmount() {
        window.removeEventListener("pagehide", end);
        window.removeEventListener("message", onMessage);
        end();
        layer.remove();
      },
      pause: () => send("mib:pause"),
      resume: () => {
        send("mib:resume");
        frame.focus();
      },
    };
  },
};

export const mount = game.mount;
export default game;
