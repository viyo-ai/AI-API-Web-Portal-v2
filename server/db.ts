import { and, desc, eq, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  buildBranches,
  buildTargets,
  wizardSessions,
  credentialStatusSnapshots,
  globalMemory,
  globalFiles,
  InsertBuildBranch,
  InsertBuildTarget,
  InsertWizardSession,
  InsertCredentialStatusSnapshot,
  InsertGlobalMemory,
  InsertGlobalFile,
  InsertTaskGlobalFileLink,
  InsertOrchestrationTurn,
  InsertTask,
  InsertTaskEvent,
  InsertTaskFile,
  InsertTaskMessageQueueItem,
  InsertUser,
  InsertSkill,
  Skill,
  Task,
  WizardSession,
  TaskSkillSelection,
  orchestrationTurns,
  skills,
  taskEvents,
  taskFiles,
  taskGlobalFileLinks,
  taskMessageQueue,
  taskSkillSelections,
  tasks,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import {
  normalizeGovernanceFiles,
  parseGovernanceFiles,
  type GovernanceFileConfig,
} from "./buildRunner/loadGovernance";

let _db: ReturnType<typeof drizzle> | null = null;

export type TaskStatus =
  | "active"
  | "waiting"
  | "blocked"
  | "completed"
  | "archived"
  | "error";
export type RouteMode = "auto" | "claude" | "kimi" | "dual";
export type TurnRoute = "auto" | "claude" | "kimi" | "dual" | "blocked";
export type TurnState =
  | "received"
  | "routing"
  | "credential_check"
  | "context_assembly"
  | "model_calling"
  | "model_review"
  | "persisting_output"
  | "completed"
  | "blocked"
  | "failed"
  | "stopped";
export type MemoryCategory = "decision" | "feature" | "research" | "past_task";
export type CredentialProvider = "claude" | "kimi";
export type CredentialStatus =
  | "configured"
  | "missing"
  | "invalid"
  | "untested"
  | "error";
export type BuildTargetStatus = "active" | "archived";
export type BuildBranchState = "clean" | "cloning" | "error";
export type BuildBranchPushState =
  | "never_pushed"
  | "pushing"
  | "pushed"
  | "blocked"
  | "error";
export type WizardSessionStatus = "cached" | "failed";
export type AgentEnvVarMap = Record<string, string>;
export type { GovernanceFileConfig } from "./buildRunner/loadGovernance";
export type QueuedMessageState = "queued" | "processing" | "sent" | "cleared";
export const MAX_QUEUED_MESSAGES_PER_TASK = 5;

export function nowMs() {
  return Date.now();
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const values: InsertUser = {
    openId: user.openId,
  };
  const updateSet: Record<string, unknown> = {};

  const assignNullable = (field: "name" | "email" | "loginMethod") => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };

  assignNullable("name");
  assignNullable("email");
  assignNullable("loginMethod");

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) {
    values.lastSignedIn = new Date();
  }

  if (Object.keys(updateSet).length === 0) {
    updateSet.lastSignedIn = new Date();
  }

  await db
    .insert(users)
    .values(values)
    .onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result[0];
}

export function sanitizeTaskTitle(input: string) {
  const normalized = input.replace(/\s+/g, " ").trim();
  if (!normalized) return "Untitled task";
  return normalized.slice(0, 220);
}

export function assertSafeRelativePath(relativePath: string) {
  const value = relativePath.trim().replace(/\\/g, "/");

  if (!value) {
    throw new Error("File path is required");
  }
  if (value.startsWith("/") || value.includes("..") || value.includes("//")) {
    throw new Error("Unsafe file path");
  }
  if (value.length > 1024) {
    throw new Error("File path is too long");
  }

  return value;
}

export async function createTask(values: {
  ownerUserId: number;
  title: string;
  summary?: string | null;
  routeMode?: RouteMode;
  buildBranchId?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for tasks");

  const timestamp = nowMs();
  const insertValues: InsertTask = {
    ownerUserId: values.ownerUserId,
    title: sanitizeTaskTitle(values.title),
    summary: values.summary ?? null,
    routeMode: values.routeMode ?? "auto",
    buildBranchId: values.buildBranchId ?? null,
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
    lastActivityAt: timestamp,
  };

  await db.insert(tasks).values(insertValues);
  const created = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.ownerUserId, values.ownerUserId),
        eq(tasks.createdAt, timestamp)
      )
    )
    .orderBy(desc(tasks.id))
    .limit(1);

  if (!created[0]) throw new Error("Failed to create task");
  return created[0];
}

export async function listTasksForOwner(
  ownerUserId: number,
  includeArchived = false,
  limit = 50
) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for tasks");

  const where = includeArchived
    ? eq(tasks.ownerUserId, ownerUserId)
    : and(
        eq(tasks.ownerUserId, ownerUserId),
        or(
          eq(tasks.status, "active"),
          eq(tasks.status, "waiting"),
          eq(tasks.status, "blocked"),
          eq(tasks.status, "completed"),
          eq(tasks.status, "error")
        )
      );

  return db
    .select()
    .from(tasks)
    .where(where)
    .orderBy(desc(tasks.lastActivityAt))
    .limit(limit);
}

export async function getTaskForOwner(taskId: number, ownerUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for tasks");

  const result = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.ownerUserId, ownerUserId)))
    .limit(1);
  return result[0];
}

export async function touchTask(taskId: number, ownerUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for tasks");

  const timestamp = nowMs();
  await db
    .update(tasks)
    .set({ updatedAt: timestamp, lastActivityAt: timestamp })
    .where(and(eq(tasks.id, taskId), eq(tasks.ownerUserId, ownerUserId)));
}

export async function updateTaskStatus(
  taskId: number,
  ownerUserId: number,
  status: TaskStatus
) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for tasks");

  const timestamp = nowMs();
  await db
    .update(tasks)
    .set({
      status,
      updatedAt: timestamp,
      lastActivityAt: timestamp,
      archivedAt: status === "archived" ? timestamp : null,
    })
    .where(and(eq(tasks.id, taskId), eq(tasks.ownerUserId, ownerUserId)));
}

export async function renameTask(
  taskId: number,
  ownerUserId: number,
  title: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for tasks");

  const timestamp = nowMs();
  await db
    .update(tasks)
    .set({
      title: sanitizeTaskTitle(title),
      updatedAt: timestamp,
      lastActivityAt: timestamp,
    })
    .where(and(eq(tasks.id, taskId), eq(tasks.ownerUserId, ownerUserId)));
}

export async function appendTaskEvent(
  values: Omit<InsertTaskEvent, "createdAt"> & { createdAt?: number }
) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for task events");

  const timestamp = values.createdAt ?? nowMs();
  await db.insert(taskEvents).values({ ...values, createdAt: timestamp });
  await touchTask(values.taskId, values.ownerUserId);

  const result = await db
    .select()
    .from(taskEvents)
    .where(
      and(
        eq(taskEvents.taskId, values.taskId),
        eq(taskEvents.ownerUserId, values.ownerUserId),
        eq(taskEvents.createdAt, timestamp)
      )
    )
    .orderBy(desc(taskEvents.id))
    .limit(1);

  if (!result[0]) throw new Error("Failed to append task event");
  return result[0];
}

