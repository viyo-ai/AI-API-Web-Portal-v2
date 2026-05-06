import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  appendTaskEvent,
  assertSafeRelativePath,
  createGlobalFile,
  createMemory,
  createTask,
  createTaskFile,
  createTurn,
  type CredentialProvider,
  type CredentialStatus,
  failTurn,
  getLatestCredentialStatuses,
  getTaskForOwner,
  getTaskThread,
  getTaskFileForOwner,
  listAllFilesForOwner,
  listGlobalFilesForOwner,
  listMemoryByCategory,
  listTaskEvents,
  listTaskFiles,
  listTasksForOwner,
  listTurnsForTask,
  type MemoryCategory,
  recordCredentialStatus,
  renameTask,
  type RouteMode,
  searchMemory,
  updateTaskStatus,
} from "./db";
import {
  createWorkspaceDirectory,
  deleteWorkspacePath,
  listWorkspaceDirectory,
  readWorkspaceFile,
  renameWorkspacePath,
  snapshotWorkspacePath,
  uploadWorkspaceFile,
  writeWorkspaceFile,
} from "./filesystem";
import { getUserWorkspaceRoot } from "./terminal";
import { CLAUDE_DEFAULT_MODEL, CLAUDE_OWNER_MODEL_LABEL, orchestrateWithOpenAI, executeWrapperTurn, getWrapperRuntimeCredentialStates, KIMI_K26_CLOUDFLARE_MODEL, KIMI_OWNER_MODEL_LABEL, resolveEffectiveRoute } from "./wrapperLLM";

const routeModes = ["auto", "claude", "kimi", "dual"] as const;
const taskStatuses = ["active", "waiting", "blocked", "completed", "archived", "error"] as const;
const memoryCategories = ["decision", "feature", "research", "past_task"] as const;
const memoryConfidences = ["low", "medium", "high", "verified"] as const;
const credentialProviders = ["claude", "kimi"] as const;

export type CredentialState = {
  provider: CredentialProvider;
  status: CredentialStatus;
  configured: boolean;
  reason: string;
};

export type WrapperRouteDecision = {
  requestedRoute: RouteMode;
  effectiveRoute: RouteMode | "blocked";
  forcedByTag: "#claude" | "#kimi" | null;
  credentialStates: CredentialState[];
  isRunnable: boolean;
  reason: string;
};

