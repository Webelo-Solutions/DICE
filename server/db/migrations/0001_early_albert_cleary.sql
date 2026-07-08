CREATE TABLE `participants` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`role` text NOT NULL,
	`display_name` text NOT NULL,
	`character_id` text,
	`token_hash` text NOT NULL,
	`last_seen_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `participants_token_idx` ON `participants` (`token_hash`);--> statement-breakpoint
CREATE INDEX `participants_room_idx` ON `participants` (`room_id`);--> statement-breakpoint
CREATE TABLE `room_sessions` (
	`room_id` text PRIMARY KEY NOT NULL,
	`session` text,
	`feed` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`facilitator_secret_hash` text NOT NULL,
	`status` text DEFAULT 'lobby' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rooms_code_idx` ON `rooms` (`code`);