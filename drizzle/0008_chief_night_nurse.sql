ALTER TABLE `build_targets` ADD `governanceFilesJson` longtext;--> statement-breakpoint
ALTER TABLE `build_targets` ADD `governanceBudgetEnforced` boolean DEFAULT true NOT NULL;