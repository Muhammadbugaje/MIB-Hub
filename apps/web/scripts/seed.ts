/**
 * `npm run db:seed`: fill the local database with the starting data.
 * Safe to run again: it only adds what is missing, and never overwrites
 * changes made in the admin panel.
 *
 *   1. the built-in roles
 *   2. the games catalogue (copied from the old site's games/catalogue.py,
 *      packages/db/seed/games.catalogue.json; no personal data)
 *   3. default site settings
 *   4. the owner account, from OWNER_EMAIL / OWNER_PASSWORD / OWNER_NAME in .env
 *
 * Never put real credentials in this file. They come from .env only.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { GameMeta, GameStatus } from "@mib/db";
import { migrateSqlite, type SqliteDb } from "@mib/db/sqlite";
import { auth } from "../src/lib/auth.ts";
import { db as appDb, repos } from "../src/lib/db.ts";
import { REPO_ROOT, env } from "../src/lib/env.ts";
import { ROLES, ROLE_INFO } from "../src/lib/permissions.ts";
import { siteConfig } from "../src/site.config.ts";

/** Scripts always run on Node, so the database is the local SQLite file. */
const db = appDb as SqliteDb;
import { seedContent } from "./seed-content.ts";

interface CatalogueEntry {
  slug: string;
  title: string;
  description: string;
  category: string;
  level: number;
  accent: string;
  entry: string;
  sort: number;
  meta: GameMeta;
}

async function main() {
  console.log(`Seeding ${env.databaseFile}`);
  migrateSqlite(db);

  // 1. Roles
  await repos.roles.upsertMany(ROLES.map((key) => ({ key, ...ROLE_INFO[key] })));
  console.log(`  roles: ${ROLES.join(", ")}`);

  // 2. Games (add missing ones only)
  const file = resolve(REPO_ROOT, "packages/db/seed/games.catalogue.json");
  const catalogue = JSON.parse(readFileSync(file, "utf8")) as CatalogueEntry[];
  let added = 0;
  for (const g of catalogue) {
    if (await repos.games.getBySlug(g.slug)) continue;
    // "live" so they show on the home page; their play pages say "coming soon" until ported.
    await repos.games.upsert({ ...g, status: "live" satisfies GameStatus, assetsPath: `/games/${g.slug}/` });
    added++;
  }
  // A tiny demo that proves the game loader contract (hidden: admins can preview it).
  if (!(await repos.games.getBySlug("demo-hello"))) {
    await repos.games.upsert({
      slug: "demo-hello",
      title: "Loader demo",
      description: "A bouncing dot that proves the game loader contract works end to end.",
      category: "demo",
      status: "hidden",
      entry: "demo-hello",
      sort: 9999,
      meta: { genre: "Developer demo" },
    });
    added++;
  }
  console.log(`  games: ${added} added, ${catalogue.length + 1 - added} already there`);

  // 3. Site settings (defaults; the admin panel changes them later)
  const defaults: Record<string, unknown> = {
    "brand.name": siteConfig.name,
    "brand.tagline": siteConfig.tagline,
    "games.cheatsOnLeaderboards": false,
    "site.maintenance": false,
  };
  const current = await repos.siteSettings.all();
  for (const [key, value] of Object.entries(defaults)) {
    if (!(key in current)) await repos.siteSettings.set(key, value);
  }

  // 4. Site v2 content: cheats, heroes, cast, news, events, store, credits, FAQs, switches
  await seedContent(repos);

  // 5. Owner account
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.OWNER_PASSWORD;
  const name = process.env.OWNER_NAME?.trim() || "Site Owner";
  if (!email || !password) {
    console.warn("  owner: skipped (set OWNER_EMAIL and OWNER_PASSWORD in .env, then run db:seed again)");
  } else {
    let owner = await repos.users.findByEmail(email);
    if (!owner) {
      await auth.api.signUpEmail({ body: { name, email, password } });
      owner = await repos.users.findByEmail(email);
      console.log(`  owner: created ${email}`);
    } else if (process.env.RESET_OWNER_PASSWORD === "1") {
      // Opt-in: `RESET_OWNER_PASSWORD=1 npm run db:seed` sets the owner's password to OWNER_PASSWORD.
      const ctx = await auth.$context;
      await ctx.internalAdapter.updatePassword(owner.id, await ctx.password.hash(password));
      await repos.audit.record({ actorId: null, action: "user.password_reset", targetType: "user", targetId: owner.id, note: "seed: reset from .env" });
      console.log(`  owner: ${email} password reset from .env`);
    } else {
      console.log(`  owner: ${email} already exists (password left unchanged; RESET_OWNER_PASSWORD=1 resets it from .env)`);
    }
    if (owner && owner.role !== "owner") {
      await repos.users.setRole(owner.id, "owner");
      await repos.audit.record({ actorId: null, action: "user.role", targetType: "user", targetId: owner.id, after: { role: "owner" }, note: "seed" });
    }
  }

  console.log("Done.");
}

main()
  .then(() => db.$sqlite.close())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
