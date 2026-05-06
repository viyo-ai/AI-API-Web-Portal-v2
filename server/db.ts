import { and, desc, eq, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  buildBranches,
  buildTargets,
  credentialStatusSnapshots,
  globalMemory,
  globalFiles,
  InsertBuildBranch,
  InsertBuildTarget,
  InsertCredentialStatusSnapshot,
  InsertGlobalMemory,
  InsertGlobalFile,
  InsertTaskGlobalFileLink,
  InsertOrchestrationTurn,
  InsertTask,
  InsertTaskEvent,
  InsertTaskFile,
  InsertUser,
  orchestrationTurns,
  taskEvents,
  taskFiles,
  taskGlobalFileLinks,
  tasks,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export type TaskStatus = "active" | "waiting" | "blocked" | "completed" | "archived" | "error";
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
  | "failed";
export type MemoryCategory = "decision" | "feature" | "research" | "past_task";
export type CredentialProvider = "claude" | "kimi";
export type CredentialStatus = "configured" | "missing" | "invalid" | "untested" | "error";
export type BuildTargetStatus = "active" | "archived";
export type BuildBranchState = "clean" | "cloning" | "error";

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

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
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
    .where(and(eq(tasks.ownerUserId, values.ownerUserId), eq(tasks.createdAt, timestamp)))
    .orderBy(desc(tasks.id))
    .limit(1);

  if (!created[0]) throw new Error("Failed to create task");
  return created[0];
}

export async function listTasksForOwner(ownerUserId: number, includeArchived = false, limit = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for tasks");

  const where = includeArchived ? eq(tasks.ownerUserId, ownerUserId) : and(eq(tasks.ownerUserId, ownerUserId), or(eq(tasks.status, "active"), eq(tasks.status, "waiting"), eq(tasks.status, "blocked"), eq(tasks.status, "completed"), eq(tasks.status, "error")));

  return db.select().from(tasks).where(where).orderBy(desc(tasks.lastActivityAt)).limit(limit);
}

export async function getTaskForOwner(taskId: number, ownerUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for tasks");

  const result = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.ownerUserId, ownerUserId))).limit(1);
  return result[0];
}

export async function touchTask(taskId: number, ownerUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for tasks");

  const timestamp = nowMs();
  await db.update(tasks).set({ updatedAt: timestamp, lastActivityAt: timestamp }).where(and(eq(tasks.id, taskId), eq(tasks.ownerUserId, ownerUserId)));
}

