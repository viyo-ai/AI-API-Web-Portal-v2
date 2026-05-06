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

import { CLAUDE_DEFAULT_MODEL, executeWrapperTurn, KIMI_K26_CLOUDFLARE_MODEL } from "./wrapperLLM";

type Route = "claude" | "kimi" | "dual";

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

function configureProviderEnv() {
  process.env.CLAUDE_API_KEY = "test-claude-key";
  process.env.CLOUDFLARE_ACCOUNT_ID = "test-cloudflare-account";
  process.env.CLOUDFLARE_API_TOKEN = "test-cloudflare-token";
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
    if (requestUrl.includes("api.anthropic.com")) {
      const isReviewer = typeof body.system === "string" && body.system.includes("Claude Reviewer");
      return new Response(
        JSON.stringify({
          content: [{ type: "text", text: isReviewer ? "Claude reviewed final answer." : "Claude produced a plan." }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (requestUrl.includes("api.cloudflare.com")) {
      return new Response(JSON.stringify({ success: true, result: { response: "Kimi produced execution output." } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Unexpected provider URL" }), { status: 500 });
  });
}

describe("Wrapper LLM v2 provider execution routes", () => {
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
    expect(dbMocks.completeTurn).toHaveBeenCalledWith(106, 9);
  });

  it("routes Kimi-only turns to the exact Cloudflare Workers AI Kimi K2.6 endpoint and no Claude call", async () => {
    const fetchSpy = mockSuccessfulFetch();

    const result = await executeWrapperTurn(executionInput("kimi"));

    expect(result).toMatchObject({ route: "kimi", finalAnswer: "Kimi produced execution output." });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
      `https://api.cloudflare.com/client/v4/accounts/test-cloudflare-account/ai/run/${KIMI_K26_CLOUDFLARE_MODEL}`,
    );
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
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain("api.anthropic.com/v1/messages");
    expect(String(fetchSpy.mock.calls[1]?.[0])).toContain(`/ai/run/${KIMI_K26_CLOUDFLARE_MODEL}`);
    expect(String(fetchSpy.mock.calls[2]?.[0])).toContain("api.anthropic.com/v1/messages");
    expect(dbMocks.failTurn).not.toHaveBeenCalled();
  });
});
