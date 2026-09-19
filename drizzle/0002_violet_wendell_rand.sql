ALTER TABLE `trips` ADD `owner_email` text;--> statement-breakpoint
UPDATE `trips`
SET `owner_email` = lower(json_extract(`data`, '$.audit[0].actor'))
WHERE json_valid(`data`)
  AND json_type(`data`, '$.audit[0].actor') = 'text';--> statement-breakpoint
CREATE INDEX `trips_owner_email` ON `trips` (`owner_email`);
