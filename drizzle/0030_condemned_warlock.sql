CREATE TABLE `sale_order_photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`batch_sequence` integer DEFAULT 1 NOT NULL,
	`customer_name` text NOT NULL,
	`order_no` text DEFAULT '' NOT NULL,
	`order_date` text NOT NULL,
	`file_key` text NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text DEFAULT 'image/webp' NOT NULL,
	`file_size` integer DEFAULT 0 NOT NULL,
	`download_token` text NOT NULL,
	`sync_status` text DEFAULT 'pending' NOT NULL,
	`drive_file_id` text DEFAULT '' NOT NULL,
	`drive_file_url` text DEFAULT '' NOT NULL,
	`sync_error` text DEFAULT '' NOT NULL,
	`uploaded_by` text DEFAULT '' NOT NULL,
	`uploaded_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`synced_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sale_order_photos_sync_idx` ON `sale_order_photos` (`sync_status`,`uploaded_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `sale_order_photos_download_token_unique` ON `sale_order_photos` (`download_token`);--> statement-breakpoint
CREATE INDEX `sale_order_photos_order_idx` ON `sale_order_photos` (`order_id`,`batch_sequence`);