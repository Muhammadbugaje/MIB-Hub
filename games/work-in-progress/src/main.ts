/**
 * Work in Progress: the new open-world campus game (PlayCanvas).
 *
 * Boot order: canvas and engine -> procedural textures and materials -> the
 * static town (ground, roads, buildings, props) -> trees -> sky, birds,
 * leaves -> people and cars (downloaded GLBs) -> the start menu -> the
 * opening cutscene -> free roam.
 *
 * The loop: a fixed 60 Hz simulation (player, crowd, traffic) with the
 * picture interpolated between steps, so motion is smooth at any frame rate
 * and behaves the same on every device (plan rule D5 / P5).
 *
 * URL options (handy for screenshots and testing):
 *   ?time=17.8     start at 17:48          ?speed=0     freeze the clock (1 = 1 game minute per second)
 *   ?view=aerial   start in a viewpoint (gate, roundabout, street, market, quad, aerial)
 *   ?quality=low   force phone settings    ?intro=0     skip the menu and the opening film
 *   ?shot=1        render a still and expose it as window.__wipShot (for the offscreen screenshot tool)
 */
import * as pc from "playcanvas";
import { makeMaterials, SH } from "./gfx/materials.ts";
import { clockFace, makeSignAtlas, makeTextures, softDot } from "./gfx/textures.ts";
import { CollisionWorld, pushOut } from "./sim/collide.ts";
import { clockText, hemisphereSH, skyAt, type RGB } from "./sim/daynight.ts";
import { makeRng } from "./sim/rng.ts";
import type { Obstacle } from "./sim/traffic.ts";
import { Ambience } from "./game/audio.ts";
import { Cutscene, type Actor, type PlayerCtx } from "./game/cutscene.ts";
import { GAME_NAME, Hud, loadLook } from "./game/hud.ts";
import { Input, type InputState } from "./game/input.ts";
import { FollowCamera, Player, ShowcaseCamera } from "./game/player.ts";
import { OPENING, colourName } from "./game/scenes.ts";
import { buildBuilding } from "./world/buildings.ts";
import { Crowd } from "./world/crowd-view.ts";
import { GENERATORS, SHOP_NAMES, SUYA, VIEWPOINTS, buildings } from "./world/layout.ts";
import { buildNature } from "./world/nature.ts";
import { FEMALE_MODELS, type Look, Person, loadPeople } from "./world/people.ts";
import { buildProps, type LightSpot } from "./world/props.ts";
import { buildGround, buildRoads } from "./world/roads.ts";
import { Birds, FallingLeaves, Sky, Smoke } from "./world/sky.ts";
import { StaticWorld } from "./world/static.ts";
import { surfaceHeight } from "./world/surface.ts";
import { Traffic, loadCars } from "./world/vehicles.ts";

const params = new URLSearchParams(location.search);
const num = (k: string, d: number) => (params.has(k) && Number.isFinite(Number(params.get(k))) ? Number(params.get(k)) : d);
const SHOT = params.get("shot") === "1";
const phone = matchMedia("(pointer: coarse)").matches || Math.min(screen.width, screen.height) < 600;
const LOW = params.get("quality") === "low" || (phone && params.get("quality") !== "high");

const Q = LOW
  ? { pixelRatio: Math.min(window.devicePixelRatio, 1.5), shadowRes: 1024, cascades: 1, shadowDist: 55, npcs: 46, cars: 14, okadas: 10, kekes: 6, birds: 28, leaves: 60, lights: 4 }
  : { pixelRatio: Math.min(window.devicePixelRatio, 2), shadowRes: 2048, cascades: 2, shadowDist: 90, npcs: 110, cars: 26, okadas: 16, kekes: 10, birds: 45, leaves: 150, lights: 10 };
if (params.has("npcs")) Q.npcs = num("npcs", Q.npcs);

const STEP = 1 / 60;
const BASE = "./";

