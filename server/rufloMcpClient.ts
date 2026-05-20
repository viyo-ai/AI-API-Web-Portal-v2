/**
 * §PORTAL-PHASE-1 Component 1 — Ruflo MCP Subprocess Lifecycle Manager
 *
 * Spawns and manages a Ruflo MCP server as a child process.
 * Speaks JSON-RPC 2.0 over stdio. Provides graceful shutdown,
 * crash restart with exponential backoff (max 5 retries), and
 * a health check endpoint.
 *
 * Ruflo does NOT consume CLAUDE_API_KEY or ANTHROPIC_API_KEY.
 * It is a local utility server providing memory, swarm, hooks,
 * and neural tools via the MCP protocol.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import type { Express } from "express";

// ─── Configuration ─────────────────────────────────────────────────────────────

const RUFLO_ENV: Record<string, string> = {
  CLAUDE_FLOW_MODE: "v3",
  CLAUDE_FLOW_HOOKS_ENABLED: "true",
  CLAUDE_FLOW_TOPOLOGY: "mesh",
  CLAUDE_FLOW_MAX_AGENTS: "8",
  CLAUDE_FLOW_MEMORY_BACKEND: "sqljs",
};

// ─── Ruflo Binary Resolution ──────────────────────────────────────────────────

/**
 * Locate the ruflo binary. Resolution order:
 * 1. node_modules/ruflo/bin/ruflo.js (production — installed as a dependency)
 * 2. npx cache (legacy sandbox fallback)
 *
 * The production path is the primary mechanism. ruflo@3.6.30 is pinned in
 * package.json so `pnpm install` places it in node_modules on every build.
 * The npx cache fallback exists only for backward compatibility with sandbox
 * environments that pre-date the dependency addition.
 */
export function findRufloBinary(): string {
  // Primary: node_modules dependency (works in production and sandbox)
  const localPkg = resolve(process.cwd(), "node_modules", "ruflo", "bin", "ruflo.js");
  if (existsSync(localPkg)) return localPkg;

  // Fallback: npx cache (sandbox-only legacy path)
  const homeDir = process.env.HOME || "/home/ubuntu";
  const npxCacheBase = join(homeDir, ".npm", "_npx");
  try {
    const dirs = readdirSync(npxCacheBase);
    for (const dir of dirs) {
      const candidate = join(npxCacheBase, dir, "node_modules", "ruflo", "bin", "ruflo.js");
      if (existsSync(candidate)) return candidate;
    }
  } catch {
    // npx cache not available
  }

  throw new Error(
    "Ruflo binary not found. Ensure ruflo@3.6.30 is in package.json dependencies."
  );
}

const MAX_RESTART_RETRIES = 5;
const BASE_BACKOFF_MS = 1000;
const STARTUP_TIMEOUT_MS = 30_000;
const JSONRPC_VERSION = "2.0" as const;

// ─── Types ─────────────────────────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: typeof JSONRPC_VERSION;
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: typeof JSONRPC_VERSION;
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface RufloHealthStatus {
  alive: boolean;
  pid: number | null;
  uptimeMs: number | null;
  restartCount: number;
  toolCount: number | null;
  lastError: string | null;
}

export interface RufloToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

// ─── State ─────────────────────────────────────────────────────────────────────

let subprocess: ChildProcess | null = null;
let startedAt: number | null = null;
let restartCount = 0;
let lastError: string | null = null;
let toolCache: RufloToolDefinition[] = [];
let requestIdCounter = 1;
let pendingRequests = new Map<number, { resolve: (v: JsonRpcResponse) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
let stdinBuffer = "";
let isShuttingDown = false;
let restartTimer: ReturnType<typeof setTimeout> | null = null;

// ─── JSON-RPC Transport ────────────────────────────────────────────────────────

function sendRequest(method: string, params?: Record<string, unknown>): Promise<JsonRpcResponse> {
  return new Promise((resolve, reject) => {
    if (!subprocess || !subprocess.stdin || subprocess.killed) {
      reject(new Error("Ruflo subprocess is not running."));
      return;
    }

    const id = requestIdCounter++;
    const request: JsonRpcRequest = { jsonrpc: JSONRPC_VERSION, id, method, params };
    const payload = JSON.stringify(request) + "\n";

    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`Ruflo JSON-RPC request ${method} (id=${id}) timed out after 30s.`));
    }, 30_000);

    pendingRequests.set(id, { resolve, reject, timer });

    try {
      subprocess.stdin.write(payload);
    } catch (err) {
      clearTimeout(timer);
      pendingRequests.delete(id);
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

function handleStdoutData(chunk: Buffer) {
  stdinBuffer += chunk.toString("utf-8");
  const lines = stdinBuffer.split("\n");
  stdinBuffer = lines.pop() ?? "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const msg = JSON.parse(trimmed) as JsonRpcResponse;
      if (msg.id != null && pendingRequests.has(msg.id)) {
        const pending = pendingRequests.get(msg.id)!;
        clearTimeout(pending.timer);
        pendingRequests.delete(msg.id);
        pending.resolve(msg);
      }
      // Notifications (no id) are silently ignored.
    } catch {
      // Non-JSON output from Ruflo (startup banners, etc.) — ignore.
    }
  }
}

