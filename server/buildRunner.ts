import { appendFile, chmod, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import simpleGit, { type SimpleGit } from "simple-git";

export type BuildTargetGitConfig = {
  repoUrl: string;
  defaultBaseBranch: string;
  githubTokenEnvVar: string;
  protectedBranches: string[];
  agentEnvVarMap?: AgentEnvVarMap;
};

export type BranchWorkspaceResult = {
  workspacePath: string;
  state: "clean" | "error";
  errorMessage?: string;
  lastSyncedCommit?: string | null;
};

export type BranchGitStatus = {
  currentBranch: string | null;
  isClean: boolean;
  ahead: number;
  behind: number;
  lastCommitSha: string | null;
  files: Array<{ path: string; workingDir: string; index: string }>;
};

export type AgentEnvVarMap = Record<string, string>;

export const buildBranchPrefix = "agent-work/";

export type BranchPushResult = {
  pushState: "pushed" | "blocked" | "error";
  pushedCommit?: string | null;
  errorMessage?: string;
};

export const conventionalCommitPattern = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9._-]+\))?: .{1,200}$/;

export type ConnectionTestResult = {
  status: "missing_env" | "invalid_token" | "repo_not_accessible" | "ok";
  message: string;
};

function safeBranchSegment(branchName: string) {
  return branchName.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 180) || "branch";
}

export function assertSafeBranchName(branchName: string) {
  const value = branchName.trim();
  if (!value || value.length > 220) throw new Error("Build branch name is required and must be under 220 characters.");
  if (!value.startsWith(buildBranchPrefix)) {
    throw new Error(`Build branch names must start with ${buildBranchPrefix}. Protected/base branches must never be used as agent work branches.`);
  }
  const suffix = value.slice(buildBranchPrefix.length);
  if (!suffix || suffix.startsWith("/") || suffix.endsWith("/")) {
    throw new Error(`Build branch names must include a non-empty slug after ${buildBranchPrefix}.`);
  }
  if (value.startsWith("-") || value.includes("..") || value.includes("//") || /[\s~^:?*[\]\\]/.test(value) || !/^[A-Za-z0-9._/-]+$/.test(value)) {
    throw new Error("Unsafe Git branch name. Use ASCII letters, numbers, '.', '_', '-', and '/' only.");
  }
  return value;
}

export function assertBranchIsNotProtected(branchName: string, protectedBranches: string[]) {
  const normalized = branchName.trim();
  const protectedSet = new Set(protectedBranches.map((branch) => branch.trim()).filter(Boolean));
  if (protectedSet.has(normalized)) {
    throw new Error(`Branch ${normalized} is protected. Use a non-protected Build Branch.`);
  }
}

export function assertConventionalCommitMessage(message: string) {
  const firstLine = message.split("\n")[0]?.trim() ?? "";
  if (!conventionalCommitPattern.test(firstLine)) {
    throw new Error("Push blocked: latest commit message must use commit message format, for example feat(scope): concise summary.");
  }
  return firstLine;
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function serializeEnvValue(value: string) {
  return JSON.stringify(value ?? "");
}

function normalizeEnvName(value: string) {
  const normalized = value.trim();
  if (!/^[A-Z_][A-Z0-9_]*$/.test(normalized)) {
    throw new Error(`Invalid environment variable name: ${value}. Use uppercase letters, numbers, and underscores, starting with a letter or underscore.`);
  }
  return normalized;
}

export function normalizeAgentEnvVarMap(value: unknown): AgentEnvVarMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value as Record<string, unknown>)
    .map(([workspaceEnvName, sourceEnvName]) => [normalizeEnvName(workspaceEnvName), typeof sourceEnvName === "string" ? normalizeEnvName(sourceEnvName) : ""] as const)
    .filter(([, sourceEnvName]) => Boolean(sourceEnvName));
  return Object.fromEntries(entries);
}

export function normalizeGithubRepoUrl(repoUrl: string) {
  const cleanUrl = repoUrl.trim().replace(/\.git$/, "");
  if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(cleanUrl)) {
    throw new Error("Section 1 Projects accept HTTPS GitHub repository URLs only, for example https://github.com/org/repo.");
  }
  return `${cleanUrl}.git`;
}

export function resolveAuthenticatedRepoUrl(repoUrl: string, githubTokenEnvVar: string) {
  const token = process.env[githubTokenEnvVar];
  if (!token) throw new Error(`GitHub token env var ${githubTokenEnvVar} is not defined.`);
  const normalized = normalizeGithubRepoUrl(repoUrl);
  return normalized.replace("https://", `https://x-access-token:${encodeURIComponent(token)}@`);
}

export function redactRepoUrl(value: string) {
  return value.replace(/x-access-token:[^@]+@/g, "x-access-token:[redacted]@");
}

export function getBuildBranchWorkspacePath(params: { ownerUserId: number; buildTargetId: number; branchId: number; branchName: string; workspaceRoot?: string }) {
  const workspaceBase = params.workspaceRoot ?? process.env.AICW_BUILD_WORKSPACE_ROOT ?? "/tmp/ai-coding-workshop-build-targets";
  return path.join(workspaceBase, `owner-${params.ownerUserId}`, `target-${params.buildTargetId}`, `branch-${params.branchId}-${safeBranchSegment(params.branchName)}`);
}