export async function listTaskEvents(
  taskId: number,
  ownerUserId: number,
  limit = 100
) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for task events");

  return db
    .select()
    .from(taskEvents)
    .where(
      and(
        eq(taskEvents.taskId, taskId),
        eq(taskEvents.ownerUserId, ownerUserId)
      )
    )
    .orderBy(desc(taskEvents.createdAt))
    .limit(limit);
}

export async function getTaskThread(taskId: number, ownerUserId: number) {
  const task = await getTaskForOwner(taskId, ownerUserId);
  if (!task) return undefined;

  const events = (await listTaskEvents(taskId, ownerUserId, 200)).reverse();
  const activeTurns = await listTurnsForTask(taskId, ownerUserId, 1);
  const queuedMessages = await listQueuedMessages(taskId, ownerUserId);

  return {
    task,
    events,
    queuedMessages,
    activeTurn:
      activeTurns[0]?.state === "completed" ||
      activeTurns[0]?.state === "blocked" ||
      activeTurns[0]?.state === "failed" ||
      activeTurns[0]?.state === "stopped"
        ? null
        : (activeTurns[0] ?? null),
  };
}

export async function listQueuedMessages(
  taskId: number,
  ownerUserId: number,
  states: QueuedMessageState[] = ["queued"]
) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for queued messages");
  const stateFilters = states.map(state => eq(taskMessageQueue.state, state));
  return db
    .select()
    .from(taskMessageQueue)
    .where(
      and(
        eq(taskMessageQueue.taskId, taskId),
        eq(taskMessageQueue.ownerUserId, ownerUserId),
        or(...stateFilters)
      )
    )
    .orderBy(
      taskMessageQueue.position,
      taskMessageQueue.createdAt,
      taskMessageQueue.id
    )
    .limit(MAX_QUEUED_MESSAGES_PER_TASK);
}

export async function enqueueTaskMessage(values: {
  taskId: number;
  ownerUserId: number;
  content: string;
  attachmentsJson?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for queued messages");
  const content = values.content.trim();
  if (!content) throw new Error("Queued message content is required");
  const existing = await listQueuedMessages(values.taskId, values.ownerUserId);
  if (existing.length >= MAX_QUEUED_MESSAGES_PER_TASK)
    throw new Error(
      `Queue limit reached. A task can hold up to ${MAX_QUEUED_MESSAGES_PER_TASK} queued messages while generation is running.`
    );
  const timestamp = nowMs();
  const position =
    existing.reduce((max, item) => Math.max(max, item.position), 0) + 1;
  const insertValues: InsertTaskMessageQueueItem = {
    taskId: values.taskId,
    ownerUserId: values.ownerUserId,
    content,
    attachmentsJson: values.attachmentsJson ?? null,
    state: "queued",
    position,
    createdAt: timestamp,
    updatedAt: timestamp,
    processedAt: null,
  };
  await db.insert(taskMessageQueue).values(insertValues);
  await touchTask(values.taskId, values.ownerUserId);
  const result = await db
    .select()
    .from(taskMessageQueue)
    .where(
      and(
        eq(taskMessageQueue.taskId, values.taskId),
        eq(taskMessageQueue.ownerUserId, values.ownerUserId),
        eq(taskMessageQueue.createdAt, timestamp)
      )
    )
    .orderBy(desc(taskMessageQueue.id))
    .limit(1);
  if (!result[0]) throw new Error("Failed to queue composer message");
  return result[0];
}

export async function updateQueuedTaskMessage(values: {
  queueItemId: number;
  taskId: number;
  ownerUserId: number;
  content: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for queued messages");
  const content = values.content.trim();
  if (!content) throw new Error("Queued message content is required");
  await db
    .update(taskMessageQueue)
    .set({ content, updatedAt: nowMs() })
    .where(
      and(
        eq(taskMessageQueue.id, values.queueItemId),
        eq(taskMessageQueue.taskId, values.taskId),
        eq(taskMessageQueue.ownerUserId, values.ownerUserId),
        eq(taskMessageQueue.state, "queued")
      )
    );
  await touchTask(values.taskId, values.ownerUserId);
  return listQueuedMessages(values.taskId, values.ownerUserId);
}

export async function cancelQueuedTaskMessage(values: {
  queueItemId: number;
  taskId: number;
  ownerUserId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for queued messages");
  await db
    .update(taskMessageQueue)
    .set({ state: "cleared", updatedAt: nowMs() })
    .where(
      and(
        eq(taskMessageQueue.id, values.queueItemId),
        eq(taskMessageQueue.taskId, values.taskId),
        eq(taskMessageQueue.ownerUserId, values.ownerUserId),
        eq(taskMessageQueue.state, "queued")
      )
    );
  await touchTask(values.taskId, values.ownerUserId);
  return listQueuedMessages(values.taskId, values.ownerUserId);
}

export async function markQueuedMessagesProcessing(
  taskId: number,
  ownerUserId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for queued messages");
  const queued = await listQueuedMessages(taskId, ownerUserId);
  if (queued.length === 0) return [];
  const timestamp = nowMs();
  for (const item of queued)
    await db
      .update(taskMessageQueue)
      .set({
        state: "processing",
        updatedAt: timestamp,
        processedAt: timestamp,
      })
      .where(
        and(
          eq(taskMessageQueue.id, item.id),
          eq(taskMessageQueue.taskId, taskId),
          eq(taskMessageQueue.ownerUserId, ownerUserId),
          eq(taskMessageQueue.state, "queued")
        )
      );
  return queued;
}

export async function markQueuedMessagesSent(
  taskId: number,
  ownerUserId: number,
  queueItemIds: number[]
) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for queued messages");
  if (queueItemIds.length === 0) return;
  const timestamp = nowMs();
  for (const queueItemId of queueItemIds)
    await db
      .update(taskMessageQueue)
      .set({ state: "sent", updatedAt: timestamp, processedAt: timestamp })
      .where(
        and(
          eq(taskMessageQueue.id, queueItemId),
          eq(taskMessageQueue.taskId, taskId),
          eq(taskMessageQueue.ownerUserId, ownerUserId)
        )
      );
  await touchTask(taskId, ownerUserId);
}

export function formatQueuedMessagesForGeneration(
  queued: Array<{ position: number; content: string }>
) {
  const numbered = queued
    .map((item, index) => `${index + 1}. ${item.content.trim()}`)
    .join("\n");
  return [
    "Note: the following messages were queued during your previous response.",
    "Apply them as additional context. If any are now obsolete based on what",
    "you just produced, ask for clarification before acting on them.",
    "",
    numbered,
  ].join("\n");
}

export async function createTurn(
  values: Omit<InsertOrchestrationTurn, "startedAt"> & { startedAt?: number }
) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for orchestration turns");

  const timestamp = values.startedAt ?? nowMs();
  await db
    .insert(orchestrationTurns)
    .values({ ...values, startedAt: timestamp });
  const result = await db
    .select()
    .from(orchestrationTurns)
    .where(
      and(
        eq(orchestrationTurns.taskId, values.taskId),
        eq(orchestrationTurns.ownerUserId, values.ownerUserId),
        eq(orchestrationTurns.startedAt, timestamp)
      )
    )
    .orderBy(desc(orchestrationTurns.id))
    .limit(1);

  if (!result[0]) throw new Error("Failed to create orchestration turn");
  return result[0];
}

export async function listTurnsForTask(
  taskId: number,
  ownerUserId: number,
  limit = 20
) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for orchestration turns");

  return db
    .select()
    .from(orchestrationTurns)
    .where(
      and(
        eq(orchestrationTurns.taskId, taskId),
        eq(orchestrationTurns.ownerUserId, ownerUserId)
      )
    )
    .orderBy(desc(orchestrationTurns.startedAt))
    .limit(limit);
}

