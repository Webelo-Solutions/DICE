CREATE TABLE `participant_events` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`session_id` text,
	`participant_id` text NOT NULL,
	`kind` text NOT NULL,
	`round` integer,
	`at` integer NOT NULL,
	`payload` text
);
--> statement-breakpoint
CREATE INDEX `participant_events_room_idx` ON `participant_events` (`room_id`);--> statement-breakpoint
CREATE INDEX `participant_events_session_idx` ON `participant_events` (`session_id`);