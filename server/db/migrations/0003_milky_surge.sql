CREATE TABLE `content_packs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`version` text NOT NULL,
	`author` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`scenario_count` integer DEFAULT 0 NOT NULL,
	`character_count` integer DEFAULT 0 NOT NULL,
	`installed_at` integer NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `characters` ADD `pack_id` text;--> statement-breakpoint
ALTER TABLE `custom_scenarios` ADD `pack_id` text;