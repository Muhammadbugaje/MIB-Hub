/**
 * Story props: the things Missions 1-10 show, hide, carry and chase.
 *
 *  - Sarki the goat: white face, brown coat, little horns, a beard and a brass
 *    bell, with a trailing rope. Built in code (there is no free animated goat
 *    that fits), with a real four-beat walk and gallop: legs swing from the
 *    hips and shoulders, phase from distance travelled, so hooves never slide.
 *  - The ring of cats round the coil (eleven, facing out), with idle tail sway.
 *  - The bicycle (front basket for the goat): wheels and cranks turn from the
 *    distance travelled; rider seat, bar and pedal positions are data.
 *  - The keke for the hospital run, the note under the door, the tin with the
 *    symbol, the giant gown, the crate, the plug sign, the candle, the shade.
 *
 * All face +z, with their lowest point at y = 0 (nothing sinks, nothing floats).
 */
import * as pc from "playcanvas";
import type { Builder, RGBA } from "../gfx/builder.ts";
import type { MatLib } from "../gfx/materials.ts";
import { makeProp } from "../gfx/propmesh.ts";
import { kekeMesh } from "./vehicle-models.ts";

const hex = (h: string, a = 255): RGBA => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), a];

/* ------------------------------------------------------------ the goat */

export const GOAT = { legLen: 0.46, bodyY: 0.52, stride: 0.42 };

export class Goat {
  readonly root: pc.Entity;
  private legs: { e: pc.Entity; phase: number }[] = [];
  private head: pc.Entity;
  private tail: pc.Entity;
  private dist = 0;
  private bob = 0;
  x = 0;
  z = 0;
  yaw = 0;
  speed = 0;
  /** Seconds left of a "look at you" head turn. */
  lookT = 0;

  constructor(app: pc.AppBase, mats: MatLib) {
    this.root = new pc.Entity("goat");
    const COAT = hex("#8a5a3a"), FACE = hex("#f4efe6"), DARK = hex("#3a2a20"), HORN = hex("#c9b896");
    const body = makeProp(app, mats, "goat-body", (b) => {
      b.tint(COAT).blob("cloth", [0, GOAT.bodyY + 0.1, -0.02], 0.26, 3, COAT, hex("#6e462c"), 0.82, 12, 8, 0.05);
      b.blob("cloth", [0, GOAT.bodyY + 0.12, -0.22], 0.24, 5, COAT, hex("#6e462c"), 0.8, 12, 8, 0.05);
      b.blob("cloth", [0, GOAT.bodyY + 0.14, 0.18], 0.22, 7, hex("#f4efe6"), COAT, 0.85, 12, 8, 0.05);
      // Neck.
      b.tint(FACE).limb("cloth", [0, GOAT.bodyY + 0.2, 0.28], [0, GOAT.bodyY + 0.42, 0.4], 0.09, 0.07, 8);
      // Brass bell on a red collar.
      b.tint(hex("#a83232")).cylinder("cloth", 0, GOAT.bodyY + 0.25, 0.33, 0.1, 0.1, 0.04, 10);
      b.tint(hex("#d4af37")).blob("metal", [0, GOAT.bodyY + 0.16, 0.4], 0.045, 1, hex("#e6c45a"), hex("#a8862a"), 1.2, 8, 6, 0);
      // The rope from the farm, trailing.
      b.tint(hex("#c9b07a")).limb("cloth", [0, GOAT.bodyY + 0.24, 0.36], [0.05, 0.03, -0.1], 0.012, 0.012, 4);
      b.limb("cloth", [0.05, 0.03, -0.1], [0.12, 0.01, -0.55], 0.012, 0.012, 4);
    }, { shadows: true });
    this.root.addChild(body);
    this.head = new pc.Entity("goat-head");
    this.head.setLocalPosition(0, GOAT.bodyY + 0.46, 0.44);
    this.head.addChild(makeProp(app, mats, "goat-headmesh", (b) => {
      b.tint(FACE).blob("cloth", [0, 0, 0.05], 0.11, 9, FACE, hex("#e0d8cc"), 1.0, 10, 8, 0.03);
      b.limb("cloth", [0, -0.02, 0.08], [0, -0.07, 0.24], 0.07, 0.05, 8);
      b.tint(DARK).blob("cloth", [0, -0.08, 0.27], 0.03, 2, DARK, DARK, 0.8, 6, 4, 0);
      // Eyes (the look), ears, horns, the beard.
      for (const s of [-1, 1]) {
        b.tint(hex("#1a1410")).blob("trim", [s * 0.07, 0.03, 0.12], 0.018, 3, hex("#1a1410"), hex("#1a1410"), 1, 6, 4, 0);
        b.tint(FACE).limb("cloth", [s * 0.08, 0.04, 0.02], [s * 0.2, -0.02, -0.02], 0.035, 0.02, 6);
        b.tint(HORN).limb("trim", [s * 0.04, 0.09, 0.02], [s * 0.07, 0.2, -0.1], 0.022, 0.006, 6);
      }
      b.tint(hex("#e9e4d8")).limb("cloth", [0, -0.11, 0.18], [0, -0.2, 0.15], 0.02, 0.006, 5);
    }));
    this.root.addChild(this.head);
    this.tail = new pc.Entity("goat-tail");
    this.tail.setLocalPosition(0, GOAT.bodyY + 0.24, -0.42);
    this.tail.addChild(makeProp(app, mats, "goat-tailmesh", (b) => b.tint(COAT).limb("cloth", [0, 0, 0], [0, 0.1, -0.05], 0.03, 0.012, 5)));
    this.root.addChild(this.tail);
    // Legs pivot at the hip/shoulder; the hoof bottom is exactly at y = 0 when straight.
    const legMesh = (front: boolean) => makeProp(app, mats, "goat-leg", (b) => {
      b.tint(front ? FACE : COAT).limb("cloth", [0, 0.04, 0], [0, -GOAT.legLen + 0.04, 0], 0.06, 0.032, 10);
      b.tint(DARK).cylinder("trim", 0, -GOAT.legLen, 0, 0.03, 0.028, 0.04, 6);
    });
    const spots: [number, number, boolean, number][] = [[-0.1, 0.2, true, 0], [0.1, 0.2, true, Math.PI], [-0.1, -0.24, false, Math.PI * 0.5], [0.1, -0.24, false, Math.PI * 1.5]];
    for (const [x, z, front, phase] of spots) {
      const e = new pc.Entity("goat-leg-pivot");
      e.setLocalPosition(x, GOAT.legLen, z);
      e.addChild(legMesh(front));
      this.root.addChild(e);
      this.legs.push({ e, phase });
    }
    app.root.addChild(this.root);
  }

