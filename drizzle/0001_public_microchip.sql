CREATE TABLE `commandAuditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`ownerUserId` int NOT NULL,
	`terminalSessionId` int,
	`proposalId` int,
	`command` longtext NOT NULL,
	`outputSummary` longtext,
	`riskLevel` enum('safe','caution','dangerous') NOT NULL DEFAULT 'caution',
	`approvalStatus` enum('not_required','pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`executionStatus` enum('queued','running','success','warning','error','cancelled') NOT NULL DEFAULT 'queued',
	`exitCode` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `commandAuditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `commandProposals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`ownerUserId` int NOT NULL,
	`terminalSessionId` int,
	`intent` longtext NOT NULL,
	`proposedCommand` longtext NOT NULL,
	`explanation` longtext NOT NULL,
	`riskLevel` enum('safe','caution','dangerous') NOT NULL DEFAULT 'caution',
	`provider` enum('local','opencode','claude','kimi','cloudflare','manus_llm') NOT NULL DEFAULT 'local',
	`status` enum('pending','approved','rejected','executed','failed') NOT NULL DEFAULT 'pending',
	`approvedAt` timestamp,
	`executedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `commandProposals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fileSnapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`ownerUserId` int NOT NULL,
	`relativePath` varchar(1024) NOT NULL,
	`storageKey` text NOT NULL,
	`storageUrl` text NOT NULL,
	`action` enum('upload','create','update','rename','delete','download','snapshot') NOT NULL DEFAULT 'snapshot',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fileSnapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ownerAlerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`ownerUserId` int NOT NULL,
	`title` varchar(220) NOT NULL,
	`content` longtext NOT NULL,
	`severity` enum('info','success','warning','error') NOT NULL DEFAULT 'info',
	`status` enum('queued','delivered','failed','read') NOT NULL DEFAULT 'queued',
	`deliveredAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ownerAlerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `taskMemories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`ownerUserId` int NOT NULL,
	`memoryType` enum('convention','decision','task','known_error','recovery','note') NOT NULL DEFAULT 'note',
	`title` varchar(220) NOT NULL,
	`content` longtext NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `taskMemories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `terminalSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`ownerUserId` int NOT NULL,
	`sessionKey` varchar(128) NOT NULL,
	`tmuxSessionName` varchar(128) NOT NULL,
	`cwd` text NOT NULL,
	`status` enum('starting','active','detached','stopped','error') NOT NULL DEFAULT 'starting',
	`lastOutputSummary` longtext,
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `terminalSessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `terminalSessions_sessionKey_unique` UNIQUE(`sessionKey`)
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`slug` varchar(96) NOT NULL,
	`name` varchar(160) NOT NULL,
	`rootPath` text NOT NULL,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workspaces_id` PRIMARY KEY(`id`),
	CONSTRAINT `workspaces_slug_unique` UNIQUE(`slug`)
);
