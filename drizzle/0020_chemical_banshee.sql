CREATE TABLE `payment_import_batches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`file_hash` text NOT NULL,
	`file_name` text DEFAULT '' NOT NULL,
	`row_count` integer DEFAULT 0 NOT NULL,
	`total_amount` integer DEFAULT 0 NOT NULL,
	`imported_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_import_batches_file_hash_unique` ON `payment_import_batches` (`file_hash`);--> statement-breakpoint
CREATE INDEX `payment_import_batches_created_idx` ON `payment_import_batches` (`created_at`);