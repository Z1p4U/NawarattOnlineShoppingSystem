CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`action` text NOT NULL,
	`entity_type` text DEFAULT 'system' NOT NULL,
	`entity_id` text DEFAULT '' NOT NULL,
	`summary` text NOT NULL,
	`actor_email` text DEFAULT '' NOT NULL,
	`actor_name` text DEFAULT '' NOT NULL,
	`actor_role` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_logs_created_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
ALTER TABLE `app_users` ADD `password_hash` text DEFAULT '' NOT NULL;