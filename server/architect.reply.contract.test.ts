import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { InvokeParams, InvokeResult } from "./_core/llm";
import {
  ARCHITECT_REPLY_FALLBACK,
  generateArchitectReply,
  loadArchitectContextPrompt,
  loadArchitectSystemPrompt,
} from "./architectLLM";
import type { ArchitectIntentDecision } from "./architectLLM";
import type { ArchitectSetupState } from "./architectSetup";

const setupIntent: ArchitectIntentDecision = {
  intent: "setup",
  shouldRouteToArchitect: true,
  confidence: "high",
  reason: "Mocked FU-04 setup intent.",
  tokenRedactionRequired: false,
  classifierSource: "llm",
  classifierModel: "mock-router",
};

function replyResponse(reply: string, extra: Record<string, unknown> = {}): InvokeResult {
  return {
    id: "mock-fu04-reply",
    created: 0,
    model: "mock-gemini-flash-router",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: JSON.stringify({
            reply,
            requiresConfirmation: false,
            ...extra,
          }),
        },
        finish_reason: "stop",
      },
    ],
  };
}

function promptPayload(params: InvokeParams) {
  const userMessage = params.messages.find(message => message.role === "user");
  expect(typeof userMessage?.content).toBe("string");
  return JSON.parse(userMessage?.content as string);
}

function baseSetupState(fields: ArchitectSetupState["fields"]): ArchitectSetupState {
  return {
    taskId: 404,
    ownerUserId: 7,
    fields,
    connectionStatus: "untested",
    awaitingConfirmation: false,
    updatedAt: 1710000000000,
  };
}