export async function updateTaskStatus(taskId: number, ownerUserId: number, status: TaskStatus) {
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

export async function renameTask(taskId: number, ownerUserId: number, title: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for tasks");

  const timestamp = nowMs();
  await db
    .update(tasks)
    .set({ title: sanitizeTaskTitle(title), updatedAt: timestamp, lastActivityAt: timestamp })
    .where(and(eq(tasks.id, taskId), eq(tasks.ownerUserId, ownerUserId)));
}

export async function appendTaskEvent(values: Omit<InsertTaskEvent, "createdAt"> & { createdAt?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for task events");

  const timestamp = values.createdAt ?? nowMs();
  await db.insert(taskEvents).values({ ...values, createdAt: timestamp });
  await touchTask(values.taskId, values.ownerUserId);

  const result = await db
    .select()
    .from(taskEvents)
    .where(and(eq(taskEvents.taskId, values.taskId), eq(taskEvents.ownerUserId, values.ownerUserId), eq(taskEvents.createdAt, timestamp)))
    .orderBy(desc(taskEvents.id))
    .limit(1);

  if (!result[0]) throw new Error("Failed to append task event");
  return result[0];
}

export async function listTaskEvents(taskId: number, ownerUserId: number, limit = 100) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for task events");

  return db
    .select()
    .from(taskEvents)
    .where(and(eq(taskEvents.taskId, taskId), eq(taskEvents.ownerUserId, ownerUserId)))
    .orderBy(desc(taskEvents.createdAt))
    .limit(limit);
}

export async function getTaskThread(taskId: number, ownerUserId: number) {
  const task = await getTaskForOwner(taskId, ownerUserId);
  if (!task) return undefined;

  const events = (await listTaskEvents(taskId, ownerUserId, 200)).reverse();
  const activeTurns = await listTurnsForTask(taskId, ownerUserId, 1);

  return {
    task,
    events,
    activeTurn: activeTurns[0]?.state === "completed" || activeTurns[0]?.state === "blocked" || activeTurns[0]?.state === "failed" ? null : activeTurns[0] ?? null,
  };
}

export async function createTurn(values: Omit<InsertOrchestrationTurn, "startedAt"> & { startedAt?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for orchestration turns");

  const timestamp = values.startedAt ?? nowMs();
  await db.insert(orchestrationTurns).values({ ...values, startedAt: timestamp });
  const result = await db
    .select()
    .from(orchestrationTurns)
    .where(and(eq(orchestrationTurns.taskId, values.taskId), eq(orchestrationTurns.ownerUserId, values.ownerUserId), eq(orchestrationTurns.startedAt, timestamp)))
    .orderBy(desc(orchestrationTurns.id))
    .limit(1);

  if (!result[0]) throw new Error("Failed to create orchestration turn");
  return result[0];
}

export async function listTurnsForTask(taskId: number, ownerUserId: number, limit = 20) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for orchestration turns");

  return db
    .select()
    .from(orchestrationTurns)
    .where(and(eq(orchestrationTurns.taskId, taskId), eq(orchestrationTurns.ownerUserId, ownerUserId)))
    .orderBy(desc(orchestrationTurns.startedAt))
    .limit(limit);
}

export async function updateTurnState(turnId: number, ownerUserId: number, state: TurnState, route?: TurnRoute, credentialStateJson?: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for orchestration turns");

  await db
    .update(orchestrationTurns)
    .set({ state, route, credentialStateJson })
    .where(and(eq(orchestrationTurns.id, turnId), eq(orchestrationTurns.ownerUserId, ownerUserId)));
}

export async function completeTurn(turnId: number, ownerUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for orchestration turns");

  await db
    .update(orchestrationTurns)
    .set({ state: "completed", completedAt: nowMs(), errorCode: null, errorMessage: null })
    .where(and(eq(orchestrationTurns.id, turnId), eq(orchestrationTurns.ownerUserId, ownerUserId)));
}

export async function failTurn(turnId: number, ownerUserId: number, errorCode: string, errorMessage: string, state: "blocked" | "failed" = "failed") {
  const db = await getDb();
  if (!db) throw new Error("Database is required for orchestration turns");

  await db
    .update(orchestrationTurns)
    .set({ state, completedAt: nowMs(), errorCode, errorMessage })
    .where(and(eq(orchestrationTurns.id, turnId), eq(orchestrationTurns.ownerUserId, ownerUserId)));
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
    .where(and(eq(globalMemory.ownerUserId, values.ownerUserId), eq(globalMemory.createdAt, timestamp)))
    .orderBy(desc(globalMemory.id))
    .limit(1);

  if (!result[0]) throw new Error("Failed to create global memory");
  return result[0];
}

export async function listMemoryByCategory(ownerUserId: number, category?: MemoryCategory, limit = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for global memory");

  const where = category ? and(eq(globalMemory.ownerUserId, ownerUserId), eq(globalMemory.category, category)) : eq(globalMemory.ownerUserId, ownerUserId);
  return db.select().from(globalMemory).where(where).orderBy(desc(globalMemory.updatedAt)).limit(limit);
}

export async function searchMemory(ownerUserId: number, query: string, limit = 30) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for global memory");

  const normalized = query.trim();
  if (!normalized) return listMemoryByCategory(ownerUserId, undefined, limit);

  const pattern = `%${normalized.replace(/[%_]/g, "\\$&")}%`;
  return db
    .select()
    .from(globalMemory)
    .where(and(eq(globalMemory.ownerUserId, ownerUserId), or(like(globalMemory.title, pattern), like(globalMemory.content, pattern))))
    .orderBy(desc(globalMemory.updatedAt))
    .limit(limit);
}

export async function linkMemoryToTask(memoryId: number, ownerUserId: number, sourceTaskId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for global memory");

  await db
    .update(globalMemory)
    .set({ sourceTaskId, updatedAt: nowMs() })
    .where(and(eq(globalMemory.id, memoryId), eq(globalMemory.ownerUserId, ownerUserId)));
}