export async function updateTurnState(
  turnId: number,
  ownerUserId: number,
  state: TurnState,
  route?: TurnRoute,
  credentialStateJson?: string | null
) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for orchestration turns");

  await db
    .update(orchestrationTurns)
    .set({ state, route, credentialStateJson })
    .where(
      and(
        eq(orchestrationTurns.id, turnId),
        eq(orchestrationTurns.ownerUserId, ownerUserId)
      )
    );
}

export async function completeTurn(turnId: number, ownerUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for orchestration turns");

  await db
    .update(orchestrationTurns)
    .set({
      state: "completed",
      completedAt: nowMs(),
      errorCode: null,
      errorMessage: null,
    })
    .where(
      and(
        eq(orchestrationTurns.id, turnId),
        eq(orchestrationTurns.ownerUserId, ownerUserId)
      )
    );
}

export async function failTurn(
  turnId: number,
  ownerUserId: number,
  errorCode: string,
  errorMessage: string,
  state: "blocked" | "failed" = "failed"
) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for orchestration turns");

  await db
    .update(orchestrationTurns)
    .set({ state, completedAt: nowMs(), errorCode, errorMessage })
    .where(
      and(
        eq(orchestrationTurns.id, turnId),
        eq(orchestrationTurns.ownerUserId, ownerUserId)
      )
    );
}

export async function stopTurn(
  turnId: number,
  ownerUserId: number,
  marker = "(stopped)"
) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for orchestration turns");

  await db
    .update(orchestrationTurns)
    .set({
      state: "stopped",
      completedAt: nowMs(),
      errorCode: "GENERATION_STOPPED",
      errorMessage: marker,
    })
    .where(
      and(
        eq(orchestrationTurns.id, turnId),
        eq(orchestrationTurns.ownerUserId, ownerUserId)
      )
    );
}

export async function createMemory(values: {
  ownerUserId: number;
  category: MemoryCategory;
  title: string;
  content: string;
  sourceTaskId?: number | null;
  confidence?: "low" | "medium" | "high" | "verified";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for global memory");

  const timestamp = nowMs();
  const insertValues: InsertGlobalMemory = {
    ownerUserId: values.ownerUserId,
    category: values.category,
    title: values.title.trim().slice(0, 220),
    content: values.content.trim(),
    sourceTaskId: values.sourceTaskId ?? null,
    confidence: values.confidence ?? "medium",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await db.insert(globalMemory).values(insertValues);
  const result = await db
    .select()
    .from(globalMemory)
    .where(
      and(
        eq(globalMemory.ownerUserId, values.ownerUserId),
        eq(globalMemory.createdAt, timestamp)
      )
    )
    .orderBy(desc(globalMemory.id))
    .limit(1);

  if (!result[0]) throw new Error("Failed to create global memory");
  return result[0];
}

export async function listMemoryByCategory(
  ownerUserId: number,
  category?: MemoryCategory,
  limit = 50
) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for global memory");

  const where = category
    ? and(
        eq(globalMemory.ownerUserId, ownerUserId),
        eq(globalMemory.category, category)
      )
    : eq(globalMemory.ownerUserId, ownerUserId);
  return db
    .select()
    .from(globalMemory)
    .where(where)
    .orderBy(desc(globalMemory.updatedAt))
    .limit(limit);
}

export async function searchMemory(
  ownerUserId: number,
  query: string,
  limit = 30
) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for global memory");

  const normalized = query.trim();
  if (!normalized) return listMemoryByCategory(ownerUserId, undefined, limit);

  const pattern = `%${normalized.replace(/[%_]/g, "\\$&")}%`;
  return db
    .select()
    .from(globalMemory)
    .where(
      and(
        eq(globalMemory.ownerUserId, ownerUserId),
        or(
          like(globalMemory.title, pattern),
          like(globalMemory.content, pattern)
        )
      )
    )
    .orderBy(desc(globalMemory.updatedAt))
    .limit(limit);
}

export async function linkMemoryToTask(
  memoryId: number,
  ownerUserId: number,
  sourceTaskId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for global memory");

  await db
    .update(globalMemory)
    .set({ sourceTaskId, updatedAt: nowMs() })
    .where(
      and(
        eq(globalMemory.id, memoryId),
        eq(globalMemory.ownerUserId, ownerUserId)
      )
    );
}

export async function createTaskFile(
  values: Omit<InsertTaskFile, "relativePath" | "createdAt" | "updatedAt"> & {
    relativePath: string;
    createdAt?: number;
    updatedAt?: number;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for task files");

  const timestamp = values.createdAt ?? nowMs();
  const relativePath = assertSafeRelativePath(values.relativePath);
  await db
    .insert(taskFiles)
    .values({
      ...values,
      relativePath,
      createdAt: timestamp,
      updatedAt: values.updatedAt ?? timestamp,
    });

  const result = await db
    .select()
    .from(taskFiles)
    .where(
      and(
        eq(taskFiles.taskId, values.taskId),
        eq(taskFiles.ownerUserId, values.ownerUserId),
        eq(taskFiles.relativePath, relativePath)
      )
    )
    .orderBy(desc(taskFiles.version), desc(taskFiles.id))
    .limit(1);

  if (!result[0]) throw new Error("Failed to create task file metadata");
  await touchTask(values.taskId, values.ownerUserId);
  return result[0];
}

export async function createGlobalFile(
  values: Omit<
    InsertGlobalFile,
    "relativePath" | "displayName" | "createdAt" | "updatedAt"
  > & {
    relativePath: string;
    displayName?: string;
    createdAt?: number;
    updatedAt?: number;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for global files");

  const timestamp = values.createdAt ?? nowMs();
  const relativePath = assertSafeRelativePath(values.relativePath);
  const displayName = (
    values.displayName?.trim() ||
    relativePath.split("/").filter(Boolean).pop() ||
    relativePath
  ).slice(0, 220);
  await db
    .insert(globalFiles)
    .values({
      ...values,
      displayName,
      relativePath,
      createdAt: timestamp,
      updatedAt: values.updatedAt ?? timestamp,
    });

  const result = await db
    .select()
    .from(globalFiles)
    .where(
      and(
        eq(globalFiles.ownerUserId, values.ownerUserId),
        eq(globalFiles.relativePath, relativePath),
        eq(globalFiles.createdAt, timestamp)
      )
    )
    .orderBy(desc(globalFiles.id))
    .limit(1);

  if (!result[0]) throw new Error("Failed to create global file metadata");
  return result[0];
}

export async function listTaskFiles(
  taskId: number,
  ownerUserId: number,
  limit = 200
) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for task files");

  return db
    .select()
    .from(taskFiles)
    .where(
      and(eq(taskFiles.taskId, taskId), eq(taskFiles.ownerUserId, ownerUserId))
    )
    .orderBy(desc(taskFiles.updatedAt))
    .limit(limit);
}

export async function listGlobalFilesForOwner(
  ownerUserId: number,
  limit = 200
) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for global files");

  return db
    .select()
    .from(globalFiles)
    .where(eq(globalFiles.ownerUserId, ownerUserId))
    .orderBy(desc(globalFiles.updatedAt))
    .limit(limit);
}

