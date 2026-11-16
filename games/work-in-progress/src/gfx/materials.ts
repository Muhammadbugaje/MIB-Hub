/**
 * The material library: every surface in the world uses one of these, so the
 * whole look (roughness floor, palette, night glow) is tuned in one place.
 * Materials share one ambient (hemisphere) light array that the day/night
 * cycle rewrites each frame, and "wind" materials sway in a vertex shader.
 */
import * as pc from "playcanvas";
import type { Textures } from "./textures.ts";

export const SH = new Float32Array(27);

export interface MatLib {
  get(name: string): pc.StandardMaterial;
  /** Materials whose emissive glow follows the night (windows, lamps, signs). */
  night: { mat: pc.StandardMaterial; day: number; night: number }[];
  all: pc.StandardMaterial[];
}

/** Vertex-shader wind: tops of trees and bushes sway; base stays put. */
function windChunk(device: pc.GraphicsDevice, base: number, extra = ""): string {
  const src = pc.ShaderChunks.get(device, pc.SHADERLANGUAGE_GLSL).get("transformVS") as string;
  return src
    .replace("vec4 evalWorldPosition(", `uniform float uWindTime;\nuniform float uWindStrength;\n${extra}\nvec4 evalWorldPosition(`)
    .replace(
      "vec4 posW = modelMatrix * vec4(localPos, 1.0);",
      `vec4 posW = modelMatrix * vec4(localPos, 1.0);
	{
		vec3 tp = vec3(modelMatrix[3][0], modelMatrix[3][1], modelMatrix[3][2]);
		float hgt = max(localPos.y - ${base.toFixed(2)}, 0.0);
		float ph = tp.x * 0.13 + tp.z * 0.17;
		float sway = sin(uWindTime * 1.1 + ph) * 0.6 + sin(uWindTime * 2.3 + ph * 1.7) * 0.25;
		float flutter = sin(uWindTime * 6.0 + dot(posW.xyz, vec3(1.3, 0.9, 1.1))) * 0.18;
		posW.xz += vec2(0.9, 0.45) * (sway + flutter) * hgt * hgt * uWindStrength;
	}`,
    );
}

/** Bird wings: vertices away from the body flap up and down. */
export function flapChunk(device: pc.GraphicsDevice): string {
  const src = pc.ShaderChunks.get(device, pc.SHADERLANGUAGE_GLSL).get("transformVS") as string;
  return src
    .replace("vec4 evalWorldPosition(", "uniform float uWindTime;\nvec4 evalWorldPosition(")
    .replace(
      "vec3 localPos = getLocalPosition(vertexPosition);",
      `vec3 localPos = getLocalPosition(vertexPosition);
	{
		vec3 tp = vec3(modelMatrix[3][0], modelMatrix[3][1], modelMatrix[3][2]);
		float ph = tp.x * 1.7 + tp.z * 2.3 + tp.y;
		float flap = sin(uWindTime * 11.0 + ph);
		localPos.y += flap * abs(localPos.x) * 0.9;
	}`,
    );
}

