/* Host adapter for the fluid engine (fx/fluid.js): brand palette in, start/stop out. */
import { fluidSimulation } from "../fluid.js";
import { hexToRgb } from "../gl.js";

// Ink needs saturated colours (the engine multiplies them up to 10x): keep each
// brand colour's hue, push saturation/value to the engine's original 0.95 / 1.0.
function inky(hex) {
  const [r, g, b] = hexToRgb(hex);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 1e-6) {
    if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h /= 6; if (h < 0) h += 1;
  }
  const s = 0.95, v = 1, i = Math.floor(h * 6), f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
}

export function create(canvas, opts) {
  const pal = opts.palette;
  const bg = hexToRgb(pal.bg);
  // the engine sizes itself from the canvas's CSS box every frame
  const sim = fluidSimulation(canvas, {
    phone: opts.phone,
    // only the palette's two hues (a third hue mixes towards white)
    palette: [inky(pal.a), inky(pal.b), inky(pal.b)],
    // calmer than the supplied tuning: a soft entrance and a gentler auto-cursor,
    // ink capped below white and re-saturated where colours overlap
    burst: opts.phone ? 8 : 12, waves: 3, burstGain: 3.5, cursorGain: 1.5,
    inkLimit: 0.6, inkSaturation: 1.35,
    backColor: { r: Math.round(bg[0] * 255), g: Math.round(bg[1] * 255), b: Math.round(bg[2] * 255) },
  });
  sim.pause();
  return {
    start() { sim.resume(); },
    stop() { sim.pause(); },
    resize() {},
    destroy() { sim(); },
  };
}

export default create;
