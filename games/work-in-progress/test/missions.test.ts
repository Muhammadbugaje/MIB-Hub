/**
 * Missions 1-10: staging, branches, triggers, saves, and the no-overlap rules
 * for the new interiors, campus places and actor marks.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as pc from "playcanvas";
import { describe, expect, it } from "vitest";
import { Builder, MeshData } from "../src/gfx/builder.ts";
import { CollisionWorld, pushOut } from "../src/sim/collide.ts";
import { makePath } from "../src/sim/path.ts";
import { makeRng } from "../src/sim/rng.ts";
import { buildGraph, makeWalker, separate, stepWalker } from "../src/sim/crowd.ts";
import { type Vehicle, stepTraffic } from "../src/sim/traffic.ts";
import { parseMissionFile } from "../src/story/parse.ts";
import { CAMPUS_ANCHORS, SCULPTURES, buildCampus } from "../src/world/campus.ts";
import { INTERIORS, interiorOrigin, onFloor, wallsOf } from "../src/world/interior-plan.ts";
import { extraSolids } from "../src/world/interiors.ts";
import { insideBuilding, lanes, walkLines } from "../src/world/layout.ts";
import { senateSteps, surfaceHeight } from "../src/world/surface.ts";
import { type A3, type CamAnchor, Director, type PlayerCtx, type StageActor, type StageWorld } from "../src/game/director.ts";
import { EXTRA_INTERIOR_ANCHORS, EXTRA_WORLD_ANCHORS, STAGES } from "../src/game/missions/stages.ts";
import { worldAnchors, worldDoors } from "../src/game/missions/places.ts";
import { MISSION_DEFS, MISSION_ORDER } from "../src/game/missions/scripts.ts";
import { addItem, applyEndState, newProgress, nextMission, parseSave, passMission, serialise } from "../src/game/save.ts";
import { bargainStep, lectureScore } from "../src/game/minigames.ts";

const ROOT = resolve(__dirname, "../../..");
const missions = parseMissionFile(readFileSync(resolve(ROOT, "docs/plan/missions/Y1.md"), "utf8")).filter((m) => m.num <= 10);
const cuts = missions.flatMap((m) => m.cutscenes);

const ctx = (female: boolean, specials = { jiya: false, taty: false, madison: false }): PlayerCtx => ({ name: "Amina", female, topColour: "blue", headwear: female ? "hijab" : "none", headColour: "navy", roomie: female ? "Firdausi" : "Bature", specials });

/* ------------------------------------------------------------ a headless anchor resolver (the same tables the game uses) */

function anchorIn(name: string, where: string, female: boolean): A3 | CamAnchor | null {
  if (where === "world") return ({ ...CAMPUS_ANCHORS, ...worldAnchors(female), ...EXTRA_WORLD_ANCHORS } as Record<string, A3 | CamAnchor>)[name] ?? null;
  const plan = INTERIORS.find((p) => p.id === where);
  if (!plan) return null;
  const [ox, oz] = interiorOrigin(plan);
  if (name === "__origin") return [ox, 0, oz];
  const a = EXTRA_INTERIOR_ANCHORS[where]?.[name] ?? plan.anchors[name];
  if (!a) return null;
  const conv = (p: A3): A3 => [ox + p[0], p[1], oz + p[2]];
  return Array.isArray(a) ? conv(a) : { pos: conv(a.pos), to: a.to ? conv(a.to) : undefined, fov: a.fov };
}

