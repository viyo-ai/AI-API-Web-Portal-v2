import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildBranches, buildTargets, tasks, wizardSessions } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(userId = 42): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `user-${userId}`,
    email: `user-${userId}@example.com`,
    name: `User ${userId}`,
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as TrpcContext["res"],
  };
}

const validProjectWizardRecommendation = {
  defaultBaseBranch: {
    value: "main",
    confidence: "high",
    rationale: "Cached from the previously analyzed Project repository context.",
  },
  branchStrategy: {
    value: {
      initialBuildBranch: "portal-wizard-setup",
      protectedBranches: ["main", "staging"],
    },
    confidence: "high",
    rationale: "Keeps protected branches isolated from wizard-created Build Branch work.",
  },
  validationCommands: {
    value: ["pnpm check", "pnpm test -- --run", "pnpm build"],
    confidence: "high",
    rationale: "Matches the cached Project package scripts.",
  },
  serviceChecks: {
    value: ["curl -fsS http://localhost:3000/api/health"],
    confidence: "medium",
    rationale: "Cached health check discovered during previous Project analysis.",
  },
  projectRuleBooks: {
    value: [
      {
        path: "README.md",
        required: true,
        dynamic: false,
        role: "governance",
      },
      {
        path: "docs/ARCHITECTURE.md",
        required: true,
        dynamic: false,
        role: "governance",
      },
    ],
    confidence: "medium",
    rationale: "Cached Project rule books discovered in the repository.",
  },
  environmentVariables: {
    value: {
      ANTHROPIC_API_KEY: "ANTHROPIC_API_KEY",
    },
    confidence: "medium",
    rationale: "Cached server-side variable mapping used by Build Branch agents.",
  },
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.doUnmock("./db");
  vi.doUnmock("./buildRunner");
  vi.doUnmock("simple-git");
});

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
    const llmInvokeIndex = analyzeWizardSource.indexOf("projectWizardAnalysisRuntime.invokeProjectWizardAnalysis");
    const cacheWriteIndex = analyzeWizardSource.indexOf("await upsertWizardSessionCache");

    expect(cacheLookupIndex).toBeGreaterThanOrEqual(0);
    expect(cacheHitStatusIndex).toBeGreaterThan(cacheLookupIndex);
    expect(cachedRecommendationIndex).toBeGreaterThan(cacheHitStatusIndex);
    expect(llmInvokeIndex).toBeGreaterThan(cachedRecommendationIndex);
    expect(cacheWriteIndex).toBeGreaterThan(llmInvokeIndex);
  });

  it("returns a behavioral cache hit through analyzeWizard without invoking LLM analysis or cache writes", async () => {
    vi.resetModules();

    const commitSha = "abc123cachedwizard";
    const repoUrl = "https://github.com/viyo-ai/AI-API-Web-Portal-v2";
    const connection = { status: "ok" as const };
    const cachedWizardSession = {
      id: 501,
      ownerUserId: 42,
      repoUrl,
      commitSha,
      status: "cached" as const,
      recommendationJson: JSON.stringify(validProjectWizardRecommendation),
      repoContextJson: JSON.stringify({ repoUrl, commitSha }),
      errorMessage: null,
      expiresAt: Date.now() + 60_000,
      createdAt: Date.now() - 10_000,
      updatedAt: Date.now() - 5_000,
    };
    const dbMocks = {
      getValidWizardSessionCache: vi.fn().mockResolvedValue(cachedWizardSession),
      upsertWizardSessionCache: vi.fn(),
    };
    const buildRunnerMocks = {
      testBuildTargetConnection: vi.fn().mockResolvedValue(connection),
      normalizeGithubRepoUrl: vi.fn(() => repoUrl),
      resolveAuthenticatedRepoUrl: vi.fn((value: string) => value),
    };
    const gitMock = {
      clone: vi.fn().mockResolvedValue(undefined),
      revparse: vi.fn().mockResolvedValue(`${commitSha}\n`),
    };
    const simpleGitMock = vi.fn(() => gitMock);

    vi.doMock("./db", async importOriginal => ({
      ...(await importOriginal<typeof import("./db")>()),
      ...dbMocks,
    }));
    vi.doMock("./buildRunner", async importOriginal => ({
      ...(await importOriginal<typeof import("./buildRunner")>()),
      ...buildRunnerMocks,
    }));
    vi.doMock("simple-git", () => ({ default: simpleGitMock }));

    const routers = await import("./routers");
    const invokeSpy = vi.spyOn(
      routers.projectWizardAnalysisRuntime,
      "invokeProjectWizardAnalysis"
    );
    const caller = routers.appRouter.createCaller(createContext(42));

    const result = await caller.buildTargets.analyzeWizard({
      displayName: "AI API Web Portal",
      repoUrl,
      githubTokenEnvVar: "BUILD_TARGET_GITHUB_TOKEN",
      defaultBaseBranch: "main",
    });

    if (result.status !== "ok") {
      throw new Error(result.errorMessage ?? result.fallbackMessage ?? "Wizard analysis failed");
    }

    expect(result).toMatchObject({
      status: "ok",
      cacheStatus: "hit",
      connection,
      recommendation: validProjectWizardRecommendation,
    });
    expect(buildRunnerMocks.testBuildTargetConnection).toHaveBeenCalledWith({
      repoUrl,
      githubTokenEnvVar: "BUILD_TARGET_GITHUB_TOKEN",
      defaultBaseBranch: "main",
    });
    expect(simpleGitMock).toHaveBeenCalled();
    expect(gitMock.clone).toHaveBeenCalled();
    expect(gitMock.revparse).toHaveBeenCalledWith(["HEAD"]);
    expect(dbMocks.getValidWizardSessionCache).toHaveBeenCalledWith({
      ownerUserId: 42,
      repoUrl,
      commitSha,
    });
    expect(result.repoContext.commitSha).toBe(commitSha);
    expect(result.repoContext.normalizedRepoUrl).toBe(repoUrl);
    expect(invokeSpy).not.toHaveBeenCalled();
    expect(dbMocks.upsertWizardSessionCache).not.toHaveBeenCalled();
  });
});