export async function createTaskFile(values: Omit<InsertTaskFile, "relativePath" | "createdAt" | "updatedAt"> & { relativePath: string; createdAt?: number; updatedAt?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for task files");

  const timestamp = values.createdAt ?? nowMs();
  const relativePath = assertSafeRelativePath(values.relativePath);
  await db.insert(taskFiles).values({ ...values, relativePath, createdAt: timestamp, updatedAt: values.updatedAt ?? timestamp });

  const result = await db
    .select()
    .from(taskFiles)
    .where(and(eq(taskFiles.taskId, values.taskId), eq(taskFiles.ownerUserId, values.ownerUserId), eq(taskFiles.relativePath, relativePath)))
    .orderBy(desc(taskFiles.version), desc(taskFiles.id))
    .limit(1);

  if (!result[0]) throw new Error("Failed to create task file metadata");
  await touchTask(values.taskId, values.ownerUserId);
  return result[0];
}

export async function createGlobalFile(values: Omit<InsertGlobalFile, "relativePath" | "displayName" | "createdAt" | "updatedAt"> & { relativePath: string; displayName?: string; createdAt?: number; updatedAt?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for global files");

  const timestamp = values.createdAt ?? nowMs();
  const relativePath = assertSafeRelativePath(values.relativePath);
  const displayName = (values.displayName?.trim() || relativePath.split("/").filter(Boolean).pop() || relativePath).slice(0, 220);
  await db.insert(globalFiles).values({ ...values, displayName, relativePath, createdAt: timestamp, updatedAt: values.updatedAt ?? timestamp });

  const result = await db
    .select()
    .from(globalFiles)
    .where(and(eq(globalFiles.ownerUserId, values.ownerUserId), eq(globalFiles.relativePath, relativePath), eq(globalFiles.createdAt, timestamp)))
    .orderBy(desc(globalFiles.id))
    .limit(1);

  if (!result[0]) throw new Error("Failed to create global file metadata");
  return result[0];
}

export async function listTaskFiles(taskId: number, ownerUserId: number, limit = 200) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for task files");

  return db
    .select()
    .from(taskFiles)
    .where(and(eq(taskFiles.taskId, taskId), eq(taskFiles.ownerUserId, ownerUserId)))
    .orderBy(desc(taskFiles.updatedAt))
    .limit(limit);
}

export async function listGlobalFilesForOwner(ownerUserId: number, limit = 200) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for global files");

  return db.select().from(globalFiles).where(eq(globalFiles.ownerUserId, ownerUserId)).orderBy(desc(globalFiles.updatedAt)).limit(limit);
}

export async function getGlobalFileForOwner(globalFileId: number, ownerUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for global files");

  const result = await db.select().from(globalFiles).where(and(eq(globalFiles.id, globalFileId), eq(globalFiles.ownerUserId, ownerUserId))).limit(1);
  return result[0];
}

export async function attachGlobalFileToTask(values: Omit<InsertTaskGlobalFileLink, "attachedLabel" | "createdAt" | "updatedAt"> & { attachedLabel?: string | null; createdAt?: number; updatedAt?: number }) {
  const task = await getTaskForOwner(values.taskId, values.ownerUserId);
  if (!task) throw new Error("Task not found");
  const file = await getGlobalFileForOwner(values.globalFileId, values.ownerUserId);
  if (!file) throw new Error("Global file not found");

  const db = await getDb();
  if (!db) throw new Error("Database is required for global file links");
  const timestamp = values.createdAt ?? nowMs();
  await db
    .insert(taskGlobalFileLinks)
    .values({ ...values, attachedLabel: values.attachedLabel?.trim().slice(0, 220) || file.displayName, createdAt: timestamp, updatedAt: values.updatedAt ?? timestamp })
    .onDuplicateKeyUpdate({ set: { attachedLabel: values.attachedLabel?.trim().slice(0, 220) || file.displayName, updatedAt: timestamp } });

  await touchTask(values.taskId, values.ownerUserId);
  const result = await db
    .select()
    .from(taskGlobalFileLinks)
    .where(and(eq(taskGlobalFileLinks.taskId, values.taskId), eq(taskGlobalFileLinks.globalFileId, values.globalFileId), eq(taskGlobalFileLinks.ownerUserId, values.ownerUserId)))
    .orderBy(desc(taskGlobalFileLinks.id))
    .limit(1);
  if (!result[0]) throw new Error("Failed to attach global file to task");
  return { ...result[0], file };
}

