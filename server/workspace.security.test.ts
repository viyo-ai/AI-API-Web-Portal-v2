import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  appendTaskEvent: vi.fn(),
  createMemory: vi.fn(),
  createTask: vi.fn(),
  createTaskFile: vi.fn(),
  createGlobalFile: vi.fn(),
  createTurn: vi.fn(),
  failTurn: vi.fn(),
  getLatestCredentialStatuses: vi.fn(),
  getTaskFileForOwner: vi.fn(),
  getTaskForOwner: vi.fn(),
  getTaskThread: vi.fn(),
  getTurnForOwner: vi.fn(),
  getUserPreference: vi.fn(),
  listAllFilesForOwner: vi.fn(),
  listGlobalFilesForOwner: vi.fn(),
  listMemoryByCategory: vi.fn(),
  listTaskEvents: vi.fn(),
  listTaskFiles: vi.fn(),
  listTasksForOwner: vi.fn(),
  listTurnsForTask: vi.fn(),
  listQueuedMessages: vi.fn(),
  markQueuedMessagesProcessing: vi.fn(),
  markQueuedMessagesSent: vi.fn(),
  enqueueTaskMessage: vi.fn(),
  updateQueuedTaskMessage: vi.fn(),
  cancelQueuedTaskMessage: vi.fn(),
  findActiveTurnForTask: vi.fn(),
  markTurnStopped: vi.fn(),
  stopTurn: vi.fn(),
  updateTurnApprovalState: vi.fn(),
  updateUserPreference: vi.fn(),
  formatQueuedMessagesForGeneration: vi.fn((queued: Array<{ content: string }>) => queued.map((item) => item.content).join("\n")),
  recordCredentialStatus: vi.fn(),
  renameTask: vi.fn(),
  searchMemory: vi.fn(),
  updateTaskStatus: vi.fn(),
  autoAttachRootGlobalFiles: vi.fn(),
  assertSafeRelativePath: vi.fn((relativePath: string) => {
    const normalized = relativePath.trim().replace(/\\/g, "/");
    if (!normalized) throw new Error("File path is required");
    if (normalized.startsWith("/") || normalized.includes("..") || normalized.includes("//")) throw new Error("Unsafe file path");
    return normalized;
  }),
}));

const governanceMocks = vi.hoisted(() => ({
  loadGovernanceForTask: vi.fn(async () => ({
    documents: [],
    missingRequired: [],
    skippedOptional: [],
    loadDurationMs: 0,
    budgetEnforcementEnabled: false,
  })),
  validateGovernanceFiles: vi.fn((files: unknown) => ({ files, errors: [] })),
}));

const wrapperMocks = vi.hoisted(() => ({
  CLAUDE_DEFAULT_MODEL: "claude-opus-4-7",
  CLAUDE_OWNER_MODEL_LABEL: "Claude Opus 4.7",
  KIMI_K26_CLOUDFLARE_MODEL: "@cf/moonshotai/kimi-k2.6",
  KIMI_OWNER_MODEL_LABEL: "Kimi K2.6",
  orchestrateWithOpenAI: vi.fn(async (message: string) => {
    // Default: route planning requests to Claude, building to Kimi
    if (message.toLowerCase().includes('plan') || message.toLowerCase().includes('architecture')) {
      return { route: 'claude', reasoning: 'Planning request detected' };
    }
    if (message.toLowerCase().includes('build') || message.toLowerCase().includes('code')) {
      return { route: 'kimi', reasoning: 'Building request detected' };
    }
    return { route: 'claude', reasoning: 'Default to Claude for unclear intent' };
  }),
  resolveEffectiveRoute: vi.fn((route: string, credentialStates: any[]) => {
    const claudeConfigured = credentialStates.some((s: any) => s.provider === "claude" && s.configured);
    const kimiConfigured = credentialStates.some((s: any) => s.provider === "kimi" && s.configured);
    if (route === 'claude' && claudeConfigured) return 'claude';
    if (route === 'kimi' && kimiConfigured) return 'kimi';
    if (route === 'claude' && kimiConfigured) return 'kimi';
    if (route === 'kimi' && claudeConfigured) return 'claude';
    if (claudeConfigured && kimiConfigured) return 'dual';
    if (claudeConfigured) return 'claude';
    if (kimiConfigured) return 'kimi';
    return 'dual';
  }),
  executeWrapperTurn: vi.fn(),
  getWrapperRuntimeCredentialStates: vi.fn(),
}));

