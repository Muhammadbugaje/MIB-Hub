import { describe, expect, it } from "vitest";
import {
  MOTION_KEY,
  THEME_INIT_SCRIPT,
  THEME_KEY,
  THEME_OS_KEY,
  nextTheme,
  readTheme,
  resolveTheme,
  saveTheme,
  type Theme,
  type ThemeStorage,
} from "../src/theme.ts";

/** An in-memory stand-in for window.localStorage. */
function memoryStorage(initial: Record<string, string> = {}): ThemeStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k]! : null),
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

describe("resolveTheme", () => {
  it("follows the device when nothing is saved", () => {
    expect(resolveTheme({ stored: null, storedOs: null, osTheme: "dark" })).toBe("dark");
    expect(resolveTheme({ stored: null, storedOs: null, osTheme: "light" })).toBe("light");
  });

  it("uses the saved choice while the device is unchanged", () => {
    expect(resolveTheme({ stored: "dark", storedOs: "light", osTheme: "light" })).toBe("dark");
  });

  it("follows the device again once the device setting changes", () => {
    expect(resolveTheme({ stored: "dark", storedOs: "light", osTheme: "dark" })).toBe("dark");
    expect(resolveTheme({ stored: "light", storedOs: "dark", osTheme: "light" })).toBe("light");
  });

  it("ignores junk in storage", () => {
    expect(resolveTheme({ stored: "purple", storedOs: "light", osTheme: "light" })).toBe("light");
  });
});

describe("save and read", () => {
  it("remembers a choice that differs from the device", () => {
    const s = memoryStorage();
    saveTheme(s, "dark", "light");
    expect(s.data[THEME_KEY]).toBe("dark");
    expect(s.data[THEME_OS_KEY]).toBe("light");
    expect(readTheme(s, "light")).toBe("dark");
  });

  it("clears the saved value when the choice matches the device", () => {
    const s = memoryStorage({ [THEME_KEY]: "dark", [THEME_OS_KEY]: "light" });
    saveTheme(s, "light", "light");
    expect(s.data).toEqual({});
    expect(readTheme(s, "light")).toBe("light");
  });

  it("survives blocked storage", () => {
    const broken: ThemeStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readTheme(broken, "dark")).toBe("dark");
    expect(() => saveTheme(broken, "light", "dark")).not.toThrow();
    expect(readTheme(null, "light")).toBe("light");
  });

  it("toggles", () => {
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("light");
  });
});

describe("THEME_INIT_SCRIPT (the inline <head> script)", () => {
  /** Run the inline script against fake browser objects and return data-theme. */
  function runInit(store: Record<string, string>, osDark: boolean): { theme: string | null; motion: string | null } {
    const attrs: Record<string, string> = {};
    const fakeDocument = {
      documentElement: {
        setAttribute: (k: string, v: string) => {
          attrs[k] = v;
        },
        classList: { add: () => undefined },
      },
    };
    const fakeWindow = { matchMedia: () => ({ matches: osDark }) };
    const storage = memoryStorage(store);
    new Function("document", "window", "localStorage", THEME_INIT_SCRIPT)(fakeDocument, fakeWindow, storage);
    return { theme: attrs["data-theme"] ?? null, motion: attrs["data-motion"] ?? null };
  }

  const cases: Array<[Record<string, string>, boolean]> = [
    [{}, false],
    [{}, true],
    [{ [THEME_KEY]: "dark", [THEME_OS_KEY]: "light" }, false],
    [{ [THEME_KEY]: "dark", [THEME_OS_KEY]: "light" }, true],
    [{ [THEME_KEY]: "light", [THEME_OS_KEY]: "dark" }, true],
    [{ [THEME_KEY]: "nonsense", [THEME_OS_KEY]: "dark" }, true],
  ];

  it.each(cases)("agrees with resolveTheme for %j (device dark: %s)", (store, osDark) => {
    const osTheme: Theme = osDark ? "dark" : "light";
    const expected = resolveTheme({ stored: store[THEME_KEY] ?? null, storedOs: store[THEME_OS_KEY] ?? null, osTheme });
    expect(runInit(store, osDark).theme).toBe(expected);
  });

  it("applies the reduced-motion switch", () => {
    expect(runInit({ [MOTION_KEY]: "reduce" }, false).motion).toBe("reduce");
    expect(runInit({}, false).motion).toBeNull();
  });
});
