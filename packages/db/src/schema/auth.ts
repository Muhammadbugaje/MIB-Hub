/**
 * Accounts and sessions: the four tables Better Auth needs (user, session,
 * account, verification), plus our own `role` column on user.
 *
 * Better Auth reads and writes these through its Drizzle adapter
 * (apps/web/src/lib/auth.ts). The table and column names follow Better
 * Auth's defaults, so do not rename them without updating the adapter's
 * field mapping.
 *
 * Passwords are NOT in `user`: Better Auth keeps the password hash (scrypt)
 * in `account.password` for the "credential" provider.
 */
import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { bool, timestamp, timestamps } from "./helpers.ts";

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: bool("email_verified").notNull().default(false),
  image: text("image"),
  /** One of the role keys in apps/web/src/lib/permissions.ts (owner, admin, moderator, player). */
  role: text("role").notNull().default("player"),
  /** A banned account cannot sign in (checked in the auth guard). */
  banned: bool("banned").notNull().default(false),
  ...timestamps(),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps(),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    /** Password hash for email + password sign-in: "pbkdf2-sha256$..." (older rows: scrypt, upgraded at sign-in). */
    password: text("password"),
    ...timestamps(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

/** One-time tokens: password reset links, email verification. */
export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    ...timestamps(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);
