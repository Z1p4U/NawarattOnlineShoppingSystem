CREATE TABLE `product_intelligence` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sync_run_id` integer NOT NULL,
	`insight_type` text NOT NULL,
	`product_code` text DEFAULT '' NOT NULL,
	`product_name` text NOT NULL,
	`metric_label` text DEFAULT '' NOT NULL,
	`metric_value` text DEFAULT '' NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`source_name` text DEFAULT '' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`rank` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `product_intelligence_run_idx` ON `product_intelligence` (`sync_run_id`,`insight_type`,`rank`);--> statement-breakpoint
CREATE INDEX `product_intelligence_product_idx` ON `product_intelligence` (`product_code`,`product_name`);--> statement-breakpoint
CREATE TABLE `product_sync_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sync_date` text NOT NULL,
	`sale_tab` text DEFAULT '' NOT NULL,
	`purchase_tab` text DEFAULT '' NOT NULL,
	`inventory_tab` text DEFAULT '' NOT NULL,
	`slow_items_tab` text DEFAULT '' NOT NULL,
	`source_summary` text DEFAULT '{}' NOT NULL,
	`item_count` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'completed' NOT NULL,
	`triggered_by` text DEFAULT 'Daily 10:00 AM Sync' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `product_sync_runs_date_idx` ON `product_sync_runs` (`sync_date`,`created_at`);