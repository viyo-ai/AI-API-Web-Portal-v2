import { eq, and } from "drizzle-orm";
import { promises as fs } from "node:fs";
import path from "node:path";
import { buildBranches, buildTargets, tasks } from "../../drizzle/schema";
import { storageGetSignedUrl } from "../storage";

export type GovernanceFileRole = "governance" | "placeholder_resolver";

export type GovernanceFileConfig = {
  path: string;
  required: boolean;
  dynamic: boolean;
  role: GovernanceFileRole;
  resolverKey?: string;
};

export type GovernanceDocumentSource = "root_default" | "project" | "manual";

export type LoadedGovernanceDocument = {
  path: string;
  resolvedPath: string;
  content: string;
  required: boolean;
  source: GovernanceDocumentSource;
  sourceLabel: string;
};

export type GovernanceLoadResult = {
  documents: LoadedGovernanceDocument[];
  missingRequired: string[];
  skippedOptional: string[];
  loadDurationMs: number;
  targetName?: string;
  budgetEnforcementEnabled: boolean;
};

export type GovernanceBudgetResult = {
  documents: LoadedGovernanceDocument[];
  droppedOptional: string[];
  truncated: string[];
  estimatedTokens: number;
  budgetTokens: number;
  enforcementEnabled: boolean;
};

export const GOVERNANCE_TOKEN_BUDGETS = {
  claude: 180_000,
  kimi: 100_000,
} as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeGovernanceFileConfig(entry: unknown): GovernanceFileConfig | null {
  if (!isObject(entry) || typeof entry.path !== "string") return null;
  const role = entry.role === "placeholder_resolver" ? "placeholder_resolver" : entry.role === "governance" ? "governance" : null;
  if (!role) return null;
  const resolverKey = typeof entry.resolverKey === "string" ? entry.resolverKey.trim() : undefined;
  return {
    path: entry.path.trim(),
    required: Boolean(entry.required),
    dynamic: Boolean(entry.dynamic),
    role,
    resolverKey: resolverKey || undefined,
  };
}

export function parseGovernanceFiles(value: string | null | undefined): GovernanceFileConfig[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeGovernanceFileConfig).filter((entry): entry is GovernanceFileConfig => Boolean(entry));
  } catch {
    return [];
  }
}

export function validateGovernanceFiles(entries: GovernanceFileConfig[]): string[] {
  const errors: string[] = [];
  const resolverKeys = new Set(entries.filter((entry) => entry.role === "placeholder_resolver" && entry.resolverKey).map((entry) => entry.resolverKey as string));

  if (entries.length > 0 && !entries.some((entry) => entry.role === "governance")) {
    errors.push("Project rule books must include at least one rule book document when the list is not empty.");
  }

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const label = `Rule book #${index + 1}`;
    if (!entry.path.trim()) errors.push(`${label} requires a path.`);
    if (path.posix.isAbsolute(entry.path) || entry.path.startsWith("/") || entry.path.includes("..")) {
      errors.push(`${label} path must be relative and must not contain '..'.`);
    }
    if (entry.role === "placeholder_resolver" && !entry.resolverKey?.trim()) {
      errors.push(`${label} requires resolverKey when role is placeholder_resolver.`);
    }
    if (entry.dynamic) {
      const placeholders: string[] = [];
      const placeholderPattern = /\{([A-Za-z0-9_-]+)\}/g;
      let match: RegExpExecArray | null;
      while ((match = placeholderPattern.exec(entry.path)) !== null) {
        placeholders.push(match[1]);
      }
      for (const placeholder of placeholders) {
        if (!resolverKeys.has(placeholder)) {
          errors.push(`${label} uses dynamic placeholder {${placeholder}} without a matching placeholder_resolver resolverKey.`);
        }
      }
    }
  }

  return errors;
}

export function normalizeGovernanceFiles(entries: GovernanceFileConfig[] | undefined): string {
  if (!entries || entries.length === 0) return "[]";
  const normalized = entries.map((entry) => ({
    path: entry.path.trim(),
    required: Boolean(entry.required),
    dynamic: Boolean(entry.dynamic),
    role: entry.role,
    ...(entry.resolverKey?.trim() ? { resolverKey: entry.resolverKey.trim() } : {}),
  }));
  const errors = validateGovernanceFiles(normalized);
  if (errors.length > 0) throw new Error(errors.join(" "));
  return JSON.stringify(normalized);
}