describe("§1A-CONV-FU-04 Architect reply generation", () => {
  it("INV-FU-04-01 loads architect.system.md and architect.context.md into every reply-generation call", async () => {
    const observed: InvokeParams[] = [];
    await generateArchitectReply({
      lastUserMessage: "help me set up my repo",
      intentDecision: setupIntent,
      invoke: async params => {
        observed.push(params);
        return replyResponse("I can help connect the Project. Please share the project display name, repository URL, token env var name, and default branch.");
      },
    });

    expect(observed).toHaveLength(1);
    const systemContent = observed[0]?.messages.find(message => message.role === "system")?.content;
    expect(systemContent).toContain(loadArchitectSystemPrompt().slice(0, 80));
    expect(systemContent).toContain(loadArchitectContextPrompt().slice(0, 80));
    expect(systemContent).toContain("What the Portal is");
    expect(systemContent).toContain("The save sequence");
  });

  it("INV-FU-04-02 composes a fresh first-turn setup reply without the banned remaining-fields phrase", async () => {
    const decision = await generateArchitectReply({
      lastUserMessage: "help me set up my repo",
      intentDecision: setupIntent,
      setupState: undefined,
      operationalState: { status: "collecting" },
      invoke: async () => replyResponse("I can help connect the Project. Please share the project display name, GitHub repository URL, GitHub token environment variable name, and default base branch."),
    });

    expect(decision.reply).not.toMatch(/remaining setup fields/i);
    expect(decision.reply).toContain("project display name");
  });

  it("INV-FU-04-03 calls invokeLLM with a strict JSON schema and deletes known canned reply templates from production source", async () => {
    const observed: InvokeParams[] = [];
    await generateArchitectReply({
      lastUserMessage: "connect this repository",
      intentDecision: setupIntent,
      invoke: async params => {
        observed.push(params);
        return replyResponse("Please share the Project details and I will test the connection before save.");
      },
    });

    expect(observed[0]?.response_format).toMatchObject({
      type: "json_schema",
      json_schema: {
        name: "architect_reply_generation",
        strict: true,
      },
    });
    const source = [
      readFileSync(join(process.cwd(), "server/architectLLM.ts"), "utf8"),
      readFileSync(join(process.cwd(), "server/architectSetup.ts"), "utf8"),
      readFileSync(join(process.cwd(), "server/routers.ts"), "utf8"),
    ].join("\n");
    expect(source).not.toContain("I can connect this Project through chat, but I still need");
    expect(source).not.toContain("remaining setup fields");
    expect(source).not.toContain("The Project setup draft is ready");
    expect(source).not.toContain("I tested the Project connection successfully. Nothing has been saved yet.");
  });

  it("INV-FU-04-04 redacts token-like values before constructing the reply-generation prompt", async () => {
    const tokenValue = `${"g"}${"hp_"}1234567890abcdefghijklmnopqrstuv`;
    const observed: InvokeParams[] = [];

    const decision = await generateArchitectReply({
      lastUserMessage: `my token is ${tokenValue}, please connect the repo`,
      intentDecision: { ...setupIntent, tokenRedactionRequired: true },
      invoke: async params => {
        observed.push(params);
        return replyResponse("I can work with the environment variable name only; please provide the env var name, not the token value.");
      },
    });

    const serialized = JSON.stringify(observed[0]?.messages);
    expect(serialized).toContain("[redacted-token-value]");
    expect(serialized).not.toContain(tokenValue);
    expect(promptPayload(observed[0]!).tokenRedactionRequired).toBe(true);
    expect(decision.reply).not.toContain(tokenValue);
  });

  it("INV-FU-04-05 returns only the recovery fallback on timeout and leaves setup state unchanged for retry", async () => {
    const setupState = baseSetupState({
      displayName: "AI API Portal",
      repoUrl: "https://github.com/viyo-ai/AI-API-Web-Portal-v2.git",
      githubTokenEnvVar: "BUILD_TARGET_GITHUB_TOKEN",
    });
    const before = JSON.stringify(setupState);

    const decision = await generateArchitectReply({
      lastUserMessage: "continue setup",
      intentDecision: setupIntent,
      setupState,
      timeoutMs: 5,
      invoke: () => new Promise<InvokeResult>(() => undefined),
    });

    expect(decision.reply).toBe(ARCHITECT_REPLY_FALLBACK);
    expect(JSON.stringify(setupState)).toBe(before);
  });

  it("INV-FU-04-06 preserves the existing FU-01 and FU-02 contract suites as separate unmodified-purpose gates", () => {
    const fu01Suite = readFileSync(join(process.cwd(), "server/section1a-conv.contract.test.ts"), "utf8");
    const fu02Suite = readFileSync(join(process.cwd(), "server/architect.intent.contract.test.ts"), "utf8");

    expect(fu01Suite).toContain("§1A-CONV Architect and project-memory contracts");
    expect(fu01Suite).toContain("parses conversational Project setup fields and requires explicit confirmation before save");
    expect(fu02Suite).toContain("§1A-CONV-FU-02 Architect intent classifier");
    expect(fu02Suite).toContain("redacts token-like values before classification and returns token guard without invoking the LLM");
  });

  it("INV-FU-04-07 avoids raw token-prefix fixtures in the new FU-04 contract source outside runtime-safe construction", () => {
    const source = readFileSync(join(process.cwd(), "server/architect.reply.contract.test.ts"), "utf8");

    const rawPrefixes = [
      `${"g"}${"hp_"}1234567890`,
      `${"github"}${"_pat_"}`,
      `${"g"}${"ho_"}`,
      `${"g"}${"hu_"}`,
      `${"g"}${"hs_"}`,
      `${"g"}${"hr_"}`,
    ];
    for (const prefix of rawPrefixes) {
      expect(source).not.toContain(prefix);
    }
  });

  it("INV-FU-04-08 keeps architect.system.md as the frozen rules file while context lives in architect.context.md", () => {
    const systemPrompt = loadArchitectSystemPrompt();
    const contextPrompt = loadArchitectContextPrompt();

    expect(systemPrompt).toContain("Architect-in-Portal System Prompt");
    expect(contextPrompt).toContain("What the Portal is");
    expect(contextPrompt).toContain("Hard rules summary");
    expect(systemPrompt).not.toContain("What the Portal is");
  });

  it("rejects unauthorized LLM tool calls and returns the safe fallback instead of executing invented tools", async () => {
    const decision = await generateArchitectReply({
      lastUserMessage: "connect and deploy this repository",
      intentDecision: setupIntent,
      invoke: async () =>
        replyResponse("I will call an unauthorized tool.", {
          callTool: { name: "deployments.publish", args: {} },
        }),
    });

    expect(decision.reply).toBe(ARCHITECT_REPLY_FALLBACK);
    expect(decision.callTool).toBeUndefined();
  });
});
