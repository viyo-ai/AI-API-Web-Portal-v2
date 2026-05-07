import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  appendTaskEvent: vi.fn(),
  autoAttachRootGlobalFiles: vi.fn(),
  cancelQueuedTaskMessage: vi.fn(),
  createBuildBranch: vi.fn(),
  createBuildTarget: vi.fn(),
  createGlobalFile: vi.fn(),
  createMemory: vi.fn(),
  createSkill: vi.fn(),
  createTask: vi.fn(),
  createTaskFile: vi.fn(),
  createTurn: vi.fn(),
  deleteBuildBranch: vi.fn(),
  deleteSkill: vi.fn(),
  detachOrDeleteGlobalFileFromTask: vi.fn(),
  duplicateSkill: vi.fn(),
  enqueueTaskMessage: vi.fn(),
  failTurn: vi.fn(),
  formatQueuedMessagesForGeneration: vi.fn(),
  getBuildBranchForOwner: vi.fn(),
  getBuildTargetForOwner: vi.fn(),
  getDb: vi.fn(),
  getGlobalFileForOwner: vi.fn(),
  getSkillBySlugForOwner: vi.fn(),
  getSkillForOwner: vi.fn(),
  getTaskFileForOwner: vi.fn(),
  getTaskForOwner: vi.fn(),
  getTaskThread: vi.fn(),
  getValidWizardSessionCache: vi.fn(),
  linkTaskToBuildBranch: vi.fn(),
  linkTaskToBuildTarget: vi.fn(),
  listAllFilesForOwner: vi.fn(),
  listBuildBranchesForTarget: vi.fn(),
  listBuildTargetsForOwner: vi.fn(),
  listGlobalFileLinksForTask: vi.fn(),
  listGlobalFilesForOwner: vi.fn(),
  listMemoryByCategory: vi.fn(),
  listOfficialSkills: vi.fn(),
  listRootGovernanceGlobalFilesForOwner: vi.fn(),
  listSkillForOwner: vi.fn(),
  listSkillsForOwner: vi.fn(),
  listTaskEvents: vi.fn(),
  listTaskFiles: vi.fn(),
  listTasksForOwner: vi.fn(),
  listTaskSkillSelections: vi.fn(),
  listTurnsForTask: vi.fn(),
  markQueuedMessagesProcessing: vi.fn(),
  markQueuedMessagesSent: vi.fn(),
  parseAgentEnvVarMap: vi.fn((value: unknown) => (value && typeof value === "object" ? value : {})),
  parseJsonStringArray: vi.fn((value: unknown) => {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string") return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }),
  parseSkillJsonArray: vi.fn(() => []),
  parseSkillMetadata: vi.fn(() => ({})),
  recordCredentialStatus: vi.fn(),
  renameTask: vi.fn(),
  resolveSkillsForTask: vi.fn(() => []),
  searchMemory: vi.fn(),
  taskTypeLabel: vi.fn((taskType: string) => taskType),
  updateBuildBranchPushState: vi.fn(),
  updateBuildBranchState: vi.fn(),
  updateBuildBranchWorkspacePath: vi.fn(),
  updateBuildTarget: vi.fn(),
  archiveBuildTarget: vi.fn(),
  updateBuildTargetEnvMap: vi.fn(),
  updateBuildTargetGovernanceSettings: vi.fn(),
  updateQueuedTaskMessage: vi.fn(),
  updateSkill: vi.fn(),
  updateTaskStatus: vi.fn(),
  upsertTaskSkillSelection: vi.fn(),
  upsertWizardSessionCache: vi.fn(),
  storageGetSignedUrl: vi.fn(),
}));

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    appendTaskEvent: mocks.appendTaskEvent,
    autoAttachRootGlobalFiles: mocks.autoAttachRootGlobalFiles,
    cancelQueuedTaskMessage: mocks.cancelQueuedTaskMessage,
    createBuildBranch: mocks.createBuildBranch,
    createBuildTarget: mocks.createBuildTarget,
    createGlobalFile: mocks.createGlobalFile,
    createMemory: mocks.createMemory,
    createSkill: mocks.createSkill,
    createTask: mocks.createTask,
    createTaskFile: mocks.createTaskFile,
    createTurn: mocks.createTurn,
    deleteBuildBranch: mocks.deleteBuildBranch,
    deleteSkill: mocks.deleteSkill,
    detachOrDeleteGlobalFileFromTask: mocks.detachOrDeleteGlobalFileFromTask,
    duplicateSkill: mocks.duplicateSkill,
    enqueueTaskMessage: mocks.enqueueTaskMessage,
    failTurn: mocks.failTurn,
    formatQueuedMessagesForGeneration: mocks.formatQueuedMessagesForGeneration,
    getBuildBranchForOwner: mocks.getBuildBranchForOwner,
    getBuildTargetForOwner: mocks.getBuildTargetForOwner,
    getDb: mocks.getDb,
    getGlobalFileForOwner: mocks.getGlobalFileForOwner,
    getSkillBySlugForOwner: mocks.getSkillBySlugForOwner,
    getSkillForOwner: mocks.getSkillForOwner,
    getTaskFileForOwner: mocks.getTaskFileForOwner,
    getTaskForOwner: mocks.getTaskForOwner,
    getTaskThread: mocks.getTaskThread,
    getValidWizardSessionCache: mocks.getValidWizardSessionCache,
    linkTaskToBuildBranch: mocks.linkTaskToBuildBranch,
    linkTaskToBuildTarget: mocks.linkTaskToBuildTarget,
    listAllFilesForOwner: mocks.listAllFilesForOwner,
    listBuildBranchesForTarget: mocks.listBuildBranchesForTarget,
    listBuildTargetsForOwner: mocks.listBuildTargetsForOwner,
    listGlobalFileLinksForTask: mocks.listGlobalFileLinksForTask,
    listGlobalFilesForOwner: mocks.listGlobalFilesForOwner,
    listMemoryByCategory: mocks.listMemoryByCategory,
    listOfficialSkills: mocks.listOfficialSkills,
    listRootGovernanceGlobalFilesForOwner: mocks.listRootGovernanceGlobalFilesForOwner,
    listSkillsForOwner: mocks.listSkillsForOwner,
    listTaskEvents: mocks.listTaskEvents,
    listTaskFiles: mocks.listTaskFiles,
    listTasksForOwner: mocks.listTasksForOwner,
    listTaskSkillSelections: mocks.listTaskSkillSelections,
    listTurnsForTask: mocks.listTurnsForTask,
    markQueuedMessagesProcessing: mocks.markQueuedMessagesProcessing,
    markQueuedMessagesSent: mocks.markQueuedMessagesSent,
    parseAgentEnvVarMap: mocks.parseAgentEnvVarMap,
    parseJsonStringArray: mocks.parseJsonStringArray,
    parseSkillJsonArray: mocks.parseSkillJsonArray,
    parseSkillMetadata: mocks.parseSkillMetadata,
    recordCredentialStatus: mocks.recordCredentialStatus,
    renameTask: mocks.renameTask,
    resolveSkillsForTask: mocks.resolveSkillsForTask,
    searchMemory: mocks.searchMemory,
    taskTypeLabel: mocks.taskTypeLabel,
    updateBuildBranchPushState: mocks.updateBuildBranchPushState,
    updateBuildBranchState: mocks.updateBuildBranchState,
    updateBuildBranchWorkspacePath: mocks.updateBuildBranchWorkspacePath,
    updateBuildTarget: mocks.updateBuildTarget,
    archiveBuildTarget: mocks.archiveBuildTarget,
    updateBuildTargetEnvMap: mocks.updateBuildTargetEnvMap,
    updateBuildTargetGovernanceSettings: mocks.updateBuildTargetGovernanceSettings,
    updateQueuedTaskMessage: mocks.updateQueuedTaskMessage,
    updateSkill: mocks.updateSkill,
    updateTaskStatus: mocks.updateTaskStatus,
    upsertTaskSkillSelection: mocks.upsertTaskSkillSelection,
    upsertWizardSessionCache: mocks.upsertWizardSessionCache,
  };
});

