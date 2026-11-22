ALTER TABLE `orders` ADD `voucher_status` text DEFAULT 'updated' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `voucher_updated_by` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `voucher_updated_at` text DEFAULT '' NOT NULL;