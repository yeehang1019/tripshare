CREATE TABLE `app_owner` (
	`id` text PRIMARY KEY NOT NULL,
	`user` text NOT NULL,
	`email` text NOT NULL
);
--> statement-breakpoint
INSERT OR IGNORE INTO `app_owner` (`id`,`user`,`email`)
SELECT 'primary', `owner`, COALESCE(`owner_email`,`owner`)
FROM `trips`
LIMIT 1;