vi.mock("./db", () => dbMocks);
vi.mock("./buildRunner/loadGovernance", () => governanceMocks);
vi.mock("./wrapperLLM", () => wrapperMocks);

import { appRouter } from "./routers";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(userId = 42): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `user-${userId}`,
    email: `user-${userId}@example.com`,
    name: `User ${userId}`,
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as TrpcContext["res"],
  };
}

const ownedTask = {
  id: 77,
  ownerUserId: 42,
  title: "Owned v2 task",
  summary: "Security regression fixture.",
  status: "active",
  routeMode: "auto",
  createdAt: 1777998000000,
  updatedAt: 1777998000000,
  lastActivityAt: 1777998000000,
  archivedAt: null,
};

describe("v2 task ownership and credential-gate security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    governanceMocks.loadGovernanceForTask.mockResolvedValue({
      documents: [],
      missingRequired: [],
      skippedOptional: [],
      loadDurationMs: 0,
      budgetEnforcementEnabled: false,
    });
    wrapperMocks.getWrapperRuntimeCredentialStates.mockReturnValue([
      { provider: "claude", status: "missing", configured: false, reason: "Missing ANTHROPIC_API_KEY or CLAUDE_API_KEY." },
      { provider: "kimi", status: "missing", configured: false, reason: "Missing Cloudflare Workers AI credentials." },
    ]);
    dbMocks.appendTaskEvent.mockResolvedValue({ id: 1 });
    dbMocks.createTurn.mockResolvedValue({ id: 444 });
    dbMocks.getTaskThread.mockResolvedValue({ task: { ...ownedTask, status: "blocked" }, events: [], activeTurn: null });
    dbMocks.getTurnForOwner.mockResolvedValue(null);
    dbMocks.getUserPreference.mockResolvedValue({ ownerUserId: 42, alwaysRequireKimiApproval: true, createdAt: 1777998000000, updatedAt: 1777998000000 });
    dbMocks.updateTurnApprovalState.mockResolvedValue(undefined);
    dbMocks.updateUserPreference.mockImplementation(async (input: any) => ({ ownerUserId: input.ownerUserId, alwaysRequireKimiApproval: input.alwaysRequireKimiApproval, createdAt: 1777998000000, updatedAt: 1777998100000 }));
    dbMocks.recordCredentialStatus.mockResolvedValue({ id: 1 });
    dbMocks.listTaskEvents.mockResolvedValue([]);
    dbMocks.listMemoryByCategory.mockResolvedValue([]);
    dbMocks.listTaskFiles.mockResolvedValue([]);
    dbMocks.listGlobalFilesForOwner.mockResolvedValue([]);
    dbMocks.listQueuedMessages.mockResolvedValue([]);
    dbMocks.autoAttachRootGlobalFiles.mockResolvedValue({ attached: [], missing: [] });
    dbMocks.markQueuedMessagesProcessing.mockResolvedValue([]);
    dbMocks.markQueuedMessagesSent.mockResolvedValue(undefined);
    dbMocks.findActiveTurnForTask.mockResolvedValue(null);
    dbMocks.enqueueTaskMessage.mockResolvedValue({ id: 1, taskId: ownedTask.id, ownerUserId: ownedTask.ownerUserId, content: "queued", state: "queued", position: 1 });
    dbMocks.updateQueuedTaskMessage.mockResolvedValue([]);
    dbMocks.cancelQueuedTaskMessage.mockResolvedValue([]);
    dbMocks.markTurnStopped.mockResolvedValue(undefined);
    dbMocks.stopTurn.mockResolvedValue(undefined);
  });

  it("rejects orchestration messages for tasks not owned by the authenticated user", async () => {
    dbMocks.getTaskForOwner.mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(createContext(42));

    await expect(caller.orchestration.submitMessage({ taskId: 123, message: "Plan the next step", routeMode: "auto" })).rejects.toThrow(
      "Task not found or not owned by the authenticated user",
    );
    expect(dbMocks.getTaskForOwner).toHaveBeenCalledWith(123, 42);
    expect(dbMocks.createTurn).not.toHaveBeenCalled();
    expect(wrapperMocks.executeWrapperTurn).not.toHaveBeenCalled();
  });

  it("creates only the task record and status event even if an initial message is supplied", async () => {
    dbMocks.createTask.mockResolvedValueOnce({ ...ownedTask, id: 88, title: "New task" });
    dbMocks.getTaskThread.mockResolvedValueOnce({ task: { ...ownedTask, id: 88, title: "New task" }, events: [], activeTurn: null });
    const caller = appRouter.createCaller(createContext(42));

    await caller.tasks.create({ title: "New task", routeMode: "auto", initialMessage: "Do not initialize providers during creation." });

    expect(dbMocks.createTask).toHaveBeenCalledWith(expect.objectContaining({ ownerUserId: 42, title: "New task", routeMode: "auto" }));
    expect(dbMocks.appendTaskEvent).toHaveBeenCalledTimes(1);
    expect(dbMocks.appendTaskEvent).toHaveBeenCalledWith(expect.objectContaining({
      actor: "system",
      eventType: "status",
      content: expect.stringContaining("Task record created"),
    }));
    expect(dbMocks.createTurn).not.toHaveBeenCalled();
    expect(wrapperMocks.executeWrapperTurn).not.toHaveBeenCalled();
  });

  it("routes the first submitted AUTO message through OpenAI orchestration to Claude for unclear intent", async () => {
    wrapperMocks.getWrapperRuntimeCredentialStates.mockReturnValue([
      { provider: "claude", status: "configured", configured: true, reason: "Claude configured." },
      { provider: "kimi", status: "configured", configured: true, reason: "Kimi configured." },
    ]);
    dbMocks.getTaskForOwner.mockResolvedValue(ownedTask);
    wrapperMocks.executeWrapperTurn.mockResolvedValue({ route: "claude", finalAnswer: "Reviewed answer." });
    const caller = appRouter.createCaller(createContext(42));

    await caller.orchestration.submitMessage({ taskId: 77, message: "Start the task", routeMode: "auto" });

    expect(dbMocks.createTurn).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 77,
      ownerUserId: 42,
      route: "claude",
      state: "context_assembly",
      errorCode: null,
    }));
    // Check that route_decision event was appended (second call after user message)
    const calls = dbMocks.appendTaskEvent.mock.calls;
    const routeDecisionCall = calls.find((call: any[]) => call[0]?.eventType === "route_decision");
    expect(routeDecisionCall).toBeDefined();
    expect(routeDecisionCall[0]).toMatchObject({
      actor: "wrapper",
      eventType: "route_decision",
      status: "succeeded",
    });
    expect(wrapperMocks.executeWrapperTurn).toHaveBeenCalledWith(expect.objectContaining({ route: "claude", userMessage: "Start the task" }));
  });

  it("answers owner model-identity questions deterministically without opening a provider turn", async () => {
    wrapperMocks.getWrapperRuntimeCredentialStates.mockReturnValue([
      { provider: "claude", status: "configured", configured: true, reason: "Claude configured." },
      { provider: "kimi", status: "configured", configured: true, reason: "Kimi configured." },
    ]);
    dbMocks.getTaskForOwner.mockResolvedValue(ownedTask);
    const caller = appRouter.createCaller(createContext(42));

    await caller.orchestration.submitMessage({ taskId: 77, message: "What model am I using?", routeMode: "auto" });

    expect(dbMocks.appendTaskEvent).toHaveBeenCalledWith(expect.objectContaining({ actor: "user", content: "What model am I using?" }));
    expect(dbMocks.appendTaskEvent).toHaveBeenCalledWith(expect.objectContaining({
      actor: "system",
      eventType: "message",
      status: "succeeded",
      content: expect.stringContaining("You are using Auto mode by default"),
    }));
    expect(dbMocks.createTurn).not.toHaveBeenCalled();
    expect(wrapperMocks.executeWrapperTurn).not.toHaveBeenCalled();
  });

  it("routes to available provider when intent is unclear in AUTO mode (Claude is default)", async () => {
    wrapperMocks.getWrapperRuntimeCredentialStates.mockReturnValue([
      { provider: "claude", status: "configured", configured: true, reason: "Claude configured." },
      { provider: "kimi", status: "missing", configured: false, reason: "Kimi missing." },
    ]);
    dbMocks.getTaskForOwner.mockResolvedValue(ownedTask);
    const caller = appRouter.createCaller(createContext(42));

    await caller.orchestration.submitMessage({ taskId: 77, message: "Start the task", routeMode: "auto" });

    expect(dbMocks.createTurn).toHaveBeenCalledWith(expect.objectContaining({ route: "claude", state: "context_assembly" }));
    expect(dbMocks.appendTaskEvent).toHaveBeenCalledWith(expect.objectContaining({
      actor: "wrapper",
      eventType: "route_decision",
      status: "succeeded",
      content: expect.stringContaining("Route CLAUDE is credential-ready"),
    }));
    expect(wrapperMocks.executeWrapperTurn).toHaveBeenCalled();
  });

  it("blocks #claude work explicitly when the required server credential is missing", async () => {
    dbMocks.getTaskForOwner.mockResolvedValue(ownedTask);
    const caller = appRouter.createCaller(createContext(42));

    const result = await caller.orchestration.submitMessage({ taskId: 77, message: "#claude review release risk", routeMode: "auto" });

    expect(dbMocks.recordCredentialStatus).toHaveBeenCalledWith(expect.objectContaining({ ownerUserId: 42, provider: "claude", status: "missing" }));
    expect(dbMocks.createTurn).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 77,
      ownerUserId: 42,
      route: "blocked",
      state: "blocked",
      errorCode: "CREDENTIALS_UNAVAILABLE",
    }));
    expect(dbMocks.appendTaskEvent).toHaveBeenCalledWith(expect.objectContaining({ actor: "user", content: "review release risk" }));
    expect(dbMocks.updateTaskStatus).toHaveBeenCalledWith(77, 42, "blocked");
    expect(wrapperMocks.executeWrapperTurn).not.toHaveBeenCalled();
    expect(result).toMatchObject({ task: { id: 77, status: "blocked" } });
  });

  it("defaults §9 Kimi approval preference on and converts Kimi-routed submissions into an approval-gated dual handoff", async () => {
    wrapperMocks.getWrapperRuntimeCredentialStates.mockReturnValue([
      { provider: "claude", status: "configured", configured: true, reason: null },
      { provider: "kimi", status: "configured", configured: true, reason: null },
    ]);
    dbMocks.getTaskForOwner.mockResolvedValueOnce({ ...ownedTask, status: "active", routeMode: "kimi" });
    dbMocks.getUserPreference.mockResolvedValueOnce({ ownerUserId: 42, alwaysRequireKimiApproval: true, createdAt: 1777998000000, updatedAt: 1777998000000 });
    const caller = appRouter.createCaller(createContext(42));

    await caller.orchestration.submitMessage({ taskId: 77, message: "Implement the safe handoff", routeMode: "kimi" });

    expect(dbMocks.createTurn).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 77,
      ownerUserId: 42,
      route: "dual",
      state: "context_assembly",
    }));
    expect(wrapperMocks.executeWrapperTurn).toHaveBeenCalledWith(expect.objectContaining({
      route: "dual",
      requireApprovalBeforeKimi: true,
    }));
  });

  it("resumes an approved §9 Claude-to-Kimi handoff with the stored plan and without requesting a fresh approval pause", async () => {
    const awaitingTurn = {
      id: 777,
      taskId: 77,
      ownerUserId: 42,
      routeMode: "dual",
      route: "dual",
      state: "awaiting_approval",
      approvalStatus: "awaiting_owner",
      approvalPlanContent: "Stored Claude plan for Kimi.",
      startedAt: 1777999000000,
      completedAt: null,
      errorMessage: null,
    };
    dbMocks.getTaskForOwner.mockResolvedValueOnce({ ...ownedTask, status: "active" });
    dbMocks.getTurnForOwner.mockResolvedValueOnce(awaitingTurn);
    const caller = appRouter.createCaller(createContext(42));

    await caller.orchestration.approveKimiHandoff({ taskId: 77, turnId: 777 });

    expect(dbMocks.appendTaskEvent).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 77,
      ownerUserId: 42,
      actor: "user",
      eventType: "status",
      status: "succeeded",
      content: expect.stringContaining("Owner approved Kimi handoff"),
    }));
    expect(wrapperMocks.executeWrapperTurn).toHaveBeenCalledWith(expect.objectContaining({
      turnId: 777,
      route: "dual",
      approvedClaudePlan: "Stored Claude plan for Kimi.",
      requireApprovalBeforeKimi: false,
    }));
  });

  it("handles §9 revision requests by cancelling the paused plan and forcing a fresh approval-gated Claude plan", async () => {
    wrapperMocks.getWrapperRuntimeCredentialStates.mockReturnValue([
      { provider: "claude", status: "configured", configured: true, reason: null },
      { provider: "kimi", status: "configured", configured: true, reason: null },
    ]);
    const awaitingTurn = {
      id: 778,
      taskId: 77,
      ownerUserId: 42,
      routeMode: "dual",
      route: "dual",
      state: "awaiting_approval",
      approvalStatus: "awaiting_owner",
      approvalPlanContent: "Plan needing revision.",
      startedAt: 1777999000000,
      completedAt: null,
      errorMessage: null,
    };
    dbMocks.getTaskForOwner.mockResolvedValueOnce({ ...ownedTask, status: "active" });
    dbMocks.getTurnForOwner.mockResolvedValueOnce(awaitingTurn);
    const caller = appRouter.createCaller(createContext(42));

    await caller.orchestration.requestKimiHandoffRevision({ taskId: 77, turnId: 778, revisionMessage: "Add rollback proof before Kimi runs." });

    expect(dbMocks.updateTurnApprovalState).toHaveBeenCalledWith(expect.objectContaining({
      turnId: 778,
      ownerUserId: 42,
      state: "stopped",
      approvalStatus: "revision_requested",
      approvalDecisionMessage: "Owner requested a revised Claude plan before Kimi runs: Add rollback proof before Kimi runs.",
    }));
    expect(dbMocks.createTurn).toHaveBeenCalledWith(expect.objectContaining({ taskId: 77, ownerUserId: 42, route: "dual", state: "context_assembly" }));
    expect(wrapperMocks.executeWrapperTurn).toHaveBeenCalledWith(expect.objectContaining({
      route: "dual",
      requireApprovalBeforeKimi: true,
      userMessage: expect.stringContaining("Add rollback proof before Kimi runs."),
    }));
  });

  it("cancels a §9 waiting handoff through stopGeneration without starting Kimi or queue flush", async () => {
    const awaitingTurn = {
      id: 779,
      taskId: 77,
      ownerUserId: 42,
      routeMode: "dual",
      route: "dual",
      state: "awaiting_approval",
      approvalStatus: "awaiting_owner",
      approvalPlanContent: "Plan to cancel.",
      startedAt: 1777999000000,
      completedAt: null,
      errorMessage: null,
    };
    dbMocks.getTaskForOwner.mockResolvedValueOnce({ ...ownedTask, status: "active" });
    dbMocks.getTurnForOwner.mockResolvedValue(awaitingTurn);
    const caller = appRouter.createCaller(createContext(42));

    await caller.orchestration.stopGeneration({ taskId: 77, turnId: 779, activeOperation: "awaiting_approval" });

    expect(dbMocks.updateTurnApprovalState).toHaveBeenCalledWith(expect.objectContaining({
      turnId: 779,
      ownerUserId: 42,
      state: "stopped",
      approvalStatus: "cancelled",
    }));
    expect(dbMocks.stopTurn).toHaveBeenCalledWith(
      779,
      42,
      "Stop requested while waiting for owner approval."
    );
    expect(wrapperMocks.executeWrapperTurn).not.toHaveBeenCalled();
  });

  it("records file metadata only after task ownership and safe relative path validation", async () => {
    dbMocks.getTaskForOwner.mockResolvedValue(ownedTask);
    dbMocks.createTaskFile.mockResolvedValueOnce({
      id: 22,
      taskId: 77,
      ownerUserId: 42,
      relativePath: "docs/result.md",
      storageKey: "docs/result.md",
      storageUrl: "/manus-storage/result.md",
      mimeType: "text/markdown",
      sizeBytes: 128,
      version: 1,
      createdAt: 1777999000000,
      updatedAt: 1777999000000,
    });
    const caller = appRouter.createCaller(createContext(42));

    const result = await caller.files.createMetadata({
      taskId: 77,
      relativePath: "docs/result.md",
      storageKey: "docs/result.md",
      storageUrl: "/manus-storage/result.md",
      mimeType: "text/markdown",
      sizeBytes: 128,
      version: 1,
    });

    expect(dbMocks.getTaskForOwner).toHaveBeenCalledWith(77, 42);
    expect(dbMocks.assertSafeRelativePath).toHaveBeenCalledWith("docs/result.md");
    expect(dbMocks.createTaskFile).toHaveBeenCalledWith(expect.objectContaining({ taskId: 77, ownerUserId: 42, relativePath: "docs/result.md" }));
    expect(dbMocks.appendTaskEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "file_event", content: "File metadata recorded: docs/result.md" }));
    expect(result).toMatchObject({ id: 22, relativePath: "docs/result.md" });
  });

  it("rejects unsafe task-file paths before writing metadata", async () => {
    dbMocks.getTaskForOwner.mockResolvedValue(ownedTask);
    const caller = appRouter.createCaller(createContext(42));

    await expect(
      caller.files.createMetadata({
        taskId: 77,
        relativePath: "../secrets.env",
        storageKey: "../secrets.env",
        storageUrl: "/manus-storage/secrets.env",
        mimeType: "text/plain",
        sizeBytes: 1,
        version: 1,
      }),
    ).rejects.toThrow("Unsafe file path");
    expect(dbMocks.createTaskFile).not.toHaveBeenCalled();
  });

  it("lists global-library files through the owner-scoped backend helper", async () => {
    const globalFile = {
      id: 31,
      taskId: -42,
      ownerUserId: 42,
      relativePath: "global-library/brand-standard.pdf",
      storageKey: "global-library/brand-standard.pdf",
      storageUrl: "/manus-storage/global-library/brand-standard.pdf",
      mimeType: "application/pdf",
      sizeBytes: 512,
      version: 1,
      createdAt: 1777999100000,
      updatedAt: 1777999100000,
    };
    dbMocks.listGlobalFilesForOwner.mockResolvedValueOnce([globalFile]);
    const caller = appRouter.createCaller(createContext(42));

    const result = await caller.files.listGlobal({ limit: 25 });

    expect(dbMocks.listGlobalFilesForOwner).toHaveBeenCalledWith(42, 25);
    expect(result).toEqual([globalFile]);
  });

  it("records global-library metadata without requiring or touching a selected task", async () => {
    dbMocks.createGlobalFile.mockResolvedValueOnce({
      id: 32,
      taskId: -42,
      ownerUserId: 42,
      relativePath: "global-library/reusable-standard.md",
      storageKey: "global-library/reusable-standard.md",
      storageUrl: "/manus-storage/global-library/reusable-standard.md",
      mimeType: "text/markdown",
      sizeBytes: 64,
      version: 1,
      createdAt: 1777999200000,
      updatedAt: 1777999200000,
    });
    const caller = appRouter.createCaller(createContext(42));

    const result = await caller.files.createMetadata({
      scope: "global",
      relativePath: "global-library/reusable-standard.md",
      storageKey: "global-library/reusable-standard.md",
      storageUrl: "/manus-storage/global-library/reusable-standard.md",
      mimeType: "text/markdown",
      sizeBytes: 64,
      version: 1,
    });

    expect(dbMocks.getTaskForOwner).not.toHaveBeenCalled();
    expect(dbMocks.createGlobalFile).toHaveBeenCalledWith(expect.objectContaining({
      ownerUserId: 42,
      relativePath: "global-library/reusable-standard.md",
      storageKey: "global-library/reusable-standard.md",
    }));
    expect(dbMocks.appendTaskEvent).not.toHaveBeenCalledWith(expect.objectContaining({ eventType: "file_event" }));
    expect(result).toMatchObject({ id: 32, relativePath: "global-library/reusable-standard.md" });
  });

  it("creates task-linked global memory only after source-task ownership is verified", async () => {
    const memoryRecord = {
      id: 501,
      ownerUserId: 42,
      category: "decision",
      title: "Architecture decision",
      content: "Keep provider diagnostics hidden unless the owner opens technical history.",
      sourceTaskId: 77,
      confidence: "verified",
      createdAt: 1778000000000,
      updatedAt: 1778000000000,
    };
    dbMocks.getTaskForOwner.mockResolvedValueOnce(ownedTask);
    dbMocks.createMemory.mockResolvedValueOnce(memoryRecord);
    const caller = appRouter.createCaller(createContext(42));

    const result = await caller.memory.create({
      category: "decision",
      title: "Architecture decision",
      content: "Keep provider diagnostics hidden unless the owner opens technical history.",
      sourceTaskId: 77,
      confidence: "verified",
    });

    expect(dbMocks.getTaskForOwner).toHaveBeenCalledWith(77, 42);
    expect(dbMocks.createMemory).toHaveBeenCalledWith(expect.objectContaining({ ownerUserId: 42, category: "decision", sourceTaskId: 77, confidence: "verified" }));
    expect(result).toMatchObject({ id: 501, title: "Architecture decision", sourceTaskId: 77 });
  });

  it("rejects memory creation when the source task is not owned by the authenticated user", async () => {
    dbMocks.getTaskForOwner.mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(createContext(42));

    await expect(
      caller.memory.create({
        category: "feature",
        title: "Unowned task source",
        content: "This memory should not be created.",
        sourceTaskId: 999,
        confidence: "medium",
      }),
    ).rejects.toThrow("Task not found or not owned by the authenticated user");

    expect(dbMocks.createMemory).not.toHaveBeenCalled();
  });

  it("lists and searches global memory through owner-scoped backend helpers", async () => {
    const memoryRecord = {
      id: 601,
      ownerUserId: 42,
      category: "research",
      title: "Provider routing evidence",
      content: "Claude handles planning and Kimi handles code-oriented prompts.",
      sourceTaskId: null,
      confidence: "high",
      createdAt: 1778000100000,
      updatedAt: 1778000100000,
    };
    dbMocks.listMemoryByCategory.mockResolvedValueOnce([memoryRecord]);
    dbMocks.searchMemory.mockResolvedValueOnce([memoryRecord]);
    const caller = appRouter.createCaller(createContext(42));

    const listed = await caller.memory.list({ category: "research", limit: 10 });
    const searched = await caller.memory.search({ query: "routing", limit: 5 });

    expect(dbMocks.listMemoryByCategory).toHaveBeenCalledWith(42, "research", 10);
    expect(dbMocks.searchMemory).toHaveBeenCalledWith(42, "routing", 5);
    expect(listed).toEqual([memoryRecord]);
    expect(searched).toEqual([memoryRecord]);
  });
});
