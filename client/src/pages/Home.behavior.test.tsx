// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./Home";

const logoutMock = vi.fn();
const invalidateMock = vi.fn(async () => undefined);
const createTaskMock = vi.fn();
const submitMessageMock = vi.fn();
const createFileMetadataMock = vi.fn();
const credentialsRefreshMock = vi.fn();
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

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      tasks: { list: { invalidate: invalidateMock }, thread: { invalidate: invalidateMock } },
      files: { listForTask: { invalidate: invalidateMock }, listAll: { invalidate: invalidateMock } },
      memory: { list: { invalidate: invalidateMock } },
      credentials: { status: { invalidate: invalidateMock } },
      filesystem: { tree: { invalidate: invalidateMock }, read: { invalidate: invalidateMock } },
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
      listAll: { useQuery: () => ({ data: mockTaskFiles, isLoading: false }) },
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
  submitMessageMock.mockReset();
  createFileMetadataMock.mockReset();
  credentialsRefreshMock.mockReset();
  filesystemTreeRefetchMock.mockReset();
  filesystemWriteMock.mockReset();
  filesystemMkdirMock.mockReset();
  FakeWebSocket.instances = [];
  resizeObserverCallbacks = [];
  createTaskMock.mockResolvedValue({ task: { ...sampleTask, id: 19, title: "Created task" }, events: [], activeTurn: null });
  submitMessageMock.mockResolvedValue(mockThread);
  createFileMetadataMock.mockResolvedValue(mockTaskFiles[0]);
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
  it("renders the production three-pane workspace without legacy terminal or provider-picker copy", async () => {
    render(<Home />);

    expect((await screen.findAllByText("Implement v2 shell")).length).toBeGreaterThan(0);
    expect(screen.getByText(/Task-first production workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/Center task thread/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Task-scoped files/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Wire the task-first AI coordinator workspace/i)).toBeInTheDocument();
    expect(screen.queryByText(/Wrapper LLM/i)).not.toBeInTheDocument();
    expect(screen.getByText(/No silent fallback/i)).toBeInTheDocument();
    expect(screen.getByText(/claude: missing/i)).toBeInTheDocument();
    expect(screen.getByText(/kimi: configured/i)).toBeInTheDocument();
    expect(screen.getByText(/Missing CLAUDE_API_KEY\./i)).toBeInTheDocument();
    expect(screen.queryByText(/TerminalPanel|WorkspaceCommandCenter|FilesystemPanel/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/PTY shell terminal/i)).not.toBeInTheDocument();
    expect(FakeWebSocket.instances).toHaveLength(0);
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

  it("submits the selected task message through the task thread and refreshes v2 task context", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await screen.findAllByText("Implement v2 shell");
    await user.click(screen.getByText(/Use #kimi only if you want an execution draft/i));
    await user.click(screen.getByRole("button", { name: /send to task thread/i }));

    expect(submitMessageMock).toHaveBeenCalledWith({
      taskId: 7,
      message: "Use #kimi only if you want an execution draft for a narrowly scoped code change.",
      routeMode: "auto",
    });
    await waitFor(() => expect(invalidateMock).toHaveBeenCalled());
  });

  it("creates a new task from the sidebar with honest task-first defaults", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.click(screen.getByRole("button", { name: /new task/i }));

    expect(createTaskMock).toHaveBeenCalledWith({
      title: "AI coding workshop task",
      summary: "Task-first v2 workspace item created from the plain-English AI coding workshop.",
      routeMode: "auto",
    });
    expect(submitMessageMock).toHaveBeenCalledWith(expect.objectContaining({ taskId: 19, routeMode: "auto" }));
  });

  it("refreshes provider credential status through the protected v2 credentials mutation", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.click(screen.getByRole("button", { name: /refresh credential status/i }));

    expect(credentialsRefreshMock).toHaveBeenCalledWith({ providers: ["claude", "kimi"] });
    await waitFor(() => expect(invalidateMock).toHaveBeenCalled());
  });

  it("records task-file metadata only against the selected v2 task", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await screen.findAllByText("Implement v2 shell");
    await user.type(screen.getByPlaceholderText("relative/path.md"), "docs/implementation-note.md");
    await user.type(screen.getByPlaceholderText("/manus-storage/..."), "/manus-storage/real-task-file-reference");
    await user.click(screen.getByRole("button", { name: /record file metadata/i }));

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

  it("writes and creates authenticated workspace filesystem entries from the real filesystem panel", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await screen.findAllByText("Implement v2 shell");
    await user.click(screen.getByRole("button", { name: /show advanced tools/i }));
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
    await user.click(screen.getByRole("button", { name: /show advanced tools/i }));
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
    await user.click(screen.getByRole("button", { name: /show advanced tools/i }));
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
    await user.click(screen.getByRole("button", { name: /show advanced tools/i }));
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
});
