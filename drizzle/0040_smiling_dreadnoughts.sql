CREATE TABLE `purchase_cutover_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`previous_start_date` text NOT NULL,
	`official_start_date` text NOT NULL,
	`product_group_count` integer NOT NULL,
	`source_request_count` integer NOT NULL,
	`status_counts` text NOT NULL,
	`backup_key` text NOT NULL,
	`backup_size` integer DEFAULT 0 NOT NULL,
	`executed_by_email` text NOT NULL,
	`executed_by_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_cutover_runs_date_unique` ON `purchase_cutover_runs` (`official_start_date`);--> statement-breakpoint
CREATE INDEX `purchase_cutover_runs_created_idx` ON `purchase_cutover_runs` (`created_at`);--> statement-breakpoint
CREATE TABLE `purchase_operational_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`trial_start_date` text DEFAULT '2026-10-26' NOT NULL,
	`official_start_date` text DEFAULT '2026-10-26' NOT NULL,
	`updated_by` text DEFAULT 'System' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
