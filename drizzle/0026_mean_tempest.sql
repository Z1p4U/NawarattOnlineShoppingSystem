CREATE TABLE `operational_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`trial_start_date` text DEFAULT '2026-10-18' NOT NULL,
	`official_start_date` text DEFAULT '2026-10-26' NOT NULL,
	`updated_by` text DEFAULT 'System' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `trial_opening_balances` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`original_id` integer NOT NULL,
	`as_of_date` text NOT NULL,
	`customer_name` text NOT NULL,
	`township` text DEFAULT '' NOT NULL,
	`customer_key` text NOT NULL,
	`opening_packages` integer DEFAULT 0 NOT NULL,
	`delivered_packages` integer DEFAULT 0 NOT NULL,
	`opening_outstanding` integer DEFAULT 0 NOT NULL,
	`paid_amount` integer DEFAULT 0 NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`entered_by` text DEFAULT '' NOT NULL,
	`original_created_at` text DEFAULT '' NOT NULL,
	`original_updated_at` text DEFAULT '' NOT NULL,
	`archived_by` text DEFAULT 'System' NOT NULL,
	`archived_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trial_opening_balances_original_unique` ON `trial_opening_balances` (`original_id`);--> statement-breakpoint
CREATE INDEX `trial_opening_balances_customer_idx` ON `trial_opening_balances` (`customer_key`,`as_of_date`);