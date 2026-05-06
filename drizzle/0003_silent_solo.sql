CREATE TABLE `global_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`displayName` varchar(220) NOT NULL,
	`relativePath` varchar(1024) NOT NULL,
	`storageKey` text NOT NULL,
	`storageUrl` text NOT NULL,
	`mimeType` varchar(160),
	`sizeBytes` bigint NOT NULL DEFAULT 0,
	`source` enum('upload','manual','task_snapshot') NOT NULL DEFAULT 'upload',
	`tagsJson` longtext,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `global_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `task_global_file_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`globalFileId` int NOT NULL,
	`ownerUserId` int NOT NULL,
	`attachedLabel` varchar(220),
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `task_global_file_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `task_global_file_links_task_file_unique` UNIQUE(`taskId`,`globalFileId`)
);
--> statement-breakpoint
CREATE INDEX `global_files_owner_path_idx` ON `global_files` (`ownerUserId`,`relativePath`);--> statement-breakpoint
CREATE INDEX `global_files_owner_updated_idx` ON `global_files` (`ownerUserId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `task_global_file_links_owner_task_idx` ON `task_global_file_links` (`ownerUserId`,`taskId`);--> statement-breakpoint
CREATE INDEX `task_global_file_links_owner_file_idx` ON `task_global_file_links` (`ownerUserId`,`globalFileId`);