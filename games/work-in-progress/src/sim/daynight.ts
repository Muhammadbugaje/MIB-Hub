/**
 * Day and night: pure maths, no engine. Given the time of day (hours, 0-24)
 * it returns where the sun is and what colour the light, sky and fog are.
 *
 * The sun follows real geometry for a town at about 11 degrees north in late
 * September (rainy season ending), so sunrise is near 06:10 and sunset near
 * 18:20. Colours are hand-picked keys blended by the sun's height.
 */
export type RGB = [number, number, number];

export interface SkyState {
  /** Unit vector pointing from the ground TOWARDS the sun (x east, y up, z south). */
  sunDir: [number, number, number];
  /** Sun height above the horizon, degrees (negative at night). */
  elevation: number;
  sunColor: RGB;
  /** Directional light intensity (0 at night). */
  sunIntensity: number;
  skyTop: RGB;
  skyHorizon: RGB;
  /** Colour of light bouncing up from the ground. */
  groundBounce: RGB;
  fogColor: RGB;
  /** 0 = full day, 1 = full night. Street lights and windows follow this. */
  night: number;
  /** Moonlight direction (used as the "sun" at night so shadows never vanish completely). */
  moonDir: [number, number, number];
}

const RAD = Math.PI / 180;

/** Sun direction from hours (local solar time), latitude and day of year. */
export function sunDirection(hours: number, latDeg = 11, dayOfYear = 265): { dir: [number, number, number]; elevation: number } {
  const decl = -23.44 * Math.cos((2 * Math.PI * (dayOfYear + 10)) / 365) * RAD;
  const lat = latDeg * RAD;
  const ha = (hours - 12) * 15 * RAD;
  const sinEl = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha);
  const el = Math.asin(Math.max(-1, Math.min(1, sinEl)));
  // Azimuth measured from north, clockwise (east = 90 degrees).
  const cosAz = (Math.sin(decl) - Math.sin(el) * Math.sin(lat)) / (Math.cos(el) * Math.cos(lat) || 1e-6);
  let az = Math.acos(Math.max(-1, Math.min(1, cosAz)));
  if (ha > 0) az = 2 * Math.PI - az;
  const dir: [number, number, number] = [Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)];
  return { dir, elevation: el / RAD };
}

interface Key { el: number; sun: RGB; sunI: number; top: RGB; hor: RGB; ground: RGB; fog: RGB }

// Keys by sun elevation (degrees). Colours are linear-ish 0..1 values.
const KEYS: Key[] = [
  { el: -18, sun: [0.55, 0.62, 0.9], sunI: 0.0, top: [0.012, 0.018, 0.05], hor: [0.04, 0.06, 0.13], ground: [0.02, 0.025, 0.04], fog: [0.05, 0.07, 0.13] },
  { el: -6, sun: [0.6, 0.55, 0.75], sunI: 0.0, top: [0.06, 0.09, 0.22], hor: [0.42, 0.33, 0.42], ground: [0.06, 0.06, 0.08], fog: [0.3, 0.27, 0.36] },
  { el: 0, sun: [1.0, 0.45, 0.2], sunI: 0.35, top: [0.2, 0.33, 0.6], hor: [1.0, 0.56, 0.32], ground: [0.22, 0.14, 0.09], fog: [0.85, 0.6, 0.45] },
  { el: 8, sun: [1.0, 0.66, 0.38], sunI: 2.0, top: [0.2, 0.38, 0.74], hor: [0.98, 0.72, 0.5], ground: [0.3, 0.24, 0.16], fog: [0.9, 0.78, 0.66] },
  { el: 25, sun: [1.0, 0.9, 0.76], sunI: 3.0, top: [0.16, 0.38, 0.82], hor: [0.58, 0.72, 0.88], ground: [0.32, 0.29, 0.2], fog: [0.74, 0.82, 0.9] },
  { el: 70, sun: [1.0, 0.97, 0.9], sunI: 3.4, top: [0.13, 0.36, 0.84], hor: [0.55, 0.7, 0.9], ground: [0.34, 0.32, 0.24], fog: [0.72, 0.82, 0.92] },
];

const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

export function skyAt(hours: number): SkyState {
  const { dir, elevation } = sunDirection(hours);
  let i = 0;
  while (i < KEYS.length - 2 && elevation > KEYS[i + 1]!.el) i++;
  const a = KEYS[i]!, b = KEYS[i + 1]!;
  const t = Math.max(0, Math.min(1, (elevation - a.el) / (b.el - a.el)));
  const night = 1 - smoothstep(-8, 2, elevation);
  // The moon sits roughly opposite the sun, a little higher, so night has soft blue shadows.
  const moonDir = normalize([-dir[0] * 0.6 + 0.2, Math.max(0.45, -dir[1]), -dir[2] * 0.6 - 0.3]);
  return {
    sunDir: dir,
    elevation,
    sunColor: mix(a.sun, b.sun, t),
    sunIntensity: a.sunI + (b.sunI - a.sunI) * t,
    skyTop: mix(a.top, b.top, t),
    skyHorizon: mix(a.hor, b.hor, t),
    groundBounce: mix(a.ground, b.ground, t),
    fogColor: mix(a.fog, b.fog, t),
    night,
    moonDir,
  };
}

export function normalize(v: [number, number, number]): [number, number, number] {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

/**
 * Hemisphere ambient as the 9 spherical-harmonic colour terms the engine's
 * lit shader reads (27 floats): sky colour from above, ground bounce from
 * below, and a little warmth from the side the sun is on.
 */
export function hemisphereSH(sky: RGB, ground: RGB, side: RGB, sideDir: [number, number, number], out = new Float32Array(27)): Float32Array {
  out.fill(0);
  for (let c = 0; c < 3; c++) {
    out[c] = (sky[c]! + ground[c]!) / 2; // constant
    out[3 + c] = side[c]! * sideDir[0] * 0.5; // x
    out[6 + c] = (sky[c]! - ground[c]!) / 2; // y
    out[9 + c] = side[c]! * sideDir[2] * 0.5; // z
  }
  return out;
}

/** "07:45" from hours. */
export function clockText(hours: number): string {
  const h = ((Math.floor(hours) % 24) + 24) % 24;
  const m = Math.floor((hours - Math.floor(hours)) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
