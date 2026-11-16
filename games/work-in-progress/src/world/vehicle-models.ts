/**
 * Okada (motorbike) and keke (tricycle taxi) models, built from parts with
 * the Builder. Pure geometry, so tests can prove the old game's bugs cannot
 * come back:
 *   - every model faces +z (its headlamp is at the front, z > 0), and the
 *     traffic code turns +z to the direction of travel: never ridden backwards;
 *   - the lowest point of every wheel is exactly y = 0, so vehicles placed at
 *     road height never sink into the road or float above it.
 */
import type { Builder, RGBA } from "../gfx/builder.ts";

const hex = (h: string, a = 255): RGBA => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), a];
const TYRE: RGBA = [28, 28, 28, 255];
const CHROME: RGBA = [170, 170, 170, 255];

/** Seat positions (model space, metres) where riders sit. */
export const OKADA_SEATS = { rider: { y: 0.78, z: -0.05 }, passenger: { y: 0.82, z: -0.5 } };
export const KEKE_SEATS = { driver: { y: 0.62, z: 0.55 } };
export const OKADA_LENGTH = 1.95;
export const KEKE_LENGTH = 2.7;

/** A motorbike facing +z. Wheels radius 0.32 touch y = 0. */
export function okadaMesh(g: Builder, body: RGBA): void {
  for (const z of [-0.65, 0.68]) {
    g.tint(TYRE).wheel("trim", 0, 0.32, z, 0.32, 0.11, 14);
    g.tint(CHROME).wheel("metal", 0, 0.32, z, 0.14, 0.13, 10);
  }
  g.tint(body).box("metal", 0, 0.42, 0.05, 0.24, 0.26, 0.9); // tank and frame
  g.tint(hex("#222222")).box("trim", 0, 0.7, -0.25, 0.3, 0.1, 0.78); // seat
  g.tint(body).box("metal", 0, 0.6, 0.38, 0.3, 0.26, 0.34); // tank top
  g.tint(CHROME).limb("metal", [0, 0.32, 0.68], [0, 0.98, 0.56], 0.03, 0.03, 5); // forks
  g.tint(hex("#1e1e1e")).box("metal", 0, 0.98, 0.56, 0.72, 0.035, 0.035); // handlebar
  g.tint(hex("#fff4d0")).box("lamp", 0, 0.86, 0.66, 0.15, 0.12, 0.06); // headlamp (front = +z)
  g.tint(hex("#c0201a")).box("lamp", 0, 0.62, -0.68, 0.12, 0.06, 0.04); // tail lamp
  g.tint(hex("#8a8a8a")).limb("metal", [0.13, 0.3, 0.1], [0.13, 0.36, -0.75], 0.04, 0.035, 6); // exhaust
  g.tint(body).box("metal", 0, 0.46, -0.66, 0.26, 0.05, 0.36); // rear mudguard
}

/** A keke (tricycle taxi) facing +z: one front wheel, two rear wheels, canvas canopy. */
export function kekeMesh(g: Builder, body: RGBA, stripe: RGBA): void {
  g.tint(TYRE).wheel("trim", 0, 0.24, 1.05, 0.24, 0.12, 12);
  for (const x of [-0.6, 0.6]) g.tint(TYRE).wheel("trim", x, 0.24, -0.75, 0.24, 0.14, 12);
  // Body tub.
  g.tint(body).box("metal", 0, 0.3, -0.25, 1.32, 0.55, 1.5);
  g.tint(stripe).box("metal", 0, 0.62, -0.25, 1.34, 0.1, 1.52);
  // Nose and cowl.
  g.tint(body).box("metal", 0, 0.3, 0.75, 0.62, 0.7, 0.55);
  g.tint(body).box("metal", 0, 0.9, 0.85, 0.9, 0.35, 0.18);
  g.tint(hex("#a8c4d2", 255)).box("glass", 0, 1.05, 0.86, 0.95, 0.55, 0.04); // windscreen
  g.tint(hex("#fff4d0")).box("lamp", 0, 0.62, 1.04, 0.16, 0.12, 0.05); // headlamp
  for (const x of [-0.55, 0.55]) g.tint(hex("#c0201a")).box("lamp", x, 0.45, -1.01, 0.1, 0.08, 0.03);
  // Seats.
  g.tint(hex("#2a2a2a")).box("trim", 0, 0.62, 0.45, 0.42, 0.1, 0.4); // driver
  g.tint(hex("#3a2a20")).box("trim", 0, 0.62, -0.6, 1.2, 0.12, 0.55); // passenger bench
  g.box("trim", 0, 0.72, -0.92, 1.2, 0.5, 0.1);
  // Canopy on posts.
  for (const [x, z] of [[-0.62, 0.8], [0.62, 0.8], [-0.62, -0.98], [0.62, -0.98]] as const) g.tint(hex("#222222")).box("metal", x, 0.6, z, 0.04, 1.15, 0.04);
  g.tint(hex("#1d1d1d")).box("cloth", 0, 1.75, -0.08, 1.38, 0.06, 1.95);
  g.tint(body).box("cloth", 0, 1.6, -0.08, 1.4, 0.15, 1.97, 1, ["top", "bottom"]);
}

export const OKADA_COLOURS = ["#c8442f", "#1f1f1f", "#2a6fb0", "#e0a526", "#7a2e3b", "#2f8a4c"];
export const KEKE_COLOURS: [string, string][] = [["#f2c230", "#2f8a4c"], ["#2f8a4c", "#f2c230"], ["#2a6fb0", "#f4efe4"], ["#e0a526", "#1f1f1f"]];
