CREATE TABLE `build_branches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`targetId` int NOT NULL,
	`ownerUserId` int NOT NULL,
	`branchName` varchar(220) NOT NULL,
	`sourceBranch` varchar(160) NOT NULL DEFAULT 'main',
	`taskId` int,
	`workspacePath` varchar(1024),
	`cloneStatus` enum('pending','ready','failed') NOT NULL DEFAULT 'pending',
	`cloneError` longtext,
	`lastCommitSha` varchar(80),
	`lastPushedAt` bigint,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `build_branches_id` PRIMARY KEY(`id`),
	CONSTRAINT `build_branches_target_branch_unique` UNIQUE(`targetId`,`branchName`)
);
--> statement-breakpoint
CREATE TABLE `build_targets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`name` varchar(220) NOT NULL,
	`repoUrl` varchar(1024) NOT NULL,
	`defaultBranch` varchar(160) NOT NULL DEFAULT 'main',
	`protectedBranchesJson` longtext NOT NULL,
	`validationCommandsJson` longtext NOT NULL,
	`serviceChecksJson` longtext NOT NULL,
	`githubTokenEnvVar` varchar(120) NOT NULL DEFAULT 'GITHUB_TOKEN',
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `build_targets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `tasks` ADD `buildBranchId` int;--> statement-breakpoint
CREATE INDEX `build_branches_owner_target_idx` ON `build_branches` (`ownerUserId`,`targetId`);--> statement-breakpoint
CREATE INDEX `build_branches_owner_task_idx` ON `build_branches` (`ownerUserId`,`taskId`);--> statement-breakpoint
CREATE INDEX `build_targets_owner_status_idx` ON `build_targets` (`ownerUserId`,`status`);--> statement-breakpoint
CREATE INDEX `build_targets_owner_repo_idx` ON `build_targets` (`ownerUserId`,`repoUrl`);--> statement-breakpoint
CREATE INDEX `tasks_owner_build_branch_idx` ON `tasks` (`ownerUserId`,`buildBranchId`);