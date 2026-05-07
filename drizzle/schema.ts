import {
  bigint,
  boolean,
  index,
  int,
  longtext,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing the Manus OAuth flow.
 *
 * This table is intentionally preserved from the template so the existing auth
 * context can continue to provide ctx.user.id, ctx.user.openId, and ctx.user.role
 * to every protected v2 procedure.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const tasks = mysqlTable(
  "tasks",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerUserId: int("ownerUserId").notNull(),
    title: varchar("title", { length: 220 }).notNull(),
    summary: longtext("summary"),
    status: mysqlEnum("status", [
      "active",
      "waiting",
      "blocked",
      "completed",
      "archived",
      "error",
    ])
      .default("active")
      .notNull(),
    routeMode: mysqlEnum("routeMode", ["auto", "claude", "kimi", "dual"])
      .default("auto")
      .notNull(),
    buildBranchId: int("buildBranchId"),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
    lastActivityAt: bigint("lastActivityAt", { mode: "number" }).notNull(),
    archivedAt: bigint("archivedAt", { mode: "number" }),
  },
  table => ({
    ownerStatusIdx: index("tasks_owner_status_idx").on(
      table.ownerUserId,
      table.status
    ),
    ownerActivityIdx: index("tasks_owner_activity_idx").on(
      table.ownerUserId,
      table.lastActivityAt
    ),
    ownerBuildBranchIdx: index("tasks_owner_build_branch_idx").on(
      table.ownerUserId,
      table.buildBranchId
    ),
  })
);

export const taskEvents = mysqlTable(
  "task_events",
  {
    id: int("id").autoincrement().primaryKey(),
    taskId: int("taskId").notNull(),
    ownerUserId: int("ownerUserId").notNull(),
    actor: mysqlEnum("actor", [
      "user",
      "claude",
      "kimi",
      "wrapper",
      "system",
      "tool",
    ]).notNull(),
    eventType: mysqlEnum("eventType", [
      "message",
      "route_decision",
      "credential_status",
      "context_snapshot",
      "model_start",
      "model_delta",
      "model_result",
      "model_review",
      "file_event",
      "memory_event",
      "blocked",
      "error",
      "status",
    ])
      .default("message")
      .notNull(),
    status: mysqlEnum("status", [
      "queued",
      "running",
      "succeeded",
      "blocked",
      "failed",
      "informational",
    ])
      .default("informational")
      .notNull(),
    content: longtext("content").notNull(),
    metadataJson: longtext("metadataJson"),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  },
  table => ({
    taskCreatedIdx: index("task_events_task_created_idx").on(
      table.taskId,
      table.createdAt
    ),
    ownerCreatedIdx: index("task_events_owner_created_idx").on(
      table.ownerUserId,
      table.createdAt
    ),
  })
);

export const orchestrationTurns = mysqlTable(
  "orchestration_turns",
  {
    id: int("id").autoincrement().primaryKey(),
    taskId: int("taskId").notNull(),
    ownerUserId: int("ownerUserId").notNull(),
    route: mysqlEnum("route", ["auto", "claude", "kimi", "dual", "blocked"])
      .default("auto")
      .notNull(),
    state: mysqlEnum("state", [
      "received",
      "routing",
      "credential_check",
      "context_assembly",
      "model_calling",
      "model_review",
      "persisting_output",
      "completed",
      "blocked",
      "failed",
      "stopped",
    ])
      .default("received")
      .notNull(),
    credentialStateJson: longtext("credentialStateJson"),
    startedAt: bigint("startedAt", { mode: "number" }).notNull(),
    completedAt: bigint("completedAt", { mode: "number" }),
    errorCode: varchar("errorCode", { length: 96 }),
    errorMessage: longtext("errorMessage"),
  },
  table => ({
    taskStateIdx: index("orchestration_turns_task_state_idx").on(
      table.taskId,
      table.state
    ),
    ownerStartedIdx: index("orchestration_turns_owner_started_idx").on(
      table.ownerUserId,
      table.startedAt
    ),
  })
);