// ─── Subprocess Lifecycle ──────────────────────────────────────────────────────

function spawnRufloProcess(): ChildProcess {
  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    ...RUFLO_ENV,
    // Explicitly exclude API keys from Ruflo's environment
    ANTHROPIC_API_KEY: "",
    CLAUDE_API_KEY: "",
    OPENAI_API_KEY: "",
  };

  // Remove empty string keys that might confuse the subprocess
  delete env.ANTHROPIC_API_KEY;
  delete env.CLAUDE_API_KEY;
  delete env.OPENAI_API_KEY;

  // Use the cached ruflo binary directly to avoid npx version resolution issues
  // with alpha releases that have invalid semver in their dependency trees.
  const rufloBin = findRufloBinary();
  const child = spawn("node", [rufloBin, "mcp", "start"], {
    env,
    stdio: ["pipe", "pipe", "pipe"],
    cwd: process.cwd(),
  });

  return child;
}

async function initializeConnection(): Promise<void> {
  // Send MCP initialize handshake
  const initResponse = await sendRequest("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "portal-ruflo-client", version: "1.0.0" },
  });

  if (initResponse.error) {
    throw new Error(`Ruflo initialize failed: ${initResponse.error.message}`);
  }

  // Send initialized notification (no response expected, but we send as request for simplicity)
  if (subprocess?.stdin && !subprocess.killed) {
    const notification = JSON.stringify({ jsonrpc: JSONRPC_VERSION, method: "notifications/initialized" }) + "\n";
    subprocess.stdin.write(notification);
  }

  // Discover available tools
  const toolsResponse = await sendRequest("tools/list", {});
  if (toolsResponse.result && typeof toolsResponse.result === "object") {
    const result = toolsResponse.result as { tools?: RufloToolDefinition[] };
    toolCache = (result.tools ?? []).map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
  }
}

export async function startRufloSubprocess(): Promise<void> {
  if (isShuttingDown) return;
  if (subprocess && !subprocess.killed) return;

  try {
    subprocess = spawnRufloProcess();
    startedAt = Date.now();

    subprocess.stdout!.on("data", handleStdoutData);
    subprocess.stderr!.on("data", (chunk: Buffer) => {
      // Log stderr but don't treat as fatal — Ruflo may emit warnings
      const text = chunk.toString("utf-8").trim();
      if (text) console.error(`[ruflo-mcp stderr] ${text}`);
    });

    subprocess.on("exit", (code, signal) => {
      const reason = signal ? `signal ${signal}` : `code ${code}`;
      console.error(`[ruflo-mcp] Subprocess exited (${reason}).`);
      lastError = `Exited with ${reason}`;
      subprocess = null;
      startedAt = null;
      toolCache = [];

      // Reject all pending requests
      pendingRequests.forEach((pending, _id) => {
        clearTimeout(pending.timer);
        pending.reject(new Error(`Ruflo subprocess exited (${reason}).`));
      });
      pendingRequests.clear();
      stdinBuffer = "";

      // Auto-restart if not shutting down
      if (!isShuttingDown) {
        scheduleRestart();
      }
    });

    subprocess.on("error", (err) => {
      console.error(`[ruflo-mcp] Subprocess error: ${err.message}`);
      lastError = err.message;
    });

    // Wait for subprocess to be ready, then initialize
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Ruflo subprocess did not become ready within timeout."));
      }, STARTUP_TIMEOUT_MS);

      // Give the process a moment to start, then try initialize
      const attemptInit = async () => {
        try {
          await initializeConnection();
          clearTimeout(timeout);
          resolve();
        } catch (err) {
          // If the process hasn't started yet, retry after a short delay
          if (!subprocess || subprocess.killed) {
            clearTimeout(timeout);
            reject(err instanceof Error ? err : new Error(String(err)));
            return;
          }
          setTimeout(attemptInit, 500);
        }
      };

      setTimeout(attemptInit, 1000); // Initial delay for process startup
    });

    console.log(`[ruflo-mcp] Subprocess started (pid=${subprocess.pid}, tools=${toolCache.length}).`);
    restartCount = 0; // Reset on successful start
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    lastError = message;
    console.error(`[ruflo-mcp] Failed to start: ${message}`);
    subprocess?.kill("SIGTERM");
    subprocess = null;
    startedAt = null;
    scheduleRestart();
  }
}

function scheduleRestart() {
  if (isShuttingDown) return;
  if (restartCount >= MAX_RESTART_RETRIES) {
    console.error(`[ruflo-mcp] Max restart retries (${MAX_RESTART_RETRIES}) reached. Ruflo tools unavailable.`);
    lastError = `Max restart retries (${MAX_RESTART_RETRIES}) exhausted.`;
    return;
  }

  restartCount++;
  const delay = BASE_BACKOFF_MS * Math.pow(2, restartCount - 1);
  console.log(`[ruflo-mcp] Scheduling restart #${restartCount} in ${delay}ms.`);
  restartTimer = setTimeout(() => {
    restartTimer = null;
    startRufloSubprocess().catch((err) => {
      console.error(`[ruflo-mcp] Restart #${restartCount} failed: ${err instanceof Error ? err.message : err}`);
    });
  }, delay);
}

