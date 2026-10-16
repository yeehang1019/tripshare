CREATE TABLE `trip_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`trip` text NOT NULL,
	`activity` text DEFAULT '' NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `trip_documents_trip` ON `trip_documents` (`trip`);