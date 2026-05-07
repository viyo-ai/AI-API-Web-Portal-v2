import { COOKIE_NAME } from "@shared/const";
import { Buffer } from "node:buffer";
import { mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import simpleGit from "simple-git";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import {
  adminProcedure,
  protectedProcedure,
  publicProcedure,
  router,
} from "./_core/trpc";
import {
  appendTaskEvent,
  assertSafeRelativePath,
  attachGlobalFileToTask,
  autoAttachRootGlobalFiles,
  detachOrDeleteGlobalFileFromTask,
  createBuildBranch,
  createBuildTarget,
  updateBuildTarget,
  archiveBuildTarget,
  createGlobalFile,
  createMemory,
  createTask,
  createTaskFile,
  createTurn,
  enqueueTaskMessage,
  formatQueuedMessagesForGeneration,
  type CredentialProvider,
  type CredentialStatus,
  failTurn,
  getBuildBranchForOwner,
  getBuildTargetForOwner,
  getValidWizardSessionCache,
  getLatestCredentialStatuses,
  getTaskForOwner,
  getTaskThread,
  getGlobalFileForOwner,
  getTaskFileForOwner,
  linkTaskToBuildBranch,
  deleteBuildBranch,
  listAllFilesForOwner,
  listBuildBranchesForTarget,
  listBuildTargetsForOwner,
  listGlobalFileLinksForTask,
  listGlobalFilesForOwner,
  listMemoryByCategory,
  linkTaskToBuildTarget,
  listTaskEvents,
  listTaskFiles,
  listTasksForOwner,
  listTurnsForTask,
  markQueuedMessagesProcessing,
  markQueuedMessagesSent,
  cancelQueuedTaskMessage,
  updateQueuedTaskMessage,
  type MemoryCategory,
  recordCredentialStatus,
  renameTask,
  parseAgentEnvVarMap,
  parseJsonStringArray,
  type RouteMode,
  searchMemory,
  updateBuildBranchPushState,
  updateBuildBranchState,
  updateBuildBranchWorkspacePath,
  updateBuildTargetEnvMap,
  updateBuildTargetGovernanceSettings,
  upsertWizardSessionCache,
  updateTaskStatus,
  createSkill,
  deleteSkill,
  duplicateSkill,
  getSkillForOwner,
  getSkillBySlugForOwner,
  listOfficialSkills,
  listSkillsForOwner,
  listTaskSkillSelections,
  parseSkillJsonArray,
  parseSkillMetadata,
  resolveSkillsForTask,
  type SkillScope,
  type SkillSource,
  taskTypeLabel,
  updateSkill,
  upsertTaskSkillSelection,
} from "./db";
import {
  createWorkspaceDirectory,
  deleteWorkspacePath,
  listWorkspaceDirectory,
  readWorkspaceFile,
  renameWorkspacePath,
  snapshotWorkspacePath,
  uploadWorkspaceFile,
  writeWorkspaceFile,
} from "./filesystem";
import {
  cleanupWorkspace,
  cloneOrSyncBranch,
  getBuildBranchGitStatus,
  getBuildBranchWorkspacePath,
  testBuildTargetConnection,
  assertSafeBranchName,
  pushBranch,
  resolveAuthenticatedRepoUrl,
  normalizeGithubRepoUrl,
} from "./buildRunner";
import { storagePut } from "./storage";
import { getUserWorkspaceRoot } from "./terminal";
import {
  CLAUDE_DEFAULT_MODEL,
  CLAUDE_OWNER_MODEL_LABEL,
  buildClaudeMessagesRequestBody,
  orchestrateWithOpenAI,
  executeWrapperTurn,
  getWrapperRuntimeCredentialStates,
  KIMI_K26_CLOUDFLARE_MODEL,
  KIMI_OWNER_MODEL_LABEL,
  resolveEffectiveRoute,
} from "./wrapperLLM";
import { requestTurnStop } from "./wrapperLLM/stop-registry";
import {
  loadGovernanceForTask,
  validateGovernanceFiles,
  type GovernanceLoadResult,
} from "./buildRunner/loadGovernance";

const agentEnvVarMapSchema = z
  .record(
    z
      .string()
      .trim()
      .regex(/^[A-Z_][A-Z0-9_]*$/, "Use uppercase environment variable names."),
    z
      .string()
      .trim()
      .regex(
        /^[A-Z_][A-Z0-9_]*$/,
        "Use uppercase source environment variable names."
      )
  )
  .default({});
const governanceFileSchema = z
  .object({
    path: z.string().trim().min(1).max(1024),
    required: z.boolean().default(true),
    dynamic: z.boolean().default(false),
    role: z.enum(["governance", "placeholder_resolver"]),
    resolverKey: z.string().trim().max(120).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.path.startsWith("/") || value.path.includes("..")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["path"],
        message: "Path must be relative and must not contain '..'.",
      });
    }
    if (value.role === "placeholder_resolver" && !value.resolverKey?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["resolverKey"],
        message: "Resolver key is required for placeholder resolver rows.",
      });
    }
  });
const governanceFilesSchema = z
  .array(governanceFileSchema)
  .max(50)
  .superRefine((value, ctx) => {
    const errors = validateGovernanceFiles(value);
    for (const error of errors)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
  });

function buildTargetGitConfig(
  target: NonNullable<Awaited<ReturnType<typeof getBuildTargetForOwner>>>
) {
  return {
    repoUrl: target.repoUrl,
    defaultBaseBranch: target.defaultBaseBranch,
    githubTokenEnvVar: target.githubTokenEnvVar,
    protectedBranches: parseJsonStringArray(target.protectedBranchesJson, [
      "main",
      "staging",
    ]),
    agentEnvVarMap: parseAgentEnvVarMap(target.agentEnvVarMapJson),
  };
}

async function createBuildBranchWithIsolatedWorkspace(params: {
  buildTargetId: number;
  ownerUserId: number;
  branchName: string;
  baseBranch: string;
  taskId?: number | null;
}) {
  const branch = await createBuildBranch({
    buildTargetId: params.buildTargetId,
    ownerUserId: params.ownerUserId,
    branchName: params.branchName,
    baseBranch: params.baseBranch,
    workspacePath: getBuildBranchWorkspacePath({
      ownerUserId: params.ownerUserId,
      buildTargetId: params.buildTargetId,
      branchId: 0,
      branchName: params.branchName,
    }),
    taskId: params.taskId ?? null,
  });
  const workspacePath = getBuildBranchWorkspacePath({
    ownerUserId: params.ownerUserId,
    buildTargetId: params.buildTargetId,
    branchId: branch.id,
    branchName: params.branchName,
  });
  const updated = await updateBuildBranchWorkspacePath({
    branchId: branch.id,
    ownerUserId: params.ownerUserId,
    workspacePath,
  });
  return updated ?? { ...branch, workspacePath };
}

async function pushOwnedBuildBranch(branchId: number, ownerUserId: number) {
  const branch = await getBuildBranchForOwner(branchId, ownerUserId);
  if (!branch)
    throw new Error(
      "Build Branch not found or not owned by the authenticated user"
    );
  const target = await getBuildTargetForOwner(
    branch.buildTargetId,
    ownerUserId
  );
  if (!target)
    throw new Error("Project not found or not owned by the authenticated user");
  await updateBuildBranchPushState({
    branchId: branch.id,
    ownerUserId,
    pushState: "pushing",
    lastPushedCommit: branch.lastPushedCommit ?? null,
    lastPushError: null,
  });
  const result = await pushBranch({
    workspacePath: branch.workspacePath,
    branchName: branch.branchName,
    target: buildTargetGitConfig(target),
  });
  const updated = await updateBuildBranchPushState({
    branchId: branch.id,
    ownerUserId,
    pushState: result.pushState,
    lastPushedCommit: result.pushedCommit ?? null,
    lastPushError: result.errorMessage ?? null,
  });
  return {
    branch: updated,
    result,
    pushState: result.pushState,
    pushedCommit: result.pushedCommit ?? null,
    errorMessage: result.errorMessage ?? null,
  };
}

const routeModes = ["auto", "claude", "kimi", "dual"] as const;

const skillScopes = [
  "global",
  "task-type",
  "file-pattern",
  "manual-only",
] as const;
const skillSources = [
  "created",
  "uploaded",
  "official",
  "github_imported",
  "ai_built",
] as const;
const skillTaskTypes = [
  "code-write",
  "refactor",
  "test-write",
  "planning",
  "review",
  "other",
] as const;
const semverPattern = /^\d+\.\d+\.\d+$/;
const sourceMetadataSchema = z
  .record(z.string(), z.unknown())
  .nullable()
  .optional();