/** A fake world: actors are plain entities, every call is recorded. */
function fakeWorld(female: boolean, log: string[]): StageWorld {
  const cam = new pc.Entity("cam");
  cam.addComponent = (() => undefined) as never;
  const ents = new Map<string, pc.Entity>();
  return {
    cam,
    anchor: (n, w) => anchorIn(n, w, female),
    actor: (role): StageActor => {
      let e = ents.get(role);
      if (!e) ents.set(role, (e = new pc.Entity(role)));
      return { kind: role === "CAR" || role === "KEKE" ? "vehicle" : role === "GOAT" ? "goat" : "prop", ent: e, radius: role === "CAR" ? 0 : 0.3 };
    },
    ground: (x, z) => surfaceHeight(x, z),
    clearCam: (p) => p,
    prop: () => null,
    showProp: (id, _at, on) => log.push(`prop ${id} ${on}`),
    light: (p) => log.push(`light ${p}`),
    fx: (id) => log.push(`fx ${id}`),
    sfx: (c) => log.push(`sfx ${c}`),
    music: (c) => log.push(`music ${c}`),
    say: (l) => l.id && log.push(`say ${l.id} ${l.text}`),
    speakerName: (r) => r,
    ui: { letterbox: () => undefined, subtitle: () => undefined, fade: () => undefined, skipButton: () => undefined, titleCard: () => undefined, calendar: () => undefined },
    gameplayCam: () => ({ pos: [0, 2, 0], look: [0, 1, 1] }),
    crowd: () => undefined,
    clearCrowd: () => undefined,
  };
}

function run(cutId: string, c: PlayerCtx, skipAt: number | null): { log: string[]; end: Record<string, [number, number]>; player: A3 | null } {
  const cut = cuts.find((x) => x.id === cutId)!;
  const stage = STAGES[cutId]!(c);
  const log: string[] = [];
  let player: A3 | null = null;
  const d = new Director(cut, stage, fakeWorld(c.female, log), c, (_e, at) => (player = at));
  for (let t = 0; t < cut.maxDuration + 2 && !d.done; t += 1 / 30) d.update(1 / 30, skipAt !== null && t >= skipAt);
  return { log, end: d.endPositions(), player };
}

/* ------------------------------------------------------------ */

describe("staging: every cutscene in M1-M10 is staged and every name resolves", () => {
  it("has a stage for each of the 35 blocks", () => {
    expect(cuts.map((c) => c.id).filter((id) => !STAGES[id])).toEqual([]);
  });

  for (const female of [false, true]) {
    it(`every camera anchor, look target, walk target and mark resolves (${female ? "female" : "male"} player)`, () => {
      const missing: string[] = [];
      for (const cut of cuts) {
        const st = STAGES[cut.id]!(ctx(female, { jiya: true, taty: true, madison: true }));
        const roles = new Set([...Object.keys(st.actors), ...Object.keys(cut.cast)]);
        const has = (raw: string): boolean => {
          if (!raw || roles.has(raw)) return true;
          if (["family_car", "keke", "bicycle"].includes(raw)) return true;
          const name = st.aliases?.[raw] ?? raw;
          if (st.anchors?.[name]) return true;
          const k = name.indexOf(":");
          if (k > 0) return !!anchorIn(name.slice(k + 1), name.slice(0, k), female);
          if (name.startsWith("prop.")) return true; // props resolve at run time
          return !!anchorIn(name, st.where, female);
        };
        for (const e of [...cut.timeline, ...(st.extra ?? [])]) {
          for (const key of ["from", "look", "to", "at"]) {
            const v = (e.args as Record<string, unknown>)[key];
            if (typeof v === "string" && !(e.key.startsWith("say") || e.key === "title.card" || e.key === "calendar.show")) if (!has(v)) missing.push(`${cut.id} ${e.key}.${key}=${v}`);
          }
        }
        for (const [r, p] of Object.entries(st.actors)) if (typeof p.at === "string" && !has(p.at)) missing.push(`${cut.id} mark ${r}=${p.at}`);
        const pl = cut.endState.PLAYER as { at?: string } | undefined;
        if (!st.end && pl?.at && !has(pl.at)) missing.push(`${cut.id} endState ${pl.at}`);
        if (st.end && typeof st.end.at === "string" && !has(st.end.at)) missing.push(`${cut.id} end ${st.end.at}`);
      }
      expect(missing).toEqual([]);
    });
  }
});

