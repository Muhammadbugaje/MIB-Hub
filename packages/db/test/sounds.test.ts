/** The sound manager's repository: versions, revert, volume and purge (game_sound + 0002_sound_manager). */
import { beforeEach, describe, expect, it } from "vitest";
import { createRepos, SOUND_KEEP_VERSIONS, type Repos } from "../src/index.ts";
import { createSqliteDb, migrateSqlite, type SqliteDb } from "../src/sqlite.ts";

const hasher = { hash: async (p: string) => p, verify: async (h: string, p: string) => h === p };
let db: SqliteDb;
let repos: Repos;
beforeEach(() => {
  db = createSqliteDb(":memory:");
  migrateSqlite(db);
  repos = createRepos(db, { hasher });
});

const file = (key: string) => ({ gameSlug: "momentum-cup", name: "goal", fileKey: key, contentType: "audio/wav", size: 10, duration: 1 });

describe("sound versions", () => {
  it("adds versions, keeps history and points game_sound at the newest", async () => {
    const a = await repos.sounds.addVersion({ ...file("sounds/a.wav"), source: "upload" });
    expect(a.before).toBeNull();
    expect(a.sound.version).toBe(1);
    const b = await repos.sounds.addVersion({ ...file("sounds/b.wav"), source: "record" });
    expect(b.before?.fileKey).toBe("sounds/a.wav");
    expect(b.sound.version).toBe(2);
    expect(b.sound.fileKey).toBe("sounds/b.wav");
    const hist = await repos.sounds.versions("momentum-cup", "goal");
    expect(hist.map((v) => [v.version, v.source])).toEqual([
      [2, "record"],
      [1, "upload"],
    ]);
  });

  it("reverts to an older version, to the original, and numbers new versions after the highest", async () => {
    await repos.sounds.addVersion(file("sounds/a.wav"));
    await repos.sounds.addVersion(file("sounds/b.wav"));
    const v1 = (await repos.sounds.versions("momentum-cup", "goal")).find((v) => v.version === 1)!;
    const used = await repos.sounds.useVersion(v1.id);
    expect(used?.sound.fileKey).toBe("sounds/a.wav");
    expect(used?.sound.version).toBe(1);
    await expect(repos.sounds.removeVersion(v1.id)).rejects.toThrow(/playing now/);
    const orig = await repos.sounds.useOriginal("momentum-cup", "goal");
    expect(orig?.fileKey).toBe("sounds/a.wav");
    expect(await repos.sounds.get("momentum-cup", "goal")).toBeUndefined();
    expect((await repos.sounds.versions("momentum-cup", "goal")).length).toBe(2); // history kept
    const c = await repos.sounds.addVersion(file("sounds/c.wav"));
    expect(c.sound.version).toBe(3);
    expect((await repos.sounds.removeVersion(v1.id))?.fileKey).toBe("sounds/a.wav");
  });

  it("prunes old versions beyond the limit and returns their files", async () => {
    let pruned: string[] = [];
    for (let i = 0; i < SOUND_KEEP_VERSIONS + 2; i++) pruned = pruned.concat((await repos.sounds.addVersion(file(`sounds/${i}.wav`))).pruned);
    expect(pruned).toEqual(["sounds/0.wav", "sounds/1.wav"]);
    expect((await repos.sounds.versions("momentum-cup", "goal")).length).toBe(SOUND_KEEP_VERSIONS);
  });

  it("rejects bad names", async () => {
    await expect(repos.sounds.addVersion({ ...file("x"), name: "Bad Name" })).rejects.toThrow();
    await expect(repos.sounds.setVolume("g", "Bad Name", 1)).rejects.toThrow();
  });
});

describe("sound settings", () => {
  it("sets, clamps and clears the per-sound volume", async () => {
    const a = await repos.sounds.setVolume("momentum-cup", "kick", 0.5, null);
    expect(a.before).toBeNull();
    expect(a.after?.volume).toBe(0.5);
    const b = await repos.sounds.setVolume("momentum-cup", "kick", 9);
    expect(b.before?.volume).toBe(0.5);
    expect(b.after?.volume).toBe(2);
    const c = await repos.sounds.setVolume("momentum-cup", "kick", 1);
    expect(c.after).toBeNull();
    expect(await repos.sounds.settings("momentum-cup")).toEqual([]);
  });

  it("purges a sound's override, history and settings", async () => {
    await repos.sounds.addVersion(file("sounds/a.wav"));
    await repos.sounds.addVersion(file("sounds/b.wav"));
    await repos.sounds.setVolume("momentum-cup", "goal", 0.4);
    expect((await repos.sounds.purge("momentum-cup", "goal")).sort()).toEqual(["sounds/a.wav", "sounds/b.wav"]);
    expect(await repos.sounds.get("momentum-cup", "goal")).toBeUndefined();
    expect(await repos.sounds.settings("momentum-cup")).toEqual([]);
  });
});
