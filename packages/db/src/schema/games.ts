/**
 * Game tables. Translated from EE Hub's games/models.py and games/catalogue.py:
 *
 *   Django                         here
 *   ------------------------------ ---------------------------------------------
 *   catalogue.GAMES (a Python list) game                (now a table, so the admin can edit it)
 *   GameSettings (slug "*" = all)  game_setting        (same idea: game_slug "*" = site-wide)
 *   GameSettings.data["cheats"]    cheat               (own table; codes hashed with a salt)
 *   GameSettings.data["hero_hash"] hero                (own table; password hash)
 *   FSLGContent / ...Version       game_content / game_content_version
 *   ArcadeProfile                  player_profile
 *   GuestPlayer                    guest_player
 *   ArcadeScore                    score
 *   (saves were in the browser)    progress            (cloud copy of save slots)
 *   OfflineSubmission              offline_submission
 *   GlobalSound                    game_sound
 *
 * Games are referenced by their slug (text), as in Django, so content and
 * settings can exist before the game row (and survive re-creating it).
 */
import { sql } from "drizzle-orm";
import { check, index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { user } from "./auth.ts";
import { bool, id, json, timestamp, timestamps } from "./helpers.ts";

/** Where a game shows up. "hidden" = admins only; "demo" = playable demo; "live" = everyone. */
export const GAME_STATUSES = ["hidden", "demo", "live"] as const;
export type GameStatus = (typeof GAME_STATUSES)[number];

/** Free-form extra card info that does not need its own column (from catalogue.Game). */
export interface GameMeta {
  genre?: string;
  howToPlay?: string; // catalogue "loop"
  modes?: string[];
  tags?: string[];
  controls?: string;
  sessionLength?: string; // catalogue "session"
  topics?: string[];
  courses?: string[];
  dependencies?: string[]; // catalogue extra.deps
  [key: string]: unknown;
}

export const game = sqliteTable(
  "game",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    /** Shelf on the games page, e.g. "arcade", "open-world", "puzzle". */
    category: text("category").notNull().default("arcade"),
    status: text("status", { enum: GAME_STATUSES }).notNull().default("hidden"),
    /** Kill switch. A disabled game cannot be played (admins can still preview it). */
    enabled: bool("enabled").notNull().default(true),
    /** Sort order on the games page (lower first). */
    sort: integer("sort").notNull().default(0),
    /** Minimum level from the old site (100..500). Kept for the Classic games; 0 = open to all. */
    level: integer("level").notNull().default(0),
    /** Card accent colour, e.g. "#3dd68c". */
    accent: text("accent").notNull().default("#1a6b45"),
    /** Folder (or R2 prefix) where the game's built files live, e.g. "/games/momentum-cup/". */
    assetsPath: text("assets_path").notNull().default(""),
    /** Name of the game's entry module in the game loader registry (see docs/ARCHITECTURE.md). */
    entry: text("entry").notNull().default(""),
    /** Default settings for the game (the "defaults file"); overrides live in game_setting. */
    settings: json<Record<string, unknown>>("settings")
      .notNull()
      .$defaultFn(() => ({})),
    meta: json<GameMeta>("meta")
      .notNull()
      .$defaultFn(() => ({})),
    ...timestamps(),
  },
  (t) => [index("game_status_sort_idx").on(t.status, t.sort)],
);

/**
 * The owner's overrides for one game (rules, switches, access modes), or
 * site-wide values in the row with game_slug "*". Same as Django GameSettings.
 */
export const gameSetting = sqliteTable("game_setting", {
  id: id(),
  gameSlug: text("game_slug").notNull().unique(),
  data: json<Record<string, unknown>>("data")
    .notNull()
    .$defaultFn(() => ({})),
  updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
  ...timestamps(),
});

/** Who may use cheats or the secret character (Django CHEAT_ACCESS / HERO_ACCESS). */
export const ACCESS_MODES = ["everyone", "signed", "staff", "named"] as const;
export type AccessMode = (typeof ACCESS_MODES)[number];

/**
 * A cheat code. The plain code is NEVER stored: only a salted SHA-256 hash
 * (see packages/db/src/crypto.ts). Codes are compared after normalising
 * (lower-case, no spaces), like Django's cheats.norm().
 */