  place(x: number, y: number, z: number, yaw: number): void {
    this.x = x;
    this.z = z;
    this.yaw = yaw;
    this.root.setPosition(x, y, z);
    this.root.setEulerAngles(0, (yaw * 180) / Math.PI, 0);
  }

  /** Animate: speed in m/s (0 = standing), dt seconds. */
  animate(dt: number, speed: number, t: number): void {
    this.speed = speed;
    this.dist += speed * dt;
    const gallop = speed > 2.2;
    const amp = Math.min(0.75, speed * (gallop ? 0.22 : 0.35));
    const ph = (this.dist / GOAT.stride) * Math.PI;
    for (const l of this.legs) {
      const a = speed > 0.05 ? Math.sin(ph + (gallop ? (l.phase > 2 ? 0.6 : 0) : l.phase)) * amp : 0;
      l.e.setLocalEulerAngles((a * 180) / Math.PI, 0, 0);
    }
    this.bob = speed > 0.05 ? Math.abs(Math.sin(ph)) * 0.02 * Math.min(1, speed) : 0;
    const p = this.root.getLocalPosition();
    void p;
    this.lookT = Math.max(0, this.lookT - dt);
    const lookYaw = this.lookT > 0 ? 55 : Math.sin(t * 0.9) * 8;
    this.head.setLocalEulerAngles(speed > 0.1 ? 10 : Math.sin(t * 0.7) * 6, lookYaw, 0);
    this.tail.setLocalEulerAngles(Math.sin(t * 7) * 18, Math.sin(t * 5) * 14, 0);
    this.root.children[0]!.setLocalPosition(0, this.bob, 0);
  }

  set visible(on: boolean) {
    this.root.enabled = on;
  }
}

/* ------------------------------------------------------------ cats */

/** One sitting cat (about 30 cm tall), facing +z. */
function catMesh(b: Builder, coat: RGBA, belly: RGBA): void {
  b.tint(coat).blob("cloth", [0, 0.11, 0], 0.11, 3, coat, belly, 1.15, 10, 7, 0.03);
  b.blob("cloth", [0, 0.25, 0.05], 0.075, 5, coat, belly, 1.0, 10, 7, 0.02);
  for (const s of [-1, 1]) {
    b.tint(coat).cylinder("cloth", s * 0.04, 0.3, 0.05, 0.025, 0, 0.06, 4, false, false);
    b.tint(hex("#e8d48a")).blob("trim", [s * 0.03, 0.26, 0.115], 0.012, 2, hex("#e8d48a"), hex("#e8d48a"), 1, 6, 4, 0);
    b.tint(coat).limb("cloth", [s * 0.04, 0.0, 0.08], [s * 0.04, 0.1, 0.06], 0.022, 0.022, 5);
  }
  b.tint(coat).limb("cloth", [0, 0.03, -0.09], [0.14, 0.02, -0.03], 0.02, 0.014, 6);
}