const skillCreateSchema = z.object({
  slug: z.string().trim().min(1).max(160).optional(),
  name: z.string().trim().min(1).max(220),
  scope: z.enum(skillScopes).default("manual-only"),
  content: z.string().trim().min(1).max(50000),
  taskTypes: z.array(z.enum(skillTaskTypes)).default([]),
  filePatterns: z.array(z.string().trim().min(1).max(300)).default([]),
  enabled: z.boolean().default(true),
  version: z
    .string()
    .trim()
    .regex(semverPattern, "Use semantic version format such as 1.0.0")
    .default("1.0.0"),
  description: z.string().trim().max(1000).nullable().optional(),
  source: z.enum(skillSources).default("created"),
  sourceMetadata: sourceMetadataSchema,
});
const skillUpdateSchema = skillCreateSchema.partial().extend({
  skillId: z.number().int().positive(),
  isOfficial: z.boolean().optional(),
});
const skillBuilderSystemPrompt = `You are helping a non-technical owner create a Skill for their AI build
runner. Skills are short instruction packages that augment AI behavior on
tasks.

Ask the owner three to six short questions in plain English to understand:
1. What behavior they want the AI to follow (described in their own words)
2. When the skill should apply: every task / certain kinds of tasks /
   certain files / only when manually picked
3. What the skill should be called

Use friendly tone. Avoid jargon. After gathering enough info, draft the
skill and show the owner the final markdown content. Ask "Save this
skill?" — if yes, return the structured JSON below. If they want changes,
revise and re-show.

Final return format (JSON only):
{
  "slug": "kebab-case-slug",
  "name": "Friendly Name",
  "description": "One paragraph",
  "scope": "global" | "task-type" | "file-pattern" | "manual-only",
  "taskTypes": [...],   // only if scope = task-type
  "filePatterns": [...], // only if scope = file-pattern
  "content": "<skill body in markdown>"
}`;
const githubPreviewSkillSchema = z.object({
  id: z.string().min(1),
  filePath: z.string().min(1),
  commitSha: z.string().nullable().optional(),
  skill: skillCreateSchema,
});
function serializeSkill(skill: any) {
  return {
    ...skill,
    taskTypes: parseSkillJsonArray(skill.taskTypesJson),
    filePatterns: parseSkillJsonArray(skill.filePatternsJson),
    sourceMetadata: parseSkillMetadata(skill.sourceMetadataJson),
  };
}
function slugifySkillImport(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "skill"
  );
}
function parseYamlScalar(raw: string): unknown {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  )
    return trimmed.slice(1, -1);
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed.startsWith("[") && trimmed.endsWith("]"))
    return trimmed
      .slice(1, -1)
      .split(",")
      .map(item => parseYamlScalar(item))
      .filter(Boolean);
  return trimmed;
}
function parseSkillFrontmatter(
  text: string,
  filename: string,
  source: SkillSource
): z.infer<typeof skillCreateSchema> {
  const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match)
    throw new Error(`upload-error: missing YAML frontmatter in '${filename}'`);
  const [, yaml, body] = match;
  const data: Record<string, unknown> = {};
  let currentListKey: string | null = null;
  for (const rawLine of yaml.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const listItem = line.match(/^\s*-\s*(.+)$/);
    if (listItem && currentListKey) {
      const existing = Array.isArray(data[currentListKey])
        ? (data[currentListKey] as unknown[])
        : [];
      data[currentListKey] = [...existing, parseYamlScalar(listItem[1])];
      continue;
    }
    const keyValue = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!keyValue) continue;
    const [, key, value] = keyValue;
    if (value === "") {
      data[key] = [];
      currentListKey = key;
    } else {
      data[key] = parseYamlScalar(value);
      currentListKey = null;
    }
  }
  const name = typeof data.name === "string" ? data.name.trim() : "";
  if (!name)
    throw new Error(
      `upload-error: missing required field 'name' in '${filename}'`
    );
  const parsed = skillCreateSchema.parse({
    slug:
      typeof data.slug === "string" && data.slug.trim()
        ? slugifySkillImport(data.slug)
        : slugifySkillImport(name),
    name,
    description: typeof data.description === "string" ? data.description : null,
    scope: typeof data.scope === "string" ? data.scope : "manual-only",
    taskTypes: Array.isArray(data.taskTypes) ? data.taskTypes : [],
    filePatterns: Array.isArray(data.filePatterns) ? data.filePatterns : [],
    content: body.trim(),
    enabled: typeof data.enabled === "boolean" ? data.enabled : true,
    version: typeof data.version === "string" ? data.version : "1.0.0",
    source,
  });
  if (!parsed.content)
    throw new Error(`upload-error: missing skill body in '${filename}'`);
  return parsed;
}
function parseGitHubRepoUrl(repoUrl: string) {
  const match = repoUrl
    .trim()
    .match(
      /^https?:\/\/github\.com\/([^/\s]+)\/([^/\s#?]+?)(?:\.git)?(?:[/?#].*)?$/i
    );
  if (!match)
    throw new Error(
      "Enter a GitHub repo URL such as https://github.com/org/repo"
    );
  return { owner: match[1], repo: match[2] };
}
async function githubJson(url: string, token?: string) {
  const response = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      body?.message ?? `GitHub request failed: ${response.status}`
    );
  return body;
}
async function previewGithubSkills(input: {
  repoUrl: string;
  path?: string;
  branch?: string;
  githubToken?: string;
}) {
  const { owner, repo } = parseGitHubRepoUrl(input.repoUrl);
  const repoInfo = (await githubJson(
    `https://api.github.com/repos/${owner}/${repo}`,
    input.githubToken
  )) as { default_branch?: string };
  const branch = input.branch?.trim() || repoInfo.default_branch || "main";
  const tree = (await githubJson(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    input.githubToken
  )) as { tree?: Array<{ path?: string; type?: string; sha?: string }> };
  const normalizedPath = input.path?.replace(/^\/+|\/+$/g, "");
  const files = (tree.tree ?? []).filter(
    entry =>
      entry.type === "blob" &&
      entry.path &&
      /\.(md|skill)$/i.test(entry.path) &&
      (!normalizedPath ||
        entry.path === normalizedPath ||
        entry.path.startsWith(`${normalizedPath}/`))
  );
  const found: Array<{
    id: string;
    filePath: string;
    commitSha: string | null;
    skill: z.infer<typeof skillCreateSchema>;
  }> = [];
  for (const file of files.slice(0, 50)) {
    if (!file.path || !file.sha) continue;
    try {
      const blob = (await githubJson(
        `https://api.github.com/repos/${owner}/${repo}/git/blobs/${file.sha}`,
        input.githubToken
      )) as { content?: string; encoding?: string };
      if (blob.encoding !== "base64" || !blob.content) continue;
      const text = Buffer.from(
        blob.content.replace(/\s/g, ""),
        "base64"
      ).toString("utf8");
      const skill = parseSkillFrontmatter(text, file.path, "github_imported");
      found.push({
        id: file.sha,
        filePath: file.path,
        commitSha: file.sha,
        skill,
      });
    } catch {
      // Invalid skill frontmatter is skipped for GitHub preview; upload surfaces file-level errors.
    }
  }
  return found;
}
async function invokeClaudeSkillBuilder(
  messages: Array<{ role: "user" | "assistant"; content: string }>
) {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (!apiKey) throw new Error("Claude requires CLAUDE_API_KEY on the server.");
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(
      buildClaudeMessagesRequestBody({
        system: skillBuilderSystemPrompt,
        messages,
        model: CLAUDE_DEFAULT_MODEL,
        maxTokens: 4096,
      })
    ),
  });
  const body = (await response.json().catch(() => null)) as {
    content?: Array<{ text?: string }>;
    error?: { message?: string };
  } | null;
  if (!response.ok)
    throw new Error(
      body?.error?.message ?? `Claude request failed: ${response.status}`
    );
  return (body?.content ?? [])
    .map(part => part.text ?? "")
    .join("\n")
    .trim();
}
function extractSkillDraftJson(text: string) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i)?.[1];
  const candidates = [fenced, text.match(/\{[\s\S]*\}/)?.[0]].filter(
    Boolean
  ) as string[];
  for (const candidate of candidates) {
    try {
      return skillCreateSchema.partial().parse(JSON.parse(candidate));
    } catch {
      // Ignore non-final conversational drafts.
    }
  }
  return null;
}

const projectWizardRecommendationSchema = z.object({
  defaultBaseBranch: z.object({
    value: z.string().trim().min(1).max(160),
    confidence: z.enum(["low", "medium", "high"]),
    rationale: z.string().trim().min(1).max(800),
  }),
  branchStrategy: z.object({
    value: z.object({
      initialBuildBranch: z.string().trim().min(1).max(220),
      protectedBranches: z
        .array(z.string().trim().min(1).max(160))
        .min(1)
        .max(12),
    }),
    confidence: z.enum(["low", "medium", "high"]),
    rationale: z.string().trim().min(1).max(800),
  }),
  validationCommands: z.object({
    value: z.array(z.string().trim().min(1).max(240)).min(1).max(8),
    confidence: z.enum(["low", "medium", "high"]),
    rationale: z.string().trim().min(1).max(800),
  }),
  serviceChecks: z.object({
    value: z.array(z.string().trim().min(1).max(240)).max(8),
    confidence: z.enum(["low", "medium", "high"]),
    rationale: z.string().trim().min(1).max(800),
  }),
  projectRuleBooks: z.object({
    value: governanceFilesSchema.default([]),
    confidence: z.enum(["low", "medium", "high"]),
    rationale: z.string().trim().min(1).max(800),
  }),
  environmentVariables: z.object({
    value: agentEnvVarMapSchema.default({}),
    confidence: z.enum(["low", "medium", "high"]),
    rationale: z.string().trim().min(1).max(800),
  }),
});
type ProjectWizardRecommendation = z.infer<
  typeof projectWizardRecommendationSchema
>;

export function parseProjectWizardRecommendation(
  value: unknown
): ProjectWizardRecommendation {
  return projectWizardRecommendationSchema.parse(value);
}

function fallbackProjectWizardRecommendation(
  repoContext: ProjectWizardRepoContext
): ProjectWizardRecommendation {
  const packageManager = repoContext.packageManager ?? "pnpm";
  const hasTests = repoContext.scripts.some(script =>
    /^test(:|$)/.test(script)
  );
  const hasCheck =
    repoContext.scripts.includes("check") ||
    repoContext.scripts.includes("typecheck");
  const checkCommand =
    packageManager +
    " " +
    (repoContext.scripts.includes("check") ? "check" : "typecheck");
  const buildCommand = packageManager + " build";
  const testCommand = packageManager + " test";
  const validationCommands = [
    hasCheck ? checkCommand : buildCommand,
    hasTests ? testCommand : buildCommand,
  ].filter((value, index, array) => array.indexOf(value) === index);
  return {
    defaultBaseBranch: {
      value: repoContext.defaultBranch,
      confidence: "medium",
      rationale:
        "Detected from the repository default branch during read-only Project analysis.",
    },
    branchStrategy: {
      value: {
        initialBuildBranch: "portal-wizard-setup",
        protectedBranches: [repoContext.defaultBranch, "staging"].filter(
          (value, index, array) => value && array.indexOf(value) === index
        ),
      },
      confidence: "medium",
      rationale:
        "Keeps the default branch protected and starts agent work on a separate Build Branch.",
    },
    validationCommands: {
      value: validationCommands.length
        ? validationCommands
        : ["pnpm check", "pnpm test", "pnpm build"],
      confidence: "medium",
      rationale:
        "Derived from package scripts when available, with conservative build/test fallbacks.",
    },
    serviceChecks: {
      value: [],
      confidence: "low",
      rationale:
        "No reliable service health endpoint was detected automatically; add one if the Project exposes a local health check.",
    },
    projectRuleBooks: {
      value: [],
      confidence: "low",
      rationale:
        "No authoritative Project rule books were detected. Leaving this empty is safe; add docs such as CONTRIBUTING.md or architecture notes if they should govern agent work.",
    },
    environmentVariables: {
      value: {},
      confidence: "low",
      rationale:
        "No required runtime variables could be inferred safely. Add mappings only for server-side env vars agents need during Build Branch work.",
    },
  };
}

type ProjectWizardRepoContext = {
  repoUrl: string;
  normalizedRepoUrl: string;
  defaultBranch: string;
  commitSha: string;
  fileCount: number;
  sampledFiles: string[];
  scripts: string[];
  packageManager: "pnpm" | "npm" | "yarn" | null;
  detectedFrameworks: string[];
  ruleBookCandidates: string[];
};

async function walkRepoFiles(
  root: string,
  relative = "",
  acc: string[] = []
): Promise<string[]> {
  if (acc.length >= 500) return acc;
  const entries = await readdir(path.join(root, relative), {
    withFileTypes: true,
  }).catch(() => []);
  for (const entry of entries) {
    if (acc.length >= 500) break;
    if (
      [".git", "node_modules", "dist", "build", ".next", "coverage"].includes(
        entry.name
      )
    )
      continue;
    const next = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) await walkRepoFiles(root, next, acc);
    else acc.push(next);
  }
  return acc;
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

