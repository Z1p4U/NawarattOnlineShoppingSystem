ALTER TABLE `customer_purchase_requests` ADD `salesperson` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_purchase_requests` ADD `requested_by_email` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `notifications` ADD `recipient_email` text DEFAULT '' NOT NULL;