export function makeCats(app: pc.AppBase, mats: MatLib, cx: number, cz: number, r: number, n: number, y: number): pc.Entity {
  const root = new pc.Entity("cats");
  const coats: [string, string][] = [["#2b2b2b", "#56606a"], ["#e0a526", "#f4efe4"], ["#8a8f94", "#e9e4d8"], ["#f4efe4", "#e9e4d8"], ["#6e462c", "#c9b896"], ["#3a3a3a", "#f4efe4"]];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const [c1, c2] = coats[k % coats.length]!;
    const cat = makeProp(app, mats, "cat", (b) => catMesh(b, hex(c1), hex(c2)));
    // Facing outward, like sentries.
    cat.setPosition(cx + Math.sin(a) * r, y, cz + Math.cos(a) * r);
    cat.setEulerAngles(0, (a * 180) / Math.PI, 0);
    root.addChild(cat);
  }
  app.root.addChild(root);
  return root;
}

/* ------------------------------------------------------------ the bicycle */

/** Bicycle dimensions (metres) used by the rider's pose and the controller. */
export const BIKE = { wheelR: 0.34, base: 1.05, seatY: 0.92, seatZ: -0.22, crankY: 0.32, crankZ: 0.02, crankR: 0.17, barY: 1.0, barZ: 0.42, basketZ: 0.62 };

export class Bicycle {
  readonly root: pc.Entity;
  private wheels: pc.Entity[] = [];
  private crank: pc.Entity;
  /** The frame (leans with the rider). */
  readonly frame: pc.Entity;
  readonly basket: pc.Entity;
  dist = 0;

