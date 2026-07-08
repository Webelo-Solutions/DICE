CREATE TABLE `auth_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`user_agent` text
);
--> statement-breakpoint
CREATE INDEX `auth_sessions_user_idx` ON `auth_sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'player' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`last_login_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_idx` ON `users` (`username`);--> statement-breakpoint
ALTER TABLE `campaigns` ADD `owner_user_id` text;--> statement-breakpoint
ALTER TABLE `characters` ADD `owner_user_id` text;--> statement-breakpoint
ALTER TABLE `custom_scenarios` ADD `owner_user_id` text;--> statement-breakpoint
ALTER TABLE `saves` ADD `owner_user_id` text;--> statement-breakpoint
ALTER TABLE `session_history` ADD `owner_user_id` text;