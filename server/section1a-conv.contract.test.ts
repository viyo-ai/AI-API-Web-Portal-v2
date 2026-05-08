import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import {
  containsTokenLikeValue,
  detectArchitectIntent,
  loadArchitectIntentPrompt,
  loadArchitectSystemPrompt,
  redactTokenLikeValues,
} from "./architectLLM";
import {
  assertCompleteArchitectSetupFields,
  clearArchitectSetupState,
  extractArchitectSetupFields,
  getArchitectSetupState,
  isArchitectSetupConfirmation,
  missingArchitectSetupFields,
  upsertArchitectSetupState,
  validateArchitectSetupFields,
} from "./architectSetup";
import { projectMemory } from "../drizzle/schema";

type MockIntent = {
  intent: "setup" | "credentials" | "onboarding" | "build" | "ambiguous" | "other";
  shouldRouteToArchitect: boolean;
  confidence?: "high" | "medium" | "low";
  reason?: string;
  tokenRedactionRequired?: boolean;
};

const mockIntentInvoke = (decision: MockIntent) => async () => ({
  id: "mock-architect-intent",
  created: 0,
  model: "mock-classifier",
  choices: [
    {
      index: 0,
      message: {
        role: "assistant" as const,
        content: JSON.stringify({
          confidence: "high",
          reason: "Mocked semantic classifier decision.",
          tokenRedactionRequired: false,
          ...decision,
        }),
      },
      finish_reason: "stop",
    },
  ],
});