export const globalMemory = mysqlTable(
  "global_memory",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerUserId: int("ownerUserId").notNull(),
    category: mysqlEnum("category", [
      "decision",
      "feature",
      "research",
      "past_task",
    ]).notNull(),
    title: varchar("title", { length: 220 }).notNull(),
    content: longtext("content").notNull(),
    sourceTaskId: int("sourceTaskId"),
    confidence: mysqlEnum("confidence", ["low", "medium", "high", "verified"])
      .default("medium")
      .notNull(),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
  table => ({
    ownerCategoryIdx: index("global_memory_owner_category_idx").on(
      table.ownerUserId,
      table.category
    ),
    ownerUpdatedIdx: index("global_memory_owner_updated_idx").on(
      table.ownerUserId,
      table.updatedAt
    ),
  })
);

export const globalFiles = mysqlTable(
  "global_files",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerUserId: int("ownerUserId").notNull(),
    displayName: varchar("displayName", { length: 220 }).notNull(),
    relativePath: varchar("relativePath", { length: 1024 }).notNull(),
    storageKey: text("storageKey").notNull(),
    storageUrl: text("storageUrl").notNull(),
    mimeType: varchar("mimeType", { length: 160 }),
    sizeBytes: bigint("sizeBytes", { mode: "number" }).default(0).notNull(),
    source: mysqlEnum("source", ["upload", "manual", "task_snapshot"])
      .default("upload")
      .notNull(),
    tagsJson: longtext("tagsJson"),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
  table => ({
    ownerPathIdx: index("global_files_owner_path_idx").on(
      table.ownerUserId,
      table.relativePath
    ),
    ownerUpdatedIdx: index("global_files_owner_updated_idx").on(
      table.ownerUserId,
      table.updatedAt
    ),
  })
);

