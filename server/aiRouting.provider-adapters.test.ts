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

import { CLAUDE_ADAPTIVE_THINKING_CONFIG, CLAUDE_DEFAULT_MODEL, STUDIO_CODE_REVIEW_PROTOCOL_SKILL_SLUG, buildClaudeMessagesRequestBody, executeWrapperTurn, KIMI_K26_CLOUDFLARE_MODEL, orchestrateWithOpenAI } from "./wrapperLLM";

type Route = "claude" | "kimi" | "dual";

type EnvSnapshot = Pick<NodeJS.ProcessEnv, "CLAUDE_API_KEY" | "CLOUDFLARE_ACCOUNT_ID" | "CLOUDFLARE_API_TOKEN" | "BUILT_IN_FORGE_API_URL" | "BUILT_IN_FORGE_API_KEY" | "OPENAI_API_KEY">;

const originalEnv: EnvSnapshot = {
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY,
  CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
  CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
  BUILT_IN_FORGE_API_URL: process.env.BUILT_IN_FORGE_API_URL,
  BUILT_IN_FORGE_API_KEY: process.env.BUILT_IN_FORGE_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
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
  process.env.OPENAI_API_KEY = "test-openai-key";
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

  it("routes Studio directives through OpenAI classification, owner approval, Kimi execution, and Claude §9 verifier review", async () => {
    const studioMessage = "Portal Studio: edit the image and replace the headline text before shipping.";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      const requestUrl = String(url);
      const body = JSON.parse(String(init?.body ?? "{}"));

      if (requestUrl.includes("api.openai.com/v1/chat/completions")) {
        return new Response(
          JSON.stringify({ choices: [{ message: { content: JSON.stringify({ route: "kimi", reasoning: "Studio image editing is execution work." }) } }] }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (requestUrl.includes("api.anthropic.com/v1/messages")) {
        const isReviewer = typeof body.system === "string" && body.system.includes("Reviewer");
        return new Response(
          JSON.stringify({ content: [{ type: "text", text: isReviewer ? "Claude Studio verifier approved after §9 review." : "Claude Studio plan requires owner approval." }] }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (requestUrl.includes("api.cloudflare.com/client/v4/accounts") && requestUrl.includes(`/ai/run/${KIMI_K26_CLOUDFLARE_MODEL}`)) {
        return new Response(
          JSON.stringify({ success: true, result: { response: "Kimi executed the Studio image-edit directive." } }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      return new Response(JSON.stringify({ error: "Unexpected provider URL" }), { status: 500 });
    });

    const openAiDecision = await orchestrateWithOpenAI(studioMessage);
    expect(openAiDecision).toMatchObject({ route: "kimi", reasoning: "Studio image editing is execution work." });

    const studioInput = {
      ...executionInput("dual"),
      userMessage: studioMessage,
      isStudioDirective: true,
      studioDirectiveReason: "Requests Studio-class image or visual asset editing.",
      requireApprovalBeforeKimi: true,
      skills: [{
        slug: STUDIO_CODE_REVIEW_PROTOCOL_SKILL_SLUG,
        name: "Code Review Protocol",
        version: "1.0.0",
        scope: "global",
        displayTag: "Studio verifier: §9",
        description: "Mandatory code-review protocol for Studio verifier turns.",
        content: "§9 Code Review Protocol: verify correctness, risks, and owner-approval compliance before final answer.",
      }] as never,
    };

    const approvalResult = await executeWrapperTurn(studioInput);
    expect(approvalResult).toMatchObject({
      route: "dual",
      claudePlan: "Claude Studio plan requires owner approval.",
      awaitingApproval: true,
    });
    expect(fetchSpy.mock.calls.some((call) => String(call[0]).includes("api.cloudflare.com/client/v4/accounts"))).toBe(false);
    expect(dbMocks.updateTurnApprovalState).toHaveBeenCalledWith(expect.objectContaining({
      state: "awaiting_approval",
      approvalStatus: "awaiting_owner",
      approvalPlanContent: "Claude Studio plan requires owner approval.",
    }));

    fetchSpy.mockClear();
    vi.clearAllMocks();

    const approvedResult = await executeWrapperTurn({
      ...studioInput,
      requireApprovalBeforeKimi: false,
      approvedClaudePlan: "Owner approved the Studio plan.",
    });

    expect(approvedResult).toMatchObject({
      route: "dual",
      claudePlan: "Owner approved the Studio plan.",
      kimiResult: "Kimi executed the Studio image-edit directive.",
      claudeReview: "Claude Studio verifier approved after §9 review.",
      finalAnswer: "Claude Studio verifier approved after §9 review.",
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain("api.cloudflare.com/client/v4/accounts");
    expect(String(fetchSpy.mock.calls[1]?.[0])).toContain("api.anthropic.com/v1/messages");
    const kimiBody = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body ?? "{}"));
    expect(JSON.stringify(kimiBody)).toContain("Owner approved the Studio plan.");
    expect(JSON.stringify(kimiBody)).toContain("studioDirective");
    expect(JSON.stringify(kimiBody)).toContain("OpenAI router classification, Kimi K2.6 execution, Claude Opus 4.7 §9 verifier review.");
    const reviewerBody = JSON.parse(String(fetchSpy.mock.calls[1]?.[1]?.body ?? "{}"));
    expect(reviewerBody.system).toContain("Studio-class verifier requirement");
    expect(reviewerBody.system).toContain(STUDIO_CODE_REVIEW_PROTOCOL_SKILL_SLUG);
    expect(reviewerBody.system).toContain("skill library load status: loaded");
    expect(dbMocks.updateTurnApprovalState).toHaveBeenCalledWith(expect.objectContaining({
      state: "model_calling",
      approvalStatus: "approved",
      approvalPlanContent: "Owner approved the Studio plan.",
    }));
  });
});
