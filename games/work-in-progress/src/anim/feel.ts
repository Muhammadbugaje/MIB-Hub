/**
 * Every feel number for characters in one place (plan §5.1: "all tuning
 * numbers live in one feel file"). Starting values from the plan (§4.2,
 * §5.2, §5.3); tune by feel and write the tuned value back here.
 *
 * In the browser, `window.__test.feel` points at this object so values can
 * be changed live from the console.
 */
export const FEEL = {
  /** Ground speeds (m/s). Owner playtest 16 Nov 2026: "the game feels so slow", so above the plan's §5.2 starting values. Keyboard: run by default, Shift sprints, Alt walks. */
  speed: { walk: 1.9, jog: 3.8, run: 5.8, sprint: 7.5 },
  /** Acceleration: time to reach the target speed from rest (s), and stopping time (s). */
  accel: { toWalk: 0.15, toRun: 0.35, runToSprint: 0.35, stopFromRun: 0.25, stopFromSprint: 0.35 },
  /** Turn rate (deg/s) at walk, run, sprint. */
  turn: { walk: 720, run: 540, sprint: 300 },
  /** Reversal that triggers a pivot (deg) and the speed it needs (m/s). */
  pivot: { angle: 135, minSpeed: 3 },
  airControl: 0.35,
  jump: { height: 0.9, shortHeight: 0.5, shortWindow: 0.12, riseG: 22, fallG: 32, terminal: 25, coyote: 0.12, buffer: 0.12 },
  /** Steps: climb up to this height; snap down this far (no floating off kerbs or stairs). */
  step: { up: 0.35, down: 0.3 },
  slope: { walkable: 40, slow: 50 },
  capsule: { radius: 0.3, height: 1.75 },

  /** Animation blend times (s), plan §4.2. */
  blend: { loco: 0.15, upperIn: 0.12, upperOut: 0.2, vehicle: 0.1, scuffle: 0.06, hit: 0.05, soft: 0.25, action: 0.25, land: 0.12 },
  /** Locomotion play rate is clamped; outside it the blend space moves to the next gait. */
  rateClamp: [0.8, 1.25] as [number, number],
  /** Lean: body lean (deg) at full turn rate at sprint; acceleration lean (deg per m/s^2). */
  lean: { turnMax: 15, accelPerMs2: 0.9, accelMax: 9, slopePerDeg: 0.35, stiffness: 9, damping: 0.75 },
  /** Reactive bumps and hits: spring stiffness (rad/s), damping ratio, stagger threshold (impulse m/s). */
  react: { stiffness: 13, damping: 0.55, maxAngle: 0.7, stagger: 2.2, fall: 5.5 },
  /** Foot IK: max pelvis drop (m), max foot tilt (deg), on within this distance of the camera (m). */
  ik: { pelvisDrop: 0.25, footTilt: 30, range: 15 },
  /** Look-at: yaw/pitch clamps (deg), turn speed (deg/s), plan §4.3. */
  look: { yaw: 70, pitch: 30, speed: 180, npcRange: 4 },

  /** Crowd animation LOD (plan §4.7): full under near, 15 Hz under mid, frozen beyond far (m). */
  lod: { full: 15, mid: 35, far: 75, reactive: 6 },

  /** Camera, plan §5.3 (on foot). */
  camera: { arm: 3.2, armIndoor: 2.4, pivot: 1.55, fov: 60, fovSprint: 68, posLag: 0.08, rotLag: 0.05, recentreAfter: 1.5, probe: 0.25, easeOut: 0.4, pitchMin: -35, pitchMax: 60, mouse: 0.12, touch: 0.25, pad: 240 },
};

export type Feel = typeof FEEL;
