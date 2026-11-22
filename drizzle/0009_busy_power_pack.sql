ALTER TABLE `orders` ADD `sale_approved` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `sale_approved_by` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `sale_approved_at` text DEFAULT '' NOT NULL;