function buildGit(workspacePath: string): SimpleGit {
  return simpleGit({ baseDir: workspacePath, binary: "git", maxConcurrentProcesses: 1 });
}

async function ensureGitignoreContains(workspacePath: string, pattern: string) {
  const gitignorePath = path.join(workspacePath, ".gitignore");
  const existing = await readFile(gitignorePath, "utf8").catch(() => "");
  if (!existing.split(/\r?\n/).includes(pattern)) {
    await appendFile(gitignorePath, `${existing.endsWith("\n") || existing.length === 0 ? "" : "\n"}${pattern}\n`);
  }
}

export function buildAgentProcessEnv(agentEnvVarMap: AgentEnvVarMap = {}, sourceEnv: NodeJS.ProcessEnv = process.env) {
  const normalizedMap = normalizeAgentEnvVarMap(agentEnvVarMap);
  const childEnv: Record<string, string> = {};
  const missing: string[] = [];
  for (const [workspaceEnvName, sourceEnvName] of Object.entries(normalizedMap)) {
    const value = sourceEnv[sourceEnvName];
    if (value === undefined) {
      missing.push(sourceEnvName);
      continue;
    }
    childEnv[workspaceEnvName] = value;
  }
  return { env: childEnv, missing };
}

export async function injectAgentEnvFile(workspacePath: string, agentEnvVarMap: AgentEnvVarMap = {}) {
  const normalizedMap = normalizeAgentEnvVarMap(agentEnvVarMap);
  await ensureGitignoreContains(workspacePath, ".env.agent");
  const lines = [
    "# Generated by AI Coding Workshop Section 4.",
    "# Do not commit. Values are resolved from server-side environment variables.",
  ];
  const { env, missing } = buildAgentProcessEnv(normalizedMap);
  for (const [workspaceEnvName, value] of Object.entries(env)) {
    lines.push(`${workspaceEnvName}=${serializeEnvValue(value)}`);
  }
  await writeFile(path.join(workspacePath, ".env.agent"), `${lines.join("\n")}\n`, { mode: 0o600 });
  if (missing.length > 0) {
    throw new Error(`Agent environment injection failed because these server env vars are missing: ${missing.join(", ")}.`);
  }
  return { injectedCount: Object.keys(env).length, missing, envFilePath: path.join(workspacePath, ".env.agent") };
}

export async function installPrePushHook(workspacePath: string, protectedBranches: string[] = ["main", "staging"]) {
  const gitDir = path.join(workspacePath, ".git");
  await mkdir(path.join(gitDir, "hooks"), { recursive: true });
  const protectedChecks = protectedBranches.map((branch) => `[ "$branch" = ${shellQuote(branch)} ]`).join(" || ") || "false";
  const protectedLoopValues = protectedBranches.map((branch) => shellQuote(branch)).join(" ") || "''";
  const hook = `#!/usr/bin/env sh
set -eu
branch="$(git rev-parse --abbrev-ref HEAD)"
if ${protectedChecks}; then
  echo "Section 4 push blocked: $branch is protected." >&2
  exit 1
fi
while read local_ref local_sha remote_ref remote_sha; do
  for protected_branch in ${protectedLoopValues}; do
    if [ "$remote_ref" = "refs/heads/$protected_branch" ]; then
      echo "Section 4 push blocked: $protected_branch is protected." >&2
      exit 1
    fi
  done
done
if git diff --cached --name-only | grep -Fx ".env.agent" >/dev/null 2>&1; then
  echo "Section 4 push blocked: .env.agent must never be committed." >&2
  exit 1
fi
subject="$(git log -1 --pretty=%s)"
printf '%s' "$subject" | grep -Eq '^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9._-]+\))?: .{1,200}$' || {
  echo "Section 4 push blocked: latest commit message must use commit message format." >&2
  exit 1
}
`;
  const hookPath = path.join(gitDir, "hooks", "pre-push");
  await writeFile(hookPath, hook, { mode: 0o755 });
  await chmod(hookPath, 0o755);
  return { hookPath, protectedBranches };
}

export async function testBuildTargetConnection(params: { repoUrl: string; githubTokenEnvVar: string; defaultBaseBranch?: string }): Promise<ConnectionTestResult> {
  if (!process.env[params.githubTokenEnvVar]) {
    return { status: "missing_env", message: `Environment variable ${params.githubTokenEnvVar} is not set.` };
  }
  try {
    const authenticatedUrl = resolveAuthenticatedRepoUrl(params.repoUrl, params.githubTokenEnvVar);
    const result = await simpleGit().listRemote(["--heads", authenticatedUrl, params.defaultBaseBranch ?? "main"]);
    if (!(result ?? "").trim()) return { status: "repo_not_accessible", message: "Repository is accessible, but the requested base branch was not found." };
    return { status: "ok", message: "Repository connection succeeded." };
  } catch (error) {
    const message = redactRepoUrl(error instanceof Error ? error.message : String(error));
    if (/authentication|credential|token|403|401|could not read username/i.test(message)) return { status: "invalid_token", message };
    return { status: "repo_not_accessible", message };
  }
}

