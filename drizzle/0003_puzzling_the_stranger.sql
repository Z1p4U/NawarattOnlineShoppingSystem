ALTER TABLE `orders` ADD `voucher_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `orders` SET `voucher_amount` = `order_amount`;
