ALTER TABLE `sale_order_items` ADD `checked_quantity` integer DEFAULT -1 NOT NULL;--> statement-breakpoint
ALTER TABLE `sale_order_items` ADD `substitute_product_code` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `sale_order_items` ADD `substitute_product_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `sale_order_items` ADD `substitute_sku` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `sale_order_items` ADD `substitute_sale_price` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sale_order_items` ADD `substitute_quantity` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sale_order_items` ADD `substitution_status` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `sale_order_items` ADD `substitution_reason` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `sale_order_items` ADD `substitution_proposed_by` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `sale_order_items` ADD `substitution_proposed_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `sale_order_items` ADD `substitution_confirmed_by` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `sale_order_items` ADD `substitution_confirmed_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `sale_order_items` ADD `substitution_returned_by` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `sale_order_items` ADD `substitution_returned_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `sale_order_items` ADD `substitution_return_reason` text DEFAULT '' NOT NULL;