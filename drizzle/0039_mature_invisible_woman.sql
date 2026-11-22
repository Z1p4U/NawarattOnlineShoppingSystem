CREATE TABLE `exam_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`cycle_id` text NOT NULL,
	`user_email` text NOT NULL,
	`user_name` text NOT NULL,
	`user_role` text NOT NULL,
	`level` text NOT NULL,
	`attempt_type` text NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`official_lock_key` text,
	`started_at` text NOT NULL,
	`deadline_at` text NOT NULL,
	`submitted_at` text DEFAULT '' NOT NULL,
	`allowed_seconds` integer NOT NULL,
	`questions_json` text NOT NULL,
	`answers_json` text DEFAULT '{}' NOT NULL,
	`fingerprint` text NOT NULL,
	`price_score` integer DEFAULT 0 NOT NULL,
	`supplier_score` integer DEFAULT 0 NOT NULL,
	`inventory_score` integer DEFAULT 0 NOT NULL,
	`total_score` integer DEFAULT 0 NOT NULL,
	`max_score` integer DEFAULT 0 NOT NULL,
	`percentage` integer DEFAULT 0 NOT NULL,
	`time_used_seconds` integer DEFAULT 0 NOT NULL,
	`reset_of` text DEFAULT '' NOT NULL,
	`reset_reason` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exam_attempts_official_lock_unique` ON `exam_attempts` (`official_lock_key`);--> statement-breakpoint
CREATE INDEX `exam_attempts_user_idx` ON `exam_attempts` (`user_email`,`created_at`);--> statement-breakpoint
CREATE INDEX `exam_attempts_cycle_level_idx` ON `exam_attempts` (`cycle_id`,`level`,`status`);--> statement-breakpoint
CREATE INDEX `exam_attempts_fingerprint_idx` ON `exam_attempts` (`cycle_id`,`level`,`fingerprint`);--> statement-breakpoint
CREATE TABLE `exam_cycles` (
	`id` text PRIMARY KEY NOT NULL,
	`cycle_key` text NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`opens_at` text DEFAULT '' NOT NULL,
	`closes_at` text DEFAULT '' NOT NULL,
	`price_file_name` text DEFAULT '' NOT NULL,
	`supplier_file_name` text DEFAULT '' NOT NULL,
	`inventory_file_name` text DEFAULT '' NOT NULL,
	`price_count` integer DEFAULT 0 NOT NULL,
	`supplier_count` integer DEFAULT 0 NOT NULL,
	`inventory_count` integer DEFAULT 0 NOT NULL,
	`published_by` text DEFAULT '' NOT NULL,
	`published_at` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exam_cycles_key_unique` ON `exam_cycles` (`cycle_key`);--> statement-breakpoint
CREATE INDEX `exam_cycles_status_idx` ON `exam_cycles` (`status`,`opens_at`);--> statement-breakpoint
CREATE TABLE `exam_question_pool` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cycle_id` text NOT NULL,
	`section` text NOT NULL,
	`product_key` text NOT NULL,
	`product_name` text NOT NULL,
	`payload_json` text NOT NULL,
	`uploaded_by` text NOT NULL,
	`uploaded_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exam_pool_cycle_section_product_unique` ON `exam_question_pool` (`cycle_id`,`section`,`product_key`);--> statement-breakpoint
CREATE INDEX `exam_pool_cycle_section_idx` ON `exam_question_pool` (`cycle_id`,`section`);