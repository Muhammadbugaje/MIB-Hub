/**
 * Work in Progress: the new open-world campus game (PlayCanvas).
 *
 * Boot order: canvas and engine -> procedural textures and materials -> the
 * static town (ground, roads, buildings, campus story places, interiors,
 * props) -> trees -> sky, birds, leaves -> people and cars (GLBs) -> the
 * story (Missions 1-10 from docs/plan/missions/Y1.md, built in by the Vite
 * story plugin) -> the title screen and menu -> play.
 *
 * The loop: a fixed 60 Hz simulation (player, crowd, traffic, the story's
 * triggers) with the picture interpolated between steps, so motion is smooth
 * at any frame rate and behaves the same on every device (plan rule D5 / P5).
 *
 * URL options (testing, screenshots):
 *   ?time=17.8        start at 17:48           ?speed=0        freeze the clock
 *   ?view=aerial      a fixed viewpoint        ?quality=low    phone settings
 *   ?intro=0          skip the menu (free roam, or ?mission=m003&step=2 to jump in)
 *   ?debug=1          mission select (bottom-left button), specials on/off
 *   ?specials=jiya,taty,madison                switch special characters on
 *   ?shot=1           render a still for tools/shot.py; with
 *     &cut=cut_m001_film_b&at=12               a cutscene at a second
 *     &mission=m004&step=3&t=4                 a mission step after t seconds
 *     &menu=title|main|creator|settings|loading the menu screens
 */
import * as pc from "playcanvas";
import story from "virtual:wip-story";
import { makeMaterials, SH } from "./gfx/materials.ts";
import { clockFace, makeSignAtlas, makeTextures, softDot } from "./gfx/textures.ts";
import { CollisionWorld, pushOut } from "./sim/collide.ts";
import { clearLines } from "./sim/crowd.ts";
import { NavGrid } from "./sim/nav.ts";
import { navWorld } from "./world/nav-world.ts";
import { doorColliders, doorSpecs } from "./world/door-plan.ts";
import { Doors } from "./world/door-models.ts";
import { GrassField } from "./world/grass-field.ts";
import { FacadeDetail } from "./world/facade-detail.ts";
import { TreeCards } from "./world/tree-cards.ts";
import { clockText, hemisphereSH, skyAt, type RGB } from "./sim/daynight.ts";
import { makeRng } from "./sim/rng.ts";
import type { Obstacle } from "./sim/traffic.ts";
import { Ambience } from "./game/audio.ts";
import { CAST } from "./game/cast.ts";
import { GAME_NAME, Hud, loadLook, saveLook } from "./game/hud.ts";
import { Input } from "./game/input.ts";
import { FollowCamera, ShowcaseCamera } from "./game/player.ts";
import { Menu, type MenuSettings, loadSettings } from "./game/menu.ts";
import { Campaign } from "./game/missions/runner.ts";
import { MISSION_DEFS, setStory } from "./game/missions/scripts.ts";
import { loadCloud, loadLocal, newProgress, type Progress } from "./game/save.ts";
import { StoryGame } from "./game/story-game.ts";
import { buildBuilding } from "./world/buildings.ts";
import { buildCampus } from "./world/campus.ts";
import { Crowd } from "./world/crowd-view.ts";
import { buildInteriors, INTERIOR_SIGNS } from "./world/interiors.ts";
import { GENERATORS, PLACES, SHOP_NAMES, SUYA, VIEWPOINTS, buildings, walkLines } from "./world/layout.ts";
import { buildNature } from "./world/nature.ts";
import { ANIM, ANIM_STATS, type Look, Person, loadPeople, tickPeople } from "./world/people.ts";
import { buildProps, type LightSpot } from "./world/props.ts";
import { buildGround, buildRoads } from "./world/roads.ts";
import { Birds, FallingLeaves, Sky, Smoke } from "./world/sky.ts";
import { StaticWorld } from "./world/static.ts";
import { Traffic, loadCars } from "./world/vehicles.ts";
import { surfaceHeight as surfaceAt } from "./world/surface.ts";

