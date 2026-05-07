import { readFileSync } from "node:fs";
import path from "node:path";

export type ArchitectIntent =
  | "setup"
  | "credentials"
  | "onboarding"
  | "build"
  | "ambiguous"
  | "other";

export type ArchitectIntentDecision = {
  intent: ArchitectIntent;
  shouldRouteToArchitect: boolean;
  confidence: "high" | "medium" | "low";
  reason: string;
};

const TOKEN_PREFIX_PATTERN = /\b(?:ghp_|github_pat_|gho_|ghu_|ghs_|ghr_)[A-Za-z0-9_\-]+\b/i;

export const ARCHITECT_SYSTEM_PROMPT_PATH = path.join(
  process.cwd(),
  "server/prompts/architect.system.md"
);

export const ARCHITECT_INTENT_PROMPT_PATH = path.join(
  process.cwd(),
  "server/prompts/architect.intent.md"
);

export function loadArchitectSystemPrompt() {
  return readFileSync(ARCHITECT_SYSTEM_PROMPT_PATH, "utf8");
}

export function loadArchitectIntentPrompt() {
  return readFileSync(ARCHITECT_INTENT_PROMPT_PATH, "utf8");
}

export function containsTokenLikeValue(message: string) {
  return TOKEN_PREFIX_PATTERN.test(message);
}

export function redactTokenLikeValues(message: string) {
  return message.replace(TOKEN_PREFIX_PATTERN, "[redacted-token-value]");
}

export function detectArchitectIntent(message: string): ArchitectIntentDecision {
  const normalized = message
    .toLowerCase()
    .replace(/[^a-z0-9_\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const setupSignals = [
    "connect project",
    "connect repo",
    "add project",
    "set up project",
    "setup project",
    "onboard project",
    "onboarding",
    "configure repository",
    "project setup",
    "github repo",
  ];
  const credentialSignals = [
    "token changed",
    "rotate token",
    "credential",
    "env var",
    "environment variable",
    "github token",
    "test connection",
    "credentials drawer",
    "missing token",
  ];
  const buildSignals = [
    "implement",
    "build",
    "fix bug",
    "ship",
    "code",
    "refactor",
    "test failing",
    "deploy",
    "acceptance",
  ];

  const hasSetup = setupSignals.some(signal => normalized.includes(signal));
  const hasCredential = credentialSignals.some(signal => normalized.includes(signal));
  const hasBuild = buildSignals.some(signal => normalized.includes(signal));

  if ((hasSetup || hasCredential) && hasBuild) {
    return {
      intent: "ambiguous",
      shouldRouteToArchitect: true,
      confidence: "low",
      reason:
        "The message mixes setup or credential language with build-work language, so Architect should ask the owner to choose the safe setup path or continue as a build turn.",
    };
  }

  if (hasCredential) {
    return {
      intent: "credentials",
      shouldRouteToArchitect: true,
      confidence: "high",
      reason: "Credential or env-var management language was detected.",
    };
  }

  if (hasSetup) {
    return {
      intent: "setup",
      shouldRouteToArchitect: true,
      confidence: "high",
      reason: "Project setup or onboarding language was detected.",
    };
  }

  if (hasBuild) {
    return {
      intent: "build",
      shouldRouteToArchitect: false,
      confidence: "high",
      reason: "Build-work language should continue through the existing Kimi/Reviewer routing.",
    };
  }

  return {
    intent: "other",
    shouldRouteToArchitect: false,
    confidence: "medium",
    reason: "No setup, onboarding, or credential-management intent was detected.",
  };
}

export function buildArchitectReply(params: {
  message: string;
  intent: ArchitectIntentDecision;
  hasBuildTarget: boolean;
}) {
  if (containsTokenLikeValue(params.message)) {
    return [
      "I can’t accept or repeat token values in chat. Please update the token in the relevant Manus environment variable, then use the project connection test so I can verify the configured env var name without seeing the secret.",
      "If you want the form-based path, open Advanced Setup.",
    ].join("\n\n");
  }

  if (params.intent.intent === "ambiguous") {
    return [
      "This could be setup work or a build request. For setup, reply with the project name, GitHub repository URL, GitHub token environment variable name, and default base branch. For build work, resend the message with #kimi or #claude so it stays on the existing build route.",
      "If you prefer the form-based path, open Advanced Setup.",
    ].join("\n\n");
  }

  if (params.intent.intent === "credentials") {
    return [
      params.hasBuildTarget
        ? "I can help verify credential status for the selected project by env var name only. If a token changed, update it in Manus environment variables first, then run Test now in the Credentials Drawer."
        : "I can help verify credential status once you select or connect a project. Token values must stay in Manus environment variables; I only use env var names.",
      "If the credential mapping itself needs to change, open Advanced Setup after the new env var exists.",
    ].join("\n\n");
  }

  return [
    "Let’s connect the project conversationally. Please provide the project display name, GitHub repository URL, GitHub token environment variable name, and default base branch. I will test the connection before anything is saved, and I will ask for explicit confirmation before writing the project record.",
    "If you prefer the form-based path, open Advanced Setup.",
  ].join("\n\n");
}
