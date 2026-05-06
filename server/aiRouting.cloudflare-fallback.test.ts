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

import { executeWrapperTurn, getWrapperRuntimeCredentialStates, KIMI_K26_CLOUDFLARE_MODEL } from "./wrapperLLM";

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

  it("uses the exact Cloudflare Workers AI Kimi K2.6 model identifier", () => {
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
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(executeWrapperTurn(sampleExecutionInput("kimi"))).rejects.toThrow("Kimi credential is missing");

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(dbMocks.failTurn).toHaveBeenCalledWith(99, 7, "MODEL_EXECUTION_FAILED", expect.stringContaining("Kimi credential is missing"), "failed");
    expect(dbMocks.updateTaskStatus).toHaveBeenCalledWith(10, 7, "error");
  });
});