export async function listGlobalFileLinksForTask(taskId: number, ownerUserId: number, limit = 200) {
  const task = await getTaskForOwner(taskId, ownerUserId);
  if (!task) return [];
  const db = await getDb();
  if (!db) throw new Error("Database is required for global file links");

  const rows = await db
    .select({ link: taskGlobalFileLinks, file: globalFiles })
    .from(taskGlobalFileLinks)
    .innerJoin(globalFiles, and(eq(taskGlobalFileLinks.globalFileId, globalFiles.id), eq(globalFiles.ownerUserId, ownerUserId)))
    .where(and(eq(taskGlobalFileLinks.taskId, taskId), eq(taskGlobalFileLinks.ownerUserId, ownerUserId)))
    .orderBy(desc(taskGlobalFileLinks.updatedAt))
    .limit(limit);
  return rows.map((row) => ({ ...row.link, file: row.file }));
}

export async function listAllFilesForOwner(ownerUserId: number, limit = 400) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for files");

  const taskRows = await db.select().from(taskFiles).where(eq(taskFiles.ownerUserId, ownerUserId)).orderBy(desc(taskFiles.updatedAt)).limit(limit);
  const globalRows = await db.select().from(globalFiles).where(eq(globalFiles.ownerUserId, ownerUserId)).orderBy(desc(globalFiles.updatedAt)).limit(limit);
  return [
    ...taskRows.map((file) => ({ ...file, scope: "task" as const })),
    ...globalRows.map((file) => ({ ...file, taskId: null, version: 1, scope: "global" as const })),
  ]
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    .slice(0, limit);
}

export async function getTaskFileForOwner(fileId: number, ownerUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for task files");

  const result = await db.select().from(taskFiles).where(and(eq(taskFiles.id, fileId), eq(taskFiles.ownerUserId, ownerUserId))).limit(1);
  return result[0];
}

export async function recordCredentialStatus(values: Omit<InsertCredentialStatusSnapshot, "checkedAt"> & { checkedAt?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for credential status snapshots");

  const timestamp = values.checkedAt ?? nowMs();
  await db.insert(credentialStatusSnapshots).values({ ...values, checkedAt: timestamp });
  const result = await db
    .select()
    .from(credentialStatusSnapshots)
    .where(and(eq(credentialStatusSnapshots.ownerUserId, values.ownerUserId), eq(credentialStatusSnapshots.provider, values.provider), eq(credentialStatusSnapshots.checkedAt, timestamp)))
    .orderBy(desc(credentialStatusSnapshots.id))
    .limit(1);

  if (!result[0]) throw new Error("Failed to record credential status");
  return result[0];
}

export async function getLatestCredentialStatuses(ownerUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for credential status snapshots");

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

  return [latest.get("claude") ?? null, latest.get("kimi") ?? null].filter(Boolean);
}


export function parseJsonStringArray(value: string | null | undefined, fallback: string[] = []) {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : fallback;
  } catch {
    return fallback;
  }
}

