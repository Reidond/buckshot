CREATE TABLE `admin_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`name` text,
	`role` text DEFAULT 'admin' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_users_email_unique` ON `admin_users` (`email`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_id` text,
	`action` text NOT NULL,
	`target_type` text,
	`target_id` text,
	`details` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`admin_id`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `bulk_connect_results` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`email` text,
	`channel_id` text,
	`channel_title` text,
	`result` text NOT NULL,
	`error_detail` text,
	`account_id` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_bcr_session` ON `bulk_connect_results` (`session_id`);--> statement-breakpoint
CREATE TABLE `gcp_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`gcp_project_id` text,
	`client_id` text NOT NULL,
	`client_secret` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`max_accounts` integer,
	`account_count` integer DEFAULT 0 NOT NULL,
	`added_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`added_by`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `google_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`email` text NOT NULL,
	`channel_id` text,
	`channel_title` text,
	`refresh_token` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`status_reason` text,
	`health_strikes` integer DEFAULT 0 NOT NULL,
	`last_health_check` integer,
	`auto_delete_at` integer,
	`tags` text,
	`added_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `gcp_projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`added_by`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_id` text,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`job_id` text,
	`account_id` text,
	`project_id` text,
	`read` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`admin_id`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`tags` text,
	`privacy` text DEFAULT 'public' NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `upload_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`video_r2_key` text NOT NULL,
	`video_filename` text NOT NULL,
	`video_size` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`tags` text,
	`privacy` text DEFAULT 'public' NOT NULL,
	`template_id` text,
	`created_by` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`total_tasks` integer DEFAULT 0 NOT NULL,
	`completed_tasks` integer DEFAULT 0 NOT NULL,
	`failed_tasks` integer DEFAULT 0 NOT NULL,
	`r2_cleaned` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `templates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `upload_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text,
	`job_id` text,
	`account_id` text,
	`project_id` text,
	`level` text NOT NULL,
	`event` text NOT NULL,
	`message` text NOT NULL,
	`metadata` text,
	`duration_ms` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `upload_tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`job_id`) REFERENCES `upload_jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `google_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `gcp_projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_upload_logs_task` ON `upload_logs` (`task_id`);--> statement-breakpoint
CREATE INDEX `idx_upload_logs_job` ON `upload_logs` (`job_id`);--> statement-breakpoint
CREATE INDEX `idx_upload_logs_project` ON `upload_logs` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_upload_logs_level` ON `upload_logs` (`level`,`created_at`);--> statement-breakpoint
CREATE TABLE `upload_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`account_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`title_override` text,
	`desc_override` text,
	`tags_override` text,
	`youtube_id` text,
	`youtube_url` text,
	`error_message` text,
	`error_code` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 5 NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `upload_jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `google_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