export async function cloneOrSyncBranch(params: {
  ownerUserId: number;
  buildTargetId: number;
  branchId: number;
  branchName: string;
  baseBranch: string;
  target: BuildTargetGitConfig;
  workspacePath?: string;
}): Promise<BranchWorkspaceResult> {
  const branchName = assertSafeBranchName(params.branchName);
  assertBranchIsNotProtected(branchName, params.target.protectedBranches);
  const workspacePath = params.workspacePath ?? getBuildBranchWorkspacePath({ ownerUserId: params.ownerUserId, buildTargetId: params.buildTargetId, branchId: params.branchId, branchName });
  try {
    const authenticatedUrl = resolveAuthenticatedRepoUrl(params.target.repoUrl, params.target.githubTokenEnvVar);
    const exists = await stat(path.join(workspacePath, ".git")).then(() => true).catch(() => false);
    if (!exists) {
      await rm(workspacePath, { recursive: true, force: true });
      await mkdir(path.dirname(workspacePath), { recursive: true });
      await simpleGit().clone(authenticatedUrl, workspacePath, ["--branch", params.baseBranch, "--single-branch"]);
    }
    const git = buildGit(workspacePath);
    await git.fetch("origin");
    const branches = await git.branch(["--list", branchName]);
    if (!branches.all.includes(branchName)) await git.checkoutLocalBranch(branchName);
    else await git.checkout(branchName);
    await git.pull("origin", params.baseBranch, { "--ff-only": null }).catch(() => undefined);
    await installPrePushHook(workspacePath, params.target.protectedBranches);
    await injectAgentEnvFile(workspacePath, params.target.agentEnvVarMap ?? {});
    const lastSyncedCommit = await git.revparse(["HEAD"]).catch(() => null);
    return { workspacePath, state: "clean", lastSyncedCommit };
  } catch (error) {
    return { workspacePath, state: "error", errorMessage: redactRepoUrl(error instanceof Error ? error.message : String(error)) };
  }
}

export async function pushBranch(params: {
  workspacePath: string;
  branchName: string;
  target: BuildTargetGitConfig & { agentEnvVarMap?: AgentEnvVarMap };
}): Promise<BranchPushResult> {
  try {
    const branchName = assertSafeBranchName(params.branchName);
    assertBranchIsNotProtected(branchName, params.target.protectedBranches);
    await injectAgentEnvFile(params.workspacePath, params.target.agentEnvVarMap ?? {});
    await installPrePushHook(params.workspacePath, params.target.protectedBranches);
    const git = buildGit(params.workspacePath);
    const status = await git.status();
    if (status.current !== branchName) {
      throw new Error(`Push blocked: workspace is on ${status.current || "unknown"}, expected ${branchName}.`);
    }
    assertBranchIsNotProtected(status.current, params.target.protectedBranches);
    if (!status.isClean()) {
      throw new Error("Push blocked: working tree must be clean before pushing a Build Branch.");
    }
    const stagedEnv = await git.raw(["diff", "--cached", "--name-only"]);
    if (stagedEnv.split(/\r?\n/).includes(".env.agent")) {
      throw new Error("Push blocked: .env.agent must never be staged or committed.");
    }
    const latestSubject = await git.raw(["log", "-1", "--pretty=%s"]);
    assertConventionalCommitMessage(latestSubject);
    const authenticatedUrl = resolveAuthenticatedRepoUrl(params.target.repoUrl, params.target.githubTokenEnvVar);
    await git.remote(["set-url", "origin", authenticatedUrl]);
    try {
      await git.push("origin", branchName, ["--set-upstream"]);
    } finally {
      await git.remote(["set-url", "origin", normalizeGithubRepoUrl(params.target.repoUrl)]).catch(() => undefined);
    }
    const pushedCommit = await git.revparse(["HEAD"]).catch(() => null);
    return { pushState: "pushed", pushedCommit };
  } catch (error) {
    const errorMessage = redactRepoUrl(error instanceof Error ? error.message : String(error));
    return { pushState: /blocked|protected|commit message|clean before pushing|never be staged/i.test(errorMessage) ? "blocked" : "error", errorMessage };
  }
}

export async function getBuildBranchGitStatus(workspacePath: string): Promise<BranchGitStatus> {
  const git = buildGit(workspacePath);
  const status = await git.status();
  const lastCommitSha = await git.revparse(["HEAD"]).catch(() => null);
  return {
    currentBranch: status.current || null,
    isClean: status.isClean(),
    ahead: status.ahead,
    behind: status.behind,
    lastCommitSha,
    files: status.files.map((file) => ({ path: file.path, workingDir: file.working_dir, index: file.index })),
  };
}

export async function cleanupWorkspace(workspacePath: string) {
  await rm(workspacePath, { recursive: true, force: true });
  return { removed: true };
}
