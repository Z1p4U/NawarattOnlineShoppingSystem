ALTER TABLE `product_intelligence` ADD `unique_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `product_intelligence` ADD `source_row_number` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `product_intelligence` ADD `entry_date` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `product_intelligence` ADD `entered_by` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `product_intelligence` ADD `expiry_date` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `product_intelligence` ADD `knowledge_location` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `product_intelligence` ADD `checked_time` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `product_intelligence_unique_idx` ON `product_intelligence` (`sync_run_id`,`unique_key`);--> statement-breakpoint
CREATE INDEX `product_intelligence_location_idx` ON `product_intelligence` (`sync_run_id`,`knowledge_location`);--> statement-breakpoint
ALTER TABLE `product_sync_runs` ADD `run_type` text DEFAULT 'daily' NOT NULL;--> statement-breakpoint
ALTER TABLE `product_sync_runs` ADD `source_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `product_sync_runs` ADD `source_rows` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `product_sync_runs` ADD `valid_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `product_sync_runs` ADD `unique_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `product_sync_runs` ADD `duplicate_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `product_sync_runs` ADD `skipped_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `product_sync_runs` ADD `low_sale_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `product_sync_runs` ADD `overstock_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `product_sync_runs` ADD `near_expired_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `product_sync_runs` ADD `unclassified_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `product_sync_runs` ADD `new_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `product_sync_runs` ADD `updated_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `product_sync_runs` ADD `unchanged_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `product_sync_runs` ADD `duration_ms` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `product_sync_runs` ADD `error_summary` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `product_sync_runs` ADD `is_active` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `product_sync_runs` ADD `completed_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `product_sync_runs` SET `is_active` = 1 WHERE `id` = (SELECT `id` FROM `product_sync_runs` WHERE `status` = 'completed' ORDER BY `created_at` DESC, `id` DESC LIMIT 1);--> statement-breakpoint
CREATE INDEX `product_sync_runs_active_idx` ON `product_sync_runs` (`is_active`,`created_at`);