vi.mock("./storage", () => ({
  storageGetSignedUrl: mocks.storageGetSignedUrl,
}));

import { buildBranches, buildTargets, tasks, taskGlobalFileLinks } from "../drizzle/schema";
import { appRouter } from "./routers";
import { PROJECT_GLOBAL_FILE_DETACH_ERROR, ROOT_GOVERNANCE_FILE_PATHS } from "./db";
import {
  renderGovernanceBlock,
  type LoadedGovernanceDocument,
} from "./buildRunner/loadGovernance";

const owner = { id: 7, openId: "owner-open-id", role: "admin" as const, name: "Owner" };
const makeCaller = () => appRouter.createCaller({ user: owner } as never);

function makeQueryDb(resultQueue: unknown[][]) {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => resultQueue.shift() ?? []),
        })),
      })),
    })),
  };
}

async function loadGovernanceForTaskWithDb(taskId: number, db: ReturnType<typeof makeQueryDb>) {
  vi.resetModules();
  vi.doMock("./db", () => ({
    getDb: vi.fn(async () => db),
    listRootGovernanceGlobalFilesForOwner: mocks.listRootGovernanceGlobalFilesForOwner,
  }));
  vi.doMock("./storage", () => ({
    storageGetSignedUrl: mocks.storageGetSignedUrl,
  }));
  const module = await import("./buildRunner/loadGovernance");
  return module.loadGovernanceForTask(taskId);
}

