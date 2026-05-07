import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import {
  buildArchitectReply,
  containsTokenLikeValue,
  detectArchitectIntent,
  loadArchitectIntentPrompt,
  loadArchitectSystemPrompt,
  redactTokenLikeValues,
} from "./architectLLM";
import { projectMemory } from "../drizzle/schema";

describe("§1A-CONV Architect and project-memory contracts", () => {
  it("routes setup and credential intents to Architect while keeping build turns on the existing route", () => {
    expect(detectArchitectIntent("Please connect repo https://github.com/acme/app for project setup")).toMatchObject({
      intent: "setup",
      shouldRouteToArchitect: true,
      confidence: "high",
    });

    expect(detectArchitectIntent("The GitHub token env var changed; please test connection")).toMatchObject({
      intent: "credentials",
      shouldRouteToArchitect: true,
      confidence: "high",
    });

    expect(detectArchitectIntent("Implement the composer queue acceptance polish")).toMatchObject({
      intent: "build",
      shouldRouteToArchitect: false,
      confidence: "high",
    });
  });

  it("keeps token values out of Architect replies and redacts GitHub token prefixes", () => {
    const tokenValue = "github_pat_11AAABBBBBCCCCCDDDDDEEEEEFFFFF";

    expect(containsTokenLikeValue(`Use ${tokenValue} for GitHub`)).toBe(true);
    expect(redactTokenLikeValues(`Use ${tokenValue} for GitHub`)).toBe("Use [redacted-token-value] for GitHub");

    const reply = buildArchitectReply({
      message: `My token is ${tokenValue}`,
      intent: detectArchitectIntent("token changed"),
      hasBuildTarget: true,
    });

    expect(reply).toContain("Manus environment variable");
    expect(reply).toContain("env var name");
    expect(reply).not.toContain(tokenValue);
    expect(reply).not.toMatch(/github_pat_[A-Za-z0-9_\-]+/);
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
