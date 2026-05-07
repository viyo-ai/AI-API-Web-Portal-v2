CREATE TABLE `wizard_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`repoUrl` varchar(1024) NOT NULL,
	`commitSha` varchar(80) NOT NULL,
	`status` enum('cached','failed') NOT NULL DEFAULT 'cached',
	`recommendationJson` longtext NOT NULL,
	`repoContextJson` longtext,
	`errorMessage` longtext,
	`expiresAt` bigint NOT NULL,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `wizard_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `wizard_sessions_owner_repo_commit_unique` UNIQUE(`ownerUserId`,`repoUrl`,`commitSha`)
);
--> statement-breakpoint
CREATE INDEX `wizard_sessions_owner_expires_idx` ON `wizard_sessions` (`ownerUserId`,`expiresAt`);