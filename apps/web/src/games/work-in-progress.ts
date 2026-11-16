/**
 * Work in Progress: the new open-world campus game (PlayCanvas).
 *
 * The game is built separately (games/work-in-progress, `npm run build:wip`)
 * into static files under public/play-files/work-in-progress/ (not
 * public/play/work-in-progress/: a static folder at the same path as the play
 * page would shadow the page on Cloudflare). This module shows
 * it inside the play page in an iframe, so its engine and assets load only
 * when someone opens the game, and reports plays to the site's tracker.
 */
import type { GameModule } from "./contract.ts";

export const WIP_URL = "/play-files/work-in-progress/index.html";

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
    const full = document.createElement("button");
    full.type = "button";
    full.textContent = "Full screen";
    full.style.cssText = "position:absolute;right:12px;bottom:12px;z-index:2;padding:6px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.35);background:rgba(0,0,0,.45);color:#fff;font:600 13px system-ui,sans-serif;cursor:pointer";
    full.onclick = () => {
      const p = document.fullscreenElement ? document.exitFullscreen() : container.requestFullscreen?.();
      p?.catch(() => undefined);
    };
    // Add our own layer: React owns the container's other children (its "Loading…" text), so never remove them.
    const layer = document.createElement("div");
    layer.style.cssText = "position:absolute;inset:0;z-index:1";
    layer.append(frame, full);
    container.append(layer);
    frame.addEventListener("load", () => frame.focus(), { once: true });
    track(ctx.slug, "start", session, { meta: { signedIn: !!ctx.player } });
    const end = () => track(ctx.slug, "end", session, { durationMs: Date.now() - started });
    window.addEventListener("pagehide", end, { once: true });
    return {
      unmount() {
        window.removeEventListener("pagehide", end);
        end();
        layer.remove();
      },
    };
  },
};

export const mount = game.mount;
export default game;
