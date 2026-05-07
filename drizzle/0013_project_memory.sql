CREATE TABLE `project_memory` (
  `id` int AUTO_INCREMENT NOT NULL,
  `ownerUserId` int NOT NULL,
  `buildTargetId` int NOT NULL,
  `key` varchar(160) NOT NULL,
  `value` longtext NOT NULL,
  `createdAt` bigint NOT NULL,
  `updatedAt` bigint NOT NULL,
  CONSTRAINT `project_memory_id` PRIMARY KEY(`id`),
  CONSTRAINT `project_memory_build_target_key_unique` UNIQUE(`buildTargetId`,`key`)
);
--> statement-breakpoint
CREATE INDEX `project_memory_owner_build_target_idx` ON `project_memory` (`ownerUserId`,`buildTargetId`);
--> statement-breakpoint
CREATE INDEX `project_memory_build_target_updated_idx` ON `project_memory` (`buildTargetId`,`updatedAt`);
