CREATE TABLE `employee_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_date` text NOT NULL,
	`report_type` text DEFAULT 'daily' NOT NULL,
	`title` text NOT NULL,
	`completed_work` text DEFAULT '' NOT NULL,
	`challenges` text DEFAULT '' NOT NULL,
	`next_plan` text DEFAULT '' NOT NULL,
	`support_needed` text DEFAULT '' NOT NULL,
	`submitted_by_email` text NOT NULL,
	`submitted_by_name` text NOT NULL,
	`submitted_by_role` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `employee_reports_date_idx` ON `employee_reports` (`report_date`,`created_at`);--> statement-breakpoint
CREATE INDEX `employee_reports_employee_idx` ON `employee_reports` (`submitted_by_email`,`report_date`);--> statement-breakpoint
CREATE TABLE `product_knowledge` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_name` text NOT NULL,
	`generic_name` text DEFAULT '' NOT NULL,
	`category` text DEFAULT 'General' NOT NULL,
	`key_benefits` text DEFAULT '' NOT NULL,
	`talking_points` text DEFAULT '' NOT NULL,
	`usage_note` text DEFAULT '' NOT NULL,
	`caution` text DEFAULT '' NOT NULL,
	`tags` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `product_knowledge_name_idx` ON `product_knowledge` (`product_name`);--> statement-breakpoint
CREATE INDEX `product_knowledge_category_idx` ON `product_knowledge` (`category`,`active`);--> statement-breakpoint
CREATE TABLE `sales_follow_ups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_key` text NOT NULL,
	`customer_name` text NOT NULL,
	`township` text DEFAULT '' NOT NULL,
	`salesperson` text DEFAULT 'Admin' NOT NULL,
	`opportunity_type` text DEFAULT 'follow_up' NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`next_follow_up_date` text DEFAULT '' NOT NULL,
	`product_suggestion` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`expected_amount` integer DEFAULT 0 NOT NULL,
	`created_by_email` text NOT NULL,
	`created_by_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sales_follow_ups_customer_idx` ON `sales_follow_ups` (`customer_key`,`updated_at`);--> statement-breakpoint
CREATE INDEX `sales_follow_ups_next_date_idx` ON `sales_follow_ups` (`next_follow_up_date`,`status`);--> statement-breakpoint
CREATE INDEX `sales_follow_ups_salesperson_idx` ON `sales_follow_ups` (`salesperson`,`status`);