describe("director: branches, skip equals watch, no overlaps", () => {
  it("plays the [IF special.jiya] lines only when she is on, and the fallback otherwise", () => {
    const on = run("cut_m002_open", ctx(false, { jiya: true, taty: false, madison: false }), null).log.filter((l) => l.startsWith("say"));
    const off = run("cut_m002_open", ctx(false), null).log.filter((l) => l.startsWith("say"));
    expect(on.some((l) => l.includes("m002_open_j01"))).toBe(true);
    expect(off.some((l) => l.includes("m002_open_j01"))).toBe(false);
    // The rest of the scene is identical.
    expect(off).toEqual(on.filter((l) => !l.includes("_j0")));
  });

  it("reacts to who the player is (the law lecturer's line, Mum's outfit line)", () => {
    const f = run("cut_m005_open", ctx(true), null).log.find((l) => l.includes("m005_open_01"))!;
    const m = run("cut_m005_open", ctx(false), null).log.find((l) => l.includes("m005_open_01"))!;
    expect(f).toContain("m005_open_01_f");
    expect(f).toContain("young lady");
    expect(m).toContain("gentleman");
    const mum = run("cut_m001_film_b", ctx(true), null).log.find((l) => l.includes("wip_m001_film_b_01"))!;
    expect(mum).toContain("hijab");
  });

  it("skipping ends with everyone exactly where watching ends (rule A8)", () => {
    for (const cut of cuts) {
      const watched = run(cut.id, ctx(false), null);
      const skipped = run(cut.id, ctx(false), 0.5);
      for (const [role, p] of Object.entries(watched.end)) {
        const q = skipped.end[role]!;
        expect(Math.hypot(p[0] - q[0], p[1] - q[1]), `${cut.id} ${role}`).toBeLessThan(0.75);
      }
      expect(JSON.stringify(skipped.player), cut.id).toBe(JSON.stringify(watched.player));
    }
  });

  it("actors never stand inside each other at the start or the end of a scene", () => {
    const bad: string[] = [];
    for (const cut of cuts) {
      for (const female of [false, true]) {
        const st = STAGES[cut.id]!(ctx(female));
        const r = run(cut.id, ctx(female), null);
        const people = Object.entries(r.end).filter(([role]) => !["CAR", "KEKE"].includes(role) && !st.actors[role]?.hidden);
        for (let i = 0; i < people.length; i++)
          for (let j = i + 1; j < people.length; j++) {
            const [a, p] = people[i]!, [b, q] = people[j]!;
            // Riders in the same car and pairs that hug stand close on purpose.
            if (["MUM", "DAD", "PLAYER"].includes(a) && ["MUM", "DAD", "PLAYER"].includes(b) && cut.id.startsWith("cut_m001_film_b")) continue;
            const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
            if (d < 0.5) bad.push(`${cut.id} ${a}/${b} ${d.toFixed(2)}`);
          }
      }
    }
    expect(bad).toEqual([]);
  });
});

/* ------------------------------------------------------------ the places: interiors, campus, marks */

function solids(): CollisionWorld {
  const col = new CollisionWorld();
  const b = new Builder(() => new MeshData());
  buildCampus(b, { texture: null as never, uv: () => [0, 0, 1, 1] }, col);
  for (const p of INTERIORS) {
    const [ox, oz] = interiorOrigin(p);
    for (const w of wallsOf(p)) col.add({ kind: "box", x: ox + w.x, z: oz + w.z, hx: w.hx, hz: w.hz, rot: 0 });
    for (const i of p.items) if (!i.soft) col.add({ kind: "box", x: ox + i.x, z: oz + i.z, hx: i.hx, hz: i.hz, rot: i.rot });
    for (const i of p.items) for (const e of extraSolids(i)) col.add({ kind: "box", x: ox + e.x, z: oz + e.z, hx: e.hx, hz: e.hz, rot: i.rot });
  }
  return col;
}

