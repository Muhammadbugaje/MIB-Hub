/**
 * Trees up close: the instanced crowns read as smooth lumps from under them,
 * so near the camera (about 38 m) each crown gets a shell of leaf cards: small
 * crossed quads of painted leaf clusters (alpha-cut, two-sided) scattered over
 * and just outside the crown's surface, swaying with the same wind as the
 * crowns. They break up the silhouette and give the canopy depth; far trees
 * stay exactly as before. One instanced draw call per leaf colour (green, and
 * flame-tree orange); cards shrink away towards the edge of the patch.
 */
import * as pc from "playcanvas";
import { SH, windChunk } from "../gfx/materials.ts";
import { makeRng } from "../sim/rng.ts";
import type { TreeInfo } from "./nature.ts";

const RADIUS = 38;

/** A tileable-free leaf-cluster texture with alpha: overlapping pointed leaves in a few greens. */
function leafTexture(device: pc.GraphicsDevice, palette: string[], seed: number): pc.Texture {
  const S = 256;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  const rng = makeRng(seed);
  g.clearRect(0, 0, S, S);
  for (let i = 0; i < 70; i++) {
    const a = rng.range(0, Math.PI * 2), r = Math.sqrt(rng.next()) * S * 0.38;
    const x = S / 2 + Math.cos(a) * r, y = S / 2 + Math.sin(a) * r;
    const len = rng.range(S * 0.09, S * 0.15), wid = len * rng.range(0.32, 0.45);
    g.save();
    g.translate(x, y);
    g.rotate(a + rng.range(-0.8, 0.8));
    g.fillStyle = palette[Math.floor(rng.next() * palette.length)]!;
    g.beginPath();
    g.moveTo(-len / 2, 0);
    g.quadraticCurveTo(0, -wid, len / 2, 0);
    g.quadraticCurveTo(0, wid, -len / 2, 0);
    g.fill();
    // The midrib.
    g.strokeStyle = "rgba(20,40,10,0.35)";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(-len / 2, 0);
    g.lineTo(len / 2, 0);
    g.stroke();
    g.restore();
  }
  const t = new pc.Texture(device, { width: S, height: S, format: pc.PIXELFORMAT_RGBA8, mipmaps: true, minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR, magFilter: pc.FILTER_LINEAR, addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE });
  t.setSource(c);
  return t;
}