export const cheat = sqliteTable(
  "cheat",
  {
    id: id(),
    gameSlug: text("game_slug").notNull(),
    /** The cheat's id inside the game, e.g. "infinite_money". */
    key: text("key").notNull(),
    label: text("label").notNull(),
    /** How players enter it (Django: typed on keyboard, dialled on the in-game phone). */
    channel: text("channel", { enum: ["typed", "dial", "any"] })
      .notNull()
      .default("any"),
    codeHash: text("code_hash").notNull(),
    codeSalt: text("code_salt").notNull(),
    /** Player-facing hint ("Type it during play..."). */
    how: text("how").notNull().default(""),
    enabled: bool("enabled").notNull().default(true),
    /** Null = use the game's (or site-wide) access mode. */
    access: text("access", { enum: ACCESS_MODES }),
    /** What the cheat does, read by the game (free-form JSON). */
    effect: json<Record<string, unknown>>("effect")
      .notNull()
      .$defaultFn(() => ({})),
    ...timestamps(),
  },
  (t) => [uniqueIndex("cheat_game_key_channel_uq").on(t.gameSlug, t.key, t.channel)],
);

/**
 * The secret character ("hero"). Django kept one hero password hash per
 * game, or a site-wide one. Here each hero is a row; game_slug "*" = all games.
 * The code is stored as a password hash (scrypt, via Better Auth's hasher).
 */
export const hero = sqliteTable(
  "hero",
  {
    id: id(),
    gameSlug: text("game_slug").notNull().default("*"),
    /** Short name shown in game, e.g. "M.I. BUGAJE". */
    name: text("name").notNull(),
    fullName: text("full_name").notNull().default(""),
    passwordHash: text("password_hash").notNull(),
    access: text("access", { enum: ["code", "signed", "staff", "named"] })
      .notNull()
      .default("code"),
    /** For access "named": the user ids allowed. */
    allowedUserIds: json<string[]>("allowed_user_ids")
      .notNull()
      .$defaultFn(() => []),
    enabled: bool("enabled").notNull().default(true),
    /** Reveal move, powers and shortcuts, as described to the player. */
    details: json<Record<string, string>>("details")
      .notNull()
      .$defaultFn(() => ({})),
    ...timestamps(),
  },
  (t) => [index("hero_game_idx").on(t.gameSlug)],
);

