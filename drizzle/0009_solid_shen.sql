CREATE TABLE `plan_templates` (
	`email` text NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`data` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`email`, `id`)
);
--> statement-breakpoint
CREATE TABLE `trip_private_preferences` (
	`trip` text NOT NULL,
	`email` text NOT NULL,
	`person` text NOT NULL,
	`data` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`trip`, `email`),
	FOREIGN KEY (`trip`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade
);