async function buildRepoContext(params: {
  repoUrl: string;
  githubTokenEnvVar: string;
  defaultBaseBranch: string;
  workspacePath: string;
}): Promise<ProjectWizardRepoContext> {
  const normalizedRepoUrl = normalizeGithubRepoUrl(params.repoUrl);
  const authenticatedUrl = resolveAuthenticatedRepoUrl(
    params.repoUrl,
    params.githubTokenEnvVar
  );
  await simpleGit().clone(authenticatedUrl, params.workspacePath, [
    "--depth",
    "1",
    "--branch",
    params.defaultBaseBranch,
    "--single-branch",
  ]);
  const git = simpleGit({
    baseDir: params.workspacePath,
    binary: "git",
    maxConcurrentProcesses: 1,
  });
  const commitSha = (await git.revparse(["HEAD"])).trim();
  const files = await walkRepoFiles(params.workspacePath);
  const pkg = await readJsonFile<{
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  }>(path.join(params.workspacePath, "package.json"));
  const deps = {
    ...(pkg?.dependencies ?? {}),
    ...(pkg?.devDependencies ?? {}),
  };
  const detectedFrameworks = [
    deps.react ? "React" : null,
    deps.vite ? "Vite" : null,
    deps.next ? "Next.js" : null,
    deps.express ? "Express" : null,
    deps["drizzle-orm"] ? "Drizzle" : null,
    deps.vitest ? "Vitest" : null,
  ].filter(Boolean) as string[];
  const ruleBookCandidates = files
    .filter(file =>
      /(^|\/)(README|CONTRIBUTING|AGENTS|CLAUDE|ARCHITECTURE|docs\/.*)(\.(md|mdx|txt))?$/i.test(
        file
      )
    )
    .slice(0, 12);
  const packageManager = files.includes("pnpm-lock.yaml")
    ? "pnpm"
    : files.includes("yarn.lock")
      ? "yarn"
      : files.includes("package-lock.json")
        ? "npm"
        : null;
  return {
    repoUrl: params.repoUrl,
    normalizedRepoUrl,
    defaultBranch: params.defaultBaseBranch,
    commitSha,
    fileCount: files.length,
    sampledFiles: files.slice(0, 120),
    scripts: Object.keys(pkg?.scripts ?? {}),
    packageManager,
    detectedFrameworks,
    ruleBookCandidates,
  };
}

