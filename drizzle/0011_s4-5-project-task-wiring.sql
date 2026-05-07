ALTER TABLE `tasks` ADD `buildTargetId` int;
ALTER TABLE `tasks` ADD INDEX `tasks_owner_build_target_idx` (`ownerUserId`, `buildTargetId`);
ALTER TABLE `task_global_file_links` ADD `source` enum('root_default','project','manual') NOT NULL DEFAULT 'manual';
