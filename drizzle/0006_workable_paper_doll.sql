ALTER TABLE `build_branches` ADD COLUMN IF NOT EXISTS `pushState` varchar(32) DEFAULT 'never_pushed' NOT NULL;--> statement-breakpoint
ALTER TABLE `build_branches` ADD COLUMN IF NOT EXISTS `lastPushedCommit` varchar(160);--> statement-breakpoint
ALTER TABLE `build_branches` ADD COLUMN IF NOT EXISTS `lastPushError` longtext;--> statement-breakpoint
ALTER TABLE `build_targets` ADD COLUMN IF NOT EXISTS `agentEnvVarMapJson` varchar(4096) DEFAULT '{}' NOT NULL;
