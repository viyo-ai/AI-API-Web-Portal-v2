CREATE TABLE `user_preferences` (
  `id` int AUTO_INCREMENT NOT NULL,
  `ownerUserId` int NOT NULL,
  `alwaysRequireKimiApproval` boolean NOT NULL DEFAULT true,
  `createdAt` bigint NOT NULL,
  `updatedAt` bigint NOT NULL,
  CONSTRAINT `user_preferences_id` PRIMARY KEY(`id`),
  CONSTRAINT `user_preferences_owner_unique_idx` UNIQUE(`ownerUserId`)
);

ALTER TABLE `orchestration_turns`
  MODIFY COLUMN `state` enum('received','routing','credential_check','context_assembly','model_calling','awaiting_approval','model_review','persisting_output','completed','blocked','failed','stopped') NOT NULL DEFAULT 'received';

ALTER TABLE `orchestration_turns`
  ADD COLUMN `approvalStatus` enum('not_required','awaiting_owner','approved','revision_requested','cancelled') NOT NULL DEFAULT 'not_required' AFTER `credentialStateJson`,
  ADD COLUMN `approvalPlanContent` longtext AFTER `approvalStatus`,
  ADD COLUMN `approvalDecisionMessage` longtext AFTER `approvalPlanContent`,
  ADD COLUMN `approvalRequestedAt` bigint AFTER `approvalDecisionMessage`,
  ADD COLUMN `approvalResolvedAt` bigint AFTER `approvalRequestedAt`;
