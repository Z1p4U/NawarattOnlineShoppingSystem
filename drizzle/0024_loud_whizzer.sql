DROP INDEX `orders_day_customer_route_unique`;--> statement-breakpoint
CREATE INDEX `orders_day_customer_route_idx` ON `orders` (`order_date`,`customer_key`,`route`);