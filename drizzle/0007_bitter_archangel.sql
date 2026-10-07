CREATE TABLE `account_links` (
	`email` text PRIMARY KEY NOT NULL,
	`identity_key` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_links_identity_key_unique` ON `account_links` (`identity_key`);--> statement-breakpoint
CREATE TABLE `member_invitations` (
	`token` text PRIMARY KEY NOT NULL,
	`trip` text NOT NULL,
	`person` text NOT NULL,
	`email` text NOT NULL,
	`expires_at` integer NOT NULL,
	`accepted_email` text
);
--> statement-breakpoint
CREATE INDEX `member_invitations_trip` ON `member_invitations` (`trip`);--> statement-breakpoint
CREATE TABLE `payout_cards` (
	`trip` text NOT NULL,
	`person` text NOT NULL,
	`email` text NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`trip`, `person`)
);
--> statement-breakpoint
CREATE TABLE `personal_workspace` (
	`email` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `trip_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`trip` text NOT NULL,
	`caption` text NOT NULL,
	`mime` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `trip_photos_trip` ON `trip_photos` (`trip`);