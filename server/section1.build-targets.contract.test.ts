import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildBranches, buildTargets, tasks, wizardSessions } from "../drizzle/schema";
import { appRouter } from "./routers";

describe("Section 1 Projects contract", () => {
  it("defines additive Project and Build Branch schema surfaces", () => {
    expect(buildTargets.id).toBeDefined();
    expect(buildTargets.ownerUserId).toBeDefined();
    expect(buildTargets.repoUrl).toBeDefined();
    expect(buildTargets.defaultBaseBranch).toBeDefined();
    expect(buildTargets.protectedBranchesJson).toBeDefined();
    expect(buildTargets.validationCommandsJson).toBeDefined();
    expect(buildBranches.buildTargetId).toBeDefined();
    expect(buildBranches.branchName).toBeDefined();
    expect(buildBranches.workspacePath).toBeDefined();
    expect(tasks.buildBranchId).toBeDefined();
    expect(wizardSessions.repoUrl).toBeDefined();
    expect(wizardSessions.commitSha).toBeDefined();
    expect(wizardSessions.recommendationJson).toBeDefined();
    expect(wizardSessions.expiresAt).toBeDefined();
  });

  it("exposes Project and Build Branch tRPC procedure groups", () => {
    const procedures = appRouter._def.procedures;
    expect(procedures["buildTargets.list"]).toBeDefined();
    expect(procedures["buildTargets.create"]).toBeDefined();
    expect(procedures["buildTargets.get"]).toBeDefined();
    expect(procedures["buildTargets.testConnection"]).toBeDefined();
    expect(procedures["buildTargets.analyzeWizard"]).toBeDefined();
    expect(procedures["buildTargets.completeWizard"]).toBeDefined();
    expect(procedures["buildBranches.create"]).toBeDefined();
    expect(procedures["buildBranches.linkTask"]).toBeDefined();
    expect(procedures["buildBranches.status"]).toBeDefined();
    expect(procedures["buildBranches.workspaceTree"]).toBeDefined();
    expect(procedures["buildBranches.cleanup"]).toBeDefined();
  });

  it("short-circuits analyzeWizard on a valid wizard cache hit before LLM analysis", () => {
    const source = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
    const analyzeStart = source.indexOf("analyzeWizard: protectedProcedure");
    const completeStart = source.indexOf("completeWizard: protectedProcedure", analyzeStart);
    expect(analyzeStart).toBeGreaterThanOrEqual(0);
    expect(completeStart).toBeGreaterThan(analyzeStart);

    const analyzeWizardSource = source.slice(analyzeStart, completeStart);
    const cacheLookupIndex = analyzeWizardSource.indexOf("const cached = await getValidWizardSessionCache");
    const cacheHitStatusIndex = analyzeWizardSource.indexOf('cacheStatus: "hit" as const');
    const cachedRecommendationIndex = analyzeWizardSource.indexOf("JSON.parse(cached.recommendationJson)");
    const llmInvokeIndex = analyzeWizardSource.indexOf("invokeProjectWizardAnalysis(repoContext)");
    const cacheWriteIndex = analyzeWizardSource.indexOf("await upsertWizardSessionCache");

    expect(cacheLookupIndex).toBeGreaterThanOrEqual(0);
    expect(cacheHitStatusIndex).toBeGreaterThan(cacheLookupIndex);
    expect(cachedRecommendationIndex).toBeGreaterThan(cacheHitStatusIndex);
    expect(llmInvokeIndex).toBeGreaterThan(cachedRecommendationIndex);
    expect(cacheWriteIndex).toBeGreaterThan(llmInvokeIndex);
  });
});
