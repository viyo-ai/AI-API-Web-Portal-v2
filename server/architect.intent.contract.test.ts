import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { InvokeParams, InvokeResult } from "./_core/llm";
import {
  containsTokenLikeValue,
  detectArchitectIntent,
  redactTokenLikeValues,
  resetArchitectIntentCacheForTests,
} from "./architectLLM";

type Decision = {
  intent: "setup" | "credentials" | "onboarding" | "build" | "ambiguous" | "other";
  shouldRouteToArchitect: boolean;
  confidence?: "high" | "medium" | "low";
  reason?: string;
  tokenRedactionRequired?: boolean;
};

function classifierResponse(decision: Decision): InvokeResult {
  return {
    id: "mock-fu02-classifier",
    created: 0,
    model: "mock-llm-router",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: JSON.stringify({
            confidence: "high",
            reason: "Semantic LLM classification from the mocked router.",
            tokenRedactionRequired: false,
            ...decision,
          }),
        },
        finish_reason: "stop",
      },
    ],
  };
}

describe("§1A-CONV-FU-02 Architect intent classifier", () => {
  it("uses LLM-returned semantic categories instead of local keyword routing", async () => {
    resetArchitectIntentCacheForTests();
    const observedMessages: InvokeParams[] = [];
    const invoke = async (params: InvokeParams) => {
      observedMessages.push(params);
      return classifierResponse({ intent: "setup", shouldRouteToArchitect: true });
    };

    const decision = await detectArchitectIntent("help me set up my repo", {
      taskThreadId: "fu02-semantic-setup",
      invoke,
    });

    expect(decision).toMatchObject({
      intent: "setup",
      shouldRouteToArchitect: true,
      classifierSource: "llm",
      classifierModel: "mock-llm-router",
    });
    expect(observedMessages).toHaveLength(1);
    expect(observedMessages[0]?.response_format).toMatchObject({
      type: "json_schema",
    });
    expect(JSON.stringify(observedMessages[0]?.messages)).toContain("help me set up my repo");
  });

  it("keeps build requests off the Architect route when the LLM classifier returns build", async () => {
    resetArchitectIntentCacheForTests();
    const decision = await detectArchitectIntent("implement the new project sidebar refresh", {
      taskThreadId: "fu02-build-route",
      invoke: async () => classifierResponse({ intent: "build", shouldRouteToArchitect: false }),
    });

    expect(decision).toMatchObject({
      intent: "build",
      shouldRouteToArchitect: false,
      classifierSource: "llm",
    });
  });

  it("redacts token-like values before classification and returns token guard without invoking the LLM", async () => {
    resetArchitectIntentCacheForTests();
    let calls = 0;
    const tokenValue = `${"g"}${"hp_"}1234567890abcdefghijklmnopqrstuv`;

    const decision = await detectArchitectIntent(`please use ${tokenValue} for GitHub`, {
      taskThreadId: "fu02-token-guard",
      invoke: async () => {
        calls += 1;
        return classifierResponse({ intent: "credentials", shouldRouteToArchitect: true });
      },
    });

    expect(containsTokenLikeValue(tokenValue)).toBe(true);
    expect(redactTokenLikeValues(`please use ${tokenValue} for GitHub`)).toBe("please use [redacted-token-value] for GitHub");
    expect(decision).toMatchObject({
      intent: "credentials",
      shouldRouteToArchitect: true,
      tokenRedactionRequired: true,
      classifierSource: "token_guard",
    });
    expect(decision.reason).not.toContain(tokenValue);
    expect(calls).toBe(0);
  });

  it("falls back to ambiguous when the classifier times out", async () => {
    resetArchitectIntentCacheForTests();
    const decision = await detectArchitectIntent("connect this and maybe fix it too", {
      taskThreadId: "fu02-timeout",
      timeoutMs: 5,
      invoke: () => new Promise<InvokeResult>(() => undefined),
    });

    expect(decision).toMatchObject({
      intent: "ambiguous",
      shouldRouteToArchitect: true,
      confidence: "low",
      classifierSource: "fallback",
    });
  });

  it("caches per-thread retries for the same sanitized composer message", async () => {
    resetArchitectIntentCacheForTests();
    let calls = 0;
    const invoke = async () => {
      calls += 1;
      return classifierResponse({ intent: "onboarding", shouldRouteToArchitect: true });
    };

    const first = await detectArchitectIntent("walk me through connecting a repo", {
      taskThreadId: "fu02-cache-thread",
      invoke,
    });
    const second = await detectArchitectIntent("walk me through connecting a repo", {
      taskThreadId: "fu02-cache-thread",
      invoke,
    });

    expect(first).toEqual(second);
    expect(calls).toBe(1);
  });

  it("removes the old local keyword classifier surface from production code", () => {
    const source = readFileSync(join(process.cwd(), "server/architectLLM.ts"), "utf8");
    expect(source).not.toContain("setupKeywords");
    expect(source).not.toContain("credentialKeywords");
    expect(source).not.toContain("buildKeywords");
  });
});
