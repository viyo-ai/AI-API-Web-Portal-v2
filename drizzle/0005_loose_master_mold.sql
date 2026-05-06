ALTER TABLE `build_branches` RENAME COLUMN `targetId` TO `buildTargetId`;--> statement-breakpoint
ALTER TABLE `build_branches` RENAME COLUMN `sourceBranch` TO `baseBranch`;--> statement-breakpoint
ALTER TABLE `build_branches` RENAME COLUMN `cloneStatus` TO `state`;--> statement-breakpoint
ALTER TABLE `build_branches` RENAME COLUMN `cloneError` TO `errorMessage`;--> statement-breakpoint
ALTER TABLE `build_branches` RENAME COLUMN `lastCommitSha` TO `lastSyncedCommit`;--> statement-breakpoint
ALTER TABLE `build_targets` RENAME COLUMN `defaultBranch` TO `defaultBaseBranch`;--> statement-breakpoint
ALTER TABLE `build_branches` DROP INDEX `build_branches_target_branch_unique`;--> statement-breakpoint
DROP INDEX `build_branches_owner_target_idx` ON `build_branches`;--> statement-breakpoint
ALTER TABLE `build_branches` MODIFY COLUMN `workspacePath` varchar(1024) NOT NULL;--> statement-breakpoint
ALTER TABLE `build_branches` MODIFY COLUMN `state` enum('clean','cloning','error') NOT NULL DEFAULT 'cloning';--> statement-breakpoint
ALTER TABLE `build_targets` MODIFY COLUMN `githubTokenEnvVar` varchar(120) NOT NULL;--> statement-breakpoint
ALTER TABLE `build_branches` ADD CONSTRAINT `build_branches_target_branch_unique` UNIQUE(`buildTargetId`,`branchName`);--> statement-breakpoint
CREATE INDEX `build_branches_owner_target_idx` ON `build_branches` (`ownerUserId`,`buildTargetId`);--> statement-breakpoint
ALTER TABLE `build_branches` DROP COLUMN `lastPushedAt`;