/** Two crossed quads, 1 m across, centred on the origin. */
function cardMesh(device: pc.GraphicsDevice): pc.Mesh {
  const h = 0.5;
  const pos = [-h, -h, 0, h, -h, 0, h, h, 0, -h, h, 0, 0, -h, -h, 0, -h, h, 0, h, h, 0, h, -h];
  // Normals bent outwards-and-up so the cards shade like a crown, not like flat sheets.
  const nor = [-0.4, 0.5, 0.75, 0.4, 0.5, 0.75, 0.4, 0.9, 0.2, -0.4, 0.9, 0.2, 0.75, 0.5, -0.4, 0.75, 0.5, 0.4, 0.2, 0.9, 0.4, 0.2, 0.9, -0.4];
  const uv = [0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1];
  const m = new pc.Mesh(device);
  m.setPositions(pos);
  m.setNormals(nor.map((v, i) => v / Math.hypot(nor[i - (i % 3)]!, nor[i - (i % 3) + 1]!, nor[i - (i % 3) + 2]!)));
  m.setUvs(0, uv);
  m.setIndices([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  m.update(pc.PRIMITIVE_TRIANGLES);
  return m;
}

class CardLayer {
  readonly data: Float32Array;
  readonly vb: pc.VertexBuffer;
  readonly mi: pc.MeshInstance;
  n = 0;
  constructor(app: pc.AppBase, mesh: pc.Mesh, tex: pc.Texture, readonly max: number) {
    const m = new pc.StandardMaterial();
    m.diffuseMap = tex;
    m.opacityMap = tex;
    m.opacityMapChannel = "a";
    m.alphaTest = 0.45;
    m.cull = pc.CULLFACE_NONE;
    m.twoSidedLighting = true;
    m.gloss = 0.2;
    m.useMetalness = true;
    m.metalness = 0;
    m.specularityFactor = 0.3;
    (m as unknown as { ambientSH: Float32Array }).ambientSH = SH;
    m.getShaderChunks(pc.SHADERLANGUAGE_GLSL).set("transformVS", windChunk(app.graphicsDevice, -6));
    m.setParameter("uWindStrength", 0.0012);
    m.update();
    this.data = new Float32Array(max * 16);
    this.vb = new pc.VertexBuffer(app.graphicsDevice, pc.VertexFormat.getDefaultInstancingFormat(app.graphicsDevice), max, { usage: pc.BUFFER_DYNAMIC, data: this.data });
    this.mi = new pc.MeshInstance(mesh, m);
    this.mi.setInstancing(this.vb);
    this.mi.cull = false;
    this.mi.instancingCount = 0;
    const e = new pc.Entity("tree-cards");
    e.addComponent("render", { meshInstances: [this.mi], castShadows: true, receiveShadows: true });
    app.root.addChild(e);
  }
}

const SHAPE: Partial<Record<TreeInfo["kind"], { flat: number; cards: number; bloom: number }>> = {
  neem: { flat: 0.62, cards: 170, bloom: 0 },
  mango: { flat: 0.85, cards: 190, bloom: 0 },
  flame: { flat: 0.42, cards: 210, bloom: 0.5 },
};

export class TreeCards {
  private green: CardLayer | null = null;
  private bloom: CardLayer | null = null;
  private cx = Infinity;
  private cz = Infinity;
  private m = new pc.Mat4();
  private q = new pc.Quat();
  private v = new pc.Vec3();
  private s = new pc.Vec3();

  constructor(app: pc.AppBase, private trees: TreeInfo[], private ground: (x: number, z: number) => number, enabled: boolean) {
    if (!enabled) return;
    const mesh = cardMesh(app.graphicsDevice);
    this.green = new CardLayer(app, mesh, leafTexture(app.graphicsDevice, ["#4f8a34", "#5f9a3c", "#3f7a2c", "#6fa846", "#2f5a24"], 11), 7000);
    this.bloom = new CardLayer(app, mesh, leafTexture(app.graphicsDevice, ["#e8452a", "#f05a28", "#ff7a30", "#d83a20", "#5f9a3c"], 12), 1800);
  }

  update(camX: number, camZ: number): void {
    if (!this.green || !this.bloom) return;
    if (camX > 1500) {
      this.green.mi.instancingCount = this.bloom.mi.instancingCount = 0;
      this.cx = Infinity;
      return;
    }
    if (Math.hypot(camX - this.cx, camZ - this.cz) < 3) return;
    this.cx = camX;
    this.cz = camZ;
    const G = this.green, F = this.bloom;
    G.n = F.n = 0;
    for (const t of this.trees) {
      const sh = SHAPE[t.kind];
      if (!sh) continue;
      const dist = Math.hypot(t.x - camX, t.z - camZ);
      if (dist > RADIUS + t.crownR) continue;
      // Shrink in from the edge of the patch (no line where the cards stop).
      const e = Math.min(1, Math.max(0, (RADIUS + t.crownR - dist) / 8));
      const fade = e * e * (3 - 2 * e);
      const rng = makeRng(Math.round(t.x * 13 + t.z * 7));
      const gy = this.ground(t.x, t.z);
      const n = Math.round(sh.cards * Math.min(1.4, t.crownR / 3.4));
      for (let i = 0; i < n; i++) {
        // A point on the crown's (flattened) surface, more on top and round the sides than underneath.
        const a = rng.range(0, Math.PI * 2);
        const up = Math.pow(rng.next(), 0.8) * 1.8 - 0.8;
        const ring = Math.sqrt(Math.max(0, 1 - up * up));
        const rr = t.crownR * rng.range(0.8, 1.06);
        const x = t.x + Math.cos(a) * ring * rr, z = t.z + Math.sin(a) * ring * rr;
        let y = gy + t.crownY + up * rr * sh.flat;
        // A share of the cards hang below the clusters (seen from under the tree, with sky between).
        if (up < -0.3 && rng.chance(0.45)) y -= rng.range(0.2, 0.8) * (t.crownR / 3.4);
        const flower = sh.bloom > 0 && rng.chance(sh.bloom);
        const L = flower ? F : G;
        if (L.n >= L.max) continue;
        const sc = rng.range(1.0, 1.7) * (t.crownR / 3.4) * fade;
        this.v.set(x, y, z);
        this.q.setFromEulerAngles(rng.range(-25, 25), rng.range(0, 360), rng.range(-25, 25));
        this.s.set(sc, sc, sc);
        this.m.setTRS(this.v, this.q, this.s);
        L.data.set(this.m.data, L.n * 16);
        L.n++;
      }
    }
    for (const L of [G, F]) {
      L.vb.setData(L.data);
      L.mi.instancingCount = L.n;
    }
  }
}
