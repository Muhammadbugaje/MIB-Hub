/**
 * Roles and permissions: THE one file that says who may do what.
 *
 * Mirrors EE Hub's accounts.access resolver, simplified:
 *   effective permissions =
 *       everything the user's ROLE grants (ROLE_PERMISSIONS below)
 *     + personal grants   (user_permission_override rows, not expired)
 *     - personal revokes
 *   The owner always holds every permission (like Django's superuser).
 *
 * Django permissions the old games used, and their new names:
 *   games.manage_game_settings (Game Settings: rules, cheats, hero) -> games.manage_settings
 *   is_super_admin (character/config/credits editors)                -> games.manage_content
 *   is_super_admin (global sound uploads)                            -> games.manage_sounds
 *   "staff" viewer (preview every level / disabled games)            -> games.preview
 *   cheat/hero access mode "staff"                                    -> cheats.staff
 *
 * Permissions are checked on the server (middleware + guard), never by
 * hiding buttons alone (V2 §25.1).
 */

/** Every permission, with a plain-English description for the admin panel. */
export const PERMISSIONS = {
  "games.play": "Play games that are live and enabled",
  "progress.save": "Save game progress to the cloud",
  "scores.submit": "Post scores to leaderboards",
  "games.preview": "Play hidden or switched-off games (staff preview)",
  "cheats.staff": "Counts as staff for cheat and secret-character access rules",
  "admin.access": "Open the admin area",
  "users.view": "See the list of users",
  "scores.moderate": "Hide scores and mark runs as cheated",
  "audit.view": "Read the audit log",
  "games.manage": "Add and edit games, switch them on and off",
  "games.manage_settings": "Edit game rules, cheat codes and the secret character",
  "games.manage_content": "Edit game content: characters, config, credits",
  "games.manage_sounds": "Upload replacement sounds for every player",
  "users.manage": "Change users' roles, ban and unban",
  "site.settings": "Change site settings and branding",
  "roles.manage": "Grant or revoke single permissions for a user",
  "analytics.view": "See play statistics: plays, hardest levels, likes, trends",
  "support.manage": "Answer feedback, complaints and help tickets",
  "content.manage": "Publish news, events, deals, ads, credits, history and FAQs",
  "store.manage": "Edit store products and see orders",
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export const ROLES = ["owner", "admin", "moderator", "player", "guest"] as const;
export type RoleKey = (typeof ROLES)[number];

/** Label, description and rank for each role. Higher rank = more power. */
export const ROLE_INFO: Record<RoleKey, { label: string; description: string; rank: number }> = {
  owner: { label: "Owner", description: "Runs the site. Holds every permission.", rank: 100 },
  admin: { label: "Admin", description: "Manages games, content, users and settings.", rank: 80 },
  moderator: { label: "Moderator", description: "Keeps leaderboards and the community fair.", rank: 50 },
  player: { label: "Player", description: "A signed-in player.", rank: 10 },
  guest: { label: "Guest", description: "Not signed in.", rank: 0 },
};

const PLAYER: Permission[] = ["games.play", "progress.save", "scores.submit"];
const MODERATOR: Permission[] = [
  ...PLAYER,
  "admin.access",
  "users.view",
  "scores.moderate",
  "audit.view",
  "games.preview",
  "cheats.staff",
  "analytics.view",
  "support.manage",
];
const ADMIN: Permission[] = [
  ...MODERATOR,
  "games.manage",
  "games.manage_settings",
  "games.manage_content",
  "games.manage_sounds",
  "users.manage",
  "site.settings",
  "content.manage",
  "store.manage",
];

/** The role -> permission map. Edit here to change what a role can do. */
export const ROLE_PERMISSIONS: Record<RoleKey, readonly Permission[]> = {
  owner: ALL_PERMISSIONS,
  admin: ADMIN,
  moderator: MODERATOR,
  player: PLAYER,
  guest: ["games.play"],
};

export function isRole(value: unknown): value is RoleKey {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function isPermission(value: unknown): value is Permission {
  return typeof value === "string" && value in PERMISSIONS;
}

/** A personal grant or revoke (shape of a user_permission_override row). */
export interface Override {
  permission: string;
  effect: "grant" | "revoke";
  expiresAt?: Date | null;
}

/** Work out a user's permissions from their role and personal overrides. */
export function effectivePermissions(role: string, overrides: Override[] = [], now = new Date()): Set<Permission> {
  const roleKey: RoleKey = isRole(role) ? role : "player"; // unknown role: safest signed-in default
  if (roleKey === "owner") return new Set(ALL_PERMISSIONS);
  const perms = new Set<Permission>(ROLE_PERMISSIONS[roleKey]);
  const live = overrides.filter((o) => isPermission(o.permission) && (!o.expiresAt || o.expiresAt > now));
  for (const o of live) if (o.effect === "grant") perms.add(o.permission as Permission);
  // Revokes are applied last, so a revoke always beats a grant.
  for (const o of live) if (o.effect === "revoke") perms.delete(o.permission as Permission);
  return perms;
}

/** May `actorRole` change the role of (or ban) someone with `targetRole`? Only someone ranked higher. */
export function canManageRole(actorRole: string, targetRole: string): boolean {
  if (!isRole(actorRole) || !isRole(targetRole)) return false;
  if (actorRole === "owner") return true;
  return ROLE_INFO[actorRole].rank > ROLE_INFO[targetRole].rank;
}

/** Which roles may `actorRole` hand out? Never one at or above their own (owner can give any). */
export function assignableRoles(actorRole: string): RoleKey[] {
  if (!isRole(actorRole)) return [];
  return ROLES.filter((r) => r !== "guest" && (actorRole === "owner" || ROLE_INFO[r].rank < ROLE_INFO[actorRole].rank));
}
