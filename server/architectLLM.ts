import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { invokeLLM, type InvokeResult } from "./_core/llm";

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
  tokenRedactionRequired: boolean;
  classifierSource: "llm" | "fallback" | "token_guard";
  classifierModel?: string;
};

type RouterIntentResponse = {
  intent?: unknown;
  shouldRouteToArchitect?: unknown;
  reason?: unknown;
  confidence?: unknown;
  tokenRedactionRequired?: unknown;
};

export type ArchitectIntentClassifierOptions = {
  taskThreadId?: string | number;
  timeoutMs?: number;
  invoke?: typeof invokeLLM;
};

const GITHUB_TOKEN_PREFIXES = [
  `g${"hp_"}`,
  `${"github"}_pat_`,
  `g${"ho_"}`,
  `g${"hu_"}`,
  `g${"hs_"}`,
  `g${"hr_"}`,
];
const TOKEN_PREFIX_PATTERN = new RegExp(
  `\\b(?:${GITHUB_TOKEN_PREFIXES.join("|")})[A-Za-z0-9_\\-]+\\b`,
  "i"
);
const VALID_INTENTS: ReadonlySet<ArchitectIntent> = new Set<ArchitectIntent>([
  "setup",
  "credentials",
  "onboarding",
  "build",
  "ambiguous",
  "other",
]);
const DEFAULT_CLASSIFIER_TIMEOUT_MS = 3500;
const threadClassificationCache = new Map<string, ArchitectIntentDecision>();

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

export function resetArchitectIntentCacheForTests() {
  threadClassificationCache.clear();
}

function normalizeConfidence(value: unknown): ArchitectIntentDecision["confidence"] {
  return value === "high" || value === "medium" || value === "low" ? value : "medium";
}

function fallbackAmbiguousDecision(reason = "Classifier unavailable, asking owner to clarify."): ArchitectIntentDecision {
  return {
    intent: "ambiguous",
    shouldRouteToArchitect: true,
    confidence: "low",
    reason,
    tokenRedactionRequired: false,
    classifierSource: "fallback",
  };
}

function tokenGuardDecision(): ArchitectIntentDecision {
  return {
    intent: "credentials",
    shouldRouteToArchitect: true,
    confidence: "high",
    reason: "A token-like value was detected and redacted; Architect can only use Manus environment variable names.",
    tokenRedactionRequired: true,
    classifierSource: "token_guard",
  };
}

function parseRouterIntentResponse(result: InvokeResult): ArchitectIntentDecision {
  const content = result.choices[0]?.message.content;
  const raw = typeof content === "string" ? content : JSON.stringify(content ?? {});
  let parsed: RouterIntentResponse;
  try {
    parsed = JSON.parse(raw) as RouterIntentResponse;
  } catch {
    return fallbackAmbiguousDecision("Classifier returned an unreadable decision, asking owner to clarify.");
  }

  const intent = typeof parsed.intent === "string" && VALID_INTENTS.has(parsed.intent as ArchitectIntent)
    ? (parsed.intent as ArchitectIntent)
    : "ambiguous";
  const shouldRouteToArchitect = typeof parsed.shouldRouteToArchitect === "boolean"
    ? parsed.shouldRouteToArchitect
    : intent !== "build" && intent !== "other";
  const reason = typeof parsed.reason === "string" && parsed.reason.trim().length > 0
    ? parsed.reason.trim().replace(/\s+/g, " ").split(/[\r\n]/)[0].slice(0, 300)
    : "Classifier produced a structured intent decision.";

  return {
    intent,
    shouldRouteToArchitect,
    confidence: normalizeConfidence(parsed.confidence),
    reason,
    tokenRedactionRequired: parsed.tokenRedactionRequired === true,
    classifierSource: "llm",
    classifierModel: result.model,
  };
}

function cacheKeyFor(taskThreadId: string | number | undefined, safeMessage: string) {
  if (taskThreadId === undefined || taskThreadId === null || String(taskThreadId).trim().length === 0) {
    return undefined;
  }
  const messageHash = createHash("sha256").update(safeMessage).digest("hex");
  return `${String(taskThreadId)}:${messageHash}`;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Architect intent classifier timed out")), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function detectArchitectIntent(
  message: string,
  options: ArchitectIntentClassifierOptions = {}
): Promise<ArchitectIntentDecision> {
  const safeMessage = redactTokenLikeValues(message);
  const tokenRedactionRequired = safeMessage !== message;
  const cacheKey = cacheKeyFor(options.taskThreadId, safeMessage);
  const cached = cacheKey ? threadClassificationCache.get(cacheKey) : undefined;
  if (cached) return cached;

  if (tokenRedactionRequired) {
    const decision = tokenGuardDecision();
    if (cacheKey) threadClassificationCache.set(cacheKey, decision);
    return decision;
  }

  const invoke = options.invoke ?? invokeLLM;
  const timeoutMs = options.timeoutMs ?? DEFAULT_CLASSIFIER_TIMEOUT_MS;

  try {
    const result = await withTimeout(
      invoke({
        messages: [
          {
            role: "system",
            content: loadArchitectIntentPrompt(),
          },
          {
            role: "user",
            content: JSON.stringify({
              ownerMessage: safeMessage,
              tokenRedactionRequired,
            }),
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "architect_intent_decision",
            strict: true,
            schema: {
              type: "object",
              properties: {
                intent: { type: "string", enum: ["setup", "credentials", "onboarding", "build", "ambiguous", "other"] },
                shouldRouteToArchitect: { type: "boolean" },
                confidence: { type: "string", enum: ["high", "medium", "low"] },
                reason: { type: "string" },
                tokenRedactionRequired: { type: "boolean" },
              },
              required: ["intent", "shouldRouteToArchitect", "confidence", "reason", "tokenRedactionRequired"],
              additionalProperties: false,
            },
          },
        },
      }),
      timeoutMs
    );

    const decision = parseRouterIntentResponse(result);
    if (cacheKey) threadClassificationCache.set(cacheKey, decision);
    return decision;
  } catch {
    const decision = fallbackAmbiguousDecision();
    if (cacheKey) threadClassificationCache.set(cacheKey, decision);
    return decision;
  }
}

export function buildArchitectReply(params: {
  message: string;
  intent: ArchitectIntentDecision;
  hasBuildTarget: boolean;
}) {
  if (params.intent.tokenRedactionRequired || containsTokenLikeValue(params.message)) {
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
