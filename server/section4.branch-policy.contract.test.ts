import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import simpleGit from "simple-git";
import { describe, expect, it } from "vitest";
import { buildBranches, buildTargets } from "../drizzle/schema";
import { appRouter } from "./routers";
import {
  assertBranchIsNotProtected,
  assertConventionalCommitMessage,
  assertSafeBranchName,
  buildAgentProcessEnv,
  cleanupWorkspace,
  getBuildBranchWorkspacePath,
  injectAgentEnvFile,
  installPrePushHook,
  normalizeAgentEnvVarMap,
  pushBranch,
} from "./buildRunner";

async function makeTempWorkspace(name: string) {
  return mkdtemp(path.join(os.tmpdir(), `${name}-`));
}

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
    expect(assertBranchIsNotProtected("agent-work/section-4", ["main", "staging"])).toBeUndefined();
    expect(assertConventionalCommitMessage("feat(portal-section-4): branch isolation")).toBe("feat(portal-section-4): branch isolation");
    expect(() => assertConventionalCommitMessage("section 4 update")).toThrow(/commit message/);
  });

  it("normalizes agent env-var maps to uppercase env names only", () => {
    expect(normalizeAgentEnvVarMap({ WORKSHOP_GITHUB_TOKEN: "BUILD_TARGET_GITHUB_TOKEN" })).toEqual({ WORKSHOP_GITHUB_TOKEN: "BUILD_TARGET_GITHUB_TOKEN" });
    expect(() => normalizeAgentEnvVarMap({ "bad-name": "BUILD_TARGET_GITHUB_TOKEN" })).toThrow(/Invalid environment variable/);
  });

  it("INV-S4-01 returns a structured blocked result before any protected branch push can spawn", async () => {
    const result = await pushBranch({
      workspacePath: "/tmp/section-4-no-git-needed-for-protected-branch",
      branchName: "main",
      target: {
        repoUrl: "https://github.com/viyo-ai/AI-API-Web-Portal-v2.git",
        defaultBaseBranch: "main",
        githubTokenEnvVar: "BUILD_TARGET_GITHUB_TOKEN",
        protectedBranches: ["main", "staging"],
      },
    });

    expect(result.pushState).toBe("blocked");
    expect(result.errorMessage).toMatch(/agent-work|protected/i);
  });

  it("INV-S4-02 accepts only agent-work/* safe branch names", () => {
    for (const unsafe of ["", "..", "/etc/passwd", "main", "staging", " agent-work/space bad ", "agent-work/unicode-☃", "agent-work/", "agent-work/a..b"]) {
      expect(() => assertSafeBranchName(unsafe), unsafe).toThrow();
    }
    expect(assertSafeBranchName("agent-work/foo-bar")).toBe("agent-work/foo-bar");
    expect(assertSafeBranchName("agent-work/feature_4.2")).toBe("agent-work/feature_4.2");
  });

  it("INV-S4-03 keeps concurrently created Build Branch workspaces isolated by branch id", async () => {
    const root = await makeTempWorkspace("s4-workspaces");
    const first = getBuildBranchWorkspacePath({ ownerUserId: 7, buildTargetId: 11, branchId: 101, branchName: "agent-work/task-a", workspaceRoot: root });
    const second = getBuildBranchWorkspacePath({ ownerUserId: 7, buildTargetId: 11, branchId: 102, branchName: "agent-work/task-b", workspaceRoot: root });

    expect(first).not.toBe(second);
    await mkdir(first, { recursive: true });
    await mkdir(second, { recursive: true });
    await writeFile(path.join(first, "only-first.txt"), "first");
    await writeFile(path.join(second, "only-second.txt"), "second");

    expect(existsSync(path.join(first, "only-second.txt"))).toBe(false);
    expect(existsSync(path.join(second, "only-first.txt"))).toBe(false);
  });

  it("INV-S4-04 builds an agent child-process env from mapped variables only", () => {
    const { env, missing } = buildAgentProcessEnv(
      { DATABASE_URL: "BUILD_TARGET_DATABASE_URL" },
      { BUILD_TARGET_DATABASE_URL: "mysql://preview", ANTHROPIC_API_KEY: "server-secret" }
    );

    expect(missing).toEqual([]);
    expect(env).toEqual({ DATABASE_URL: "mysql://preview" });

    const child = spawnSync(process.execPath, ["-e", "process.stdout.write(JSON.stringify(process.env))"], {
      env,
      encoding: "utf8",
    });
    expect(child.status).toBe(0);
    const childEnv = JSON.parse(child.stdout) as Record<string, string>;
    expect(childEnv.DATABASE_URL).toBe("mysql://preview");
    expect(childEnv.ANTHROPIC_API_KEY).toBeUndefined();
  });

  it("INV-S4-05 installs a git pre-push hook that rejects protected remote refs", async () => {
    const workspace = await makeTempWorkspace("s4-hook");
    const git = simpleGit(workspace);
    await git.init();
    await git.addConfig("user.email", "section4@example.test");
    await git.addConfig("user.name", "Section 4 Test");
    await writeFile(path.join(workspace, "README.md"), "section 4 hook test\n");
    await git.add("README.md");
    await git.commit("feat(section-4): prepare hook test");
    await git.checkoutLocalBranch("agent-work/task");
    const { hookPath } = await installPrePushHook(workspace, ["main", "staging"]);
    const hook = spawnSync(hookPath, ["origin", "https://example.invalid/repo.git"], {
      cwd: workspace,
      input: "refs/heads/agent-work/task 0000000000000000000000000000000000000001 refs/heads/main 0000000000000000000000000000000000000000\n",
      encoding: "utf8",
    });

    expect(hook.status).not.toBe(0);
    expect(hook.stderr).toMatch(/main is protected/);
  });

  it("INV-S4-06 cleanup removes .git, .env.agent, and uncommitted workspace files", async () => {
    const workspace = await makeTempWorkspace("s4-cleanup");
    await simpleGit(workspace).init();
    process.env.SECTION4_PREVIEW_ONLY = "preview-value";
    await injectAgentEnvFile(workspace, { DATABASE_URL: "SECTION4_PREVIEW_ONLY" });
    await writeFile(path.join(workspace, "scratch.txt"), "uncommitted");
    expect(existsSync(path.join(workspace, ".git"))).toBe(true);
    expect((await readFile(path.join(workspace, ".env.agent"), "utf8"))).toContain("DATABASE_URL");

    await cleanupWorkspace(workspace);
    expect(existsSync(workspace)).toBe(false);
    delete process.env.SECTION4_PREVIEW_ONLY;
  });
});
