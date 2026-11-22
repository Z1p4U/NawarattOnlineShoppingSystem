CREATE TABLE `customer_opening_balances` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`as_of_date` text DEFAULT '2026-10-20' NOT NULL,
	`customer_name` text NOT NULL,
	`township` text DEFAULT '' NOT NULL,
	`customer_key` text NOT NULL,
	`opening_packages` integer DEFAULT 0 NOT NULL,
	`delivered_packages` integer DEFAULT 0 NOT NULL,
	`opening_outstanding` integer DEFAULT 0 NOT NULL,
	`paid_amount` integer DEFAULT 0 NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`entered_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_opening_balances_customer_unique` ON `customer_opening_balances` (`customer_key`);--> statement-breakpoint
CREATE INDEX `customer_opening_balances_date_idx` ON `customer_opening_balances` (`as_of_date`);