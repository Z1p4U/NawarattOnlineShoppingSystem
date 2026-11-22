CREATE TABLE `delivery_incidents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`issue_type` text NOT NULL,
	`item_details` text DEFAULT '' NOT NULL,
	`deduction_amount` integer DEFAULT 0 NOT NULL,
	`voucher_before` integer DEFAULT 0 NOT NULL,
	`voucher_after` integer DEFAULT 0 NOT NULL,
	`proof_key` text NOT NULL,
	`proof_name` text DEFAULT '' NOT NULL,
	`proof_type` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `delivery_incidents_order_idx` ON `delivery_incidents` (`order_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `delivery_incidents_type_idx` ON `delivery_incidents` (`issue_type`,`created_at`);