import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  appendTaskEvent: vi.fn().mockResolvedValue(undefined),
  completeTurn: vi.fn().mockResolvedValue(undefined),
  failTurn: vi.fn().mockResolvedValue(undefined),
  updateTaskStatus: vi.fn().mockResolvedValue(undefined),
  updateTurnApprovalState: vi.fn().mockResolvedValue(undefined),
  updateTurnState: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./db", () => ({
  ...dbMocks,
}));

import { CLAUDE_ADAPTIVE_THINKING_CONFIG, CLAUDE_DEFAULT_MODEL, buildClaudeMessagesRequestBody, executeWrapperTurn, KIMI_K26_CLOUDFLARE_MODEL } from "./wrapperLLM";

type Route = "claude" | "kimi" | "dual";

type EnvSnapshot = Pick<NodeJS.ProcessEnv, "CLAUDE_API_KEY" | "CLOUDFLARE_ACCOUNT_ID" | "CLOUDFLARE_API_TOKEN" | "BUILT_IN_FORGE_API_URL" | "BUILT_IN_FORGE_API_KEY">;

const originalEnv: EnvSnapshot = {
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY,
  CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
  CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
  BUILT_IN_FORGE_API_URL: process.env.BUILT_IN_FORGE_API_URL,
  BUILT_IN_FORGE_API_KEY: process.env.BUILT_IN_FORGE_API_KEY,
};

function restoreProviderEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function configureProviderEnv() {
  process.env.CLAUDE_API_KEY = "test-claude-key";
  process.env.CLOUDFLARE_ACCOUNT_ID = "test-cloudflare-account";
  process.env.CLOUDFLARE_API_TOKEN = "test-cloudflare-token";
  process.env.BUILT_IN_FORGE_API_URL = "https://forge.example.com";
  process.env.BUILT_IN_FORGE_API_KEY = "test-forge-key";
}

function executionInput(route: Route) {
  return {
    task: {
      id: 42,
      ownerUserId: 9,
      title: `${route} route task`,
      summary: "Validate provider-specific execution without adapter fallback.",
      status: "active",
      routeMode: route,
    } as never,
    ownerUserId: 9,
    turnId: 100 + route.length,
    userMessage: "Produce a provider-specific response.",
    route,
    credentialStates: [
      { provider: "claude", status: "configured", configured: true, reason: "test" },
      { provider: "kimi", status: "configured", configured: true, reason: "test" },
    ] as never,
    priorEvents: [],
    memory: [],
    files: [],
  };
}

