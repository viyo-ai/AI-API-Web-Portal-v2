CREATE TABLE `credential_status_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`provider` enum('claude','kimi') NOT NULL,
	`status` enum('configured','missing','invalid','untested','error') NOT NULL DEFAULT 'untested',
	`checkedAt` bigint NOT NULL,
	`lastErrorCode` varchar(120),
	`lastErrorMessage` longtext,
	CONSTRAINT `credential_status_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `global_memory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`category` enum('decision','feature','research','past_task') NOT NULL,
	`title` varchar(220) NOT NULL,
	`content` longtext NOT NULL,
	`sourceTaskId` int,
	`confidence` enum('low','medium','high','verified') NOT NULL DEFAULT 'medium',
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `global_memory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orchestration_turns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`ownerUserId` int NOT NULL,
	`route` enum('auto','claude','kimi','dual','blocked') NOT NULL DEFAULT 'auto',
	`state` enum('received','routing','credential_check','context_assembly','model_calling','model_review','persisting_output','completed','blocked','failed') NOT NULL DEFAULT 'received',
	`credentialStateJson` longtext,
	`startedAt` bigint NOT NULL,
	`completedAt` bigint,
	`errorCode` varchar(96),
	`errorMessage` longtext,
	CONSTRAINT `orchestration_turns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `task_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`ownerUserId` int NOT NULL,
	`actor` enum('user','claude','kimi','wrapper','system','tool') NOT NULL,
	`eventType` enum('message','route_decision','credential_status','context_snapshot','model_start','model_delta','model_result','model_review','file_event','memory_event','blocked','error','status') NOT NULL DEFAULT 'message',
	`status` enum('queued','running','succeeded','blocked','failed','informational') NOT NULL DEFAULT 'informational',
	`content` longtext NOT NULL,
	`metadataJson` longtext,
	`createdAt` bigint NOT NULL,
	CONSTRAINT `task_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `task_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`ownerUserId` int NOT NULL,
	`relativePath` varchar(1024) NOT NULL,
	`storageKey` text NOT NULL,
	`storageUrl` text NOT NULL,
	`mimeType` varchar(160),
	`sizeBytes` bigint NOT NULL DEFAULT 0,
	`version` int NOT NULL DEFAULT 1,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `task_files_id` PRIMARY KEY(`id`),
	CONSTRAINT `task_files_task_path_version_unique` UNIQUE(`taskId`,`relativePath`,`version`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`title` varchar(220) NOT NULL,
	`summary` longtext,
	`status` enum('active','waiting','blocked','completed','archived','error') NOT NULL DEFAULT 'active',
	`routeMode` enum('auto','claude','kimi','dual') NOT NULL DEFAULT 'auto',
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	`lastActivityAt` bigint NOT NULL,
	`archivedAt` bigint,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `credential_status_owner_provider_checked_idx` ON `credential_status_snapshots` (`ownerUserId`,`provider`,`checkedAt`);--> statement-breakpoint
CREATE INDEX `global_memory_owner_category_idx` ON `global_memory` (`ownerUserId`,`category`);--> statement-breakpoint
CREATE INDEX `global_memory_owner_updated_idx` ON `global_memory` (`ownerUserId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `orchestration_turns_task_state_idx` ON `orchestration_turns` (`taskId`,`state`);--> statement-breakpoint
CREATE INDEX `orchestration_turns_owner_started_idx` ON `orchestration_turns` (`ownerUserId`,`startedAt`);--> statement-breakpoint
CREATE INDEX `task_events_task_created_idx` ON `task_events` (`taskId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `task_events_owner_created_idx` ON `task_events` (`ownerUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `task_files_task_path_idx` ON `task_files` (`taskId`,`relativePath`);--> statement-breakpoint
CREATE INDEX `task_files_owner_updated_idx` ON `task_files` (`ownerUserId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `tasks_owner_status_idx` ON `tasks` (`ownerUserId`,`status`);--> statement-breakpoint
CREATE INDEX `tasks_owner_activity_idx` ON `tasks` (`ownerUserId`,`lastActivityAt`);