CREATE TABLE `game_sound_setting` (
	`id` text PRIMARY KEY NOT NULL,
	`game_slug` text NOT NULL,
	`name` text NOT NULL,
	`volume` real DEFAULT 1 NOT NULL,
	`updated_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_sound_setting_uq` ON `game_sound_setting` (`game_slug`,`name`);--> statement-breakpoint
CREATE TABLE `game_sound_version` (
	`id` text PRIMARY KEY NOT NULL,
	`game_slug` text NOT NULL,
	`name` text NOT NULL,
	`version` integer NOT NULL,
	`file_key` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer DEFAULT 0 NOT NULL,
	`duration` real DEFAULT 0 NOT NULL,
	`original_name` text DEFAULT '' NOT NULL,
	`source` text DEFAULT 'upload' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`uploaded_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`uploaded_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_sound_version_uq` ON `game_sound_version` (`game_slug`,`name`,`version`);--> statement-breakpoint
CREATE INDEX `game_sound_version_game_idx` ON `game_sound_version` (`game_slug`);