describe("Section 4.5 Project-to-task wiring contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.autoAttachRootGlobalFiles.mockResolvedValue({ attached: [], missing: [] });
    mocks.appendTaskEvent.mockResolvedValue(undefined);
    mocks.getTaskThread.mockResolvedValue({ task: { id: 101, title: "Implement portal wiring" }, events: [], files: [], turns: [] });
    mocks.storageGetSignedUrl.mockResolvedValue("https://storage.example/root");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Root governance rule", { status: 200 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("INV-S4-5-01 exposes additive task Project linkage and Global File source metadata", () => {
    expect(tasks.buildTargetId).toBeDefined();
    expect(taskGlobalFileLinks.source).toBeDefined();
  });

  it("INV-S4-5-02 declares the root default governance files that must auto-attach to every new task", () => {
    expect(ROOT_GOVERNANCE_FILE_PATHS).toEqual([
      "CLAUDE.md",
      "FOUNDATION_LOCK.md",
      "BULLET_1_DIRECTIVE.md",
      "CURRENT_BULLET.txt",
    ]);
  });

  it("INV-S4-5-03 carries the selected Project through actual task creation and creates an isolated Build Branch", async () => {
    const createdTask = { id: 101, ownerUserId: owner.id, title: "Implement portal wiring", buildTargetId: 42, buildBranchId: null, routeMode: "auto" };
    const target = { id: 42, ownerUserId: owner.id, status: "active", defaultBaseBranch: "main", repoUrl: "https://github.com/viyo-ai/AI-API-Web-Portal-v2", githubTokenEnvVar: "BUILD_TARGET_GITHUB_TOKEN", protectedBranchesJson: "[]", validationCommandsJson: "[]", agentEnvVarMapJson: "{}" };
    const branch = { id: 303, ownerUserId: owner.id, buildTargetId: 42, branchName: "agent-work/task-101-implement-portal-wiring", workspacePath: "/tmp/workspace", baseBranch: "main", state: "clean" };

    mocks.createTask.mockResolvedValue(createdTask);
    mocks.getBuildTargetForOwner.mockResolvedValue(target);
    mocks.getTaskForOwner.mockResolvedValueOnce({ ...createdTask, buildBranchId: null });
    mocks.createBuildBranch.mockResolvedValue({ ...branch, id: 303, workspacePath: "/tmp/branch-0" });
    mocks.updateBuildBranchWorkspacePath.mockResolvedValue(branch);
    mocks.linkTaskToBuildTarget.mockResolvedValue({ ...createdTask, buildTargetId: 42 });
    mocks.linkTaskToBuildBranch.mockResolvedValue({ ...createdTask, buildBranchId: 303 });

    await makeCaller().tasks.create({
      title: "Implement portal wiring",
      routeMode: "auto",
      buildTargetId: 42,
    });

    expect(mocks.createTask).toHaveBeenCalledWith(expect.objectContaining({ buildTargetId: 42, ownerUserId: owner.id }));
    expect(mocks.autoAttachRootGlobalFiles).toHaveBeenCalledWith(101, owner.id);
    expect(mocks.linkTaskToBuildTarget).toHaveBeenCalledWith(101, owner.id, 42);
    expect(mocks.createBuildBranch).toHaveBeenCalledWith(expect.objectContaining({
      buildTargetId: 42,
      ownerUserId: owner.id,
      branchName: expect.stringMatching(/^agent-work\/task-101-implement-portal-wiring$/),
      taskId: 101,
    }));
    expect(mocks.linkTaskToBuildBranch).toHaveBeenCalledWith(101, owner.id, 303);
    const creationEvent = mocks.appendTaskEvent.mock.calls[0]?.[0];
    expect(creationEvent).toEqual(expect.objectContaining({ taskId: 101 }));
    expect(JSON.parse(creationEvent.metadataJson)).toMatchObject({ buildTargetId: 42, buildBranchId: 303 });
  });

  it("INV-S4-5-04 carries the selected Project through actual first-message submission before queueing", async () => {
    const task = { id: 101, ownerUserId: owner.id, title: "Queued task", buildTargetId: null, buildBranchId: null, routeMode: "auto" };
    const target = { id: 42, ownerUserId: owner.id, status: "active", defaultBaseBranch: "main", repoUrl: "https://github.com/viyo-ai/AI-API-Web-Portal-v2", githubTokenEnvVar: "BUILD_TARGET_GITHUB_TOKEN", protectedBranchesJson: "[]", validationCommandsJson: "[]", agentEnvVarMapJson: "{}" };
    const wiredTask = { ...task, buildTargetId: 42, buildBranchId: 303 };

    mocks.getTaskForOwner.mockResolvedValueOnce(task).mockResolvedValueOnce({ ...task, buildTargetId: 42 });
    mocks.getBuildTargetForOwner.mockResolvedValue(target);
    mocks.linkTaskToBuildTarget.mockResolvedValue({ ...task, buildTargetId: 42 });
    mocks.createBuildBranch.mockResolvedValue({ id: 303, ownerUserId: owner.id, buildTargetId: 42, branchName: "agent-work/task-101-queued-task", workspacePath: "/tmp/branch-0", baseBranch: "main", state: "clean" });
    mocks.updateBuildBranchWorkspacePath.mockResolvedValue({ id: 303, workspacePath: "/tmp/branch-303" });
    mocks.linkTaskToBuildBranch.mockResolvedValue(wiredTask);
    mocks.getTaskThread.mockResolvedValue({ task: wiredTask, activeTurn: { id: 999 }, events: [], files: [], turns: [] });
    mocks.enqueueTaskMessage.mockResolvedValue({ id: 55, position: 1 });

    await makeCaller().orchestration.submitMessage({
      taskId: 101,
      message: "Continue the task",
      routeMode: "auto",
      buildTargetId: 42,
    });

    expect(mocks.linkTaskToBuildTarget).toHaveBeenCalledWith(101, owner.id, 42);
    expect(mocks.linkTaskToBuildBranch).toHaveBeenCalledWith(101, owner.id, 303);
    expect(mocks.enqueueTaskMessage).toHaveBeenCalledWith(expect.objectContaining({ taskId: 101, ownerUserId: owner.id, content: "Continue the task" }));
  });

  it("INV-S4-5-05 loads root defaults even when a task is not Project-backed", async () => {
    const db = makeQueryDb([[{ id: 101, ownerUserId: owner.id, buildBranchId: null }]]);
    mocks.getDb.mockResolvedValue(db);
    mocks.listRootGovernanceGlobalFilesForOwner.mockResolvedValue([{ relativePath: "CLAUDE.md", storageKey: "root-key" }]);

    const result = await loadGovernanceForTaskWithDb(101, db);

    expect(result.documents).toHaveLength(1);
    expect(result.documents[0]).toMatchObject({ path: "CLAUDE.md", source: "root_default", sourceLabel: "Root default", content: "Root governance rule" });
    expect(result.missingRequired).toEqual([]);
  });

  it("INV-S4-5-06 keeps Project rule books additive to root defaults", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "s4-5-governance-"));
    await writeFile(path.join(workspacePath, "project-rules.md"), "Project governance rule", "utf8");
    const db = makeQueryDb([
      [{ id: 101, ownerUserId: owner.id, buildBranchId: 303 }],
      [{ id: 303, ownerUserId: owner.id, buildTargetId: 42, workspacePath }],
      [{ id: 42, ownerUserId: owner.id, name: "Portal", governanceFilesJson: JSON.stringify([{ path: "project-rules.md", required: true, dynamic: false, role: "governance" }]), governanceBudgetEnforced: true }],
    ]);
    mocks.getDb.mockResolvedValue(db);
    mocks.listRootGovernanceGlobalFilesForOwner.mockResolvedValue([{ relativePath: "CLAUDE.md", storageKey: "root-key" }]);

    const result = await loadGovernanceForTaskWithDb(101, db);

    expect(result.targetName).toBe("Portal");
    expect(result.documents.map(document => document.source)).toEqual(["root_default", "project"]);
    expect(result.documents.map(document => document.content)).toEqual(["Root governance rule", "Project governance rule"]);
    expect(result.missingRequired).toEqual([]);
  });

  it("INV-S4-5-07 renders governance source labels for diagnostics and model context", () => {
    const block = renderGovernanceBlock({
      targetName: "Portal",
      documents: [
        {
          path: "CLAUDE.md",
          resolvedPath: "CLAUDE.md",
          content: "Root rule",
          required: true,
          source: "root_default",
          sourceLabel: "Root default",
        } satisfies LoadedGovernanceDocument,
        {
          path: "docs/rules.md",
          resolvedPath: "docs/rules.md",
          content: "Project rule",
          required: true,
          source: "project",
          sourceLabel: "Project",
        } satisfies LoadedGovernanceDocument,
      ],
    });
    expect(block).toContain("=== CLAUDE.md [source: Root default] ===");
    expect(block).toContain("=== docs/rules.md [source: Project] ===");
  });

  it("FU-01 blocks task-level deletion of Project-managed Global File links and preserves the link", async () => {
    const links = [{ id: 1, taskId: 101, globalFileId: 500, ownerUserId: owner.id, source: "project" }];
    mocks.detachOrDeleteGlobalFileFromTask.mockImplementation(async (taskId: number, globalFileId: number, ownerUserId: number) => {
      const link = links.find(candidate => candidate.taskId === taskId && candidate.globalFileId === globalFileId && candidate.ownerUserId === ownerUserId);
      if (!link) throw new Error("Global file link not found");
      if (link.source === "project" || link.source === "root_default") throw new Error(PROJECT_GLOBAL_FILE_DETACH_ERROR);
      links.splice(links.indexOf(link), 1);
      return { success: true, deleted: link };
    });

    await expect(makeCaller().files.detachGlobalFromTask({ taskId: 101, globalFileId: 500 })).rejects.toThrow(PROJECT_GLOBAL_FILE_DETACH_ERROR);

    expect(links).toEqual([{ id: 1, taskId: 101, globalFileId: 500, ownerUserId: owner.id, source: "project" }]);
    expect(mocks.detachOrDeleteGlobalFileFromTask).toHaveBeenCalledWith(101, 500, owner.id);
    expect(mocks.appendTaskEvent).not.toHaveBeenCalledWith(expect.objectContaining({ content: "Global file detached from this task." }));
  });
});
