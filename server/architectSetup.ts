export type ArchitectSetupFields = {
  displayName: string;
  repoUrl: string;
  githubTokenEnvVar: string;
  defaultBaseBranch: string;
};

export type ArchitectSetupDraft = Partial<ArchitectSetupFields>;

export type ArchitectSetupState = {
  taskId: number;
  ownerUserId: number;
  fields: ArchitectSetupDraft;
  connectionStatus: "untested" | "ok" | "failed";
  connectionMessage?: string;
  awaitingConfirmation: boolean;
  updatedAt: number;
};

const SETUP_STATES = new Map<string, ArchitectSetupState>();
const STATE_TTL_MS = 60 * 60 * 1000;

function stateKey(ownerUserId: number, taskId: number) {
  return `${ownerUserId}:${taskId}`;
}

function nowMs() {
  return Date.now();
}

export function getArchitectSetupState(ownerUserId: number, taskId: number) {
  const key = stateKey(ownerUserId, taskId);
  const state = SETUP_STATES.get(key);
  if (!state) return undefined;
  if (nowMs() - state.updatedAt > STATE_TTL_MS) {
    SETUP_STATES.delete(key);
    return undefined;
  }
  return state;
}

export function upsertArchitectSetupState(values: {
  ownerUserId: number;
  taskId: number;
  fields: ArchitectSetupDraft;
  connectionStatus?: ArchitectSetupState["connectionStatus"];
  connectionMessage?: string;
  awaitingConfirmation?: boolean;
}) {
  const existing = getArchitectSetupState(values.ownerUserId, values.taskId);
  const state: ArchitectSetupState = {
    taskId: values.taskId,
    ownerUserId: values.ownerUserId,
    fields: { ...(existing?.fields ?? {}), ...compactSetupFields(values.fields) },
    connectionStatus: values.connectionStatus ?? existing?.connectionStatus ?? "untested",
    connectionMessage: values.connectionMessage ?? existing?.connectionMessage,
    awaitingConfirmation: values.awaitingConfirmation ?? existing?.awaitingConfirmation ?? false,
    updatedAt: nowMs(),
  };
  SETUP_STATES.set(stateKey(values.ownerUserId, values.taskId), state);
  return state;
}

export function clearArchitectSetupState(ownerUserId: number, taskId: number) {
  SETUP_STATES.delete(stateKey(ownerUserId, taskId));
}

export function hasArchitectSetupState(ownerUserId: number, taskId: number) {
  return Boolean(getArchitectSetupState(ownerUserId, taskId));
}

export function clearArchitectSetupStatesForTask(ownerUserId: number, taskId: number) {
  clearArchitectSetupState(ownerUserId, taskId);
}

function compactSetupFields(fields: ArchitectSetupDraft) {
  const compacted: ArchitectSetupDraft = {};
  for (const [key, value] of Object.entries(fields) as Array<[keyof ArchitectSetupFields, string | undefined]>) {
    const normalized = value?.trim();
    if (normalized) compacted[key] = normalized;
  }
  return compacted;
}

function pickField(message: string, labels: string[]) {
  const labelPattern = labels.map(label => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const regex = new RegExp(`(?:^|\\n|[;,])\\s*(?:${labelPattern})\\s*(?:is|=|:|-)?\\s*([^\\n;,]+)`, "i");
  const match = message.match(regex);
  return match?.[1]?.trim();
}

function pickRepoUrl(message: string) {
  const explicit = pickField(message, ["repository url", "repo url", "github repository", "github repo", "repository", "repo"]);
  if (explicit) return explicit;
  return message.match(/https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?/i)?.[0];
}

function pickTokenEnvVar(message: string) {
  const explicit = pickField(message, ["github token environment variable", "github token env var", "github token env", "token environment variable", "token env var", "token env", "environment variable", "env var"]);
  if (explicit) return explicit;
  return message.match(/\b[A-Z][A-Z0-9_]{2,}\b/)?.[0];
}

function pickBaseBranch(message: string) {
  return pickField(message, ["default base branch", "default branch", "base branch", "branch"]);
}

function pickDisplayName(message: string) {
  const explicit = pickField(message, ["project display name", "project name", "display name", "name", "project"]);
  if (!explicit) return undefined;
  if (/^https?:\/\//i.test(explicit)) return undefined;
  return explicit;
}

export function extractArchitectSetupFields(message: string): ArchitectSetupDraft {
  return compactSetupFields({
    displayName: pickDisplayName(message),
    repoUrl: pickRepoUrl(message),
    githubTokenEnvVar: pickTokenEnvVar(message),
    defaultBaseBranch: pickBaseBranch(message),
  });
}

export function missingArchitectSetupFields(fields: ArchitectSetupDraft) {
  const missing: Array<keyof ArchitectSetupFields> = [];
  if (!fields.displayName?.trim()) missing.push("displayName");
  if (!fields.repoUrl?.trim()) missing.push("repoUrl");
  if (!fields.githubTokenEnvVar?.trim()) missing.push("githubTokenEnvVar");
  if (!fields.defaultBaseBranch?.trim()) missing.push("defaultBaseBranch");
  return missing;
}

export function assertCompleteArchitectSetupFields(fields: ArchitectSetupDraft): ArchitectSetupFields {
  const missing = missingArchitectSetupFields(fields);
  if (missing.length > 0) throw new Error(`Architect setup is missing: ${missing.join(", ")}`);
  return {
    displayName: fields.displayName!.trim(),
    repoUrl: fields.repoUrl!.trim(),
    githubTokenEnvVar: fields.githubTokenEnvVar!.trim(),
    defaultBaseBranch: fields.defaultBaseBranch!.trim(),
  };
}

export function validateArchitectSetupFields(fields: ArchitectSetupDraft) {
  const errors: string[] = [];
  if (fields.repoUrl && !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/i.test(fields.repoUrl.trim())) {
    errors.push("Use a full GitHub HTTPS repository URL, for example https://github.com/org/repo.");
  }
  if (fields.githubTokenEnvVar && !/^[A-Z][A-Z0-9_]{2,}$/.test(fields.githubTokenEnvVar.trim())) {
    errors.push("Use an environment variable name only for the GitHub token, such as BUILD_TARGET_GITHUB_TOKEN. Do not paste token values.");
  }
  if (fields.defaultBaseBranch && !/^[A-Za-z0-9._\/-]{1,120}$/.test(fields.defaultBaseBranch.trim())) {
    errors.push("Use a valid branch name for the default base branch.");
  }
  return errors;
}

export function isArchitectSetupConfirmation(message: string) {
  return /\b(confirm|yes|save it|save project|create project|go ahead|approved|looks good)\b/i.test(message.trim());
}

export function isArchitectSetupCancellation(message: string) {
  return /\b(cancel|stop setup|do not save|don't save|nevermind|never mind|start over)\b/i.test(message.trim());
}

export function formatMissingArchitectSetupFields(missing: Array<keyof ArchitectSetupFields>) {
  const labels: Record<keyof ArchitectSetupFields, string> = {
    displayName: "project display name",
    repoUrl: "GitHub repository URL",
    githubTokenEnvVar: "GitHub token environment variable name",
    defaultBaseBranch: "default base branch",
  };
  return missing.map(field => labels[field]).join(", ");
}

export function formatArchitectSetupSummary(fields: ArchitectSetupFields) {
  return [
    `Project display name: ${fields.displayName}`,
    `GitHub repository URL: ${fields.repoUrl}`,
    `GitHub token environment variable: ${fields.githubTokenEnvVar}`,
    `Default base branch: ${fields.defaultBaseBranch}`,
  ].join("\n");
}
