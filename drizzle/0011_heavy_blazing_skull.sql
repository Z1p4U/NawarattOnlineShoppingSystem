CREATE TABLE `notification_reads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`notification_id` integer NOT NULL,
	`user_email` text NOT NULL,
	`read_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_reads_user_unique` ON `notification_reads` (`notification_id`,`user_email`);--> statement-breakpoint
CREATE INDEX `notification_reads_user_idx` ON `notification_reads` (`user_email`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recipient_role` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`target_tab` text DEFAULT 'dashboard' NOT NULL,
	`source_id` integer DEFAULT 0 NOT NULL,
	`actor` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notifications_role_created_idx` ON `notifications` (`recipient_role`,`created_at`);