export function detectRouteOverride(message: string): { route: RouteMode; forcedByTag: "#claude" | "#kimi" | null; cleanedMessage: string } {
  const hasClaude = /(^|\s)#claude(\s|$)/i.test(message);
  const hasKimi = /(^|\s)#kimi(\s|$)/i.test(message);
  const cleanedMessage = message.replace(/(^|\s)#(?:claude|kimi)(?=\s|$)/gi, " ").replace(/\s+/g, " ").trim();

  if (hasClaude && hasKimi) {
    return { route: "dual", forcedByTag: null, cleanedMessage };
  }
  if (hasClaude) {
    return { route: "claude", forcedByTag: "#claude", cleanedMessage };
  }
  if (hasKimi) {
    return { route: "kimi", forcedByTag: "#kimi", cleanedMessage };
  }
  return { route: "auto", forcedByTag: null, cleanedMessage: message.trim() };
}

export function getRuntimeCredentialStates(): CredentialState[] {
  return getWrapperRuntimeCredentialStates();
}

function providersRequiredForRoute(route: RouteMode): CredentialProvider[] {
  if (route === "claude") return ["claude"];
  if (route === "kimi") return ["kimi"];
  if (route === "dual" || route === "auto") return ["claude", "kimi"];
  return [];
}

function isModelIdentityQuestion(message: string) {
  const normalized = message.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  return /\bwhat\s+(model|ai|provider)\b/.test(normalized) || /\bwhich\s+(model|ai|provider)\b/.test(normalized) || /\bmodel\s+am\s+i\s+using\b/.test(normalized);
}

function modelIdentityAnswer(route: RouteMode) {
  if (route === "claude") {
    return `You are using Claude mode: ${CLAUDE_OWNER_MODEL_LABEL} through the Claude API. Internal model id: ${CLAUDE_DEFAULT_MODEL}.`;
  }
  if (route === "kimi") {
    return `You are using Kimi mode: ${KIMI_OWNER_MODEL_LABEL} through Cloudflare Workers AI. Internal model id: ${KIMI_K26_CLOUDFLARE_MODEL}.`;
  }
  return `You are using Auto mode by default. Auto initializes both approved providers on the first submitted task message: ${CLAUDE_OWNER_MODEL_LABEL} through the Claude API and ${KIMI_OWNER_MODEL_LABEL} through Cloudflare Workers AI. Internal ids: ${CLAUDE_DEFAULT_MODEL} and ${KIMI_K26_CLOUDFLARE_MODEL}.`;
}


export async function resolveWrapperRoute(message: string, preferredRoute: RouteMode = "auto"): Promise<WrapperRouteDecision> {
  const override = detectRouteOverride(message);
  let requestedRoute = override.route === "auto" ? preferredRoute : override.route;
  const credentialStates = getRuntimeCredentialStates();
  
  // If route is auto and no explicit tag was used, use OpenAI to determine optimal provider
  if (requestedRoute === "auto" && !override.forcedByTag) {
    const decision = await orchestrateWithOpenAI(message);
    const effectiveRoute = resolveEffectiveRoute(decision.route, credentialStates);
    requestedRoute = effectiveRoute;
  }
  
  const requiredProviders = providersRequiredForRoute(requestedRoute);
  const missing = requiredProviders.filter((provider) => !credentialStates.find((state) => state.provider === provider)?.configured);

  if (missing.length > 0) {
    return {
      requestedRoute,
      effectiveRoute: "blocked",
      forcedByTag: override.forcedByTag,
      credentialStates,
      isRunnable: false,
      reason:
        requestedRoute === "auto"
          ? `AUTO first-message initialization requires both Claude Opus 4.7 via the Claude API and Kimi K2.6 via Cloudflare Workers AI. Missing credentials: ${missing.join(", ")}. Task creation alone does not call providers.`
          : `Route ${requestedRoute.toUpperCase()} is unavailable because missing credentials: ${missing.join(", ")}.`,
    };
  }

  return {
    requestedRoute,
    effectiveRoute: requestedRoute,
    forcedByTag: override.forcedByTag,
    credentialStates,
    isRunnable: true,
    reason: `Route ${requestedRoute.toUpperCase()} is credential-ready.`,
  };
}

function serializeJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

async function requireOwnedTask(taskId: number, ownerUserId: number) {
  const task = await getTaskForOwner(taskId, ownerUserId);
  if (!task) {
    throw new Error("Task not found or not owned by the authenticated user");
  }
  return task;
}

async function recordRuntimeCredentialSnapshots(ownerUserId: number, states: CredentialState[]) {
  return Promise.all(
    states.map((state) =>
      recordCredentialStatus({
        ownerUserId,
        provider: state.provider,
        status: state.status,
        lastErrorCode: state.configured ? null : "MISSING_CREDENTIAL",
        lastErrorMessage: state.configured ? null : state.reason,
      }),
    ),
  );
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  tasks: router({
    create: protectedProcedure
      .input(
        z.object({
          title: z.string().trim().min(1).max(220),
          summary: z.string().trim().max(12000).optional(),
          routeMode: z.enum(routeModes).default("auto"),
          initialMessage: z.string().trim().max(20000).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const task = await createTask({ ownerUserId: ctx.user.id, title: input.title, summary: input.summary ?? null, routeMode: input.routeMode });
        await appendTaskEvent({
          taskId: task.id,
          ownerUserId: ctx.user.id,
          actor: "system",
          eventType: "status",
          status: "informational",
          content: "Task record created. Claude Opus 4.7 and Kimi K2.6 are initialized only when the first task message is submitted through the AI coordinator.",
          metadataJson: serializeJson({ routeMode: input.routeMode }),
        });

        // Per the v2 decision record, creating a task only creates the task record and a status event.
        // Provider initialization begins when the owner submits a task-thread message through orchestration.submitMessage.

        return getTaskThread(task.id, ctx.user.id);
      }),
    list: protectedProcedure
      .input(z.object({ includeArchived: z.boolean().default(false), limit: z.number().int().min(1).max(100).default(50) }).optional())
      .query(async ({ ctx, input }) => {
        return listTasksForOwner(ctx.user.id, input?.includeArchived ?? false, input?.limit ?? 50);
      }),
    thread: protectedProcedure
      .input(z.object({ taskId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const thread = await getTaskThread(input.taskId, ctx.user.id);
        if (!thread) throw new Error("Task not found or not owned by the authenticated user");
        return thread;
      }),
    events: protectedProcedure
      .input(z.object({ taskId: z.number().int().positive(), limit: z.number().int().min(1).max(300).default(100) }))
      .query(async ({ ctx, input }) => {
        await requireOwnedTask(input.taskId, ctx.user.id);
        return listTaskEvents(input.taskId, ctx.user.id, input.limit);
      }),
    rename: protectedProcedure
      .input(z.object({ taskId: z.number().int().positive(), title: z.string().trim().min(1).max(220) }))
      .mutation(async ({ ctx, input }) => {
        await requireOwnedTask(input.taskId, ctx.user.id);
        await renameTask(input.taskId, ctx.user.id, input.title);
        return getTaskThread(input.taskId, ctx.user.id);
      }),
    updateStatus: protectedProcedure
      .input(z.object({ taskId: z.number().int().positive(), status: z.enum(taskStatuses) }))
      .mutation(async ({ ctx, input }) => {
        await requireOwnedTask(input.taskId, ctx.user.id);
        await updateTaskStatus(input.taskId, ctx.user.id, input.status);
        await appendTaskEvent({
          taskId: input.taskId,
          ownerUserId: ctx.user.id,
          actor: "system",
          eventType: "status",
          status: "informational",
          content: `Task status changed to ${input.status}.`,
          metadataJson: serializeJson({ status: input.status }),
        });
        return getTaskThread(input.taskId, ctx.user.id);
      }),
  }),
  orchestration: router({
    submitMessage: protectedProcedure
      .input(
        z.object({
          taskId: z.number().int().positive(),
          message: z.string().trim().min(1).max(20000),
          routeMode: z.enum(routeModes).default("auto"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const task = await requireOwnedTask(input.taskId, ctx.user.id);
        const override = detectRouteOverride(input.message);
        const userContent = override.cleanedMessage || input.message.trim();
        const selectedRoute = input.routeMode ?? (task.routeMode as RouteMode);
        const decision = await resolveWrapperRoute(input.message, selectedRoute);
        await recordRuntimeCredentialSnapshots(ctx.user.id, decision.credentialStates);

        await appendTaskEvent({
          taskId: task.id,
          ownerUserId: ctx.user.id,
          actor: "user",
          eventType: "message",
          status: "succeeded",
          content: userContent,
          metadataJson: serializeJson({ requestedRoute: decision.requestedRoute, forcedByTag: decision.forcedByTag }),
        });

        if (isModelIdentityQuestion(userContent)) {
          await appendTaskEvent({
            taskId: task.id,
            ownerUserId: ctx.user.id,
            actor: "system",
            eventType: "message",
            status: "succeeded",
            content: modelIdentityAnswer(decision.requestedRoute === "dual" ? "auto" : selectedRoute),
            metadataJson: serializeJson({ requestedRoute: decision.requestedRoute, effectiveRoute: decision.effectiveRoute, claudeModel: CLAUDE_DEFAULT_MODEL, kimiModel: KIMI_K26_CLOUDFLARE_MODEL }),
          });
          return getTaskThread(task.id, ctx.user.id);
        }

        const turn = await createTurn({
          taskId: task.id,
          ownerUserId: ctx.user.id,
          route: decision.effectiveRoute,
          state: decision.isRunnable ? "context_assembly" : "blocked",
          credentialStateJson: serializeJson(decision.credentialStates),
          completedAt: decision.isRunnable ? null : Date.now(),
          errorCode: decision.isRunnable ? null : "CREDENTIALS_UNAVAILABLE",
          errorMessage: decision.isRunnable ? null : decision.reason,
        });

        await appendTaskEvent({
          taskId: task.id,
          ownerUserId: ctx.user.id,
          actor: "wrapper",
          eventType: "route_decision",
          status: decision.isRunnable ? "succeeded" : "blocked",
          content: decision.reason,
          metadataJson: serializeJson(decision),
        });

        if (!decision.isRunnable) {
          await updateTaskStatus(task.id, ctx.user.id, "blocked");
          await appendTaskEvent({
            taskId: task.id,
            ownerUserId: ctx.user.id,
            actor: "system",
            eventType: "credential_status",
            status: "blocked",
            content: "The AI coordinator did not fall back silently. AUTO first-message initialization requires both Claude Opus 4.7 and Kimi K2.6 credentials; configure the missing server credentials, then retry the task.",
            metadataJson: serializeJson({ turnId: turn.id, credentialStates: decision.credentialStates }),
          });
        } else {
          const effectiveRoute = decision.effectiveRoute;
          if (effectiveRoute === "blocked" || effectiveRoute === "auto") {
            throw new Error("Wrapper route resolution produced an invalid runnable route.");
          }

          const [priorEvents, memory, files] = await Promise.all([
            listTaskEvents(task.id, ctx.user.id, 80),
            listMemoryByCategory(ctx.user.id, undefined, 20),
            listTaskFiles(task.id, ctx.user.id, 200),
          ]);

          try {
            await executeWrapperTurn({
              task,
              ownerUserId: ctx.user.id,
              turnId: turn.id,
              userMessage: userContent,
              route: effectiveRoute,
              credentialStates: decision.credentialStates,
              priorEvents,
              memory,
              files,
            });
          } catch {
            // executeWrapperTurn already persists the failed turn, task status, and timeline error.
            // Returning the refreshed thread keeps the UI honest and prevents a silent broken state.
          }
        }

        return getTaskThread(task.id, ctx.user.id);
      }),
    turns: protectedProcedure
      .input(z.object({ taskId: z.number().int().positive(), limit: z.number().int().min(1).max(100).default(20) }))
      .query(async ({ ctx, input }) => {
        await requireOwnedTask(input.taskId, ctx.user.id);
        return listTurnsForTask(input.taskId, ctx.user.id, input.limit);
      }),
    failTurn: protectedProcedure
      .input(
        z.object({
          turnId: z.number().int().positive(),
          taskId: z.number().int().positive(),
          errorCode: z.string().trim().min(1).max(120),
          errorMessage: z.string().trim().min(1).max(8000),
          blocked: z.boolean().default(false),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await requireOwnedTask(input.taskId, ctx.user.id);
        await failTurn(input.turnId, ctx.user.id, input.errorCode, input.errorMessage, input.blocked ? "blocked" : "failed");
        await updateTaskStatus(input.taskId, ctx.user.id, input.blocked ? "blocked" : "error");
        return { success: true } as const;
      }),
  }),
  memory: router({
    create: protectedProcedure
      .input(
        z.object({
          category: z.enum(memoryCategories),
          title: z.string().trim().min(1).max(220),
          content: z.string().trim().min(1).max(20000),
          sourceTaskId: z.number().int().positive().nullable().optional(),
          confidence: z.enum(memoryConfidences).default("medium"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        if (input.sourceTaskId) await requireOwnedTask(input.sourceTaskId, ctx.user.id);
        return createMemory({
          ownerUserId: ctx.user.id,
          category: input.category as MemoryCategory,
          title: input.title,
          content: input.content,
          sourceTaskId: input.sourceTaskId ?? null,
          confidence: input.confidence,
        });
      }),
    list: protectedProcedure
      .input(z.object({ category: z.enum(memoryCategories).optional(), limit: z.number().int().min(1).max(100).default(50) }).optional())
      .query(async ({ ctx, input }) => {
        return listMemoryByCategory(ctx.user.id, input?.category as MemoryCategory | undefined, input?.limit ?? 50);
      }),
    search: protectedProcedure
      .input(z.object({ query: z.string().trim().max(400).default(""), limit: z.number().int().min(1).max(100).default(30) }))
      .query(async ({ ctx, input }) => {
        return searchMemory(ctx.user.id, input.query, input.limit);
      }),
  }),
  files: router({
    listForTask: protectedProcedure
      .input(z.object({ taskId: z.number().int().positive(), limit: z.number().int().min(1).max(400).default(200) }))
      .query(async ({ ctx, input }) => {
        await requireOwnedTask(input.taskId, ctx.user.id);
        return listTaskFiles(input.taskId, ctx.user.id, input.limit);
      }),
    listAll: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(800).default(400) }).optional())
      .query(async ({ ctx, input }) => {
        return listAllFilesForOwner(ctx.user.id, input?.limit ?? 400);
      }),
    listGlobal: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(400).default(200) }).optional())
      .query(async ({ ctx, input }) => {
        return listGlobalFilesForOwner(ctx.user.id, input?.limit ?? 200);
      }),
    createMetadata: protectedProcedure
      .input(
        z.object({
          taskId: z.number().int().positive().optional(),
          scope: z.enum(["task", "global"]).default("task"),
          relativePath: z.string().trim().min(1).max(1024),
          storageKey: z.string().trim().min(1).max(2048),
          storageUrl: z.string().trim().min(1).max(2048),
          mimeType: z.string().trim().max(160).nullable().optional(),
          sizeBytes: z.number().int().min(0).default(0),
          version: z.number().int().min(1).default(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const relativePath = assertSafeRelativePath(input.relativePath);
        if (input.scope === "global") {
          return createGlobalFile({
            ownerUserId: ctx.user.id,
            relativePath,
            storageKey: input.storageKey,
            storageUrl: input.storageUrl,
            mimeType: input.mimeType ?? null,
            sizeBytes: input.sizeBytes,
            version: input.version,
          });
        }
        if (!input.taskId) throw new Error("taskId is required when recording task file metadata");
        await requireOwnedTask(input.taskId, ctx.user.id);
        const file = await createTaskFile({
          taskId: input.taskId,
          ownerUserId: ctx.user.id,
          relativePath,
          storageKey: input.storageKey,
          storageUrl: input.storageUrl,
          mimeType: input.mimeType ?? null,
          sizeBytes: input.sizeBytes,
          version: input.version,
        });
        await appendTaskEvent({
          taskId: input.taskId,
          ownerUserId: ctx.user.id,
          actor: "system",
          eventType: "file_event",
          status: "succeeded",
          content: `File metadata recorded: ${relativePath}`,
          metadataJson: serializeJson({ fileId: file.id, storageKey: file.storageKey }),
        });
        return file;
      }),
    get: protectedProcedure
      .input(z.object({ fileId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const file = await getTaskFileForOwner(input.fileId, ctx.user.id);
        if (!file) throw new Error("File not found or not owned by the authenticated user");
        return file;
      }),
  }),
  filesystem: router({
    tree: protectedProcedure
      .input(z.object({ relativePath: z.string().trim().max(1024).default(""), depth: z.number().int().min(0).max(4).default(2) }).optional())
      .query(async ({ ctx, input }) => {
        const rootPath = await getUserWorkspaceRoot(ctx.user.id);
        return listWorkspaceDirectory(rootPath, input?.relativePath ?? "", input?.depth ?? 2);
      }),
    read: protectedProcedure
      .input(z.object({ relativePath: z.string().trim().min(1).max(1024) }))
      .query(async ({ ctx, input }) => {
        const rootPath = await getUserWorkspaceRoot(ctx.user.id);
        return readWorkspaceFile(rootPath, input.relativePath);
      }),
    write: protectedProcedure
      .input(
        z.object({
          taskId: z.number().int().positive().nullable().optional(),
          relativePath: z.string().trim().min(1).max(1024),
          content: z.string().max(1_000_000),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        if (input.taskId) await requireOwnedTask(input.taskId, ctx.user.id);
        const rootPath = await getUserWorkspaceRoot(ctx.user.id);
        const written = await writeWorkspaceFile(rootPath, input.relativePath, input.content);
        if (input.taskId) {
          const snapshot = await snapshotWorkspacePath({
            rootPath,
            workspaceId: input.taskId,
            ownerUserId: ctx.user.id,
            relativePath: written.relativePath,
            action: "update",
          });
          const file = await createTaskFile({
            taskId: input.taskId,
            ownerUserId: ctx.user.id,
            relativePath: written.relativePath,
            storageKey: snapshot.storageKey,
            storageUrl: snapshot.storageUrl,
            mimeType: "text/plain; charset=utf-8",
            sizeBytes: written.size,
            version: 1,
          });
          await appendTaskEvent({
            taskId: input.taskId,
            ownerUserId: ctx.user.id,
            actor: "system",
            eventType: "file_event",
            status: "succeeded",
            content: `Workspace file saved and snapshotted: ${written.relativePath}`,
            metadataJson: serializeJson({ fileId: file.id, storageKey: file.storageKey }),
          });
          return { ...written, file };
        }
        return written;
      }),
    mkdir: protectedProcedure
      .input(z.object({ relativePath: z.string().trim().min(1).max(1024) }))
      .mutation(async ({ ctx, input }) => {
        const rootPath = await getUserWorkspaceRoot(ctx.user.id);
        return createWorkspaceDirectory(rootPath, input.relativePath);
      }),
    rename: protectedProcedure
      .input(z.object({ fromRelativePath: z.string().trim().min(1).max(1024), toRelativePath: z.string().trim().min(1).max(1024) }))
      .mutation(async ({ ctx, input }) => {
        const rootPath = await getUserWorkspaceRoot(ctx.user.id);
        return renameWorkspacePath(rootPath, input.fromRelativePath, input.toRelativePath);
      }),
    delete: protectedProcedure
      .input(z.object({ relativePath: z.string().trim().min(1).max(1024) }))
      .mutation(async ({ ctx, input }) => {
        const rootPath = await getUserWorkspaceRoot(ctx.user.id);
        return deleteWorkspacePath(rootPath, input.relativePath);
      }),
    upload: protectedProcedure
      .input(
        z.object({
          taskId: z.number().int().positive().nullable().optional(),
          scope: z.enum(["task", "global"]).default("task"),
          relativePath: z.string().trim().min(1).max(1024),
          base64Content: z.string().min(1),
          mimeType: z.string().trim().max(160).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const isGlobalUpload = input.scope === "global";
        if (!isGlobalUpload && !input.taskId) throw new Error("Select a task before uploading to a task folder");
        if (input.taskId) await requireOwnedTask(input.taskId, ctx.user.id);
        const rootPath = await getUserWorkspaceRoot(ctx.user.id);
        const uploaded = await uploadWorkspaceFile({
          rootPath,
          workspaceId: isGlobalUpload ? 0 : input.taskId ?? 0,
          ownerUserId: ctx.user.id,
          relativePath: input.relativePath,
          base64Content: input.base64Content,
          mimeType: input.mimeType,
        });
        if (isGlobalUpload) {
          const file = await createGlobalFile({
            ownerUserId: ctx.user.id,
            relativePath: uploaded.relativePath,
            storageKey: uploaded.storageKey,
            storageUrl: uploaded.storageUrl,
            mimeType: input.mimeType ?? null,
            sizeBytes: uploaded.size,
            version: 1,
          });
          return { ...uploaded, file };
        }
        if (input.taskId) {
          const file = await createTaskFile({
            taskId: input.taskId,
            ownerUserId: ctx.user.id,
            relativePath: uploaded.relativePath,
            storageKey: uploaded.storageKey,
            storageUrl: uploaded.storageUrl,
            mimeType: input.mimeType ?? null,
            sizeBytes: uploaded.size,
            version: 1,
          });
          await appendTaskEvent({
            taskId: input.taskId,
            ownerUserId: ctx.user.id,
            actor: "system",
            eventType: "file_event",
            status: "succeeded",
            content: `Workspace file uploaded: ${uploaded.relativePath}`,
            metadataJson: serializeJson({ fileId: file.id, storageKey: file.storageKey }),
          });
          return { ...uploaded, file };
        }
        return uploaded;
      }),
    snapshot: protectedProcedure
      .input(z.object({ taskId: z.number().int().positive(), relativePath: z.string().trim().max(1024).default("") }))
      .mutation(async ({ ctx, input }) => {
        await requireOwnedTask(input.taskId, ctx.user.id);
        const rootPath = await getUserWorkspaceRoot(ctx.user.id);
        return snapshotWorkspacePath({ rootPath, workspaceId: input.taskId, ownerUserId: ctx.user.id, relativePath: input.relativePath, action: "snapshot" });
      }),
  }),
  credentials: router({
    status: protectedProcedure.query(async ({ ctx }) => {
      const runtimeStates = getRuntimeCredentialStates();
      const latestSnapshots = await getLatestCredentialStatuses(ctx.user.id).catch(() => []);
      return {
        runtimeStates,
        latestSnapshots,
      };
    }),
    refresh: protectedProcedure
      .input(z.object({ providers: z.array(z.enum(credentialProviders)).default(["claude", "kimi"]) }).optional())
      .mutation(async ({ ctx, input }) => {
        const selectedProviders = new Set(input?.providers ?? credentialProviders);
        const states = getRuntimeCredentialStates().filter((state) => selectedProviders.has(state.provider));
        const snapshots = await recordRuntimeCredentialSnapshots(ctx.user.id, states);
        return { runtimeStates: states, snapshots };
      }),
  }),
});

export type AppRouter = typeof appRouter;