export async function getGlobalFileForOwner(
  globalFileId: number,
  ownerUserId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for global files");

  const result = await db
    .select()
    .from(globalFiles)
    .where(
      and(
        eq(globalFiles.id, globalFileId),
        eq(globalFiles.ownerUserId, ownerUserId)
      )
    )
    .limit(1);
  return result[0];
}

export async function attachGlobalFileToTask(
  values: Omit<
    InsertTaskGlobalFileLink,
    "attachedLabel" | "createdAt" | "updatedAt"
  > & { attachedLabel?: string | null; createdAt?: number; updatedAt?: number }
) {
  const task = await getTaskForOwner(values.taskId, values.ownerUserId);
  if (!task) throw new Error("Task not found");
  const file = await getGlobalFileForOwner(
    values.globalFileId,
    values.ownerUserId
  );
  if (!file) throw new Error("Global file not found");

  const db = await getDb();
  if (!db) throw new Error("Database is required for global file links");
  const timestamp = values.createdAt ?? nowMs();
  await db
    .insert(taskGlobalFileLinks)
    .values({
      ...values,
      attachedLabel:
        values.attachedLabel?.trim().slice(0, 220) || file.displayName,
      createdAt: timestamp,
      updatedAt: values.updatedAt ?? timestamp,
    })
    .onDuplicateKeyUpdate({
      set: {
        attachedLabel:
          values.attachedLabel?.trim().slice(0, 220) || file.displayName,
        updatedAt: timestamp,
      },
    });

  await touchTask(values.taskId, values.ownerUserId);
  const result = await db
    .select()
    .from(taskGlobalFileLinks)
    .where(
      and(
        eq(taskGlobalFileLinks.taskId, values.taskId),
        eq(taskGlobalFileLinks.globalFileId, values.globalFileId),
        eq(taskGlobalFileLinks.ownerUserId, values.ownerUserId)
      )
    )
    .orderBy(desc(taskGlobalFileLinks.id))
    .limit(1);
  if (!result[0]) throw new Error("Failed to attach global file to task");
  return { ...result[0], file };
}

export async function listGlobalFileLinksForTask(
  taskId: number,
  ownerUserId: number,
  limit = 200
) {
  const task = await getTaskForOwner(taskId, ownerUserId);
  if (!task) return [];
  const db = await getDb();
  if (!db) throw new Error("Database is required for global file links");

  const rows = await db
    .select({ link: taskGlobalFileLinks, file: globalFiles })
    .from(taskGlobalFileLinks)
    .innerJoin(
      globalFiles,
      and(
        eq(taskGlobalFileLinks.globalFileId, globalFiles.id),
        eq(globalFiles.ownerUserId, ownerUserId)
      )
    )
    .where(
      and(
        eq(taskGlobalFileLinks.taskId, taskId),
        eq(taskGlobalFileLinks.ownerUserId, ownerUserId)
      )
    )
    .orderBy(desc(taskGlobalFileLinks.updatedAt))
    .limit(limit);
  return rows.map(row => ({ ...row.link, file: row.file }));
}

export async function listAllFilesForOwner(ownerUserId: number, limit = 400) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for files");

  const taskRows = await db
    .select()
    .from(taskFiles)
    .where(eq(taskFiles.ownerUserId, ownerUserId))
    .orderBy(desc(taskFiles.updatedAt))
    .limit(limit);
  const globalRows = await db
    .select()
    .from(globalFiles)
    .where(eq(globalFiles.ownerUserId, ownerUserId))
    .orderBy(desc(globalFiles.updatedAt))
    .limit(limit);
  return [
    ...taskRows.map(file => ({ ...file, scope: "task" as const })),
    ...globalRows.map(file => ({
      ...file,
      taskId: null,
      version: 1,
      scope: "global" as const,
    })),
  ]
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    .slice(0, limit);
}

export async function getTaskFileForOwner(fileId: number, ownerUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for task files");

  const result = await db
    .select()
    .from(taskFiles)
    .where(
      and(eq(taskFiles.id, fileId), eq(taskFiles.ownerUserId, ownerUserId))
    )
    .limit(1);
  return result[0];
}

export async function recordCredentialStatus(
  values: Omit<InsertCredentialStatusSnapshot, "checkedAt"> & {
    checkedAt?: number;
  }
) {
  const db = await getDb();
  if (!db)
    throw new Error("Database is required for credential status snapshots");

  const timestamp = values.checkedAt ?? nowMs();
  await db
    .insert(credentialStatusSnapshots)
    .values({ ...values, checkedAt: timestamp });
  const result = await db
    .select()
    .from(credentialStatusSnapshots)
    .where(
      and(
        eq(credentialStatusSnapshots.ownerUserId, values.ownerUserId),
        eq(credentialStatusSnapshots.provider, values.provider),
        eq(credentialStatusSnapshots.checkedAt, timestamp)
      )
    )
    .orderBy(desc(credentialStatusSnapshots.id))
    .limit(1);

  if (!result[0]) throw new Error("Failed to record credential status");
  return result[0];
}

async function getRequiredDb(operation: string) {
  const db = await getDb();
  if (!db) {
    throw new Error(`Database not available for ${operation}.`);
  }
  return db;
}

export type SkillScope =
  | "global"
  | "task-type"
  | "file-pattern"
  | "manual-only";
export type SkillSource =
  | "created"
  | "uploaded"
  | "official"
  | "github_imported"
  | "ai_built";
export type TaskType =
  | "code-write"
  | "refactor"
  | "test-write"
  | "planning"
  | "review"
  | "other";
export type ResolvedSkillLoadReason =
  | { kind: "always" }
  | { kind: "task-type"; taskType: TaskType }
  | { kind: "file-pattern"; pattern: string }
  | { kind: "picked" };
export type ResolvedSkill = Skill & {
  loadReason: ResolvedSkillLoadReason;
  displayTag: string;
};

export function parseSkillJsonArray(
  value: string | null | undefined
): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is string =>
            typeof item === "string" && item.trim().length > 0
        )
      : [];
  } catch {
    return [];
  }
}

export function parseSkillMetadata(
  value: string | null | undefined
): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function slugifySkillName(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 160) || "skill"
  );
}

function nextPatchVersion(version: string) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) return "1.0.1";
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}