  constructor(app: pc.AppBase, mats: MatLib, colour = "#2a6fb0") {
    this.root = new pc.Entity("bicycle");
    this.frame = new pc.Entity("bike-frame");
    this.root.addChild(this.frame);
    const C = hex(colour), DARK = hex("#202326"), CH = hex("#c9cdd0");
    const { wheelR: R, base } = BIKE;
    const rearZ = -base / 2, frontZ = base / 2;
    this.frame.addChild(makeProp(app, mats, "bike-body", (b) => {
      const bb: [number, number, number] = [0, BIKE.crankY, BIKE.crankZ];
      const seat: [number, number, number] = [0, BIKE.seatY - 0.06, BIKE.seatZ];
      const head: [number, number, number] = [0, 0.86, frontZ - 0.12];
      b.tint(C).limb("metal", bb, seat, 0.022, 0.022, 6);
      b.limb("metal", seat, head, 0.02, 0.02, 6);
      b.limb("metal", bb, [0, 0.8, frontZ - 0.15], 0.024, 0.022, 6);
      b.limb("metal", bb, [0, R, rearZ], 0.016, 0.016, 5);
      b.limb("metal", seat, [0, R, rearZ], 0.014, 0.014, 5);
      b.tint(CH).limb("metal", head, [0, R, frontZ], 0.018, 0.016, 5);
      b.tint(DARK).limb("metal", head, [0, BIKE.barY, BIKE.barZ - 0.06], 0.018, 0.018, 5);
      b.limb("metal", [-0.27, BIKE.barY, BIKE.barZ], [0.27, BIKE.barY, BIKE.barZ], 0.014, 0.014, 5);
      b.tint(hex("#2b2b2b")).box("cloth", 0, BIKE.seatY - 0.06, BIKE.seatZ, 0.14, 0.06, 0.26);
      // Mudguards.
      b.tint(C).box("metal", 0, R + 0.05, rearZ + 0.02, 0.06, 0.02, 0.5);
      b.box("metal", 0, R + 0.05, frontZ, 0.06, 0.02, 0.44);
    }));
    this.basket = makeProp(app, mats, "bike-basket", (b) => {
      const W = hex("#b98a50");
      b.tint(W);
      b.box("wood", 0, 0, 0, 0.42, 0.03, 0.36);
      for (const [x, z, sx, sz] of [[0, 0.17, 0.42, 0.02], [0, -0.17, 0.42, 0.02], [0.2, 0, 0.02, 0.36], [-0.2, 0, 0.02, 0.36]] as const) b.box("wood", x, 0.03, z, sx, 0.26, sz);
    });
    this.basket.setLocalPosition(0, BIKE.barY - 0.22, BIKE.basketZ);
    this.frame.addChild(this.basket);
    for (const z of [rearZ, frontZ]) {
      const w = new pc.Entity("bike-wheel");
      w.setLocalPosition(0, R, z);
      w.addChild(makeProp(app, mats, "wheel", (b) => {
        b.tint(DARK);
        const n = 22;
        for (let k = 0; k < n; k++) {
          const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
          b.limb("trim", [0, Math.sin(a0) * R * 0.96, Math.cos(a0) * R * 0.96], [0, Math.sin(a1) * R * 0.96, Math.cos(a1) * R * 0.96], 0.028, 0.028, 4);
        }
        b.tint(CH);
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          b.limb("metal", [0, 0, 0], [0, Math.sin(a) * R * 0.92, Math.cos(a) * R * 0.92], 0.004, 0.004, 3);
        }
        b.cylinder("metal", 0, -0.04, 0, 0.03, 0.03, 0.08, 6);
      }));
      this.frame.addChild(w);
      this.wheels.push(w);
    }
    this.crank = new pc.Entity("bike-crank");
    this.crank.setLocalPosition(0, BIKE.crankY, BIKE.crankZ);
    this.crank.addChild(makeProp(app, mats, "crank", (b) => {
      b.tint(CH).cylinder("metal", 0, -0.08, 0, 0.09, 0.09, 0.02, 12);
      for (const s of [-1, 1]) {
        b.limb("metal", [s * 0.08, 0, 0], [s * 0.1, s * BIKE.crankR, 0], 0.012, 0.012, 4);
        b.tint(DARK).box("trim", s * 0.14, s * BIKE.crankR - 0.01, 0, 0.08, 0.02, 0.1);
        b.tint(CH);
      }
    }));
    this.frame.addChild(this.crank);
    app.root.addChild(this.root);
  }

  /** Crank phase in radians from the distance travelled (pedals, wheels and feet stay in step). */
  get phase(): number {
    return (this.dist / (BIKE.wheelR * 2.4)) % (Math.PI * 2);
  }

  update(dist: number, lean: number): void {
    this.dist = dist;
    const wheelAngle = (dist / BIKE.wheelR) * (180 / Math.PI);
    for (const w of this.wheels) w.setLocalEulerAngles(wheelAngle, 0, 0);
    this.crank.setLocalEulerAngles((this.phase * 180) / Math.PI, 0, 0);
    this.frame.setLocalEulerAngles(0, 0, (lean * 180) / Math.PI);
  }

  set visible(on: boolean) {
    this.root.enabled = on;
  }
}

/* ------------------------------------------------------------ the rest */

export function makeKeke(app: pc.AppBase, mats: MatLib): pc.Entity {
  return makeProp(app, mats, "keke", (b) => kekeMesh(b, hex("#f2c230"), hex("#2f8a4c")));
}

/** The note under the door: a folded sheet, with the seven dots. */
export function makeNote(app: pc.AppBase, mats: MatLib): pc.Entity {
  return makeProp(app, mats, "note", (b) => {
    b.tint(hex("#f8f3e6")).box("trim", 0, 0, 0, 0.16, 0.004, 0.11);
    b.tint(hex("#2b2b2b"));
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      b.box("trim", Math.cos(a) * 0.025, 0.004, Math.sin(a) * 0.025, 0.006, 0.001, 0.006);
    }
    b.box("trim", 0, 0.004, 0, 0.006, 0.001, 0.006);
  }, { shadows: false });
}

/** The tin under the stone behind the barn. */
export function makeTin(app: pc.AppBase, mats: MatLib): pc.Entity {
  return makeProp(app, mats, "tin", (b) => {
    b.tint(hex("#8a8f94")).cylinder("metal", 0, 0, 0, 0.07, 0.07, 0.09, 14);
    b.tint(hex("#a8442c")).cylinder("metal", 0, 0.09, 0, 0.072, 0.072, 0.012, 14);
    b.tint(hex("#9a948a")).blob("stone", [0.18, 0.04, 0.05], 0.12, 4, hex("#a8a194"), hex("#8a8478"), 0.6, 8, 6, 0.2);
  });
}

