CREATE TABLE `purchase_arrival_allocations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`import_run_id` integer NOT NULL,
	`incoming_record_id` integer DEFAULT 0 NOT NULL,
	`incoming_unique_key` text NOT NULL,
	`source_type` text NOT NULL,
	`purchase_request_id` integer NOT NULL,
	`canonical_product_id` integer DEFAULT 0 NOT NULL,
	`product_code` text DEFAULT '' NOT NULL,
	`product_name` text NOT NULL,
	`incoming_quantity` integer DEFAULT 0 NOT NULL,
	`allocated_quantity` integer DEFAULT 0 NOT NULL,
	`requested_quantity` integer DEFAULT 0 NOT NULL,
	`remaining_quantity` integer DEFAULT 0 NOT NULL,
	`supplier_name` text DEFAULT '' NOT NULL,
	`purchase_date` text DEFAULT '' NOT NULL,
	`imported_at` text NOT NULL,
	`matched_by` text DEFAULT '' NOT NULL,
	`arrival_status` text DEFAULT 'partial' NOT NULL,
	`review_reason` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by` text DEFAULT 'System' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_arrival_allocations_event_unique` ON `purchase_arrival_allocations` (`import_run_id`,`incoming_unique_key`,`source_type`,`purchase_request_id`);--> statement-breakpoint
CREATE INDEX `purchase_arrival_allocations_request_idx` ON `purchase_arrival_allocations` (`source_type`,`purchase_request_id`,`status`);--> statement-breakpoint
CREATE INDEX `purchase_arrival_allocations_run_idx` ON `purchase_arrival_allocations` (`import_run_id`,`status`);--> statement-breakpoint
CREATE TABLE `purchase_arrival_unmatched` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`import_run_id` integer NOT NULL,
	`incoming_record_id` integer DEFAULT 0 NOT NULL,
	`incoming_unique_key` text NOT NULL,
	`product_code` text DEFAULT '' NOT NULL,
	`product_name` text NOT NULL,
	`incoming_quantity` integer DEFAULT 0 NOT NULL,
	`supplier_name` text DEFAULT '' NOT NULL,
	`purchase_date` text DEFAULT '' NOT NULL,
	`imported_at` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'unmatched' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_arrival_unmatched_event_unique` ON `purchase_arrival_unmatched` (`import_run_id`,`incoming_unique_key`);--> statement-breakpoint
CREATE INDEX `purchase_arrival_unmatched_status_idx` ON `purchase_arrival_unmatched` (`status`,`imported_at`);