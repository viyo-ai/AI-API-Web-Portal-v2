import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const root = process.cwd();

function readProjectFile(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("v2 task-first workspace production regressions", () => {
  it("keeps the main page on the approved three-pane task/memory/thread/files shell", () => {
    const source = readProjectFile("client/src/pages/Home.tsx");

    expect(source).toContain("Task-first production shell");
    expect(source).toContain("Live tasks");
    expect(source).toContain("Global memory");
    expect(source).toContain("Center task thread");
    expect(source).toContain("Task files and context");
    expect(source).toContain("Task-scoped files");
    expect(source).toContain("Master files view");
    expect(source).toContain("bg-[#f7f6f2]");
  });

  it("keeps terminal and filesystem as supporting panels inside the task-first workspace", () => {
    const source = readProjectFile("client/src/pages/Home.tsx");
    const terminalSource = readProjectFile("client/src/components/TerminalPanel.tsx");
    const filesystemSource = readProjectFile("client/src/components/FilesystemPanel.tsx");

    expect(source).toContain("TerminalPanel");
    expect(source).toContain("FilesystemPanel");
    expect(source).toContain("terminal and filesystem tools are supporting panels");
    expect(source).not.toContain("WorkspaceCommandCenter");
    expect(source).not.toMatch(/Draft safe plan|Approve and run|opencode\.ai background CLI/i);
    expect(terminalSource).toContain("@xterm/xterm");
    expect(terminalSource).toContain("/api/terminal");
    expect(terminalSource).toContain("Authenticated terminal with PTY or basic shell fallback");
    expect(filesystemSource).toContain("trpc.filesystem.tree.useQuery");
    expect(filesystemSource).toContain("trpc.filesystem.write.useMutation");
  });

  it("keeps terminal backend wired to authenticated node-pty with explicit tmux attach and honest fallback", () => {
    const source = readProjectFile("server/terminal.ts");

    expect(source).toContain("authenticateUpgradeRequest");
    expect(source).toContain("sdk.authenticateRequest");
    expect(source).toContain("await import(\"node-pty\")");
    expect(source).toContain("Basic shell fallback connected. node-pty native module is unavailable");
    expect(source).toContain("spawn(launchCommand.command, launchCommand.args");
    expect(source).toContain("args: [\"new-session\", \"-A\", \"-s\", tmuxSessionName]");
    expect(source).toContain("tmuxEnabled: false");
    expect(source).toContain("tmux is not installed in this runtime");
    expect(source).toContain("getUserWorkspaceRoot(ownerUserId)");
  });

  it("keeps provider routing inside the Wrapper LLM instead of exposing a provider dropdown", () => {
    const source = readProjectFile("client/src/pages/Home.tsx");

    expect(source).toContain("AUTO routes internally");
    expect(source).toContain("#claude");
    expect(source).toContain("#kimi");
    expect(source).toContain("No provider dropdown");
    expect(source).toContain("Missing credentials block explicitly");
    expect(source).not.toMatch(/<select|SelectItem|provider picker/i);
  });

  it("wires the page to current v2 tRPC procedures rather than removed workspace and command routers", () => {
    const source = readProjectFile("client/src/pages/Home.tsx");

    expect(source).toContain("trpc.tasks.list.useQuery");
    expect(source).toContain("trpc.tasks.thread.useQuery");
    expect(source).toContain("trpc.orchestration.submitMessage.useMutation");
    expect(source).toContain("trpc.files.listForTask.useQuery");
    expect(source).toContain("trpc.files.listAll.useQuery");
    expect(source).toContain("trpc.memory.list.useQuery");
    expect(source).toContain("trpc.credentials.status.useQuery");
    expect(source).toContain("credentialsRefreshMutation");
    expect(source).toContain("Missing credentials block explicitly");
    expect(source).not.toContain("trpc.workspace");
    expect(source).not.toContain("trpc.command");
  });

  it("keeps backend route decisions, credential status, memory, and file metadata on the v2 router surface", () => {
    const source = readProjectFile("server/routers.ts");

    expect(source).toContain("detectRouteOverride");
    expect(source).toContain("resolveWrapperRoute");
    expect(source).toContain("orchestration: router");
    expect(source).toContain("submitMessage");
    expect(source).toContain("credentials: router");
    expect(source).toContain("status: protectedProcedure.query");
    expect(source).toContain("refresh: protectedProcedure");
    expect(source).toContain("files: router");
    expect(source).toContain("filesystem: router");
    expect(source).toContain("memory: router");
    expect(source).toContain("CREDENTIALS_UNAVAILABLE");
    expect(source).not.toContain("command: router");
    expect(source).not.toContain("workspace: router");
  });

  it("keeps honest empty states instead of demo records for files and memory", () => {
    const source = readProjectFile("client/src/pages/Home.tsx");

    expect(source).toContain("No live tasks yet");
    expect(source).toContain("Durable memory is empty");
    expect(source).toContain("No files have been attached to this task yet");
    expect(source).toContain("The all-files index is empty");
    expect(source).toContain("No fake seeded files or memories");
    expect(source).not.toMatch(/demo task|sample task|placeholder task|fake task/i);
  });
});
