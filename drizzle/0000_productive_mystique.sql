CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`trip` text NOT NULL,
	`user` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `trips` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`data` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`invite` text NOT NULL
);
