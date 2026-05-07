CREATE TABLE `skills` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`slug` varchar(160) NOT NULL,
	`name` varchar(220) NOT NULL,
	`scope` enum('global','task-type','file-pattern','manual-only') NOT NULL DEFAULT 'manual-only',
	`content` longtext NOT NULL,
	`taskTypesJson` longtext,
	`filePatternsJson` longtext,
	`enabled` boolean NOT NULL DEFAULT true,
	`version` varchar(40) NOT NULL DEFAULT '1.0.0',
	`description` text,
	`source` enum('created','uploaded','official','github_imported','ai_built') NOT NULL DEFAULT 'created',
	`sourceMetadataJson` longtext,
	`isOfficial` boolean NOT NULL DEFAULT false,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `skills_id` PRIMARY KEY(`id`),
	CONSTRAINT `skills_owner_slug_unique` UNIQUE(`ownerUserId`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `task_skill_selections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`ownerUserId` int NOT NULL,
	`skillId` int NOT NULL,
	`state` enum('picked','removed') NOT NULL DEFAULT 'picked',
	`reason` varchar(160),
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `task_skill_selections_id` PRIMARY KEY(`id`),
	CONSTRAINT `task_skill_selections_task_skill_unique` UNIQUE(`taskId`,`skillId`)
);
--> statement-breakpoint
CREATE INDEX `skills_owner_enabled_idx` ON `skills` (`ownerUserId`,`enabled`);--> statement-breakpoint
CREATE INDEX `skills_official_idx` ON `skills` (`isOfficial`,`enabled`);--> statement-breakpoint
CREATE INDEX `task_skill_selections_owner_task_idx` ON `task_skill_selections` (`ownerUserId`,`taskId`);