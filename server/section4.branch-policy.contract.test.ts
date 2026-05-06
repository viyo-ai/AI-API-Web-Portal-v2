import { describe, expect, it } from "vitest";
import { buildBranches, buildTargets } from "../drizzle/schema";
import { appRouter } from "./routers";
import { assertBranchIsNotProtected, assertConventionalCommitMessage, normalizeAgentEnvVarMap } from "./buildRunner";

describe("Section 4 branch isolation, push policy, and env injection contracts", () => {
  it("adds the required schema columns without removing Section 1 surfaces", () => {
    expect(buildTargets.agentEnvVarMapJson).toBeDefined();
    expect(buildBranches.pushState).toBeDefined();
    expect(buildBranches.lastPushedCommit).toBeDefined();
    expect(buildBranches.lastPushError).toBeDefined();
    expect(buildTargets.repoUrl).toBeDefined();
    expect(buildBranches.workspacePath).toBeDefined();
  });

  it("exports Section 4 tRPC procedures in both legacy and plural namespaces", () => {
    const procedures = appRouter._def.procedures;
    expect(procedures["buildTarget.updateSettings"]).toBeDefined();
    expect(procedures["buildTargets.updateSettings"]).toBeDefined();
    expect(procedures["buildBranch.push"]).toBeDefined();
    expect(procedures["buildBranches.push"]).toBeDefined();
  });

  it("blocks protected branches and validates conventional commit subjects", () => {
    expect(() => assertBranchIsNotProtected("main", ["main", "staging"])).toThrow(/protected/);
    expect(assertBranchIsNotProtected("feature/section-4", ["main", "staging"])).toBeUndefined();
    expect(assertConventionalCommitMessage("feat(portal-section-4): branch isolation")).toBe("feat(portal-section-4): branch isolation");
    expect(() => assertConventionalCommitMessage("section 4 update")).toThrow(/commit message/);
  });

  it("normalizes agent env-var maps to uppercase env names only", () => {
    expect(normalizeAgentEnvVarMap({ WORKSHOP_GITHUB_TOKEN: "BUILD_TARGET_GITHUB_TOKEN" })).toEqual({ WORKSHOP_GITHUB_TOKEN: "BUILD_TARGET_GITHUB_TOKEN" });
    expect(() => normalizeAgentEnvVarMap({ "bad-name": "BUILD_TARGET_GITHUB_TOKEN" })).toThrow(/Invalid environment variable/);
  });
});