export function normalizeJsonStringArray(values: string[] | undefined, fallback: string[] = []) {
  const source = values && values.length > 0 ? values : fallback;
  return JSON.stringify(Array.from(new Set(source.map((value) => value.trim()).filter(Boolean))));
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
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for Build Targets");
  const timestamp = nowMs();
  const defaultBaseBranch = (values.defaultBaseBranch ?? "main").trim() || "main";
  const insertValues: InsertBuildTarget = {
    ownerUserId: values.ownerUserId,
    name: sanitizeBuildTargetName(values.name),
    repoUrl: values.repoUrl.trim(),
    githubTokenEnvVar: values.githubTokenEnvVar.trim(),
    defaultBaseBranch,
    protectedBranchesJson: normalizeJsonStringArray(values.protectedBranches, ["main", "staging"]),
    validationCommandsJson: normalizeJsonStringArray(values.validationCommands, ["pnpm check", "pnpm test", "pnpm build"]),
    serviceChecksJson: normalizeJsonStringArray(values.serviceChecks, []),
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.insert(buildTargets).values(insertValues);
  const created = await db.select().from(buildTargets).where(and(eq(buildTargets.ownerUserId, values.ownerUserId), eq(buildTargets.createdAt, timestamp))).orderBy(desc(buildTargets.id)).limit(1);
  if (!created[0]) throw new Error("Failed to create Build Target");
  return created[0];
}

export async function updateBuildTarget(values: {
  targetId: number;
  ownerUserId: number;
  name?: string;
  defaultBaseBranch?: string;
  protectedBranches?: string[];
  validationCommands?: string[];
  serviceChecks?: string[];
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for Build Targets");
  const set: Partial<InsertBuildTarget> = { updatedAt: nowMs() };
  if (values.name !== undefined) set.name = sanitizeBuildTargetName(values.name);
  if (values.defaultBaseBranch !== undefined) set.defaultBaseBranch = values.defaultBaseBranch.trim() || "main";
  if (values.protectedBranches !== undefined) set.protectedBranchesJson = normalizeJsonStringArray(values.protectedBranches, ["main", "staging"]);
  if (values.validationCommands !== undefined) set.validationCommandsJson = normalizeJsonStringArray(values.validationCommands, ["pnpm check", "pnpm test", "pnpm build"]);
  if (values.serviceChecks !== undefined) set.serviceChecksJson = normalizeJsonStringArray(values.serviceChecks, []);
  await db.update(buildTargets).set(set).where(and(eq(buildTargets.id, values.targetId), eq(buildTargets.ownerUserId, values.ownerUserId)));
  return getBuildTargetForOwner(values.targetId, values.ownerUserId);
}

export async function archiveBuildTarget(targetId: number, ownerUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for Build Targets");
  await db.update(buildTargets).set({ status: "archived", updatedAt: nowMs() }).where(and(eq(buildTargets.id, targetId), eq(buildTargets.ownerUserId, ownerUserId)));
}

export async function listBuildTargetsForOwner(ownerUserId: number, includeArchived = false, limit = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for Build Targets");
  const where = includeArchived ? eq(buildTargets.ownerUserId, ownerUserId) : and(eq(buildTargets.ownerUserId, ownerUserId), eq(buildTargets.status, "active"));
  return db.select().from(buildTargets).where(where).orderBy(desc(buildTargets.updatedAt)).limit(limit);
}

export async function getBuildTargetForOwner(targetId: number, ownerUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for Build Targets");
  const result = await db.select().from(buildTargets).where(and(eq(buildTargets.id, targetId), eq(buildTargets.ownerUserId, ownerUserId))).limit(1);
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
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.insert(buildBranches).values(insertValues);
  const created = await db.select().from(buildBranches).where(and(eq(buildBranches.ownerUserId, values.ownerUserId), eq(buildBranches.buildTargetId, values.buildTargetId), eq(buildBranches.createdAt, timestamp))).orderBy(desc(buildBranches.id)).limit(1);
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
  await db.update(buildBranches).set({ state: values.state, errorMessage: values.errorMessage ?? null, lastSyncedCommit: values.lastSyncedCommit ?? null, updatedAt: timestamp }).where(and(eq(buildBranches.id, values.branchId), eq(buildBranches.ownerUserId, values.ownerUserId)));
  return getBuildBranchForOwner(values.branchId, values.ownerUserId);
}

export async function listBuildBranchesForTarget(buildTargetId: number, ownerUserId: number, limit = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for Build Branches");
  return db.select().from(buildBranches).where(and(eq(buildBranches.buildTargetId, buildTargetId), eq(buildBranches.ownerUserId, ownerUserId))).orderBy(desc(buildBranches.updatedAt)).limit(limit);
}

export async function getBuildBranchForOwner(branchId: number, ownerUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for Build Branches");
  const result = await db.select().from(buildBranches).where(and(eq(buildBranches.id, branchId), eq(buildBranches.ownerUserId, ownerUserId))).limit(1);
  return result[0];
}

export async function deleteBuildBranch(branchId: number, ownerUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for Build Branches");
  await db.delete(buildBranches).where(and(eq(buildBranches.id, branchId), eq(buildBranches.ownerUserId, ownerUserId)));
}

export async function linkTaskToBuildBranch(taskId: number, ownerUserId: number, buildBranchId: number | null) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for Build Branch task links");
  const timestamp = nowMs();
  await db.update(tasks).set({ buildBranchId, updatedAt: timestamp, lastActivityAt: timestamp }).where(and(eq(tasks.id, taskId), eq(tasks.ownerUserId, ownerUserId)));
  return getTaskForOwner(taskId, ownerUserId);
}
