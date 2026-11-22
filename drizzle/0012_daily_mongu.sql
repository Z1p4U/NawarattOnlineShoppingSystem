CREATE TABLE `department_message_reads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`message_id` integer NOT NULL,
	`user_email` text NOT NULL,
	`read_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `department_message_reads_user_unique` ON `department_message_reads` (`message_id`,`user_email`);--> statement-breakpoint
CREATE INDEX `department_message_reads_user_idx` ON `department_message_reads` (`user_email`);--> statement-breakpoint
CREATE TABLE `department_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sender_email` text NOT NULL,
	`sender_name` text NOT NULL,
	`sender_role` text NOT NULL,
	`recipient_role` text NOT NULL,
	`message` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `department_messages_sender_idx` ON `department_messages` (`sender_role`,`created_at`);--> statement-breakpoint
CREATE INDEX `department_messages_recipient_idx` ON `department_messages` (`recipient_role`,`created_at`);