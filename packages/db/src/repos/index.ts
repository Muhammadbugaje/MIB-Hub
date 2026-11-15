/**
 * The repository layer: the ONLY way the website talks to the database.
 *
 *   const repos = createRepos(db, { hasher });
 *   const games = await repos.games.listPublic();
 *
 * Pages and API routes never write SQL or import tables directly. That is
 * what lets us switch the database (local SQLite, Cloudflare D1, later
 * Postgres) by changing configuration, not page code.
 */
import type { AppDb, PasswordHasher } from "../types.ts";
import { cheatsRepo, heroesRepo } from "./cheats.ts";
import { gameSettingsRepo, gamesRepo } from "./games.ts";
import { profilesRepo, progressRepo, scoresRepo } from "./players.ts";
import { auditRepo, permissionOverridesRepo, rolesRepo, siteSettingsRepo, usersRepo } from "./platform.ts";

export function createRepos(db: AppDb, deps: { hasher: PasswordHasher }) {
  return {
    users: usersRepo(db),
    roles: rolesRepo(db),
    permissionOverrides: permissionOverridesRepo(db),
    audit: auditRepo(db),
    siteSettings: siteSettingsRepo(db),
    games: gamesRepo(db),
    gameSettings: gameSettingsRepo(db),
    cheats: cheatsRepo(db),
    heroes: heroesRepo(db, deps.hasher),
    profiles: profilesRepo(db),
    scores: scoresRepo(db),
    progress: progressRepo(db),
  };
}

export type Repos = ReturnType<typeof createRepos>;

export * from "./cheats.ts";
export * from "./games.ts";
export * from "./players.ts";
export * from "./platform.ts";
