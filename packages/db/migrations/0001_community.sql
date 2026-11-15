CREATE TABLE `ad` (
	`id` text PRIMARY KEY NOT NULL,
	`placement` text NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`image_url` text DEFAULT '' NOT NULL,
	`link_url` text DEFAULT '' NOT NULL,
	`cta_label` text DEFAULT 'Learn more' NOT NULL,
	`source` text DEFAULT 'house' NOT NULL,
	`weight` integer DEFAULT 1 NOT NULL,
	`starts_at` integer,
	`ends_at` integer,
	`active` integer DEFAULT true NOT NULL,
	`impressions` integer DEFAULT 0 NOT NULL,
	`clicks` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ad_placement_idx` ON `ad` (`placement`,`active`);--> statement-breakpoint
CREATE TABLE `character` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`game_slug` text DEFAULT 'samaru-days' NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT 'recurring' NOT NULL,
	`role` text DEFAULT '' NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`voice` text DEFAULT '' NOT NULL,
	`catchphrases` text NOT NULL,
	`power` text DEFAULT '' NOT NULL,
	`unlock` text DEFAULT '' NOT NULL,
	`playable` integer DEFAULT false NOT NULL,
	`locked_by_default` integer DEFAULT false NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`approved` integer DEFAULT false NOT NULL,
	`portrait_url` text DEFAULT '' NOT NULL,
	`line_count` integer DEFAULT 0 NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `character_key_unique` ON `character` (`key`);--> statement-breakpoint
CREATE INDEX `character_kind_idx` ON `character` (`kind`,`sort`);--> statement-breakpoint
CREATE TABLE `deal` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`kind` text DEFAULT 'discount' NOT NULL,
	`percent_off` integer DEFAULT 0 NOT NULL,
	`code` text DEFAULT '' NOT NULL,
	`game_slug` text,
	`product_sku` text,
	`cta_label` text DEFAULT 'Get it' NOT NULL,
	`cta_url` text DEFAULT '' NOT NULL,
	`image_url` text DEFAULT '' NOT NULL,
	`starts_at` integer,
	`ends_at` integer,
	`active` integer DEFAULT true NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `event` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`kind` text DEFAULT 'community' NOT NULL,
	`title` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`cover_url` text DEFAULT '' NOT NULL,
	`location` text DEFAULT 'Online' NOT NULL,
	`game_slug` text,
	`starts_at` integer NOT NULL,
	`ends_at` integer,
	`prize` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_slug_unique` ON `event` (`slug`);--> statement-breakpoint
CREATE INDEX `event_starts_idx` ON `event` (`starts_at`);--> statement-breakpoint
CREATE TABLE `faq` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text DEFAULT 'General' NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`published` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `game_like` (
	`id` text PRIMARY KEY NOT NULL,
	`game_slug` text NOT NULL,
	`level` text DEFAULT '' NOT NULL,
	`voter` text NOT NULL,
	`demo` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_like_uq` ON `game_like` (`game_slug`,`level`,`voter`);--> statement-breakpoint
CREATE TABLE `history` (
	`id` text PRIMARY KEY NOT NULL,
	`date_label` text NOT NULL,
	`date` integer NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`image_url` text DEFAULT '' NOT NULL,
	`visible` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `order` (
	`id` text PRIMARY KEY NOT NULL,
	`ref` text NOT NULL,
	`user_id` text,
	`email` text DEFAULT '' NOT NULL,
	`product_sku` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`amount_kobo` integer NOT NULL,
	`currency` text DEFAULT 'NGN' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`provider` text DEFAULT 'manual' NOT NULL,
	`provider_ref` text DEFAULT '' NOT NULL,
	`deal_code` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `order_ref_unique` ON `order` (`ref`);--> statement-breakpoint
CREATE INDEX `order_status_idx` ON `order` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `person` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`group` text DEFAULT 'contributor' NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`photo_url` text DEFAULT '' NOT NULL,
	`links` text NOT NULL,
	`tier` text DEFAULT '' NOT NULL,
	`since` text DEFAULT '' NOT NULL,
	`consent` integer DEFAULT false NOT NULL,
	`visible` integer DEFAULT true NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `person_group_idx` ON `person` (`group`,`sort`);--> statement-breakpoint
CREATE TABLE `play_event` (
	`id` text PRIMARY KEY NOT NULL,
	`game_slug` text NOT NULL,
	`kind` text NOT NULL,
	`level` text DEFAULT '' NOT NULL,
	`session_id` text NOT NULL,
	`user_id` text,
	`guest_id` text,
	`duration_ms` integer,
	`score` integer,
	`device` text DEFAULT '' NOT NULL,
	`demo` integer DEFAULT false NOT NULL,
	`meta` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `play_game_created_idx` ON `play_event` (`game_slug`,`created_at`);--> statement-breakpoint
CREATE INDEX `play_game_level_idx` ON `play_event` (`game_slug`,`level`,`kind`);--> statement-breakpoint
CREATE INDEX `play_session_idx` ON `play_event` (`session_id`);--> statement-breakpoint
CREATE TABLE `post` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`kind` text DEFAULT 'news' NOT NULL,
	`title` text NOT NULL,
	`excerpt` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`cover_url` text DEFAULT '' NOT NULL,
	`game_slug` text,
	`tags` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`pinned` integer DEFAULT false NOT NULL,
	`published_at` integer,
	`author_id` text,
	`views` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `post_slug_unique` ON `post` (`slug`);--> statement-breakpoint
CREATE INDEX `post_status_pub_idx` ON `post` (`status`,`published_at`);--> statement-breakpoint
CREATE TABLE `product` (
	`id` text PRIMARY KEY NOT NULL,
	`sku` text NOT NULL,
	`kind` text DEFAULT 'boost' NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`price_kobo` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'NGN' NOT NULL,
	`game_slug` text,
	`image_url` text DEFAULT '' NOT NULL,
	`duration_min` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_sku_unique` ON `product` (`sku`);--> statement-breakpoint
CREATE TABLE `ticket` (
	`id` text PRIMARY KEY NOT NULL,
	`ref` text NOT NULL,
	`kind` text DEFAULT 'help' NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`user_id` text,
	`name` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`game_slug` text,
	`page_url` text DEFAULT '' NOT NULL,
	`user_agent` text DEFAULT '' NOT NULL,
	`rating` integer,
	`assignee_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`assignee_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ticket_ref_unique` ON `ticket` (`ref`);--> statement-breakpoint
CREATE INDEX `ticket_status_idx` ON `ticket` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `ticket_message` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_id` text NOT NULL,
	`author_id` text,
	`from_staff` integer DEFAULT false NOT NULL,
	`internal` integer DEFAULT false NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`ticket_id`) REFERENCES `ticket`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `ticket_msg_ticket_idx` ON `ticket_message` (`ticket_id`);