function mockSuccessfulFetch() {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
    const requestUrl = String(url);
    const body = JSON.parse(String(init?.body ?? "{}"));
    // Claude via direct Anthropic API
    if (requestUrl.includes("api.anthropic.com/v1/messages")) {
      const model = body.model;
      const isReviewer = typeof body.system === "string" && body.system.includes("Reviewer");
      if (model === "claude-opus-4-7") {
        return new Response(
          JSON.stringify({
            content: [{ type: "text", text: isReviewer ? "Claude reviewed final answer." : "Claude produced a plan." }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
    }
    // Kimi via Cloudflare Workers AI
    if (requestUrl.includes("api.cloudflare.com/client/v4/accounts") && requestUrl.includes("/ai/run/@cf/moonshotai/kimi-k2.6")) {
      return new Response(
        JSON.stringify({ success: true, result: { response: "Kimi produced execution output." } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ error: "Unexpected provider URL" }), { status: 500 });
  });
}

describe("Wrapper LLM v2 provider execution routes", () => {
  it("builds Claude Opus 4.7 Messages API bodies with adaptive thinking and no fixed budget", () => {
    const body = buildClaudeMessagesRequestBody({
      system: "Planner system prompt",
      messages: [{ role: "user", content: "Plan a feature." }],
      maxTokens: 4096,
      model: "claude-opus-4-7",
    });

    expect(body.model).toBe("claude-opus-4-7");
    expect(body.thinking).toEqual(CLAUDE_ADAPTIVE_THINKING_CONFIG);
    expect(body.thinking).not.toHaveProperty("budget_tokens");

    const nonOpusBody = buildClaudeMessagesRequestBody({
      system: "Planner system prompt",
      messages: [{ role: "user", content: "Plan a feature." }],
      model: "claude-sonnet-4-5",
    });
    expect(nonOpusBody.thinking).toBeUndefined();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    configureProviderEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreProviderEnv();
  });

  it("routes Claude-only turns to Anthropic with the configured Claude model and no Kimi call", async () => {
    const fetchSpy = mockSuccessfulFetch();

    const result = await executeWrapperTurn(executionInput("claude"));

    expect(result).toMatchObject({ route: "claude", finalAnswer: "Claude produced a plan." });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain("api.anthropic.com/v1/messages");
    const requestBody = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
    expect(requestBody.model).toBe(CLAUDE_DEFAULT_MODEL);
    expect(requestBody.thinking).toEqual(CLAUDE_ADAPTIVE_THINKING_CONFIG);
    expect(requestBody.thinking).not.toHaveProperty("budget_tokens");
    expect(dbMocks.completeTurn).toHaveBeenCalledWith(106, 9);
  });

  it("routes Kimi-only turns to the exact Cloudflare Workers AI Kimi K2.6 endpoint and no Claude call", async () => {
    const fetchSpy = mockSuccessfulFetch();

    const result = await executeWrapperTurn(executionInput("kimi"));

    expect(result).toMatchObject({ route: "kimi", finalAnswer: "Kimi produced execution output." });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain("api.cloudflare.com/client/v4/accounts");
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain("/ai/run/@cf/moonshotai/kimi-k2.6");
    expect(dbMocks.completeTurn).toHaveBeenCalledWith(104, 9);
  });

  it("routes dual turns as Claude plan, Kimi execution, then Claude review without silent provider fallback", async () => {
    const fetchSpy = mockSuccessfulFetch();

    const result = await executeWrapperTurn(executionInput("dual"));

    expect(result).toMatchObject({
      route: "dual",
      claudePlan: "Claude produced a plan.",
      kimiResult: "Kimi produced execution output.",
      claudeReview: "Claude reviewed final answer.",
      finalAnswer: "Claude reviewed final answer.",
    });
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    // Claude plan/review should use Anthropic, while Kimi execution should use Cloudflare Workers AI.
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain("api.anthropic.com/v1/messages");
    expect(String(fetchSpy.mock.calls[1]?.[0])).toContain("api.cloudflare.com/client/v4/accounts");
    expect(String(fetchSpy.mock.calls[1]?.[0])).toContain("/ai/run/@cf/moonshotai/kimi-k2.6");
    expect(String(fetchSpy.mock.calls[2]?.[0])).toContain("api.anthropic.com/v1/messages");
    // Verify the models used in each Claude call.
    const call0Body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body ?? "{}"));
    const call2Body = JSON.parse(String(fetchSpy.mock.calls[2]?.[1]?.body ?? "{}"));
    expect(call0Body.model).toBe("claude-opus-4-7"); // Claude plan
    expect(call2Body.model).toBe("claude-opus-4-7"); // Claude review
    expect(call0Body.thinking).toEqual(CLAUDE_ADAPTIVE_THINKING_CONFIG);
    expect(call2Body.thinking).toEqual(CLAUDE_ADAPTIVE_THINKING_CONFIG);
    expect(call0Body.thinking).not.toHaveProperty("budget_tokens");
    expect(call2Body.thinking).not.toHaveProperty("budget_tokens");
    expect(dbMocks.failTurn).not.toHaveBeenCalled();
  });

  it("pauses dual Claude-to-Kimi turns after Claude planning when owner approval is required", async () => {
    const fetchSpy = mockSuccessfulFetch();

    const result = await executeWrapperTurn({
      ...executionInput("dual"),
      requireApprovalBeforeKimi: true,
    });

    expect(result).toMatchObject({
      route: "dual",
      claudePlan: "Claude produced a plan.",
      finalAnswer: "Claude planning is ready for owner approval before Kimi runs.",
      awaitingApproval: true,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain("api.anthropic.com/v1/messages");
    expect(fetchSpy.mock.calls.some((call) => String(call[0]).includes("api.cloudflare.com/client/v4/accounts"))).toBe(false);
    expect(dbMocks.updateTurnApprovalState).toHaveBeenCalledWith(expect.objectContaining({
      turnId: 104,
      ownerUserId: 9,
      state: "awaiting_approval",
      approvalStatus: "awaiting_owner",
      approvalPlanContent: "Claude produced a plan.",
      approvalResolvedAt: null,
    }));
    expect(dbMocks.completeTurn).not.toHaveBeenCalledWith(104, 9);
  });

  it("resumes approved dual handoffs by sending the stored Claude plan to Kimi without invoking Claude planning again", async () => {
    const fetchSpy = mockSuccessfulFetch();

    const result = await executeWrapperTurn({
      ...executionInput("dual"),
      approvedClaudePlan: "Stored approved Claude plan.",
      requireApprovalBeforeKimi: false,
    });

    expect(result).toMatchObject({
      route: "dual",
      claudePlan: "Stored approved Claude plan.",
      kimiResult: "Kimi produced execution output.",
      claudeReview: "Claude reviewed final answer.",
      finalAnswer: "Claude reviewed final answer.",
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain("api.cloudflare.com/client/v4/accounts");
    expect(String(fetchSpy.mock.calls[1]?.[0])).toContain("api.anthropic.com/v1/messages");
    const kimiBody = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body ?? "{}"));
    expect(JSON.stringify(kimiBody)).toContain("Stored approved Claude plan.");
    expect(dbMocks.updateTurnApprovalState).toHaveBeenCalledWith(expect.objectContaining({
      turnId: 104,
      ownerUserId: 9,
      state: "model_calling",
      approvalStatus: "approved",
      approvalPlanContent: "Stored approved Claude plan.",
    }));
  });
});