export function normalizeSkillInput(values: {
  slug?: string;
  name: string;
  scope?: SkillScope;
  content: string;
  taskTypes?: string[];
  filePatterns?: string[];
  enabled?: boolean;
  version?: string;
  description?: string | null;
  source?: SkillSource;
  sourceMetadata?: Record<string, unknown> | null;
  isOfficial?: boolean;
}) {
  const slug = slugifySkillName(values.slug || values.name);
  const scope = values.scope ?? "manual-only";
  const taskTypes = scope === "task-type" ? (values.taskTypes ?? []) : [];
  const filePatterns =
    scope === "file-pattern" ? (values.filePatterns ?? []) : [];
  return {
    slug,
    name: values.name.trim(),
    scope,
    content: values.content.trim(),
    taskTypesJson: taskTypes.length ? JSON.stringify(taskTypes) : null,
    filePatternsJson: filePatterns.length ? JSON.stringify(filePatterns) : null,
    enabled: values.enabled ?? true,
    version: values.version?.trim() || "1.0.0",
    description: values.description?.trim() || null,
    source: values.source ?? "created",
    sourceMetadataJson: values.sourceMetadata
      ? JSON.stringify(values.sourceMetadata)
      : null,
    isOfficial: values.isOfficial ?? false,
  } satisfies Partial<InsertSkill>;
}

export async function createSkill(values: {
  ownerUserId: number;
  slug?: string;
  name: string;
  scope?: SkillScope;
  content: string;
  taskTypes?: string[];
  filePatterns?: string[];
  enabled?: boolean;
  version?: string;
  description?: string | null;
  source?: SkillSource;
  sourceMetadata?: Record<string, unknown> | null;
  isOfficial?: boolean;
}) {
  const db = await getRequiredDb("creating Skill Library");
  const now = Date.now();
  const normalized = normalizeSkillInput(values);
  const [result] = await db
    .insert(skills)
    .values({
      ...normalized,
      ownerUserId: values.ownerUserId,
      createdAt: now,
      updatedAt: now,
    });
  const id = Number(result.insertId);
  const [skill] = await db
    .select()
    .from(skills)
    .where(eq(skills.id, id))
    .limit(1);
  return skill;
}

export async function listSkillsForOwner(
  ownerUserId: number,
  includeDisabled = true,
  limit = 200
) {
  const db = await getRequiredDb("listing Skill Libraries");
  const filters = [eq(skills.ownerUserId, ownerUserId)];
  if (!includeDisabled) filters.push(eq(skills.enabled, true));
  return db
    .select()
    .from(skills)
    .where(and(...filters))
    .orderBy(desc(skills.updatedAt))
    .limit(limit);
}

export async function listOfficialSkills(_ownerUserId: number, limit = 200) {
  const db = await getRequiredDb("listing official Skill Libraries");
  return db
    .select()
    .from(skills)
    .where(and(eq(skills.isOfficial, true), eq(skills.enabled, true)))
    .orderBy(desc(skills.updatedAt))
    .limit(limit);
}

export async function getSkillForOwner(skillId: number, ownerUserId: number) {
  const db = await getRequiredDb("loading Skill Library");
  const [skill] = await db
    .select()
    .from(skills)
    .where(
      and(
        eq(skills.id, skillId),
        or(eq(skills.ownerUserId, ownerUserId), eq(skills.isOfficial, true))
      )
    )
    .limit(1);
  return skill;
}

export async function getSkillBySlugForOwner(
  slug: string,
  ownerUserId: number
) {
  const db = await getRequiredDb("loading Skill Library by slug");
  const [skill] = await db
    .select()
    .from(skills)
    .where(and(eq(skills.ownerUserId, ownerUserId), eq(skills.slug, slug)))
    .limit(1);
  return skill;
}

export async function updateSkill(values: {
  skillId: number;
  ownerUserId: number;
  name?: string;
  version?: string;
  description?: string | null;
  content?: string;
  enabled?: boolean;
  scope?: SkillScope;
  taskTypes?: string[];
  filePatterns?: string[];
  isOfficial?: boolean;
}) {
  const existing = await getSkillForOwner(values.skillId, values.ownerUserId);
  if (!existing || existing.ownerUserId !== values.ownerUserId)
    return undefined;
  const db = await getRequiredDb("updating Skill Library");
  const contentChanged =
    typeof values.content === "string" && values.content !== existing.content;
  const updateValues: Partial<InsertSkill> = { updatedAt: Date.now() };
  if (typeof values.name === "string") updateValues.name = values.name.trim();
  if ("description" in values)
    updateValues.description = values.description?.trim() || null;
  if (typeof values.content === "string")
    updateValues.content = values.content.trim();
  if (typeof values.enabled === "boolean")
    updateValues.enabled = values.enabled;
  if (typeof values.isOfficial === "boolean")
    updateValues.isOfficial = values.isOfficial;
  const nextScope = values.scope ?? existing.scope;
  if (values.scope) updateValues.scope = values.scope;
  if (values.taskTypes || values.scope)
    updateValues.taskTypesJson =
      nextScope === "task-type"
        ? JSON.stringify(
            values.taskTypes ?? parseSkillJsonArray(existing.taskTypesJson)
          )
        : null;
  if (values.filePatterns || values.scope)
    updateValues.filePatternsJson =
      nextScope === "file-pattern"
        ? JSON.stringify(
            values.filePatterns ??
              parseSkillJsonArray(existing.filePatternsJson)
          )
        : null;
  if (typeof values.version === "string")
    updateValues.version = values.version.trim();
  else if (contentChanged)
    updateValues.version = nextPatchVersion(existing.version);
  await db
    .update(skills)
    .set(updateValues)
    .where(
      and(
        eq(skills.id, values.skillId),
        eq(skills.ownerUserId, values.ownerUserId)
      )
    );
  return getSkillForOwner(values.skillId, values.ownerUserId);
}

export async function deleteSkill(skillId: number, ownerUserId: number) {
  const db = await getRequiredDb("deleting Skill Library");
  await db
    .delete(taskSkillSelections)
    .where(
      and(
        eq(taskSkillSelections.ownerUserId, ownerUserId),
        eq(taskSkillSelections.skillId, skillId)
      )
    );
  await db
    .delete(skills)
    .where(and(eq(skills.id, skillId), eq(skills.ownerUserId, ownerUserId)));
  return { success: true } as const;
}

export async function duplicateSkill(
  skillId: number,
  ownerUserId: number,
  overrides?: {
    source?: SkillSource;
    sourceMetadata?: Record<string, unknown> | null;
  }
) {
  const original = await getSkillForOwner(skillId, ownerUserId);
  if (!original) return undefined;
  const baseSlug = `${original.slug}-copy`;
  let slug = baseSlug;
  let suffix = 2;
  while (await getSkillBySlugForOwner(slug, ownerUserId)) {
    slug = `${baseSlug}-${suffix++}`;
  }
  return createSkill({
    ownerUserId,
    slug,
    name: `${original.name} copy`,
    scope: original.scope,
    content: original.content,
    taskTypes: parseSkillJsonArray(original.taskTypesJson),
    filePatterns: parseSkillJsonArray(original.filePatternsJson),
    enabled: true,
    version: original.version,
    description: original.description,
    source:
      overrides?.source ?? (original.isOfficial ? "official" : original.source),
    sourceMetadata:
      overrides?.sourceMetadata ??
      parseSkillMetadata(original.sourceMetadataJson),
    isOfficial: false,
  });
}

