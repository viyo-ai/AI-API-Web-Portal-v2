export const WIZARD_TOKEN_LOOKS_LIKE_SECRET_RE = /^(ghp_|github_pat_|gho_|ghu_|ghs_|ghr_)/;

export const WIZARD_ACTUAL_TOKEN_ERROR =
  "That looks like the actual token. Paste only the environment variable name where the token is stored — for example, VIYO_GITHUB_TOKEN.";

export const WIZARD_REPO_REQUIRED_ERROR = "Add the link to your GitHub repository.";

export const WIZARD_REPO_PREFIX_ERROR =
  "Use the full GitHub link, like https://github.com/your-name/your-repo.";

export const WIZARD_CONNECTION_SUCCESS = "Connected. Read access confirmed.";

export const WIZARD_PROJECT_CONNECTED_SUCCESS =
  "Your Project is connected. You can start a new task whenever you’re ready.";

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
