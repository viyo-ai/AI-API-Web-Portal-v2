// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./Home";

const logoutMock = vi.fn();
const invalidateMock = vi.fn(async () => undefined);
const createTaskMock = vi.fn();
const updateTaskStatusMock = vi.fn();
const renameTaskMock = vi.fn();
const submitMessageMock = vi.fn();
const updateQueuedMessageMock = vi.fn();
const clearQueuedMessageMock = vi.fn();
const stopGenerationMock = vi.fn();
const updateKimiApprovalPreferenceMock = vi.fn();
const approveKimiHandoffMock = vi.fn();
const requestKimiHandoffRevisionMock = vi.fn();
const cancelKimiHandoffMock = vi.fn();
const createFileMetadataMock = vi.fn();
const uploadWorkspaceFileMock = vi.fn();
const attachGlobalToTaskMock = vi.fn();
const credentialsRefreshMock = vi.fn();
const createBuildTargetMock = vi.fn();
const updateBuildTargetSettingsMock = vi.fn();
const createBuildBranchMock = vi.fn();
const pushBuildBranchMock = vi.fn();
const analyzeWizardMock = vi.fn();
const completeWizardMock = vi.fn();
const testBuildTargetConnectionMock = vi.fn();
const filesystemTreeRefetchMock = vi.fn(async () => undefined);
const filesystemWriteMock = vi.fn();
const filesystemMkdirMock = vi.fn();

let resizeObserverCallbacks: Array<ResizeObserverCallback> = [];

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readonly url: string;
  readyState = FakeWebSocket.CONNECTING;
  sentMessages: string[] = [];
  private listeners = new Map<string, Set<(event: any) => void>>();

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
    queueMicrotask(() => {
      this.readyState = FakeWebSocket.OPEN;
      this.dispatch("open", {});
    });
  }

  addEventListener(type: string, listener: (event: any) => void) {
    const listeners = this.listeners.get(type) ?? new Set<(event: any) => void>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: (event: any) => void) {
    this.listeners.get(type)?.delete(listener);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
    this.dispatch("close", {});
  }

  dispatch(type: string, event: any) {
    for (const listener of Array.from(this.listeners.get(type) ?? [])) listener(event);
  }

  dispatchJson(payload: unknown) {
    this.dispatch("message", { data: JSON.stringify(payload) });
  }
}

const sampleTask = {
  id: 7,
  ownerUserId: 42,
  title: "Implement v2 shell",
  summary: "Wire the task-first Wrapper LLM workspace.",
  status: "active",
  routeMode: "auto",
  createdAt: 1777998000000,
  updatedAt: 1777999000000,
  lastActivityAt: 1777999000000,
  archivedAt: null,
};

type MockTask = Omit<typeof sampleTask, "archivedAt"> & { archivedAt: number | null };
let mockTasks: Array<MockTask> = [sampleTask];
let mockThread: unknown = {
  task: sampleTask,
  activeTurn: null,
  events: [
    {
      id: 101,
      taskId: 7,
      ownerUserId: 42,
      actor: "wrapper",
      eventType: "route_decision",
      status: "blocked",
      content: "Route AUTO is unavailable because missing credentials: claude.",
      metadataJson: "{}",
      createdAt: 1777999100000,
    },
  ],
};
let mockTaskFiles: Array<{ id: number; taskId: number; relativePath: string; storageUrl: string; version: number; mimeType: string | null; createdAt: number }> = [
  {
    id: 55,
    taskId: 7,
    relativePath: "docs/implementation-note.md",
    storageUrl: "/manus-storage/implementation-note.md",
    version: 2,
    mimeType: "text/markdown",
    createdAt: 1777999200000,
  },
];
let mockGlobalFiles: Array<{ id: number; taskId: null; scope: "global"; displayName: string; relativePath: string; storageUrl: string; version: number; mimeType: string | null; createdAt: number }> = [
  {
    id: 56,
    taskId: null,
    scope: "global",
    displayName: "Owner playbook.pdf",
    relativePath: "global-files/owner-playbook.pdf",
    storageUrl: "/manus-storage/global-files/owner-playbook.pdf",
    version: 1,
    mimeType: "application/pdf",
    createdAt: 1777999300000,
  },
];
let mockAttachedGlobalFiles: Array<{ id: number; taskId: number; globalFileId: number; attachedLabel: string; source: "root_default" | "project" | "manual"; file: (typeof mockGlobalFiles)[number] }> = [];
let mockMemory: Array<{ id: number; title: string; category: string; content: string }> = [
  { id: 88, title: "No silent fallback", category: "decision", content: "Missing Claude or Kimi credentials must block explicitly." },
];
let mockProjectMemory: Array<{ id: number; ownerUserId: number; buildTargetId: number; key: string; value: string; source: string; createdAt: number; updatedAt: number }> = [];
let mockCredentialStates: Array<{ provider: string; configured: boolean; status: string; reason: string; envVarName?: string; lastCheckedAt?: number }> = [
  { provider: "claude", configured: false, status: "missing", reason: "Missing CLAUDE_API_KEY." },
  { provider: "kimi", configured: true, status: "ready", reason: "KIMI_API_KEY configured." },
];
let mockKimiApprovalPreference = { ownerUserId: 42, alwaysRequireKimiApproval: true, createdAt: 1777998000000, updatedAt: 1777998000000 };
let mockBuildTargets: Array<{
  id: number;
  ownerUserId: number;
  name: string;
  repoUrl: string;
  defaultBaseBranch: string;
  protectedBranchesJson: string;
  validationCommandsJson: string;
  serviceChecksJson: string;
  agentEnvVarMapJson: string;
  governanceFilesJson: string;
  governanceBudgetEnforced: boolean;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
}> = [];

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { name: "THE CEO", email: "owner@example.com" },
    loading: false,
    error: null,
    isAuthenticated: true,
    logout: logoutMock,
  }),
}));

vi.mock("@/const", () => ({
  getLoginUrl: () => "/login",
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      tasks: { list: { invalidate: invalidateMock }, thread: { invalidate: invalidateMock } },
      files: { listForTask: { invalidate: invalidateMock }, listGlobalForTask: { invalidate: invalidateMock }, listAll: { invalidate: invalidateMock }, listGlobal: { invalidate: invalidateMock } },
      memory: { list: { invalidate: invalidateMock } },
      projectMemory: { list: { invalidate: invalidateMock } },
      credentials: { status: { invalidate: invalidateMock } },
      filesystem: { tree: { invalidate: invalidateMock }, read: { invalidate: invalidateMock } },
      buildTargets: { list: { invalidate: invalidateMock }, get: { invalidate: invalidateMock }, testConnection: { invalidate: invalidateMock }, updateSettings: { invalidate: invalidateMock }, analyzeWizard: { invalidate: invalidateMock }, completeWizard: { invalidate: invalidateMock } },
      buildBranch: { list: { invalidate: invalidateMock }, getStatus: { invalidate: invalidateMock } },
      buildBranches: { list: { invalidate: invalidateMock }, status: { invalidate: invalidateMock }, push: { invalidate: invalidateMock } },
      orchestration: { kimiApprovalPreference: { invalidate: invalidateMock } },
    }),
    tasks: {
      list: { useQuery: () => ({ data: mockTasks, isLoading: false }) },
      thread: { useQuery: () => ({ data: mockThread, isLoading: false }) },
      create: {
        useMutation: () => ({
          mutateAsync: createTaskMock,
          isPending: false,
        }),
      },
      updateStatus: {
        useMutation: () => ({
          mutateAsync: updateTaskStatusMock,
          isPending: false,
        }),
      },
      rename: {
        useMutation: () => ({
          mutateAsync: renameTaskMock,
          isPending: false,
        }),
      },
    },
    orchestration: {
      submitMessage: {
        useMutation: () => ({
          mutateAsync: submitMessageMock,
          isPending: false,
        }),
      },
      updateQueuedMessage: {
        useMutation: () => ({ mutateAsync: updateQueuedMessageMock, isPending: false }),
      },
      clearQueuedMessage: {
        useMutation: () => ({ mutateAsync: clearQueuedMessageMock, isPending: false }),
      },
      stopGeneration: {
        useMutation: () => ({ mutateAsync: stopGenerationMock, isPending: false }),
      },
      kimiApprovalPreference: { useQuery: () => ({ data: mockKimiApprovalPreference, isLoading: false }) },
      updateKimiApprovalPreference: { useMutation: () => ({ mutateAsync: updateKimiApprovalPreferenceMock, isPending: false }) },
      approveKimiHandoff: { useMutation: () => ({ mutateAsync: approveKimiHandoffMock, isPending: false }) },
      requestKimiHandoffRevision: { useMutation: () => ({ mutateAsync: requestKimiHandoffRevisionMock, isPending: false }) },
      cancelKimiHandoff: { useMutation: () => ({ mutateAsync: cancelKimiHandoffMock, isPending: false }) },
    },
    files: {
      listForTask: { useQuery: () => ({ data: mockTaskFiles, isLoading: false }) },
      listAll: { useQuery: () => ({ data: [...mockTaskFiles, ...mockGlobalFiles], isLoading: false }) },
      listGlobal: { useQuery: () => ({ data: mockGlobalFiles, isLoading: false }) },
      listGlobalForTask: { useQuery: () => ({ data: mockAttachedGlobalFiles, isLoading: false }) },
      attachGlobalToTask: {
        useMutation: () => ({
          mutateAsync: attachGlobalToTaskMock,
          isPending: false,
        }),
      },
      createMetadata: {
        useMutation: () => ({
          mutateAsync: createFileMetadataMock,
          isPending: false,
        }),
      },
    },
    memory: {
      list: { useQuery: () => ({ data: mockMemory, isLoading: false }) },
    },
    projectMemory: {
      list: { useQuery: () => ({ data: mockProjectMemory, isLoading: false }) },
    },
    filesystem: {
      tree: { useQuery: () => ({ data: { name: "workspace", relativePath: "", type: "directory", children: [] }, isLoading: false, refetch: filesystemTreeRefetchMock }) },
      read: { useQuery: () => ({ data: { relativePath: "README.md", content: "", exists: false }, isLoading: false }) },
      write: { useMutation: () => ({ mutate: filesystemWriteMock, isPending: false }) },
      mkdir: { useMutation: () => ({ mutate: filesystemMkdirMock, isPending: false }) },
      upload: { useMutation: () => ({ mutateAsync: uploadWorkspaceFileMock, isPending: false }) },
    },
    buildTargets: {
      list: { useQuery: () => ({ data: mockBuildTargets, isLoading: false }) },
      get: { useQuery: () => ({ data: undefined, isLoading: false }) },
      create: { useMutation: () => ({ mutateAsync: createBuildTargetMock, isPending: false }) },
      updateSettings: { useMutation: () => ({ mutateAsync: updateBuildTargetSettingsMock, isPending: false }) },
      testConnection: { useMutation: () => ({ mutateAsync: testBuildTargetConnectionMock, isPending: false }) },
      analyzeWizard: { useMutation: () => ({ mutateAsync: analyzeWizardMock, isPending: false }) },
      completeWizard: { useMutation: () => ({ mutateAsync: completeWizardMock, isPending: false }) },
    },
    buildBranch: {
      list: { useQuery: vi.fn(() => ({ data: [], isLoading: false })) },
      create: { useMutation: vi.fn(() => ({ mutateAsync: createBuildBranchMock, isPending: false })) },
      getStatus: { useQuery: vi.fn(() => ({ data: null, isLoading: false })) },
      delete: { useMutation: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })) },
    },
    buildBranches: {
      list: { useQuery: () => ({ data: [], isLoading: false }) },
      create: { useMutation: () => ({ mutateAsync: createBuildBranchMock, isPending: false }) },
      linkTask: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
      push: { useMutation: () => ({ mutateAsync: pushBuildBranchMock, isPending: false }) },
      status: { useQuery: () => ({ data: undefined, isLoading: false }) },
      workspaceTree: { useQuery: () => ({ data: { name: "workspace", relativePath: "", type: "directory", children: [] }, isLoading: false }) },
      cleanup: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
    },
    credentials: {
      status: {
        useQuery: () => ({
          data: {
              runtimeStates: mockCredentialStates,

            latestSnapshots: [],
          },
          isLoading: false,
        }),
      },
      refresh: {
        useMutation: () => ({
          mutateAsync: credentialsRefreshMock,
          isPending: false,
        }),
      },
    },
  },
}));