/** Versioned content overrides per game (characters, config, credits...). */
export const gameContent = sqliteTable(
  "game_content",
  {
    id: id(),
    gameSlug: text("game_slug").notNull(),
    /** e.g. "config", "credits", "character" */
    kind: text("kind").notNull(),
    /** e.g. the character id; "" for single-row kinds */
    key: text("key").notNull().default(""),
    data: json<Record<string, unknown>>("data")
      .notNull()
      .$defaultFn(() => ({})),
    version: integer("version").notNull().default(1),
    updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (t) => [uniqueIndex("game_content_uq").on(t.gameSlug, t.kind, t.key)],
);

/** Every saved state of a game_content row (history and rollback). */
export const gameContentVersion = sqliteTable(
  "game_content_version",
  {
    id: id(),
    gameSlug: text("game_slug").notNull(),
    kind: text("kind").notNull(),
    key: text("key").notNull().default(""),
    version: integer("version").notNull(),
    data: json<Record<string, unknown>>("data")
      .notNull()
      .$defaultFn(() => ({})),
    note: text("note").notNull().default(""),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("game_content_version_idx").on(t.gameSlug, t.kind, t.key)],
);

/**
 * A visitor who plays without an account. Stores only a display name and a
 * hashed PIN, and is deleted after expires_at. (Django also kept a
 * registration number; we do not.)
 */
export const guestPlayer = sqliteTable(
  "guest_player",
  {
    id: id(),
    name: text("name").notNull(),
    /** Lower-cased, single-spaced name, used with the PIN to find the guest again. */
    nameKey: text("name_key").notNull(),
    pinHash: text("pin_hash").notNull(),
    lastSeenAt: timestamp("last_seen_at")
      .notNull()
      .$defaultFn(() => new Date()),
    expiresAt: timestamp("expires_at").notNull(),
    ...timestamps(),
  },
  (t) => [index("guest_player_name_idx").on(t.nameKey)],
);

/** One per player (account or guest). Coins and XP change only through the scores/progress repos. */
export const playerProfile = sqliteTable(
  "player_profile",
  {
    id: id(),
    userId: text("user_id")
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    guestId: text("guest_id")
      .unique()
      .references(() => guestPlayer.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull().default(""),
    xp: integer("xp").notNull().default(0),
    coins: integer("coins").notNull().default(0),
    owned: json<string[]>("owned")
      .notNull()
      .$defaultFn(() => []),
    equipped: json<Record<string, string>>("equipped")
      .notNull()
      .$defaultFn(() => ({})),
    badges: json<string[]>("badges")
      .notNull()
      .$defaultFn(() => []),
    stats: json<Record<string, unknown>>("stats")
      .notNull()
      .$defaultFn(() => ({})),
    /** Show first name + initial on leaderboards. */
    onLeaderboard: bool("on_leaderboard").notNull().default(true),
    ...timestamps(),
  },
  // A profile belongs to exactly one of: an account, or a guest.
  (t) => [check("player_profile_one_owner", sql`(${t.userId} is null) <> (${t.guestId} is null)`)],
);

export const score = sqliteTable(
  "score",
  {
    id: id(),
    profileId: text("profile_id")
      .notNull()
      .references(() => playerProfile.id, { onDelete: "cascade" }),
    gameSlug: text("game_slug").notNull(),
    score: integer("score").notNull(),
    /** Set when the run used a cheat code or the secret character. */
    cheated: bool("cheated").notNull().default(false),
    /** Optional details (level, time, mode). */
    details: json<Record<string, unknown>>("details")
      .notNull()
      .$defaultFn(() => ({})),
    createdAt: timestamp("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    // SQLite reads this index backwards for "highest first", so no DESC needed.
    index("score_game_score_idx").on(t.gameSlug, t.score),
    index("score_profile_idx").on(t.profileId),
  ],
);

/**
 * Cloud copy of a save slot. Saves live in the browser first (offline-first,
 * V2 §21.2) and sync here when the player has an account.
 * slot: "auto" or "1".."5" (the old game's 5 manual + 1 auto design).
 */
export const progress = sqliteTable(
  "progress",
  {
    id: id(),
    profileId: text("profile_id")
      .notNull()
      .references(() => playerProfile.id, { onDelete: "cascade" }),
    gameSlug: text("game_slug").notNull(),
    slot: text("slot").notNull().default("auto"),
    /** Save format version, so old saves can be migrated, never discarded. */
    saveVersion: integer("save_version").notNull().default(1),
    data: json<Record<string, unknown>>("data")
      .notNull()
      .$defaultFn(() => ({})),
    /** Short label for the slot list, e.g. "Year 1, Week 3". */
    summary: text("summary").notNull().default(""),
    ...timestamps(),
  },
  (t) => [uniqueIndex("progress_slot_uq").on(t.profileId, t.gameSlug, t.slot)],
);

/** A result played offline and synced later. `cid` is made on the device, so a retry is counted once. */
export const offlineSubmission = sqliteTable("offline_submission", {
  id: id(),
  cid: text("cid").notNull().unique(),
  profileId: text("profile_id")
    .notNull()
    .references(() => playerProfile.id, { onDelete: "cascade" }),
  gameSlug: text("game_slug").notNull().default(""),
  playedAt: timestamp("played_at"),
  ok: bool("ok").notNull().default(true),
  note: text("note").notNull().default(""),
  createdAt: timestamp("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
});

/** A replacement sound for every player of one game (Django GlobalSound). The file lives in storage (R2), not the DB. */
export const gameSound = sqliteTable(
  "game_sound",
  {
    id: id(),
    gameSlug: text("game_slug").notNull(),
    name: text("name").notNull(),
    /** Storage key of the uploaded file. */
    fileKey: text("file_key").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull().default(0),
    duration: real("duration").notNull().default(0),
    originalName: text("original_name").notNull().default(""),
    version: integer("version").notNull().default(1),
    uploadedBy: text("uploaded_by").references(() => user.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (t) => [uniqueIndex("game_sound_uq").on(t.gameSlug, t.name)],
);
