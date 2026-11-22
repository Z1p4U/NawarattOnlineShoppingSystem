CREATE TABLE `purchase_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`batch_sequence` integer DEFAULT 1 NOT NULL,
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
CREATE INDEX `purchase_requests_order_idx` ON `purchase_requests` (`order_id`);--> statement-breakpoint
CREATE INDEX `purchase_requests_status_idx` ON `purchase_requests` (`status`);