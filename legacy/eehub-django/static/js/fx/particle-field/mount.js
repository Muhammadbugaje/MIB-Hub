/* Host adapter for the Particle Field engine (the Layers "Coral" form).
   Follows the export's host: gather-in on first show, frame-height point scale,
   DPR capped (2 desktop, 1.5 phones), and far fewer particles on phones. */
import { ParticleStudio } from "./engine.js";

// Exact inputs of the export (form + settings); colours follow the site's palette.
const FORM = { kind: "coral", seed: 373644540 };
const SETTINGS = {
  count: 250000, size: 1.95, speed: 0.45, opacity: 0.7,
  bloomStrength: 0.75, bloomRadius: 0.08, bloomThreshold: 0.21,
  colorA: "#25b8ff", colorB: "#b04dff", autorotate: false,
};

export function create(canvas, opts) {
  const settings = Object.assign({}, SETTINGS);
  if (opts.phone) settings.count = 60000;
  else if (opts.quality === "medium") settings.count = 140000;
  if (opts.palette && opts.palette.name !== "electric") {
    settings.colorA = opts.palette.b;   // cool end
    settings.colorB = opts.palette.a;   // warm end
  }
  if (opts.motion === "reduced") settings.speed = Math.min(settings.speed, 0.12);
  const studio = new ParticleStudio(canvas, settings);
  studio.showForm(FORM.kind, FORM.seed, "gather");
  let raf = 0, last = 0;
  const tick = (now) => {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    studio.renderFrame(dt);
  };
  return {
    start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } },
    stop() { if (raf) cancelAnimationFrame(raf); raf = 0; },
    resize(w, h, dpr) {
      studio.resize(w, h, dpr);
      // portrait screens: lift the form into the open space above the hero copy
      const cam = studio.camera;
      if (cam && h > w * 1.2) cam.setViewOffset(w, h, 0, h * 0.2, w, h);
      else if (cam && cam.view && cam.view.enabled) cam.clearViewOffset();
      if (!raf) studio.renderFrame(0);
    },
    destroy() { this.stop(); studio.dispose(); },
  };
}

export default create;
