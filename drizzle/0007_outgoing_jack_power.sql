CREATE TABLE `customer_purchase_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`request_date` text NOT NULL,
	`customer_name` text NOT NULL,
	`township` text DEFAULT '' NOT NULL,
	`product_name` text NOT NULL,
	`quantity` integer DEFAULT 0 NOT NULL,
	`unit` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`requested_by` text NOT NULL,
	`requested_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `customer_purchase_requests_date_idx` ON `customer_purchase_requests` (`request_date`);--> statement-breakpoint
CREATE INDEX `customer_purchase_requests_status_idx` ON `customer_purchase_requests` (`status`);