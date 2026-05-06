import { describe, expect, it } from "vitest";
import { buildBranches, buildTargets, tasks } from "../drizzle/schema";
import { appRouter } from "./routers";

describe("Section 1 Build Targets contract", () => {
  it("defines additive Build Target and Build Branch schema surfaces", () => {
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
  });

  it("exposes Build Target and Build Branch tRPC procedure groups", () => {
    const procedures = appRouter._def.procedures;
    expect(procedures["buildTargets.list"]).toBeDefined();
    expect(procedures["buildTargets.create"]).toBeDefined();
    expect(procedures["buildTargets.get"]).toBeDefined();
    expect(procedures["buildTargets.testConnection"]).toBeDefined();
    expect(procedures["buildBranches.create"]).toBeDefined();
    expect(procedures["buildBranches.linkTask"]).toBeDefined();
    expect(procedures["buildBranches.status"]).toBeDefined();
    expect(procedures["buildBranches.workspaceTree"]).toBeDefined();
    expect(procedures["buildBranches.cleanup"]).toBeDefined();
  });
});
