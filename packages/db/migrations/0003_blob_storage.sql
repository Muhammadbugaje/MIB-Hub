CREATE TABLE `blob` (
	`key` text NOT NULL,
	`part` integer NOT NULL,
	`parts` integer NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`sha256` text NOT NULL,
	`data` blob NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`key`, `part`)
);
