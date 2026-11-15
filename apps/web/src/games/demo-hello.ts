/**
 * The smallest possible game: proves the loader contract works. It draws a
 * bouncing dot on a canvas and stops when the player leaves the page.
 * Copy this file as a starting point; delete it once real games are ported.
 */
import type { GameModule } from "./contract.ts";

const game: GameModule = {
  mount(container, ctx) {
    const canvas = document.createElement("canvas");
    canvas.width = container.clientWidth || 640;
    canvas.height = container.clientHeight || 360;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    container.append(canvas);
    const g = canvas.getContext("2d")!;
    let x = 40;
    let y = 40;
    let dx = 3;
    let dy = 2;
    let frame = 0;
    let paused = false;

    function tick() {
      if (ctx.signal.aborted) return;
      if (!paused) {
        x += dx;
        y += dy;
        if (x < 12 || x > canvas.width - 12) dx = -dx;
        if (y < 12 || y > canvas.height - 12) dy = -dy;
        g.clearRect(0, 0, canvas.width, canvas.height);
        g.fillStyle = "#d9be6e";
        g.beginPath();
        g.arc(x, y, 12, 0, Math.PI * 2);
        g.fill();
      }
      frame = requestAnimationFrame(tick);
    }
    tick();

    return {
      unmount() {
        cancelAnimationFrame(frame);
        canvas.remove();
      },
      pause: () => void (paused = true),
      resume: () => void (paused = false),
    };
  },
};

export const mount = game.mount;
export default game;
