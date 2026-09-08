CREATE TABLE `grants` (
	`id` text PRIMARY KEY NOT NULL,
	`trip` text NOT NULL,
	`email` text NOT NULL,
	`permissions` text NOT NULL,
	`person` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `grants_email` ON `grants` (`email`);--> statement-breakpoint
CREATE INDEX `grants_trip` ON `grants` (`trip`);--> statement-breakpoint
CREATE TABLE `shares` (
	`token` text PRIMARY KEY NOT NULL,
	`trip` text NOT NULL,
	`pin` text DEFAULT '' NOT NULL,
	`failures` integer DEFAULT 0 NOT NULL,
	`locked_until` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `shares_trip` ON `shares` (`trip`);