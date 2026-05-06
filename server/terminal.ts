import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import type { IncomingMessage } from "node:http";
import type { Server } from "node:http";
import path from "node:path";
import { parse as parseUrl } from "node:url";
import type * as NodePty from "node-pty";
import { WebSocketServer, type RawData, type WebSocket } from "ws";
import { sdk } from "./_core/sdk";

const WORKSPACE_ROOT = process.env.AICW_WORKSPACE_ROOT || "/tmp/ai-coding-workshop-workspaces";
const MAX_INPUT_BYTES = 16 * 1024;
const DEFAULT_COLS = 100;
const DEFAULT_ROWS = 28;
const DEFAULT_TMUX = "tmux";

type ClientMessage =
  | { type: "input"; data: string }
  | { type: "resize"; cols: number; rows: number };

type RegisteredTerminal = {
  enabled: true;
  path: "/api/terminal";
  rootPath: string;
};

type AuthenticatedSocket = WebSocket & {
  authenticatedUser?: Awaited<ReturnType<typeof sdk.authenticateRequest>>;
};

type TerminalMode = "pty" | "basic";

type TerminalLaunchCommand = {
  command: string;
  args: string[];
  tmuxSessionName: string;
  tmuxEnabled: boolean;
  terminalMode: TerminalMode;
  status: string;
};

type NodePtyLoadResult =
  | { pty: typeof NodePty; errorMessage: null }
  | { pty: null; errorMessage: string };

function sendJson(socket: WebSocket, value: unknown) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(value));
  }
}

