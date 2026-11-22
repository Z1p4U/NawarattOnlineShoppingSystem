-- Clear pre-launch operational trial data while preserving staff accounts and role assignments.
DELETE FROM `notification_reads`;--> statement-breakpoint
DELETE FROM `notifications`;--> statement-breakpoint
DELETE FROM `department_message_reads`;--> statement-breakpoint
DELETE FROM `department_messages`;--> statement-breakpoint
DELETE FROM `payment_transactions`;--> statement-breakpoint
DELETE FROM `purchase_requests`;--> statement-breakpoint
DELETE FROM `customer_purchase_requests`;--> statement-breakpoint
DELETE FROM `order_events`;--> statement-breakpoint
DELETE FROM `orders`;
