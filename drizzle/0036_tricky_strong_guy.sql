CREATE TABLE `order_product_adjustments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`order_status_before` text DEFAULT '' NOT NULL,
	`order_status_after` text DEFAULT '' NOT NULL,
	`before_value` text DEFAULT '[]' NOT NULL,
	`after_value` text DEFAULT '[]' NOT NULL,
	`change_summary` text DEFAULT '' NOT NULL,
	`reason` text NOT NULL,
	`warehouse_recheck_required` integer DEFAULT false NOT NULL,
	`stock_adjustment_status` text DEFAULT 'review_required' NOT NULL,
	`package_adjustment_status` text DEFAULT 'review_required' NOT NULL,
	`finance_adjustment_status` text DEFAULT 'review_required' NOT NULL,
	`sale_vr_adjustment_status` text DEFAULT 'review_required' NOT NULL,
	`edited_by` text NOT NULL,
	`edited_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `order_product_adjustments_order_idx` ON `order_product_adjustments` (`order_id`,`edited_at`);--> statement-breakpoint
ALTER TABLE `sale_order_items` ADD `checked_unit` text DEFAULT '' NOT NULL;