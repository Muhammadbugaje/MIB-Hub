/**
 * Site-wide tables: roles, per-user permission overrides, the audit log and
 * site settings.
 *
 * How permissions work (mirrors EE Hub's accounts.access resolver):
 *   effective permissions =
 *       the permissions of the user's ROLE   (role -> permission map in
 *                                             apps/web/src/lib/permissions.ts)
 *     + personal grants  (user_permission_override, effect "grant", not expired)
 *     - personal revokes (user_permission_override, effect "revoke")
 *   The owner holds everything.
 *
 * The `role` table is a catalogue (label, description, rank) so the admin
 * panel can list roles; the permission lists themselves live in code, so a
 * code review sees every change to who may do what.
 */
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth.ts";
import { bool, id, json, timestamp, timestamps } from "./helpers.ts";

export const role = sqliteTable("role", {
  /** "owner" | "admin" | "moderator" | "player" | "guest" */
  key: text("key").primaryKey(),
  label: text("label").notNull(),
  description: text("description").notNull().default(""),
  /** Higher rank = more power. Used to stop someone editing a user above them. */
  rank: integer("rank").notNull().default(0),
  /** Built-in roles cannot be deleted from the admin panel. */
  builtIn: bool("built_in").notNull().default(true),
  ...timestamps(),
});

export const userPermissionOverride = sqliteTable(
  "user_permission_override",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** A permission name such as "games.manage_settings". */
    permission: text("permission").notNull(),
    effect: text("effect", { enum: ["grant", "revoke"] }).notNull(),
    /** Null = never expires. */
    expiresAt: timestamp("expires_at"),
    reason: text("reason").notNull().default(""),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (t) => [index("perm_override_user_idx").on(t.userId)],
);

/**
 * Who changed what. Every admin write adds one row. Secrets (cheat codes,
 * hero passwords) are never written here, only "(changed)".
 */
export const auditLog = sqliteTable(
  "audit_log",
  {
    id: id(),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    /** Short verb, e.g. "game.update", "cheat.create", "user.role". */
    action: text("action").notNull(),
    targetType: text("target_type").notNull().default(""),
    targetId: text("target_id").notNull().default(""),
    before: json<unknown>("before"),
    after: json<unknown>("after"),
    note: text("note").notNull().default(""),
    ip: text("ip"),
    createdAt: timestamp("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("audit_target_idx").on(t.targetType, t.targetId), index("audit_created_idx").on(t.createdAt)],
);

/** Key/value settings for the whole site (branding, flags, kill switches). */
export const siteSetting = sqliteTable("site_setting", {
  key: text("key").primaryKey(),
  value: json<unknown>("value").notNull(),
  updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at")
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
});