export function makeMaterials(device: pc.GraphicsDevice, tex: Textures, signs: pc.Texture, clock: pc.Texture): MatLib {
  const lib = new Map<string, pc.StandardMaterial>();
  const night: MatLib["night"] = [];

  const make = (name: string, o: {
    map?: pc.Texture; normal?: pc.Texture; bump?: number; color?: [number, number, number]; gloss?: number; metal?: number;
    vc?: boolean; emissive?: [number, number, number]; emissiveVC?: boolean; emissiveChannel?: string; twoSided?: boolean; wind?: number; windBase?: number; spec?: number;
    alphaTest?: number; fog?: boolean; lit?: boolean;
  }) => {
    const m = new pc.StandardMaterial();
    m.name = name;
    m.useMetalness = true;
    m.metalness = o.metal ?? 0;
    m.gloss = o.gloss ?? 0.3;
    m.specularityFactor = o.spec ?? 0.5;
    if (o.color) m.diffuse = new pc.Color(o.color[0], o.color[1], o.color[2]);
    if (o.map) m.diffuseMap = o.map;
    if (o.normal) {
      m.normalMap = o.normal;
      m.bumpiness = o.bump ?? 0.6;
    }
    m.diffuseVertexColor = o.vc ?? true;
    if (o.emissive) {
      m.emissive = new pc.Color(o.emissive[0], o.emissive[1], o.emissive[2]);
      m.emissiveIntensity = 0;
    }
    if (o.emissiveVC) m.emissiveVertexColor = true;
    if (o.emissiveChannel) m.emissiveVertexColorChannel = o.emissiveChannel;
    if (o.vc !== false) m.diffuseVertexColorChannel = "rgb";
    if (o.twoSided) {
      m.cull = pc.CULLFACE_NONE;
      m.twoSidedLighting = true;
    }
    if (o.alphaTest) m.alphaTest = o.alphaTest;
    if (o.lit === false) m.useLighting = false;
    (m as unknown as { ambientSH: Float32Array }).ambientSH = SH;
    if (o.wind !== undefined) {
      m.getShaderChunks(pc.SHADERLANGUAGE_GLSL).set("transformVS", windChunk(device, o.windBase ?? 0));
      m.setParameter("uWindStrength", o.wind);
    }
    m.update();
    lib.set(name, m);
    return m;
  };

  make("asphalt", { map: tex.asphalt.map, normal: tex.asphalt.normal, bump: 0.5, gloss: 0.32, vc: true });
  const marking = make("marking", { color: [1, 1, 1], gloss: 0.35 });
  // Painted lines sit just above the tarmac; a depth bias keeps them from shimmering far away.
  marking.depthBias = -2;
  marking.slopeDepthBias = -2;
  marking.update();
  make("paver", { map: tex.paver.map, normal: tex.paver.normal, gloss: 0.25 });
  make("brickpave", { map: tex.brickPave.map, normal: tex.brickPave.normal, gloss: 0.25 });
  make("kerb", { map: tex.kerb.map, gloss: 0.3 });
  make("grass", { map: tex.grass.map, normal: tex.grass.normal, bump: 0.4, gloss: 0.12, spec: 0.3 });
  make("laterite", { map: tex.laterite.map, normal: tex.laterite.normal, gloss: 0.1, spec: 0.25 });
  make("plaster", { map: tex.plaster.map, normal: tex.plaster.normal, bump: 0.35, gloss: 0.22 });
  make("brick", { map: tex.brick.map, normal: tex.brick.normal, bump: 0.8, gloss: 0.18 });
  make("stone", { map: tex.stone.map, normal: tex.stone.normal, bump: 0.6, gloss: 0.22 });
  make("wood", { map: tex.wood.map, normal: tex.wood.normal, bump: 0.5, gloss: 0.3 });
  make("rooftile", { map: tex.roofTile.map, normal: tex.roofTile.normal, bump: 0.9, gloss: 0.3, twoSided: true });
  // Metals stay mostly dielectric: without a reflection map, true metals render black.
  make("corrugated", { map: tex.corrugated.map, normal: tex.corrugated.normal, bump: 0.8, gloss: 0.45, metal: 0.12, twoSided: true });
  make("trim", { color: [1, 1, 1], gloss: 0.38 });
  make("metal", { color: [1, 1, 1], gloss: 0.55, metal: 0.15, spec: 0.8 });
  make("dome", { color: [1, 1, 1], gloss: 0.6, metal: 0.18, spec: 0.9 });
  make("water", { color: [0.25, 0.45, 0.55], gloss: 0.92, spec: 1, vc: false });
  make("fabric", { map: tex.awning, gloss: 0.15, twoSided: true, vc: false });
  make("cloth", { color: [1, 1, 1], gloss: 0.15, twoSided: true });
  const glass = make("glass", { color: [1, 1, 1], gloss: 0.88, spec: 1, metal: 0.1, emissive: [1, 0.74, 0.45], emissiveVC: true, emissiveChannel: "a" });
  night.push({ mat: glass, day: 0, night: 1.6 });
  const lamp = make("lamp", { color: [1, 1, 1], gloss: 0.5, emissive: [1, 0.86, 0.6], emissiveVC: true });
  night.push({ mat: lamp, day: 0.05, night: 6 });
  const sign = make("signs", { map: signs, gloss: 0.3, vc: false, emissive: [1, 1, 1] });
  sign.emissiveMap = signs;
  sign.update();
  night.push({ mat: sign, day: 0, night: 0.55 });
  make("clock", { map: clock, gloss: 0.4, vc: false });
  make("bark", { map: tex.bark.map, normal: tex.bark.normal, gloss: 0.15, wind: 0.0016, windBase: 1.5 });
  make("leaves", { map: tex.leaves.map, normal: tex.leaves.normal, bump: 0.8, gloss: 0.22, spec: 0.35, wind: 0.0042, windBase: 1.2 });
  make("palm", { map: tex.leaves.map, gloss: 0.25, spec: 0.35, twoSided: true, wind: 0.0016, windBase: 4 });
  make("bush", { map: tex.leaves.map, normal: tex.leaves.normal, bump: 0.8, gloss: 0.2, spec: 0.3, wind: 0.03, windBase: 0.2 });
  make("far", { map: tex.leaves.map, gloss: 0.1, spec: 0.2 });

  return {
    get: (n) => {
      const m = lib.get(n);
      if (!m) throw new Error(`unknown material ${n}`);
      return m;
    },
    night,
    all: [...lib.values()],
  };
}