function resolveWorkspacePath(workspacePath: string, relativePath: string) {
  if (!relativePath.trim()) throw new Error("Rule book path is required.");
  if (path.posix.isAbsolute(relativePath) || relativePath.startsWith("/") || relativePath.includes("..")) {
    throw new Error(`Unsafe rule book path: ${relativePath}`);
  }
  const root = path.resolve(workspacePath);
  const absolute = path.resolve(root, relativePath);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Unsafe rule book path: ${relativePath}`);
  }
  return absolute;
}

async function readGovernanceText(workspacePath: string, relativePath: string) {
  const absolute = resolveWorkspacePath(workspacePath, relativePath);
  const content = await fs.readFile(absolute, "utf8");
  return content;
}

function sourceLabel(source: GovernanceDocumentSource) {
  if (source === "root_default") return "Root default";
  if (source === "project") return "Project";
  return "Manual";
}

async function fetchStoredText(storageKey: string) {
  const signedUrl = await storageGetSignedUrl(storageKey);
  const response = await fetch(signedUrl);
  if (!response.ok) {
    throw new Error(`Unable to load root governance Global File (${response.status})`);
  }
  return response.text();
}

async function loadRootGovernanceDocuments(ownerUserId: number): Promise<LoadedGovernanceDocument[]> {
  const { listRootGovernanceGlobalFilesForOwner } = await import("../db");
  const files = await listRootGovernanceGlobalFilesForOwner(ownerUserId);
  const documents: LoadedGovernanceDocument[] = [];
  for (const file of files) {
    documents.push({
      path: file.relativePath,
      resolvedPath: file.relativePath,
      content: await fetchStoredText(file.storageKey),
      required: true,
      source: "root_default" as const,
      sourceLabel: sourceLabel("root_default"),
    });
  }
  return documents;
}

function substituteDynamicPath(entry: GovernanceFileConfig, resolvers: Map<string, string>) {
  let missingResolver = false;
  const resolvedPath = entry.path.replace(/\{([A-Za-z0-9_-]+)\}/g, (_match, key: string) => {
    const value = resolvers.get(key)?.trim();
    if (!value) {
      missingResolver = true;
      return "";
    }
    return value;
  });
  return { resolvedPath, missingResolver };
}

export async function loadGovernanceForTask(taskId: string | number): Promise<GovernanceLoadResult> {
  const startedAt = Date.now();
  const numericTaskId = Number(taskId);
  if (!Number.isInteger(numericTaskId) || numericTaskId <= 0) throw new Error("A valid taskId is required to load governance.");

  const { getDb } = await import("../db");
  const db = await getDb();
  if (!db) throw new Error("Database is required for rule book loading");

  const taskRows = await db.select().from(tasks).where(eq(tasks.id, numericTaskId)).limit(1);
  const task = taskRows[0];
  if (!task) {
    return { documents: [], missingRequired: [`Task ${numericTaskId}`], skippedOptional: [], loadDurationMs: Date.now() - startedAt, budgetEnforcementEnabled: true };
  }

  const rootDocuments = await loadRootGovernanceDocuments(task.ownerUserId);
  if (!task.buildBranchId) {
    return { documents: rootDocuments, missingRequired: [], skippedOptional: [], loadDurationMs: Date.now() - startedAt, budgetEnforcementEnabled: true };
  }

  const branchRows = await db
    .select()
    .from(buildBranches)
    .where(and(eq(buildBranches.id, task.buildBranchId), eq(buildBranches.ownerUserId, task.ownerUserId)))
    .limit(1);
  const branch = branchRows[0];
  if (!branch) {
    return { documents: [], missingRequired: [`Build Branch ${task.buildBranchId}`], skippedOptional: [], loadDurationMs: Date.now() - startedAt, budgetEnforcementEnabled: true };
  }

  const targetRows = await db
    .select()
    .from(buildTargets)
    .where(and(eq(buildTargets.id, branch.buildTargetId), eq(buildTargets.ownerUserId, task.ownerUserId)))
    .limit(1);
  const target = targetRows[0];
  if (!target) {
    return { documents: [], missingRequired: [`Project ${branch.buildTargetId}`], skippedOptional: [], loadDurationMs: Date.now() - startedAt, budgetEnforcementEnabled: true };
  }

  const config = parseGovernanceFiles(target.governanceFilesJson);
  if (config.length === 0) {
    return { documents: rootDocuments, missingRequired: [], skippedOptional: [], loadDurationMs: Date.now() - startedAt, targetName: target.name, budgetEnforcementEnabled: target.governanceBudgetEnforced !== false };
  }

  const resolvers = new Map<string, string>();
  for (const entry of config) {
    if (entry.role !== "placeholder_resolver" || !entry.resolverKey) continue;
    try {
      const content = await readGovernanceText(branch.workspacePath, entry.path);
      resolvers.set(entry.resolverKey, content.trim());
    } catch {
      if (entry.required) {
        // Required resolver files are represented by their configured path so owners know what to commit.
        resolvers.delete(entry.resolverKey);
      }
    }
  }

  const documents: LoadedGovernanceDocument[] = [...rootDocuments];
  const missingRequired: string[] = [];
  const skippedOptional: string[] = [];

  for (const entry of config) {
    if (entry.role !== "governance") continue;
    const { resolvedPath, missingResolver } = entry.dynamic ? substituteDynamicPath(entry, resolvers) : { resolvedPath: entry.path, missingResolver: false };
    if (missingResolver) {
      if (entry.required) missingRequired.push(entry.path);
      else skippedOptional.push(entry.path);
      continue;
    }
    try {
      const content = await readGovernanceText(branch.workspacePath, resolvedPath);
      documents.push({
        path: entry.path,
        resolvedPath,
        content,
        required: entry.required,
        source: "project",
        sourceLabel: sourceLabel("project"),
      });
    } catch {
      if (entry.required) missingRequired.push(resolvedPath || entry.path);
      else skippedOptional.push(resolvedPath || entry.path);
    }
  }

  return {
    documents,
    missingRequired,
    skippedOptional,
    loadDurationMs: Date.now() - startedAt,
    targetName: target.name,
    budgetEnforcementEnabled: target.governanceBudgetEnforced !== false,
  };
}

function estimateTokensForDocuments(documents: LoadedGovernanceDocument[]) {
  return Math.ceil(documents.reduce((sum, document) => sum + document.content.length, 0) / 4);
}

function truncateDocumentToBudget(document: LoadedGovernanceDocument, availableTokens: number): LoadedGovernanceDocument {
  const footer = `\n\n[truncated by portal — source: ${document.sourceLabel}; full file at ${document.resolvedPath}]`;
  const availableChars = Math.max(0, availableTokens * 4 - footer.length);
  const eightyPercentChars = Math.floor(document.content.length * 0.8);
  const targetChars = Math.max(0, Math.min(eightyPercentChars, availableChars));
  return { ...document, content: `${document.content.slice(0, targetChars)}${footer}` };
}

export function enforceGovernanceBudget(input: {
  documents: LoadedGovernanceDocument[];
  provider: "claude" | "kimi";
  enforcementEnabled: boolean;
  budgetTokens?: number;
}): GovernanceBudgetResult {
  const budgetTokens = input.budgetTokens ?? GOVERNANCE_TOKEN_BUDGETS[input.provider];
  if (!input.enforcementEnabled) {
    return {
      documents: input.documents,
      droppedOptional: [],
      truncated: [],
      estimatedTokens: estimateTokensForDocuments(input.documents),
      budgetTokens,
      enforcementEnabled: false,
    };
  }

  const documents = [...input.documents];
  const droppedOptional: string[] = [];
  const truncated: string[] = [];

  while (estimateTokensForDocuments(documents) > budgetTokens) {
    const dropIndex = documents.map((document, index) => ({ document, index })).reverse().find((item) => !item.document.required)?.index;
    if (dropIndex === undefined) break;
    const [dropped] = documents.splice(dropIndex, 1);
    droppedOptional.push(`${dropped.sourceLabel}: ${dropped.resolvedPath}`);
  }

  while (estimateTokensForDocuments(documents) > budgetTokens && documents.length > 0) {
    const largest = documents.reduce((best, document, index) => (document.content.length > documents[best].content.length ? index : best), 0);
    const otherTokens = estimateTokensForDocuments(documents.filter((_, index) => index !== largest));
    const availableTokens = Math.max(1, budgetTokens - otherTokens);
    const originalPath = `${documents[largest].sourceLabel}: ${documents[largest].resolvedPath}`;
    documents[largest] = truncateDocumentToBudget(documents[largest], availableTokens);
    truncated.push(originalPath);
    if (estimateTokensForDocuments(documents) <= budgetTokens) break;
    if (availableTokens <= 1) break;
  }

  return {
    documents,
    droppedOptional,
    truncated,
    estimatedTokens: estimateTokensForDocuments(documents),
    budgetTokens,
    enforcementEnabled: true,
  };
}

export function renderGovernanceBlock(input: { targetName?: string; documents: LoadedGovernanceDocument[] }) {
  if (input.documents.length === 0) return "";
  const targetLine = input.targetName ? `You are operating inside the ${input.targetName} build pipeline.` : "You are operating inside the configured build pipeline.";
  const documents = input.documents
    .map((document) => `=== ${document.path} [source: ${document.sourceLabel}] ===\n${document.content}`)
    .join("\n\n");
  return `${targetLine}\n\nThe following rule book documents are authoritative for this task. Read them\nin order before responding to the task instruction. Treat any conflict between\nyour prior knowledge and these documents as resolved by the documents.\n\n${documents}\n\nHard rules:\n- Do not modify any of the rule book documents listed above\n- Out-of-scope work is logged, not done; use the file the project's governance designates for gap logging\n- Conventional commits with task ID\n- Run validation before claiming complete`;
}
