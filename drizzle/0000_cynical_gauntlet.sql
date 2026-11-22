CREATE TABLE `order_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`event_type` text NOT NULL,
	`message` text NOT NULL,
	`actor` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `order_events_order_idx` ON `order_events` (`order_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_no` text NOT NULL,
	`order_date` text NOT NULL,
	`customer_name` text NOT NULL,
	`customer_key` text NOT NULL,
	`route` text NOT NULL,
	`initial_boxes` integer DEFAULT 0 NOT NULL,
	`initial_bundles` integer DEFAULT 0 NOT NULL,
	`addon_boxes` integer DEFAULT 0 NOT NULL,
	`addon_bundles` integer DEFAULT 0 NOT NULL,
	`delivered_boxes` integer DEFAULT 0 NOT NULL,
	`delivered_bundles` integer DEFAULT 0 NOT NULL,
	`order_amount` integer DEFAULT 0 NOT NULL,
	`paid_amount` integer DEFAULT 0 NOT NULL,
	`dispatch_status` text DEFAULT 'packed' NOT NULL,
	`payment_status` text DEFAULT 'unpaid' NOT NULL,
	`addon_pending` integer DEFAULT false NOT NULL,
	`remark` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`updated_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_day_customer_route_unique` ON `orders` (`order_date`,`customer_key`,`route`);--> statement-breakpoint
CREATE INDEX `orders_date_idx` ON `orders` (`order_date`);--> statement-breakpoint
CREATE INDEX `orders_status_idx` ON `orders` (`dispatch_status`);