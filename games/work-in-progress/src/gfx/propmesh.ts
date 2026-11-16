/**
 * Movable props built with the same Builder as the static town (one mesh per
 * material, under one entity): the goat, the bicycle, the cats, the crate,
 * the note under the door, the coil's glow, the gown... Anything a cutscene
 * shows, hides or moves.
 */
import * as pc from "playcanvas";
import { Builder, MeshData } from "./builder.ts";
import type { MatLib } from "./materials.ts";

export function meshFromData(device: pc.GraphicsDevice, d: MeshData): pc.Mesh {
  const mesh = new pc.Mesh(device);
  mesh.setPositions(new Float32Array(d.pos));
  mesh.setNormals(new Float32Array(d.nor));
  mesh.setUvs(0, new Float32Array(d.uv));
  mesh.setColors32(new Uint8Array(d.col));
  mesh.setIndices(d.vertexCount > 65535 ? new Uint32Array(d.idx) : new Uint16Array(d.idx));
  mesh.update(pc.PRIMITIVE_TRIANGLES);
  return mesh;
}

/** Build a prop around its own origin (0, 0, 0 = its feet; +z = its front). */
export function makeProp(app: pc.AppBase, mats: MatLib, name: string, build: (b: Builder) => void, opts: { shadows?: boolean; override?: Record<string, pc.Material> } = {}): pc.Entity {
  const byMat = new Map<string, MeshData>();
  const b = new Builder((mat) => {
    let d = byMat.get(mat);
    if (!d) byMat.set(mat, (d = new MeshData()));
    return d;
  });
  b.at(0, 0);
  build(b);
  const e = new pc.Entity(name);
  const mis: pc.MeshInstance[] = [];
  for (const [mat, d] of byMat) {
    if (!d.idx.length) continue;
    mis.push(new pc.MeshInstance(meshFromData(app.graphicsDevice, d), opts.override?.[mat] ?? mats.get(mat)));
  }
  e.addComponent("render", { meshInstances: mis, castShadows: opts.shadows ?? true, receiveShadows: true });
  return e;
}
