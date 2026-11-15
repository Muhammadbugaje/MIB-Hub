/**
 * The admin sections still to be built, with the permission each needs and
 * what goes in it. /admin shows these as cards; /admin/<key> shows the
 * placeholder page. The admin-panel worker replaces each placeholder with a
 * real page at src/pages/admin/<key>.astro (a real file wins over [section].astro).
 */
import type { Permission } from "./permissions.ts";

export interface AdminSection {
  key: string;
  title: string;
  permission: Permission;
  summary: string;
  /** What to build (shown on the placeholder page). */
  todo: string[];
}

export const ADMIN_SECTIONS: AdminSection[] = [
  {
    key: "games",
    title: "Games",
    permission: "games.manage",
    summary: "The catalogue: add games, edit cards, status (hidden / demo / live), order and kill switches.",
    todo: ["List and edit rows via repos.games", "Status and enabled toggles", "Per-game settings via repos.gameSettings", "Audit every change"],
  },
  {
    key: "cheats",
    title: "Cheats & heroes",
    permission: "games.manage_settings",
    summary: "Cheat codes (stored hashed), access modes and the secret character.",
    todo: ["repos.cheats create/setCode/setEnabled (never show old codes)", "Access mode per game and site-wide (*)", "repos.heroes with password-hashed codes", "Import defaults from legacy cheat_defaults JSON"],
  },
  {
    key: "content",
    title: "Game content",
    permission: "games.manage_content",
    summary: "Character, config and credits editors with history and rollback.",
    todo: ["game_content + game_content_version tables", "Parity with the Django FSLG editors (fields, validation)", "Rollback to any version"],
  },
  {
    key: "sounds",
    title: "Sounds",
    permission: "games.manage_sounds",
    summary: "Replacement sounds for every player of a game.",
    todo: ["Upload to storage (R2), row in game_sound", "Size and duration limits from the old sounds.py"],
  },
  {
    key: "users",
    title: "Users & roles",
    permission: "users.view",
    summary: "Accounts, roles, bans and single-permission grants or revokes.",
    todo: ["repos.users list/search", "Role changes limited by canManageRole()", "Overrides via repos.permissionOverrides (roles.manage)", "Ban / unban"],
  },
  {
    key: "scores",
    title: "Leaderboards",
    permission: "scores.moderate",
    summary: "Review top scores, mark cheated runs, remove bad entries.",
    todo: ["repos.scores.top per game, including cheated", "Mark cheated / delete with an audit entry"],
  },
  {
    key: "audit",
    title: "Audit log",
    permission: "audit.view",
    summary: "Who changed what, with old and new values (secrets redacted).",
    todo: ["repos.audit.list with filters", "Link targets to their admin pages"],
  },
  {
    key: "settings",
    title: "Site settings",
    permission: "site.settings",
    summary: "Branding (name, tagline, colours), flags and global kill switches.",
    todo: ["repos.siteSettings get/set", "Branding keys override site.config.ts at runtime", "Live preview"],
  },
];