async function boot(): Promise<void> {
  const host = document.getElementById("app")!;
  const canvas = document.createElement("canvas");
  canvas.className = "wip-canvas";
  host.append(canvas);
  const hud = new Hud(host);
  hud.progress(0.05, "Starting the engine…");

  const app = new pc.Application(canvas, {
    graphicsDeviceOptions: { antialias: !LOW, alpha: false, preserveDrawingBuffer: SHOT, powerPreference: "high-performance" },
  });
  app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);
  app.graphicsDevice.maxPixelRatio = Q.pixelRatio;
  const onResize = () => app.resizeCanvas();
  window.addEventListener("resize", onResize);
  app.scene.ambientLight = new pc.Color(0, 0, 0);
  app.scene.fog.type = pc.FOG_LINEAR;
  app.scene.fog.start = 70;
  app.scene.fog.end = 420;
  app.scene.exposure = 1;
  app.scene.lighting.shadowsEnabled = true;
  app.scene.lighting.cookiesEnabled = false;

  // Camera.
  const cam = new pc.Entity("camera");
  cam.addComponent("camera", { clearColor: new pc.Color(0.6, 0.75, 0.9), farClip: 1400, nearClip: 0.25, fov: 55, toneMapping: pc.TONEMAP_NEUTRAL, gammaCorrection: pc.GAMMA_SRGB });
  app.root.addChild(cam);

  // Sun (and moon at night): one directional light with cascaded soft shadows.
  const sun = new pc.Entity("sun");
  sun.addComponent("light", {
    type: "directional", castShadows: true, shadowResolution: Q.shadowRes, numCascades: Q.cascades, cascadeDistribution: 0.55,
    shadowDistance: Q.shadowDist, shadowType: pc.SHADOW_PCF3_32F, shadowBias: 0.25, normalOffsetBias: 0.06, intensity: 2,
  });
  app.root.addChild(sun);

  // A small pool of real point lights that follow the camera at night (street lamps, the suya fire).
  const pool: pc.Entity[] = [];
  for (let i = 0; i < Q.lights; i++) {
    const e = new pc.Entity("lamp-light");
    e.addComponent("light", { type: "omni", castShadows: false, range: 14, intensity: 0, color: new pc.Color(1, 0.8, 0.55), falloffMode: pc.LIGHTFALLOFF_INVERSESQUARED });
    app.root.addChild(e);
    pool.push(e);
  }

  await tick();
  hud.progress(0.12, "Painting textures…");
  const tex = makeTextures(app.graphicsDevice, LOW);
  const signNames = [...SHOP_NAMES, "Giginya Hall", "Kadanya Hall", "Senate Hall", "Faculty of Engineering", "University Library", "Faculty of Arts", "The Spot · Student Centre", "College of Health Sciences", "Welcome · Main Gate"];
  const signs = makeSignAtlas(app.graphicsDevice, signNames);
  const mats = makeMaterials(app.graphicsDevice, tex, signs.texture, clockFace(app.graphicsDevice));

  await tick();
  hud.progress(0.25, "Laying the roads…");
  const col = new CollisionWorld();
  const world = new StaticWorld();
  const worldRoot = new pc.Entity("world");
  app.root.addChild(worldRoot);
  buildGround(world.b);
  buildRoads(world.b);
  await tick();
  hud.progress(0.35, "Raising the buildings…");
  for (const b of buildings) buildBuilding({ b: world.b, signs, col }, b);
  const lightSpots: LightSpot[] = buildProps(world.b, signs, col);
  const stats = world.finalize(app, mats, worldRoot, new Set(["grass", "asphalt", "marking", "paver", "brickpave", "kerb", "laterite", "glass", "signs", "water"]));
  await tick();
  hud.progress(0.45, "Planting trees…");
  const treeInfo = buildNature(app, mats, worldRoot, col, LOW);

  const sky = new Sky(app);
  const birds = new Birds(app, Q.birds);
  const leaves = new FallingLeaves(app, treeInfo, Q.leaves);
  const smoke = new Smoke(app, SUYA.x, SUYA.z, softDot(app.graphicsDevice));

  await tick();
  hud.progress(0.55, "Waking everybody up…");
  const [people, cars] = await Promise.all([loadPeople(app, BASE, (f) => hud.progress(0.55 + f * 0.3, "Waking everybody up…")), loadCars(app, BASE)]);
  hud.progress(0.88, "Starting the traffic…");
  const rng = makeRng(2026);
  const traffic = new Traffic(app, mats, cars, people, rng, { car: Q.cars, okada: Q.okadas, keke: Q.kekes });
  const crowdRoot = new pc.Entity("crowd");
  app.root.addChild(crowdRoot);
  const crowd = new Crowd(app, crowdRoot, people, rng, Q.npcs, !LOW);

  // Story actors for the opening.
  const byKey = (k: string) => people.find((p) => p.key === k) ?? people[0]!;
  const guard = new Person(app, byKey("manlong"), { model: "manlong", skin: "#5a3a26", hair: "#141010", outfit: ["#7d7350", "#4f4a36"], headwear: "cap", headwearColor: "#4f4a36" }, app.root);
  const muhammad = new Person(app, byKey("manlong"), { model: "manlong", skin: "#8d5b3c", hair: "#141010", outfit: ["#fbfbf8", "#2b2b2b"], headwear: "none", headwearColor: "#ffffff" }, app.root);
  const familyCar = new pc.Entity("family-car");
  {
    familyCar.addChild(traffic.carEntity("suv", "#2f3c4a"));
    familyCar.enabled = false;
    app.root.addChild(familyCar);
  }
  guard.visible = false;
  muhammad.visible = false;

  hud.progress(1, "Ready");
  app.start();

  /* ------------------------------------------------------------- state */
  let hours = num("time", 7.6);
  const speeds = [1, 20, 0];
  let speedIdx = params.has("speed") ? Math.max(0, speeds.indexOf(num("speed", 1))) : 0;
  if (params.has("speed") && speeds.indexOf(num("speed", 1)) < 0) speeds[0] = num("speed", 1);
  const input = new Input(host, canvas);
  input.mountTouchUi(hud.root);
  const ambience = new Ambience();
  let player: Player | null = null;
  let follow: FollowCamera | null = null;
  const showcase = new ShowcaseCamera(cam);
  let mode: "menu" | "cutscene" | "play" | "showcase" = "menu";
  let cut: Cutscene | null = null;
  let acc = 0;
  let simTime = 0;
  const camPos = new pc.Vec3();
  const tmp = new pc.Vec3();
  const obstacles: Obstacle[] = [];
  const sunDirV = new pc.Vec3();
  let lightTimer = 0;
  let fpsT = 0, fpsN = 0;
  let lastEnv = -1;

  function makePlayer(look: Look): void {
    const cm = people.find((p) => p.key === look.model) ?? people[0]!;
    const person = new Person(app, cm, look, app.root);
    player = new Player(person, col, 11.3, -40.6, Math.PI);
    follow = new FollowCamera(cam, col);
  }

  function startPlay(): void {
    mode = "play";
    hud.showHud(true);
    if (player) {
      player.frozen = false;
      follow!.reset(player.pos(1, tmp), player.yaw);
      follow!.yaw = player.yaw;
    }
  }

  function playOpening(look: Look, voices: boolean): void {
    if (!player) return;
    const female = FEMALE_MODELS.includes(look.model);
    const ctx: PlayerCtx = { look, female, topColour: colourName(look.outfit[0] ?? "#ffffff"), roommate: female ? "Firdausi" : "Bature" };
    const actors = new Map<string, Actor>([
      ["PLAYER", { entity: player.person.root, person: player.person, kind: "person", yaw: 0, x: 0, z: 0 }],
      ["CAR", { entity: familyCar, kind: "vehicle", yaw: 0, x: 0, z: 0 }],
      ["GUARD", { entity: guard.root, person: guard, kind: "person", yaw: 0, x: 0, z: 0 }],
      ["MUHAMMAD", { entity: muhammad.root, person: muhammad, kind: "person", yaw: 0, x: 0, z: 0 }],
    ]);
    player.frozen = true;
    mode = "cutscene";
    hud.showHud(false);
    cut = new Cutscene(OPENING, ctx, actors, cam, hud, col, [], voices, (def) => {
      const [x, , z] = def.end.player;
      player!.teleport(x, z, def.end.yaw);
      player!.person.visible = true;
      familyCar.enabled = false;
      guard.place(-5.8, surfaceHeight(-5.8, -41.2), -41.2, 0.35);
      cut = null;
      startPlay();
    });
  }

  function begin(look: Look, opts: { voices: boolean; sound: boolean; skipIntro: boolean }): void {
    makePlayer(look);
    if (opts.sound) ambience.start();
    if (opts.skipIntro) {
      guard.visible = true;
      guard.place(-5.8, surfaceHeight(-5.8, -41.2), -41.2, 0.35);
      startPlay();
    } else playOpening(look, opts.voices);
  }

  /* ------------------------------------------------------------ the loop */
  function environment(dt: number): void {
    if (mode !== "menu") hours = (hours + (dt * speeds[speedIdx]!) / 60) % 24;
    const s = skyAt(hours);
    const night = s.night;
    // Sun by day, moon by night.
    const useMoon = s.elevation < -2;
    const d = useMoon ? s.moonDir : s.sunDir;
    sunDirV.set(d[0], d[1], d[2]);
    sun.setPosition(0, 0, 0);
    sun.lookAt(-d[0], -d[1], -d[2]);
    sun.rotateLocal(90, 0, 0);
    const lc = sun.light!;
    if (useMoon) {
      lc.color = new pc.Color(0.55, 0.65, 0.95);
      lc.intensity = 0.35 * night;
    } else {
      lc.color = new pc.Color(s.sunColor[0], s.sunColor[1], s.sunColor[2]);
      lc.intensity = s.sunIntensity;
    }
    // Hemisphere ambient: sky above, warm ground bounce below, a little sun-side warmth.
    const amb = 0.78 - night * 0.2;
    const skyAmb: RGB = [s.skyTop[0] * 0.75 * amb + s.skyHorizon[0] * 0.25 * amb, s.skyTop[1] * 0.75 * amb + s.skyHorizon[1] * 0.25 * amb, s.skyTop[2] * 0.75 * amb + s.skyHorizon[2] * 0.25 * amb];
    const ground: RGB = [s.groundBounce[0] * 0.9, s.groundBounce[1] * 0.9, s.groundBounce[2] * 0.9];
    const nightLift: RGB = [0.025 * night, 0.035 * night, 0.07 * night];
    hemisphereSH([skyAmb[0] + nightLift[0], skyAmb[1] + nightLift[1], skyAmb[2] + nightLift[2]], ground, [s.sunColor[0] * 0.12 * (1 - night), s.sunColor[1] * 0.1 * (1 - night), s.sunColor[2] * 0.08 * (1 - night)], s.sunDir, SH);
    // Fog matches the sky's horizon so the far edge melts into it.
    app.scene.fog.color = new pc.Color(s.skyHorizon[0], s.skyHorizon[1], s.skyHorizon[2]);
    app.scene.fog.start = 110 + (1 - night) * 60;
    app.scene.fog.end = 520 + (1 - night) * 260;
    cam.camera!.clearColor = app.scene.fog.color;
    app.scene.exposure = 1.0 + night * 0.45;
    sky.update(s, cam.getPosition(), simTime, app.scene.exposure, 0.5);
    // Windows, lamps and signs glow at night; only update materials when the value changes noticeably.
    const envKey = Math.round(night * 40);
    if (envKey !== lastEnv) {
      lastEnv = envKey;
      for (const n of mats.night) {
        n.mat.emissiveIntensity = n.day + (n.night - n.day) * night;
        n.mat.update();
      }
    }
    // Real lights near the camera.
    lightTimer -= dt;
    const cp = cam.getPosition();
    if (lightTimer <= 0) {
      lightTimer = 0.4;
      const near = lightSpots.map((l) => ({ l, d: Math.hypot(l.x - cp.x, l.z - cp.z) })).sort((a, b) => a.d - b.d).slice(0, pool.length);
      pool.forEach((e, i) => {
        const n = near[i];
        if (!n) return;
        e.setPosition(n.l.x, n.l.y, n.l.z);
        e.light!.range = n.l.range;
        e.light!.color = new pc.Color(n.l.color[0], n.l.color[1], n.l.color[2]);
      });
    }
    for (const e of pool) e.light!.intensity = night * 3.2;
    hud.setClock(clockText(hours), speeds[speedIdx] === 0 ? "⏸" : speeds[speedIdx]! > 1 ? `×${speeds[speedIdx]}` : "");
    // Sound: traffic louder near roads, generators at night near the market.
    const nearRoad = Math.max(0, 1 - Math.min(Math.abs(cp.z), Math.abs(cp.x), Math.abs(cp.z - 90)) / 40);
    const nearGen = Math.max(0, ...GENERATORS.map(([x, z]) => 1 - Math.hypot(cp.x - x, cp.z - z) / 45));
    ambience.update(night, nearRoad, nearGen);
    // The wind clock for swaying trees and flapping birds.
    app.graphicsDevice.scope.resolve("uWindTime").setValue(simTime);
  }

  function simStep(inp: InputState): void {
    simTime += STEP;
    obstacles.length = 0;
    if (player) obstacles.push({ x: player.x, z: player.z, r: 0.5 });
    crowd.obstacles(obstacles);
    traffic.step(STEP, obstacles);
    crowd.step(STEP);
    if (player) {
      player.step(STEP, mode === "play" ? inp : { ...inp, moveX: 0, moveY: 0 }, follow?.yaw ?? 0);
      // Cars are solid: push the player out of any vehicle.
      for (const v of traffic.vehicles) {
        if (v.wait > 0 || Math.abs(v.x - player.x) > 4 || Math.abs(v.z - player.z) > 4) continue;
        const p = pushOut({ kind: "box", x: v.x, z: v.z, hx: v.kind === "car" ? 0.95 : 0.45, hz: v.length / 2, rot: Math.atan2(v.dx, v.dz) }, player.x, player.z, 0.33);
        if (p) {
          player.x = p[0];
          player.z = p[1];
        }
      }
    }
  }

  function onKeys(p: Set<string>): void {
    if (mode === "cutscene") return;
    if (p.has("c")) {
      mode = mode === "showcase" ? "play" : "showcase";
      hud.setMode(mode === "showcase" ? "Showcase camera · press C to walk again" : "");
      if (mode === "play" && player && follow) follow.reset(player.pos(1, tmp), player.yaw);
    }
    if (p.has("t")) {
      speedIdx = (speedIdx + 1) % speeds.length;
      hud.say(speeds[speedIdx] === 0 ? "Time paused" : speeds[speedIdx]! > 1 ? `Time ×${speeds[speedIdx]}` : "Time: normal");
    }
    if (p.has("n")) {
      hours = hours > 6.2 && hours < 18.3 ? 20.5 : 9;
      hud.say(hours > 12 ? "Night" : "Morning");
    }
    if (p.has("[")) hours = (hours + 23) % 24;
    if (p.has("]")) hours = (hours + 1) % 24;
    if (p.has("m")) {
      ambience.setMuted(!ambience.muted);
      hud.say(ambience.muted ? "Sound off" : "Sound on");
    }
    if (p.has("h")) hud.toggleHud();
  }

  app.on("update", (rawDt: number) => {
    const dt = Math.min(rawDt, 0.1);
    const inp = input.read();
    onKeys(inp.pressed);
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 6) {
      simStep(inp);
      acc -= STEP;
      steps++;
    }
    if (steps === 6) acc = 0;
    const alpha = acc / STEP;
    camPos.copy(cam.getPosition());
    crowd.render(alpha, camPos.x, camPos.z);
    if (player && mode !== "cutscene") player.render(alpha);

    if (mode === "cutscene" && cut) {
      const skip = ["escape", "enter", " ", "tap"].some((k) => inp.pressed.has(k));
      cut.update(dt, skip);
    } else if (mode === "play" && player && follow) {
      follow.update(dt, inp, player.pos(alpha, tmp), player.speed, player.yaw);
    } else if (mode === "showcase" || mode === "menu") {
      showcase.update(dt);
    }
    environment(dt);
    traffic.render(alpha, skyAt(hours).night, camPos.x, camPos.z);
    birds.update(simTime);
    leaves.update(dt, simTime, camPos.x, camPos.z);
    smoke.update(dt, cam);

    fpsT += rawDt;
    fpsN++;
    if (fpsT > 1) {
      hud.setStats(`${Math.round(fpsN / fpsT)} fps · ${app.stats.drawCalls.total} draws`);
      fpsT = fpsN = 0;
    }
  });

  /* ------------------------------------------------------- screenshots */
  const view = params.get("view") as keyof typeof VIEWPOINTS | null;
  if (SHOT && params.has("cut")) {
    // Screenshot of the opening film at a given second (default look, no voices).
    hud.hideLoading();
    const look = loadLook();
    makePlayer(look);
    playOpening(look, false);
    const until = num("cut", 10);
    for (let t = 0; t < until; t += 1 / 30) app.update(1 / 30);
    for (let i = 0; i < 3; i++) {
      app.update(1 / 30);
      app.render();
    }
    (window as unknown as { __wipShot: string }).__wipShot = canvas.toDataURL("image/jpeg", 0.92);
    (window as unknown as { __wipStats: unknown }).__wipStats = { mode, draws: app.stats.drawCalls.total };
    document.title = "SHOT_READY";
    return;
  }
  if (SHOT || params.get("intro") === "0" || view) {
    hud.hideLoading();
    makePlayer(loadLook());
    guard.visible = true;
    guard.place(-5.8, surfaceHeight(-5.8, -41.2), -41.2, 0.35);
    if (params.has("px")) player!.teleport(num("px", 11.3), num("pz", -40.6), num("pyaw", Math.PI));
    startPlay();
    const f = follow as FollowCamera | null;
    if (f && params.has("cyaw")) f.yaw = num("cyaw", Math.PI);
    if (f && params.has("cdist")) f.dist = num("cdist", 5);
    if (f && params.has("cpitch")) f.pitch = num("cpitch", 0.3);
    if (view && VIEWPOINTS[view]) {
      mode = "showcase";
      const v = VIEWPOINTS[view];
      // Hold the camera still at the viewpoint.
      showcase.update = () => {
        cam.setPosition(v.pos[0], v.pos[1], v.pos[2]);
        cam.lookAt(v.look[0], v.look[1], v.look[2]);
      };
      hud.showHud(params.get("hud") !== "0");
    }
    if (SHOT && params.has("walk")) {
      // Walk forward (optionally running) for N seconds to check the controller and camera.
      input.hold("w");
      if (params.get("run") === "1") input.hold("shift");
      for (let t = 0; t < num("walk", 2); t += 1 / 30) app.update(1 / 30);
      input.hold("w", false);
      input.hold("shift", false);
    }
    if (SHOT) {
      // Offscreen browsers may never run requestAnimationFrame: drive frames by hand.
      for (let i = 0; i < num("frames", 90); i++) {
        app.update(1 / 30);
        app.render();
      }
      (window as unknown as { __wipShot: string }).__wipShot = canvas.toDataURL("image/jpeg", 0.92);
      (window as unknown as { __wipStats: unknown }).__wipStats = { ...stats, draws: app.stats.drawCalls.total };
      document.title = "SHOT_READY";
    }
    return;
  }
  hud.hideLoading();
  hud.menu((look, opts) => begin(look, opts));
  document.title = GAME_NAME;
}

function tick(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

boot().catch((err: unknown) => {
  const box = document.getElementById("app");
  if (box) box.insertAdjacentHTML("beforeend", `<div class="wip-error"><h2>The game could not start</h2><p>${String(err instanceof Error ? err.message : err).replace(/</g, "&lt;")}</p><p>Try a recent Chrome, Edge, Firefox or Safari with WebGL 2 turned on.</p></div>`);
  console.error(err);
});
