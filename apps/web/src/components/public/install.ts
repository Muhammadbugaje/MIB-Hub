/**
 * The "Add to Home Screen" nudge: who to ask, how often, and what each button
 * remembers. Kept free of DOM code so the rules can be tested.
 *
 * The homepage guide (InstallGuide.astro) reads and writes one localStorage
 * key. The shape is deliberately loose: a newer build may add fields, and an
 * older value must never break the page.
 */

/** localStorage key for the nudge. Bump the suffix to ask everyone again. */
export const INSTALL_KEY = "mib-install-v1";

export const DAY = 24 * 60 * 60 * 1000;
/** After the popup has been shown, leave it alone for a fortnight. */
export const REMIND_AFTER = 14 * DAY;
/** "Maybe later" means a week of quiet. */
export const SNOOZE_FOR = 7 * DAY;

export type DeviceKind = "iphone" | "android" | "other";

export interface InstallMemory {
  /** When the popup was last shown, in ms since epoch. */
  shown?: number;
  /** Stay quiet until this time, in ms since epoch ("Maybe later"). */
  until?: number;
  /** "Don't remind me again". */
  off?: boolean;
}

/**
 * Which install flow to explain. iPadOS 13+ sends a desktop Mac user agent,
 * so a touch-capable Mac is treated as an iPad.
 */
export function deviceKind(userAgent: string, maxTouchPoints = 0, platform = ""): DeviceKind {
  const ua = userAgent || "";
  if (/iphone|ipod|ipad/i.test(ua)) return "iphone";
  if (/android/i.test(ua)) return "android";
  if (/macintosh|mac os x/i.test(ua) && maxTouchPoints > 1) return "iphone";
  if (/macintosh|mac os x/i.test(platform) && maxTouchPoints > 1) return "iphone";
  return "other";
}

/** Parse a stored value, keeping only well-formed fields. Anything else is ignored. */
export function readMemory(raw: string | null | undefined): InstallMemory {
  if (!raw) return {};
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  const memory: InstallMemory = {};
  if (typeof record.shown === "number" && Number.isFinite(record.shown)) memory.shown = record.shown;
  if (typeof record.until === "number" && Number.isFinite(record.until)) memory.until = record.until;
  if (record.off === true) memory.off = true;
  return memory;
}

/**
 * Whether the popup may appear right now. It never appears on a desktop, in an
 * installed window, after an opt-out, during a snooze, or within two weeks of
 * the last showing.
 */
export function shouldOffer(input: {
  device: DeviceKind;
  memory: InstallMemory;
  now: number;
  installed: boolean;
}): boolean {
  const { device, memory, now, installed } = input;
  if (installed || device === "other") return false;
  if (memory.off === true) return false;
  if (typeof memory.until === "number" && now < memory.until) return false;
  if (typeof memory.shown === "number" && now - memory.shown < REMIND_AFTER) return false;
  return true;
}

/** Remember that the popup was shown. */
export function afterShown(memory: InstallMemory, now: number): InstallMemory {
  return { ...memory, shown: now };
}

/** "Maybe later": hide it for a week. */
export function afterLater(memory: InstallMemory, now: number): InstallMemory {
  return { ...memory, until: now + SNOOZE_FOR };
}

/** "Don't remind me again": never ask on this device. */
export function afterDismiss(memory: InstallMemory): InstallMemory {
  return { ...memory, off: true };
}
