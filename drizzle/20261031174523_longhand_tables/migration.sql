CREATE TABLE `bookmarks` (
	`user_id` text NOT NULL,
	`story_id` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `bookmarks_pk` PRIMARY KEY(`user_id`, `story_id`),
	CONSTRAINT `fk_bookmarks_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_bookmarks_story_id_stories_id_fk` FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `claps` (
	`story_id` text NOT NULL,
	`user_id` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `claps_pk` PRIMARY KEY(`story_id`, `user_id`),
	CONSTRAINT `fk_claps_story_id_stories_id_fk` FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_claps_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `follows` (
	`follower_id` text NOT NULL,
	`followee_id` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `follows_pk` PRIMARY KEY(`follower_id`, `followee_id`),
	CONSTRAINT `fk_follows_follower_id_user_id_fk` FOREIGN KEY (`follower_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_follows_followee_id_user_id_fk` FOREIGN KEY (`followee_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `highlights` (
	`id` text PRIMARY KEY,
	`story_id` text NOT NULL,
	`user_id` text NOT NULL,
	`quote` text NOT NULL,
	`start` integer NOT NULL,
	`end` integer NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_highlights_story_id_stories_id_fk` FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_highlights_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`type` text NOT NULL,
	`story_id` text,
	`response_id` text,
	`created_at` integer NOT NULL,
	`read_at` integer,
	CONSTRAINT `fk_notifications_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_notifications_actor_id_user_id_fk` FOREIGN KEY (`actor_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_notifications_story_id_stories_id_fk` FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_notifications_response_id_responses_id_fk` FOREIGN KEY (`response_id`) REFERENCES `responses`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY,
	`username` text NOT NULL UNIQUE,
	`bio` text DEFAULT '' NOT NULL,
	`avatar_url` text,
	`email_on_follower` integer DEFAULT true NOT NULL,
	`email_on_response` integer DEFAULT true NOT NULL,
	`is_seed` integer DEFAULT false NOT NULL,
	`follower_count` integer DEFAULT 0 NOT NULL,
	`following_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_profiles_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY,
	`count` integer DEFAULT 0 NOT NULL,
	`reset_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY,
	`reporter_id` text,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`reason` text NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_reports_reporter_id_user_id_fk` FOREIGN KEY (`reporter_id`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `responses` (
	`id` text PRIMARY KEY,
	`story_id` text NOT NULL,
	`author_id` text NOT NULL,
	`parent_id` text,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	`edited_at` integer,
	`deleted_at` integer,
	CONSTRAINT `fk_responses_story_id_stories_id_fk` FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_responses_author_id_user_id_fk` FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `stories` (
	`id` text PRIMARY KEY,
	`author_id` text NOT NULL,
	`slug` text UNIQUE,
	`status` text DEFAULT 'draft' NOT NULL,
	`draft_title` text DEFAULT '' NOT NULL,
	`draft_subtitle` text DEFAULT '' NOT NULL,
	`draft_doc` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`draft_updated_at` integer NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`subtitle` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`cover_url` text,
	`cover_alt` text DEFAULT '' NOT NULL,
	`html` text DEFAULT '' NOT NULL,
	`plain_text` text DEFAULT '' NOT NULL,
	`word_count` integer DEFAULT 0 NOT NULL,
	`reading_minutes` integer DEFAULT 1 NOT NULL,
	`published_at` integer,
	`live_updated_at` integer,
	`staff_pick` integer DEFAULT false NOT NULL,
	`clap_count` integer DEFAULT 0 NOT NULL,
	`response_count` integer DEFAULT 0 NOT NULL,
	`highlight_count` integer DEFAULT 0 NOT NULL,
	`bookmark_count` integer DEFAULT 0 NOT NULL,
	`view_count` integer DEFAULT 0 NOT NULL,
	`read_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_stories_author_id_user_id_fk` FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `story_stats_daily` (
	`story_id` text NOT NULL,
	`day` text NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	`reads` integer DEFAULT 0 NOT NULL,
	`claps` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `story_stats_daily_pk` PRIMARY KEY(`story_id`, `day`),
	CONSTRAINT `fk_story_stats_daily_story_id_stories_id_fk` FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `story_topics` (
	`story_id` text NOT NULL,
	`topic` text NOT NULL,
	CONSTRAINT `story_topics_pk` PRIMARY KEY(`story_id`, `topic`),
	CONSTRAINT `fk_story_topics_story_id_stories_id_fk` FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `topic_follows` (
	`user_id` text NOT NULL,
	`topic` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `topic_follows_pk` PRIMARY KEY(`user_id`, `topic`),
	CONSTRAINT `fk_topic_follows_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `bookmarks_user_idx` ON `bookmarks` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `claps_user_idx` ON `claps` (`user_id`);--> statement-breakpoint
CREATE INDEX `follows_followee_idx` ON `follows` (`followee_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `highlights_story_idx` ON `highlights` (`story_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `highlights_unique_idx` ON `highlights` (`story_id`,`user_id`,`start`,`end`);--> statement-breakpoint
CREATE INDEX `notifications_user_idx` ON `notifications` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `notifications_actor_idx` ON `notifications` (`actor_id`,`type`);--> statement-breakpoint
CREATE INDEX `rate_limits_reset_idx` ON `rate_limits` (`reset_at`);--> statement-breakpoint
CREATE INDEX `reports_status_idx` ON `reports` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `responses_story_idx` ON `responses` (`story_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `responses_parent_idx` ON `responses` (`parent_id`);--> statement-breakpoint
CREATE INDEX `stories_status_published_idx` ON `stories` (`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `stories_author_status_idx` ON `stories` (`author_id`,`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `stories_staff_pick_idx` ON `stories` (`staff_pick`,`published_at`);--> statement-breakpoint
CREATE INDEX `story_stats_day_idx` ON `story_stats_daily` (`day`);--> statement-breakpoint
CREATE INDEX `story_topics_topic_idx` ON `story_topics` (`topic`,`story_id`);