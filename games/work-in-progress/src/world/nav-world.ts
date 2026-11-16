/**
 * The map as the navigator sees it: what is solid (the same CollisionWorld the
 * player bumps into) and what kind of ground each point is (read from the
 * same layout the roads and paths are drawn from), plus the doors that join
 * the map to the interiors.
 *
 * `buildSolids` fills a CollisionWorld without a GPU (tests, headless checks):
 * buildings, props, campus pieces, interiors and tree trunks, exactly as the
 * game adds them at load.
 */
import { Builder, MeshData } from "../gfx/builder.ts";
import type { SignAtlas } from "../gfx/textures.ts";
import { CollisionWorld } from "../sim/collide.ts";
import type { GroundKind, NavWorld } from "../sim/nav.ts";
import { buildBuilding } from "./buildings.ts";
import { buildCampus } from "./campus.ts";
import { doorColliders, doorSpecs } from "./door-plan.ts";
import { INTERIORS, INTERIOR_X0, interiorOrigin, wallsOf } from "./interior-plan.ts";
import { extraSolids } from "./interiors.ts";
import { buildings, crossings, trees } from "./layout.ts";
import { trunkCollider } from "./nature.ts";
import { buildProps } from "./props.ts";
import { Y } from "./roads.ts";
import { surfaceHeight } from "./surface.ts";

/** Ground kind under a point: zebra crossings first, then whatever surface is there. */
export function groundKind(x: number, z: number): GroundKind {
  if (x > INTERIOR_X0 - 100) return "floor";
  for (const c of crossings) {
    const along = c.alongX ? Math.abs(x - c.x) : Math.abs(z - c.z);
    const across = c.alongX ? Math.abs(z - c.z) : Math.abs(x - c.x);
    if (along <= 2.2 && across <= c.width / 2 + 0.4) return "crossing";
  }
  const h = surfaceHeight(x, z);
  const is = (v: number) => Math.abs(h - v) < 1e-4;
  if (is(Y.road) || is(Y.ring)) return "road";
  if (is(Y.walk) || is(Y.path) || is(Y.pathEdge) || is(Y.paving) || h > 0.2) return "path";
  if (is(Y.laterite)) return "rough";
  return "lawn";
}

/** The navigator's view of a CollisionWorld. */
export function navWorld(col: CollisionWorld): NavWorld {
  return { blocked: (x, z, r) => col.blocked(x, z, r), ground: groundKind };
}

const FAKE_SIGNS = { texture: null as never, uv: () => [0, 0, 1, 1] } as unknown as SignAtlas;

/** Every solid on the map and indoors, built without a GPU (same calls as main.ts). */
export function buildSolids(): CollisionWorld {
  const col = new CollisionWorld();
  const b = new Builder(() => new MeshData());
  for (const B of buildings) buildBuilding({ b, signs: FAKE_SIGNS, col }, B);
  buildProps(b, FAKE_SIGNS, col);
  buildCampus(b, FAKE_SIGNS, col);
  for (const p of INTERIORS) {
    const [ox, oz] = interiorOrigin(p);
    for (const w of wallsOf(p)) col.add({ kind: "box", x: ox + w.x, z: oz + w.z, hx: w.hx, hz: w.hz, rot: 0 });
    for (const i of p.items) if (!i.soft) col.add({ kind: "box", x: ox + i.x, z: oz + i.z, hx: i.hx, hz: i.hz, rot: i.rot });
    for (const i of p.items) for (const e of extraSolids(i)) col.add({ kind: "box", x: ox + e.x, z: oz + e.z, hx: e.hx, hz: e.hz, rot: i.rot });
  }
  for (const t of trees) if (t.kind !== "far") col.add(trunkCollider(t));
  for (const c of doorColliders(doorSpecs(surfaceHeight))) col.add(c);
  return col;
}
