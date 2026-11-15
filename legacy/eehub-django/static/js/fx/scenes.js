/* EE Hub visual themes — scene host (ES module, loaded only when a page has a scene).

   Markup:  <div class="fx-scene" data-fx-scene="galaxy" data-fx-palette="brand"
                 data-fx-a="#e6c867" data-fx-b="#38e1f5"></div>
   The host adds a <canvas>, imports the scene on demand, and runs it only while
   it is on screen, the tab is visible, motion is allowed and the visitor has not
   pressed "Pause motion". Reduced motion (device or Settings → Appearance) shows
   one still frame; motion "off" never mounts a scene (the CSS fallback stays). */

import { palette } from "./gl.js";

const LOADERS = {
  electric_field: () => import("./scenes/electric_field.js"),
  waves: () => import("./scenes/waves.js"),
  black_hole: () => import("./scenes/black_hole.js"),
  galaxy: () => import("./scenes/galaxy.js"),
  fluid: () => import("./scenes/fluid_host.js"),
  particles: () => import("./particle-field/mount.js"),
};
export const SCENES = Object.keys(LOADERS);

const body = document.body;
const mq = (q) => !!(window.matchMedia && window.matchMedia(q).matches);
const prefersReduce = () => mq("(prefers-reduced-motion: reduce)") || document.documentElement.getAttribute("data-motion") === "reduce";
const isPhone = () => mq("(max-width: 700px)") || (mq("(pointer: coarse)") && Math.min(screen.width, screen.height) < 820);

function motionSetting() {
  return (body && body.getAttribute("data-fx-motion")) || "full";
}
function calm() { return body.classList.contains("is-calm") || document.documentElement.classList.contains("theme-switching"); }

const hosts = [];

async function mountHost(host) {
  if (host.__fx) return;
  const kind = host.getAttribute("data-fx-scene");
  const load = LOADERS[kind];
  const motion = host.getAttribute("data-fx-motion") || motionSetting();
  if (!load || motion === "off") return;
  host.__fx = { state: "loading" };

  const canvas = document.createElement("canvas");
  canvas.className = "fx-canvas";
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);

  const phone = isPhone();
  const opts = {
    phone,
    motion: prefersReduce() ? "still" : motion,       // full | reduced | still
    palette: palette(host.getAttribute("data-fx-palette") || "brand",
                     host.getAttribute("data-fx-a"), host.getAttribute("data-fx-b")),
    quality: host.getAttribute("data-fx-quality") || (phone ? "low" : "high"),
    host,
  };
  const dprCap = phone ? 1.5 : 2;
  let scene;
  try {
    const mod = await load();
    scene = await (mod.create || mod.default)(canvas, opts);
  } catch (err) {
    host.classList.add("is-failed");
    canvas.remove();
    if (window.console) console.info("[fx] scene '" + kind + "' unavailable:", err && err.message ? err.message : err);
    return;
  }
  const st = host.__fx = { scene, canvas, visible: false, running: false, kind, opts };

  const size = () => {
    const r = host.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    scene.resize(r.width, r.height, Math.min(window.devicePixelRatio || 1, dprCap));
  };
  size();
  if ("ResizeObserver" in window) new ResizeObserver(size).observe(host);
  else window.addEventListener("resize", size);

  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      st.visible = entries[entries.length - 1].isIntersecting;
      sync(st);
    }, { rootMargin: "80px 0px" }).observe(host);
  } else st.visible = true;

  hosts.push(st);
  sync(st);
  // fade in once the first frames are on screen
  requestAnimationFrame(() => requestAnimationFrame(() => host.classList.add("is-ready")));
}

function sync(st) {
  const still = st.opts.motion === "still";
  const want = st.visible && !document.hidden && !calm() && !still;
  if (want && !st.running) { st.scene.start(); st.running = true; }
  else if (!want && st.running) { st.scene.stop(); st.running = false; }
  if (still && st.visible && !st.drewStill) {
    st.drewStill = true;
    // a short run settles stateful scenes (fluid, particles) into a pleasant still
    st.scene.start();
    setTimeout(() => { st.scene.stop(); }, st.kind === "particles" ? 3200 : st.kind === "fluid" ? 900 : 120);
  }
}

function syncAll() { hosts.forEach(sync); }
document.addEventListener("visibilitychange", syncAll);
if ("MutationObserver" in window && body) {
  new MutationObserver(syncAll).observe(body, { attributes: true, attributeFilter: ["class"] });
  new MutationObserver(syncAll).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
}

export function mountAll(root) {
  (root || document).querySelectorAll("[data-fx-scene]").forEach((h) => { mountHost(h); });
}

// Start after first paint so the scene never delays the page.
const go = () => mountAll();
if (document.readyState === "complete") setTimeout(go, 30);
else window.addEventListener("load", () => setTimeout(go, 30));

window.EEFx = Object.assign(window.EEFx || {}, { mountAll, SCENES });
