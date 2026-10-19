CREATE TABLE `trip_checkpoints` (
	`id` text PRIMARY KEY NOT NULL,
	`trip` text NOT NULL,
	`revision` integer NOT NULL,
	`data` text NOT NULL,
	`checksum` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`trip`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `trip_checkpoints_trip_revision` ON `trip_checkpoints` (`trip`,`revision`);