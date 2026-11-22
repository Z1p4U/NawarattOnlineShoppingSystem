ALTER TABLE `customer_purchase_requests` ADD `product_code` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_purchase_requests` ADD `supplier_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_purchase_requests` ADD `source_file_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_purchase_requests` ADD `source_file_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_purchase_requests` ADD `ai_confidence` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_purchase_requests` ADD `processing_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `customer_purchase_requests_processing_key_unique` ON `customer_purchase_requests` (`processing_key`);--> statement-breakpoint
ALTER TABLE `purchase_requests` ADD `product_code` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `purchase_requests` ADD `supplier_name` text DEFAULT '' NOT NULL;