CREATE TABLE `product_master` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_code` text NOT NULL,
	`product_name` text NOT NULL,
	`sku` text DEFAULT '' NOT NULL,
	`sale_price` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_master_code_unique` ON `product_master` (`product_code`);--> statement-breakpoint
CREATE INDEX `product_master_name_idx` ON `product_master` (`product_name`);--> statement-breakpoint
CREATE INDEX `product_master_sku_idx` ON `product_master` (`sku`);--> statement-breakpoint
CREATE INDEX `product_master_active_idx` ON `product_master` (`active`,`product_name`);