/** The giant matric gown (worn over the player: a black tent with sleeves). */
export function makeGown(app: pc.AppBase, mats: MatLib, belted: boolean): pc.Entity {
  return makeProp(app, mats, "gown", (b) => {
    const G = hex("#1d1d24");
    b.tint(G).cylinder("cloth", 0, 0.12, 0, 0.62, 0.3, 1.32, 16, false, true);
    b.cylinder("cloth", 0, 1.44, 0, 0.3, 0.2, 0.08, 16, false, true);
    for (const s of [-1, 1]) b.limb("cloth", [s * 0.24, 1.38, 0], [s * 0.62, 0.92, 0.06], 0.13, 0.22, 10);
    if (belted) b.tint(hex("#8a5a3a")).cylinder("cloth", 0, 0.98, 0, 0.36, 0.36, 0.07, 16, false, true);
  });
}

/** A crate of stock (purple drink bottles). */
export function makeCrate(app: pc.AppBase, mats: MatLib): pc.Entity {
  return makeProp(app, mats, "crate", (b) => {
    b.tint(hex("#b98a50")).box("wood", 0, 0, 0, 0.5, 0.3, 0.36, 0.5);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) b.tint(hex("#6a2a7a")).cylinder("trim", -0.18 + i * 0.12, 0.3, -0.11 + j * 0.11, 0.03, 0.025, 0.12, 6);
  });
}

/** The cardboard sign: THE PLUG. I KNOW A GUY. (plain board; the words show in the subtitle insert). */
export function makePlugSign(app: pc.AppBase, mats: MatLib): pc.Entity {
  return makeProp(app, mats, "plug-sign", (b) => {
    b.tint(hex("#c9a46a")).box("trim", 0, 0, 0, 0.5, 0.32, 0.01);
    b.tint(hex("#1d1d1d"));
    for (let k = 0; k < 4; k++) b.box("trim", -0.18 + k * 0.12, 0.2, 0.006, 0.08, 0.05, 0.002);
    for (let k = 0; k < 5; k++) b.box("trim", -0.2 + k * 0.1, 0.09, 0.006, 0.06, 0.04, 0.002);
  }, { shadows: false });
}

/** A candle on a saucer (its flame glows). */
export function makeCandle(app: pc.AppBase, mats: MatLib): pc.Entity {
  return makeProp(app, mats, "candle", (b) => {
    b.tint(hex("#e9e4d8")).cylinder("trim", 0, 0, 0, 0.07, 0.07, 0.012, 12);
    b.tint(hex("#f8f3e6")).cylinder("trim", 0, 0.012, 0, 0.018, 0.018, 0.11, 8);
    b.tint(hex("#ffb84a")).blob("glow", [0, 0.14, 0], 0.014, 1, hex("#ffd27a"), hex("#ff9a2a"), 1.8, 6, 4, 0);
  }, { shadows: false });
}

/** Turbo Sneakers in their box (the Plug's flagship advantage). */
export function makeSneakers(app: pc.AppBase, mats: MatLib): pc.Entity {
  return makeProp(app, mats, "sneakers", (b) => {
    for (const s of [-1, 1]) {
      b.tint(hex("#f4f1ea")).box("cloth", s * 0.07, 0.02, 0, 0.09, 0.07, 0.26);
      b.tint(hex("#d9622b")).box("trim", s * 0.07, 0, 0, 0.1, 0.025, 0.27);
      b.tint(hex("#c9a23a")).cylinder("metal", s * 0.07, -0.02, -0.06, 0.02, 0.02, 0.025, 6);
    }
  });
}

/** The shade: a soft dark smudge the size of a child, drifting low (a camera-facing quad, darkening, not glowing). */
export function makeShade(app: pc.AppBase): pc.Entity {
  const tex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(64, 70, 6, 64, 64, 62);
    grad.addColorStop(0, "rgba(0,0,0,0.92)");
    grad.addColorStop(0.55, "rgba(0,0,0,0.6)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    // Two dim places where eyes might go.
    g.fillStyle = "rgba(60,60,70,0.55)";
    for (const x of [52, 76]) {
      g.beginPath();
      g.ellipse(x, 52, 5, 3, 0, 0, Math.PI * 2);
      g.fill();
    }
    const t = new pc.Texture(app.graphicsDevice, { width: 128, height: 128, format: pc.PIXELFORMAT_RGBA8, mipmaps: true });
    t.setSource(c);
    return t;
  })();
  const m = new pc.StandardMaterial();
  m.diffuse = new pc.Color(0, 0, 0);
  m.opacityMap = tex;
  m.opacityMapChannel = "a";
  m.blendType = pc.BLEND_NORMAL;
  m.depthWrite = false;
  m.useLighting = false;
  m.update();
  const e = new pc.Entity("shade");
  e.addComponent("render", { type: "plane", material: m, castShadows: false, receiveShadows: false });
  e.setLocalScale(0.9, 1, 1.1);
  app.root.addChild(e);
  e.enabled = false;
  return e;
}
