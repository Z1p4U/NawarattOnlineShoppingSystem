CREATE TABLE `balance_adjustments` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_key` text NOT NULL,
	`amount` integer NOT NULL,
	`adjustment_date` text NOT NULL,
	`reason` text NOT NULL,
	`before_balance` integer NOT NULL,
	`after_balance` integer NOT NULL,
	`reversal_of` text,
	`entered_by` text NOT NULL,
	`actor_email` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `balance_adjustments_customer_idx` ON `balance_adjustments` (`customer_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `balance_adjustments_reversal_unique` ON `balance_adjustments` (`reversal_of`);