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
const submitMessageMock = vi.fn();
const createFileMetadataMock = vi.fn();
const uploadWorkspaceFileMock = vi.fn();
const attachGlobalToTaskMock = vi.fn();
const credentialsRefreshMock = vi.fn();
const createBuildTargetMock = vi.fn();
const updateBuildTargetSettingsMock = vi.fn();
const createBuildBranchMock = vi.fn();
const pushBuildBranchMock = vi.fn();
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

let mockTasks: Array<typeof sampleTask> = [sampleTask];
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
let mockAttachedGlobalFiles: Array<{ id: number; taskId: number; globalFileId: number; attachedLabel: string; file: (typeof mockGlobalFiles)[number] }> = [];
let mockMemory: Array<{ id: number; title: string; category: string; content: string }> = [
  { id: 88, title: "No silent fallback", category: "decision", content: "Missing Claude or Kimi credentials must block explicitly." },
];
let mockCredentialStates = [
  { provider: "claude", configured: false, status: "missing", reason: "Missing CLAUDE_API_KEY." },
  { provider: "kimi", configured: true, status: "configured", reason: "Cloudflare Workers AI credentials are present." },
];

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
      credentials: { status: { invalidate: invalidateMock } },
      filesystem: { tree: { invalidate: invalidateMock }, read: { invalidate: invalidateMock } },
      buildTargets: { list: { invalidate: invalidateMock }, get: { invalidate: invalidateMock }, testConnection: { invalidate: invalidateMock }, updateSettings: { invalidate: invalidateMock } },
      buildBranch: { list: { invalidate: invalidateMock }, getStatus: { invalidate: invalidateMock } },
      buildBranches: { list: { invalidate: invalidateMock }, status: { invalidate: invalidateMock }, push: { invalidate: invalidateMock } },
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
    },
    orchestration: {
      submitMessage: {
        useMutation: () => ({
          mutateAsync: submitMessageMock,
          isPending: false,
        }),
      },
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
    filesystem: {
      tree: { useQuery: () => ({ data: { name: "workspace", relativePath: "", type: "directory", children: [] }, isLoading: false, refetch: filesystemTreeRefetchMock }) },
      read: { useQuery: () => ({ data: { relativePath: "README.md", content: "", exists: false }, isLoading: false }) },
      write: { useMutation: () => ({ mutate: filesystemWriteMock, isPending: false }) },
      mkdir: { useMutation: () => ({ mutate: filesystemMkdirMock, isPending: false }) },
      upload: { useMutation: () => ({ mutateAsync: uploadWorkspaceFileMock, isPending: false }) },
    },
    buildTargets: {
      list: { useQuery: () => ({ data: [], isLoading: false }) },
      get: { useQuery: () => ({ data: undefined, isLoading: false }) },
      create: { useMutation: () => ({ mutateAsync: createBuildTargetMock, isPending: false }) },
      updateSettings: { useMutation: () => ({ mutateAsync: updateBuildTargetSettingsMock, isPending: false }) },
      testConnection: { useMutation: () => ({ mutateAsync: vi.fn(async () => ({ ok: false, message: "No token configured.", tokenConfigured: false })), isPending: false }) },
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
});

beforeEach(() => {
  logoutMock.mockReset();
  invalidateMock.mockClear();
  createTaskMock.mockReset();
  updateTaskStatusMock.mockReset();
  submitMessageMock.mockReset();
  createFileMetadataMock.mockReset();
  uploadWorkspaceFileMock.mockReset();
  attachGlobalToTaskMock.mockReset();
  credentialsRefreshMock.mockReset();
  createBuildTargetMock.mockReset();
  createBuildBranchMock.mockReset();
  filesystemTreeRefetchMock.mockReset();
  filesystemWriteMock.mockReset();
  filesystemMkdirMock.mockReset();
  FakeWebSocket.instances = [];
  resizeObserverCallbacks = [];
  createTaskMock.mockResolvedValue({ task: { ...sampleTask, id: 19, title: "Created task" }, events: [], activeTurn: null });
  updateTaskStatusMock.mockResolvedValue({ ...sampleTask, status: "archived" });
  submitMessageMock.mockResolvedValue(mockThread);
  createFileMetadataMock.mockResolvedValue(mockTaskFiles[0]);
  attachGlobalToTaskMock.mockResolvedValue({ id: 501, taskId: 7, globalFileId: 56, attachedLabel: "Owner playbook.pdf", file: mockGlobalFiles[0] });
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
  mockCredentialStates = [
    { provider: "claude", configured: false, status: "missing", reason: "Missing CLAUDE_API_KEY." },
    { provider: "kimi", configured: true, status: "configured", reason: "Cloudflare Workers AI credentials are present." },
  ];
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

    await user.click(screen.getByRole("button", { name: /show technical details/i }));
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

    await user.click(screen.getByRole("button", { name: /show technical details/i }));
    expect(screen.getAllByText("Kimi returned an empty response.").length).toBeGreaterThan(0);
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
    await waitFor(() => expect(screen.getAllByText(/connected/i).length).toBeGreaterThan(0));

    await act(async () => {
      socket.dispatchJson({
        type: "ready",
        sessionKey: "test-session",
        tmuxSessionName: "ai-workshop-test",
        tmuxEnabled: true,
        terminalMode: "pty",
        cwd: "/workspace/task-7",
      });
    });

    expect(screen.getByText(/tmux PTY terminal/i)).toBeInTheDocument();
    expect(screen.getByText(/tmux · ai-workshop-test · \/workspace\/task-7/i)).toBeInTheDocument();
  });

  it("throttles terminal ResizeObserver fitting through requestAnimationFrame", async () => {
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

});
