ALTER TABLE `orders` ADD `delivery_proof_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `delivery_proof_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `delivery_proof_type` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `delivery_proof_uploaded_by` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `delivery_proof_uploaded_at` text DEFAULT '' NOT NULL;