const params = new URLSearchParams(location.search);
const num = (k: string, d: number) => (params.has(k) && Number.isFinite(Number(params.get(k))) ? Number(params.get(k)) : d);
const SHOT = params.get("shot") === "1";
const DEBUG = params.get("debug") === "1";
const phone = matchMedia("(pointer: coarse)").matches || Math.min(screen.width, screen.height) < 600;
const settings: MenuSettings = loadSettings();
const qWant = params.get("quality") ?? settings.quality;
const LOW = qWant === "low" || (qWant === "auto" && phone);

const Q = LOW
  ? { pixelRatio: Math.min(window.devicePixelRatio, 1.5), shadowRes: 512, cascades: 0, shadowDist: 30, npcs: 20, cars: 8, okadas: 5, kekes: 3, birds: 15, leaves: 30, lights: 2, lodDist: 40 }
  : { pixelRatio: Math.min(window.devicePixelRatio, qWant === "medium" ? 1.5 : 2), shadowRes: 1024, cascades: 1, shadowDist: 60, npcs: 50, cars: 16, okadas: 8, kekes: 5, birds: 30, leaves: 60, lights: 5, lodDist: 80 };
if (params.has("npcs")) Q.npcs = num("npcs", Q.npcs);

const STEP = 1 / 60;
const BASE = "./";

