CREATE TABLE `customer_locations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_key` text NOT NULL,
	`latitude` text DEFAULT '' NOT NULL,
	`longitude` text DEFAULT '' NOT NULL,
	`landmark` text DEFAULT '' NOT NULL,
	`directions_note` text DEFAULT '' NOT NULL,
	`shop_photo_url` text DEFAULT '' NOT NULL,
	`verified` integer DEFAULT false NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_locations_customer_unique` ON `customer_locations` (`customer_key`);--> statement-breakpoint
CREATE TABLE `sales_route_plans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`plan_date` text NOT NULL,
	`route_name` text NOT NULL,
	`township` text DEFAULT '' NOT NULL,
	`salesperson` text NOT NULL,
	`planned_start_time` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`remark` text DEFAULT '' NOT NULL,
	`is_template` integer DEFAULT false NOT NULL,
	`created_by_email` text NOT NULL,
	`created_by_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sales_route_plans_date_idx` ON `sales_route_plans` (`plan_date`,`status`);--> statement-breakpoint
CREATE INDEX `sales_route_plans_salesperson_idx` ON `sales_route_plans` (`salesperson`,`plan_date`);--> statement-breakpoint
CREATE TABLE `sales_route_stops` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`route_plan_id` integer NOT NULL,
	`sequence` integer DEFAULT 1 NOT NULL,
	`customer_key` text NOT NULL,
	`customer_name` text NOT NULL,
	`township` text DEFAULT '' NOT NULL,
	`route` text DEFAULT '' NOT NULL,
	`salesperson` text DEFAULT 'Admin' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`visit_purpose` text DEFAULT 'collect_order' NOT NULL,
	`visit_result` text DEFAULT '' NOT NULL,
	`no_order_reason` text DEFAULT '' NOT NULL,
	`order_received` integer DEFAULT false NOT NULL,
	`estimated_order_amount` integer DEFAULT 0 NOT NULL,
	`confirmed_order_id` integer,
	`payment_collected` integer DEFAULT false NOT NULL,
	`collected_amount` integer DEFAULT 0 NOT NULL,
	`finance_verified` integer DEFAULT false NOT NULL,
	`customer_request` text DEFAULT '' NOT NULL,
	`next_follow_up_date` text DEFAULT '' NOT NULL,
	`next_visit_date` text DEFAULT '' NOT NULL,
	`remark` text DEFAULT '' NOT NULL,
	`check_in_latitude` text DEFAULT '' NOT NULL,
	`check_in_longitude` text DEFAULT '' NOT NULL,
	`check_in_distance_meters` integer DEFAULT 0 NOT NULL,
	`check_in_verified` integer DEFAULT false NOT NULL,
	`check_in_reason` text DEFAULT '' NOT NULL,
	`check_in_at` text DEFAULT '' NOT NULL,
	`check_out_at` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sales_route_stops_plan_idx` ON `sales_route_stops` (`route_plan_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `sales_route_stops_customer_idx` ON `sales_route_stops` (`customer_key`,`updated_at`);--> statement-breakpoint
CREATE INDEX `sales_route_stops_follow_up_idx` ON `sales_route_stops` (`next_follow_up_date`,`status`);--> statement-breakpoint
ALTER TABLE `sales_follow_ups` ADD `call_date` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `sales_follow_ups` ADD `call_time` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `sales_follow_ups` ADD `call_purpose` text DEFAULT 'customer_follow_up' NOT NULL;--> statement-breakpoint
ALTER TABLE `sales_follow_ups` ADD `call_result` text DEFAULT 'planned' NOT NULL;--> statement-breakpoint
ALTER TABLE `sales_follow_ups` ADD `payment_follow_up` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `sales_follow_ups` ADD `customer_request` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `sales_follow_ups` ADD `order_expected` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `sales_follow_ups` ADD `confirmed_order_id` integer;