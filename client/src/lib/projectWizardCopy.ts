export const WIZARD_TOKEN_LOOKS_LIKE_SECRET_RE = /^(ghp_|github_pat_|gho_|ghu_|ghs_|ghr_)/;

export const WIZARD_ACTUAL_TOKEN_ERROR =
  "That looks like the actual token. Paste only the environment variable name where the token is stored — for example, VIYO_GITHUB_TOKEN.";

export const WIZARD_REPO_REQUIRED_ERROR = "Add the link to your GitHub repository.";

export const WIZARD_REPO_PREFIX_ERROR =
  "Use the full GitHub link, like https://github.com/your-name/your-repo.";

export const WIZARD_CONNECTION_SUCCESS = "Connected. Read access confirmed.";

export const WIZARD_PROJECT_CONNECTED_SUCCESS =
  "Your Project is connected. You can start a new task whenever you’re ready.";

export const WIZARD_INITIAL_BRANCH_PREFIX = "agent-work/";

export const WIZARD_DEFAULT_VALIDATION_COMMANDS = ["pnpm check", "pnpm test", "pnpm build"];

export const WIZARD_PREFIX_ADDED_NOTE =
  "For safety, this Project will save the first workspace branch under agent-work/.";

const TOKEN_VALUE_RE = /(github_pat_[A-Za-z0-9_]+|gh[pousr]_[A-Za-z0-9_]+)/g;

export type WizardConnectionStatus =
  | "ok"
  | "missing_env"
  | "invalid_token"
  | "repo_not_accessible"
  | string;

export function sanitizeWizardConnectionText(value: string | null | undefined) {
  return (value ?? "").replace(TOKEN_VALUE_RE, "[redacted token]");
}

export function validateWizardRepoLink(repoUrl: string) {
  const cleanRepoUrl = repoUrl.trim();
  if (!cleanRepoUrl) return WIZARD_REPO_REQUIRED_ERROR;
  if (!cleanRepoUrl.startsWith("https://github.com/")) return WIZARD_REPO_PREFIX_ERROR;
  return null;
}

export function validateWizardTokenEnvVarName(tokenEnvVar: string) {
  const cleanTokenEnvVar = tokenEnvVar.trim();
  if (!cleanTokenEnvVar) return "Enter the environment variable name where your GitHub token is stored.";
  if (WIZARD_TOKEN_LOOKS_LIKE_SECRET_RE.test(cleanTokenEnvVar)) return WIZARD_ACTUAL_TOKEN_ERROR;
  return null;
}

export function wizardConnectionFailureMessage(status: WizardConnectionStatus, fallbackMessage?: string | null) {
  if (status === "missing_env") {
    return "We couldn’t find that environment variable in Manus. Add it to your Manus environment, then test again.";
  }
  if (status === "invalid_token") {
    return "GitHub rejected the token stored in that environment variable. Check that it is a fine-grained token for this repository with Contents read and write access, then test again.";
  }
  if (status === "repo_not_accessible") {
    return "We couldn’t find that repository, or the token does not have access to it. Check the GitHub repository link and token permissions, then test again.";
  }
  return sanitizeWizardConnectionText(fallbackMessage) || "The connection test did not pass. Check the GitHub repository link and token environment variable name, then test again.";
}

export function wizardConnectionResultMessage(result: { status?: WizardConnectionStatus; message?: string | null } | null | undefined) {
  if (result?.status === "ok") return WIZARD_CONNECTION_SUCCESS;
  return wizardConnectionFailureMessage(result?.status ?? "unknown", result?.message);
}

function sanitizeWizardBranchSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-/]+|[-/]+$/g, "");
}

export function defaultWizardInitialBranch(displayName: string) {
  const slug = sanitizeWizardBranchSegment(displayName) || "workshop-repo";
  return `${WIZARD_INITIAL_BRANCH_PREFIX}${slug}`;
}

export function normalizeWizardInitialBranch(value: string, displayName: string) {
  const cleanValue = sanitizeWizardBranchSegment(value);
  if (!cleanValue) {
    return { value: defaultWizardInitialBranch(displayName), prefixAdded: false, defaulted: true };
  }
  if (cleanValue.startsWith(WIZARD_INITIAL_BRANCH_PREFIX)) {
    return { value: cleanValue, prefixAdded: false, defaulted: false };
  }
  return { value: `${WIZARD_INITIAL_BRANCH_PREFIX}${cleanValue}`, prefixAdded: true, defaulted: false };
}

export function normalizeWizardProtectedBranches(value: string, defaultBaseBranch: string) {
  const fallbackBranch = sanitizeWizardBranchSegment(defaultBaseBranch) || "main";
  const cleanValue = value.trim();
  if (!cleanValue) return [fallbackBranch];

  const fromJson = cleanValue.startsWith("[");
  if (fromJson) {
    try {
      const parsed = JSON.parse(cleanValue);
      if (!Array.isArray(parsed)) return [fallbackBranch];
      const branches = parsed.map((branch) => sanitizeWizardBranchSegment(String(branch))).filter(Boolean);
      return branches.length ? Array.from(new Set(branches)) : [fallbackBranch];
    } catch {
      return [fallbackBranch];
    }
  }

  const branches = cleanValue.split(",").map((branch) => sanitizeWizardBranchSegment(branch)).filter(Boolean);
  return branches.length ? Array.from(new Set(branches)) : [fallbackBranch];
}

export function normalizeWizardValidationCommands(value: string) {
  const commands = value.split("\n").map((command) => command.trim()).filter(Boolean);
  return commands.length ? commands : WIZARD_DEFAULT_VALIDATION_COMMANDS;
}
