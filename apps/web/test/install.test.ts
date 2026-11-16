// The Add to Home Screen nudge rules (src/components/public/install.ts).
// The popup is occasional by design: at most once a fortnight, a week of quiet
// after "Maybe later", and silence after "Don't remind me again".
import { describe, expect, it } from "vitest";
import {
  afterDismiss,
  afterLater,
  afterShown,
  DAY,
  deviceKind,
  INSTALL_KEY,
  readMemory,
  REMIND_AFTER,
  shouldOffer,
  SNOOZE_FOR,
} from "../src/components/public/install.ts";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const IPAD =
  "Mozilla/5.0 (iPad; CPU OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
const MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15";
const WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const NOW = 1_800_000_000_000;

describe("deviceKind", () => {
  it("recognises phones and tablets", () => {
    expect(deviceKind(IPHONE, 5)).toBe("iphone");
    expect(deviceKind(IPAD, 5)).toBe("iphone");
    expect(deviceKind(ANDROID, 5)).toBe("android");
  });

  it("treats a touch-capable Mac as an iPad (iPadOS desktop mode)", () => {
    expect(deviceKind(MAC, 5, "MacIntel")).toBe("iphone");
  });

  it("leaves real desktops alone", () => {
    expect(deviceKind(MAC, 0, "MacIntel")).toBe("other");
    expect(deviceKind(WINDOWS, 0, "Win32")).toBe("other");
    expect(deviceKind("", 0)).toBe("other");
  });
});

describe("readMemory", () => {
  it("reads the fields it wrote", () => {
    const memory = { shown: NOW, until: NOW + DAY, off: true };
    expect(readMemory(JSON.stringify(memory))).toEqual(memory);
  });

  it("survives missing, broken and hostile values", () => {
    expect(readMemory(null)).toEqual({});
    expect(readMemory("")).toEqual({});
    expect(readMemory("{not json")).toEqual({});
    expect(readMemory("null")).toEqual({});
    expect(readMemory("42")).toEqual({});
    expect(readMemory(JSON.stringify({ shown: "yesterday", until: {}, off: "yes" }))).toEqual({});
    expect(readMemory(JSON.stringify({ shown: Infinity, until: NaN }))).toEqual({});
  });
});

describe("shouldOffer", () => {
  it("offers on a phone that has never been asked", () => {
    expect(shouldOffer({ device: "iphone", memory: {}, now: NOW, installed: false })).toBe(true);
    expect(shouldOffer({ device: "android", memory: {}, now: NOW, installed: false })).toBe(true);
  });

  it("stays quiet on desktops and installed windows", () => {
    expect(shouldOffer({ device: "other", memory: {}, now: NOW, installed: false })).toBe(false);
    expect(shouldOffer({ device: "iphone", memory: {}, now: NOW, installed: true })).toBe(false);
  });

  it("honours the opt-out", () => {
    expect(shouldOffer({ device: "iphone", memory: { off: true }, now: NOW, installed: false })).toBe(false);
  });

  it("waits out a snooze", () => {
    expect(shouldOffer({ device: "iphone", memory: { until: NOW + 1 }, now: NOW, installed: false })).toBe(false);
    expect(shouldOffer({ device: "iphone", memory: { until: NOW }, now: NOW, installed: false })).toBe(true);
  });

  it("shows at most once a fortnight", () => {
    expect(
      shouldOffer({ device: "iphone", memory: { shown: NOW - DAY }, now: NOW, installed: false }),
    ).toBe(false);
    expect(
      shouldOffer({ device: "iphone", memory: { shown: NOW - REMIND_AFTER + 1 }, now: NOW, installed: false }),
    ).toBe(false);
    expect(
      shouldOffer({ device: "iphone", memory: { shown: NOW - REMIND_AFTER }, now: NOW, installed: false }),
    ).toBe(true);
  });
});

describe("memory updates", () => {
  it("records the showing", () => {
    expect(afterShown({}, NOW)).toEqual({ shown: NOW });
  });

  it("snoozes for a week without losing what it knew", () => {
    expect(afterLater({ shown: NOW - REMIND_AFTER }, NOW)).toEqual({
      shown: NOW - REMIND_AFTER,
      until: NOW + SNOOZE_FOR,
    });
  });

  it("opts out for good", () => {
    expect(afterDismiss({ shown: NOW })).toEqual({ shown: NOW, off: true });
  });

  it("does not mutate the input", () => {
    const before: { shown?: number; until?: number; off?: boolean } = {};
    afterShown(before, NOW);
    afterLater(before, NOW);
    afterDismiss(before);
    expect(before).toEqual({});
  });

  it("uses one stable key", () => {
    expect(INSTALL_KEY).toBe("mib-install-v1");
  });
});
