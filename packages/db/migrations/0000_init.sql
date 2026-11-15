CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_user_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`role` text DEFAULT 'player' NOT NULL,
	`banned` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`target_type` text DEFAULT '' NOT NULL,
	`target_id` text DEFAULT '' NOT NULL,
	`before` text,
	`after` text,
	`note` text DEFAULT '' NOT NULL,
	`ip` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_target_idx` ON `audit_log` (`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `role` (
	`key` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`rank` integer DEFAULT 0 NOT NULL,
	`built_in` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `site_setting` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_by` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `user_permission_override` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`permission` text NOT NULL,
	`effect` text NOT NULL,
	`expires_at` integer,
	`reason` text DEFAULT '' NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `perm_override_user_idx` ON `user_permission_override` (`user_id`);--> statement-breakpoint
CREATE TABLE `cheat` (
	`id` text PRIMARY KEY NOT NULL,
	`game_slug` text NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`channel` text DEFAULT 'any' NOT NULL,
	`code_hash` text NOT NULL,
	`code_salt` text NOT NULL,
	`how` text DEFAULT '' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`access` text,
	`effect` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cheat_game_key_channel_uq` ON `cheat` (`game_slug`,`key`,`channel`);--> statement-breakpoint
CREATE TABLE `game` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`category` text DEFAULT 'arcade' NOT NULL,
	`status` text DEFAULT 'hidden' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`level` integer DEFAULT 0 NOT NULL,
	`accent` text DEFAULT '#1a6b45' NOT NULL,
	`assets_path` text DEFAULT '' NOT NULL,
	`entry` text DEFAULT '' NOT NULL,
	`settings` text NOT NULL,
	`meta` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_slug_unique` ON `game` (`slug`);--> statement-breakpoint
CREATE INDEX `game_status_sort_idx` ON `game` (`status`,`sort`);--> statement-breakpoint
CREATE TABLE `game_content` (
	`id` text PRIMARY KEY NOT NULL,
	`game_slug` text NOT NULL,
	`kind` text NOT NULL,
	`key` text DEFAULT '' NOT NULL,
	`data` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_content_uq` ON `game_content` (`game_slug`,`kind`,`key`);--> statement-breakpoint
CREATE TABLE `game_content_version` (
	`id` text PRIMARY KEY NOT NULL,
	`game_slug` text NOT NULL,
	`kind` text NOT NULL,
	`key` text DEFAULT '' NOT NULL,
	`version` integer NOT NULL,
	`data` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `game_content_version_idx` ON `game_content_version` (`game_slug`,`kind`,`key`);--> statement-breakpoint
CREATE TABLE `game_setting` (
	`id` text PRIMARY KEY NOT NULL,
	`game_slug` text NOT NULL,
	`data` text NOT NULL,
	`updated_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_setting_game_slug_unique` ON `game_setting` (`game_slug`);--> statement-breakpoint
CREATE TABLE `game_sound` (
	`id` text PRIMARY KEY NOT NULL,
	`game_slug` text NOT NULL,
	`name` text NOT NULL,
	`file_key` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer DEFAULT 0 NOT NULL,
	`duration` real DEFAULT 0 NOT NULL,
	`original_name` text DEFAULT '' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`uploaded_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`uploaded_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_sound_uq` ON `game_sound` (`game_slug`,`name`);--> statement-breakpoint
CREATE TABLE `guest_player` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`pin_hash` text NOT NULL,
	`last_seen_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `guest_player_name_idx` ON `guest_player` (`name_key`);--> statement-breakpoint
CREATE TABLE `hero` (
	`id` text PRIMARY KEY NOT NULL,
	`game_slug` text DEFAULT '*' NOT NULL,
	`name` text NOT NULL,
	`full_name` text DEFAULT '' NOT NULL,
	`password_hash` text NOT NULL,
	`access` text DEFAULT 'code' NOT NULL,
	`allowed_user_ids` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`details` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `hero_game_idx` ON `hero` (`game_slug`);--> statement-breakpoint
CREATE TABLE `offline_submission` (
	`id` text PRIMARY KEY NOT NULL,
	`cid` text NOT NULL,
	`profile_id` text NOT NULL,
	`game_slug` text DEFAULT '' NOT NULL,
	`played_at` integer,
	`ok` integer DEFAULT true NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `player_profile`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `offline_submission_cid_unique` ON `offline_submission` (`cid`);--> statement-breakpoint
CREATE TABLE `player_profile` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`guest_id` text,
	`display_name` text DEFAULT '' NOT NULL,
	`xp` integer DEFAULT 0 NOT NULL,
	`coins` integer DEFAULT 0 NOT NULL,
	`owned` text NOT NULL,
	`equipped` text NOT NULL,
	`badges` text NOT NULL,
	`stats` text NOT NULL,
	`on_leaderboard` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`guest_id`) REFERENCES `guest_player`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "player_profile_one_owner" CHECK(("player_profile"."user_id" is null) <> ("player_profile"."guest_id" is null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_profile_user_id_unique` ON `player_profile` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `player_profile_guest_id_unique` ON `player_profile` (`guest_id`);--> statement-breakpoint
CREATE TABLE `progress` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`game_slug` text NOT NULL,
	`slot` text DEFAULT 'auto' NOT NULL,
	`save_version` integer DEFAULT 1 NOT NULL,
	`data` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `player_profile`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `progress_slot_uq` ON `progress` (`profile_id`,`game_slug`,`slot`);--> statement-breakpoint
CREATE TABLE `score` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`game_slug` text NOT NULL,
	`score` integer NOT NULL,
	`cheated` integer DEFAULT false NOT NULL,
	`details` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `player_profile`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `score_game_score_idx` ON `score` (`game_slug`,`score`);--> statement-breakpoint
CREATE INDEX `score_profile_idx` ON `score` (`profile_id`);