export async function stopRufloSubprocess(): Promise<void> {
  isShuttingDown = true;
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }

  if (subprocess && !subprocess.killed) {
    subprocess.kill("SIGTERM");
    // Give 3 seconds for graceful shutdown
    await new Promise<void>((resolve) => {
      const forceKill = setTimeout(() => {
        if (subprocess && !subprocess.killed) {
          subprocess.kill("SIGKILL");
        }
        resolve();
      }, 3000);

      subprocess!.on("exit", () => {
        clearTimeout(forceKill);
        resolve();
      });
    });
  }

  subprocess = null;
  startedAt = null;
  toolCache = [];
  pendingRequests.clear();
  stdinBuffer = "";
}

// ─── Tool Invocation ───────────────────────────────────────────────────────────

/**
 * Call a Ruflo tool by name. The name should NOT include the `ruflo.` prefix —
 * callers strip the prefix before passing to this function.
 */
export async function callRufloTool(toolName: string, args: Record<string, unknown> = {}): Promise<unknown> {
  if (!subprocess || subprocess.killed) {
    throw new Error("Ruflo subprocess is not running. Tool call unavailable.");
  }

  const response = await sendRequest("tools/call", { name: toolName, arguments: args });

  if (response.error) {
    throw new Error(`Ruflo tool "${toolName}" failed: ${response.error.message}`);
  }

  return response.result;
}

/**
 * Check if a tool name is a Ruflo-namespaced tool.
 */
export function isRufloTool(toolName: string): boolean {
  return toolName.startsWith("ruflo.");
}

/**
 * Strip the `ruflo.` prefix from a tool name for dispatch to the subprocess.
 */
export function stripRufloPrefix(toolName: string): string {
  return toolName.replace(/^ruflo\./, "");
}

// ─── Health & Introspection ────────────────────────────────────────────────────

export function getRufloHealth(): RufloHealthStatus {
  return {
    alive: subprocess != null && !subprocess.killed,
    pid: subprocess?.pid ?? null,
    uptimeMs: startedAt ? Date.now() - startedAt : null,
    restartCount,
    toolCount: toolCache.length > 0 ? toolCache.length : null,
    lastError,
  };
}

export function getRufloTools(): RufloToolDefinition[] {
  return [...toolCache];
}

/**
 * Get Ruflo tool descriptions formatted for LLM system prompt injection.
 * Returns a summary block listing tool categories and counts.
 */
export function getRufloToolSummaryForPrompt(): string {
  if (toolCache.length === 0) {
    return "";
  }

  const categories: Record<string, string[]> = {};
  for (const tool of toolCache) {
    const prefix = tool.name.split("_")[0] ?? "other";
    if (!categories[prefix]) categories[prefix] = [];
    categories[prefix].push(tool.name);
  }

  const lines = [`Available Ruflo tools (${toolCache.length} total, namespaced as ruflo.*):`, ""];
  for (const category of Object.keys(categories)) {
    const tools = categories[category];
    lines.push(`- ruflo.${category}_* (${tools.length} tools): ${tools.slice(0, 3).map((t: string) => `ruflo.${t}`).join(", ")}${tools.length > 3 ? `, ... +${tools.length - 3} more` : ""}`);
  }

  lines.push("");
  lines.push("Call any tool as ruflo.<tool_name> with the appropriate arguments. Tools are forwarded to the Ruflo MCP subprocess.");

  return lines.join("\n");
}

// ─── Express Health Endpoint Registration ──────────────────────────────────────
export function registerRufloHealthEndpoint(app: Express): void {
  app.get("/api/internal/ruflo/health", (_req, res) => {
    const health = getRufloHealth();
    // Add diagnostic info for production debugging
    let binaryPath: string | null = null;
    let binaryExists = false;
    try {
      binaryPath = findRufloBinary();
      binaryExists = existsSync(binaryPath);
    } catch (e) {
      binaryPath = e instanceof Error ? e.message : String(e);
    }
    const statusCode = health.alive ? 200 : 503;
    res.status(statusCode).json({
      ...health,
      diagnostics: {
        binaryPath,
        binaryExists,
        cwd: process.cwd(),
        nodeModulesRufloExists: existsSync(resolve(process.cwd(), "node_modules", "ruflo", "bin", "ruflo.js")),
      },
    });
  });
}

// ─── Test Helpers (exported for behavioral tests) ──────────────────────────────

export function _test_getSubprocess() {
  return subprocess;
}

export function _test_resetState() {
  isShuttingDown = false;
  restartCount = 0;
  lastError = null;
  toolCache = [];
  pendingRequests.clear();
  stdinBuffer = "";
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
}

export function _test_setToolCache(tools: RufloToolDefinition[]) {
  toolCache = [...tools];
}
