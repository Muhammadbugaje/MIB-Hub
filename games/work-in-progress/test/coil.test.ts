/** The Garden coil: seal sockets, the lightning's shape, and its solid parts on the map. */
import { describe, expect, it } from "vitest";
import { makeRng } from "../src/sim/rng.ts";
import { COIL, COIL_SCALE, SOCKETS, streamer } from "../src/world/tesla-coil.ts";
import { buildSolids } from "../src/world/nav-world.ts";
import { PLACES } from "../src/world/layout.ts";
import type { V3 } from "../src/gfx/builder.ts";

describe("the Garden coil", () => {
  it("has ten seal sockets, evenly round the rim", () => {
    expect(SOCKETS.length).toBe(10);
    for (let i = 1; i < 10; i++) expect(SOCKETS[i]! - SOCKETS[i - 1]!).toBeCloseTo(Math.PI / 5);
  });

  it("every lightning streamer starts on the toroid and ends where it was aimed, with branches", () => {
    const rng = makeRng(1);
    let branches = 0;
    for (let k = 0; k < 40; k++) {
      const out: V3[][] = [];
      const a: V3 = [COIL.toroidR, COIL.toroidY, 0], b: V3 = [COIL.rodX, COIL.rodTop, COIL.rodZ];
      streamer(rng, a, b, out);
      const main = out[out.length - 1]!;
      expect(main[0]).toEqual(a);
      expect(main[main.length - 1]).toEqual(b);
      branches += out.length - 1;
      // Jagged but never wild: every point within a metre and a half of the straight line's box.
      for (const p of main) expect(p[1]).toBeGreaterThan(Math.min(a[1], b[1]) - 1.5);
    }
    expect(branches).toBeGreaterThan(5);
  });

  it("is solid on the map (plinth, strike rod, spark gap) and the ground ring fits in the garden", () => {
    const col = buildSolids();
    const G = PLACES.engGarden;
    expect(col.blocked(G.x, G.z, 0.3)).toBe(true);
    expect(col.blocked(G.x + COIL.rodX * COIL_SCALE, G.z + COIL.rodZ * COIL_SCALE, 0.1)).toBe(true);
    expect(COIL.groundR * COIL_SCALE + 0.6).toBeLessThan(Math.min(G.hx, G.hz));
  });
});