function coerceDimension(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function parseClientMessage(raw: WebSocket.RawData): ClientMessage | null {
  const text = raw.toString("utf8");
  if (text.length > MAX_INPUT_BYTES) return null;
  try {
    const parsed = JSON.parse(text) as Partial<ClientMessage>;
    if (parsed.type === "input" && typeof parsed.data === "string") return parsed as ClientMessage;
    if (parsed.type === "resize") {
      return {
        type: "resize",
        cols: coerceDimension((parsed as { cols?: unknown }).cols, DEFAULT_COLS, 20, 240),
        rows: coerceDimension((parsed as { rows?: unknown }).rows, DEFAULT_ROWS, 8, 80),
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function authenticateUpgradeRequest(req: IncomingMessage) {
  const expressLikeRequest = {
    headers: req.headers,
    protocol: req.headers["x-forwarded-proto"] === "https" ? "https" : "http",
  } as never;
  return sdk.authenticateRequest(expressLikeRequest);
}

async function resolveExecutable(command: string) {
  const candidates = command.includes(path.sep)
    ? [command]
    : (process.env.PATH || "/usr/local/bin:/usr/bin:/bin")
        .split(path.delimiter)
        .filter(Boolean)
        .map((directory) => path.join(directory, command));

  for (const candidate of candidates) {
    try {
      await fs.access(candidate, fsConstants.X_OK);
      return candidate;
    } catch {
      // Try the next PATH entry.
    }
  }
  return null;
}

function getInteractiveShellArgs(shellCommand: string) {
  const shellName = path.basename(shellCommand);
  if (shellName === "bash" || shellName === "zsh") return ["-il"];
  if (shellName === "fish") return ["-i"];
  return ["-i"];
}

async function resolveShellLaunch() {
  const requestedShell = process.env.SHELL || "/bin/bash";
  const shell = (await resolveExecutable(requestedShell)) || (await resolveExecutable("bash")) || (await resolveExecutable("sh")) || "/bin/sh";
  return { command: shell, args: getInteractiveShellArgs(shell) };
}

function summarizeNativeLoadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n").map(line => line.trim()).filter(Boolean)[0] || "node-pty native module could not be loaded.";
}

async function loadNodePty(): Promise<NodePtyLoadResult> {
  try {
    return { pty: await import("node-pty"), errorMessage: null };
  } catch (error) {
    return { pty: null, errorMessage: summarizeNativeLoadError(error) };
  }
}

async function buildTerminalLaunchCommand(ownerUserId: number, terminalMode: TerminalMode, ptyLoadError: string | null): Promise<TerminalLaunchCommand> {
  const tmuxSessionName = `aicw-user-${ownerUserId}`;

  if (terminalMode === "pty") {
    const tmuxBinary = await resolveExecutable(process.env.AICW_TMUX_BINARY || DEFAULT_TMUX);
    if (tmuxBinary) {
      return {
        command: tmuxBinary,
        args: ["new-session", "-A", "-s", tmuxSessionName],
        tmuxSessionName,
        tmuxEnabled: true,
        terminalMode,
        status: "Authenticated node-pty terminal connected to a persistent tmux session inside your private task workspace directory.",
      };
    }

    return {
      ...(await resolveShellLaunch()),
      tmuxSessionName,
      tmuxEnabled: false,
      terminalMode,
      status: "Authenticated node-pty terminal connected. tmux is not installed in this runtime, so commands run in a non-persistent login shell inside your private task workspace directory.",
    };
  }

  return {
    ...(await resolveShellLaunch()),
    tmuxSessionName,
    tmuxEnabled: false,
    terminalMode,
    status: `Basic shell fallback connected. node-pty native module is unavailable in this runtime (${ptyLoadError ?? "no loader detail"}), so tmux is disabled and full-screen terminal UI behavior may be limited. Commands still run inside your private task workspace directory.`,
  };
}

export async function getUserWorkspaceRoot(ownerUserId: number) {
  const root = path.join(WORKSPACE_ROOT, `user-${ownerUserId}`);
  await fs.mkdir(root, { recursive: true, mode: 0o700 });
  return root;
}

function wirePtyTerminal(socket: WebSocket, terminal: NodePty.IPty) {
  terminal.onData(data => sendJson(socket, { type: "output", data }));
  terminal.onExit(({ exitCode, signal }) => {
    sendJson(socket, { type: "status", status: `Terminal exited with code ${exitCode}${signal ? ` (${signal})` : ""}.` });
    socket.close();
  });

  socket.on("message", (raw: RawData) => {
    const message = parseClientMessage(raw);
    if (!message) {
      sendJson(socket, { type: "error", message: "Ignored malformed or oversized terminal message." });
      return;
    }
    if (message.type === "input") terminal.write(message.data);
    if (message.type === "resize") terminal.resize(message.cols, message.rows);
  });

  socket.on("close", () => {
    terminal.kill();
  });
}

function wireBasicShell(socket: WebSocket, shell: ChildProcessWithoutNullStreams) {
  const forwardOutput = (data: Buffer | string) => sendJson(socket, { type: "output", data: data.toString() });

  shell.stdout.on("data", forwardOutput);
  shell.stderr.on("data", forwardOutput);
  shell.on("error", error => {
    sendJson(socket, { type: "error", fatal: true, message: `Terminal fallback shell failed to start: ${error.message}` });
    socket.close();
  });
  shell.on("exit", (exitCode, signal) => {
    sendJson(socket, { type: "status", status: `Fallback shell exited with code ${exitCode ?? "unknown"}${signal ? ` (${signal})` : ""}.` });
    socket.close();
  });

  socket.on("message", (raw: RawData) => {
    const message = parseClientMessage(raw);
    if (!message) {
      sendJson(socket, { type: "error", message: "Ignored malformed or oversized terminal message." });
      return;
    }
    if (message.type === "input" && shell.stdin.writable) shell.stdin.write(message.data);
    if (message.type === "resize") {
      sendJson(socket, { type: "status", status: "Resize noted. Basic shell fallback is not a PTY, so terminal dimensions cannot be applied until node-pty is available." });
    }
  });

  socket.on("close", () => {
    if (!shell.killed) shell.kill();
  });
}

export function registerTerminalWebSocket(server: Server): RegisteredTerminal {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", async (req, socket, head) => {
    const { pathname } = parseUrl(req.url || "");
    if (pathname !== "/api/terminal") return;

    try {
      const user = await authenticateUpgradeRequest(req);
      wss.handleUpgrade(req, socket, head, ws => {
        (ws as AuthenticatedSocket).authenticatedUser = user;
        wss.emit("connection", ws, req);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unauthorized terminal connection";
      socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Type: text/plain\r\n\r\n");
      socket.write(message);
      socket.destroy();
    }
  });

  wss.on("connection", async (socket: WebSocket) => {
    try {
      const user = (socket as AuthenticatedSocket).authenticatedUser;
      if (!user) throw new Error("Terminal connection is missing authenticated user context.");
      const ownerUserId = user.id;
      const cwd = await getUserWorkspaceRoot(ownerUserId);
      const ptyLoad = await loadNodePty();
      const terminalMode: TerminalMode = ptyLoad.pty ? "pty" : "basic";
      const launchCommand = await buildTerminalLaunchCommand(ownerUserId, terminalMode, ptyLoad.errorMessage);

      sendJson(socket, {
        type: "ready",
        sessionKey: `user-${ownerUserId}`,
        tmuxSessionName: launchCommand.tmuxSessionName,
        tmuxEnabled: launchCommand.tmuxEnabled,
        terminalMode: launchCommand.terminalMode,
        cwd,
      });
      sendJson(socket, {
        type: "status",
        status: launchCommand.status,
      });

      if (ptyLoad.pty) {
        const terminal = ptyLoad.pty.spawn(launchCommand.command, launchCommand.args, {
          name: "xterm-256color",
          cols: DEFAULT_COLS,
          rows: DEFAULT_ROWS,
          cwd,
          env: {
            ...process.env,
            AICW_WORKSPACE_ROOT: cwd,
            TERM: "xterm-256color",
          },
        });
        wirePtyTerminal(socket, terminal);
        return;
      }

      const shell = spawn(launchCommand.command, launchCommand.args, {
        cwd,
        env: {
          ...process.env,
          AICW_WORKSPACE_ROOT: cwd,
          TERM: "xterm-256color",
        },
        stdio: "pipe",
      });
      wireBasicShell(socket, shell);
    } catch (error) {
      sendJson(socket, { type: "error", fatal: true, message: error instanceof Error ? error.message : "Terminal initialization failed." });
      socket.close();
    }
  });

  return { enabled: true, path: "/api/terminal", rootPath: WORKSPACE_ROOT };
}