async function boot(): Promise<void> {
  const host = document.getElementById("app")!;
  if (SHOT) document.body.classList.add("wip-shot");
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
  window.addEventListener("resize", () => app.resizeCanvas());
  app.scene.ambientLight = new pc.Color(0, 0, 0);
  app.scene.fog.type = pc.FOG_LINEAR;
  app.scene.fog.start = 70;
  app.scene.fog.end = 420;
  app.scene.exposure = 1;
  app.scene.lighting.shadowsEnabled = true;
  app.scene.lighting.cookiesEnabled = false;

  const cam = new pc.Entity("camera");
  cam.addComponent("camera", { clearColor: new pc.Color(0.6, 0.75, 0.9), farClip: 1400, nearClip: 0.12, fov: 55, toneMapping: pc.TONEMAP_NEUTRAL, gammaCorrection: pc.GAMMA_SRGB });
  app.root.addChild(cam);

  const sun = new pc.Entity("sun");
  sun.addComponent("light", {
    type: "directional", castShadows: true, shadowResolution: Q.shadowRes, numCascades: Q.cascades, cascadeDistribution: 0.55,
    shadowDistance: Q.shadowDist, shadowType: pc.SHADOW_PCF3_32F, shadowBias: 0.25, normalOffsetBias: 0.06, intensity: 2,
  });
  app.root.addChild(sun);

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
  const signNames = [...SHOP_NAMES, "Giginya Hall", "Kadanya Hall", "Senate Hall", "Faculty of Engineering", "University Library", "Faculty of Arts", "The Spot · Student Centre", "College of Health Sciences", "Welcome · Main Gate", "Theatre Yamma", "Theatre Gabas", ...INTERIOR_SIGNS];
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
  buildCampus(world.b, signs, col);
  const interiors = buildInteriors(app, world.b, signs, col);
  // Every door people pass through (entrances, interior exits, room doorways): models and the leaves that stand open.
  const doorList = doorSpecs(surfaceAt);
  for (const c of doorColliders(doorList)) col.add(c);
  // The entrance lamps light the doorstep at night (they join the street lamps' shared light pool).
  for (const d of doorList) if (d.place === "world" && d.rest === "closed") lightSpots.push({ x: d.x + Math.sin(d.yaw) * 0.9, y: d.y + Math.min(d.h, 2.6) + 0.3, z: d.z + Math.cos(d.yaw) * 0.9, color: [1, 0.82, 0.58], range: 7 });
  const stats = world.finalize(app, mats, worldRoot, new Set(["grass", "asphalt", "marking", "paver", "brickpave", "kerb", "laterite", "glass", "signs", "water", "daywin", "ilamp"]));
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
  // The crowd walks lines routed round everything solid (the navigation grid, shared with the story).
  const navGrid = new NavGrid(navWorld(col));
  const doors = new Doors(app, mats, doorList);
  // Facade detail near the camera (bands, downpipes, AC units, vents, entrance lamps), dithered in and out.
  const facade = new FacadeDetail(app, mats, buildings, doorList);
  // Leaf cards on the crowns near the camera (off on phones).
  const treeCards = new TreeCards(app, treeInfo, surfaceAt, !LOW);
  // Grass blades round the camera: off on phones, a smaller patch on medium.
  const grass = new GrassField(app, mats, LOW ? 0 : qWant === "medium" ? 20 : 30, (x, z) => (Math.abs(x - PLACES.engGarden.x) < PLACES.engGarden.hx && Math.abs(z - PLACES.engGarden.z) < PLACES.engGarden.hz ? false : navGrid.isBaked(x, z) && navGrid.kindAt(x, z) === "lawn"), surfaceAt);
  const crowd = new Crowd(app, crowdRoot, people, rng, Q.npcs, !LOW, clearLines(walkLines, navGrid), navGrid);
  // The camera never passes through people or vehicles (upright cylinders around them).
  FollowCamera.moving = () => {
    const out: { x: number; z: number; r: number; h: number }[] = [];
    for (const n of crowd.npcs) if (n.p.visible) out.push({ x: n.w.x, z: n.w.z, r: 0.3, h: 1.8 });
    for (const v of traffic.vehicles) out.push({ x: v.x, z: v.z, r: v.kind === "car" ? 1.2 : 0.7, h: v.kind === "car" ? 1.5 : 1.7 });
    return out;
  };
  crowd.solids = col;

  hud.progress(0.95, "Reading the script…");
  setStory(story.missions);
  const ambience = new Ambience();
  const g = new StoryGame({
    app, cam, mats, people, col, nav: navGrid, doors, low: LOW, interiors, hudRoot: hud.root, story,
    carEntity: (k, c) => traffic.carEntity(k, c),
    setAmbience: (inside) => ambience.setMuted(inside || settings.soundVolume === 0),
    letterbox: (on) => hud.letterbox(on),
    subtitle: (w, t) => hud.subtitle(settings.subtitles ? w : null, t),
    fadeEl: (a) => hud.fade(a),
    skipButton: (on, f) => hud.skipButton(on, f),
    showHud: (on) => hud.showHud(on),
    toast: (t) => hud.say(t),
  });
  g.voice.enabled = settings.voices;
  const campaign = new Campaign(g, story.missions, DEBUG);
  // ?debug=1&nav=1: start with the navigation overlay on (also in the debug menu).
  if (DEBUG && params.get("nav") === "1") g.navs.debug = true;
  // ?follow=1 (screenshots): the player follows whoever is leading them, through doors.
  if (params.get("follow") === "1") g.shotFollow = true;
  g.guideOn = () => settings.groundArrows && params.get("arrows") !== "0";
  hud.progress(1, "Ready");
  app.start();

  /* ------------------------------------------------------------- state */
  g.hours = num("time", 17.4);
  const speeds = [1, 20, 0];
  let speedIdx = params.has("speed") ? Math.max(0, speeds.indexOf(num("speed", 1))) : 0;
  if (params.has("speed") && speeds.indexOf(num("speed", 1)) < 0) speeds[0] = num("speed", 1);
  const input = new Input(host, canvas);
  // Detect phone/coarse pointer mode
  const isPhone = matchMedia("(pointer: coarse)").matches || Math.min(screen.width, screen.height) < 600;
  // Mount touch UI always (hidden on desktop, shown on phone)
  input.mountTouchUi(hud.root);
  // Auto-show touch controls on phones after a brief delay
  if (isPhone) {
    setTimeout(() => {
      input.showStickUI(true);
      input.showRunUI(true);
    }, 500);
  }
  const showcase = new ShowcaseCamera(cam);
  let menu: Menu | null = null;
  let acc = 0;
  let simTime = 0;
  const camPos = new pc.Vec3();
  const obstacles: Obstacle[] = [];
  let lightTimer = 0;
  let fpsT = 0, fpsN = 0;
  let lastEnv = -1;
  let barkTimer = 8;
  let playing = false;

  const specialsFromUrl = () => {
    const s = (params.get("specials") ?? "").split(",");
    return { jiya: s.includes("jiya"), taty: s.includes("taty"), madison: s.includes("madison") };
  };

  function startStory(look: Look, name: string, progress: Progress, opts: { fresh: boolean }): void {
    saveLook(look);
    progress.name = name;
    g.begin(look, progress, specialsFromUrl());
    g.voice.enabled = settings.voices;
    g.voice.volume = settings.voiceVolume;
    g.voice.unlock();
    g.ui.setMoney(progress.money);
    g.doorInteractions();
    playing = true;
    hud.showHud(true);
    g.ui.setPlaying(true);
    if (settings.soundVolume > 0) {
      ambience.start();
      g.sfxs.start();
      g.sfxs.setVolume(settings.soundVolume);
    }
    if (DEBUG) g.ui.debugButton(() => campaign.debugMenu());
    campaign.onSpecials = (s) => (g.ctx.specials = s);
    if (opts.fresh) progress.current = null;
    campaign.start();
  }

  /* ------------------------------------------------------------ the loop */
  function environment(dt: number): void {
    if (g.mode !== "menu" && g.mode !== "cut") g.hours = (g.hours + (dt * speeds[speedIdx]!) / 60) % 24;
    const hours = g.hours;
    const s = skyAt(hours);
    const night = s.night;
    const useMoon = s.elevation < -2;
    const d = useMoon ? s.moonDir : s.sunDir;
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
    const inside = g.isInside;
    const blackout = ["blackout", "torch", "candle"].includes(g.lightPreset);
    // Indoors the sky's light comes through windows: less of it; a blackout leaves almost none.
    const k = blackout ? 0.11 : inside ? 0.55 : 1;
    const amb = (0.78 - night * 0.2) * k;
    const skyAmb: RGB = [s.skyTop[0] * 0.75 * amb + s.skyHorizon[0] * 0.25 * amb, s.skyTop[1] * 0.75 * amb + s.skyHorizon[1] * 0.25 * amb, s.skyTop[2] * 0.75 * amb + s.skyHorizon[2] * 0.25 * amb];
    const ground: RGB = [s.groundBounce[0] * 0.9 * k, s.groundBounce[1] * 0.9 * k, s.groundBounce[2] * 0.9 * k];
    const nightLift: RGB = [0.025 * night * k, 0.035 * night * k, 0.07 * night * k];
    hemisphereSH([skyAmb[0] + nightLift[0], skyAmb[1] + nightLift[1], skyAmb[2] + nightLift[2]], ground, [s.sunColor[0] * 0.12 * (1 - night) * k, s.sunColor[1] * 0.1 * (1 - night) * k, s.sunColor[2] * 0.08 * (1 - night) * k], s.sunDir, SH);
    if (inside) lc.intensity *= blackout ? 0 : 1;
    app.scene.fog.color = new pc.Color(s.skyHorizon[0], s.skyHorizon[1], s.skyHorizon[2]);
    app.scene.fog.start = inside ? 400 : 110 + (1 - night) * 60;
    app.scene.fog.end = inside ? 900 : 520 + (1 - night) * 260;
    cam.camera!.clearColor = inside ? new pc.Color(0.05, 0.05, 0.06) : app.scene.fog.color;
    app.scene.exposure = 1.0 + night * 0.45 + (inside && !blackout ? 0.1 : 0);
    sky.update(s, cam.getPosition(), simTime, app.scene.exposure, 0.5);
    const envKey = Math.round(night * 40);
    if (envKey !== lastEnv) {
      lastEnv = envKey;
      for (const n of mats.night) {
        n.mat.emissiveIntensity = n.day + (n.night - n.day) * night;
        n.mat.update();
      }
      const dw = mats.get("daywin");
      dw.emissiveIntensity = 1.6 * (1 - night) + 0.05;
      dw.update();
    }
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
    for (const e of pool) e.light!.intensity = inside ? 0 : night * 3.2;
    hud.setClock(clockText(hours), speeds[speedIdx] === 0 ? "⏸" : speeds[speedIdx]! > 1 ? `×${speeds[speedIdx]}` : "");
    const nearRoad = Math.max(0, 1 - Math.min(Math.abs(cp.z), Math.abs(cp.x), Math.abs(cp.z - 90)) / 40);
    const nearGen = Math.max(0, ...GENERATORS.map(([x, z]) => 1 - Math.hypot(cp.x - x, cp.z - z) / 45));
    ambience.update(night, inside ? 0 : nearRoad, inside ? 0 : nearGen);
    app.graphicsDevice.scope.resolve("uWindTime").setValue(simTime);
  }

  function simStep(inp: ReturnType<Input["read"]>): void {
    simTime += STEP;
    obstacles.length = 0;
    const pl = g.player;
    if (pl) obstacles.push({ x: pl.x, z: pl.z, r: 0.5 });
    if (playing) g.storyObstacles(obstacles);
    crowd.obstacles(obstacles);
    traffic.step(STEP, obstacles);
    crowd.avoid = pl ? [{ x: pl.x, z: pl.z, r: 0.33 }] : [];
    if (playing) g.storyPeople(crowd.avoid);
    crowd.step(STEP);
    if (playing) {
      // Crowd walkers near the player: the story's walkers (sim/agents.ts) steer round them.
      g.crowdNear.length = 0;
      if (pl) for (const n of crowd.npcs) if (Math.abs(n.w.x - pl.x) < 40 && Math.abs(n.w.z - pl.z) < 40) g.crowdNear.push({ x: n.w.x, z: n.w.z, r: 0.3 });
      g.step(STEP, inp);
      // Cars are solid: push the player out of any vehicle.
      if (pl && g.mode === "play") {
        for (const v of traffic.vehicles) {
          if (v.wait > 0 || Math.abs(v.x - pl.x) > 4 || Math.abs(v.z - pl.z) > 4) continue;
          const p = pushOut({ kind: "box", x: v.x, z: v.z, hx: v.kind === "car" ? 0.95 : 0.45, hz: v.length / 2, rot: Math.atan2(v.dx, v.dz) }, pl.x, pl.z, 0.33);
          if (p) {
            pl.x = p[0];
            pl.z = p[1];
          }
        }
        // Crowd people are solid too (a soft push, never a pop).
        for (const n of crowd.npcs) {
          const dx = pl.x - n.w.x, dz = pl.z - n.w.z, d = Math.hypot(dx, dz);
          if (d < 0.62 && d > 1e-4) {
            pl.x = n.w.x + (dx / d) * 0.62;
            pl.z = n.w.z + (dz / d) * 0.62;
          }
        }
      }
    }
  }

  /** Ambient chatter: Year 1 barks from the public packs when you pass people. */
  function ambientBarks(dt: number): void {
    if (!playing || g.mode !== "play" || g.isInside) return;
    barkTimer -= dt;
    if (barkTimer > 0) return;
    barkTimer = 9 + Math.random() * 8;
    const pl = g.player;
    const near = crowd.npcs.find((n) => Math.hypot(n.w.x - pl.x, n.w.z - pl.z) < 5.5);
    if (!near) return;
    const town = pl.z > 8;
    const packs = town ? ["public_traders", "public_town", "public_riders"] : ["public_freshers", "public_students"];
    const night = skyAt(g.hours).night > 0.5;
    const pack = story.barks[packs[Math.floor(Math.random() * packs.length)]!];
    if (!pack) return;
    const pool = pack.barks.filter((b) => ["idle", "greet", "night", "heat", "food", "money"].includes(b.category) && (!b.when || (b.when === "night" ? night : false)));
    const b = pool[Math.floor(Math.random() * pool.length)];
    if (!b) return;
    const who = town ? "Trader" : pack.id === "crowd.freshers" ? "Fresher" : "Student";
    hud.subtitle(settings.subtitles ? who : null, b.text);
    setTimeout(() => {
      if (g.mode === "play") hud.subtitle(null, "");
    }, 3600);
  }

  function onKeys(p: Set<string>): void {
    if (!playing || g.mode === "cut") return;
    if (p.has("t")) {
      speedIdx = (speedIdx + 1) % speeds.length;
      hud.say(speeds[speedIdx] === 0 ? "Time paused" : speeds[speedIdx]! > 1 ? `Time ×${speeds[speedIdx]}` : "Time: normal");
    }
    if (p.has("m")) {
      const m = !ambience.muted;
      ambience.setMuted(m);
      g.sfxs.setMuted(m);
      g.voice.enabled = !m && settings.voices;
      hud.say(m ? "Sound off" : "Sound on");
    }
    if (p.has("h")) hud.toggleHud();
    if (p.has("j")) {
      if (g.ui.sheetOpen) g.ui.closeSheet();
      else campaign.journal();
    }
    if (DEBUG && p.has("f2")) campaign.debugMenu();
    if (p.has("e")) {
      // E key: open nearest door
      const nearest = doors.near(g.place, g.player.x, g.player.z, 3);
      if (nearest) {
        doors.open(nearest.id, 1.6);
        g.sfxs.play("door");
      }
    }
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
    grass.update(camPos.x, camPos.z);
    facade.update(camPos.x, camPos.z);
    treeCards.update(camPos.x, camPos.z);
    if (playing) g.frame(dt, alpha, inp);
    else if (menu) menu.update(dt);
    else showcase.update(dt);
    environment(dt);
    traffic.render(alpha, skyAt(g.hours).night, camPos.x, camPos.z);
    const out = !g.isInside;
    birds.update(simTime);
    if (out) leaves.update(dt, simTime, camPos.x, camPos.z);
    doors.update(dt);
    smoke.update(dt, cam);
    ambientBarks(dt);
    // Characters: every person's animation, after everything above has placed them (src/anim, crowd LOD).
    tickPeople(app, dt, cam);
    fpsT += rawDt;
    fpsN++;
    // Dynamic quality scaling to maintain target FPS
    const targetFPS = 30;
    const actualFPS = fpsT > 0 ? fpsN / fpsT : 60;
    const fpsDiff = actualFPS - targetFPS;
    if (Math.abs(fpsDiff) > 5) {
      const quality = params.get("quality");
      if (actualFPS < targetFPS && quality !== "low") {
        params.set("quality", "low");
        Q.npcs = 20; Q.shadowRes = 512; Q.cascades = 0; Q.shadowDist = 30;
        Q.npcs = 20; Q.cars = 8; Q.okadas = 5; Q.kekes = 3; Q.birds = 15; Q.leaves = 30; Q.lights = 2;
      } else if (actualFPS > targetFPS + 10 && quality !== "medium") {
        params.set("quality", "medium");
        Q.npcs = 50; Q.shadowRes = 1024; Q.cascades = 1; Q.shadowDist = 60;
        Q.npcs = 50; Q.cars = 16; Q.okadas = 8; Q.kekes = 5; Q.birds = 30; Q.leaves = 60; Q.lights = 5;
      }
    }
    if (fpsT > 1) {
      // Optimization hint: if draws > 150 on low, consider reducing quality
      const drawHint = app.stats.drawCalls.total > 150 && Q.npcs < 50 ? "• consider reducing NPC count" : "";
      hud.setStats(`${Math.round(fpsN / fpsT)} fps · ${app.stats.drawCalls.total} draws ${drawHint}`);
      fpsT = fpsN = 0;
    }
  });

  /* ------------------------------------------------------- load progress */
  const local = loadLocal();
  let progress: Progress = local.ok ? local.progress : newProgress();
  if (!local.ok && local.reason !== "empty") hud.say(local.message);
  // A newer cloud save (signed in on the site) wins over this device's.
  void loadCloud().then((c) => {
    if (c && c.savedAt > progress.savedAt && !playing) progress = c;
  });

  /* ------------------------------------------------------- screenshots */
  const finishShot = (extra: Record<string, unknown> = {}) => {
    for (let i = 0; i < 3; i++) {
      app.update(1 / 30);
      app.render();
    }
    (window as unknown as { __wipShot: string }).__wipShot = canvas.toDataURL("image/jpeg", 0.92);
    (window as unknown as { __wipStats: unknown }).__wipStats = { ...stats, draws: app.stats.drawCalls.total, mode: g.mode, place: g.place, ...extra };
    document.title = "SHOT_READY";
  };
  // Mission scripts are async: let their promises settle between frames (a plain loop would starve them).
  const advance = async (secs: number) => {
    for (let t = 0; t < secs; t += 1 / 30) {
      app.update(1 / 30);
      // Microtasks only (offscreen views throttle timers): enough hops for a script to move on.
      for (let k = 0; k < 8; k++) await Promise.resolve();
    }
  };

  // Pose check (tools/shot.py): ?shot=1&pose=man,casual,womandress&anim=sit&yaw=0.6 lines people up on the quad lawn
  // (&clip=walk_fwd plays a clip id, &speed=5.8 runs the blend space in place, &t= seconds to advance).
  // ?cast=npc.jiya,special.taty dresses each placeholder as the real cast member (look, height, extras).
  if (params.has("pose") || params.has("cast")) {
    hud.hideLoading();
    const castMode = params.has("cast");
    const models = (params.get(castMode ? "cast" : "pose")!).split(",");
    const anim = (params.get("anim") ?? "idle") as import("./world/people.ts").AnimName;
    const gap = num("gap", 1.3);
    const ps = models.map((k, i) => {
      const member = castMode ? CAST[k] : undefined;
      const cm = people.find((p) => p.key === (member ? member.look.model : k)) ?? people[0]!;
      const look = member ? { ...member.look } : { model: cm.key, skin: "#a06a46", hair: "#141010", outfit: ["#2a5fa8", "#e0a526", "#2b2b2b", "#f4f1ea", "#a83232"], headwear: "none" as const, headwearColor: "#fff" };
      // Debug: &headwear=none hides the hijab/cap (checks what belongs to the headwear mesh).
      if (params.get("headwear") === "none") look.headwear = "none";
      const p = new Person(app, cm, look, app.root, { extras: member?.extras });
      p.forceLod = params.get("lod") === "1" ? 1 : 0; // full detail (the showcase camera moves before the pose camera each frame)
      // Height and build from the cast sheet (plan rule C6: within a few per cent).
      const h = member?.height ?? 1;
      p.root.setLocalScale(h * (member?.width ?? 1), h, h * (member?.width ?? 1));
      p.place(-16 + (i - (models.length - 1) / 2) * gap, surfaceAt(-16, -172), -172, num("yaw", 0.4));
      return p;
    });
    g.hours = 11;
    const t0 = num("t", 2);
    let started = false;
    app.on("update", (dt: number) => {
      if (!started) {
        started = true;
        // &clip=<id> plays any clip from the packs (&upper=1 on the upper body); &speed=<m/s> drives the
        // locomotion blend space in place (feet move as if walking at that speed); otherwise &anim= is a mission anim.
        for (const p of ps) {
          if (params.get("rest") === "1") p.showBindPose();
          else if (params.has("speed")) {
            p.driven = true;
            p.anim.input.speed = num("speed", 0);
          } else if (params.has("clip")) p.play(params.get("clip")!, { hold: true, upper: params.get("upper") === "1", blend: 0.01 });
          else p.act(anim);
        }
      }
      for (const p of ps) p.update(dt);
      cam.setPosition(-16 + num("cx", 0), num("cy", 1.2), -172 + num("cz", 3.6));
      cam.lookAt(-16, num("ly", 0.9), -172);
    });
    if (SHOT) {
      await advance(t0);
      return finishShot({ anim: ANIM_STATS, clips: ANIM.clips.size, state: ps.map((p) => p.anim.state) });
    }
    return;
  }
  const view = params.get("view") as keyof typeof VIEWPOINTS | null;
  if (params.has("menu")) {
    hud.hideLoading();
    menu = new Menu(host, app, cam, people, settings, progress, { story: story.missions, debug: DEBUG, onPlay: () => undefined });
    g.hours = num("time", menu.hour);
    menu.showScreen(params.get("menu") as "title");
    if (SHOT) {
      await advance(num("t", 3));
      menu.freeze();
      finishShot();
    }
    return;
  }
  if (params.has("cut") || params.has("mission") || params.get("intro") === "0" || view || SHOT) {
    hud.hideLoading();
    // ?look=f: a young woman in a hijab (to check the lines that react to the player).
    const look: Look = params.get("look") === "f" ? { model: "womancasual", skin: "#b5794f", hair: "#141010", outfit: ["#2f8a4c", "#2b2b2b", "#f4f1ea", "#f4f1ea"], headwear: "hijab", headwearColor: "#5b4ba8" } : loadLook();
    if (SHOT) progress = newProgress(params.get("name") ?? (["animwoman", "womandress", "womancasual"].includes(look.model) ? "Amina" : "Musa"));
    startStory(look, progress.name || "Fresher", progress, { fresh: SHOT });
    if (params.has("cut")) {
      g.newRun();
      g.hours = num("time", g.hours);
      void g.cutscene(params.get("cut")!).catch(() => undefined);
      if (SHOT) {
        await advance(num("at", 5));
        return finishShot({ t: g.director?.t ?? -1, cut: params.get("cut"), cast: g.castState() });
      }
    } else if (params.has("mission")) {
      const def = MISSION_DEFS.find((d) => d.id === params.get("mission"));
      if (def) {
        const idx = Math.max(0, def.steps.findIndex((s) => s.n === num("step", def.steps[0]!.n)));
        void campaign.run(def, idx, idx > 0);
      }
      if (SHOT) {
        await advance(num("t", 3));
        if (params.has("walk")) {
          input.hold("w");
          await advance(num("walk", 2));
          input.hold("w", false);
        }
        if (g.director && params.has("at")) await advance(num("at", 0));
        return finishShot({ t: g.director?.t ?? -1, objective: g.objective?.text ?? null, mission: campaign.current, x: g.player.x, z: g.player.z, cast: g.castState(), nav: g.navs.agents.agents.map((a) => ({ x: +a.x.toFixed(2), z: +a.z.toFixed(2), st: a.status, hold: a.hold, stuck: +a.maxStuck.toFixed(1), path: a.path.length, c: a.corner })) });
      }
    } else if (view && VIEWPOINTS[view]) {
      playing = false;
      const v = VIEWPOINTS[view];
      showcase.update = () => {
        cam.setPosition(v.pos[0], v.pos[1], v.pos[2]);
        cam.lookAt(v.look[0], v.look[1], v.look[2]);
      };
      hud.showHud(params.get("hud") !== "0");
      if (SHOT) {
        await advance(num("frames", 90) / 30);
        return finishShot();
      }
    } else if (params.has("px")) {
      g.newRun();
      g.keepDoors();
      g.teleport({ pos: [num("px", 0), 0, num("pz", -40)], where: "world" }, num("pyaw", Math.PI));
      // The campaign's opening sets its own hour: the URL's wins in free roam.
      if (params.has("time")) g.hours = num("time", g.hours);
      // &coil=dormant|humming|lit and &cats=1 (to see the Garden coil), &seals=n.
      if (params.has("coil")) g.coilOverride = params.get("coil") as "lit";
      if (params.get("cats") === "1") g.showPropPublic("prop.cats_ring", true);
      if (params.has("seals")) for (let i = 0; i < num("seals", 0); i++) g.progress.flags[`seal_${i}`] = true;
      // &gx=..&gz=..: an objective there (to see the ground arrows).
      if (params.has("gx")) g.setObjective("Test", "Go here", { pos: [num("gx", 0), 0, num("gz", 0)], where: params.get("gw") ?? "world", label: "here" });
      if (params.has("cyaw")) g.follow.yaw = num("cyaw", Math.PI);
      if (params.has("cdist")) g.follow.dist = num("cdist", 5);
      if (params.has("cpitch")) g.follow.pitch = num("cpitch", 0.3);
      if (SHOT) {
        if (params.has("walk")) {
          // &key=d walks across the camera's view (a side view mid-stride); &hold=1 keeps walking for the shot.
          const key = params.get("key") ?? "w";
          input.hold(key);
          if (params.get("run") === "1") input.hold("shift");
          await advance(num("walk", 2));
          // &then=s&walk2=0.3: switch to another key (a reversal for the run pivot).
          if (params.has("then")) {
            input.hold(key, false);
            input.hold(params.get("then")!);
            await advance(num("walk2", 0.3));
          }
          if (params.get("hold") !== "1") {
            input.hold(key, false);
            if (params.has("then")) input.hold(params.get("then")!, false);
            input.hold("shift", false);
          }
        }
        // &jump=0.3: press Space, keep it held, and take the shot that many seconds later.
        if (params.has("jump")) {
          input.tap(" ");
          input.hold(" ");
          await advance(num("jump", 0.3));
        }
        await advance(num("frames", 90) / 30);
        return finishShot();
      }
    }
    return;
  }

  /* ------------------------------------------------------- the title screen and menu */
  hud.hideLoading();
  menu = new Menu(host, app, cam, people, settings, progress, {
    story: story.missions,
    debug: DEBUG,
    onPlay: (look, name, fresh, replay) => {
      menu?.dispose();
      menu = null;
      if (fresh) progress = { ...newProgress(name), version: progress.version };
      startStory(look, name, progress, { fresh });
      const def = replay ? MISSION_DEFS.find((d) => d.id === replay) : null;
      if (def) void campaign.run(def, 0, false);
    },
  });
  g.hours = menu.hour;
  menu.showScreen("title");
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
