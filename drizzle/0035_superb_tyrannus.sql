CREATE TABLE `purchase_request_allocations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_type` text NOT NULL,
	`purchase_request_id` integer NOT NULL,
	`fulfillment_order_id` integer NOT NULL,
	`fulfillment_order_item_id` integer NOT NULL,
	`batch_sequence` integer DEFAULT 1 NOT NULL,
	`customer_key` text NOT NULL,
	`product_code` text NOT NULL,
	`quantity` integer NOT NULL,
	`previous_status` text DEFAULT 'pending' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by` text DEFAULT 'System' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`restored_by` text DEFAULT '' NOT NULL,
	`restored_at` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `purchase_request_allocations_order_idx` ON `purchase_request_allocations` (`fulfillment_order_id`,`batch_sequence`,`status`);--> statement-breakpoint
CREATE INDEX `purchase_request_allocations_item_idx` ON `purchase_request_allocations` (`fulfillment_order_item_id`,`status`);--> statement-breakpoint
CREATE INDEX `purchase_request_allocations_request_idx` ON `purchase_request_allocations` (`source_type`,`purchase_request_id`,`status`);--> statement-breakpoint
ALTER TABLE `customer_purchase_requests` ADD `customer_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `customer_purchase_requests`
SET `customer_key` = lower(trim(`customer_name`)) || '|||' || lower(trim(`township`))
WHERE `customer_key` = '';--> statement-breakpoint
CREATE INDEX `customer_purchase_requests_customer_product_idx` ON `customer_purchase_requests` (`customer_key`,`product_code`,`status`);
