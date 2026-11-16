/**
 * Static scenery collector: everything built with the Builder lands in
 * buckets by material and 64 m map chunk, then becomes a few big meshes.
 */
import * as pc from "playcanvas";
import { Builder, MeshData } from "../gfx/builder.ts";
import type { MatLib } from "../gfx/materials.ts";

const CHUNK = 64;

export class StaticWorld {
  private buckets = new Map<string, MeshData>();
  readonly b: Builder;
  constructor() {
    this.b = new Builder((mat, x, z) => this.bucket(mat, x, z));
  }

  bucket(mat: string, x: number, z: number): MeshData {
    const key = `${mat}|${Math.floor(x / CHUNK)}|${Math.floor(z / CHUNK)}`;
    let m = this.buckets.get(key);
    if (!m) this.buckets.set(key, (m = new MeshData()));
    return m;
  }

  /** Turn the buckets into render entities. Returns triangle and draw counts. */
  finalize(app: pc.AppBase, mats: MatLib, parent: pc.Entity, noShadow: Set<string>, noReceive = new Set<string>()): { tris: number; meshes: number } {
    let tris = 0, meshes = 0;
    const device = app.graphicsDevice;
    const byMat = new Map<string, pc.MeshInstance[]>();
    for (const [key, d] of this.buckets) {
      if (!d.idx.length) continue;
      const mat = key.split("|")[0]!;
      const mesh = new pc.Mesh(device);
      mesh.setPositions(new Float32Array(d.pos));
      mesh.setNormals(new Float32Array(d.nor));
      mesh.setUvs(0, new Float32Array(d.uv));
      mesh.setColors32(new Uint8Array(d.col));
      mesh.setIndices(d.vertexCount > 65535 ? new Uint32Array(d.idx) : new Uint16Array(d.idx));
      mesh.update(pc.PRIMITIVE_TRIANGLES);
      const mi = new pc.MeshInstance(mesh, mats.get(mat));
      let list = byMat.get(mat);
      if (!list) byMat.set(mat, (list = []));
      list.push(mi);
      tris += d.idx.length / 3;
      meshes++;
    }
    for (const [mat, list] of byMat) {
      const e = new pc.Entity(`static-${mat}`);
      e.addComponent("render", { meshInstances: list, castShadows: !noShadow.has(mat), receiveShadows: !noReceive.has(mat) });
      parent.addChild(e);
    }
    this.buckets.clear();
    return { tris, meshes };
  }
}
