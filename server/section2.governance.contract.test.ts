import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildTargets } from "../drizzle/schema";
import { appRouter } from "./routers";
import {
  enforceGovernanceBudget,
  normalizeGovernanceFiles,
  parseGovernanceFiles,
  renderGovernanceBlock,
  validateGovernanceFiles,
  type LoadedGovernanceDocument,
} from "./buildRunner/loadGovernance";

describe("Section 2 per-task governance auto-load contracts", () => {
  it("adds additive Build Target governance schema surfaces without removing Phase 1 target fields", () => {
    expect(buildTargets.governanceFilesJson).toBeDefined();
    expect(buildTargets.governanceBudgetEnforced).toBeDefined();
    expect(buildTargets.repoUrl).toBeDefined();
    expect(buildTargets.defaultBaseBranch).toBeDefined();
    expect(buildTargets.githubTokenEnvVar).toBeDefined();
  });

  it("exposes Build Target settings procedures that accept Governance Files through existing namespaces", () => {
    const procedures = appRouter._def.procedures;
    expect(procedures["buildTargets.updateSettings"]).toBeDefined();
    expect(procedures["buildTarget.updateSettings"]).toBeDefined();
  });

  it("validates Governance Files for safe paths, governance document presence, and dynamic placeholder resolver rows", () => {
    expect(validateGovernanceFiles([{ path: "docs/governance.md", required: true, dynamic: false, role: "governance" }])).toEqual([]);
    expect(validateGovernanceFiles([{ path: "../secret.md", required: true, dynamic: false, role: "governance" }]).join(" ")).toMatch(/relative/);
    expect(validateGovernanceFiles([{ path: "resolvers/task-slug.txt", required: true, dynamic: false, role: "placeholder_resolver", resolverKey: "taskSlug" }]).join(" ")).toMatch(/at least one governance document/);
    expect(validateGovernanceFiles([{ path: "docs/{taskSlug}.md", required: true, dynamic: true, role: "governance" }]).join(" ")).toMatch(/without a matching placeholder_resolver/);
  });

  it("round-trips normalized Governance Files JSON and rejects invalid configuration", () => {
    const json = normalizeGovernanceFiles([
      { path: "resolvers/task-slug.txt", required: true, dynamic: false, role: "placeholder_resolver", resolverKey: "taskSlug" },
      { path: "docs/{taskSlug}.md", required: true, dynamic: true, role: "governance" },
      { path: "docs/optional.md", required: false, dynamic: false, role: "governance" },
    ]);
    expect(parseGovernanceFiles(json)).toEqual([
      { path: "resolvers/task-slug.txt", required: true, dynamic: false, role: "placeholder_resolver", resolverKey: "taskSlug" },
      { path: "docs/{taskSlug}.md", required: true, dynamic: true, role: "governance" },
      { path: "docs/optional.md", required: false, dynamic: false, role: "governance" },
    ]);
    expect(() => normalizeGovernanceFiles([{ path: "/absolute.md", required: true, dynamic: false, role: "governance" }])).toThrow(/relative/);
  });

  it("drops optional governance first and truncates required governance under provider budgets", () => {
    const requiredHuge = "r".repeat(260_000);
    const optionalHuge = "o".repeat(140_000);
    const documents: LoadedGovernanceDocument[] = [
      { path: "docs/required.md", resolvedPath: "docs/required.md", content: requiredHuge, required: true },
      { path: "docs/optional.md", resolvedPath: "docs/optional.md", content: optionalHuge, required: false },
    ];
    const result = enforceGovernanceBudget({ documents, provider: "kimi", enforcementEnabled: true, budgetTokens: 1_000 });
    expect(result.droppedOptional).toContain("docs/optional.md");
    expect(result.truncated).toContain("docs/required.md");
    expect(result.estimatedTokens).toBeLessThanOrEqual(1_000);
    expect(result.documents.some((document) => document.content.includes("truncated by portal"))).toBe(true);
  });

  it("renders loaded governance documents into an authoritative provider prompt block", () => {
    const block = renderGovernanceBlock({
      targetName: "VIYO",
      documents: [{ path: "docs/governance.md", resolvedPath: "docs/governance.md", content: "Use the approved architecture.", required: true }],
    });
    expect(block).toContain("VIYO build pipeline");
    expect(block).toContain("=== docs/governance.md ===");
    expect(block).toContain("The following governance documents are authoritative");
    expect(block).toContain("Do not modify any of the governance documents");
  });

  it("keeps Section 2 owner UI controls present without replacing the Phase 1 Build Target form", () => {
    const homeSource = readFileSync(path.resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
    expect(homeSource).toContain("data-testid=\"section2-governance-files-settings\"");
    expect(homeSource).toContain("Governance Files");
    expect(homeSource).toContain("Add governance row");
    expect(homeSource).toContain("Save selected target settings");
    expect(homeSource).toContain("Build Target name");
    expect(homeSource).toContain("Test connection");
  });
});
