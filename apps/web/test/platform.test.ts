// The platform layer (src/platform/): upload keys and the on-disk blob store
// used by `npm run dev`. The Cloudflare side (uploads in D1) is tested in
// packages/db/test/blob-store.test.ts and checked by hand with `npm run preview`.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { folderBlobStore } from "../src/platform/node.ts";
import { isSafeKey } from "../src/platform/types.ts";

describe("isSafeKey", () => {
  it("accepts folder/name.ext keys", () => {
    expect(isSafeKey("people/5b3bd67d-c9a7-4ee8-9c14-71dcdb29d87f.png")).toBe(true);
    expect(isSafeKey("sounds/abc-123.mp3")).toBe(true);
  });
  it("rejects paths that could escape the folder or bucket", () => {
    for (const bad of ["../x.png", "people/../../x.png", "/people/x.png", "people/x", "a/b/c.png", "People/x.png", "people\\x.png", ""]) {
      expect(isSafeKey(bad), bad).toBe(false);
    }
  });
});

describe("folderBlobStore", () => {
  const root = mkdtempSync(join(tmpdir(), "mib-blobs-"));
  const store = folderBlobStore(root);
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it("stores, reads back and deletes a file", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    await store.put("people/a-1.png", bytes, "image/png");
    const got = await store.get("people/a-1.png");
    expect(got?.contentType).toBe("image/png");
    expect([...(got?.bytes ?? [])]).toEqual([1, 2, 3, 4]);
    const info = await store.stat("people/a-1.png");
    expect(info).toMatchObject({ contentType: "image/png", size: 4 });
    expect(info?.etag).toBe(got?.etag);
    await store.delete("people/a-1.png");
    expect(await store.get("people/a-1.png")).toBeNull();
  });

  it("refuses unsafe keys", async () => {
    await expect(store.put("../evil.png", new Uint8Array([1]), "image/png")).rejects.toThrow();
    expect(await store.get("../../etc/passwd.png")).toBeNull();
  });
});

describe("etagMatches (GET /uploads/*)", () => {
  it("matches a listed or weak ETag and *, nothing else", async () => {
    const { etagMatches } = await import("../src/lib/uploads.ts");
    expect(etagMatches('"abc"', '"abc"')).toBe(true);
    expect(etagMatches('"x", W/"abc"', '"abc"')).toBe(true);
    expect(etagMatches("*", '"abc"')).toBe(true);
    expect(etagMatches('"abd"', '"abc"')).toBe(false);
    expect(etagMatches(null, '"abc"')).toBe(false);
  });
});

describe("profile pictures are switched off", () => {
  const png = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0])], "a.png", { type: "image/png" });
  it("refuses uploads into the avatars folder (any spelling)", async () => {
    const { saveImage } = await import("../src/lib/uploads.ts");
    for (const folder of ["avatars", "Avatars", "avatar", "profile", "av/atars"]) {
      await expect(saveImage(png(), folder)).rejects.toThrow(/switched off/);
    }
  });
  it("still takes staff folders, and stops serving old avatars", async () => {
    const { isBlockedUploadPath, uploadFolder } = await import("../src/lib/uploads.ts");
    expect(uploadFolder("people")).toBe("people");
    expect(uploadFolder("news-covers")).toBe("news-covers");
    expect(uploadFolder("")).toBe("misc");
    expect(isBlockedUploadPath("avatars/abc.png")).toBe(true);
    expect(isBlockedUploadPath("people/abc.png")).toBe(false);
    expect(isBlockedUploadPath("news/abc.png")).toBe(false);
  });
});