export async function upsertTaskSkillSelection(values: {
  taskId: number;
  ownerUserId: number;
  skillId: number;
  state: "picked" | "removed";
  reason?: string | null;
}) {
  const db = await getRequiredDb("saving task Skill Library selection");
  const now = Date.now();
  const [existing] = await db
    .select()
    .from(taskSkillSelections)
    .where(
      and(
        eq(taskSkillSelections.taskId, values.taskId),
        eq(taskSkillSelections.skillId, values.skillId),
        eq(taskSkillSelections.ownerUserId, values.ownerUserId)
      )
    )
    .limit(1);
  if (existing) {
    await db
      .update(taskSkillSelections)
      .set({
        state: values.state,
        reason: values.reason ?? null,
        updatedAt: now,
      })
      .where(eq(taskSkillSelections.id, existing.id));
    return {
      ...existing,
      state: values.state,
      reason: values.reason ?? null,
      updatedAt: now,
    } as TaskSkillSelection;
  }
  const [result] = await db
    .insert(taskSkillSelections)
    .values({
      taskId: values.taskId,
      ownerUserId: values.ownerUserId,
      skillId: values.skillId,
      state: values.state,
      reason: values.reason ?? null,
      createdAt: now,
      updatedAt: now,
    });
  const [selection] = await db
    .select()
    .from(taskSkillSelections)
    .where(eq(taskSkillSelections.id, Number(result.insertId)))
    .limit(1);
  return selection;
}

export async function listTaskSkillSelections(
  taskId: number,
  ownerUserId: number
) {
  const db = await getRequiredDb("listing task Skill Library selections");
  return db
    .select()
    .from(taskSkillSelections)
    .where(
      and(
        eq(taskSkillSelections.taskId, taskId),
        eq(taskSkillSelections.ownerUserId, ownerUserId)
      )
    );
}

function inferTaskType(task: Task): TaskType {
  const text = `${task.title} ${task.summary ?? ""}`.toLowerCase();
  if (/\b(test|spec|coverage|vitest|jest)\b/.test(text)) return "test-write";
  if (/\b(refactor|cleanup|clean up|rename|simplify)\b/.test(text))
    return "refactor";
  if (/\b(review|audit|qa|inspect)\b/.test(text)) return "review";
  if (/\b(plan|design|architect|scope|prd)\b/.test(text)) return "planning";
  if (/\b(code|build|implement|fix|feature|bug)\b/.test(text))
    return "code-write";
  return "other";
}

function wildcardToRegExp(pattern: string) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "__DOUBLE_STAR__")
    .replace(/\*/g, "[^/]*")
    .replace(/__DOUBLE_STAR__/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function matchesAnyFile(pattern: string, files: { relativePath: string }[]) {
  try {
    const regex = wildcardToRegExp(pattern);
    return files.some(file => regex.test(file.relativePath));
  } catch {
    return false;
  }
}

export function renderResolvedSkillsPromptBlock(
  skillList: Array<
    Pick<
      ResolvedSkill,
      "slug" | "name" | "version" | "scope" | "content" | "displayTag"
    >
  >
) {
  if (!skillList.length) return "";
  const lines = skillList.map((skill, index) => {
    const body = skill.content.slice(0, 6000);
    return `Skill ${index + 1}: ${skill.name} v${skill.version} [${skill.displayTag}]\nSlug: ${skill.slug}\nScope: ${skill.scope}\nInstructions:\n${body}`;
  });
  return `AI Skill instructions loaded for this task. Follow these reusable owner-approved instructions after the project rule books and before the user's turn-specific request.\n\n${lines.join("\n\n---\n\n")}`;
}

export async function resolveSkillsForTask(values: {
  task: Task;
  ownerUserId: number;
  files: { relativePath: string }[];
}) {
  const [allSkills, selections] = await Promise.all([
    listSkillsForOwner(values.ownerUserId, false, 200),
    listTaskSkillSelections(values.task.id, values.ownerUserId),
  ]);
  const selectedBySkill = new Map(
    selections.map(selection => [selection.skillId, selection])
  );
  const inferredType = inferTaskType(values.task);
  const resolved: ResolvedSkill[] = [];
  for (const skill of allSkills) {
    const selection = selectedBySkill.get(skill.id);
    if (selection?.state === "removed") continue;
    if (selection?.state === "picked") {
      resolved.push({
        ...skill,
        loadReason: { kind: "picked" },
        displayTag: "Picked",
      });
      continue;
    }
    if (skill.scope === "global") {
      resolved.push({
        ...skill,
        loadReason: { kind: "always" },
        displayTag: "Always",
      });
    } else if (skill.scope === "task-type") {
      const taskTypes = parseSkillJsonArray(skill.taskTypesJson);
      if (taskTypes.includes(inferredType))
        resolved.push({
          ...skill,
          loadReason: { kind: "task-type", taskType: inferredType },
          displayTag: `Auto: ${taskTypeLabel(inferredType)}`,
        });
    } else if (skill.scope === "file-pattern") {
      const pattern = parseSkillJsonArray(skill.filePatternsJson).find(
        candidate => matchesAnyFile(candidate, values.files)
      );
      if (pattern)
        resolved.push({
          ...skill,
          loadReason: { kind: "file-pattern", pattern },
          displayTag: `Auto: matched ${pattern}`,
        });
    }
  }
  return { taskType: inferredType, skills: resolved };
}

export function taskTypeLabel(taskType: string) {
  const labels: Record<string, string> = {
    "code-write": "Writing code",
    refactor: "Cleaning up code",
    "test-write": "Writing tests",
    planning: "Planning",
    review: "Reviewing",
    other: "Other",
  };
  return labels[taskType] ?? "Other";
}

export async function getLatestCredentialStatuses(ownerUserId: number) {
  const db = await getDb();
  if (!db)
    throw new Error("Database is required for credential status snapshots");

  const rows = await db
    .select()
    .from(credentialStatusSnapshots)
    .where(eq(credentialStatusSnapshots.ownerUserId, ownerUserId))
    .orderBy(desc(credentialStatusSnapshots.checkedAt))
    .limit(20);

  const latest = new Map<CredentialProvider, (typeof rows)[number]>();
  for (const row of rows) {
    if (!latest.has(row.provider as CredentialProvider)) {
      latest.set(row.provider as CredentialProvider, row);
    }
  }

  return [latest.get("claude") ?? null, latest.get("kimi") ?? null].filter(
    Boolean
  );
}

export function parseJsonStringArray(
  value: string | null | undefined,
  fallback: string[] = []
) {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : fallback;
  } catch {
    return fallback;
  }
}

export function normalizeJsonStringArray(
  values: string[] | undefined,
  fallback: string[] = []
) {
  const source = values && values.length > 0 ? values : fallback;
  return JSON.stringify(
    Array.from(new Set(source.map(value => value.trim()).filter(Boolean)))
  );
}

function normalizeEnvName(value: string) {
  const normalized = value.trim();
  if (!/^[A-Z_][A-Z0-9_]*$/.test(normalized))
    throw new Error(`Invalid environment variable name: ${value}`);
  return normalized;
}

