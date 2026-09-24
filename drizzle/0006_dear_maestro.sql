CREATE TABLE `sync_changes` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`trip` text NOT NULL,
	`kind` text NOT NULL,
	`record_id` text NOT NULL,
	`members` text NOT NULL,
	`changed_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sync_changes_trip_seq` ON `sync_changes` (`trip`,`seq`);--> statement-breakpoint
CREATE TABLE `sync_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL
);
