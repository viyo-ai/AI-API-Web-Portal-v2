import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  appendTaskEvent: vi.fn(),
  createMemory: vi.fn(),
  createTask: vi.fn(),
  createTaskFile: vi.fn(),
  createTurn: vi.fn(),
  failTurn: vi.fn(),
  getLatestCredentialStatuses: vi.fn(),
  getTaskFileForOwner: vi.fn(),
  getTaskForOwner: vi.fn(),
  getTaskThread: vi.fn(),
  listAllFilesForOwner: vi.fn(),
  listMemoryByCategory: vi.fn(),
  listTaskEvents: vi.fn(),
  listTaskFiles: vi.fn(),
  listTasksForOwner: vi.fn(),
  listTurnsForTask: vi.fn(),
  recordCredentialStatus: vi.fn(),
  renameTask: vi.fn(),
  searchMemory: vi.fn(),
  updateTaskStatus: vi.fn(),
  assertSafeRelativePath: vi.fn((relativePath: string) => {
    const normalized = relativePath.trim().replace(/\\/g, "/");
    if (!normalized) throw new Error("File path is required");
    if (normalized.startsWith("/") || normalized.includes("..") || normalized.includes("//")) throw new Error("Unsafe file path");
    return normalized;
  }),
}));

const wrapperMocks = vi.hoisted(() => ({
  executeWrapperTurn: vi.fn(),
  getWrapperRuntimeCredentialStates: vi.fn(),
}));

vi.mock("./db", () => dbMocks);
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
    wrapperMocks.getWrapperRuntimeCredentialStates.mockReturnValue([
      { provider: "claude", status: "missing", configured: false, reason: "Missing ANTHROPIC_API_KEY or CLAUDE_API_KEY." },
      { provider: "kimi", status: "missing", configured: false, reason: "Missing Cloudflare Workers AI credentials." },
    ]);
    dbMocks.appendTaskEvent.mockResolvedValue({ id: 1 });
    dbMocks.createTurn.mockResolvedValue({ id: 444 });
    dbMocks.getTaskThread.mockResolvedValue({ task: { ...ownedTask, status: "blocked" }, events: [], activeTurn: null });
    dbMocks.recordCredentialStatus.mockResolvedValue({ id: 1 });
    dbMocks.listTaskEvents.mockResolvedValue([]);
    dbMocks.listMemoryByCategory.mockResolvedValue([]);
    dbMocks.listTaskFiles.mockResolvedValue([]);
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

  it("routes the first submitted AUTO message through dual Claude Opus and Kimi initialization when both credentials exist", async () => {
    wrapperMocks.getWrapperRuntimeCredentialStates.mockReturnValue([
      { provider: "claude", status: "configured", configured: true, reason: "Claude configured." },
      { provider: "kimi", status: "configured", configured: true, reason: "Kimi configured." },
    ]);
    dbMocks.getTaskForOwner.mockResolvedValue(ownedTask);
    wrapperMocks.executeWrapperTurn.mockResolvedValue({ route: "dual", finalAnswer: "Reviewed answer." });
    const caller = appRouter.createCaller(createContext(42));

    await caller.orchestration.submitMessage({ taskId: 77, message: "Start the task", routeMode: "auto" });

    expect(dbMocks.createTurn).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 77,
      ownerUserId: 42,
      route: "dual",
      state: "context_assembly",
      errorCode: null,
    }));
    expect(dbMocks.appendTaskEvent).toHaveBeenCalledWith(expect.objectContaining({
      actor: "wrapper",
      eventType: "route_decision",
      status: "succeeded",
      content: expect.stringContaining("AUTO first-message initialization"),
    }));
    expect(wrapperMocks.executeWrapperTurn).toHaveBeenCalledWith(expect.objectContaining({ route: "dual", userMessage: "Start the task" }));
  });

  it("blocks AUTO first-message initialization instead of degrading to one provider when either required credential is missing", async () => {
    wrapperMocks.getWrapperRuntimeCredentialStates.mockReturnValue([
      { provider: "claude", status: "configured", configured: true, reason: "Claude configured." },
      { provider: "kimi", status: "missing", configured: false, reason: "Kimi missing." },
    ]);
    dbMocks.getTaskForOwner.mockResolvedValue(ownedTask);
    const caller = appRouter.createCaller(createContext(42));

    await caller.orchestration.submitMessage({ taskId: 77, message: "Start the task", routeMode: "auto" });

    expect(dbMocks.createTurn).toHaveBeenCalledWith(expect.objectContaining({ route: "blocked", state: "blocked", errorCode: "CREDENTIALS_UNAVAILABLE" }));
    expect(dbMocks.appendTaskEvent).toHaveBeenCalledWith(expect.objectContaining({
      actor: "wrapper",
      eventType: "route_decision",
      status: "blocked",
      content: expect.stringContaining("requires both Claude Opus 4.7"),
    }));
    expect(wrapperMocks.executeWrapperTurn).not.toHaveBeenCalled();
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
});
