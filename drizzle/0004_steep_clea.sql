CREATE TABLE `user_preferences` (
	`user` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`palette` text DEFAULT 'neon' NOT NULL,
	`mode` text DEFAULT 'light' NOT NULL,
	`motion` text DEFAULT 'smooth' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `user_preferences_email` ON `user_preferences` (`email`);