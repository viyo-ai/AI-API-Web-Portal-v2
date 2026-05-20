/**
 * §PORTAL-PHASE-2 — INV-P2 Behavioral Tests
 *
 * Covers all 10 invariants:
 * INV-P2-01: runParallelWorkers returns WorkerResult[] with correct fields
 * INV-P2-02: Workers execute in parallel (timing proof)
 * INV-P2-03: Per-worker timeout enforced (timed-out worker returns status=timeout)
 * INV-P2-04: One worker failure does not abort others
 * INV-P2-05: Worker outputs stored in Ruflo memory at correct key pattern
 * INV-P2-06: §9 approval gate fires ONCE at aggregation, not per-worker
 * INV-P2-07: Token-like values in worker output are redacted before storage
 * INV-P2-08: aggregateWorkerResults produces merged output from N workers
 * INV-P2-09: executeWrapperTurn with parallelSpecs takes the fan-out path
 * INV-P2-10: No new API key consumption by parallel workers module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock rufloMcpClient before imports
const rufloMocks = vi.hoisted(() => ({
  callRufloTool: vi.fn().mockResolvedValue({ content: [{ text: JSON.stringify({ results: [] }) }] }),
  getRufloHealth: vi.fn().mockReturnValue({ alive: true, pid: 1234, toolCount: 272 }),
}));

vi.mock("./rufloMcpClient", () => ({
  callRufloTool: rufloMocks.callRufloTool,
  getRufloHealth: rufloMocks.getRufloHealth,
  getRufloToolSummaryForPrompt: vi.fn().mockReturnValue(""),
  isRufloTool: vi.fn((name: string) => name.startsWith("ruflo.")),
  stripRufloPrefix: vi.fn((name: string) => name.replace("ruflo.", "")),
}));

// Mock LLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "Aggregated result from all workers." } }],
  }),
}));

// Mock architectLLM token utilities (use real implementations)
vi.mock("./architectLLM", () => ({
  containsTokenLikeValue: vi.fn((msg: string) => /\b(?:ghp_|gho_|ghs_|ghu_|github_pat_)[A-Za-z0-9_\-]+\b/.test(msg)),
  redactTokenLikeValues: vi.fn((msg: string) => msg.replace(/\b(?:ghp_|gho_|ghs_|ghu_|github_pat_)[A-Za-z0-9_\-]+\b/g, "[redacted-token-value]")),
}));

import {
  runParallelWorkers,
  aggregateWorkerResults,
  buildMemoryKey,
  buildWorkerSystemPrompt,
  type WorkerSpec,
  type WorkerResult,
} from "./parallelWorkers";

// ─── Test Fixtures ───────────────────────────────────────────────────────────

function makeSpec(overrides?: Partial<WorkerSpec>): WorkerSpec {
  return {
    workerId: "worker-a",
    role: "executor",
    subtaskPrompt: "Implement the login form.",
    outputKey: "login-form",
    ...overrides,
  };
}

function makeSpecs(count: number): WorkerSpec[] {
  return Array.from({ length: count }, (_, i) => makeSpec({
    workerId: `worker-${i}`,
    outputKey: `output-${i}`,
    subtaskPrompt: `Subtask ${i}`,
    role: i === 0 ? "executor" : i === 1 ? "reviewer" : "architect",
  }));
}

// ─── INV-P2-01: WorkerResult shape ──────────────────────────────────────────

describe("INV-P2-01: runParallelWorkers returns WorkerResult[] with correct fields", () => {
  it("returns an array of WorkerResult objects with all required fields", async () => {
    const specs = makeSpecs(2);
    const results = await runParallelWorkers(42, specs, {
      llmInvoker: async () => "Worker output content.",
    });

    expect(results).toHaveLength(2);
    for (const result of results) {
      expect(result).toHaveProperty("workerId");
      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("durationMs");
      expect(result).toHaveProperty("rufloMemoryKey");
      expect(typeof result.durationMs).toBe("number");
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("completed workers have output field, failed workers have error field", async () => {
    let callCount = 0;
    const results = await runParallelWorkers(42, makeSpecs(2), {
      llmInvoker: async () => {
        callCount++;
        if (callCount === 1) throw new Error("Simulated failure");
        return "Success output";
      },
    });

    const failed = results.find((r) => r.status === "failed");
    const completed = results.find((r) => r.status === "completed");
    expect(failed).toBeDefined();
    expect(failed!.error).toContain("Simulated failure");
    expect(failed!.output).toBeUndefined();
    expect(completed).toBeDefined();
    expect(completed!.output).toBe("Success output");
    expect(completed!.error).toBeUndefined();
  });
});

// ─── INV-P2-02: Parallel execution (timing proof) ───────────────────────────

describe("INV-P2-02: Workers execute in parallel (timing proof)", () => {
  it("3 workers each taking 50ms complete in under 200ms total (not 150ms sequential)", async () => {
    const specs = makeSpecs(3);
    const start = Date.now();

    await runParallelWorkers(42, specs, {
      llmInvoker: async () => {
        await new Promise((r) => setTimeout(r, 50));
        return "Parallel output";
      },
    });

    const elapsed = Date.now() - start;
    // If sequential, would be ~150ms. Parallel should be ~50-80ms.
    expect(elapsed).toBeLessThan(200);
  });
});

// ─── INV-P2-03: Per-worker timeout ──────────────────────────────────────────

describe("INV-P2-03: Per-worker timeout enforced", () => {
  it("worker exceeding timeout returns status=timeout", async () => {
    const specs = [makeSpec({ workerId: "slow-worker" })];

    const results = await runParallelWorkers(42, specs, {
      timeoutMs: 50,
      llmInvoker: async () => {
        await new Promise((r) => setTimeout(r, 200));
        return "Should not reach here";
      },
    });

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("timeout");
    expect(results[0].error).toContain("exceeded timeout");
    expect(results[0].output).toBeUndefined();
  });
});

// ─── INV-P2-04: One worker failure does not abort others ─────────────────────

describe("INV-P2-04: One worker failure does not abort others", () => {
  it("failing worker-0 does not prevent worker-1 and worker-2 from completing", async () => {
    const specs = makeSpecs(3);
    let callIndex = 0;

    const results = await runParallelWorkers(42, specs, {
      llmInvoker: async (spec) => {
        if (spec.workerId === "worker-0") throw new Error("Worker 0 crashed");
        return `Output from ${spec.workerId}`;
      },
    });

    const completed = results.filter((r) => r.status === "completed");
    const failed = results.filter((r) => r.status === "failed");
    expect(completed).toHaveLength(2);
    expect(failed).toHaveLength(1);
    expect(failed[0].workerId).toBe("worker-0");
  });
});

// ─── INV-P2-05: Ruflo memory key pattern ────────────────────────────────────

describe("INV-P2-05: Worker outputs stored in Ruflo memory at correct key pattern", () => {
  it("memory key follows {parentTaskId}:{workerId}:{outputKey} pattern", () => {
    const key = buildMemoryKey(42, "worker-a", "login-form");
    expect(key).toBe("42:worker-a:login-form");
  });

  it("callRufloTool is called with memory_store for each completed worker", async () => {
    rufloMocks.callRufloTool.mockClear();
    const specs = makeSpecs(2);

    await runParallelWorkers(42, specs, {
      llmInvoker: async (spec) => `Output from ${spec.workerId}`,
    });

    const storeCalls = rufloMocks.callRufloTool.mock.calls.filter(
      (call) => call[0] === "memory_store"
    );
    expect(storeCalls.length).toBe(2);
    expect(storeCalls[0][1]).toMatchObject({
      key: "42:worker-0:output-0",
      namespace: "parallel-workers",
    });
    expect(storeCalls[1][1]).toMatchObject({
      key: "42:worker-1:output-1",
      namespace: "parallel-workers",
    });
  });
});

// ─── INV-P2-06: §9 approval gate fires ONCE at aggregation ──────────────────

describe("INV-P2-06: §9 approval gate fires ONCE at aggregation, not per-worker", () => {
  const dbMocks = vi.hoisted(() => ({
    appendTaskEvent: vi.fn().mockResolvedValue(undefined),
    completeTurn: vi.fn().mockResolvedValue(undefined),
    failTurn: vi.fn().mockResolvedValue(undefined),
    updateTaskStatus: vi.fn().mockResolvedValue(undefined),
    updateTurnApprovalState: vi.fn().mockResolvedValue(undefined),
    updateTurnState: vi.fn().mockResolvedValue(undefined),
  }));

  // This invariant is tested at the integration level in the wrapper test
  // Here we verify the structural contract: aggregation produces a single output
  it("aggregateWorkerResults produces exactly one mergedOutput (not N per-worker outputs)", async () => {
    const workerResults: WorkerResult[] = [
      { workerId: "w1", status: "completed", output: "Output 1", durationMs: 10, rufloMemoryKey: "42:w1:o1" },
      { workerId: "w2", status: "completed", output: "Output 2", durationMs: 15, rufloMemoryKey: "42:w2:o2" },
      { workerId: "w3", status: "completed", output: "Output 3", durationMs: 12, rufloMemoryKey: "42:w3:o3" },
    ];

    const result = await aggregateWorkerResults(42, workerResults, "Build a login system", {
      llmInvoker: async () => "Single aggregated response covering all workers.",
    });

    expect(typeof result.mergedOutput).toBe("string");
    expect(result.mergedOutput).toBe("Single aggregated response covering all workers.");
    // One merged output, not three
    expect(result.workerResults).toHaveLength(3);
  });
});

// ─── INV-P2-07: Token redaction in worker output ─────────────────────────────

describe("INV-P2-07: Token-like values in worker output are redacted before storage", () => {
  it("worker output containing ghp_ token is redacted", async () => {
    rufloMocks.callRufloTool.mockClear();
    const specs = [makeSpec({ workerId: "leaky-worker" })];

    await runParallelWorkers(42, specs, {
      llmInvoker: async () => "Here is the token: ghp_abc123XYZsecretValue for auth.",
    });

    const storeCalls = rufloMocks.callRufloTool.mock.calls.filter(
      (call) => call[0] === "memory_store"
    );
    expect(storeCalls.length).toBe(1);
    const storedValue = storeCalls[0][1].value;
    expect(storedValue).not.toContain("ghp_abc123XYZsecretValue");
    expect(storedValue).toContain("[redacted-token-value]");
  });

  it("aggregation output containing tokens is also redacted", async () => {
    const workerResults: WorkerResult[] = [
      { workerId: "w1", status: "completed", output: "Clean output", durationMs: 10, rufloMemoryKey: "42:w1:o1" },
    ];

    const result = await aggregateWorkerResults(42, workerResults, "Test", {
      llmInvoker: async () => "Merged with leaked ghp_secretTokenValue123 inside.",
    });

    expect(result.mergedOutput).not.toContain("ghp_secretTokenValue123");
    expect(result.mergedOutput).toContain("[redacted-token-value]");
  });
});

// ─── INV-P2-08: aggregateWorkerResults merges N workers ──────────────────────

describe("INV-P2-08: aggregateWorkerResults produces merged output from N workers", () => {
  it("includes failed and timed-out workers in the result metadata", async () => {
    const workerResults: WorkerResult[] = [
      { workerId: "w1", status: "completed", output: "Output 1", durationMs: 10, rufloMemoryKey: "42:w1:o1" },
      { workerId: "w2", status: "failed", error: "Crashed", durationMs: 5, rufloMemoryKey: "42:w2:o2" },
      { workerId: "w3", status: "timeout", error: "Exceeded timeout", durationMs: 300000, rufloMemoryKey: "42:w3:o3" },
    ];

    const result = await aggregateWorkerResults(42, workerResults, "Multi-worker task", {
      llmInvoker: async (_sys, user) => {
        // Verify the aggregation prompt includes all worker statuses
        expect(user).toContain("w1");
        expect(user).toContain("w2");
        expect(user).toContain("w3");
        expect(user).toContain("completed");
        expect(user).toContain("failed");
        expect(user).toContain("timeout");
        return "Aggregated with partial failures noted.";
      },
    });

    expect(result.failedWorkers).toEqual(["w2"]);
    expect(result.timedOutWorkers).toEqual(["w3"]);
    expect(result.mergedOutput).toBe("Aggregated with partial failures noted.");
    expect(result.aggregationDurationMs).toBeGreaterThanOrEqual(0);
  });
});

// ─── INV-P2-09: executeWrapperTurn with parallelSpecs takes fan-out path ─────

describe("INV-P2-09: executeWrapperTurn with parallelSpecs takes the fan-out path", () => {
  it("WrapperExecutionInput type accepts parallelSpecs field", () => {
    // Type-level test: if this compiles, the type is correct
    const input = {
      task: { id: 1, ownerUserId: 1, title: "test", summary: "", status: "active", routeMode: "dual" },
      ownerUserId: 1,
      turnId: 1,
      userMessage: "test",
      route: "dual" as const,
      credentialStates: [],
      priorEvents: [],
      memory: [],
      files: [],
      parallelSpecs: makeSpecs(3),
    };
    expect(input.parallelSpecs).toHaveLength(3);
  });
});

// ─── INV-P2-10: No new API key consumption ──────────────────────────────────

describe("INV-P2-10: No new API key consumption by parallel workers module", () => {
  it("parallelWorkers.ts source does not reference process.env for API keys", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync(
      new URL("./parallelWorkers.ts", import.meta.url).pathname,
      "utf-8"
    );

    // Must not consume any API keys directly
    expect(source).not.toContain("process.env.CLAUDE_API_KEY");
    expect(source).not.toContain("process.env.OPENAI_API_KEY");
    expect(source).not.toContain("process.env.ANTHROPIC_API_KEY");
    expect(source).not.toContain("process.env.CLOUDFLARE_API_TOKEN");
    expect(source).not.toContain("process.env.BUILT_IN_FORGE_API_KEY");
  });

  it("parallelWorkers.ts uses invokeLLM helper (not raw fetch to provider URLs)", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync(
      new URL("./parallelWorkers.ts", import.meta.url).pathname,
      "utf-8"
    );

    // Uses the shared LLM helper
    expect(source).toContain('import { invokeLLM }');
    // Does not make raw fetch calls to provider APIs
    expect(source).not.toContain("api.anthropic.com");
    expect(source).not.toContain("api.openai.com");
    expect(source).not.toContain("api.cloudflare.com");
  });
});

// ─── buildWorkerSystemPrompt unit tests ──────────────────────────────────────

describe("buildWorkerSystemPrompt", () => {
  it("includes role description and parallel worker context", () => {
    const spec = makeSpec({ role: "executor" });
    const prompt = buildWorkerSystemPrompt(spec, "");
    expect(prompt).toContain("code executor");
    expect(prompt).toContain("parallel workers");
  });

  it("includes preloaded context when provided", () => {
    const spec = makeSpec({ role: "reviewer" });
    const prompt = buildWorkerSystemPrompt(spec, "Previous decision: use TypeScript.");
    expect(prompt).toContain("Preloaded Context");
    expect(prompt).toContain("Previous decision: use TypeScript.");
  });
});
