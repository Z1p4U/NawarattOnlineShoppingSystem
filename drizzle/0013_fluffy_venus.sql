CREATE TABLE `payment_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer DEFAULT 0 NOT NULL,
	`customer_name` text NOT NULL,
	`township` text DEFAULT '' NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`method` text NOT NULL,
	`payment_date` text NOT NULL,
	`entered_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `payment_transactions_date_idx` ON `payment_transactions` (`payment_date`);--> statement-breakpoint
CREATE INDEX `payment_transactions_customer_idx` ON `payment_transactions` (`customer_name`,`payment_date`);