async function withWizardTimeout<T>(
  operation: () => Promise<T>,
  ms = 90_000
): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<T>((_, reject) => {
        timeout = setTimeout(
          () =>
            reject(
              new Error(
                "Project setup wizard analysis exceeded 90 seconds. You can continue waiting or switch to manual setup."
              )
            ),
          ms
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

let hasLoggedProjectWizardModel = false;
function logProjectWizardModelOnce() {
  if (hasLoggedProjectWizardModel) return;
  hasLoggedProjectWizardModel = true;
  console.log(`[wizard] Project analysis model: ${CLAUDE_DEFAULT_MODEL}`);
}

export async function invokeProjectWizardAnalysis(
  repoContext: ProjectWizardRepoContext
): Promise<ProjectWizardRecommendation> {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (!apiKey) return fallbackProjectWizardRecommendation(repoContext);
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(
      buildClaudeMessagesRequestBody({
        system:
          "You are configuring an AI Coding Workshop Project setup wizard. Return only strict JSON matching the requested schema. Use labels Project, Repo URL, Project rule books, and Build Branch. Do not invent files that are not in repoContext.",
        messages: [
          {
            role: "user",
            content: JSON.stringify(
              {
                repoContext,
                requiredCards: [
                  "defaultBaseBranch",
                  "branchStrategy",
                  "validationCommands",
                  "serviceChecks",
                  "projectRuleBooks",
                  "environmentVariables",
                ],
                responseShape:
                  "Return one JSON object with the six required card keys. Each key must contain value, confidence, and rationale.",
              },
              null,
              2
            ),
          },
        ],
        model: CLAUDE_DEFAULT_MODEL,
        maxTokens: 4096,
      })
    ),
  });
  const body = (await response.json().catch(() => null)) as {
    content?: Array<{ text?: string }>;
    error?: { message?: string };
  } | null;
  if (!response.ok)
    throw new Error(
      body?.error?.message ??
        "Claude Project setup analysis failed: " + response.status
    );
  const text = (body?.content ?? [])
    .map(part => part.text ?? "")
    .join("\n")
    .trim();
  const jsonText = text.match(/\\{[\\s\\S]*\\}/)?.[0] ?? text;
  return parseProjectWizardRecommendation(JSON.parse(jsonText));
}

export const projectWizardAnalysisRuntime = {
  invokeProjectWizardAnalysis,
};

const taskStatuses = [
  "active",
  "waiting",
  "blocked",
  "completed",
  "archived",
  "error",
] as const;
const memoryCategories = [
  "decision",
  "feature",
  "research",
  "past_task",
] as const;
const memoryConfidences = ["low", "medium", "high", "verified"] as const;
const credentialProviders = ["claude", "kimi"] as const;
const defaultValidationCommands = [
  "pnpm check",
  "pnpm test",
  "pnpm build",
] as const;

export type CredentialState = {
  provider: CredentialProvider;
  status: CredentialStatus;
  configured: boolean;
  reason: string;
};

export type WrapperRouteDecision = {
  requestedRoute: RouteMode;
  effectiveRoute: RouteMode | "blocked";
  forcedByTag: "#claude" | "#kimi" | null;
  credentialStates: CredentialState[];
  isRunnable: boolean;
  reason: string;
};

export function detectRouteOverride(message: string): {
  route: RouteMode;
  forcedByTag: "#claude" | "#kimi" | null;
  cleanedMessage: string;
} {
  const hasClaude = /(^|\s)#claude(\s|$)/i.test(message);
  const hasKimi = /(^|\s)#kimi(\s|$)/i.test(message);
  const cleanedMessage = message
    .replace(/(^|\s)#(?:claude|kimi)(?=\s|$)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (hasClaude && hasKimi) {
    return { route: "dual", forcedByTag: null, cleanedMessage };
  }
  if (hasClaude) {
    return { route: "claude", forcedByTag: "#claude", cleanedMessage };
  }
  if (hasKimi) {
    return { route: "kimi", forcedByTag: "#kimi", cleanedMessage };
  }
  return { route: "auto", forcedByTag: null, cleanedMessage: message.trim() };
}

export function getRuntimeCredentialStates(): CredentialState[] {
  return getWrapperRuntimeCredentialStates();
}

function providersRequiredForRoute(route: RouteMode): CredentialProvider[] {
  if (route === "claude") return ["claude"];
  if (route === "kimi") return ["kimi"];
  if (route === "dual" || route === "auto") return ["claude", "kimi"];
  return [];
}

function isModelIdentityQuestion(message: string) {
  const normalized = message
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (
    /\bwhat\s+(model|ai|provider)\b/.test(normalized) ||
    /\bwhich\s+(model|ai|provider)\b/.test(normalized) ||
    /\bmodel\s+am\s+i\s+using\b/.test(normalized)
  );
}

function buildAutoBranchName(taskId: number, taskTitle: string) {
  const slug =
    taskTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "task";
  return assertSafeBranchName(`agent-work/task-${taskId}-${slug}`);
}

async function autoWireProjectForTask(params: {
  taskId: number;
  ownerUserId: number;
  buildTargetId?: number | null;
}) {
  await autoAttachRootGlobalFiles(params.taskId, params.ownerUserId);
  if (!params.buildTargetId) return getTaskForOwner(params.taskId, params.ownerUserId);
  const target = await getBuildTargetForOwner(params.buildTargetId, params.ownerUserId);
  if (!target || target.status !== "active") {
    throw new Error("Project not found or not owned by the authenticated user");
  }
  await linkTaskToBuildTarget(params.taskId, params.ownerUserId, target.id);
  const task = await getTaskForOwner(params.taskId, params.ownerUserId);
  if (!task) throw new Error("Task not found after Project auto-wiring");
  if (task.buildBranchId) return task;
  const branch = await createBuildBranchWithIsolatedWorkspace({
    buildTargetId: target.id,
    ownerUserId: params.ownerUserId,
    branchName: buildAutoBranchName(task.id, task.title),
    baseBranch: target.defaultBaseBranch,
    taskId: task.id,
  });
  return linkTaskToBuildBranch(task.id, params.ownerUserId, branch.id);
}

function modelIdentityAnswer(route: RouteMode) {
  if (route === "claude") {
    return `You are using Claude mode: ${CLAUDE_OWNER_MODEL_LABEL} through the Claude API. Internal model id: ${CLAUDE_DEFAULT_MODEL}.`;
  }
  if (route === "kimi") {
    return `You are using Kimi mode: ${KIMI_OWNER_MODEL_LABEL} through Cloudflare Workers AI. Internal model id: ${KIMI_K26_CLOUDFLARE_MODEL}.`;
  }
  return `You are using Auto mode by default. Auto initializes both approved providers on the first submitted task message: ${CLAUDE_OWNER_MODEL_LABEL} through the Claude API and ${KIMI_OWNER_MODEL_LABEL} through Cloudflare Workers AI. Internal ids: ${CLAUDE_DEFAULT_MODEL} and ${KIMI_K26_CLOUDFLARE_MODEL}.`;
}

export async function resolveWrapperRoute(
  message: string,
  preferredRoute: RouteMode = "auto"
): Promise<WrapperRouteDecision> {
  const override = detectRouteOverride(message);
  let requestedRoute =
    override.route === "auto" ? preferredRoute : override.route;
  const credentialStates = getRuntimeCredentialStates();

  // If route is auto and no explicit tag was used, use OpenAI to determine optimal provider
  if (requestedRoute === "auto" && !override.forcedByTag) {
    const decision = await orchestrateWithOpenAI(message);
    const effectiveRoute = resolveEffectiveRoute(
      decision.route,
      credentialStates
    );
    requestedRoute = effectiveRoute;
  }

  const requiredProviders = providersRequiredForRoute(requestedRoute);
  const missing = requiredProviders.filter(
    provider =>
      !credentialStates.find(state => state.provider === provider)?.configured
  );

  if (missing.length > 0) {
    return {
      requestedRoute,
      effectiveRoute: "blocked",
      forcedByTag: override.forcedByTag,
      credentialStates,
      isRunnable: false,
      reason:
        requestedRoute === "auto"
          ? `AUTO first-message initialization requires both Claude Opus 4.7 via the Claude API and Kimi K2.6 via Cloudflare Workers AI. Missing credentials: ${missing.join(", ")}. Task creation alone does not call providers.`
          : `Route ${requestedRoute.toUpperCase()} is unavailable because missing credentials: ${missing.join(", ")}.`,
    };
  }

  return {
    requestedRoute,
    effectiveRoute: requestedRoute,
    forcedByTag: override.forcedByTag,
    credentialStates,
    isRunnable: true,
    reason: `Route ${requestedRoute.toUpperCase()} is credential-ready.`,
  };
}

function serializeJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

async function requireOwnedTask(taskId: number, ownerUserId: number) {
  const task = await getTaskForOwner(taskId, ownerUserId);
  if (!task) {
    throw new Error("Task not found or not owned by the authenticated user");
  }
  return task;
}

async function recordRuntimeCredentialSnapshots(
  ownerUserId: number,
  states: CredentialState[]
) {
  return Promise.all(
    states.map(state =>
      recordCredentialStatus({
        ownerUserId,
        provider: state.provider,
        status: state.status,
        lastErrorCode: state.configured ? null : "MISSING_CREDENTIAL",
        lastErrorMessage: state.configured ? null : state.reason,
      })
    )
  );
}

type OwnedTask =
  Awaited<ReturnType<typeof getTaskForOwner>> extends infer T
    ? NonNullable<T>
    : never;

async function runGenerationTurn(input: {
  task: OwnedTask;
  ownerUserId: number;
  userContent: string;
  selectedRoute: RouteMode;
}) {
  const decision = await resolveWrapperRoute(
    input.userContent,
    input.selectedRoute
  );
  await recordRuntimeCredentialSnapshots(
    input.ownerUserId,
    decision.credentialStates
  );

  if (isModelIdentityQuestion(input.userContent)) {
    await appendTaskEvent({
      taskId: input.task.id,
      ownerUserId: input.ownerUserId,
      actor: "system",
      eventType: "message",
      status: "succeeded",
      content: modelIdentityAnswer(
        decision.requestedRoute === "dual" ? "auto" : input.selectedRoute
      ),
      metadataJson: serializeJson({
        requestedRoute: decision.requestedRoute,
        effectiveRoute: decision.effectiveRoute,
        claudeModel: CLAUDE_DEFAULT_MODEL,
        kimiModel: KIMI_K26_CLOUDFLARE_MODEL,
      }),
    });
    return null;
  }

  const turn = await createTurn({
    taskId: input.task.id,
    ownerUserId: input.ownerUserId,
    route: decision.effectiveRoute,
    state: decision.isRunnable ? "context_assembly" : "blocked",
    credentialStateJson: serializeJson(decision.credentialStates),
    completedAt: decision.isRunnable ? null : Date.now(),
    errorCode: decision.isRunnable ? null : "CREDENTIALS_UNAVAILABLE",
    errorMessage: decision.isRunnable ? null : decision.reason,
  });

  await appendTaskEvent({
    taskId: input.task.id,
    ownerUserId: input.ownerUserId,
    actor: "wrapper",
    eventType: "route_decision",
    status: decision.isRunnable ? "succeeded" : "blocked",
    content: decision.reason,
    metadataJson: serializeJson(decision),
  });

  if (!decision.isRunnable) {
    await updateTaskStatus(input.task.id, input.ownerUserId, "blocked");
    await appendTaskEvent({
      taskId: input.task.id,
      ownerUserId: input.ownerUserId,
      actor: "system",
      eventType: "credential_status",
      status: "blocked",
      content:
        "The AI coordinator did not fall back silently. AUTO first-message initialization requires both Claude Opus 4.7 and Kimi K2.6 credentials; configure the missing server credentials, then retry the task.",
      metadataJson: serializeJson({
        turnId: turn.id,
        credentialStates: decision.credentialStates,
      }),
    });
    return turn;
  }

  const effectiveRoute = decision.effectiveRoute;
  if (effectiveRoute === "blocked" || effectiveRoute === "auto") {
    throw new Error(
      "Wrapper route resolution produced an invalid runnable route."
    );
  }

  const governance: GovernanceLoadResult = await loadGovernanceForTask(input.task.id);
  if (governance.documents.length > 0 || governance.missingRequired.length > 0 || governance.skippedOptional.length > 0) {
    await appendTaskEvent({
      taskId: input.task.id,
      ownerUserId: input.ownerUserId,
      actor: "wrapper",
      eventType: "status",
      status: governance.missingRequired.length > 0 ? "blocked" : "succeeded",
      content:
        governance.missingRequired.length > 0
          ? `Can't start: this project's rule book is missing — ${governance.missingRequired.join(", ")}.`
          : `Loaded rule books for this task: ${governance.documents.length} document(s), ${governance.skippedOptional.length} optional file(s) skipped.`,
      metadataJson: serializeJson({ turnId: turn.id, governance }),
    });

    if (governance.missingRequired.length > 0) {
      await failTurn(
        turn.id,
        input.ownerUserId,
        "GOVERNANCE_REQUIRED_FILES_MISSING",
        `Missing required rule books: ${governance.missingRequired.join(", ")}`,
        "blocked"
      );
      await updateTaskStatus(input.task.id, input.ownerUserId, "blocked");
      return turn;
    }
  }

  const [priorEvents, memory, files] = await Promise.all([
    listTaskEvents(input.task.id, input.ownerUserId, 80),
    listMemoryByCategory(input.ownerUserId, undefined, 20),
    listTaskFiles(input.task.id, input.ownerUserId, 200),
  ]);

  try {
    await executeWrapperTurn({
      task: input.task,
      ownerUserId: input.ownerUserId,
      turnId: turn.id,
      userMessage: input.userContent,
      route: effectiveRoute,
      credentialStates: decision.credentialStates,
      priorEvents,
      memory,
      files,
      governance,
    });
  } catch {
    // executeWrapperTurn already persists the failed turn, task status, and timeline error.
  }
  return turn;
}

async function processQueuedMessagesAfterGeneration(
  task: OwnedTask,
  ownerUserId: number,
  selectedRoute: RouteMode
) {
  for (let batch = 0; batch < 5; batch += 1) {
    const queued = await markQueuedMessagesProcessing(task.id, ownerUserId);
    if (queued.length === 0) return;
    await appendTaskEvent({
      taskId: task.id,
      ownerUserId,
      actor: "system",
      eventType: "status",
      status: "informational",
      content: `Queue processed: ${queued.length} message${queued.length === 1 ? "" : "s"} flushed to agent.`,
      metadataJson: serializeJson({
        queueItemIds: queued.map(item => item.id),
      }),
    });
    const queuedContent = formatQueuedMessagesForGeneration(queued);
    await appendTaskEvent({
      taskId: task.id,
      ownerUserId,
      actor: "user",
      eventType: "message",
      status: "succeeded",
      content: queuedContent,
      metadataJson: serializeJson({
        queued: true,
        queueItemIds: queued.map(item => item.id),
      }),
    });
    await runGenerationTurn({
      task,
      ownerUserId,
      userContent: queuedContent,
      selectedRoute,
    });
    await markQueuedMessagesSent(
      task.id,
      ownerUserId,
      queued.map(item => item.id)
    );
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  tasks: router({
    create: protectedProcedure
      .input(
        z.object({
          title: z.string().trim().min(1).max(220),
          summary: z.string().trim().max(12000).optional(),
          routeMode: z.enum(routeModes).default("auto"),
          buildTargetId: z.number().int().positive().nullable().optional(),
          initialMessage: z.string().trim().max(20000).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const task = await createTask({
          ownerUserId: ctx.user.id,
          title: input.title,
          summary: input.summary ?? null,
          routeMode: input.routeMode,
          buildTargetId: input.buildTargetId ?? null,
        });
        const wiredTask = await autoWireProjectForTask({
          taskId: task.id,
          ownerUserId: ctx.user.id,
          buildTargetId: input.buildTargetId ?? null,
        });
        await appendTaskEvent({
          taskId: task.id,
          ownerUserId: ctx.user.id,
          actor: "system",
          eventType: "status",
          status: "informational",
          content:
            "Task record created. Claude Opus 4.7 and Kimi K2.6 are initialized only when the first task message is submitted through the AI coordinator.",
          metadataJson: serializeJson({
            routeMode: input.routeMode,
            buildTargetId: input.buildTargetId ?? null,
            buildBranchId: wiredTask?.buildBranchId ?? null,
          }),
        });

        // Per the v2 decision record, creating a task only creates the task record and a status event.
        // Provider initialization begins when the owner submits a task-thread message through orchestration.submitMessage.

        return getTaskThread(task.id, ctx.user.id);
      }),
    list: protectedProcedure
      .input(
        z
          .object({
            includeArchived: z.boolean().default(false),
            limit: z.number().int().min(1).max(100).default(50),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        return listTasksForOwner(
          ctx.user.id,
          input?.includeArchived ?? false,
          input?.limit ?? 50
        );
      }),
    thread: protectedProcedure
      .input(z.object({ taskId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const thread = await getTaskThread(input.taskId, ctx.user.id);
        if (!thread)
          throw new Error(
            "Task not found or not owned by the authenticated user"
          );
        return thread;
      }),
    events: protectedProcedure
      .input(
        z.object({
          taskId: z.number().int().positive(),
          limit: z.number().int().min(1).max(300).default(100),
        })
      )
      .query(async ({ ctx, input }) => {
        await requireOwnedTask(input.taskId, ctx.user.id);
        return listTaskEvents(input.taskId, ctx.user.id, input.limit);
      }),
    rename: protectedProcedure
      .input(
        z.object({
          taskId: z.number().int().positive(),
          title: z.string().trim().min(1).max(220),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireOwnedTask(input.taskId, ctx.user.id);
        await renameTask(input.taskId, ctx.user.id, input.title);
        return getTaskThread(input.taskId, ctx.user.id);
      }),
    updateStatus: protectedProcedure
      .input(
        z.object({
          taskId: z.number().int().positive(),
          status: z.enum(taskStatuses),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireOwnedTask(input.taskId, ctx.user.id);
        await updateTaskStatus(input.taskId, ctx.user.id, input.status);
        await appendTaskEvent({
          taskId: input.taskId,
          ownerUserId: ctx.user.id,
          actor: "system",
          eventType: "status",
          status: "informational",
          content: `Task status changed to ${input.status}.`,
          metadataJson: serializeJson({ status: input.status }),
        });
        return getTaskThread(input.taskId, ctx.user.id);
      }),
  }),
  orchestration: router({
    submitMessage: protectedProcedure
      .input(
        z.object({
          taskId: z.number().int().positive(),
          message: z.string().trim().min(1).max(20000),
          routeMode: z.enum(routeModes).default("auto"),
          buildBranchId: z.number().int().positive().nullable().optional(),
          buildTargetId: z.number().int().positive().nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        let task = await requireOwnedTask(input.taskId, ctx.user.id);
        task = (await autoWireProjectForTask({
          taskId: task.id,
          ownerUserId: ctx.user.id,
          buildTargetId: input.buildTargetId ?? task.buildTargetId ?? null,
        })) ?? task;
        const override = detectRouteOverride(input.message);
        const userContent = override.cleanedMessage || input.message.trim();
        const selectedRoute = input.routeMode ?? (task.routeMode as RouteMode);
        const existingThread = await getTaskThread(task.id, ctx.user.id);
        if (existingThread?.activeTurn) {
          const queued = await enqueueTaskMessage({
            taskId: task.id,
            ownerUserId: ctx.user.id,
            content: input.message.trim(),
          });
          await appendTaskEvent({
            taskId: task.id,
            ownerUserId: ctx.user.id,
            actor: "system",
            eventType: "status",
            status: "informational",
            content: `Owner queued message #${queued.position}.`,
            metadataJson: serializeJson({
              queueItemId: queued.id,
              position: queued.position,
            }),
          });
          return getTaskThread(task.id, ctx.user.id);
        }

        await appendTaskEvent({
          taskId: task.id,
          ownerUserId: ctx.user.id,
          actor: "user",
          eventType: "message",
          status: "succeeded",
          content: userContent,
          metadataJson: serializeJson({
            queued: false,
            routeMode: selectedRoute,
            forcedByTag: override.forcedByTag,
          }),
        });

        await runGenerationTurn({
          task,
          ownerUserId: ctx.user.id,
          userContent,
          selectedRoute,
        });
        await processQueuedMessagesAfterGeneration(
          task,
          ctx.user.id,
          selectedRoute
        );
        return getTaskThread(task.id, ctx.user.id);
      }),
    updateQueuedMessage: protectedProcedure
      .input(
        z.object({
          taskId: z.number().int().positive(),
          queueItemId: z.number().int().positive(),
          content: z.string().trim().min(1).max(20000),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireOwnedTask(input.taskId, ctx.user.id);
        await updateQueuedTaskMessage({
          taskId: input.taskId,
          ownerUserId: ctx.user.id,
          queueItemId: input.queueItemId,
          content: input.content,
        });
        return getTaskThread(input.taskId, ctx.user.id);
      }),
    clearQueuedMessage: protectedProcedure
      .input(
        z.object({
          taskId: z.number().int().positive(),
          queueItemId: z.number().int().positive(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireOwnedTask(input.taskId, ctx.user.id);
        await cancelQueuedTaskMessage({
          taskId: input.taskId,
          ownerUserId: ctx.user.id,
          queueItemId: input.queueItemId,
        });
        return getTaskThread(input.taskId, ctx.user.id);
      }),
    stopGeneration: protectedProcedure
      .input(
        z.object({
          taskId: z.number().int().positive(),
          turnId: z.number().int().positive(),
          activeOperation: z.string().trim().max(240).nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireOwnedTask(input.taskId, ctx.user.id);
        const stop = requestTurnStop({
          taskId: input.taskId,
          ownerUserId: ctx.user.id,
          turnId: input.turnId,
          activeOperation: input.activeOperation ?? null,
        });
        await appendTaskEvent({
          taskId: input.taskId,
          ownerUserId: ctx.user.id,
          actor: "system",
          eventType: "status",
          status: "informational",
          content: stop.destructiveOperation
            ? `Stop requested. Waiting for ${stop.activeOperation} to finish before halting.`
            : "Stop requested. Generation will halt at the next safe boundary.",
          metadataJson: serializeJson(stop),
        });
        return { success: true, stop } as const;
      }),
    turns: protectedProcedure
      .input(
        z.object({
          taskId: z.number().int().positive(),
          limit: z.number().int().min(1).max(100).default(20),
        })
      )
      .query(async ({ ctx, input }) => {
        await requireOwnedTask(input.taskId, ctx.user.id);
        return listTurnsForTask(input.taskId, ctx.user.id, input.limit);
      }),
    failTurn: protectedProcedure
      .input(
        z.object({
          turnId: z.number().int().positive(),
          taskId: z.number().int().positive(),
          errorCode: z.string().trim().min(1).max(120),
          errorMessage: z.string().trim().min(1).max(8000),
          blocked: z.boolean().default(false),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireOwnedTask(input.taskId, ctx.user.id);
        await failTurn(
          input.turnId,
          ctx.user.id,
          input.errorCode,
          input.errorMessage,
          input.blocked ? "blocked" : "failed"
        );
        await updateTaskStatus(
          input.taskId,
          ctx.user.id,
          input.blocked ? "blocked" : "error"
        );
        return { success: true } as const;
      }),
  }),
  memory: router({
    create: protectedProcedure
      .input(
        z.object({
          category: z.enum(memoryCategories),
          title: z.string().trim().min(1).max(220),
          content: z.string().trim().min(1).max(20000),
          sourceTaskId: z.number().int().positive().nullable().optional(),
          confidence: z.enum(memoryConfidences).default("medium"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (input.sourceTaskId)
          await requireOwnedTask(input.sourceTaskId, ctx.user.id);
        return createMemory({
          ownerUserId: ctx.user.id,
          category: input.category as MemoryCategory,
          title: input.title,
          content: input.content,
          sourceTaskId: input.sourceTaskId ?? null,
          confidence: input.confidence,
        });
      }),
    list: protectedProcedure
      .input(
        z
          .object({
            category: z.enum(memoryCategories).optional(),
            limit: z.number().int().min(1).max(100).default(50),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        return listMemoryByCategory(
          ctx.user.id,
          input?.category as MemoryCategory | undefined,
          input?.limit ?? 50
        );
      }),
    search: protectedProcedure
      .input(
        z.object({
          query: z.string().trim().max(400).default(""),
          limit: z.number().int().min(1).max(100).default(30),
        })
      )
      .query(async ({ ctx, input }) => {
        return searchMemory(ctx.user.id, input.query, input.limit);
      }),
  }),

  buildTarget: router({
    list: protectedProcedure
      .input(
        z
          .object({
            includeArchived: z.boolean().default(false),
            limit: z.number().int().min(1).max(100).default(50),
          })
          .optional()
      )
      .query(async ({ ctx, input }) =>
        listBuildTargetsForOwner(
          ctx.user.id,
          input?.includeArchived ?? false,
          input?.limit ?? 50
        )
      ),
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().trim().min(1).max(220),
          repoUrl: z.string().trim().url().max(1024),
          githubTokenEnvVar: z.string().trim().min(1).max(120),
          defaultBaseBranch: z.string().trim().min(1).max(160).default("main"),
          protectedBranches: z
            .array(z.string().trim().min(1).max(160))
            .optional(),
          validationCommands: z
            .array(z.string().trim().min(1).max(240))
            .optional(),
          serviceChecks: z.array(z.string().trim().min(1).max(240)).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const connection = await testBuildTargetConnection({
          repoUrl: input.repoUrl,
          githubTokenEnvVar: input.githubTokenEnvVar,
          defaultBaseBranch: input.defaultBaseBranch,
        });
        if (connection.status !== "ok") throw new Error(connection.message);
        return createBuildTarget({ ...input, ownerUserId: ctx.user.id });
      }),
    update: protectedProcedure
      .input(
        z.object({
          targetId: z.number().int().positive(),
          name: z.string().trim().min(1).max(220).optional(),
          defaultBaseBranch: z.string().trim().min(1).max(160).optional(),
          protectedBranches: z
            .array(z.string().trim().min(1).max(160))
            .optional(),
          validationCommands: z
            .array(z.string().trim().min(1).max(240))
            .optional(),
          serviceChecks: z.array(z.string().trim().min(1).max(240)).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const target = await getBuildTargetForOwner(
          input.targetId,
          ctx.user.id
        );
        if (!target)
          throw new Error(
            "Project not found or not owned by the authenticated user"
          );
        return updateBuildTarget({ ...input, ownerUserId: ctx.user.id });
      }),
    updateSettings: protectedProcedure
      .input(
        z.object({
          targetId: z.number().int().positive(),
          agentEnvVarMap: agentEnvVarMapSchema.optional(),
          governanceFiles: governanceFilesSchema.optional(),
          governanceBudgetEnforced: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const target = await getBuildTargetForOwner(
          input.targetId,
          ctx.user.id
        );
        if (!target)
          throw new Error(
            "Project not found or not owned by the authenticated user"
          );
        if (
          input.governanceFiles !== undefined ||
          input.governanceBudgetEnforced !== undefined
        ) {
          return updateBuildTarget({
            targetId: input.targetId,
            ownerUserId: ctx.user.id,
            agentEnvVarMap: input.agentEnvVarMap,
            governanceFiles: input.governanceFiles,
            governanceBudgetEnforced: input.governanceBudgetEnforced,
          });
        }
        return updateBuildTargetEnvMap({
          targetId: input.targetId,
          ownerUserId: ctx.user.id,
          agentEnvVarMap: input.agentEnvVarMap ?? {},
        });
      }),
    delete: protectedProcedure
      .input(
        z.object({
          targetId: z.number().int().positive(),
          confirm: z.literal("DELETE"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const branches = await listBuildBranchesForTarget(
          input.targetId,
          ctx.user.id,
          100
        );
        for (const branch of branches)
          await cleanupWorkspace(branch.workspacePath).catch(() => undefined);
        await archiveBuildTarget(input.targetId, ctx.user.id);
        return { archived: true };
      }),
    testConnection: protectedProcedure
      .input(
        z.object({
          repoUrl: z.string().trim().url().max(1024),
          githubTokenEnvVar: z.string().trim().min(1).max(120),
          defaultBaseBranch: z.string().trim().min(1).max(160).default("main"),
        })
      )
      .mutation(async ({ input }) => testBuildTargetConnection(input)),
    get: protectedProcedure
      .input(z.object({ targetId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const target = await getBuildTargetForOwner(
          input.targetId,
          ctx.user.id
        );
        if (!target)
          throw new Error(
            "Project not found or not owned by the authenticated user"
          );
        const branches = await listBuildBranchesForTarget(
          input.targetId,
          ctx.user.id,
          100
        );
        return { target, branches };
      }),
  }),

  skills: router({
    aiDraft: protectedProcedure
      .input(
        z.object({
          messages: z
            .array(
              z.object({
                role: z.enum(["user", "assistant"]),
                content: z.string().trim().min(1).max(8000),
              })
            )
            .min(1)
            .max(20),
        })
      )
      .mutation(async ({ input }) => {
        const content = await invokeClaudeSkillBuilder(input.messages);
        return { content, draft: extractSkillDraftJson(content) };
      }),
    previewGithubImport: protectedProcedure
      .input(
        z.object({
          repoUrl: z.string().trim().url().max(1024),
          path: z.string().trim().max(1024).optional(),
          branch: z.string().trim().max(160).optional(),
          githubToken: z.string().trim().max(500).optional(),
        })
      )
      .mutation(async ({ input }) => ({
        skills: await previewGithubSkills(input),
      })),
    importGithubSelected: protectedProcedure
      .input(
        z.object({
          repoUrl: z.string().trim().url().max(1024),
          path: z.string().trim().max(1024).optional(),
          branch: z.string().trim().max(160).optional(),
          selected: z.array(githubPreviewSkillSchema).min(1).max(50),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const created = [];
        for (const item of input.selected) {
          let payload = {
            ...item.skill,
            source: "github_imported" as const,
            sourceMetadata: {
              repoUrl: input.repoUrl,
              sourcePath: item.filePath,
              importedAt: new Date().toISOString(),
              importCommitSha: item.commitSha ?? null,
            },
          };
          const existing = payload.slug
            ? await getSkillBySlugForOwner(payload.slug, ctx.user.id)
            : null;
          if (existing)
            payload = { ...payload, slug: payload.slug + "-" + Date.now() };
          const skill = await createSkill({
            ...payload,
            ownerUserId: ctx.user.id,
            scope: payload.scope as SkillScope,
            source: payload.source as SkillSource,
          });
          created.push(serializeSkill(skill));
        }
        return { created };
      }),
    list: protectedProcedure
      .input(
        z
          .object({
            includeDisabled: z.boolean().default(true),
            includeOfficial: z.boolean().default(true),
            limit: z.number().int().min(1).max(200).default(200),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        const rows = await listSkillsForOwner(
          ctx.user.id,
          input?.includeDisabled ?? true,
          input?.limit ?? 200
        );
        return rows.map(serializeSkill);
      }),
    officialCatalog: protectedProcedure
      .input(
        z
          .object({ limit: z.number().int().min(1).max(200).default(200) })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        const rows = await listOfficialSkills(ctx.user.id, input?.limit ?? 200);
        return rows.map(serializeSkill);
      }),
    get: protectedProcedure
      .input(z.object({ skillId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const skill = await getSkillForOwner(input.skillId, ctx.user.id);
        if (!skill)
          throw new Error("Skill not found or not available to this owner");
        return serializeSkill(skill);
      }),
    create: protectedProcedure
      .input(skillCreateSchema)
      .mutation(async ({ ctx, input }) => {
        const existing = input.slug
          ? await getSkillBySlugForOwner(input.slug, ctx.user.id)
          : undefined;
        if (existing)
          throw new Error(
            `A skill with the slug '${input.slug}' already exists. Choose replace or create as new copy.`
          );
        const skill = await createSkill({
          ...input,
          ownerUserId: ctx.user.id,
          scope: input.scope as SkillScope,
          source: input.source as SkillSource,
        });
        return serializeSkill(skill);
      }),
    replaceBySlug: protectedProcedure
      .input(
        skillCreateSchema.extend({ slug: z.string().trim().min(1).max(160) })
      )
      .mutation(async ({ ctx, input }) => {
        const existing = await getSkillBySlugForOwner(input.slug, ctx.user.id);
        if (!existing) {
          const skill = await createSkill({
            ...input,
            ownerUserId: ctx.user.id,
            scope: input.scope as SkillScope,
            source: input.source as SkillSource,
          });
          return serializeSkill(skill);
        }
        const skill = await updateSkill({
          skillId: existing.id,
          ownerUserId: ctx.user.id,
          name: input.name,
          version: input.version,
          description: input.description,
          content: input.content,
          enabled: input.enabled,
          scope: input.scope as SkillScope,
          taskTypes: input.taskTypes,
          filePatterns: input.filePatterns,
        });
        if (!skill) throw new Error("Skill could not be replaced");
        return serializeSkill(skill);
      }),
    update: protectedProcedure
      .input(skillUpdateSchema)
      .mutation(async ({ ctx, input }) => {
        const skill = await updateSkill({
          ...input,
          ownerUserId: ctx.user.id,
          scope: input.scope as SkillScope | undefined,
        });
        if (!skill)
          throw new Error("Skill not found or not editable by this owner");
        return serializeSkill(skill);
      }),
    setEnabled: protectedProcedure
      .input(
        z.object({ skillId: z.number().int().positive(), enabled: z.boolean() })
      )
      .mutation(async ({ ctx, input }) => {
        const skill = await updateSkill({
          skillId: input.skillId,
          ownerUserId: ctx.user.id,
          enabled: input.enabled,
        });
        if (!skill)
          throw new Error("Skill not found or not editable by this owner");
        return serializeSkill(skill);
      }),
    duplicate: protectedProcedure
      .input(z.object({ skillId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const skill = await duplicateSkill(input.skillId, ctx.user.id);
        if (!skill)
          throw new Error("Skill not found or not available to duplicate");
        return serializeSkill(skill);
      }),
    forkOfficial: protectedProcedure
      .input(z.object({ skillId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const original = await getSkillForOwner(input.skillId, ctx.user.id);
        if (!original || !original.isOfficial)
          throw new Error("Official skill not found");
        const skill = await duplicateSkill(input.skillId, ctx.user.id, {
          source: "official",
          sourceMetadata: {
            officialCatalogId: input.skillId,
            catalogVersion: original.version,
          },
        });
        if (!skill)
          throw new Error("Official skill could not be added to your library");
        return serializeSkill(skill);
      }),
    delete: protectedProcedure
      .input(z.object({ skillId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) =>
        deleteSkill(input.skillId, ctx.user.id)
      ),
    markOfficial: adminProcedure
      .input(
        z.object({
          skillId: z.number().int().positive(),
          isOfficial: z.boolean(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const skill = await updateSkill({
          skillId: input.skillId,
          ownerUserId: ctx.user.id,
          isOfficial: input.isOfficial,
        });
        if (!skill)
          throw new Error(
            "Skill not found or not editable by this admin owner"
          );
        return serializeSkill(skill);
      }),
    listForTask: protectedProcedure
      .input(z.object({ taskId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const task = await getTaskForOwner(input.taskId, ctx.user.id);
        if (!task)
          throw new Error(
            "Task not found or not owned by the authenticated user"
          );
        const files = await listTaskFiles(task.id, ctx.user.id, 200);
        const resolved = await resolveSkillsForTask({
          task,
          ownerUserId: ctx.user.id,
          files,
        });
        const selections = await listTaskSkillSelections(task.id, ctx.user.id);
        return {
          taskType: resolved.taskType,
          taskTypeLabel: taskTypeLabel(resolved.taskType),
          skills: resolved.skills.map(serializeSkill),
          selections,
        };
      }),
    pickForTask: protectedProcedure
      .input(
        z.object({
          taskId: z.number().int().positive(),
          skillId: z.number().int().positive(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const task = await getTaskForOwner(input.taskId, ctx.user.id);
        const skill = await getSkillForOwner(input.skillId, ctx.user.id);
        if (!task || !skill)
          throw new Error("Task or skill not found for this owner");
        return upsertTaskSkillSelection({
          taskId: input.taskId,
          ownerUserId: ctx.user.id,
          skillId: input.skillId,
          state: "picked",
          reason: "Owner picked",
        });
      }),
    removeForTask: protectedProcedure
      .input(
        z.object({
          taskId: z.number().int().positive(),
          skillId: z.number().int().positive(),
          reason: z.string().trim().max(160).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const task = await getTaskForOwner(input.taskId, ctx.user.id);
        const skill = await getSkillForOwner(input.skillId, ctx.user.id);
        if (!task || !skill)
          throw new Error("Task or skill not found for this owner");
        return upsertTaskSkillSelection({
          taskId: input.taskId,
          ownerUserId: ctx.user.id,
          skillId: input.skillId,
          state: "removed",
          reason: input.reason ?? "Owner removed",
        });
      }),
  }),
  buildTargets: router({
    list: protectedProcedure
      .input(
        z
          .object({
            includeArchived: z.boolean().default(false),
            limit: z.number().int().min(1).max(100).default(50),
          })
          .optional()
      )
      .query(async ({ ctx, input }) =>
        listBuildTargetsForOwner(
          ctx.user.id,
          input?.includeArchived ?? false,
          input?.limit ?? 50
        )
      ),
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().trim().min(1).max(220),
          repoUrl: z.string().trim().url().max(1024),
          githubTokenEnvVar: z.string().trim().min(1).max(120),
          defaultBaseBranch: z.string().trim().min(1).max(160).default("main"),
          protectedBranches: z
            .array(z.string().trim().min(1).max(160))
            .optional(),
          validationCommands: z
            .array(z.string().trim().min(1).max(240))
            .optional(),
          serviceChecks: z.array(z.string().trim().min(1).max(240)).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const connection = await testBuildTargetConnection({
          repoUrl: input.repoUrl,
          githubTokenEnvVar: input.githubTokenEnvVar,
          defaultBaseBranch: input.defaultBaseBranch,
        });
        if (connection.status !== "ok") throw new Error(connection.message);
        return createBuildTarget({ ...input, ownerUserId: ctx.user.id });
      }),
    get: protectedProcedure
      .input(z.object({ targetId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const target = await getBuildTargetForOwner(
          input.targetId,
          ctx.user.id
        );
        if (!target)
          throw new Error(
            "Project not found or not owned by the authenticated user"
          );
        const branches = await listBuildBranchesForTarget(
          input.targetId,
          ctx.user.id,
          100
        );
        return { target, branches };
      }),
    updateSettings: protectedProcedure
      .input(
        z.object({
          targetId: z.number().int().positive(),
          agentEnvVarMap: agentEnvVarMapSchema.optional(),
          governanceFiles: governanceFilesSchema.optional(),
          governanceBudgetEnforced: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const target = await getBuildTargetForOwner(
          input.targetId,
          ctx.user.id
        );
        if (!target)
          throw new Error(
            "Project not found or not owned by the authenticated user"
          );
        if (
          input.governanceFiles !== undefined ||
          input.governanceBudgetEnforced !== undefined
        ) {
          return updateBuildTarget({
            targetId: input.targetId,
            ownerUserId: ctx.user.id,
            agentEnvVarMap: input.agentEnvVarMap,
            governanceFiles: input.governanceFiles,
            governanceBudgetEnforced: input.governanceBudgetEnforced,
          });
        }
        return updateBuildTargetEnvMap({
          targetId: input.targetId,
          ownerUserId: ctx.user.id,
          agentEnvVarMap: input.agentEnvVarMap ?? {},
        });
      }),
    testConnection: protectedProcedure
      .input(
        z.object({
          repoUrl: z.string().trim().url().max(1024),
          githubTokenEnvVar: z.string().trim().min(1).max(120),
          defaultBaseBranch: z.string().trim().min(1).max(160).default("main"),
        })
      )
      .mutation(async ({ input }) => testBuildTargetConnection(input)),
    analyzeWizard: protectedProcedure
      .input(
        z.object({
          displayName: z.string().trim().min(1).max(220),
          repoUrl: z.string().trim().url().max(1024),
          githubTokenEnvVar: z.string().trim().min(1).max(120),
          defaultBaseBranch: z.string().trim().min(1).max(160).default("main"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        logProjectWizardModelOnce();
        const connection = await testBuildTargetConnection({
          repoUrl: input.repoUrl,
          githubTokenEnvVar: input.githubTokenEnvVar,
          defaultBaseBranch: input.defaultBaseBranch,
        });
        if (connection.status !== "ok")
          return {
            status: "validation_failed" as const,
            connection,
            fallbackMessage:
              "Setup wizard couldn't complete. Switch to manual setup?",
          };
        const workspacePath = path.join(
          os.tmpdir(),
          "portal-project-wizard",
          "owner-" + ctx.user.id + "-" + Date.now()
        );
        try {
          // §1A-FU-03: The directive's 90-second Project analysis budget is composite for the full
          // repository-context, cache, LLM, and cache-write path, so one timeout wraps the complete path.
          return await withWizardTimeout(async () => {
            await rm(workspacePath, { recursive: true, force: true });
            await mkdir(path.dirname(workspacePath), { recursive: true });
            const repoContext = await buildRepoContext({
              repoUrl: input.repoUrl,
              githubTokenEnvVar: input.githubTokenEnvVar,
              defaultBaseBranch: input.defaultBaseBranch,
              workspacePath,
            });
            const cached = await getValidWizardSessionCache({
              ownerUserId: ctx.user.id,
              repoUrl: repoContext.normalizedRepoUrl,
              commitSha: repoContext.commitSha,
            });
            if (cached)
              return {
                status: "ok" as const,
                cacheStatus: "hit" as const,
                connection,
                repoContext,
                recommendation: parseProjectWizardRecommendation(
                  JSON.parse(cached.recommendationJson)
                ),
                fallbackMessage: null,
              };
            const recommendation =
              await projectWizardAnalysisRuntime.invokeProjectWizardAnalysis(
                repoContext
              );
            await upsertWizardSessionCache({
              ownerUserId: ctx.user.id,
              repoUrl: repoContext.normalizedRepoUrl,
              commitSha: repoContext.commitSha,
              recommendationJson: JSON.stringify(recommendation),
              repoContextJson: JSON.stringify(repoContext),
            });
            return {
              status: "ok" as const,
              cacheStatus: "miss" as const,
              connection,
              repoContext,
              recommendation,
              fallbackMessage: null,
            };
          });
        } catch (error) {
          return {
            status: "analysis_failed" as const,
            connection,
            errorMessage:
              error instanceof Error ? error.message : String(error),
            fallbackMessage:
              "Setup wizard couldn't complete. Switch to manual setup?",
          };
        } finally {
          await rm(workspacePath, { recursive: true, force: true }).catch(
            () => undefined
          );
        }
      }),
    completeWizard: protectedProcedure
      .input(
        z.object({
          displayName: z.string().trim().min(1).max(220),
          repoUrl: z.string().trim().url().max(1024),
          githubTokenEnvVar: z.string().trim().min(1).max(120),
          defaultBaseBranch: z.string().trim().min(1).max(160),
          initialBuildBranch: z
            .string()
            .trim()
            .min(1)
            .max(220)
            .default("agent-work/portal-wizard-setup"),
          protectedBranches: z
            .array(z.string().trim().min(1).max(160))
            .min(1)
            .max(12),
          validationCommands: z
            .array(z.string().trim().min(1).max(240))
            .min(1)
            .max(8),
          serviceChecks: z
            .array(z.string().trim().min(1).max(240))
            .max(8)
            .default([]),
          governanceFiles: governanceFilesSchema.default([]),
          agentEnvVarMap: agentEnvVarMapSchema.default({}),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const connection = await testBuildTargetConnection({
          repoUrl: input.repoUrl,
          githubTokenEnvVar: input.githubTokenEnvVar,
          defaultBaseBranch: input.defaultBaseBranch,
        });
        if (connection.status !== "ok") throw new Error(connection.message);
        const target = await createBuildTarget({
          name: input.displayName,
          repoUrl: input.repoUrl,
          githubTokenEnvVar: input.githubTokenEnvVar,
          defaultBaseBranch: input.defaultBaseBranch,
          protectedBranches: input.protectedBranches,
          validationCommands: input.validationCommands,
          serviceChecks: input.serviceChecks,
          ownerUserId: ctx.user.id,
        });
        const configured = await updateBuildTarget({
          targetId: target.id,
          ownerUserId: ctx.user.id,
          agentEnvVarMap: input.agentEnvVarMap,
          governanceFiles: input.governanceFiles,
          governanceBudgetEnforced: true,
        });
        const branchName = assertSafeBranchName(input.initialBuildBranch);
        const branch = await createBuildBranchWithIsolatedWorkspace({
          buildTargetId: target.id,
          ownerUserId: ctx.user.id,
          branchName,
          baseBranch: input.defaultBaseBranch,
          taskId: null,
        });
        void cloneOrSyncBranch({
          ownerUserId: ctx.user.id,
          buildTargetId: target.id,
          branchId: branch.id,
          branchName,
          baseBranch: input.defaultBaseBranch,
          workspacePath: branch.workspacePath,
          target: {
            repoUrl: input.repoUrl,
            defaultBaseBranch: input.defaultBaseBranch,
            githubTokenEnvVar: input.githubTokenEnvVar,
            protectedBranches: input.protectedBranches,
            agentEnvVarMap: input.agentEnvVarMap,
          },
        })
          .then(result =>
            updateBuildBranchState({
              branchId: branch.id,
              ownerUserId: ctx.user.id,
              state: result.state,
              errorMessage: result.errorMessage ?? null,
              lastSyncedCommit: result.lastSyncedCommit ?? null,
            })
          )
          .catch(error =>
            updateBuildBranchState({
              branchId: branch.id,
              ownerUserId: ctx.user.id,
              state: "error",
              errorMessage:
                error instanceof Error ? error.message : String(error),
              lastSyncedCommit: null,
            })
          );
        return { target: configured ?? target, branch };
      }),
  }),
  buildBranch: router({
    list: protectedProcedure
      .input(
        z.object({
          buildTargetId: z.number().int().positive(),
          limit: z.number().int().min(1).max(100).default(50),
        })
      )
      .query(async ({ ctx, input }) =>
        listBuildBranchesForTarget(
          input.buildTargetId,
          ctx.user.id,
          input.limit
        )
      ),
    create: protectedProcedure
      .input(
        z.object({
          buildTargetId: z.number().int().positive(),
          branchName: z.string().trim().min(1).max(220),
          baseBranch: z.string().trim().min(1).max(160).optional(),
          taskId: z.number().int().positive().nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const target = await getBuildTargetForOwner(
          input.buildTargetId,
          ctx.user.id
        );
        if (!target)
          throw new Error(
            "Project not found or not owned by the authenticated user"
          );
        const branchName = assertSafeBranchName(input.branchName);
        const branch = await createBuildBranchWithIsolatedWorkspace({
          buildTargetId: target.id,
          ownerUserId: ctx.user.id,
          branchName,
          baseBranch: input.baseBranch ?? target.defaultBaseBranch,
          taskId: input.taskId ?? null,
        });
        void cloneOrSyncBranch({
          ownerUserId: ctx.user.id,
          buildTargetId: target.id,
          branchId: branch.id,
          branchName,
          baseBranch: input.baseBranch ?? target.defaultBaseBranch,
          workspacePath: branch.workspacePath,
          target: buildTargetGitConfig(target),
        })
          .then(workspace =>
            updateBuildBranchState({
              branchId: branch.id,
              ownerUserId: ctx.user.id,
              state: workspace.state,
              errorMessage: workspace.errorMessage ?? null,
              lastSyncedCommit: workspace.lastSyncedCommit ?? null,
            })
          )
          .catch(error =>
            updateBuildBranchState({
              branchId: branch.id,
              ownerUserId: ctx.user.id,
              state: "error",
              errorMessage:
                error instanceof Error ? error.message : String(error),
              lastSyncedCommit: null,
            })
          );
        if (input.taskId)
          await linkTaskToBuildBranch(input.taskId, ctx.user.id, branch.id);
        return branch;
      }),
    getStatus: protectedProcedure
      .input(z.object({ branchId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const branch = await getBuildBranchForOwner(
          input.branchId,
          ctx.user.id
        );
        if (!branch)
          throw new Error(
            "Build Branch not found or not owned by the authenticated user"
          );
        if (branch.state !== "clean") return { branch, gitStatus: null };
        return {
          branch,
          gitStatus: await getBuildBranchGitStatus(branch.workspacePath),
        };
      }),
    push: protectedProcedure
      .input(z.object({ branchId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) =>
        pushOwnedBuildBranch(input.branchId, ctx.user.id)
      ),
    delete: protectedProcedure
      .input(
        z.object({
          branchId: z.number().int().positive(),
          confirm: z.literal("DELETE"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const branch = await getBuildBranchForOwner(
          input.branchId,
          ctx.user.id
        );
        if (!branch)
          throw new Error(
            "Build Branch not found or not owned by the authenticated user"
          );
        await cleanupWorkspace(branch.workspacePath);
        await deleteBuildBranch(branch.id, ctx.user.id);
        return { deleted: true };
      }),
  }),
  buildBranches: router({
    list: protectedProcedure
      .input(
        z.object({
          buildTargetId: z.number().int().positive(),
          targetId: z.number().int().positive().optional(),
          limit: z.number().int().min(1).max(100).default(50),
        })
      )
      .query(async ({ ctx, input }) =>
        listBuildBranchesForTarget(
          input.buildTargetId ?? input.targetId!,
          ctx.user.id,
          input.limit
        )
      ),
    create: protectedProcedure
      .input(
        z.object({
          buildTargetId: z.number().int().positive().optional(),
          targetId: z.number().int().positive().optional(),
          branchName: z.string().trim().min(1).max(220),
          baseBranch: z.string().trim().min(1).max(160).optional(),
          taskId: z.number().int().positive().nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const buildTargetId = input.buildTargetId ?? input.targetId;
        if (!buildTargetId) throw new Error("Project is required.");
        const target = await getBuildTargetForOwner(buildTargetId, ctx.user.id);
        if (!target)
          throw new Error(
            "Project not found or not owned by the authenticated user"
          );
        const branchName = assertSafeBranchName(input.branchName);
        const branch = await createBuildBranchWithIsolatedWorkspace({
          buildTargetId: target.id,
          ownerUserId: ctx.user.id,
          branchName,
          baseBranch: input.baseBranch ?? target.defaultBaseBranch,
          taskId: input.taskId ?? null,
        });
        void cloneOrSyncBranch({
          ownerUserId: ctx.user.id,
          buildTargetId: target.id,
          branchId: branch.id,
          branchName,
          baseBranch: input.baseBranch ?? target.defaultBaseBranch,
          workspacePath: branch.workspacePath,
          target: buildTargetGitConfig(target),
        })
          .then(workspace =>
            updateBuildBranchState({
              branchId: branch.id,
              ownerUserId: ctx.user.id,
              state: workspace.state,
              errorMessage: workspace.errorMessage ?? null,
              lastSyncedCommit: workspace.lastSyncedCommit ?? null,
            })
          )
          .catch(error =>
            updateBuildBranchState({
              branchId: branch.id,
              ownerUserId: ctx.user.id,
              state: "error",
              errorMessage:
                error instanceof Error ? error.message : String(error),
              lastSyncedCommit: null,
            })
          );
        if (input.taskId)
          await linkTaskToBuildBranch(input.taskId, ctx.user.id, branch.id);
        return branch;
      }),
    linkTask: protectedProcedure
      .input(
        z.object({
          taskId: z.number().int().positive(),
          branchId: z.number().int().positive().nullable(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireOwnedTask(input.taskId, ctx.user.id);
        if (input.branchId) {
          const branch = await getBuildBranchForOwner(
            input.branchId,
            ctx.user.id
          );
          if (!branch)
            throw new Error(
              "Build Branch not found or not owned by the authenticated user"
            );
        }
        return linkTaskToBuildBranch(input.taskId, ctx.user.id, input.branchId);
      }),
    status: protectedProcedure
      .input(z.object({ branchId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const branch = await getBuildBranchForOwner(
          input.branchId,
          ctx.user.id
        );
        if (!branch)
          throw new Error(
            "Build Branch not found or not owned by the authenticated user"
          );
        if (branch.state !== "clean") return { branch, gitStatus: null };
        return {
          branch,
          gitStatus: await getBuildBranchGitStatus(branch.workspacePath),
        };
      }),
    getStatus: protectedProcedure
      .input(z.object({ branchId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const branch = await getBuildBranchForOwner(
          input.branchId,
          ctx.user.id
        );
        if (!branch)
          throw new Error(
            "Build Branch not found or not owned by the authenticated user"
          );
        if (branch.state !== "clean") return { branch, gitStatus: null };
        return {
          branch,
          gitStatus: await getBuildBranchGitStatus(branch.workspacePath),
        };
      }),
    workspaceTree: protectedProcedure
      .input(
        z.object({
          branchId: z.number().int().positive(),
          relativePath: z.string().trim().max(1024).default(""),
          depth: z.number().int().min(0).max(4).default(2),
        })
      )
      .query(async ({ ctx, input }) => {
        const branch = await getBuildBranchForOwner(
          input.branchId,
          ctx.user.id
        );
        if (!branch)
          throw new Error(
            "Build Branch not found or not owned by the authenticated user"
          );
        if (branch.state !== "clean") return { branch, tree: null };
        return {
          branch,
          tree: await listWorkspaceDirectory(
            branch.workspacePath,
            input.relativePath,
            input.depth
          ),
        };
      }),
    push: protectedProcedure
      .input(z.object({ branchId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) =>
        pushOwnedBuildBranch(input.branchId, ctx.user.id)
      ),
    cleanup: protectedProcedure
      .input(
        z.object({
          branchId: z.number().int().positive(),
          confirm: z.literal("DELETE"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const branch = await getBuildBranchForOwner(
          input.branchId,
          ctx.user.id
        );
        if (!branch)
          throw new Error(
            "Build Branch not found or not owned by the authenticated user"
          );
        await cleanupWorkspace(branch.workspacePath);
        await deleteBuildBranch(branch.id, ctx.user.id);
        return { deleted: true };
      }),
    delete: protectedProcedure
      .input(
        z.object({
          branchId: z.number().int().positive(),
          confirm: z.literal("DELETE"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const branch = await getBuildBranchForOwner(
          input.branchId,
          ctx.user.id
        );
        if (!branch)
          throw new Error(
            "Build Branch not found or not owned by the authenticated user"
          );
        await cleanupWorkspace(branch.workspacePath);
        await deleteBuildBranch(branch.id, ctx.user.id);
        return { deleted: true };
      }),
  }),
  files: router({
    listForTask: protectedProcedure
      .input(
        z.object({
          taskId: z.number().int().positive(),
          limit: z.number().int().min(1).max(400).default(200),
        })
      )
      .query(async ({ ctx, input }) => {
        await requireOwnedTask(input.taskId, ctx.user.id);
        return listTaskFiles(input.taskId, ctx.user.id, input.limit);
      }),
    listAll: protectedProcedure
      .input(
        z
          .object({ limit: z.number().int().min(1).max(800).default(400) })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        return listAllFilesForOwner(ctx.user.id, input?.limit ?? 400);
      }),
    listGlobal: protectedProcedure
      .input(
        z
          .object({ limit: z.number().int().min(1).max(400).default(200) })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        return listGlobalFilesForOwner(ctx.user.id, input?.limit ?? 200);
      }),
    listGlobalForTask: protectedProcedure
      .input(
        z.object({
          taskId: z.number().int().positive(),
          limit: z.number().int().positive().max(500).default(200),
        })
      )
      .query(async ({ ctx, input }) => {
        return listGlobalFileLinksForTask(
          input.taskId,
          ctx.user.id,
          input.limit
        );
      }),
    attachGlobalToTask: protectedProcedure
      .input(
        z.object({
          taskId: z.number().int().positive(),
          globalFileId: z.number().int().positive(),
          attachedLabel: z.string().trim().max(220).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const attached = await attachGlobalFileToTask({
          taskId: input.taskId,
          globalFileId: input.globalFileId,
          ownerUserId: ctx.user.id,
          attachedLabel: input.attachedLabel ?? null,
        });
        await appendTaskEvent({
          taskId: input.taskId,
          ownerUserId: ctx.user.id,
          actor: "system",
          eventType: "file_event",
          status: "succeeded",
          content: `Global file attached to this task: ${attached.file.displayName}`,
          metadataJson: serializeJson({
            globalFileId: attached.file.id,
            linkId: attached.id,
            storageKey: attached.file.storageKey,
          }),
        });
        return attached;
      }),
    detachGlobalFromTask: protectedProcedure
      .input(
        z.object({
          taskId: z.number().int().positive(),
          globalFileId: z.number().int().positive(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const detached = await detachOrDeleteGlobalFileFromTask(
          input.taskId,
          input.globalFileId,
          ctx.user.id
        );
        await appendTaskEvent({
          taskId: input.taskId,
          ownerUserId: ctx.user.id,
          actor: "system",
          eventType: "file_event",
          status: "succeeded",
          content: "Global file detached from this task.",
          metadataJson: serializeJson({
            globalFileId: input.globalFileId,
            linkId: detached.deleted.id,
          }),
        });
        return detached;
      }),
    createMetadata: protectedProcedure
      .input(
        z.object({
          taskId: z.number().int().positive().optional(),
          scope: z.enum(["task", "global"]).default("task"),
          relativePath: z.string().trim().min(1).max(1024),
          storageKey: z.string().trim().min(1).max(2048),
          storageUrl: z.string().trim().min(1).max(2048),
          displayName: z.string().trim().max(220).optional(),
          mimeType: z.string().trim().max(160).nullable().optional(),
          sizeBytes: z.number().int().min(0).default(0),
          version: z.number().int().min(1).default(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const relativePath = assertSafeRelativePath(input.relativePath);
        if (input.scope === "global") {
          return createGlobalFile({
            ownerUserId: ctx.user.id,
            displayName: input.displayName,
            relativePath,
            storageKey: input.storageKey,
            storageUrl: input.storageUrl,
            mimeType: input.mimeType ?? null,
            sizeBytes: input.sizeBytes,
            source: "manual",
            tagsJson: null,
          });
        }
        if (!input.taskId)
          throw new Error(
            "taskId is required when recording task file metadata"
          );
        await requireOwnedTask(input.taskId, ctx.user.id);
        const file = await createTaskFile({
          taskId: input.taskId,
          ownerUserId: ctx.user.id,
          relativePath,
          storageKey: input.storageKey,
          storageUrl: input.storageUrl,
          mimeType: input.mimeType ?? null,
          sizeBytes: input.sizeBytes,
          version: input.version,
        });
        await appendTaskEvent({
          taskId: input.taskId,
          ownerUserId: ctx.user.id,
          actor: "system",
          eventType: "file_event",
          status: "succeeded",
          content: `File metadata recorded: ${relativePath}`,
          metadataJson: serializeJson({
            fileId: file.id,
            storageKey: file.storageKey,
          }),
        });
        return file;
      }),
    get: protectedProcedure
      .input(z.object({ fileId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const file = await getTaskFileForOwner(input.fileId, ctx.user.id);
        if (!file)
          throw new Error(
            "File not found or not owned by the authenticated user"
          );
        return file;
      }),
  }),
  filesystem: router({
    tree: protectedProcedure
      .input(
        z
          .object({
            relativePath: z.string().trim().max(1024).default(""),
            depth: z.number().int().min(0).max(4).default(2),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        const rootPath = await getUserWorkspaceRoot(ctx.user.id);
        return listWorkspaceDirectory(
          rootPath,
          input?.relativePath ?? "",
          input?.depth ?? 2
        );
      }),
    read: protectedProcedure
      .input(z.object({ relativePath: z.string().trim().min(1).max(1024) }))
      .query(async ({ ctx, input }) => {
        const rootPath = await getUserWorkspaceRoot(ctx.user.id);
        return readWorkspaceFile(rootPath, input.relativePath);
      }),
    write: protectedProcedure
      .input(
        z.object({
          taskId: z.number().int().positive().nullable().optional(),
          relativePath: z.string().trim().min(1).max(1024),
          content: z.string().max(1_000_000),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (input.taskId) await requireOwnedTask(input.taskId, ctx.user.id);
        const rootPath = await getUserWorkspaceRoot(ctx.user.id);
        const written = await writeWorkspaceFile(
          rootPath,
          input.relativePath,
          input.content
        );
        if (input.taskId) {
          const snapshot = await snapshotWorkspacePath({
            rootPath,
            workspaceId: input.taskId,
            ownerUserId: ctx.user.id,
            relativePath: written.relativePath,
            action: "update",
          });
          const file = await createTaskFile({
            taskId: input.taskId,
            ownerUserId: ctx.user.id,
            relativePath: written.relativePath,
            storageKey: snapshot.storageKey,
            storageUrl: snapshot.storageUrl,
            mimeType: "text/plain; charset=utf-8",
            sizeBytes: written.size,
            version: 1,
          });
          await appendTaskEvent({
            taskId: input.taskId,
            ownerUserId: ctx.user.id,
            actor: "system",
            eventType: "file_event",
            status: "succeeded",
            content: `Workspace file saved and snapshotted: ${written.relativePath}`,
            metadataJson: serializeJson({
              fileId: file.id,
              storageKey: file.storageKey,
            }),
          });
          return { ...written, file };
        }
        return written;
      }),
    mkdir: protectedProcedure
      .input(z.object({ relativePath: z.string().trim().min(1).max(1024) }))
      .mutation(async ({ ctx, input }) => {
        const rootPath = await getUserWorkspaceRoot(ctx.user.id);
        return createWorkspaceDirectory(rootPath, input.relativePath);
      }),
    rename: protectedProcedure
      .input(
        z.object({
          fromRelativePath: z.string().trim().min(1).max(1024),
          toRelativePath: z.string().trim().min(1).max(1024),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const rootPath = await getUserWorkspaceRoot(ctx.user.id);
        return renameWorkspacePath(
          rootPath,
          input.fromRelativePath,
          input.toRelativePath
        );
      }),
    delete: protectedProcedure
      .input(z.object({ relativePath: z.string().trim().min(1).max(1024) }))
      .mutation(async ({ ctx, input }) => {
        const rootPath = await getUserWorkspaceRoot(ctx.user.id);
        return deleteWorkspacePath(rootPath, input.relativePath);
      }),
    upload: protectedProcedure
      .input(
        z.object({
          taskId: z.number().int().positive().nullable().optional(),
          scope: z.enum(["task", "global"]).default("task"),
          relativePath: z.string().trim().min(1).max(1024),
          base64Content: z.string().min(1),
          mimeType: z.string().trim().max(160).optional(),
          displayName: z.string().trim().max(220).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const isGlobalUpload = input.scope === "global";
        if (!isGlobalUpload && !input.taskId)
          throw new Error("Select a task before uploading to a task folder");
        if (input.taskId) await requireOwnedTask(input.taskId, ctx.user.id);
        if (isGlobalUpload) {
          const relativePath = assertSafeRelativePath(input.relativePath);
          const buffer = Buffer.from(input.base64Content, "base64");
          if (buffer.byteLength > 5 * 1024 * 1024)
            throw new Error("File is too large for the workshop uploader");
          const storage = await storagePut(
            `global-files/user-${ctx.user.id}/${relativePath}`,
            buffer,
            input.mimeType ?? "application/octet-stream"
          );
          const file = await createGlobalFile({
            ownerUserId: ctx.user.id,
            displayName: input.displayName,
            relativePath,
            storageKey: storage.key,
            storageUrl: storage.url,
            mimeType: input.mimeType ?? null,
            sizeBytes: buffer.byteLength,
            source: "upload",
            tagsJson: null,
          });
          return {
            relativePath,
            storageKey: storage.key,
            storageUrl: storage.url,
            size: buffer.byteLength,
            file,
          };
        }
        const rootPath = await getUserWorkspaceRoot(ctx.user.id);
        const uploaded = await uploadWorkspaceFile({
          rootPath,
          workspaceId: input.taskId ?? 0,
          ownerUserId: ctx.user.id,
          relativePath: input.relativePath,
          base64Content: input.base64Content,
          mimeType: input.mimeType,
        });
        if (input.taskId) {
          const file = await createTaskFile({
            taskId: input.taskId,
            ownerUserId: ctx.user.id,
            relativePath: uploaded.relativePath,
            storageKey: uploaded.storageKey,
            storageUrl: uploaded.storageUrl,
            mimeType: input.mimeType ?? null,
            sizeBytes: uploaded.size,
            version: 1,
          });
          await appendTaskEvent({
            taskId: input.taskId,
            ownerUserId: ctx.user.id,
            actor: "system",
            eventType: "file_event",
            status: "succeeded",
            content: `Workspace file uploaded: ${uploaded.relativePath}`,
            metadataJson: serializeJson({
              fileId: file.id,
              storageKey: file.storageKey,
            }),
          });
          return { ...uploaded, file };
        }
        return uploaded;
      }),
    snapshot: protectedProcedure
      .input(
        z.object({
          taskId: z.number().int().positive(),
          relativePath: z.string().trim().max(1024).default(""),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireOwnedTask(input.taskId, ctx.user.id);
        const rootPath = await getUserWorkspaceRoot(ctx.user.id);
        return snapshotWorkspacePath({
          rootPath,
          workspaceId: input.taskId,
          ownerUserId: ctx.user.id,
          relativePath: input.relativePath,
          action: "snapshot",
        });
      }),
  }),
  credentials: router({
    status: protectedProcedure.query(async ({ ctx }) => {
      const runtimeStates = getRuntimeCredentialStates();
      const latestSnapshots = await getLatestCredentialStatuses(
        ctx.user.id
      ).catch(() => []);
      return {
        runtimeStates,
        latestSnapshots,
      };
    }),
    refresh: protectedProcedure
      .input(
        z
          .object({
            providers: z
              .array(z.enum(credentialProviders))
              .default(["claude", "kimi"]),
          })
          .optional()
      )
      .mutation(async ({ ctx, input }) => {
        const selectedProviders = new Set(
          input?.providers ?? credentialProviders
        );
        const states = getRuntimeCredentialStates().filter(state =>
          selectedProviders.has(state.provider)
        );
        const snapshots = await recordRuntimeCredentialSnapshots(
          ctx.user.id,
          states
        );
        return { runtimeStates: states, snapshots };
      }),
  }),
});

export type AppRouter = typeof appRouter;
