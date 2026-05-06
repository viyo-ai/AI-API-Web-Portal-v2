import { mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import simpleGit, { type SimpleGit } from "simple-git";

export type BuildTargetGitConfig = {
  repoUrl: string;
  defaultBaseBranch: string;
  githubTokenEnvVar: string;
  protectedBranches: string[];
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
  if (value.startsWith("-") || value.includes("..") || value.includes("//") || /[\s~^:?*[\]\\]/.test(value)) {
    throw new Error("Unsafe Git branch name.");
  }
  return value;
}

export function assertBranchIsNotProtected(branchName: string, protectedBranches: string[]) {
  const normalized = branchName.trim();
  if (protectedBranches.includes(normalized)) {
    throw new Error(`Branch ${normalized} is protected. Use a non-protected Build Branch.`);
  }
}

export function normalizeGithubRepoUrl(repoUrl: string) {
  const cleanUrl = repoUrl.trim().replace(/\.git$/, "");
  if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(cleanUrl)) {
    throw new Error("Section 1 Build Targets accept HTTPS GitHub repository URLs only, for example https://github.com/org/repo.");
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
    const lastSyncedCommit = await git.revparse(["HEAD"]).catch(() => null);
    return { workspacePath, state: "clean", lastSyncedCommit };
  } catch (error) {
    return { workspacePath, state: "error", errorMessage: redactRepoUrl(error instanceof Error ? error.message : String(error)) };
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
