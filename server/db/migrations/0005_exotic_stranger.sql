CREATE TABLE `injects_catalog` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `custom_scenarios` ADD `is_global` integer DEFAULT false NOT NULL;