CREATE TABLE `sale_order_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`batch_sequence` integer DEFAULT 1 NOT NULL,
	`original_row_number` integer NOT NULL,
	`original_product_code` text DEFAULT '' NOT NULL,
	`original_description` text NOT NULL,
	`original_quantity` text NOT NULL,
	`quantity` integer DEFAULT 0 NOT NULL,
	`original_unit` text DEFAULT '' NOT NULL,
	`original_sale_price` text DEFAULT '' NOT NULL,
	`matched_product_code` text DEFAULT '' NOT NULL,
	`matched_product_name` text DEFAULT '' NOT NULL,
	`match_status` text DEFAULT 'unknown' NOT NULL,
	`fulfillment_status` text DEFAULT 'pending' NOT NULL,
	`picked_quantity` integer DEFAULT 0 NOT NULL,
	`shortage_quantity` integer DEFAULT 0 NOT NULL,
	`resolution_note` text DEFAULT '' NOT NULL,
	`verified_by` text DEFAULT '' NOT NULL,
	`verified_at` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sale_order_items_order_row_unique` ON `sale_order_items` (`order_id`,`batch_sequence`,`original_row_number`);--> statement-breakpoint
CREATE INDEX `sale_order_items_order_idx` ON `sale_order_items` (`order_id`,`batch_sequence`);--> statement-breakpoint
CREATE INDEX `sale_order_items_match_idx` ON `sale_order_items` (`match_status`,`fulfillment_status`);