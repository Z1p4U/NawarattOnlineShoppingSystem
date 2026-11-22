CREATE TABLE `data_quality_aliases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity_type` text NOT NULL,
	`canonical_record_id` integer NOT NULL,
	`alias_record_id` integer NOT NULL,
	`alias_key` text DEFAULT '' NOT NULL,
	`alias_name` text DEFAULT '' NOT NULL,
	`alias_details` text DEFAULT '{}' NOT NULL,
	`merged_by` text NOT NULL,
	`merged_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `data_quality_aliases_record_unique` ON `data_quality_aliases` (`entity_type`,`alias_record_id`);--> statement-breakpoint
CREATE INDEX `data_quality_aliases_canonical_idx` ON `data_quality_aliases` (`entity_type`,`canonical_record_id`);--> statement-breakpoint
CREATE TABLE `data_quality_merge_backups` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`canonical_record_id` integer NOT NULL,
	`duplicate_record_id` integer NOT NULL,
	`snapshot_json` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `data_quality_merge_backups_entity_idx` ON `data_quality_merge_backups` (`entity_type`,`created_at`);--> statement-breakpoint
CREATE TABLE `duplicate_review_decisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity_type` text NOT NULL,
	`record_a_id` integer NOT NULL,
	`record_b_id` integer NOT NULL,
	`pair_key` text NOT NULL,
	`decision` text DEFAULT 'review_later' NOT NULL,
	`canonical_id` integer DEFAULT 0 NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`decided_by` text DEFAULT '' NOT NULL,
	`decided_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `duplicate_review_decisions_pair_unique` ON `duplicate_review_decisions` (`pair_key`);--> statement-breakpoint
CREATE INDEX `duplicate_review_decisions_entity_idx` ON `duplicate_review_decisions` (`entity_type`,`decision`,`decided_at`);