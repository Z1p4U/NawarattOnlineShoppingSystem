CREATE TABLE `customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_name` text NOT NULL,
	`township` text NOT NULL,
	`customer_key` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`route` text DEFAULT 'HTY Ways' NOT NULL,
	`salesperson` text DEFAULT 'Admin' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_customer_key_unique` ON `customers` (`customer_key`);--> statement-breakpoint
CREATE INDEX `customers_name_township_idx` ON `customers` (`customer_name`,`township`);