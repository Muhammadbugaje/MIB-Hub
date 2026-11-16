/**
 * The offline-download manifests (src/offline/manifest.ts, written by
 * scripts/offline-manifest.ts): built from the real files in public/, every
 * game gets every file it needs, nothing is missing or too big for static
 * hosting, and any file change changes the version.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { collectManifests } from "../scripts/offline-manifest.ts";
import { LEGACY_GAMES, legacyScripts } from "../src/games/legacy.ts";
import {
  CONTRACT_OFFLINE,
  MAX_FILE_BYTES,
  ManifestError,
  THREE_URL,
  buildIndex,
  buildManifest,
  legacyGameUrls,
  sfxUrls,
} from "../src/offline/manifest.ts";
import catalogue from "../../../packages/db/seed/games.catalogue.json";

const hash = (t: string) => createHash("sha256").update(t).digest("hex");
const manifests = collectManifests();
const bySlug = new Map(manifests.map((m) => [m.slug, m]));

describe("manifests built from the real files", () => {
  it("covers every legacy game, and contract games only when they opt in", () => {
    expect([...bySlug.keys()].sort()).toEqual([...Object.keys(LEGACY_GAMES), ...Object.keys(CONTRACT_OFFLINE)].sort());
    expect(bySlug.has("work-in-progress")).toBe(Object.prototype.hasOwnProperty.call(CONTRACT_OFFLINE, "work-in-progress"));
  });

  it("lists every script the play page loads, the bridge, the styles, the icon and the offline client", () => {
    for (const g of catalogue as { slug: string; entry: string; meta?: { dependencies?: unknown } }[]) {
      const urls = new Set(bySlug.get(g.slug)!.files.map((f) => f.url));
      for (const s of legacyScripts(g.slug, g.entry, g.meta?.dependencies)) expect(urls, `${g.slug}: ${s}`).toContain(s);
      for (const u of [
        "/play/_shared/mib/mib-play.js",
        "/play/_shared/css/games.css",
        "/offline/mib-sync.js",
        "/offline/mib-offline.js",
        "/offline.html",
        `/games/${g.slug}/icon.png`,
        "/play/_shared/audio/sfx/manifest.json",
      ]) {
        expect(urls, `${g.slug}: ${u}`).toContain(u);
      }
      expect(bySlug.get(g.slug)!.page).toBe(`/play/${g.slug}`);
    }
  });

  it("gives the 3D game three.js, its intro music and narration", () => {
    const urls = bySlug.get("samaru-days")!.files.map((f) => f.url);
    expect(urls).toContain(THREE_URL);
    expect(urls).toContain("/play/_shared/audio/fslg-intro/title.ogg");
    expect(urls).toContain("/play/_shared/audio/fslg-intro/title.m4a");
    expect(urls).toContain("/play/_shared/audio/voice/manifest.json");
    expect(urls.some((u) => u.startsWith("/play/_shared/audio/voice/intro/"))).toBe(true);
    expect(bySlug.get("light-bender")!.files.map((f) => f.url)).not.toContain(THREE_URL);
  });

  it("has each sound in both formats, and sizes per format", () => {
    for (const m of manifests) {
      const ogg = m.files.filter((f) => f.variant === "ogg").map((f) => f.url.replace(/\.ogg$/, ""));
      const m4a = m.files.filter((f) => f.variant === "m4a").map((f) => f.url.replace(/\.m4a$/, ""));
      expect(ogg.sort()).toEqual(m4a.sort());
      expect(ogg.length).toBeGreaterThan(10);
      const common = m.files.filter((f) => !f.variant).reduce((n, f) => n + f.bytes, 0);
      expect(m.bytes.ogg).toBe(common + m.files.filter((f) => f.variant === "ogg").reduce((n, f) => n + f.bytes, 0));
    }
  });

  it("has no file of 25 MiB or more, no duplicates, and stays light", () => {
    for (const m of manifests) {
      expect(new Set(m.files.map((f) => f.url)).size).toBe(m.files.length);
      for (const f of m.files) {
        expect(f.bytes).toBeLessThan(MAX_FILE_BYTES);
        expect(f.hash).toMatch(/^[0-9a-f]{20}$/);
        expect(f.url).toMatch(/^\/[^.]/);
      }
      expect(m.bytes.m4a, m.slug).toBeLessThan(15 * 1024 * 1024);
    }
  });

  it("is the same every time it is built, and different per game", () => {
    const again = collectManifests();
    expect(again).toEqual(manifests);
    expect(new Set(manifests.map((m) => m.version)).size).toBe(manifests.length);
    expect(buildIndex(manifests).games.map((g) => g.slug)).toEqual([...bySlug.keys()].sort());
  });
});

describe("the manifest builder", () => {
  const files: Record<string, { bytes: number; hash: string }> = {
    "/a.js": { bytes: 10, hash: "h1" },
    "/b.ogg": { bytes: 5, hash: "h2" },
    "/b.m4a": { bytes: 7, hash: "h3" },
  };
  const stat = (u: string) => files[u] ?? null;
  const wanted = [{ url: "/a.js" }, { url: "/b.ogg", variant: "ogg" as const }, { url: "/b.m4a", variant: "m4a" as const }, { url: "/a.js" }];

  it("sums per format, sorts, de-duplicates and versions", () => {
    const m = buildManifest({ slug: "g", title: "G" }, wanted, stat, hash);
    expect(m.files.map((f) => f.url)).toEqual(["/a.js", "/b.m4a", "/b.ogg"]);
    expect(m.bytes).toEqual({ ogg: 15, m4a: 17 });
    expect(m.version).toMatch(/^[0-9a-f]{16}$/);
  });

  it("changes the version when any file changes (so players see 'Update available')", () => {
    const v1 = buildManifest({ slug: "g", title: "G" }, wanted, stat, hash).version;
    files["/b.m4a"] = { bytes: 7, hash: "h3-changed" };
    expect(buildManifest({ slug: "g", title: "G" }, wanted, stat, hash).version).not.toBe(v1);
  });

  it("refuses missing files, files too big for static hosting and odd paths", () => {
    expect(() => buildManifest({ slug: "g", title: "G" }, [{ url: "/nope.js" }], stat, hash)).toThrow(ManifestError);
    files["/big.bin"] = { bytes: MAX_FILE_BYTES, hash: "x" };
    expect(() => buildManifest({ slug: "g", title: "G" }, [{ url: "/big.bin" }], stat, hash)).toThrow(/25 MiB/);
    expect(() => buildManifest({ slug: "g", title: "G" }, [{ url: "/../etc/passwd" }], () => ({ bytes: 1, hash: "x" }), hash)).toThrow(ManifestError);
  });

  it("takes a game's own sound pack plus the shared core, and folders whole (no notes or dotfiles)", () => {
    const sfx = { core: { click: { f: ["core/click_1"] } }, packs: { wavefront: { zap: { f: ["wave/zap_1"] } }, other: { x: { f: ["x/y"] } } } };
    const urls = sfxUrls("wavefront", sfx).map((w) => w.url);
    expect(urls).toContain("/play/_shared/audio/sfx/wave/zap_1.ogg");
    expect(urls).toContain("/play/_shared/audio/sfx/core/click_1.m4a");
    expect(urls.some((u) => u.includes("x/y"))).toBe(false);
    const list = legacyGameUrls({ slug: "samaru-days", entry: "samaru", dependencies: [] }, null, (dir) => [`${dir}a.ogg`, `${dir}NOTES.md`, `${dir}.DS_Store`]);
    const extra = list.map((w) => w.url).filter((u) => u.includes("/audio/"));
    expect(extra).toContain("/play/_shared/audio/fslg-intro/a.ogg");
    expect(extra.some((u) => u.endsWith(".md") || u.endsWith(".DS_Store"))).toBe(false);
    expect(legacyGameUrls({ slug: "not-a-game", entry: "x", dependencies: [] }, null, () => [])).toEqual([]);
  });
});
