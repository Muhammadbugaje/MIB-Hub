/**
 * Small, allocation-free maths for the animation system. Everything works on
 * plain number arrays (Float32Array slices), so the same code runs in the
 * browser, in the Node tests (the feel suite) and in the asset tools.
 *
 * Quaternions are [x, y, z, w]; vectors are [x, y, z]. "q" arrays are read
 * and written at an offset (o) so a whole pose lives in one Float32Array.
 */

export type Q = [number, number, number, number];
export type V3 = [number, number, number];

export const qIdent = (): Q => [0, 0, 0, 1];

export function qMul(a: ArrayLike<number>, ao: number, b: ArrayLike<number>, bo: number, out: number[] | Float32Array, oo: number): void {
  const ax = a[ao]!, ay = a[ao + 1]!, az = a[ao + 2]!, aw = a[ao + 3]!;
  const bx = b[bo]!, by = b[bo + 1]!, bz = b[bo + 2]!, bw = b[bo + 3]!;
  out[oo] = aw * bx + ax * bw + ay * bz - az * by;
  out[oo + 1] = aw * by - ax * bz + ay * bw + az * bx;
  out[oo + 2] = aw * bz + ax * by - ay * bx + az * bw;
  out[oo + 3] = aw * bw - ax * bx - ay * by - az * bz;
}

/** a * b for plain quaternions. */
export function mulQ(a: Q, b: Q): Q {
  const o: Q = [0, 0, 0, 1];
  qMul(a, 0, b, 0, o, 0);
  return o;
}

export const conj = (q: Q): Q => [-q[0], -q[1], -q[2], q[3]];

export function normQ(q: Q): Q {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}

/** Rotate vector v by unit quaternion q. */
export function rotV(q: ArrayLike<number>, qo: number, v: V3): V3 {
  const x = q[qo]!, y = q[qo + 1]!, z = q[qo + 2]!, w = q[qo + 3]!;
  // t = 2 * cross(q.xyz, v)
  const tx = 2 * (y * v[2] - z * v[1]);
  const ty = 2 * (z * v[0] - x * v[2]);
  const tz = 2 * (x * v[1] - y * v[0]);
  return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
}

export function axisAngle(axis: V3, rad: number): Q {
  const l = Math.hypot(axis[0], axis[1], axis[2]) || 1;
  const s = Math.sin(rad / 2) / l;
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(rad / 2)];
}

/** Shortest rotation taking unit vector a onto unit vector b. */
export function fromTo(a: V3, b: V3): Q {
  const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  if (d > 0.999999) return [0, 0, 0, 1];
  if (d < -0.999999) {
    const ax: V3 = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const c = cross(a, ax);
    return axisAngle(c, Math.PI);
  }
  const c = cross(a, b);
  return normQ([c[0], c[1], c[2], 1 + d]);
}

export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
export const len = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
export function norm(a: V3): V3 {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
export const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/**
 * Normalised lerp of quaternion b into a slot (in place), weight t, taking
 * the short way round. Blending many poses with nlerp and normalising at the
 * end is the standard game approach: fast and order-independent.
 */
export function nlerpInto(out: Float32Array, oo: number, b: ArrayLike<number>, bo: number, t: number): void {
  const ax = out[oo]!, ay = out[oo + 1]!, az = out[oo + 2]!, aw = out[oo + 3]!;
  let bx = b[bo]!, by = b[bo + 1]!, bz = b[bo + 2]!, bw = b[bo + 3]!;
  if (ax * bx + ay * by + az * bz + aw * bw < 0) {
    bx = -bx; by = -by; bz = -bz; bw = -bw;
  }
  const x = ax + (bx - ax) * t, y = ay + (by - ay) * t, z = az + (bz - az) * t, w = aw + (bw - aw) * t;
  const l = Math.hypot(x, y, z, w) || 1;
  out[oo] = x / l;
  out[oo + 1] = y / l;
  out[oo + 2] = z / l;
  out[oo + 3] = w / l;
}

/** Proper slerp (used where the angle can be large, e.g. crossfades between very different poses). */
export function slerpInto(out: Float32Array, oo: number, b: ArrayLike<number>, bo: number, t: number): void {
  const ax = out[oo]!, ay = out[oo + 1]!, az = out[oo + 2]!, aw = out[oo + 3]!;
  let bx = b[bo]!, by = b[bo + 1]!, bz = b[bo + 2]!, bw = b[bo + 3]!;
  let c = ax * bx + ay * by + az * bz + aw * bw;
  if (c < 0) {
    c = -c; bx = -bx; by = -by; bz = -bz; bw = -bw;
  }
  let k0: number, k1: number;
  if (c > 0.9995) {
    k0 = 1 - t;
    k1 = t;
  } else {
    const th = Math.acos(c), s = Math.sin(th);
    k0 = Math.sin((1 - t) * th) / s;
    k1 = Math.sin(t * th) / s;
  }
  const x = ax * k0 + bx * k1, y = ay * k0 + by * k1, z = az * k0 + bz * k1, w = aw * k0 + bw * k1;
  const l = Math.hypot(x, y, z, w) || 1;
  out[oo] = x / l;
  out[oo + 1] = y / l;
  out[oo + 2] = z / l;
  out[oo + 3] = w / l;
}

/** Angle (radians) between two unit quaternions. */
export function qAngle(a: ArrayLike<number>, ao: number, b: ArrayLike<number>, bo: number): number {
  const d = Math.abs(a[ao]! * b[bo]! + a[ao + 1]! * b[bo + 1]! + a[ao + 2]! * b[bo + 2]! + a[ao + 3]! * b[bo + 3]!);
  return 2 * Math.acos(Math.min(1, d));
}

/** Yaw (radians about +Y) of a rotation, measured from +Z towards +X. */
export function yawOf(q: ArrayLike<number>, o = 0): number {
  const f = rotV(q, o, [0, 0, 1]);
  return Math.atan2(f[0], f[2]);
}

export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
export const smooth01 = (t: number): number => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

/** Wrap an angle to (-PI, PI]. */
export function wrapPi(a: number): number {
  let d = a % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}
