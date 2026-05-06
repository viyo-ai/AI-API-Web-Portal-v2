CREATE TABLE `task_message_queue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`ownerUserId` int NOT NULL,
	`content` longtext NOT NULL,
	`attachmentsJson` longtext,
	`state` enum('queued','processing','sent','cleared') NOT NULL DEFAULT 'queued',
	`position` int NOT NULL,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	`processedAt` bigint,
	CONSTRAINT `task_message_queue_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `orchestration_turns` MODIFY COLUMN `state` enum('received','routing','credential_check','context_assembly','model_calling','model_review','persisting_output','completed','blocked','failed','stopped') NOT NULL DEFAULT 'received';--> statement-breakpoint
CREATE INDEX `task_message_queue_task_owner_state_position_idx` ON `task_message_queue` (`taskId`,`ownerUserId`,`state`,`position`);