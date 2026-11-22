/**
 * The crowd you see: walkers from sim/crowd.ts drawn as Person characters.
 * Fixed-step simulation with interpolated drawing; feet follow the surface
 * (sidewalk or road) with a spring; animation stops for people far from the
 * camera (simulation LOD, plan §4.7) and they keep their last pose.
 */
import { buildGraph, type CrowdSolids, pruneGraph, makeWalker, separate, stepWalker, type WalkGraph, type Walker } from "../sim/crowd.ts";
import { damp, dampAngle } from "../sim/motion.ts";
import type { Obstacle } from "../sim/traffic.ts";
import type { Rng } from "../sim/rng.ts";
import type { NavGrid } from "../sim/nav.ts";
import type { P2 } from "../sim/path.ts";
import { walkLines } from "./layout.ts";
import { type CharModel, Person, randomLook } from "./people.ts";
import { surfaceHeight } from "./surface.ts";
import type * as pc from "playcanvas";

interface Npc { w: Walker; p: Person; px: number; pz: number; py: number; pyaw: number; y: number; yaw: number; speed: number }

export class Crowd {
  readonly graph: WalkGraph;
  readonly npcs: Npc[] = [];

  /** lines: the walk lines (main.ts passes them routed round every solid thing, sim/crowd.ts clearLines). */
  constructor(app: pc.AppBase, parent: pc.Entity, models: CharModel[], private rng: Rng, count: number, shadows: boolean, lines: P2[][] = walkLines, nav?: NavGrid, private visDist = 210) {
    this.graph = nav ? pruneGraph(buildGraph(lines), nav) : buildGraph(lines);
    for (let i = 0; i < count; i++) {
      const w = makeWalker(this.graph, rng);
      const look = randomLook(rng, models);
      const cm = models.find((m) => m.key === look.model)!;
      const p = new Person(app, cm, look, parent, { shadows });
      // Walk a touch slower than the clip's stride for strollers, faster for the hurried.
      w.speed = cm.walkSpeed * 1.2 * rng.range(0.9, 1.1); // owner: "everything faster" (16 Nov)
      const y = surfaceHeight(w.x, w.z);
      this.npcs.push({ w, p, px: w.x, pz: w.z, py: y, pyaw: w.yaw, y, yaw: w.yaw, speed: 0 });
    }
  }

  /** Points other systems must avoid (traffic stops for people on crossings). */
  obstacles(out: Obstacle[]): void {
    for (const n of this.npcs) out.push({ x: n.w.x, z: n.w.z, r: 0.4 });
  }

  /** Obstacles the walkers keep clear of (the player, the story cast), set each step. */
  avoid: { x: number; z: number; r: number }[] = [];
  /** The map's colliders: side-steps never put a walker inside a wall, a tree or a bench. */
  solids: CrowdSolids | null = null;

  step(dt: number): void {
    for (const n of this.npcs) {
      n.px = n.w.x;
      n.pz = n.w.z;
      n.py = n.y;
      n.pyaw = n.yaw;
      stepWalker(n.w, this.graph, dt, this.rng, 0.12, this.solids ?? undefined);
      n.y = damp(n.y, surfaceHeight(n.w.x, n.w.z), 22, dt);
      n.yaw = dampAngle(n.yaw, n.w.yaw, 9, dt);
      n.speed = n.w.moving ? n.w.speed : 0;
    }
    separate(this.npcs.map((n) => n.w), this.graph, this.avoid, dt, 0.72, this.solids ?? undefined);
    for (const n of this.npcs) if (n.w.idle > 0) n.speed = 0;
  }

  render(alpha: number, camX: number, camZ: number): void {
    for (const n of this.npcs) {
      const x = n.px + (n.w.x - n.px) * alpha, z = n.pz + (n.w.z - n.pz) * alpha;
      let dy = n.yaw - n.pyaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      n.p.place(x, n.py + (n.y - n.py) * alpha, z, n.pyaw + dy * alpha);
      const d = Math.hypot(x - camX, z - camZ);
      n.p.animating = d < Math.min(this.visDist * 0.35, 75);
      n.p.visible = d < this.visDist;
      n.p.gait(n.speed);
    }
  }
}