beforeAll(() => {
  class ResizeObserverStub {
    constructor(private readonly callback: ResizeObserverCallback) {
      resizeObserverCallbacks.push(callback);
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(globalThis, "ResizeObserver", { value: ResizeObserverStub, writable: true });
  Object.defineProperty(window, "requestAnimationFrame", { value: vi.fn((callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0)), writable: true });
  Object.defineProperty(window, "cancelAnimationFrame", { value: vi.fn((handle: number) => window.clearTimeout(handle)), writable: true });
  Object.defineProperty(window, "matchMedia", {
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
    writable: true,
  });
  Object.defineProperty(globalThis, "WebSocket", { value: FakeWebSocket, writable: true });
  Object.defineProperty(window, "WebSocket", { value: FakeWebSocket, writable: true });
  Object.defineProperty(window.Element.prototype, "setPointerCapture", { value: vi.fn(), writable: true });
  Object.defineProperty(window.Element.prototype, "releasePointerCapture", { value: vi.fn(), writable: true });
  Object.defineProperty(window.HTMLElement.prototype, "setPointerCapture", { value: vi.fn(), writable: true });
  Object.defineProperty(window.HTMLElement.prototype, "releasePointerCapture", { value: vi.fn(), writable: true });

});

beforeEach(() => {
  logoutMock.mockReset();
  invalidateMock.mockClear();
  createTaskMock.mockReset();
  updateTaskStatusMock.mockReset();
  renameTaskMock.mockReset();
  submitMessageMock.mockReset();
  updateQueuedMessageMock.mockReset();
  clearQueuedMessageMock.mockReset();
  stopGenerationMock.mockReset();
  updateKimiApprovalPreferenceMock.mockReset();
  approveKimiHandoffMock.mockReset();
  requestKimiHandoffRevisionMock.mockReset();
  cancelKimiHandoffMock.mockReset();
  createFileMetadataMock.mockReset();
  uploadWorkspaceFileMock.mockReset();
  attachGlobalToTaskMock.mockReset();
  credentialsRefreshMock.mockReset();
  createBuildTargetMock.mockReset();
  createBuildBranchMock.mockReset();
  pushBuildBranchMock.mockReset();
  analyzeWizardMock.mockReset();
  completeWizardMock.mockReset();
  testBuildTargetConnectionMock.mockReset();
  filesystemTreeRefetchMock.mockReset();
  filesystemWriteMock.mockReset();
  filesystemMkdirMock.mockReset();
  FakeWebSocket.instances = [];
  resizeObserverCallbacks = [];
  createTaskMock.mockResolvedValue({ task: { ...sampleTask, id: 19, title: "Created task" }, events: [], activeTurn: null });
  updateTaskStatusMock.mockResolvedValue({ ...sampleTask, status: "archived" });
  renameTaskMock.mockResolvedValue({ ...sampleTask, title: "Renamed task" });
  submitMessageMock.mockResolvedValue(mockThread);
  updateQueuedMessageMock.mockResolvedValue([]);
  clearQueuedMessageMock.mockResolvedValue([]);
  stopGenerationMock.mockResolvedValue({ stopped: true, stop: { destructiveOperation: false, boundary: "before_next_generation_step" } });
  updateKimiApprovalPreferenceMock.mockResolvedValue({ ownerUserId: 42, alwaysRequireKimiApproval: false, createdAt: 1777998000000, updatedAt: 1777999500000 });
  approveKimiHandoffMock.mockResolvedValue(mockThread);
  requestKimiHandoffRevisionMock.mockResolvedValue(mockThread);
  cancelKimiHandoffMock.mockResolvedValue(mockThread);
  createFileMetadataMock.mockResolvedValue(mockTaskFiles[0]);
  attachGlobalToTaskMock.mockResolvedValue({ id: 501, taskId: 7, globalFileId: 56, attachedLabel: "Owner playbook.pdf", file: mockGlobalFiles[0] });
  createBuildBranchMock.mockResolvedValue({ id: 301, branchName: "agent-work/plain-language", state: "clean", pushState: "never_pushed", workspacePath: "/tmp/plain-language", taskId: 7 });
  pushBuildBranchMock.mockResolvedValue({ branch: { id: 301, branchName: "agent-work/plain-language", state: "clean", pushState: "pushed", workspacePath: "/tmp/plain-language", taskId: 7 }, pushState: "pushed", pushedCommit: "1234567890abcdef", errorMessage: null, result: { pushState: "pushed", pushedCommit: "1234567890abcdef" } });
  testBuildTargetConnectionMock.mockResolvedValue({ status: "ok", message: "Repository connection succeeded." });
  analyzeWizardMock.mockResolvedValue({
    status: "ok",
    cacheStatus: "miss",
    connection: { status: "ok", message: "Repository access verified." },
    repoContext: {
      normalizedRepoUrl: "https://github.com/viyo-ai/AI-API-Web-Portal-v2.git",
      commitSha: "1234567890abcdef",
      fileCount: 240,
      scripts: ["check", "test", "build"],
      detectedFrameworks: ["React", "tRPC"],
      ruleBookCandidates: [],
    },
    recommendation: {
      defaultBaseBranch: { value: "main", confidence: "high", rationale: "Detected from the GitHub default branch." },
      branchStrategy: { value: { initialBuildBranch: "agent-work/portal-wizard-setup", protectedBranches: ["main", "staging"] }, confidence: "medium", rationale: "Keep protected branches read-only and use a separate Build Branch." },
      validationCommands: { value: ["pnpm check", "pnpm test", "pnpm build"], confidence: "high", rationale: "Detected from package scripts." },
      serviceChecks: { value: ["pnpm dev"], confidence: "medium", rationale: "Local service command is available." },
      projectRuleBooks: { value: [], confidence: "low", rationale: "No authoritative Project rule books were detected." },
      environmentVariables: { value: { PORTAL_GITHUB_TOKEN: "BUILD_TARGET_GITHUB_TOKEN" }, confidence: "medium", rationale: "Maps the agent token alias to the existing GitHub token env var." },
    },
    fallbackMessage: null,
  });
  completeWizardMock.mockResolvedValue({
    target: {
      id: 909,
      ownerUserId: 42,
      name: "AI API Portal",
      repoUrl: "https://github.com/viyo-ai/AI-API-Web-Portal-v2.git",
      defaultBaseBranch: "main",
      protectedBranchesJson: JSON.stringify(["main", "staging"]),
      validationCommandsJson: JSON.stringify(["pnpm check", "pnpm test", "pnpm build"]),
      serviceChecksJson: JSON.stringify(["pnpm dev"]),
      agentEnvVarMapJson: JSON.stringify({ PORTAL_GITHUB_TOKEN: "BUILD_TARGET_GITHUB_TOKEN" }),
      governanceFilesJson: JSON.stringify([]),
      governanceBudgetEnforced: true,
      archivedAt: null,
      createdAt: 1777999500000,
      updatedAt: 1777999500000,
    },
    branch: { id: 910, branchName: "agent-work/portal-wizard-setup", baseBranch: "main", state: "syncing", pushState: "never_pushed", workspacePath: "/tmp/portal-wizard-setup", taskId: null },
  });
  uploadWorkspaceFileMock.mockResolvedValue({
    relativePath: "uploads/1777999300000-owner-brief.txt",
    storageKey: "task-7/uploads/owner-brief.txt",
    storageUrl: "/manus-storage/task-7/uploads/owner-brief.txt",
    size: 11,
    file: { ...mockTaskFiles[0], relativePath: "uploads/owner-brief.txt", storageUrl: "/manus-storage/task-7/uploads/owner-brief.txt" },
  });
  credentialsRefreshMock.mockResolvedValue({ runtimeStates: [] });
  filesystemTreeRefetchMock.mockResolvedValue(undefined);
  mockTasks = [sampleTask];
  mockThread = {
    task: sampleTask,
    activeTurn: null,
    events: [
      {
        id: 101,
        taskId: 7,
        ownerUserId: 42,
        actor: "wrapper",
        eventType: "route_decision",
        status: "blocked",
        content: "Route AUTO is unavailable because missing credentials: claude.",
        metadataJson: "{}",
        createdAt: 1777999100000,
      },
    ],
  };
  mockTaskFiles = [
    {
      id: 55,
      taskId: 7,
      relativePath: "docs/implementation-note.md",
      storageUrl: "/manus-storage/implementation-note.md",
      version: 2,
      mimeType: "text/markdown",
      createdAt: 1777999200000,
    },
  ];
  mockGlobalFiles = [
    {
      id: 56,
      taskId: null,
      scope: "global",
      displayName: "Owner playbook.pdf",
      relativePath: "global-files/owner-playbook.pdf",
      storageUrl: "/manus-storage/global-files/owner-playbook.pdf",
      version: 1,
      mimeType: "application/pdf",
      createdAt: 1777999300000,
    },
  ];
  mockAttachedGlobalFiles = [];
  mockMemory = [{ id: 88, title: "No silent fallback", category: "decision", content: "Missing Claude or Kimi credentials must block explicitly." }];
  mockProjectMemory = [];
  mockCredentialStates = [
    { provider: "claude", configured: false, status: "missing", reason: "Missing CLAUDE_API_KEY." },
    { provider: "kimi", configured: true, status: "configured", reason: "Cloudflare Workers AI credentials are present." },
  ];
  mockKimiApprovalPreference = { ownerUserId: 42, alwaysRequireKimiApproval: true, createdAt: 1777998000000, updatedAt: 1777998000000 };
  mockBuildTargets = [];
} );

afterEach(() => {
  cleanup();
});

describe("Home v2 task-first workspace behavior", () => {
  it("renders the production three-pane workspace with a bounded center scroller and explicit route selector", async () => {
    render(<Home />);

    expect((await screen.findAllByText("Implement v2 shell")).length).toBeGreaterThan(0);
    expect(screen.getByText(/Task-first production workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/Center task thread/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Task folder/i).length).toBeGreaterThan(0);
    expect(screen.getByTestId("handoff-indicator")).toBeInTheDocument();
    expect(screen.getByTestId("task-inspector-tabs")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /files/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /AI Activity/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /context/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /diagnostics/i })).toBeInTheDocument();
    expect(screen.getByTestId("windows-file-manager")).toBeInTheDocument();
    expect(screen.getByText(/Wire the task-first AI coordinator workspace/i)).toBeInTheDocument();
    expect(screen.getByTestId("center-task-thread-scroll")).toHaveClass("overflow-y-auto");
    expect(screen.getByTestId("manus-style-composer")).toBeInTheDocument();
    expect(screen.queryByText(/Plan the next safe product step/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Enter sends · Shift\+Enter adds a line/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Send message/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Auto \(Default\).*dual/i })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /Kimi K2\.6/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Claude Opus 4\.7/i })).toBeInTheDocument();
    expect(screen.getAllByText(/No silent fallback/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/claude: missing/i)).toBeInTheDocument();
    expect(screen.getByText(/kimi: configured/i)).toBeInTheDocument();
    expect(screen.getByText(/Missing CLAUDE_API_KEY\./i)).toBeInTheDocument();
    expect(screen.queryByText(/TerminalPanel|WorkspaceCommandCenter|FilesystemPanel/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/PTY shell terminal/i)).not.toBeInTheDocument();
    expect(FakeWebSocket.instances).toHaveLength(0);
  });

  it("runs the §1A LLM-driven Project setup wizard through the required plain-English connection gate", async () => {
    const user = userEvent.setup();
    render(<Home />);

    expect(await screen.findByTestId("project-setup-wizard")).toBeInTheDocument();
    expect(screen.getByText(/Connect a Project/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/GitHub repository link/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Advanced setup/i }));
    expect(screen.getByTestId("advanced-project-setup")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Test connection/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add Project/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Use setup wizard/i }));

    await user.clear(screen.getByLabelText(/Project name/i));
    await user.type(screen.getByLabelText(/Project name/i), "AI API Portal");
    await user.type(screen.getByLabelText(/GitHub repository link/i), "https://github.com/viyo-ai/AI-API-Web-Portal-v2.git");
    await user.click(screen.getByRole("button", { name: /Test the connection/i }));

    await waitFor(() => expect(testBuildTargetConnectionMock).toHaveBeenCalledWith({
      repoUrl: "https://github.com/viyo-ai/AI-API-Web-Portal-v2.git",
      githubTokenEnvVar: "VIYO_GITHUB_TOKEN",
      defaultBaseBranch: "main",
    }));
    expect((await screen.findAllByText(/Connected\. Read access confirmed\./i)).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /Review recommended setup/i }));
    await waitFor(() => expect(analyzeWizardMock).toHaveBeenCalledWith({
      displayName: "AI API Portal",
      repoUrl: "https://github.com/viyo-ai/AI-API-Web-Portal-v2.git",
      githubTokenEnvVar: "VIYO_GITHUB_TOKEN",
      defaultBaseBranch: "main",
    }));
    expect(await screen.findByTestId("project-wizard-review")).toBeInTheDocument();
    expect(screen.getAllByTestId("setup-wizard-review-card")).toHaveLength(4);
    expect(screen.getByText(/Review AI recommendations/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Advanced settings \(optional\)/i }));
    expect(screen.getByText(/No Project rule books were detected/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/pnpm check/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Save Project/i }));

    await waitFor(() => expect(completeWizardMock).toHaveBeenCalledWith(expect.objectContaining({
      displayName: "AI API Portal",
      repoUrl: "https://github.com/viyo-ai/AI-API-Web-Portal-v2.git",
      githubTokenEnvVar: "VIYO_GITHUB_TOKEN",
      defaultBaseBranch: "main",
      initialBuildBranch: "agent-work/portal-wizard-setup",
      protectedBranches: ["main", "staging"],
      validationCommands: ["pnpm check", "pnpm test", "pnpm build"],
      serviceChecks: ["pnpm dev"],
      governanceFiles: [],
      agentEnvVarMap: { PORTAL_GITHUB_TOKEN: "BUILD_TARGET_GITHUB_TOKEN" },
    })));
    await waitFor(() => expect(screen.getAllByText(/Your Project is connected\. You can start a new task whenever you’re ready\./i).length).toBeGreaterThan(0));
  });

  it("§1A-CONV-FU-05 normalizes partial AI review output into safe Project completion defaults", async () => {
    const user = userEvent.setup();
    analyzeWizardMock.mockResolvedValueOnce({
      status: "ok",
      connection: { status: "ok", message: "Connected. Read access confirmed." },
      recommendation: {
        defaultBaseBranch: { value: "main", confidence: "high", rationale: "Detected from the GitHub default branch." },
        branchStrategy: { value: { initialBuildBranch: "portal-wizard-setup", protectedBranches: [] }, confidence: "low", rationale: "The AI review returned a branch name without the required safety prefix and no protected branch list." },
        validationCommands: { value: [], confidence: "low", rationale: "The AI review did not identify package validation commands." },
        serviceChecks: { value: [], confidence: "low", rationale: "No service check was detected." },
        projectRuleBooks: { value: [], confidence: "low", rationale: "No authoritative Project rule books were detected." },
        environmentVariables: { value: {}, confidence: "low", rationale: "No extra environment variables were detected." },
      },
      fallbackMessage: null,
    });
    render(<Home />);

    await user.type(await screen.findByLabelText(/GitHub repository link/i), "https://github.com/viyo-ai/AI-API-Web-Portal-v2.git");
    await user.click(screen.getByRole("button", { name: /Test the connection/i }));
    expect((await screen.findAllByText("Connected. Read access confirmed.")).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: /Review recommended setup/i }));
    expect(await screen.findByText(/Review AI recommendations/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("agent-work/portal-wizard-setup")).toBeInTheDocument();
    expect(screen.getAllByDisplayValue("main").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByDisplayValue(/pnpm check/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Save Project/i }));

    await waitFor(() => expect(completeWizardMock).toHaveBeenCalledWith(expect.objectContaining({
      repoUrl: "https://github.com/viyo-ai/AI-API-Web-Portal-v2.git",
      defaultBaseBranch: "main",
      initialBuildBranch: "agent-work/portal-wizard-setup",
      protectedBranches: ["main"],
      validationCommands: ["pnpm check", "pnpm test", "pnpm build"],
    })));
  });

  it("§1A-FU-04-01 presents the owner wizard in plain English without forbidden technical vocabulary", async () => {
    render(<Home />);

    const wizard = await screen.findByTestId("project-setup-wizard");
    expect(within(wizard).getByText(/Connect a Project/i)).toBeInTheDocument();
    expect(within(wizard).getAllByText(/Where is your code\?/i).length).toBeGreaterThan(0);
    expect(within(wizard).getAllByText(/How should we sign in to your code\?/i).length).toBeGreaterThan(0);
    expect(within(wizard).getByLabelText(/GitHub token \(stored as an environment variable\)/i)).toBeInTheDocument();
    expect(within(wizard).getAllByText(/Where Claude and Kimi will work/i).length).toBeGreaterThan(0);
    expect(within(wizard).getByRole("button", { name: /Test the connection/i })).toBeInTheDocument();
    expect(within(wizard).getByText(/Need help generating a token\?/i)).toBeInTheDocument();
    expect(wizard.textContent).not.toMatch(/BUILD_TARGET_GITHUB_TOKEN|Repo URL|Token Env Var|Default Base Branch|Build Target|Build Branch|agent-work\/portal-task|governanceBudgetEnforced|agent env var map|protected branches/);
  });

  it("§1A-FU-04-02 rejects pasted token-looking values and keeps the setup blocked", async () => {
    const user = userEvent.setup();
    render(<Home />);

    const tokenInput = await screen.findByLabelText(/GitHub token \(stored as an environment variable\)/i);
    await user.clear(tokenInput);
    await user.type(tokenInput, ["ghp", "actualSecretValue123"].join("_"));

    expect(screen.getByText("That looks like the actual token. Paste only the environment variable name where the token is stored — for example, VIYO_GITHUB_TOKEN.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Test the connection/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Review recommended setup/i })).toBeDisabled();
  });

  it("§1A-FU-04-03 tests the private repository connection before review", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.type(await screen.findByLabelText(/GitHub repository link/i), "https://github.com/viyo-ai/AI-API-Web-Portal-v2.git");
    await user.click(screen.getByRole("button", { name: /Test the connection/i }));

    await waitFor(() => expect(testBuildTargetConnectionMock).toHaveBeenCalledWith({
      repoUrl: "https://github.com/viyo-ai/AI-API-Web-Portal-v2.git",
      githubTokenEnvVar: "VIYO_GITHUB_TOKEN",
      defaultBaseBranch: "main",
    }));
    expect((await screen.findAllByText("Connected. Read access confirmed.")).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Review recommended setup/i })).toBeEnabled();
  });

  it("§1A-FU-04-04 disables Save Project until a successful current connection test and resets after edits", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.clear(await screen.findByLabelText(/Project name/i));
    await user.type(screen.getByLabelText(/Project name/i), "AI API Portal");
    await user.type(screen.getByLabelText(/GitHub repository link/i), "https://github.com/viyo-ai/AI-API-Web-Portal-v2.git");
    expect(screen.getByRole("button", { name: /Review recommended setup/i })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /Test the connection/i }));
    expect((await screen.findAllByText("Connected. Read access confirmed.")).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: /Review recommended setup/i }));
    expect(await screen.findByRole("button", { name: /Save Project/i })).toBeEnabled();
    await user.type(screen.getByDisplayValue("https://github.com/viyo-ai/AI-API-Web-Portal-v2.git"), "-edited");
    expect(screen.getByText("Test the connection again after your change.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save Project/i })).toBeDisabled();
  });

  it("§1A-FU-04-05 maps connection failure modes to actionable owner messages", async () => {
    const user = userEvent.setup();
    testBuildTargetConnectionMock
      .mockResolvedValueOnce({ status: "missing_env", message: "Environment variable VIYO_GITHUB_TOKEN is not set." })
      .mockResolvedValueOnce({ status: "invalid_token", message: "401 bad credentials" })
      .mockResolvedValueOnce({ status: "repo_not_accessible", message: "404 not found" });
    render(<Home />);

    await user.type(await screen.findByLabelText(/GitHub repository link/i), "https://github.com/viyo-ai/AI-API-Web-Portal-v2.git");
    await user.click(screen.getByRole("button", { name: /Test the connection/i }));
    expect((await screen.findAllByText("We couldn’t find that environment variable in Manus. Add it to your Manus environment, then test again.")).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: /Test the connection/i }));
    expect((await screen.findAllByText("GitHub rejected the token stored in that environment variable. Check that it is a fine-grained token for this repository with Contents read and write access, then test again.")).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: /Test the connection/i }));
    expect((await screen.findAllByText("We couldn’t find that repository, or the token does not have access to it. Check the GitHub repository link and token permissions, then test again.")).length).toBeGreaterThan(0);
  });

  it("§1A-FU-04-06 redacts token-looking values from connection failure messages", async () => {
    const user = userEvent.setup();
    const tokenLikeFixture = ["ghp", "secretTokenValue12345"].join("_");
    testBuildTargetConnectionMock.mockResolvedValueOnce({ status: "unknown", message: `remote rejected ${tokenLikeFixture} for repo` });
    render(<Home />);

    await user.type(await screen.findByLabelText(/GitHub repository link/i), "https://github.com/viyo-ai/AI-API-Web-Portal-v2.git");
    await user.click(screen.getByRole("button", { name: /Test the connection/i }));

    expect((await screen.findAllByText(/\[redacted token\]/i)).length).toBeGreaterThan(0);
    expect(screen.queryByText(new RegExp(tokenLikeFixture, "i"))).not.toBeInTheDocument();
  });

  it("§1A-FU-04-07 validates GitHub repository links with plain-English owner messages", async () => {
    const user = userEvent.setup();
    render(<Home />);

    expect(await screen.findByText("Add the link to your GitHub repository.")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/GitHub repository link/i), "git@github.com:viyo-ai/AI-API-Web-Portal-v2.git");
    expect(await screen.findByText("Use the full GitHub link, like https://github.com/your-name/your-repo.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Test the connection/i })).toBeDisabled();
  });

  it("§1A-FU-04-08 preserves AI review output and optional advanced settings editors", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.type(await screen.findByLabelText(/GitHub repository link/i), "https://github.com/viyo-ai/AI-API-Web-Portal-v2.git");
    await user.click(screen.getByRole("button", { name: /Test the connection/i }));
    expect((await screen.findAllByText("Connected. Read access confirmed.")).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: /Review recommended setup/i }));
    expect(await screen.findByText(/Review AI recommendations/i)).toBeInTheDocument();
    expect(screen.queryByTestId("setup-wizard-advanced-settings")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Advanced settings \(optional\)/i }));
    expect(screen.getByTestId("wizard-protected-branch-list")).toBeInTheDocument();
    expect(screen.getByTestId("wizard-governance-files-editor")).toBeInTheDocument();
    expect(screen.getByTestId("wizard-agent-env-map-editor")).toBeInTheDocument();
  });

  it("§1A-FU-04-09 keeps the wizard keyboard-accessible for Enter and Escape", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.type(await screen.findByLabelText(/GitHub repository link/i), "https://github.com/viyo-ai/AI-API-Web-Portal-v2.git");
    const testButton = screen.getByRole("button", { name: /Test the connection/i });
    testButton.focus();
    await user.keyboard("{Enter}");
    expect((await screen.findAllByText("Connected. Read access confirmed.")).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: /Review recommended setup/i }));
    const advancedButton = await screen.findByRole("button", { name: /Advanced settings \(optional\)/i });
    advancedButton.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByTestId("setup-wizard-advanced-settings")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("setup-wizard-advanced-settings")).not.toBeInTheDocument());
  });

  it("§1A-FU-04-10 confirms successful save in plain English without internal IDs", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.type(await screen.findByLabelText(/GitHub repository link/i), "https://github.com/viyo-ai/AI-API-Web-Portal-v2.git");
    await user.click(screen.getByRole("button", { name: /Test the connection/i }));
    expect((await screen.findAllByText("Connected. Read access confirmed.")).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: /Review recommended setup/i }));
    await user.click(await screen.findByRole("button", { name: /Save Project/i }));

    const confirmations = await screen.findAllByText("Your Project is connected. You can start a new task whenever you’re ready.");
    expect(confirmations.length).toBeGreaterThan(0);
    expect(screen.queryByText(/target-77|buildTargetId|Project ID|internal ID/i)).not.toBeInTheDocument();
  });

  it("renders §3A plain-language project and rule-book vocabulary without legacy owner labels", async () => {
    const user = userEvent.setup();
    mockBuildTargets = [
      {
        id: 77,
        ownerUserId: 42,
        name: "AI API Portal",
        repoUrl: "https://github.com/viyo-ai/AI-API-Web-Portal-v2",
        defaultBaseBranch: "main",
        protectedBranchesJson: JSON.stringify(["main", "staging"]),
        validationCommandsJson: JSON.stringify(["pnpm check", "pnpm test"]),
        serviceChecksJson: JSON.stringify([]),
        agentEnvVarMapJson: JSON.stringify({ WORKSHOP_GITHUB_TOKEN: "BUILD_TARGET_GITHUB_TOKEN" }),
        governanceFilesJson: JSON.stringify([{ path: "docs/rules.md", role: "governance", required: true, dynamic: false }]),
        governanceBudgetEnforced: true,
        archivedAt: null,
        createdAt: 1777999300000,
        updatedAt: 1777999400000,
      },
    ];

    render(<Home />);

    await screen.findAllByText("Implement v2 shell");
    expect(screen.getAllByText(/Projects/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Project: AI API Portal/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Project rule books/i)).toBeInTheDocument();
    expect(screen.getByText(/Files in your repo that the AI reads on every task/i)).toBeInTheDocument();
    expect(screen.getByText(/Path includes current focus/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Rule book/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Current focus indicator/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Focus indicator name/i)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/agent-work\/portal-task/i), "agent-work/plain-language");
    await user.click(screen.getByRole("button", { name: /^Open$/i }));
    expect(await screen.findByText(/Push checks: protected branches blocked/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Push branch$/i })).toBeInTheDocument();
    expect(screen.getByText(/Push status: Never pushed/i)).toBeInTheDocument();

    const ownerCopy = document.body.textContent ?? "";
    ["Build Target", "Build Mode", "Governance Files", "Validation Commands", "Service Checks", "Agent Env Var", "Conventional Commit", "Token Budget", "Pre-push Hook"].forEach((legacyLabel) => {
      expect(ownerCopy).not.toContain(legacyLabel);
    });
  });

  it("shows structured Section 4 push-blocked results without closing the workspace", async () => {
    const user = userEvent.setup();
    mockBuildTargets = [
      {
        id: 77,
        ownerUserId: 42,
        name: "AI API Portal",
        repoUrl: "https://github.com/viyo-ai/AI-API-Web-Portal-v2",
        defaultBaseBranch: "main",
        protectedBranchesJson: JSON.stringify(["main", "staging"]),
        validationCommandsJson: JSON.stringify(["pnpm check", "pnpm test"]),
        serviceChecksJson: JSON.stringify([]),
        agentEnvVarMapJson: JSON.stringify({ WORKSHOP_GITHUB_TOKEN: "BUILD_TARGET_GITHUB_TOKEN" }),
        governanceFilesJson: JSON.stringify([]),
        governanceBudgetEnforced: true,
        archivedAt: null,
        createdAt: 1777999300000,
        updatedAt: 1777999400000,
      },
    ];
    pushBuildBranchMock.mockResolvedValueOnce({
      branch: { id: 301, branchName: "agent-work/plain-language", state: "clean", pushState: "blocked", workspacePath: "/tmp/plain-language", taskId: 7 },
      pushState: "blocked",
      pushedCommit: null,
      errorMessage: "Section 4 push blocked: main is protected.",
      result: { pushState: "blocked", errorMessage: "Section 4 push blocked: main is protected." },
    });

    render(<Home />);
    await screen.findAllByText("Implement v2 shell");
    await user.type(screen.getByPlaceholderText(/agent-work\/portal-task/i), "agent-work/plain-language");
    await user.click(screen.getByRole("button", { name: /^Open$/i }));
    await user.click(await screen.findByRole("button", { name: /^Push branch$/i }));

    expect(await screen.findByText(/Section 4 push blocked: main is protected/i)).toBeInTheDocument();
    expect(screen.getByText(/Branch: agent-work\/plain-language/i)).toBeInTheDocument();
  });

  it("drafts an empty-memory note into the focused task composer", async () => {
    const user = userEvent.setup();
    mockMemory = [];
    render(<Home />);

    await screen.findAllByText("Implement v2 shell");
    const composer = screen.getByLabelText(/Task message/i);
    await user.type(composer, "Existing owner note");
    await user.click(screen.getByRole("button", { name: /Draft memory note/i }));

    expect(composer).toHaveValue("Existing owner note\n\nRecord the key decision or reusable context for this task.");
    expect(composer).toHaveFocus();
    expect(screen.getByText(/Memory-note draft added to the task composer/i)).toBeInTheDocument();
    expect(submitMessageMock).not.toHaveBeenCalled();
  });

  it("shows explicit authenticated missing-credential warnings for both Claude and Kimi", async () => {
    mockCredentialStates = [
      { provider: "claude", configured: false, status: "missing", reason: "Missing CLAUDE_API_KEY." },
      { provider: "kimi", configured: false, status: "missing", reason: "Missing Cloudflare Workers AI credentials." },
    ];

    render(<Home />);

    await screen.findAllByText("Implement v2 shell");
    expect(screen.getByText(/claude: missing/i)).toBeInTheDocument();
    expect(screen.getByText(/kimi: missing/i)).toBeInTheDocument();
    expect(screen.getByText(/Missing CLAUDE_API_KEY\./i)).toBeInTheDocument();
    expect(screen.getByText(/Missing Cloudflare Workers AI credentials\./i)).toBeInTheDocument();
  });

  it("shows owner-facing task messages in normal chat order with the newest message closest to the composer", async () => {
    const user = userEvent.setup();
    mockThread = {
      task: sampleTask,
      activeTurn: null,
      events: [
        {
          id: 201,
          taskId: 7,
          ownerUserId: 42,
          actor: "user",
          eventType: "message",
          status: "completed",
          content: "Older owner request",
          metadataJson: "{}",
          createdAt: 1777999100000,
        },
        {
          id: 202,
          taskId: 7,
          ownerUserId: 42,
          actor: "wrapper",
          eventType: "route_decision",
          status: "completed",
          content: "Route AUTO selected dual Claude and Kimi initialization.",
          metadataJson: "{}",
          createdAt: 1777999200000,
        },
        {
          id: 203,
          taskId: 7,
          ownerUserId: 42,
          actor: "kimi",
          eventType: "model_result",
          status: "completed",
          content: "Newest plain answer from Kimi after initialization.",
          metadataJson: "{}",
          createdAt: 1777999300000,
        },
      ],
    };

    render(<Home />);

    const older = await screen.findByText("Older owner request");
    const newest = screen.getByText("Newest plain answer from Kimi after initialization.");
    expect(older.compareDocumentPosition(newest) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText("Route AUTO selected dual Claude and Kimi initialization.")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("chat-bubble-ai").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("chat-bubble-user").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("tab", { name: /AI Activity/i }));
    await user.click(screen.getByRole("button", { name: /show activity details/i }));
    expect(screen.getAllByText("Route AUTO selected dual Claude and Kimi initialization.").length).toBeGreaterThan(0);
  });

  it("summarizes empty Kimi responses as owner-friendly recovery guidance while keeping raw diagnostics in technical details", async () => {
    const user = userEvent.setup();
    mockThread = {
      task: sampleTask,
      activeTurn: null,
      events: [
        {
          id: 301,
          taskId: 7,
          ownerUserId: 42,
          actor: "user",
          eventType: "message",
          status: "completed",
          content: "Build the safe next step.",
          metadataJson: "{}",
          createdAt: 1777999100000,
        },
        {
          id: 302,
          taskId: 7,
          ownerUserId: 42,
          actor: "wrapper",
          eventType: "error",
          status: "failed",
          content: "Kimi returned an empty response.",
          metadataJson: "{}",
          createdAt: 1777999300000,
        },
      ],
    };

    render(<Home />);

    expect((await screen.findAllByText(/Kimi did not return usable text/i)).length).toBeGreaterThan(0);
    expect(screen.queryByText("Kimi returned an empty response.")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /AI Activity/i }));
    await user.click(screen.getByRole("button", { name: /show activity details/i }));
    expect(screen.getAllByText("Kimi returned an empty response.").length).toBeGreaterThan(0);
  });

  it("§1A-CONV-FU-05 suppresses stale provider recovery notes after a later successful same-turn answer", async () => {
    const user = userEvent.setup();
    mockThread = {
      task: sampleTask,
      activeTurn: null,
      events: [
        {
          id: 311,
          taskId: 7,
          ownerUserId: 42,
          actor: "user",
          eventType: "message",
          status: "completed",
          content: "Use Kimi for a short QA acknowledgement.",
          metadataJson: "{\"turnId\":52}",
          createdAt: 1777999100000,
        },
        {
          id: 312,
          taskId: 7,
          ownerUserId: 42,
          actor: "wrapper",
          eventType: "error",
          status: "failed",
          content: "Kimi returned an empty response.",
          metadataJson: "{\"turnId\":52}",
          createdAt: 1777999200000,
        },
        {
          id: 313,
          taskId: 7,
          ownerUserId: 42,
          actor: "kimi",
          eventType: "model_result",
          status: "completed",
          content: "Kimi route QA acknowledged.",
          metadataJson: "{\"turnId\":52}",
          createdAt: 1777999300000,
        },
      ],
    };

    render(<Home />);

    expect(await screen.findByText("Kimi route QA acknowledged.")).toBeInTheDocument();
    expect(screen.queryByTestId("owner-provider-recovery")).not.toBeInTheDocument();
    expect(screen.queryByText(/Kimi did not return usable text/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /AI Activity/i }));
    await user.click(screen.getByRole("button", { name: /show activity details/i }));
    expect(screen.getAllByText("Kimi returned an empty response.").length).toBeGreaterThan(0);
  });

  it("renders the §9 owner approval card, keeps Kimi paused, and wires approve revise cancel decisions", async () => {
    const user = userEvent.setup();
    mockThread = {
      task: sampleTask,
      activeTurn: {
        id: 46,
        taskId: 7,
        ownerUserId: 42,
        routeMode: "dual",
        route: "dual",
        state: "awaiting_approval",
        approvalStatus: "awaiting_owner",
        approvalPlanContent: "Claude plan: inspect the repository, then let Kimi implement the safe patch.",
        approvalRequestedAt: 1777999400000,
        approvalResolvedAt: null,
        startedAt: 1777999200000,
        completedAt: null,
        errorMessage: null,
      },
      queuedMessages: [],
      events: [
        { id: 401, taskId: 7, ownerUserId: 42, actor: "user", eventType: "message", status: "completed", content: "Please implement the next portal section.", metadataJson: "{}", createdAt: 1777999100000 },
      ],
    };

    render(<Home />);

    expect(await screen.findByTestId("section9-kimi-approval-card")).toHaveTextContent(/Review Claude's plan before Kimi runs/i);
    expect(screen.getByTestId("section9-kimi-approval-card")).toHaveTextContent(/Kimi has not run/i);
    expect(screen.getByTestId("section9-approval-diagnostics")).toHaveTextContent(/waiting for owner approval/i);
    await user.click(screen.getByTestId("section9-approve-kimi"));
    expect(approveKimiHandoffMock).toHaveBeenCalledWith({ taskId: 7, turnId: 46 });

    await user.type(screen.getByTestId("section9-approval-revision-input"), "Add a rollback note before implementation.");
    await user.click(screen.getByTestId("section9-request-revision"));
    expect(requestKimiHandoffRevisionMock).toHaveBeenCalledWith({ taskId: 7, turnId: 46, revisionMessage: "Add a rollback note before implementation." });

    await user.click(screen.getByTestId("section9-cancel-kimi"));
    expect(cancelKimiHandoffMock).toHaveBeenCalledWith({ taskId: 7, turnId: 46 });
  });

  it("keeps §9 forbidden technical vocabulary out of owner-facing approval text", async () => {
    mockThread = {
      task: sampleTask,
      activeTurn: {
        id: 46,
        taskId: 7,
        ownerUserId: 42,
        routeMode: "dual",
        route: "dual",
        state: "awaiting_approval",
        approvalStatus: "awaiting_owner",
        approvalPlanContent: "Claude plan: inspect the repository, then let Kimi implement the safe patch.",
        approvalRequestedAt: 1777999400000,
        approvalResolvedAt: null,
        startedAt: 1777999200000,
        completedAt: null,
        errorMessage: null,
      },
      queuedMessages: [],
      events: [
        { id: 401, taskId: 7, ownerUserId: 42, actor: "user", eventType: "message", status: "completed", content: "Please implement the next portal section.", metadataJson: "{}", createdAt: 1777999100000 },
      ],
    };

    render(<Home />);
    expect(await screen.findByTestId("section9-kimi-approval-card")).toBeInTheDocument();

    const ownerFacingBody = document.body.cloneNode(true) as HTMLElement;
    ownerFacingBody.querySelectorAll('[role="tabpanel"]').forEach(panel => {
      const labelledBy = panel.getAttribute("aria-labelledby") ?? "";
      const panelText = panel.textContent ?? "";
      if (/diagnostics/i.test(labelledBy) || /Diagnostics are intentionally opt-in/i.test(panelText)) {
        panel.remove();
      }
    });
    const ownerFacingText = ownerFacingBody.textContent ?? "";

    [
      "verified handoff",
      "approval gate",
      "wrapper turn",
      "dual-path",
      "route_decision",
      "awaiting_approval",
      "model_calling",
      "claudePlan",
      "kimiResult",
      "claudeReview",
      "finalAnswer",
    ].forEach(term => {
      expect(ownerFacingText).not.toMatch(new RegExp(term, "i"));
    });
  });

  it("defaults §9 Kimi approval checks on and persists owner preference changes", async () => {
    const user = userEvent.setup();
    render(<Home />);

    expect(await screen.findByTestId("section9-kimi-approval-preference")).toHaveTextContent(/Always check before Kimi runs: On/i);
    await user.click(screen.getByTestId("section9-kimi-approval-preference"));

    expect(updateKimiApprovalPreferenceMock).toHaveBeenCalledWith({ alwaysRequireKimiApproval: false });
    await waitFor(() => expect(invalidateMock).toHaveBeenCalled());
  });

  it("removes §9 technical-noise events from the owner chat while retaining them in AI Activity details", async () => {
    const user = userEvent.setup();
    mockThread = {
      task: sampleTask,
      activeTurn: null,
      events: [
        { id: 501, taskId: 7, ownerUserId: 42, actor: "system", eventType: "task_created", status: "completed", content: "Task record created from sidebar action.", metadataJson: "{}", createdAt: 1777999000000 },
        { id: 502, taskId: 7, ownerUserId: 42, actor: "wrapper", eventType: "route_decision", status: "completed", content: "Route AUTO selected dual Claude and Kimi initialization.", metadataJson: "{}", createdAt: 1777999100000 },
        { id: 503, taskId: 7, ownerUserId: 42, actor: "user", eventType: "message", status: "completed", content: "Owner-visible request", metadataJson: "{}", createdAt: 1777999200000 },
        { id: 504, taskId: 7, ownerUserId: 42, actor: "kimi", eventType: "model_result", status: "completed", content: "Owner-visible implementation summary", metadataJson: "{}", createdAt: 1777999300000 },
      ],
    };

    render(<Home />);

    expect(await screen.findByText("Owner-visible request")).toBeInTheDocument();
    expect(screen.getByText("Owner-visible implementation summary")).toBeInTheDocument();
    expect(screen.queryByText("Task record created from sidebar action.")).not.toBeInTheDocument();
    expect(screen.queryByText("Route AUTO selected dual Claude and Kimi initialization.")).not.toBeInTheDocument();
    expect(screen.queryByText(/Technical history/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /AI Activity/i }));
    await user.click(screen.getByRole("button", { name: /show activity details/i }));
    expect(screen.getAllByText("Task record created from sidebar action.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Route AUTO selected dual Claude and Kimi initialization.").length).toBeGreaterThan(0);
  });

  it("submits the selected task message with Enter and respects the explicit Kimi route selector", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await screen.findAllByText("Implement v2 shell");
    await user.click(screen.getByRole("radio", { name: /Kimi K2\.6/i }));
    await user.type(screen.getByLabelText(/Task message/i), "What model am I using?{enter}");

    expect(submitMessageMock).toHaveBeenCalledWith({
      taskId: 7,
      message: "What model am I using?",
      routeMode: "kimi",
    });
    await waitFor(() => expect(invalidateMock).toHaveBeenCalled());
  });

  it("§1A-CONV-FU-05 keeps the task composer send target stable and accessible beside diagnostics controls", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await screen.findAllByText("Implement v2 shell");
    await user.click(screen.getByRole("tab", { name: /AI Activity/i }));
    await user.click(screen.getByRole("button", { name: /show activity details/i }));

    const composer = screen.getByTestId("section8-task-message-composer");
    const sendButton = screen.getByTestId("section8-send-or-queue-button");
    expect(composer).toHaveAttribute("id", "task-message-composer");
    expect(composer).toHaveAttribute("aria-controls", "section8-send-or-queue-button");
    expect(composer).toHaveAttribute("aria-describedby", "task-composer-send-help");
    expect(sendButton).toHaveAttribute("id", "section8-send-or-queue-button");
    expect(sendButton).toHaveAccessibleName(/Send message to task/i);
    expect(sendButton).toHaveAttribute("aria-controls", "task-message-composer");
    expect(sendButton).toHaveAttribute("aria-keyshortcuts", "Enter");

    await user.type(composer, "Stable composer send target");
    await user.click(sendButton);

    expect(submitMessageMock).toHaveBeenCalledWith({
      taskId: 7,
      message: "Stable composer send target",
      routeMode: "auto",
    });
  });

  it("INV-S8-01 queues composer submissions during an active turn and shows the queue indicator plus dropdown content", async () => {
    const user = userEvent.setup();
    mockThread = {
      task: sampleTask,
      activeTurn: { id: 44, taskId: 7, ownerUserId: 42, routeMode: "auto", state: "model_calling", startedAt: 1777999200000, completedAt: null, errorMessage: null },
      queuedMessages: [
        { id: 901, taskId: 7, ownerUserId: 42, position: 1, content: "Already queued follow-up", state: "queued", createdAt: 1777999250000, updatedAt: 1777999250000 },
      ],
      events: [],
    };
    render(<Home />);

    await screen.findAllByText("Implement v2 shell");
    expect(screen.getByTestId("section8-generation-queue-panel")).toHaveTextContent("Queued messages (will send after current turn)");
    expect(screen.getByTestId("section8-queue-count")).toHaveTextContent("1 of 5 queued");
    expect(screen.getByTestId("section8-queued-messages")).toHaveTextContent("Already queued follow-up");
    await user.type(screen.getByLabelText(/Task message/i), "Please queue this next{enter}");

    expect(submitMessageMock).toHaveBeenCalledWith({ taskId: 7, message: "Please queue this next", routeMode: "auto" });
    expect(screen.getByRole("button", { name: /Queue message/i })).toBeInTheDocument();
  });

  it("INV-S8-02 renders a collapsible queue dropdown with up to five queued messages and Edit/Cancel actions", async () => {
    const user = userEvent.setup();
    mockThread = {
      task: sampleTask,
      activeTurn: { id: 46, taskId: 7, ownerUserId: 42, routeMode: "auto", state: "model_calling", startedAt: 1777999200000, completedAt: null, errorMessage: null },
      queuedMessages: [1, 2, 3].map((position) => ({ id: 900 + position, taskId: 7, ownerUserId: 42, position, content: `Queued follow-up ${position}`, state: "queued", createdAt: 1777999250000 + position, updatedAt: 1777999250000 + position })),
      events: [],
    };
    render(<Home />);

    await screen.findAllByText("Implement v2 shell");
    const toggle = screen.getByTestId("section8-queue-toggle");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const queueList = screen.getByTestId("section8-queued-messages");
    ["Queued follow-up 1", "Queued follow-up 2", "Queued follow-up 3"].forEach((message) => expect(queueList).toHaveTextContent(message));
    expect(within(queueList).getAllByRole("button", { name: /^Edit$/i })).toHaveLength(3);
    expect(within(queueList).getAllByRole("button", { name: /^Cancel$/i })).toHaveLength(3);

    await user.click(toggle);
    expect(screen.queryByTestId("section8-queued-messages")).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(screen.getByTestId("section8-queued-messages")).toHaveTextContent("Queued follow-up 3");
  });

  it("INV-S8-03 edits a queued message inline, saves through the update mutation, and collapses to display mode", async () => {
    const user = userEvent.setup();
    mockThread = {
      task: sampleTask,
      activeTurn: { id: 47, taskId: 7, ownerUserId: 42, routeMode: "auto", state: "model_calling", startedAt: 1777999200000, completedAt: null, errorMessage: null },
      queuedMessages: [
        { id: 901, taskId: 7, ownerUserId: 42, position: 1, content: "Already queued follow-up", state: "queued", createdAt: 1777999250000, updatedAt: 1777999250000 },
      ],
      events: [],
    };
    render(<Home />);

    await screen.findAllByText("Implement v2 shell");
    await user.click(screen.getByRole("button", { name: /^Edit$/i }));
    const editBox = screen.getByLabelText("Edit queued message 1");
    expect(editBox).toHaveValue("Already queued follow-up");
    await user.clear(editBox);
    await user.type(editBox, "Updated queued follow-up");
    await user.click(screen.getByRole("button", { name: /Save changes/i }));

    expect(updateQueuedMessageMock).toHaveBeenCalledWith({ taskId: 7, queueItemId: 901, content: "Updated queued follow-up" });
    expect(screen.queryByLabelText("Edit queued message 1")).not.toBeInTheDocument();
    expect(screen.getByTestId("section8-queued-messages")).toHaveTextContent("Updated queued follow-up");
  });

  it("INV-S8-04 cancels a queued message optimistically and shows a Canceled confirmation", async () => {
    const user = userEvent.setup();
    mockThread = {
      task: sampleTask,
      activeTurn: { id: 48, taskId: 7, ownerUserId: 42, routeMode: "auto", state: "model_calling", startedAt: 1777999200000, completedAt: null, errorMessage: null },
      queuedMessages: [
        { id: 901, taskId: 7, ownerUserId: 42, position: 1, content: "Cancel this queued follow-up", state: "queued", createdAt: 1777999250000, updatedAt: 1777999250000 },
      ],
      events: [],
    };
    render(<Home />);

    await screen.findAllByText("Implement v2 shell");
    await user.click(screen.getByRole("button", { name: /^Cancel$/i }));

    expect(clearQueuedMessageMock).toHaveBeenCalledWith({ taskId: 7, queueItemId: 901 });
    expect(screen.queryByText("Cancel this queued follow-up")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Canceled"));
  });

  it("INV-S8-05 blocks new queue submissions when the queue is full and keeps Enter from submitting", async () => {
    const user = userEvent.setup();
    mockThread = {
      task: sampleTask,
      activeTurn: { id: 49, taskId: 7, ownerUserId: 42, routeMode: "auto", state: "model_calling", startedAt: 1777999200000, completedAt: null, errorMessage: null },
      queuedMessages: [1, 2, 3, 4, 5].map((position) => ({ id: 900 + position, taskId: 7, ownerUserId: 42, position, content: `Full queue item ${position}`, state: "queued", createdAt: 1777999250000 + position, updatedAt: 1777999250000 + position })),
      events: [],
    };
    render(<Home />);

    await screen.findAllByText("Implement v2 shell");
    expect(screen.getByTestId("section8-queue-count")).toHaveTextContent("5 of 5 queued (full)");
    expect(screen.getByText("Queue is full. Wait for the current message to finish, or cancel a queued message.")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Task message/i), "This should not queue{enter}");

    expect(screen.getByRole("button", { name: /Queue message/i })).toBeDisabled();
    expect(submitMessageMock).not.toHaveBeenCalled();
  });

  it("INV-S8-06 shows Stop only for active states and labels awaiting approval as Stop and discard plan", async () => {
    const activeStates = ["context_assembly", "model_calling", "model_review", "persisting_output"];
    for (let index = 0; index < activeStates.length; index += 1) {
      const state = activeStates[index];
      cleanup();
      mockThread = { task: sampleTask, activeTurn: { id: 60 + index, taskId: 7, ownerUserId: 42, routeMode: "auto", state, startedAt: 1777999200000, completedAt: null, errorMessage: null }, queuedMessages: [], events: [] };
      render(<Home />);
      await screen.findAllByText("Implement v2 shell");
      expect(screen.getByTestId("section8-stop-generation")).toHaveTextContent("Stop");
      expect(screen.queryByRole("button", { name: /Stop and discard plan/i })).not.toBeInTheDocument();
    }

    cleanup();
    mockThread = { task: sampleTask, activeTurn: { id: 70, taskId: 7, ownerUserId: 42, routeMode: "dual", state: "awaiting_approval", approvalStatus: "awaiting_owner", approvalPlanContent: "Claude plan", approvalRequestedAt: 1777999400000, approvalResolvedAt: null, startedAt: 1777999200000, completedAt: null, errorMessage: null }, queuedMessages: [], events: [] };
    render(<Home />);
    await screen.findAllByText("Implement v2 shell");
    expect(screen.getByRole("button", { name: /Stop and discard plan/i })).toBeInTheDocument();

    cleanup();
    mockThread = { task: sampleTask, activeTurn: null, queuedMessages: [], events: [] };
    render(<Home />);
    await screen.findAllByText("Implement v2 shell");
    expect(screen.queryByTestId("section8-stop-generation")).not.toBeInTheDocument();
  });

  it("INV-S8-07 confirms awaiting-approval Stop before calling stopGeneration and reports the stopped state", async () => {
    const user = userEvent.setup();
    mockThread = {
      task: sampleTask,
      activeTurn: { id: 71, taskId: 7, ownerUserId: 42, routeMode: "dual", state: "awaiting_approval", approvalStatus: "awaiting_owner", approvalPlanContent: "Claude plan", approvalRequestedAt: 1777999400000, approvalResolvedAt: null, startedAt: 1777999200000, completedAt: null, errorMessage: null },
      queuedMessages: [],
      events: [],
    };
    render(<Home />);

    await screen.findAllByText("Implement v2 shell");
    await user.click(screen.getByRole("button", { name: /Stop and discard plan/i }));
    expect(screen.getByText("Stop and discard this plan?")).toBeInTheDocument();
    expect(screen.getByText("Any queued messages will be sent after the next message you submit.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Keep plan/i })).toBeInTheDocument();
    expect(stopGenerationMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /^Stop and discard$/i }));

    expect(stopGenerationMock).toHaveBeenCalledWith({ taskId: 7, turnId: 71, activeOperation: "awaiting_approval" });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Stopped. Send a new message when you’re ready."));
  });

  it("INV-S8-08 reflects FIFO queue flush as normal owner messages and empties the queue UI", async () => {
    mockThread = {
      task: sampleTask,
      activeTurn: null,
      queuedMessages: [],
      events: [
        { id: 501, taskId: 7, ownerUserId: 42, actor: "user", eventType: "message", status: "completed", content: "First flushed queued message", metadataJson: "{}", createdAt: 1777999100000 },
        { id: 502, taskId: 7, ownerUserId: 42, actor: "user", eventType: "message", status: "completed", content: "Second flushed queued message", metadataJson: "{}", createdAt: 1777999200000 },
      ],
    };
    render(<Home />);

    await screen.findAllByText("Implement v2 shell");
    expect(screen.queryByTestId("section8-queued-messages")).not.toBeInTheDocument();
    expect(screen.queryByTestId("section8-queue-count")).not.toBeInTheDocument();
    const messages = screen.getAllByText(/flushed queued message/).map((node) => node.textContent);
    expect(messages).toEqual(["First flushed queued message", "Second flushed queued message"]);
  });

  it("INV-S8-09 keeps composer draft text independent from queued message content", async () => {
    const user = userEvent.setup();
    mockThread = {
      task: sampleTask,
      activeTurn: { id: 72, taskId: 7, ownerUserId: 42, routeMode: "auto", state: "model_calling", startedAt: 1777999200000, completedAt: null, errorMessage: null },
      queuedMessages: [
        { id: 901, taskId: 7, ownerUserId: 42, position: 1, content: "Queued content stays unchanged", state: "queued", createdAt: 1777999250000, updatedAt: 1777999250000 },
        { id: 902, taskId: 7, ownerUserId: 42, position: 2, content: "Second queued content stays unchanged", state: "queued", createdAt: 1777999260000, updatedAt: 1777999260000 },
      ],
      events: [],
    };
    render(<Home />);

    await screen.findAllByText("Implement v2 shell");
    const composer = screen.getByLabelText(/Task message/i);
    await user.type(composer, "New independent draft");

    expect(screen.getByTestId("section8-queued-messages")).toHaveTextContent("Queued content stays unchanged");
    expect(screen.getByTestId("section8-queued-messages")).toHaveTextContent("Second queued content stays unchanged");
    await user.keyboard("{Enter}");
    expect(submitMessageMock).toHaveBeenCalledWith({ taskId: 7, message: "New independent draft", routeMode: "auto" });
  });

  it("INV-S8-10 keeps queue and Stop UI free of forbidden raw implementation vocabulary", async () => {
    mockThread = {
      task: sampleTask,
      activeTurn: { id: 73, taskId: 7, ownerUserId: 42, routeMode: "auto", state: "model_calling", startedAt: 1777999200000, completedAt: null, errorMessage: null },
      queuedMessages: [
        { id: 901, taskId: 7, ownerUserId: 42, position: 1, content: "Owner follow-up", state: "queued", createdAt: 1777999250000, updatedAt: 1777999250000 },
      ],
      events: [],
    };
    render(<Home />);

    await screen.findAllByText("Implement v2 shell");
    const ownerUiText = `${screen.getByTestId("section8-generation-queue-panel").textContent ?? ""} ${screen.getByTestId("section8-stop-generation").textContent ?? ""}`;
    ["enqueueTaskMessage", "markQueuedMessagesProcessing", "requestTurnStop", "stopRegistry", "taskMessageQueue", "MAX_QUEUED_MESSAGES_PER_TASK", "QueuedMessageState", "Processing", "Sent", "Cleared"].forEach((term) => {
      expect(ownerUiText).not.toContain(term);
    });
  });

  it("requests Stop immediately for a non-approval active generation turn without sending duplicate composer content", async () => {
    const user = userEvent.setup();
    mockThread = {
      task: sampleTask,
      activeTurn: { id: 45, taskId: 7, ownerUserId: 42, routeMode: "auto", state: "model_calling", startedAt: 1777999200000, completedAt: null, errorMessage: null },
      queuedMessages: [],
      events: [],
    };
    render(<Home />);

    await screen.findAllByText("Implement v2 shell");
    await user.type(screen.getByLabelText(/Task message/i), "Do not send this draft");
    await user.click(screen.getByTestId("section8-stop-generation"));

    expect(stopGenerationMock).toHaveBeenCalledWith({ taskId: 7, turnId: 45, activeOperation: "model_calling" });
    expect(submitMessageMock).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Stopped. Send a new message when you’re ready."));
  });

  it("keeps Shift+Enter inside the composer without submitting the message", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await screen.findAllByText("Implement v2 shell");
    await user.type(screen.getByLabelText(/Task message/i), "Line one{shift>}{enter}{/shift}Line two");

    expect(screen.getByLabelText(/Task message/i)).toHaveValue("Line one\nLine two");
    expect(submitMessageMock).not.toHaveBeenCalled();
  });

  it("creates a new task from the sidebar as a record-only action", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.click(screen.getByRole("button", { name: /new task/i }));

    expect(createTaskMock).toHaveBeenCalledWith({
      title: "AI coding workshop task",
      summary: "Task-first v2 workspace item created from the plain-English AI coding workshop.",
      routeMode: "auto",
    });
    expect(submitMessageMock).not.toHaveBeenCalled();
  });

  it("creates a task and submits the first message when Enter is pressed with no selected task", async () => {
    const user = userEvent.setup();
    mockTasks = [];
    mockThread = undefined;
    render(<Home />);

    await user.type(screen.getByLabelText(/Task message/i), "Initialize the task with Auto.{enter}");

    expect(createTaskMock).toHaveBeenCalledWith({
      title: "AI coding workshop task",
      summary: "Task-first v2 workspace item created from the plain-English AI coding workshop.",
      routeMode: "auto",
    });
    expect(submitMessageMock).toHaveBeenCalledWith({ taskId: 19, message: "Initialize the task with Auto.", routeMode: "auto" });
    expect(createTaskMock.mock.invocationCallOrder[0]).toBeLessThan(submitMessageMock.mock.invocationCallOrder[0]);
  });

  it("archives a live sidebar task only after owner confirmation", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValueOnce(true);
    render(<Home />);

    await screen.findAllByText("Implement v2 shell");
    await user.click(screen.getByRole("button", { name: /archive task implement v2 shell/i }));

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("Archive task \"Implement v2 shell\"?"));
    expect(updateTaskStatusMock).toHaveBeenCalledWith({ taskId: 7, status: "archived" });
    await waitFor(() => expect(invalidateMock).toHaveBeenCalled());
    confirmSpy.mockRestore();
  });

  it("does not archive a sidebar task when owner confirmation is cancelled", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    render(<Home />);

    await screen.findAllByText("Implement v2 shell");
    await user.click(screen.getByRole("button", { name: /archive task implement v2 shell/i }));

    expect(updateTaskStatusMock).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("refreshes provider credential status through the protected v2 credentials mutation", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.click(screen.getByRole("button", { name: /credentials/i }));

    expect(credentialsRefreshMock).toHaveBeenCalledWith({ providers: ["claude", "kimi"] });
    await waitFor(() => expect(invalidateMock).toHaveBeenCalled());
  });

  it("records task-file metadata only against the selected v2 task", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await screen.findAllByText("Implement v2 shell");
    await user.click(screen.getByText(/Advanced: connect a stored file manually/i));
    await user.type(screen.getByPlaceholderText("relative/path.md"), "docs/implementation-note.md");
    await user.type(screen.getByPlaceholderText("/manus-storage/..."), "/manus-storage/real-task-file-reference");
    await user.click(screen.getByRole("button", { name: /add file to this task/i }));

    expect(createFileMetadataMock).toHaveBeenCalledWith({
      taskId: 7,
      relativePath: "docs/implementation-note.md",
      storageKey: "docs/implementation-note.md",
      storageUrl: "/manus-storage/real-task-file-reference",
      mimeType: "text/markdown",
      sizeBytes: 0,
      version: 1,
    });
  });

  it("wires plus and paperclip to a real upload input and stores the selected task file", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await screen.findAllByText("Implement v2 shell");
    const uploadInput = screen.getByLabelText(/upload task file/i) as HTMLInputElement;
    const inputClickSpy = vi.spyOn(uploadInput, "click");

    await user.click(screen.getByRole("button", { name: /attach file to task/i }));
    expect(inputClickSpy).toHaveBeenCalled();

    const file = new File(["Owner brief"], "owner brief.txt", { type: "text/plain" });
    await user.upload(uploadInput, file);

    await waitFor(() => expect(uploadWorkspaceFileMock).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 7,
      scope: "task",
      mimeType: "text/plain",
      base64Content: "T3duZXIgYnJpZWY=",
    })));
    expect(uploadWorkspaceFileMock.mock.calls[0][0].relativePath).toMatch(/^uploads\/\d+-owner-brief\.txt$/);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Uploaded owner brief\.txt to this task folder/i));
    inputClickSpy.mockRestore();
  });

  it("uploads dropped files through the visible task-file drop zone", async () => {
    render(<Home />);

    await screen.findAllByText("Implement v2 shell");
    const dropZone = screen.getByTestId("task-file-drop-zone");
    const file = new File(["Drop payload"], "drop-note.md", { type: "text/markdown" });

    fireEvent.dragOver(dropZone, { dataTransfer: { files: [file] } });
    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

    await waitFor(() => expect(uploadWorkspaceFileMock).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 7,
      scope: "task",
      mimeType: "text/markdown",
      base64Content: "RHJvcCBwYXlsb2Fk",
    })));
    expect(uploadWorkspaceFileMock.mock.calls[0][0].relativePath).toMatch(/^uploads\/\d+-drop-note\.md$/);
  });

  it("shows first-class Global Files separate from the selected task folder", async () => {
    render(<Home />);

    await screen.findAllByText("Implement v2 shell");
    const globalLibrary = screen.getByTestId("global-file-library");
    expect(within(globalLibrary).getAllByText(/Global Files/i).length).toBeGreaterThan(0);
    expect(within(globalLibrary).getByText(/owner-scoped reusable references/i)).toBeInTheDocument();
    expect(within(globalLibrary).getByRole("link", { name: /open or download global file global-files\/owner-playbook\.pdf/i })).toBeInTheDocument();
    expect(screen.getByText(/Global Files ·/i)).toBeInTheDocument();
  });

  it("renders merged task and global files with colliding database IDs without duplicate key warnings", async () => {
    mockTaskFiles = [{ ...mockTaskFiles[0], id: 1, taskId: 7, relativePath: "docs/task-file.md", storageUrl: "/manus-storage/docs/task-file.md" }];
    mockGlobalFiles = [{ ...mockGlobalFiles[0], id: 1, taskId: null, scope: "global", relativePath: "global-files/global-file.md", storageUrl: "/manus-storage/global-files/global-file.md" }];
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      render(<Home />);

      await screen.findAllByText("Implement v2 shell");
      expect(screen.getAllByRole("link", { name: /open or download docs\/task-file\.md/i }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole("link", { name: /open or download global-files\/global-file\.md/i }).length).toBeGreaterThan(0);
      expect(consoleErrorSpy.mock.calls.filter((call) => call.some((arg) => String(arg).includes("Encountered two children with the same key")))).toEqual([]);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("uploads selected files into Global Files without attaching them to the selected task", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await screen.findAllByText("Implement v2 shell");
    const uploadInput = screen.getByLabelText(/upload Global Files file/i) as HTMLInputElement;
    const inputClickSpy = vi.spyOn(uploadInput, "click");

    await user.click(screen.getByRole("button", { name: /upload to Global Files/i }));
    expect(inputClickSpy).toHaveBeenCalled();

    const file = new File(["Reusable standard"], "brand standard.pdf", { type: "application/pdf" });
    await user.upload(uploadInput, file);

    await waitFor(() => expect(uploadWorkspaceFileMock).toHaveBeenCalledWith(expect.objectContaining({
      taskId: null,
      scope: "global",
      mimeType: "application/pdf",
      base64Content: "UmV1c2FibGUgc3RhbmRhcmQ=",
    })));
    expect(uploadWorkspaceFileMock.mock.calls[0][0].relativePath).toMatch(/^global-files\/\d+-brand-standard\.pdf$/);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Uploaded brand standard\.pdf to Global Files/i));
    inputClickSpy.mockRestore();
  });

  it("uploads dropped files through the Global Files drop zone with a global scope", async () => {
    render(<Home />);

    await screen.findAllByText("Implement v2 shell");
    const dropZone = screen.getByTestId("global-file-drop-zone");
    const file = new File(["Global payload"], "global-note.md", { type: "text/markdown" });

    fireEvent.dragOver(dropZone, { dataTransfer: { files: [file] } });
    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

    await waitFor(() => expect(uploadWorkspaceFileMock).toHaveBeenCalledWith(expect.objectContaining({
      taskId: null,
      scope: "global",
      mimeType: "text/markdown",
      base64Content: "R2xvYmFsIHBheWxvYWQ=",
    })));
    expect(uploadWorkspaceFileMock.mock.calls[0][0].relativePath).toMatch(/^global-files\/\d+-global-note\.md$/);
  });

  it("marks smile and microphone as coming soon instead of silent decorative controls", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await screen.findAllByText("Implement v2 shell");
    await user.click(screen.getByRole("button", { name: /emoji reactions coming soon/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/emoji reactions are coming soon/i);

    await user.click(screen.getByRole("button", { name: /voice input coming soon/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/voice input are coming soon/i);
  });

  it("keeps left navigation cards bounded so long task metadata cannot clip the sidebar", async () => {
    render(<Home />);

    await screen.findAllByText("Implement v2 shell");
    const taskCard = screen.getByTestId("left-nav-task-card");
    expect(taskCard).toHaveClass("max-w-full", "overflow-hidden");
    const taskTitleButton = screen.getAllByText("Implement v2 shell").find((element) => element.closest("button"))?.closest("button");
    expect(taskTitleButton).toHaveClass("min-w-0", "overflow-hidden");
    expect(within(taskCard).getByText("active")).toHaveClass("max-w-[96px]", "truncate", "shrink-0");
    expect(screen.getByRole("button", { name: /archive task implement v2 shell/i })).toHaveClass("h-8", "rounded-full");
  });

  it("writes and creates authenticated workspace filesystem entries from the real filesystem panel", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await screen.findAllByText("Implement v2 shell");
    await user.click(screen.getByRole("tab", { name: /diagnostics/i }));
    await user.click(screen.getByRole("button", { name: /show developer diagnostics/i }));
    await user.type(screen.getByPlaceholderText("workspace directory, blank for root"), "notes");
    await user.click(screen.getByRole("button", { name: /mkdir/i }));

    expect(filesystemMkdirMock).toHaveBeenCalledWith({ relativePath: "notes" });

    await user.clear(screen.getByPlaceholderText("relative/file.md"));
    await user.type(screen.getByPlaceholderText("relative/file.md"), "notes/work.md");
    await user.type(screen.getByPlaceholderText(/Edit workspace file content/i), "Real workspace edit for task 7.");
    await user.click(screen.getByRole("button", { name: /save workspace file/i }));

    expect(filesystemWriteMock).toHaveBeenCalledWith({
      taskId: 7,
      relativePath: "notes/work.md",
      content: "Real workspace edit for task 7.",
    });
  });

  it("opens the terminal WebSocket only after advanced tools are explicitly shown, reflects tmux readiness, and reports the authenticated endpoint", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await screen.findAllByText("Implement v2 shell");
    expect(FakeWebSocket.instances).toHaveLength(0);
    await user.click(screen.getByRole("tab", { name: /diagnostics/i }));
    await user.click(screen.getByRole("button", { name: /show developer diagnostics/i }));
    await waitFor(() => expect(FakeWebSocket.instances.length).toBeGreaterThan(0));
    const socket = FakeWebSocket.instances[FakeWebSocket.instances.length - 1];

    expect(socket.url).toMatch(/^ws:\/\/localhost(?::\d+)?\/api\/terminal$/);
    await act(async () => {
      socket.readyState = FakeWebSocket.OPEN;
      socket.dispatch("open", {});
    });
    socket.dispatchJson({
      type: "ready",
      sessionKey: "user-42",
      tmuxSessionName: "aicw-user-42",
      tmuxEnabled: true,
      terminalMode: "pty",
      cwd: "/tmp/ai-coding-workshop-workspaces/user-42",
    });
    socket.dispatchJson({ type: "status", status: "Authenticated node-pty terminal connected to a persistent tmux session." });

    expect(await screen.findByText("connected", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("tmux PTY terminal")).toBeInTheDocument();
    expect(screen.getByText(/tmux · aicw-user-42 · \/tmp\/ai-coding-workshop-workspaces\/user-42/i)).toBeInTheDocument();
  });

  it("keeps diagnostics terminal in the Personal workspace by default and switches to Project Build Branch only after the explicit toggle", async () => {
    const user = userEvent.setup();
    mockBuildTargets = [
      {
        id: 77,
        ownerUserId: 42,
        name: "AI API Portal",
        repoUrl: "https://github.com/viyo-ai/AI-API-Web-Portal-v2",
        defaultBaseBranch: "main",
        protectedBranchesJson: JSON.stringify(["main", "staging"]),
        validationCommandsJson: JSON.stringify(["pnpm check", "pnpm test"]),
        serviceChecksJson: JSON.stringify([]),
        agentEnvVarMapJson: JSON.stringify({ WORKSHOP_GITHUB_TOKEN: "BUILD_TARGET_GITHUB_TOKEN" }),
        governanceFilesJson: JSON.stringify([]),
        governanceBudgetEnforced: true,
        archivedAt: null,
        createdAt: 1777999300000,
        updatedAt: 1777999400000,
      },
    ];
    const buildBranchPath = "/tmp/ai-coding-workshop-build-targets/owner-42/target-77/branch-301-agent-work-plain-language";
    createBuildBranchMock.mockResolvedValueOnce({ id: 301, branchName: "agent-work/plain-language", state: "clean", pushState: "never_pushed", workspacePath: buildBranchPath, taskId: 7 });

    render(<Home />);
    await screen.findAllByText("Implement v2 shell");
    await user.type(screen.getByPlaceholderText(/agent-work\/portal-task/i), "agent-work/plain-language");
    await user.click(screen.getByRole("button", { name: /^Open$/i }));
    expect(await screen.findByText(/Branch: agent-work\/plain-language/i)).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /diagnostics/i }));
    await user.click(screen.getByRole("button", { name: /show developer diagnostics/i }));
    await waitFor(() => expect(FakeWebSocket.instances.length).toBeGreaterThan(0));
    expect(FakeWebSocket.instances[FakeWebSocket.instances.length - 1].url).toMatch(/^ws:\/\/localhost(?::\d+)?\/api\/terminal$/);
    expect(screen.getByTestId("diagnostics-workspace-toggle")).toHaveTextContent(/Current diagnostics terminal: Personal workspace/i);

    await user.click(screen.getByRole("button", { name: /Use Project Build Branch/i }));
    await waitFor(() => expect(FakeWebSocket.instances.length).toBeGreaterThan(1));
    const buildBranchSocketUrl = new URL(FakeWebSocket.instances[FakeWebSocket.instances.length - 1].url);
    expect(buildBranchSocketUrl.pathname).toBe("/api/terminal");
    expect(buildBranchSocketUrl.searchParams.get("cwd")).toBe(buildBranchPath);
    expect(screen.getByTestId("diagnostics-workspace-toggle")).toHaveTextContent(/Current diagnostics terminal: Project Build Branch/i);

    await user.click(screen.getByRole("button", { name: /Use Personal workspace/i }));
    await waitFor(() => expect(FakeWebSocket.instances.length).toBeGreaterThan(2));
    expect(FakeWebSocket.instances[FakeWebSocket.instances.length - 1].url).toMatch(/^ws:\/\/localhost(?::\d+)?\/api\/terminal$/);
    expect(screen.getByTestId("diagnostics-workspace-toggle")).toHaveTextContent(/Current diagnostics terminal: Personal workspace/i);
  });

  it("debounces resize observer terminal refits to avoid ResizeObserver loop noise", async () => {
    const rafCallbacks: FrameRequestCallback[] = [];
    const requestAnimationFrameMock = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    });
    const cancelAnimationFrameMock = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);

    const user = userEvent.setup();
    render(<Home />);

    await screen.findAllByText("Implement v2 shell");
    expect(resizeObserverCallbacks.length).toBe(0);
    await user.click(screen.getByRole("tab", { name: /diagnostics/i }));
    await user.click(screen.getByRole("button", { name: /show developer diagnostics/i }));
    expect(resizeObserverCallbacks.length).toBeGreaterThan(0);
    const scheduledBeforeResize = requestAnimationFrameMock.mock.calls.length;

    await act(async () => {
      resizeObserverCallbacks[0]([] as unknown as ResizeObserverEntry[], {} as ResizeObserver);
      resizeObserverCallbacks[0]([] as unknown as ResizeObserverEntry[], {} as ResizeObserver);
    });

    expect(requestAnimationFrameMock.mock.calls.length).toBeLessThanOrEqual(scheduledBeforeResize + 2);

    await act(async () => {
      rafCallbacks.shift()?.(0);
    });

    cleanup();
    expect(cancelAnimationFrameMock).toHaveBeenCalled();
    requestAnimationFrameMock.mockRestore();
    cancelAnimationFrameMock.mockRestore();
  });

  it("pauses terminal reconnects after fatal native-module initialization errors", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await screen.findAllByText("Implement v2 shell");
    expect(FakeWebSocket.instances).toHaveLength(0);
    await user.click(screen.getByRole("tab", { name: /diagnostics/i }));
    await user.click(screen.getByRole("button", { name: /show developer diagnostics/i }));
    await waitFor(() => expect(FakeWebSocket.instances.length).toBeGreaterThan(0));
    const socket = FakeWebSocket.instances[FakeWebSocket.instances.length - 1];

    await act(async () => {
      socket.dispatchJson({ type: "error", fatal: true, message: "Failed to load native module: pty.node" });
      socket.close();
    });
    const instancesAfterFatalClose = FakeWebSocket.instances.length;

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 2600));
    });

    expect(FakeWebSocket.instances).toHaveLength(instancesAfterFatalClose);
    expect(screen.getAllByText(/error/i).length).toBeGreaterThan(0);
  });
  it("organizes the right rail into task-inspector tabs while keeping advanced diagnostics opt-in", async () => {
    const user = userEvent.setup();
    render(<Home />);
    await screen.findAllByText("Implement v2 shell");

    expect(screen.getByTestId("task-inspector-tabs")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /files/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /AI Activity/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /context/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /diagnostics/i })).toBeInTheDocument();
    expect(screen.getByTestId("windows-file-manager")).toBeInTheDocument();
    expect(screen.getByTestId("global-file-library")).toBeInTheDocument();
    expect(FakeWebSocket.instances).toHaveLength(0);

    await user.click(screen.getByRole("tab", { name: /AI Activity/i }));
    expect(screen.getByTestId("worker-action-log")).toBeInTheDocument();
    expect(screen.getByTestId("handoff-explanation")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /diagnostics/i }));
    expect(screen.getByText(/Diagnostics are intentionally opt-in/i)).toBeInTheDocument();
    expect(FakeWebSocket.instances).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: /show developer diagnostics/i }));
    await waitFor(() => expect(FakeWebSocket.instances.length).toBeGreaterThan(0));
  });

  it("shows one-sentence next-action guidance with CTAs for empty tasks, task files, and Global Files", async () => {
    mockTasks = [];
    render(<Home />);
    expect(await screen.findByText(/No live tasks yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create first task/i })).toBeInTheDocument();
    cleanup();

    mockTasks = [sampleTask];
    mockThread = { task: sampleTask, activeTurn: null, events: [] };
    mockTaskFiles = [];
    mockGlobalFiles = [];
    render(<Home />);
    await screen.findAllByText("Implement v2 shell");

    expect(screen.getByText(/This task folder is empty/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /upload first task file/i })).toBeInTheDocument();
    expect(screen.getByText(/Global Files is empty/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /upload first Global File/i })).toBeInTheDocument();
  });



  it("renders §1A-CONV conversational onboarding, credentials drawer, and Advanced Setup escape hatch without exposing token values", async () => {
    const user = userEvent.setup();
    mockBuildTargets = [
      {
        id: 77,
        ownerUserId: 42,
        name: "AI API Portal",
        repoUrl: "https://github.com/viyo-ai/AI-API-Web-Portal-v2",
        defaultBaseBranch: "main",
        protectedBranchesJson: JSON.stringify(["main", "staging"]),
        validationCommandsJson: JSON.stringify(["pnpm check", "pnpm test"]),
        serviceChecksJson: JSON.stringify([]),
        agentEnvVarMapJson: JSON.stringify({ WORKSHOP_GITHUB_TOKEN: "BUILD_TARGET_GITHUB_TOKEN" }),
        governanceFilesJson: JSON.stringify([]),
        governanceBudgetEnforced: true,
        archivedAt: null,
        createdAt: 1777999300000,
        updatedAt: 1777999400000,
      },
    ];
    mockCredentialStates = [
      { provider: "claude", configured: false, status: "missing", reason: "Missing CLAUDE_API_KEY.", envVarName: "CLAUDE_API_KEY", lastCheckedAt: 1777999400000 },
      { provider: "kimi", configured: true, status: "configured", reason: "Cloudflare Workers AI credentials are present.", envVarName: "WORKERS_AI_API_TOKEN", lastCheckedAt: 1777999400000 },
    ];

    render(<Home />);
    await screen.findAllByText("Implement v2 shell");

    expect(screen.getByText("Architect-in-Portal")).toBeInTheDocument();
    expect(screen.getByText("Conversational project onboarding")).toBeInTheDocument();
    expect(screen.getByTestId("section1a-conv-advanced-setup-escape")).toHaveTextContent("Advanced Setup");

    await user.click(screen.getByTestId("section1a-conv-architect-start"));
    expect(screen.getByTestId("manus-style-composer")).toHaveTextContent(/Architect, help me set up this project conversationally/i);

    await user.click(screen.getByTestId("section1a-conv-credentials-drawer-open"));
    const credentialsPanel = screen.getByTestId("section1a-conv-credentials-drawer");
    expect(credentialsPanel).toBeInTheDocument();
    expect(credentialsPanel.closest('[role="dialog"]')).toBeInTheDocument();
    expect(screen.getByText("Credentials Drawer")).toBeInTheDocument();
    expect(screen.getByText("Token values stay in Manus env vars. This view shows provider status and env var names only.")).toBeInTheDocument();
    expect(screen.getByText("CLAUDE_API_KEY")).toBeInTheDocument();
    expect(screen.getByText("WORKERS_AI_API_TOKEN")).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(["sk", "[A-Za-z0-9_-]{12,}"].join("-")))).not.toBeInTheDocument();
    expect(screen.queryByText(/xox[baprs]-/)).not.toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: /Test now/i })[0]);
    expect(credentialsRefreshMock).toHaveBeenCalledWith({ providers: ["claude"] });
  });

  it("sorts tasks into live and archived sections, supports inline rename, and renders project-scoped memory", async () => {
    const user = userEvent.setup();
    mockTasks = [
      { ...sampleTask, id: 10, title: "Older live task", status: "active", lastActivityAt: 1777998100000, createdAt: 1777998000000, updatedAt: 1777998100000, archivedAt: null },
      { ...sampleTask, id: 11, title: "Newest live task", status: "active", lastActivityAt: 1777999900000, createdAt: 1777998200000, updatedAt: 1777999900000, archivedAt: null },
      { ...sampleTask, id: 12, title: "Archived planning task", status: "archived", lastActivityAt: 1777998300000, createdAt: 1777998300000, updatedAt: 1777998300000, archivedAt: 1777998400000 },
    ];
    mockThread = { task: mockTasks[1], activeTurn: null, events: [] };
    mockBuildTargets = [
      {
        id: 77,
        ownerUserId: 42,
        name: "AI API Portal",
        repoUrl: "https://github.com/viyo-ai/AI-API-Web-Portal-v2",
        defaultBaseBranch: "main",
        protectedBranchesJson: JSON.stringify(["main", "staging"]),
        validationCommandsJson: JSON.stringify(["pnpm check", "pnpm test"]),
        serviceChecksJson: JSON.stringify([]),
        agentEnvVarMapJson: JSON.stringify({ WORKSHOP_GITHUB_TOKEN: "BUILD_TARGET_GITHUB_TOKEN" }),
        governanceFilesJson: JSON.stringify([]),
        governanceBudgetEnforced: true,
        archivedAt: null,
        createdAt: 1777999300000,
        updatedAt: 1777999400000,
      },
    ];
    mockProjectMemory = [
      { id: 201, ownerUserId: 42, buildTargetId: 77, key: "repo", value: "Use only the selected AI API Portal project context.", source: "architect", createdAt: 1777999500000, updatedAt: 1777999500000 },
    ];

    render(<Home />);
    await screen.findAllByText("Newest live task");

    const liveTasks = screen.getByTestId("section1a-conv-live-tasks");
    expect(within(liveTasks).getByText("Newest live task")).toBeInTheDocument();
    expect(within(liveTasks).getByText("Older live task")).toBeInTheDocument();
    const archivedTasks = screen.getByTestId("section1a-conv-archived-tasks");
    expect(archivedTasks).toHaveTextContent("Archived planning task");
    await user.click(within(archivedTasks).getByTestId("section1a-conv-task-restore"));
    expect(updateTaskStatusMock).toHaveBeenCalledWith({ taskId: 12, status: "active" });
    expect(liveTasks.textContent?.indexOf("Newest live task")).toBeLessThan(liveTasks.textContent?.indexOf("Older live task") ?? Number.MAX_SAFE_INTEGER);

    await user.click(within(liveTasks).getAllByTestId("section1a-conv-task-rename")[0]);
    const renameInput = screen.getByLabelText("Rename Newest live task");
    await user.clear(renameInput);
    await user.type(renameInput, "Renamed conversational task");
    await user.click(screen.getByRole("button", { name: /^Save$/i }));
    expect(renameTaskMock).toHaveBeenCalledWith({ taskId: 11, title: "Renamed conversational task" });

    expect(screen.getByTestId("section1a-conv-project-memory-viewer")).toHaveTextContent("AI API Portal");
    expect(screen.getByText("repo")).toBeInTheDocument();
    expect(screen.getByText("Use only the selected AI API Portal project context.")).toBeInTheDocument();
  });
});