describe("§1A-CONV Architect and project-memory contracts", () => {
  it("routes setup and credential intents to Architect while keeping build turns on the existing route", async () => {
    await expect(detectArchitectIntent("Please connect repo https://github.com/acme/app for project setup", { invoke: mockIntentInvoke({ intent: "setup", shouldRouteToArchitect: true }) })).resolves.toMatchObject({
      intent: "setup",
      shouldRouteToArchitect: true,
      confidence: "high",
    });

    await expect(detectArchitectIntent("The GitHub token env var changed; please test connection", { invoke: mockIntentInvoke({ intent: "credentials", shouldRouteToArchitect: true }) })).resolves.toMatchObject({
      intent: "credentials",
      shouldRouteToArchitect: true,
      confidence: "high",
    });

    await expect(detectArchitectIntent("Implement the composer queue acceptance polish", { invoke: mockIntentInvoke({ intent: "build", shouldRouteToArchitect: false }) })).resolves.toMatchObject({
      intent: "build",
      shouldRouteToArchitect: false,
      confidence: "high",
    });
  });

  it("keeps setup metadata on the setup path instead of misclassifying env-var details as credential-only", async () => {
    await expect(
      detectArchitectIntent(
        "Set up project VIYO Portal with repo https://github.com/viyo-ai/VIYO and GitHub token env var BUILD_TARGET_GITHUB_TOKEN on base branch main",
        { invoke: mockIntentInvoke({ intent: "setup", shouldRouteToArchitect: true }) }
      )
    ).resolves.toMatchObject({
      intent: "setup",
      shouldRouteToArchitect: true,
      confidence: "high",
    });

    await expect(detectArchitectIntent("repo url https://github.com/acme/app env var BUILD_TARGET_GITHUB_TOKEN base branch main", { invoke: mockIntentInvoke({ intent: "setup", shouldRouteToArchitect: true }) })).resolves.toMatchObject({
      intent: "setup",
      shouldRouteToArchitect: true,
    });
  });

  it("parses conversational Project setup fields and requires explicit confirmation before save", () => {
    const taskId = 4701;
    const ownerUserId = 7901;
    clearArchitectSetupState(ownerUserId, taskId);

    const fields = extractArchitectSetupFields(
      "Project name: AI API Web Portal; repo url: https://github.com/viyo-ai/AI-API-Web-Portal-v2; token env var: BUILD_TARGET_GITHUB_TOKEN; base branch: main"
    );

    expect(fields).toEqual({
      displayName: "AI API Web Portal",
      repoUrl: "https://github.com/viyo-ai/AI-API-Web-Portal-v2",
      githubTokenEnvVar: "BUILD_TARGET_GITHUB_TOKEN",
      defaultBaseBranch: "main",
    });
    expect(missingArchitectSetupFields(fields)).toEqual([]);
    expect(validateArchitectSetupFields(fields)).toEqual([]);

    const state = upsertArchitectSetupState({
      ownerUserId,
      taskId,
      fields,
      connectionStatus: "ok",
      awaitingConfirmation: true,
    });
    expect(state.awaitingConfirmation).toBe(true);
    expect(getArchitectSetupState(ownerUserId, taskId)?.fields).toEqual(fields);
    expect(assertCompleteArchitectSetupFields(state.fields)).toEqual(fields);
    expect(isArchitectSetupConfirmation("confirm save project")).toBe(true);

    clearArchitectSetupState(ownerUserId, taskId);
    expect(getArchitectSetupState(ownerUserId, taskId)).toBeUndefined();
  });

  it("rejects invalid token-value-shaped setup input and accepts env-var names only", () => {
    const tokenValue = `${"github"}_pat_11AAABBBBBCCCCCDDDDDEEEEEFFFFF`;
    const parsed = extractArchitectSetupFields(
      `project name: Unsafe; repo url: https://github.com/acme/app; token env var: ${tokenValue}; base branch: main`
    );

    expect(containsTokenLikeValue(tokenValue)).toBe(true);
    expect(validateArchitectSetupFields(parsed).join("\n")).toContain("environment variable name only");
    expect(validateArchitectSetupFields({ ...parsed, githubTokenEnvVar: "BUILD_TARGET_GITHUB_TOKEN" })).toEqual([]);
  });

  it("redacts GitHub token prefixes before any Architect prompt or validation path can use them", () => {
    const tokenValue = `${"github"}_pat_11AAABBBBBCCCCCDDDDDEEEEEFFFFF`;

    expect(containsTokenLikeValue(`Use ${tokenValue} for GitHub`)).toBe(true);
    expect(redactTokenLikeValues(`Use ${tokenValue} for GitHub`)).toBe("Use [redacted-token-value] for GitHub");

  });

  it("ships prompt artifacts that define role boundaries, intent routing, and approval safety", () => {
    const systemPrompt = loadArchitectSystemPrompt();
    const intentPrompt = loadArchitectIntentPrompt();

    expect(systemPrompt).toContain("Architect-in-Portal");
    expect(systemPrompt).toContain("Token values stay in Manus environment variables");
    expect(systemPrompt).toContain("§9 approval gate");
    expect(systemPrompt).toContain("Advanced Setup");

    expect(intentPrompt).toContain("setup");
    expect(intentPrompt).toContain("credentials");
    expect(intentPrompt).toContain("build");
    expect(intentPrompt).toContain("shouldRouteToArchitect");
  });

  it("adds only the project_memory table surface and exposes scoped router procedures", () => {
    expect(projectMemory).toBeDefined();
    expect(projectMemory.ownerUserId).toBeDefined();
    expect(projectMemory.buildTargetId).toBeDefined();
    expect(projectMemory.key).toBeDefined();
    expect(projectMemory.value).toBeDefined();

    const procedures = appRouter._def.procedures as Record<string, unknown>;
    expect(procedures["architect.detectIntent"]).toBeDefined();
    expect(procedures["architect.prompts"]).toBeDefined();
    expect(procedures["projectMemory.list"]).toBeDefined();
  });

  it("keeps project-memory helper queries scoped by ownerUserId and buildTargetId", () => {
    const dbSource = readFileSync(join(process.cwd(), "server/db.ts"), "utf8");
    const helperStart = dbSource.indexOf("export async function listProjectMemoryForTarget");
    const helperEnd = dbSource.indexOf("export async function upsertProjectMemoryForTarget");
    const helperBlock = dbSource.slice(helperStart, helperEnd);

    expect(helperStart).toBeGreaterThanOrEqual(0);
    expect(helperEnd).toBeGreaterThan(helperStart);

    expect(helperBlock).toContain("ownerUserId");
    expect(helperBlock).toContain("buildTargetId");
    expect(helperBlock).toContain("eq(projectMemory.ownerUserId, ownerUserId)");
    expect(helperBlock).toContain("eq(projectMemory.buildTargetId, buildTargetId)");
  });

  it("includes the exact additive 0013 project-memory migration without modifying existing tables", () => {
    const migration = readFileSync(join(process.cwd(), "drizzle/0013_project_memory.sql"), "utf8");

    expect(migration).toContain("CREATE TABLE `project_memory`");
    expect(migration).toContain("`ownerUserId`");
    expect(migration).toContain("`buildTargetId`");
    expect(migration).toContain("CREATE INDEX `project_memory_owner_build_target_idx`");
    expect(migration).not.toMatch(/ALTER TABLE/i);
    expect(migration).not.toMatch(/DROP TABLE/i);
  });
});
