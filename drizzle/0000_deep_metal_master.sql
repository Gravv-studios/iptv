CREATE TABLE `demo_accounts` (
	`user_id` text PRIMARY KEY NOT NULL,
	`customer_name` text NOT NULL,
	`plan_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`username` text NOT NULL,
	`password` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `demo_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_demo_messages_user_created` ON `demo_messages` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `demo_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`request_key` text NOT NULL,
	`plan_id` text NOT NULL,
	`amount` integer NOT NULL,
	`days` integer NOT NULL,
	`method` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`paid_at` integer,
	`applied` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_demo_orders_user_created` ON `demo_orders` (`user_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_demo_orders_request` ON `demo_orders` (`user_id`,`request_key`);