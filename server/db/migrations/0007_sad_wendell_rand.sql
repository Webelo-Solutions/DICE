CREATE TABLE `departments` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`campaign_id` text,
	`name` text NOT NULL,
	`lead_participant_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `departments_room_idx` ON `departments` (`room_id`);--> statement-breakpoint
ALTER TABLE `participants` ADD `game_role` text;--> statement-breakpoint
ALTER TABLE `participants` ADD `department_id` text;--> statement-breakpoint
ALTER TABLE `participants` ADD `uses_template` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `rooms` ADD `mode` text DEFAULT 'standard' NOT NULL;