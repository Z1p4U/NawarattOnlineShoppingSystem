CREATE TABLE `warehouse_returns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`returned_boxes` integer DEFAULT 0 NOT NULL,
	`returned_bundles` integer DEFAULT 0 NOT NULL,
	`finance_status` text DEFAULT 'not_deducted' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`accepted_by` text NOT NULL,
	`accepted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `warehouse_returns_order_idx` ON `warehouse_returns` (`order_id`,`accepted_at`);--> statement-breakpoint
CREATE INDEX `warehouse_returns_finance_idx` ON `warehouse_returns` (`finance_status`,`accepted_at`);