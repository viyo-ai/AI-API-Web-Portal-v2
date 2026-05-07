import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { skills, taskSkillSelections, buildTargets } from "../drizzle/schema";
import { appRouter } from "./routers";
import { normalizeSkillInput, renderResolvedSkillsPromptBlock } from "./db";

describe("rewritten Section 3 Skill Libraries contracts", () => {
  it("keeps additive Skill Library persistence without removing Section 2 Project rule book fields", () => {
    expect(skills.name).toBeDefined();
    expect(skills.content).toBeDefined();
    expect(skills.source).toBeDefined();
    expect(skills.isOfficial).toBeDefined();
    expect(taskSkillSelections.state).toBeDefined();
    expect(buildTargets.governanceFilesJson).toBeDefined();
    expect(buildTargets.governanceBudgetEnforced).toBeDefined();
  });

  it("normalizes all four rewritten creation sources for owner-scoped Skill Libraries", () => {
    const sources = ["ai_built", "uploaded", "official", "github_imported"] as const;
    for (const source of sources) {
      const normalized = normalizeSkillInput({
        ownerUserId: 9,
        name: `${source} Review Skill`,
        content: "Use the approved review checklist before changing code.",
        source,
        scope: "manual-only",
      });
      expect(normalized.slug).toMatch(/review-skill/);
      expect(normalized.enabled).toBe(true);
      expect(normalized.source).toBe(source);
      expect(normalized.taskTypesJson).toBeNull();
      expect(normalized.filePatternsJson).toBeNull();
    }
  });

  it("exposes server procedures for list, selection, AI build, upload/save, official add, and GitHub import paths", () => {
    const procedures = appRouter._def.procedures;
    expect(procedures["skills.listForTask"]).toBeDefined();
    expect(procedures["skills.officialCatalog"]).toBeDefined();
    expect(procedures["skills.create"]).toBeDefined();
    expect(procedures["skills.update"]).toBeDefined();
    expect(procedures["skills.delete"]).toBeDefined();
    expect(procedures["skills.forkOfficial"]).toBeDefined();
    expect(procedures["skills.pickForTask"]).toBeDefined();
    expect(procedures["skills.removeForTask"]).toBeDefined();
    expect(procedures["skills.aiDraft"]).toBeDefined();
    expect(procedures["skills.previewGithubImport"]).toBeDefined();
    expect(procedures["skills.importGithubSelected"]).toBeDefined();
  });

  it("renders selected Skill Library instructions as a provider prompt block after Project rule books", () => {
    const promptBlock = renderResolvedSkillsPromptBlock([
      {
        slug: "review-safety",
        name: "Review Safety",
        version: "1.0.0",
        scope: "manual-only",
        content: "Check migrations, tests, and owner-facing copy before shipping.",
        displayTag: "Picked by owner",
      },
    ]);

    expect(promptBlock).toContain("AI Skill instructions loaded for this task");
    expect(promptBlock).toContain("Follow these reusable owner-approved instructions after the project rule books");
    expect(promptBlock).toContain("review-safety");
    expect(promptBlock).toContain("Picked by owner");
  });

  it("ships a Manus-style Skill Libraries card grid with exactly the four approved creation paths", () => {
    const source = readFileSync(path.resolve(process.cwd(), "client/src/pages/SkillLibraries.tsx"), "utf8");
    expect(source).toContain("Build with AI");
    expect(source).toContain("Upload a skill");
    expect(source).toContain("Add from official");
    expect(source).toContain("Import from GitHub");
    expect(source).toContain("rounded-3xl");
    expect(source).toContain("grid gap-4 xl:grid-cols-2");
  });

  it("keeps accepted §3A vocabulary and Section 2 Project rule book UI while adding Skill Libraries", () => {
    const home = readFileSync(path.resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
    const skillsPanel = readFileSync(path.resolve(process.cwd(), "client/src/pages/SkillLibraries.tsx"), "utf8");
    expect(home).toContain("Project rule books");
    expect(home).toContain("AI Activity");
    expect(home).toContain("Skill Libraries");
    expect(skillsPanel).not.toContain("Build Target governance");
    expect(skillsPanel).not.toContain("Chat Wrapper");
  });

  it("preserves Streamdown markdown rendering for assistant messages while keeping tests compatible with KaTeX CSS imports", () => {
    const aiChatBox = readFileSync(path.resolve(process.cwd(), "client/src/components/AIChatBox.tsx"), "utf8");
    const vitestConfig = readFileSync(path.resolve(process.cwd(), "vitest.config.ts"), "utf8");
    expect(aiChatBox).toContain("import { Streamdown } from \"streamdown\"");
    expect(aiChatBox).toContain("<Streamdown>{message.content}</Streamdown>");
    expect(vitestConfig).toContain('inline: ["streamdown", "katex", "rehype-katex"]');
  });
});