export { parseGovernanceFiles, normalizeGovernanceFiles };

export function parseAgentEnvVarMap(
  value: string | null | undefined
): AgentEnvVarMap {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter(
          (entry): entry is [string, string] => typeof entry[1] === "string"
        )
        .map(([workspaceEnvName, sourceEnvName]) => [
          normalizeEnvName(workspaceEnvName),
          normalizeEnvName(sourceEnvName),
        ])
    );
  } catch {
    return {};
  }
}

export function normalizeAgentEnvVarMap(
  values: AgentEnvVarMap | undefined
): string {
  if (!values) return "{}";
  const normalized = Object.fromEntries(
    Object.entries(values)
      .map(
        ([workspaceEnvName, sourceEnvName]) =>
          [
            normalizeEnvName(workspaceEnvName),
            normalizeEnvName(sourceEnvName),
          ] as const
      )
      .filter(([workspaceEnvName, sourceEnvName]) =>
        Boolean(workspaceEnvName && sourceEnvName)
      )
  );
  return JSON.stringify(normalized);
}

export function sanitizeBuildTargetName(input: string) {
  const normalized = input.replace(/\s+/g, " ").trim();
  if (!normalized) return "Untitled build target";
  return normalized.slice(0, 220);
}

export async function createBuildTarget(values: {
  ownerUserId: number;
  name: string;
  repoUrl: string;
  githubTokenEnvVar: string;
  defaultBaseBranch?: string;
  protectedBranches?: string[];
  validationCommands?: string[];
  serviceChecks?: string[];
  agentEnvVarMap?: AgentEnvVarMap;
  governanceFiles?: GovernanceFileConfig[];
  governanceBudgetEnforced?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for Projects");
  const timestamp = nowMs();
  const defaultBaseBranch =
    (values.defaultBaseBranch ?? "main").trim() || "main";
  const insertValues: InsertBuildTarget = {
    ownerUserId: values.ownerUserId,
    name: sanitizeBuildTargetName(values.name),
    repoUrl: values.repoUrl.trim(),
    githubTokenEnvVar: values.githubTokenEnvVar.trim(),
    defaultBaseBranch,
    protectedBranchesJson: normalizeJsonStringArray(values.protectedBranches, [
      "main",
      "staging",
    ]),
    validationCommandsJson: normalizeJsonStringArray(
      values.validationCommands,
      ["pnpm check", "pnpm test", "pnpm build"]
    ),
    serviceChecksJson: normalizeJsonStringArray(values.serviceChecks, []),
    agentEnvVarMapJson: normalizeAgentEnvVarMap(values.agentEnvVarMap),
    governanceFilesJson: normalizeGovernanceFiles(values.governanceFiles),
    governanceBudgetEnforced: values.governanceBudgetEnforced ?? true,
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.insert(buildTargets).values(insertValues);
  const created = await db
    .select()
    .from(buildTargets)
    .where(
      and(
        eq(buildTargets.ownerUserId, values.ownerUserId),
        eq(buildTargets.createdAt, timestamp)
      )
    )
    .orderBy(desc(buildTargets.id))
    .limit(1);
  if (!created[0]) throw new Error("Failed to create Project");
  return created[0];
}

export async function getValidWizardSessionCache(values: {
  ownerUserId: number;
  repoUrl: string;
  commitSha: string;
  now?: number;
}): Promise<WizardSession | undefined> {
  const db = await getDb();
  if (!db)
    throw new Error("Database is required for Project setup wizard cache");
  const now = values.now ?? nowMs();
  const result = await db
    .select()
    .from(wizardSessions)
    .where(
      and(
        eq(wizardSessions.ownerUserId, values.ownerUserId),
        eq(wizardSessions.repoUrl, values.repoUrl.trim()),
        eq(wizardSessions.commitSha, values.commitSha.trim()),
        eq(wizardSessions.status, "cached")
      )
    )
    .orderBy(desc(wizardSessions.updatedAt))
    .limit(1);
  const session = result[0];
  if (!session || session.expiresAt <= now) return undefined;
  return session;
}

export async function upsertWizardSessionCache(values: {
  ownerUserId: number;
  repoUrl: string;
  commitSha: string;
  recommendationJson: string;
  repoContextJson?: string | null;
  status?: WizardSessionStatus;
  errorMessage?: string | null;
  ttlMs?: number;
}) {
  const db = await getDb();
  if (!db)
    throw new Error("Database is required for Project setup wizard cache");
  const timestamp = nowMs();
  const insertValues: InsertWizardSession = {
    ownerUserId: values.ownerUserId,
    repoUrl: values.repoUrl.trim(),
    commitSha: values.commitSha.trim(),
    status: values.status ?? "cached",
    recommendationJson: values.recommendationJson,
    repoContextJson: values.repoContextJson ?? null,
    errorMessage: values.errorMessage ?? null,
    expiresAt: timestamp + (values.ttlMs ?? 24 * 60 * 60 * 1000),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db
    .insert(wizardSessions)
    .values(insertValues)
    .onDuplicateKeyUpdate({
      set: {
        status: insertValues.status,
        recommendationJson: insertValues.recommendationJson,
        repoContextJson: insertValues.repoContextJson,
        errorMessage: insertValues.errorMessage,
        expiresAt: insertValues.expiresAt,
        updatedAt: timestamp,
      },
    });
  const result = await db
    .select()
    .from(wizardSessions)
    .where(
      and(
        eq(wizardSessions.ownerUserId, values.ownerUserId),
        eq(wizardSessions.repoUrl, insertValues.repoUrl),
        eq(wizardSessions.commitSha, insertValues.commitSha)
      )
    )
    .limit(1);
  if (!result[0])
    throw new Error("Failed to cache Project setup wizard recommendation");
  return result[0];
}

export async function updateBuildTarget(values: {
  targetId: number;
  ownerUserId: number;
  name?: string;
  defaultBaseBranch?: string;
  protectedBranches?: string[];
  validationCommands?: string[];
  serviceChecks?: string[];
  agentEnvVarMap?: AgentEnvVarMap;
  governanceFiles?: GovernanceFileConfig[];
  governanceBudgetEnforced?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for Projects");
  const set: Partial<InsertBuildTarget> = { updatedAt: nowMs() };
  if (values.name !== undefined)
    set.name = sanitizeBuildTargetName(values.name);
  if (values.defaultBaseBranch !== undefined)
    set.defaultBaseBranch = values.defaultBaseBranch.trim() || "main";
  if (values.protectedBranches !== undefined)
    set.protectedBranchesJson = normalizeJsonStringArray(
      values.protectedBranches,
      ["main", "staging"]
    );
  if (values.validationCommands !== undefined)
    set.validationCommandsJson = normalizeJsonStringArray(
      values.validationCommands,
      ["pnpm check", "pnpm test", "pnpm build"]
    );
  if (values.serviceChecks !== undefined)
    set.serviceChecksJson = normalizeJsonStringArray(values.serviceChecks, []);
  if (values.agentEnvVarMap !== undefined)
    set.agentEnvVarMapJson = normalizeAgentEnvVarMap(values.agentEnvVarMap);
  if (values.governanceFiles !== undefined)
    set.governanceFilesJson = normalizeGovernanceFiles(values.governanceFiles);
  if (values.governanceBudgetEnforced !== undefined)
    set.governanceBudgetEnforced = values.governanceBudgetEnforced;
  await db
    .update(buildTargets)
    .set(set)
    .where(
      and(
        eq(buildTargets.id, values.targetId),
        eq(buildTargets.ownerUserId, values.ownerUserId)
      )
    );
  return getBuildTargetForOwner(values.targetId, values.ownerUserId);
}

export async function updateBuildTargetEnvMap(values: {
  targetId: number;
  ownerUserId: number;
  agentEnvVarMap: AgentEnvVarMap;
}) {
  return updateBuildTarget({
    targetId: values.targetId,
    ownerUserId: values.ownerUserId,
    agentEnvVarMap: values.agentEnvVarMap,
  });
}

export async function updateBuildTargetGovernanceSettings(values: {
  targetId: number;
  ownerUserId: number;
  governanceFiles: GovernanceFileConfig[];
  governanceBudgetEnforced: boolean;
}) {
  return updateBuildTarget({
    targetId: values.targetId,
    ownerUserId: values.ownerUserId,
    governanceFiles: values.governanceFiles,
    governanceBudgetEnforced: values.governanceBudgetEnforced,
  });
}

export async function archiveBuildTarget(
  targetId: number,
  ownerUserId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for Projects");
  await db
    .update(buildTargets)
    .set({ status: "archived", updatedAt: nowMs() })
    .where(
      and(
        eq(buildTargets.id, targetId),
        eq(buildTargets.ownerUserId, ownerUserId)
      )
    );
}

export async function listBuildTargetsForOwner(
  ownerUserId: number,
  includeArchived = false,
  limit = 50
) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for Projects");
  const where = includeArchived
    ? eq(buildTargets.ownerUserId, ownerUserId)
    : and(
        eq(buildTargets.ownerUserId, ownerUserId),
        eq(buildTargets.status, "active")
      );
  return db
    .select()
    .from(buildTargets)
    .where(where)
    .orderBy(desc(buildTargets.updatedAt))
    .limit(limit);
}

export async function getBuildTargetForOwner(
  targetId: number,
  ownerUserId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for Projects");
  const result = await db
    .select()
    .from(buildTargets)
    .where(
      and(
        eq(buildTargets.id, targetId),
        eq(buildTargets.ownerUserId, ownerUserId)
      )
    )
    .limit(1);
  return result[0];
}

export async function createBuildBranch(values: {
  buildTargetId: number;
  ownerUserId: number;
  branchName: string;
  baseBranch: string;
  workspacePath: string;
  taskId?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for Build Branches");
  const timestamp = nowMs();
  const insertValues: InsertBuildBranch = {
    buildTargetId: values.buildTargetId,
    ownerUserId: values.ownerUserId,
    branchName: values.branchName.trim(),
    baseBranch: values.baseBranch.trim() || "main",
    taskId: values.taskId ?? null,
    workspacePath: values.workspacePath,
    state: "cloning",
    errorMessage: null,
    lastSyncedCommit: null,
    pushState: "never_pushed",
    lastPushedCommit: null,
    lastPushError: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.insert(buildBranches).values(insertValues);
  const created = await db
    .select()
    .from(buildBranches)
    .where(
      and(
        eq(buildBranches.ownerUserId, values.ownerUserId),
        eq(buildBranches.buildTargetId, values.buildTargetId),
        eq(buildBranches.createdAt, timestamp)
      )
    )
    .orderBy(desc(buildBranches.id))
    .limit(1);
  if (!created[0]) throw new Error("Failed to create Build Branch");
  return created[0];
}

export async function updateBuildBranchState(values: {
  branchId: number;
  ownerUserId: number;
  state: BuildBranchState;
  errorMessage?: string | null;
  lastSyncedCommit?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for Build Branches");
  const timestamp = nowMs();
  await db
    .update(buildBranches)
    .set({
      state: values.state,
      errorMessage: values.errorMessage ?? null,
      lastSyncedCommit: values.lastSyncedCommit ?? null,
      updatedAt: timestamp,
    })
    .where(
      and(
        eq(buildBranches.id, values.branchId),
        eq(buildBranches.ownerUserId, values.ownerUserId)
      )
    );
  return getBuildBranchForOwner(values.branchId, values.ownerUserId);
}

export async function updateBuildBranchPushState(values: {
  branchId: number;
  ownerUserId: number;
  pushState: BuildBranchPushState;
  lastPushedCommit?: string | null;
  lastPushError?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for Build Branches");
  await db
    .update(buildBranches)
    .set({
      pushState: values.pushState,
      lastPushedCommit: values.lastPushedCommit ?? null,
      lastPushError: values.lastPushError ?? null,
      updatedAt: nowMs(),
    })
    .where(
      and(
        eq(buildBranches.id, values.branchId),
        eq(buildBranches.ownerUserId, values.ownerUserId)
      )
    );
  return getBuildBranchForOwner(values.branchId, values.ownerUserId);
}

export async function updateBuildBranchWorkspacePath(values: {
  branchId: number;
  ownerUserId: number;
  workspacePath: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for Build Branches");
  await db
    .update(buildBranches)
    .set({ workspacePath: values.workspacePath, updatedAt: nowMs() })
    .where(
      and(
        eq(buildBranches.id, values.branchId),
        eq(buildBranches.ownerUserId, values.ownerUserId)
      )
    );
  return getBuildBranchForOwner(values.branchId, values.ownerUserId);
}

export async function listBuildBranchesForTarget(
  buildTargetId: number,
  ownerUserId: number,
  limit = 50
) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for Build Branches");
  return db
    .select()
    .from(buildBranches)
    .where(
      and(
        eq(buildBranches.buildTargetId, buildTargetId),
        eq(buildBranches.ownerUserId, ownerUserId)
      )
    )
    .orderBy(desc(buildBranches.updatedAt))
    .limit(limit);
}

export async function getBuildBranchForOwner(
  branchId: number,
  ownerUserId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for Build Branches");
  const result = await db
    .select()
    .from(buildBranches)
    .where(
      and(
        eq(buildBranches.id, branchId),
        eq(buildBranches.ownerUserId, ownerUserId)
      )
    )
    .limit(1);
  return result[0];
}

export async function deleteBuildBranch(branchId: number, ownerUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for Build Branches");
  await db
    .delete(buildBranches)
    .where(
      and(
        eq(buildBranches.id, branchId),
        eq(buildBranches.ownerUserId, ownerUserId)
      )
    );
}

export async function linkTaskToBuildBranch(
  taskId: number,
  ownerUserId: number,
  buildBranchId: number | null
) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for Build Branch task links");
  const timestamp = nowMs();
  await db
    .update(tasks)
    .set({ buildBranchId, updatedAt: timestamp, lastActivityAt: timestamp })
    .where(and(eq(tasks.id, taskId), eq(tasks.ownerUserId, ownerUserId)));
  return getTaskForOwner(taskId, ownerUserId);
}
