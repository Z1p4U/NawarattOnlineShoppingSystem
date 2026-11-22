CREATE TABLE `app_users` (
	`email` text PRIMARY KEY NOT NULL,
	`display_name` text DEFAULT '' NOT NULL,
	`role` text DEFAULT 'viewer' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `sale_order_count` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `warehouse_status` text DEFAULT 'finished' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `warehouse_confirmed_by` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `warehouse_confirmed_at` text DEFAULT '' NOT NULL;