describe("interiors: nothing overlaps, everything sits inside its room", () => {
  type R = { x: number; z: number; hx: number; hz: number; rot: number };
  const corners = (r: R): [number, number][] => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => {
    const c = Math.cos(r.rot), s = Math.sin(r.rot);
    return [r.x + a! * r.hx * c + b! * r.hz * s, r.z - a! * r.hx * s + b! * r.hz * c];
  });
  const overlap = (a: R, b: R) => {
    const ca = corners(a), cb = corners(b);
    const axes: [number, number][] = [];
    for (const cs of [ca, cb]) for (let i = 0; i < 2; i++) {
      const p = cs[i]!, q = cs[i + 1]!, l = Math.hypot(q[0] - p[0], q[1] - p[1]);
      axes.push([-(q[1] - p[1]) / l, (q[0] - p[0]) / l]);
    }
    return axes.every((ax) => {
      const pa = ca.map((p) => p[0] * ax[0] + p[1] * ax[1]), pb = cb.map((p) => p[0] * ax[0] + p[1] * ax[1]);
      return Math.max(...pa) - 0.005 > Math.min(...pb) && Math.max(...pb) - 0.005 > Math.min(...pa);
    });
  };

  it("no two solid pieces of furniture overlap", () => {
    const bad: string[] = [];
    for (const p of INTERIORS) {
      const items = p.items.filter((i) => !i.soft);
      for (let i = 0; i < items.length; i++)
        for (let j = i + 1; j < items.length; j++) if (overlap(items[i]!, items[j]!)) bad.push(`${p.id}: ${items[i]!.kind}@${items[i]!.x},${items[i]!.z} x ${items[j]!.kind}@${items[j]!.x},${items[j]!.z}`);
    }
    expect(bad).toEqual([]);
  });

  it("every item is inside a room and clear of the walls (wall-mounted decor excepted)", () => {
    const bad: string[] = [];
    for (const p of INTERIORS) {
      const walls = wallsOf(p);
      for (const i of p.items) {
        if (!corners(i).every(([x, z]) => onFloor(p, x, z, i.soft ? -0.1 : 0.05))) bad.push(`${p.id}: ${i.kind}@${i.x},${i.z} outside`);
        if (!i.soft && walls.some((w) => overlap(i, { ...w, rot: 0 }))) bad.push(`${p.id}: ${i.kind}@${i.x},${i.z} in a wall`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("doors, marks and anchors where people stand are on the floor and not inside furniture", () => {
    const col = solids();
    const bad: string[] = [];
    for (const p of INTERIORS) {
      const [ox, oz] = interiorOrigin(p);
      for (const d of p.doors) if (col.blocked(ox + d.x, oz + d.z, 0.3)) bad.push(`${p.id} door ${d.id}`);
      const marks = { ...p.anchors, ...(EXTRA_INTERIOR_ANCHORS[p.id] ?? {}) };
      for (const [n, a] of Object.entries(marks)) {
        if (!Array.isArray(a) || a[1] !== 0) continue; // cameras and look targets float
        if (/seat|_sit$|bed$|^circle_|stool|waiting|garba_spot|jega_bed|chair/.test(n)) continue; // seated people sit on things by design
        if (!onFloor(p, a[0], a[2], 0.2)) bad.push(`${p.id} ${n} off the floor`);
        else if (col.blocked(ox + a[0], oz + a[2], 0.25)) bad.push(`${p.id} ${n} inside something`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("campus places", () => {
  it("story marks on the map are clear of buildings and solid props", () => {
    const col = solids();
    const bad: string[] = [];
    const walkers = ["spot_counter", "nkechi_spot", "suya_man_spot", "spot_exit_east", "garden_gate_outside", "tanko_spot", "court_centre", "sly_spot", "hassan_spot", "abbas_court", "baby_spot", "farm_gate", "sule_spot", "kola_stone", "jega_spot", "helen_spot", "sports_gate", "coach_spot", "water_spot", "ae_entrance", "lily_spot", "sculpture_garden_pond", "pond_path", "mai_shayi_bench"];
    for (const n of walkers) {
      const a = CAMPUS_ANCHORS[n]!;
      if (insideBuilding(a[0], a[2], 0.2)) bad.push(`${n} in a building`);
      else if (col.blocked(a[0], a[2], 0.28)) bad.push(`${n} inside a solid`);
    }
    for (const f of [false, true]) for (const [id, d] of Object.entries(worldDoors(f))) if (insideBuilding(d.at[0], d.at[2], 0) || col.blocked(d.at[0], d.at[2], 0.3)) bad.push(`door ${id} (${f})`);
    expect(bad).toEqual([]);
  });

  it("the stone people stand clear of the path through the Sculpture Garden and of the pond", () => {
    for (const [x, z] of SCULPTURES) {
      const pathZ = -100 + 0.403 * (x + 5.4);
      expect(Math.abs(z - pathZ), `${x},${z}`).toBeGreaterThan(2.4);
      expect(Math.hypot(x + 24, z + 116)).toBeGreaterThan(4.6);
    }
  });

  it("the Senate's steps are walked up, not through", () => {
    expect(senateSteps(0, -205)).toBeCloseTo(1.2, 5);
    expect(surfaceHeight(0, -205)).toBeCloseTo(1.2, 5);
    expect(senateSteps(0, -198.9)).toBe(0);
    expect(senateSteps(30, -205)).toBe(0);
  });
});

/* ------------------------------------------------------------ missions, saves, minigames */

describe("missions", () => {
  it("ten missions in story order, each with steps matching Y1.md", () => {
    expect(MISSION_ORDER).toEqual(missions.map((m) => m.key));
    for (const def of MISSION_DEFS) {
      const story = missions.find((m) => m.key === def.id)!;
      const storyN = new Set(story.steps.map((s) => s.n));
      for (const st of def.steps) if (st.n > 0) expect(storyN.has(st.n), `${def.id} step ${st.n}`).toBe(true);
      // Every story step is played (some share a script step: the comments in scripts.ts say which).
      const played = new Set(def.steps.map((s) => s.n));
      const folded: Record<string, number[]> = { m002: [3], m003: [6], m006: [6], m007: [3, 4], m009: [6], m010: [6] };
      for (const n of storyN) expect(played.has(n) || (folded[def.id] ?? []).includes(n), `${def.id} step ${n} missing`).toBe(true);
    }
  });

  it("every cutscene in M1-M10 is played by some mission script", () => {
    const src = readFileSync(resolve(__dirname, "../src/game/missions/scripts.ts"), "utf8");
    const missing = cuts.map((c) => c.id).filter((id) => !src.includes(`"${id}"`));
    expect(missing).toEqual([]);
  });
});

describe("saves", () => {
  it("round-trips, upgrades old saves and refuses newer ones with a message", () => {
    const p = newProgress("Amina");
    p.money = 4200;
    addItem(p, "note_maker");
    const back = parseSave(serialise(p));
    expect(back.ok && back.progress.money).toBe(4200);
    expect(back.ok && back.progress.items.note_maker).toBe(1);
    const old = parseSave(JSON.stringify({ version: 0, name: "Musa", done: ["m001"] }));
    expect(old.ok && old.progress.done).toEqual(["m001"]);
    const newer = parseSave(JSON.stringify({ version: 99 }));
    expect(newer.ok).toBe(false);
    expect(!newer.ok && newer.message).toMatch(/newer/);
    expect(parseSave("{not json").ok).toBe(false);
  });

  it("applies cutscene end states (money set or added, items, flags)", () => {
    const p = newProgress();
    applyEndState(p, { PLAYER: { items: { naira: 5000 } }, flags: { film_c: true } });
    expect(p.money).toBe(5000);
    applyEndState(p, { PLAYER: { items: { zobo_max: 1, naira: "+1000" } }, flags: { m010_done: true } });
    expect(p.money).toBe(6000);
    expect(p.items.zobo_max).toBe(1);
    expect(p.flags).toMatchObject({ film_c: true, m010_done: true });
  });

  it("pays a mission's reward once, even when replayed", () => {
    const p = newProgress();
    let paid = 0;
    expect(passMission(p, "m001", (q) => (q.money += 500, paid++))).toBe(true);
    expect(passMission(p, "m001", (q) => (q.money += 500, paid++))).toBe(false);
    expect(paid).toBe(1);
    expect(p.money).toBe(500);
    expect(nextMission(p.done, MISSION_ORDER)).toBe("m002");
    expect(nextMission(MISSION_ORDER, MISSION_ORDER)).toBeNull();
  });
});

describe("minigame rules", () => {
  it("bargaining never goes below the floor and ends", () => {
    let price = 800, patience = 3, round = 0, final = false;
    while (!final) {
      const r = bargainStep(price, 300, 0.5, patience, 0, ++round);
      expect(r.price).toBeGreaterThanOrEqual(300);
      expect(r.price).toBeLessThanOrEqual(price);
      ({ price, patience, final } = r);
      expect(round).toBeLessThan(6);
    }
  });

  it("charm gets a better price", () => {
    expect(bargainStep(800, 300, 0.8, 3, 3, 1).price).toBeLessThan(bargainStep(800, 300, 0.8, 3, 0, 1).price);
  });

  it("lecture score is 0..1 and rewards key lines and the right answer", () => {
    expect(lectureScore(4, 0, true)).toBe(1);
    expect(lectureScore(0, 5, false)).toBe(0);
    expect(lectureScore(2, 0, true)).toBeGreaterThan(lectureScore(2, 0, false));
  });
});

/* ------------------------------------------------------------ traffic and crowds */

describe("traffic gives way: no two vehicles overlap, even at the roundabout", () => {
  it("runs two minutes of busy traffic with no collisions", () => {
    const paths = lanes.map((l) => makePath(l.pts));
    const rng = makeRng(5);
    const vs: Vehicle[] = [];
    for (let i = 0; i < 40; i++) {
      const lane = i % lanes.length, path = paths[lane]!;
      const kind = lanes[lane]!.kinds[i % lanes[lane]!.kinds.length]!;
      vs.push({ kind, path: lane, s: (i * 37) % path.length, speed: 0, cruise: kind === "car" ? 9 : 7, length: kind === "car" ? 4.2 : kind === "keke" ? 2.7 : 1.95, x: 0, z: 0, dx: 1, dz: 0, wait: rng.range(0, 3) });
    }
    // Spread the start so nobody begins on top of anyone else.
    stepTraffic(vs, paths, 0);
    let worst = Infinity, where = "";
    for (let t = 0; t < 120; t += 1 / 60) {
      stepTraffic(vs, paths, 1 / 60);
      if (t < 4) continue;
      for (let i = 0; i < vs.length; i++)
        for (let j = i + 1; j < vs.length; j++) {
          const a = vs[i]!, b = vs[j]!;
          if (a.wait > 0 || b.wait > 0) continue;
          // Bodies as oriented boxes.
          const ba = { kind: "box" as const, x: a.x, z: a.z, hx: a.kind === "car" ? 0.9 : 0.45, hz: a.length / 2, rot: Math.atan2(a.dx, a.dz) };
          const hit = pushOut(ba, b.x + b.dx * b.length * 0.4, b.z + b.dz * b.length * 0.4, b.kind === "car" ? 0.8 : 0.4) || pushOut(ba, b.x - b.dx * b.length * 0.4, b.z - b.dz * b.length * 0.4, b.kind === "car" ? 0.8 : 0.4);
          const d = Math.hypot(a.x - b.x, a.z - b.z);
          if (hit && d < worst) {
            worst = d;
            where = `${a.kind}#${i} lane ${a.path} x ${b.kind}#${j} lane ${b.path} at ${a.x.toFixed(1)},${a.z.toFixed(1)} t=${t.toFixed(1)}`;
          }
        }
    }
    expect(where).toBe("");
  }, 60_000);
});

describe("crowd: people pass each other instead of walking through", () => {
  it("keeps walkers apart on busy paths", () => {
    const g = buildGraph(walkLines);
    const rng = makeRng(3);
    const ws = Array.from({ length: 160 }, () => makeWalker(g, rng));
    let overlaps = 0, samples = 0;
    for (let k = 0; k < 900; k++) {
      for (const w of ws) stepWalker(w, g, 1 / 60, rng);
      separate(ws, g, [{ x: 0, z: -40, r: 0.33 }], 1 / 60);
      if (k < 300 || k % 10) continue;
      for (let i = 0; i < ws.length; i++)
        for (let j = i + 1; j < ws.length; j++) {
          samples++;
          if (Math.hypot(ws[i]!.x - ws[j]!.x, ws[i]!.z - ws[j]!.z) < 0.4) overlaps++;
        }
    }
    expect(samples).toBeGreaterThan(0);
    expect(overlaps).toBeLessThanOrEqual(3);
  }, 60_000);
});
