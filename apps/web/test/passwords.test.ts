/**
 * Password hashing for the Workers Free plan (src/lib/passwords.ts): PBKDF2
 * via Web Crypto, older scrypt hashes still accepted and upgraded at sign-in.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRepos, hashPbkdf2, PBKDF2_ITERATIONS, pbkdf2Iterations, verifyPbkdf2 } from "@mib/db";
import { account, hero, user } from "@mib/db/schema";
import { createSqliteDb, migrateSqlite } from "@mib/db/sqlite";
import { hashPassword as scryptHash } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { hashPassword, isScryptHash, needsRehash, passwordHasher, verifyPassword } from "../src/lib/passwords.ts";

describe("PBKDF2 hashes", () => {
  it("hash and verify round-trip, with a fresh salt each time", async () => {
    const a = await hashPassword("correct horse battery");
    const b = await hashPassword("correct horse battery");
    expect(a).toMatch(/^pbkdf2-sha256\$20000\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
    expect(await verifyPassword(a, "correct horse battery")).toBe(true);
    expect(await verifyPassword(a, "correct horse batterY")).toBe(false);
    expect(pbkdf2Iterations(a)).toBe(PBKDF2_ITERATIONS);
    expect(needsRehash(a)).toBe(false);
  });

  it("keeps the rounds in the hash, so they can be raised later", async () => {
    const low = await hashPbkdf2("pw-12345678", 1000);
    expect(await verifyPbkdf2(low, "pw-12345678")).toBe(true);
    expect(needsRehash(low)).toBe(true);
  });

  it("rejects broken or over-sized hashes instead of throwing", async () => {
    for (const bad of ["", "pbkdf2-sha256$x$00$00", "pbkdf2-sha256$20000$zz$00", "pbkdf2-sha256$200000$00$00", "nonsense"]) {
      expect(await verifyPassword(bad, "pw-12345678"), bad).toBe(false);
    }
  });
});

describe("old scrypt hashes", () => {
  it("still verify, and are marked for re-hashing", async () => {
    const old = await scryptHash("old-password-1");
    expect(isScryptHash(old)).toBe(true);
    expect(await verifyPassword(old, "old-password-1")).toBe(true);
    expect(await verifyPassword(old, "wrong-password")).toBe(false);
    expect(needsRehash(old)).toBe(true);
  });

  it("hero codes stored with scrypt upgrade to PBKDF2 on first correct use", async () => {
    const db = createSqliteDb(":memory:");
    migrateSqlite(db);
    const repos = createRepos(db, { hasher: passwordHasher });
    await db.insert(hero).values({ name: "Hero", gameSlug: "*", passwordHash: await scryptHash("herocode") });
    expect(await repos.heroes.verify("maze", "wrong")).toBeNull();
    expect(await repos.heroes.verify("maze", "HERO code")).not.toBeNull();
    const row = (await db.select().from(hero))[0]!;
    expect(row.passwordHash.startsWith("pbkdf2-sha256$")).toBe(true);
    expect(await repos.heroes.verify("maze", "herocode")).not.toBeNull();
  });
});

describe("Better Auth sign-in with an old scrypt account", () => {
  const dir = mkdtempSync(join(tmpdir(), "mib-auth-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("signs in, then stores a PBKDF2 hash in place of the scrypt one", async () => {
    process.env.DATABASE_FILE = join(dir, "auth.sqlite");
    const raw = createSqliteDb(process.env.DATABASE_FILE);
    migrateSqlite(raw);
    await raw.insert(user).values({ id: "u-old", name: "Old", email: "old@example.com" });
    await raw.insert(account).values({ id: "a-old", accountId: "u-old", providerId: "credential", userId: "u-old", password: await scryptHash("old-password-1") });

    const { auth } = await import("../src/lib/auth.ts");
    const res = await auth.api.signInEmail({ body: { email: "old@example.com", password: "old-password-1" }, asResponse: true });
    expect(res.status).toBe(200);
    const stored = (await raw.select().from(account).where(eq(account.id, "a-old")))[0]!.password!;
    expect(stored.startsWith("pbkdf2-sha256$")).toBe(true);

    const again = await auth.api.signInEmail({ body: { email: "old@example.com", password: "old-password-1" }, asResponse: true });
    expect(again.status).toBe(200);
    const wrong = await auth.api.signInEmail({ body: { email: "old@example.com", password: "nope-nope-1" }, asResponse: true });
    expect(wrong.status).toBe(401);

    // New accounts get PBKDF2 straight away.
    await auth.api.signUpEmail({ body: { name: "New", email: "new@example.com", password: "new-password-1" } });
    const fresh = (await raw.select({ p: account.password, u: user.email }).from(account).innerJoin(user, eq(user.id, account.userId))).find((r) => r.u === "new@example.com");
    expect(fresh?.p?.startsWith("pbkdf2-sha256$")).toBe(true);
    raw.$sqlite.close();
  }, 20_000);
});
