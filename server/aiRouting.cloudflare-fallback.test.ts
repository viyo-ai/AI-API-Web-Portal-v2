import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  appendTaskEvent: vi.fn().mockResolvedValue(undefined),
  completeTurn: vi.fn().mockResolvedValue(undefined),
  failTurn: vi.fn().mockResolvedValue(undefined),
  updateTaskStatus: vi.fn().mockResolvedValue(undefined),
  updateTurnState: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./db", () => ({
  ...dbMocks,
}));

import { CLAUDE_DEFAULT_MODEL, executeWrapperTurn, getWrapperRuntimeCredentialStates, KIMI_K26_CLOUDFLARE_MODEL } from "./wrapperLLM";

type EnvSnapshot = Pick<NodeJS.ProcessEnv, "CLAUDE_API_KEY" | "CLOUDFLARE_ACCOUNT_ID" | "CLOUDFLARE_API_TOKEN">;

const originalEnv: EnvSnapshot = {
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY,
  CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
  CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
};

function restoreProviderEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function clearProviderEnv() {
  delete process.env.CLAUDE_API_KEY;
  delete process.env.CLOUDFLARE_ACCOUNT_ID;
  delete process.env.CLOUDFLARE_API_TOKEN;
}

function sampleExecutionInput(route: "claude" | "kimi" | "dual") {
  return {
    task: {
      id: 10,
      ownerUserId: 7,
      title: "Route test task",
      summary: "Validate explicit provider routing.",
      status: "active",
      routeMode: route,
    } as never,
    ownerUserId: 7,
    turnId: 99,
    userMessage: "Run the provider route.",
    route,
    credentialStates: getWrapperRuntimeCredentialStates(),
    priorEvents: [],
    memory: [],
    files: [],
  };
}

describe("Wrapper LLM v2 credential gates and fallback policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearProviderEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreProviderEnv();
  });

  it("uses the exact approved model identifiers for Claude Opus and Cloudflare Workers AI Kimi", () => {
    expect(CLAUDE_DEFAULT_MODEL).toContain("opus");
    expect(KIMI_K26_CLOUDFLARE_MODEL).toBe("@cf/moonshotai/kimi-k2.6");
  });

  it("reports provider credentials explicitly instead of implying fallback availability", () => {
    process.env.ANTHROPIC_API_KEY = "ignored-anthropic-key";
    delete process.env.CLAUDE_API_KEY;
    process.env.CLOUDFLARE_ACCOUNT_ID = "test-account";
    delete process.env.CLOUDFLARE_API_TOKEN;

    const states = getWrapperRuntimeCredentialStates();

    expect(states).toEqual([
      expect.objectContaining({
        provider: "claude",
        configured: false,
        status: "missing",
        reason: expect.stringContaining("CLAUDE_API_KEY"),
      }),
      expect.objectContaining({
        provider: "kimi",
        configured: false,
        status: "missing",
        reason: expect.stringContaining("CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN"),
      }),
    ]);
  });

  it("does not fall back to Claude when a Kimi-routed turn is missing Cloudflare credentials", async () => {
    process.env.CLAUDE_API_KEY = "test-claude-key";
    // Don't set Cloudflare credentials to simulate missing Kimi provider
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_API_TOKEN;
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(executeWrapperTurn(sampleExecutionInput("kimi"))).rejects.toThrow("Kimi credential is missing");

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(dbMocks.failTurn).toHaveBeenCalledWith(99, 7, "MODEL_EXECUTION_FAILED", expect.stringContaining("CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN"), "failed");
    expect(dbMocks.updateTaskStatus).toHaveBeenCalledWith(10, 7, "error");
  });

  it("handles empty Kimi responses as provider failures with owner-friendly recovery guidance and raw diagnostics", async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "test-account";
    process.env.CLOUDFLARE_API_TOKEN = "test-token";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true, result: { response: "   " } }), { status: 200, headers: { "content-type": "application/json" } }),
    );

    await expect(executeWrapperTurn(sampleExecutionInput("kimi"))).rejects.toThrow("Kimi returned an empty response");

    expect(dbMocks.failTurn).toHaveBeenCalledWith(
      99,
      7,
      "MODEL_EXECUTION_FAILED",
      expect.stringContaining("Kimi call failed"),
      "failed",
    );
    expect(dbMocks.appendTaskEvent).toHaveBeenCalledWith(expect.objectContaining({
      actor: "wrapper",
      eventType: "error",
      status: "failed",
      content: expect.stringContaining("Kimi call failed"),
      metadataJson: expect.stringContaining("providerFailure"),
    }));
    expect(dbMocks.completeTurn).not.toHaveBeenCalled();
  });

  it("maps non-empty Cloudflare provider failures to owner-safe Kimi recovery guidance without silent fallback", async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "test-account";
    process.env.CLOUDFLARE_API_TOKEN = "test-token";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: false, errors: [{ message: "upstream worker unavailable" }] }), { status: 503, headers: { "content-type": "application/json" } }),
    );

    await expect(executeWrapperTurn(sampleExecutionInput("kimi"))).rejects.toThrow("Kimi request failed");

    expect(dbMocks.failTurn).toHaveBeenCalledWith(
      99,
      7,
      "MODEL_EXECUTION_FAILED",
      expect.stringContaining("Kimi call failed"),
      "failed",
    );
    expect(dbMocks.appendTaskEvent).toHaveBeenCalledWith(expect.objectContaining({
      actor: "wrapper",
      eventType: "error",
      status: "failed",
      content: expect.stringContaining("Kimi call failed"),
      metadataJson: expect.stringContaining("providerFailure"),
    }));
    expect(dbMocks.completeTurn).not.toHaveBeenCalled();
  });

  it("auto-retries a Kimi rate-limit failure once and records the scheduled retry event", async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "test-account";
    process.env.CLOUDFLARE_API_TOKEN = "test-token";
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: false, errors: [{ message: "429 rate limit retry-after: 1" }] }), { status: 429, headers: { "content-type": "application/json" } }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, result: { response: "Kimi retry succeeded." } }), { status: 200, headers: { "content-type": "application/json" } }),
      );

    const result = await executeWrapperTurn(sampleExecutionInput("kimi"));

    expect(result.finalAnswer).toBe("Kimi retry succeeded.");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(dbMocks.appendTaskEvent).toHaveBeenCalledWith(expect.objectContaining({
      actor: "wrapper",
      eventType: "status",
      status: "blocked",
      content: "Kimi is rate-limited. Retrying in 1 seconds.",
      metadataJson: expect.stringContaining("retryScheduled"),
    }));
    expect(dbMocks.failTurn).not.toHaveBeenCalled();
    expect(dbMocks.completeTurn).toHaveBeenCalledWith(99, 7);
  });
});
