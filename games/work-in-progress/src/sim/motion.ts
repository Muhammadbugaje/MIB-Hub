/**
 * Smoothing helpers used everywhere something moves on screen. All are
 * frame-rate independent: the same motion at 30, 60 or 144 fps.
 */

/** Exponential approach: move a towards b, closing (1 - e^(-rate * dt)) of the gap. */
export function damp(a: number, b: number, rate: number, dt: number): number {
  return b + (a - b) * Math.exp(-rate * dt);
}

/** Shortest signed difference between two angles (radians), in (-PI, PI]. */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/** damp for angles: always turns the short way round. */
export function dampAngle(a: number, b: number, rate: number, dt: number): number {
  return a + angleDelta(a, b) * (1 - Math.exp(-rate * dt));
}

/** Critically damped spring (no overshoot): returns the new [value, velocity]. */
export function spring(x: number, v: number, target: number, omega: number, dt: number): [number, number] {
  const f = 1 + 2 * dt * omega;
  const oo = omega * omega;
  const hoo = dt * oo;
  const hhoo = dt * hoo;
  const det = 1 / (f + hhoo);
  const nx = (f * x + dt * v + hhoo * target) * det;
  const nv = (v + hoo * (target - x)) * det;
  return [nx, nv];
}

/** Catmull-Rom interpolation of 4 points (for smooth camera rails). */
export function catmull(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

export const ease = {
  linear: (t: number) => t,
  inOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: (t: number) => 1 - Math.pow(1 - t, 3),
  in: (t: number) => t * t * t,
  sine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
};
export type EaseName = keyof typeof ease;

/** Model yaw (radians, 0 = facing +z) for a direction of travel. Used by every vehicle and person. */
export function yawFor(dx: number, dz: number): number {
  return Math.atan2(dx, dz);
}

/** The direction a model faces for a yaw: the inverse of yawFor. */
export function forwardOf(yaw: number): [number, number] {
  return [Math.sin(yaw), Math.cos(yaw)];
}
