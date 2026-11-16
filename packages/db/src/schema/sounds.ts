/**
 * The admin sound manager (/admin/games/<slug>/sounds), added on top of
 * game_sound (games.ts), which holds the one file every player hears now.
 *
 *   game_sound_version  every file ever uploaded, recorded or edited for a
 *                       sound (its history). game_sound points at one of them
 *                       (same file_key and version number).
 *   game_sound_setting  per-sound settings that do not need a file: the
 *                       volume every player hears (1 = as made).
 *
 * The list of sounds itself (ids, names, where used) is not in the database:
 * it is generated from the game scripts into apps/web/src/games/sounds/.
 */
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { user } from "./auth.ts";
import { id, timestamp, timestamps } from "./helpers.ts";

/** How a version was made in the admin. */
export const SOUND_VERSION_SOURCES = ["upload", "record", "edit"] as const;
export type SoundVersionSource = (typeof SOUND_VERSION_SOURCES)[number];

export const gameSoundVersion = sqliteTable(
  "game_sound_version",
  {
    id: id(),
    gameSlug: text("game_slug").notNull(),
    name: text("name").notNull(),
    version: integer("version").notNull(),
    fileKey: text("file_key").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull().default(0),
    duration: real("duration").notNull().default(0),
    originalName: text("original_name").notNull().default(""),
    source: text("source").$type<SoundVersionSource>().notNull().default("upload"),
    note: text("note").notNull().default(""),
    uploadedBy: text("uploaded_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [uniqueIndex("game_sound_version_uq").on(t.gameSlug, t.name, t.version), index("game_sound_version_game_idx").on(t.gameSlug)],
);

export const gameSoundSetting = sqliteTable(
  "game_sound_setting",
  {
    id: id(),
    gameSlug: text("game_slug").notNull(),
    name: text("name").notNull(),
    /** 0 to 2; 1 plays the sound as it was made. */
    volume: real("volume").notNull().default(1),
    updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (t) => [uniqueIndex("game_sound_setting_uq").on(t.gameSlug, t.name)],
);
