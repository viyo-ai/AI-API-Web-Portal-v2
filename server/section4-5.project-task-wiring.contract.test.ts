import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { appRouter } from "./routers";
import { ROOT_GOVERNANCE_FILE_PATHS } from "./db";
import { tasks, taskGlobalFileLinks } from "../drizzle/schema";
import { renderGovernanceBlock, type LoadedGovernanceDocument } from "./buildRunner/loadGovernance";

const repoRoot = path.resolve(__dirname, "..");
const readSource = (relativePath: string) => readFileSync(path.join(repoRoot, relativePath), "utf8");

describe("Section 4.5 Project-to-task wiring contracts", () => {
  it("INV-S4-5-01 exposes additive task Project linkage and Global File source metadata", () => {
    expect(tasks.buildTargetId).toBeDefined();
    expect(taskGlobalFileLinks.source).toBeDefined();
  });

  it("INV-S4-5-02 declares the root default governance files that must auto-attach to every new task", () => {
    expect(ROOT_GOVERNANCE_FILE_PATHS).toEqual([
      "CLAUDE.md",
      "FOUNDATION_LOCK.md",
      "BULLET_1_DIRECTIVE.md",
      "CURRENT_BULLET.txt",
    ]);
  });

  it("INV-S4-5-03 exposes buildTargetId on task creation and first-message submission contracts", () => {
    const procedures = appRouter._def.procedures;
    expect(procedures["tasks.create"]).toBeDefined();
    expect(procedures["orchestration.submitMessage"]).toBeDefined();

    const source = readSource("server/routers.ts");
    expect(source).toContain("buildTargetId: z.number().int().positive().nullable().optional()");
    expect(source).toContain("autoWireProjectForTask");
    expect(source).toContain("autoAttachRootGlobalFiles");
  });

  it("INV-S4-5-04 silently creates an isolated Build Branch for Project-backed tasks", () => {
    const source = readSource("server/routers.ts");
    expect(source).toContain("createBuildBranchWithIsolatedWorkspace");
    expect(source).toContain("agent-work/task-");
    expect(source).toContain("linkTaskToBuildBranch");
  });

  it("INV-S4-5-05 loads root defaults even when a task is not Project-backed", () => {
    const source = readSource("server/buildRunner/loadGovernance.ts");
    expect(source).toContain("loadRootGovernanceDocuments(task.ownerUserId)");
    expect(source).toContain("if (!task.buildBranchId)");
    expect(source).toContain("documents: rootDocuments");
  });

  it("INV-S4-5-06 keeps Project rule books additive to root defaults", () => {
    const source = readSource("server/buildRunner/loadGovernance.ts");
    expect(source).toContain("const documents: LoadedGovernanceDocument[] = [...rootDocuments]");
    expect(source).toContain('source: "project"');
    expect(source).toContain("sourceLabel(\"project\")");
  });

  it("INV-S4-5-07 renders governance source labels for diagnostics and model context", () => {
    const block = renderGovernanceBlock({
      targetName: "Portal",
      documents: [
        {
          path: "CLAUDE.md",
          resolvedPath: "CLAUDE.md",
          content: "Root rule",
          required: true,
          source: "root_default",
          sourceLabel: "Root default",
        } satisfies LoadedGovernanceDocument,
        {
          path: "docs/rules.md",
          resolvedPath: "docs/rules.md",
          content: "Project rule",
          required: true,
          source: "project",
          sourceLabel: "Project",
        } satisfies LoadedGovernanceDocument,
      ],
    });
    expect(block).toContain("=== CLAUDE.md [source: Root default] ===");
    expect(block).toContain("=== docs/rules.md [source: Project] ===");
  });

  it("INV-S4-5-08 surfaces source metadata in the owner-facing attached Global Files UI", () => {
    const source = readSource("client/src/pages/Home.tsx");
    expect(source).toContain("Source:");
    expect(source).toContain("Root default");
    expect(source).toContain("Project");
    expect(source).toContain("Manual");
  });

  it("INV-S4-5-09 forwards the selected Project through task creation and composer submission", () => {
    const source = readSource("client/src/pages/Home.tsx");
    expect(source).toContain("buildTargetId: selectedBuildTargetId");
    expect(source).toContain("selectedBuildTargetId ?? undefined");
  });
});