export const taskGlobalFileLinks = mysqlTable(
  "task_global_file_links",
  {
    id: int("id").autoincrement().primaryKey(),
    taskId: int("taskId").notNull(),
    globalFileId: int("globalFileId").notNull(),
    ownerUserId: int("ownerUserId").notNull(),
    attachedLabel: varchar("attachedLabel", { length: 220 }),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
  table => ({
    taskFileUnique: uniqueIndex("task_global_file_links_task_file_unique").on(
      table.taskId,
      table.globalFileId
    ),
    ownerTaskIdx: index("task_global_file_links_owner_task_idx").on(
      table.ownerUserId,
      table.taskId
    ),
    ownerFileIdx: index("task_global_file_links_owner_file_idx").on(
      table.ownerUserId,
      table.globalFileId
    ),
  })
);

export const buildTargets = mysqlTable(
  "build_targets",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerUserId: int("ownerUserId").notNull(),
    name: varchar("name", { length: 220 }).notNull(),
    repoUrl: varchar("repoUrl", { length: 1024 }).notNull(),
    githubTokenEnvVar: varchar("githubTokenEnvVar", { length: 120 }).notNull(),
    defaultBaseBranch: varchar("defaultBaseBranch", { length: 160 })
      .default("main")
      .notNull(),
    protectedBranchesJson: longtext("protectedBranchesJson").notNull(),
    validationCommandsJson: longtext("validationCommandsJson").notNull(),
    serviceChecksJson: longtext("serviceChecksJson").notNull(),
    agentEnvVarMapJson: varchar("agentEnvVarMapJson", { length: 4096 })
      .default("{}")
      .notNull(),
    governanceFilesJson: longtext("governanceFilesJson"),
    governanceBudgetEnforced: boolean("governanceBudgetEnforced")
      .default(true)
      .notNull(),
    status: mysqlEnum("status", ["active", "archived"])
      .default("active")
      .notNull(),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
  table => ({
    ownerStatusIdx: index("build_targets_owner_status_idx").on(
      table.ownerUserId,
      table.status
    ),
    ownerRepoIdx: index("build_targets_owner_repo_idx").on(
      table.ownerUserId,
      table.repoUrl
    ),
  })
);

export const wizardSessions = mysqlTable(
  "wizard_sessions",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerUserId: int("ownerUserId").notNull(),
    repoUrl: varchar("repoUrl", { length: 1024 }).notNull(),
    commitSha: varchar("commitSha", { length: 80 }).notNull(),
    status: mysqlEnum("status", ["cached", "failed"])
      .default("cached")
      .notNull(),
    recommendationJson: longtext("recommendationJson").notNull(),
    repoContextJson: longtext("repoContextJson"),
    errorMessage: longtext("errorMessage"),
    expiresAt: bigint("expiresAt", { mode: "number" }).notNull(),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
  table => ({
    ownerRepoCommitUnique: uniqueIndex(
      "wizard_sessions_owner_repo_commit_unique"
    ).on(table.ownerUserId, table.repoUrl, table.commitSha),
    ownerExpiresIdx: index("wizard_sessions_owner_expires_idx").on(
      table.ownerUserId,
      table.expiresAt
    ),
  })
);

export const buildBranches = mysqlTable(
  "build_branches",
  {
    id: int("id").autoincrement().primaryKey(),
    buildTargetId: int("buildTargetId").notNull(),
    ownerUserId: int("ownerUserId").notNull(),
    branchName: varchar("branchName", { length: 220 }).notNull(),
    baseBranch: varchar("baseBranch", { length: 160 })
      .default("main")
      .notNull(),
    taskId: int("taskId"),
    state: mysqlEnum("state", ["clean", "cloning", "error"])
      .default("cloning")
      .notNull(),
    errorMessage: longtext("errorMessage"),
    lastSyncedCommit: varchar("lastSyncedCommit", { length: 80 }),
    pushState: varchar("pushState", { length: 32 })
      .default("never_pushed")
      .notNull(),
    lastPushedCommit: varchar("lastPushedCommit", { length: 160 }),
    lastPushError: longtext("lastPushError"),
    workspacePath: varchar("workspacePath", { length: 1024 }).notNull(),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
  table => ({
    targetBranchUnique: uniqueIndex("build_branches_target_branch_unique").on(
      table.buildTargetId,
      table.branchName
    ),
    ownerTargetIdx: index("build_branches_owner_target_idx").on(
      table.ownerUserId,
      table.buildTargetId
    ),
    ownerTaskIdx: index("build_branches_owner_task_idx").on(
      table.ownerUserId,
      table.taskId
    ),
  })
);

export const taskFiles = mysqlTable(
  "task_files",
  {
    id: int("id").autoincrement().primaryKey(),
    taskId: int("taskId").notNull(),
    ownerUserId: int("ownerUserId").notNull(),
    relativePath: varchar("relativePath", { length: 1024 }).notNull(),
    storageKey: text("storageKey").notNull(),
    storageUrl: text("storageUrl").notNull(),
    mimeType: varchar("mimeType", { length: 160 }),
    sizeBytes: bigint("sizeBytes", { mode: "number" }).default(0).notNull(),
    version: int("version").default(1).notNull(),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
  table => ({
    taskPathUnique: uniqueIndex("task_files_task_path_version_unique").on(
      table.taskId,
      table.relativePath,
      table.version
    ),
    taskPathIdx: index("task_files_task_path_idx").on(
      table.taskId,
      table.relativePath
    ),
    ownerUpdatedIdx: index("task_files_owner_updated_idx").on(
      table.ownerUserId,
      table.updatedAt
    ),
  })
);

export const skills = mysqlTable(
  "skills",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerUserId: int("ownerUserId").notNull(),
    slug: varchar("slug", { length: 160 }).notNull(),
    name: varchar("name", { length: 220 }).notNull(),
    scope: mysqlEnum("scope", [
      "global",
      "task-type",
      "file-pattern",
      "manual-only",
    ])
      .default("manual-only")
      .notNull(),
    content: longtext("content").notNull(),
    taskTypesJson: longtext("taskTypesJson"),
    filePatternsJson: longtext("filePatternsJson"),
    enabled: boolean("enabled").default(true).notNull(),
    version: varchar("version", { length: 40 }).default("1.0.0").notNull(),
    description: text("description"),
    source: mysqlEnum("source", [
      "created",
      "uploaded",
      "official",
      "github_imported",
      "ai_built",
    ])
      .default("created")
      .notNull(),
    sourceMetadataJson: longtext("sourceMetadataJson"),
    isOfficial: boolean("isOfficial").default(false).notNull(),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
  table => ({
    ownerSlugUnique: uniqueIndex("skills_owner_slug_unique").on(
      table.ownerUserId,
      table.slug
    ),
    ownerEnabledIdx: index("skills_owner_enabled_idx").on(
      table.ownerUserId,
      table.enabled
    ),
    officialIdx: index("skills_official_idx").on(
      table.isOfficial,
      table.enabled
    ),
  })
);

export const taskSkillSelections = mysqlTable(
  "task_skill_selections",
  {
    id: int("id").autoincrement().primaryKey(),
    taskId: int("taskId").notNull(),
    ownerUserId: int("ownerUserId").notNull(),
    skillId: int("skillId").notNull(),
    state: mysqlEnum("state", ["picked", "removed"])
      .default("picked")
      .notNull(),
    reason: varchar("reason", { length: 160 }),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
  table => ({
    taskSkillUnique: uniqueIndex("task_skill_selections_task_skill_unique").on(
      table.taskId,
      table.skillId
    ),
    ownerTaskIdx: index("task_skill_selections_owner_task_idx").on(
      table.ownerUserId,
      table.taskId
    ),
  })
);

export const taskMessageQueue = mysqlTable(
  "task_message_queue",
  {
    id: int("id").autoincrement().primaryKey(),
    taskId: int("taskId").notNull(),
    ownerUserId: int("ownerUserId").notNull(),
    content: longtext("content").notNull(),
    attachmentsJson: longtext("attachmentsJson"),
    state: mysqlEnum("state", ["queued", "processing", "sent", "cleared"])
      .default("queued")
      .notNull(),
    position: int("position").notNull(),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
    processedAt: bigint("processedAt", { mode: "number" }),
  },
  table => ({
    taskOwnerStatePositionIdx: index(
      "task_message_queue_task_owner_state_position_idx"
    ).on(table.taskId, table.ownerUserId, table.state, table.position),
  })
);
export const credentialStatusSnapshots = mysqlTable(
  "credential_status_snapshots",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerUserId: int("ownerUserId").notNull(),
    provider: mysqlEnum("provider", ["claude", "kimi"]).notNull(),
    status: mysqlEnum("status", [
      "configured",
      "missing",
      "invalid",
      "untested",
      "error",
    ])
      .default("untested")
      .notNull(),
    checkedAt: bigint("checkedAt", { mode: "number" }).notNull(),
    lastErrorCode: varchar("lastErrorCode", { length: 120 }),
    lastErrorMessage: longtext("lastErrorMessage"),
  },
  table => ({
    ownerProviderCheckedIdx: index(
      "credential_status_owner_provider_checked_idx"
    ).on(table.ownerUserId, table.provider, table.checkedAt),
  })
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;
export type TaskEvent = typeof taskEvents.$inferSelect;
export type InsertTaskEvent = typeof taskEvents.$inferInsert;
export type OrchestrationTurn = typeof orchestrationTurns.$inferSelect;
export type InsertOrchestrationTurn = typeof orchestrationTurns.$inferInsert;
export type GlobalMemory = typeof globalMemory.$inferSelect;
export type InsertGlobalMemory = typeof globalMemory.$inferInsert;
export type GlobalFile = typeof globalFiles.$inferSelect;
export type InsertGlobalFile = typeof globalFiles.$inferInsert;
export type TaskGlobalFileLink = typeof taskGlobalFileLinks.$inferSelect;
export type InsertTaskGlobalFileLink = typeof taskGlobalFileLinks.$inferInsert;
export type BuildTarget = typeof buildTargets.$inferSelect;
export type InsertBuildTarget = typeof buildTargets.$inferInsert;
export type WizardSession = typeof wizardSessions.$inferSelect;
export type InsertWizardSession = typeof wizardSessions.$inferInsert;
export type BuildBranch = typeof buildBranches.$inferSelect;
export type InsertBuildBranch = typeof buildBranches.$inferInsert;
export type TaskFile = typeof taskFiles.$inferSelect;
export type InsertTaskFile = typeof taskFiles.$inferInsert;
export type CredentialStatusSnapshot =
  typeof credentialStatusSnapshots.$inferSelect;
export type InsertCredentialStatusSnapshot =
  typeof credentialStatusSnapshots.$inferInsert;
export type Skill = typeof skills.$inferSelect;
export type InsertSkill = typeof skills.$inferInsert;
export type TaskSkillSelection = typeof taskSkillSelections.$inferSelect;
export type InsertTaskSkillSelection = typeof taskSkillSelections.$inferInsert;
export type TaskMessageQueueItem = typeof taskMessageQueue.$inferSelect;
export type InsertTaskMessageQueueItem = typeof taskMessageQueue.$inferInsert;
