import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { invokeLLM, type InvokeResult } from "./_core/llm";
import type { ArchitectSetupDraft, ArchitectSetupState } from "./architectSetup";

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

export type ArchitectReplyCallTool = {
  name:
    | "buildTargets.testConnection"
    | "buildTargets.create"
    | "projectMemory.list"
    | "projectMemory.set";
  args: Record<string, unknown>;
};

export type ArchitectReplyDecision = {
  reply: string;
  requiresConfirmation: boolean;
  callTool?: ArchitectReplyCallTool;
};

export type ArchitectReplyOperationalState = {
  status?: string;
  missingFields?: Array<keyof ArchitectSetupDraft>;
  validationErrors?: string[];
  connectionStatus?: ArchitectSetupState["connectionStatus"] | "not_applicable";
  connectionMessage?: string;
  createdBuildTargetName?: string;
  hasBuildTarget?: boolean;
  nextAction?: string;
};

export type ArchitectReplyGeneratorOptions = {
  setupState?: ArchitectSetupState;
  lastUserMessage: string;
  intentDecision: ArchitectIntentDecision;
  operationalState?: ArchitectReplyOperationalState;
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
const ALLOWED_ARCHITECT_TOOL_NAMES = new Set<ArchitectReplyCallTool["name"]>([
  "buildTargets.testConnection",
  "buildTargets.create",
  "projectMemory.list",
  "projectMemory.set",
]);
const DEFAULT_CLASSIFIER_TIMEOUT_MS = 3500;
const DEFAULT_REPLY_TIMEOUT_MS = 3500;
export const ARCHITECT_REPLY_FALLBACK = "I'm having trouble composing a reply right now. Please try again, or open Advanced Setup.";
const threadClassificationCache = new Map<string, ArchitectIntentDecision>();

export const ARCHITECT_SYSTEM_PROMPT_PATH = path.join(
  process.cwd(),
  "server/prompts/architect.system.md"
);

export const ARCHITECT_INTENT_PROMPT_PATH = path.join(
  process.cwd(),
  "server/prompts/architect.intent.md"
);

export const ARCHITECT_CONTEXT_PROMPT_PATH = path.join(
  process.cwd(),
  "server/prompts/architect.context.md"
);

export function loadArchitectSystemPrompt() {
  return readFileSync(ARCHITECT_SYSTEM_PROMPT_PATH, "utf8");
}

export function loadArchitectIntentPrompt() {
  return readFileSync(ARCHITECT_INTENT_PROMPT_PATH, "utf8");
}

export function loadArchitectContextPrompt() {
  return readFileSync(ARCHITECT_CONTEXT_PROMPT_PATH, "utf8");
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
        timeout = setTimeout(() => reject(new Error("Architect LLM operation timed out")), timeoutMs);
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

function collectedSetupFields(fields: ArchitectSetupDraft | undefined) {
  return {
    displayName: Boolean(fields?.displayName?.trim()),
    repoUrl: Boolean(fields?.repoUrl?.trim()),
    githubTokenEnvVar: Boolean(fields?.githubTokenEnvVar?.trim()),
    defaultBaseBranch: Boolean(fields?.defaultBaseBranch?.trim()),
  };
}

function sanitizedSetupFields(fields: ArchitectSetupDraft | undefined) {
  return {
    displayName: fields?.displayName?.trim() || null,
    repoUrl: fields?.repoUrl?.trim() || null,
    githubTokenEnvVar: fields?.githubTokenEnvVar?.trim() || null,
    defaultBaseBranch: fields?.defaultBaseBranch?.trim() || null,
  };
}

function buildReplyPayload(options: ArchitectReplyGeneratorOptions) {
  const safeLastUserMessage = redactTokenLikeValues(options.lastUserMessage);
  const fields = options.setupState?.fields;
  return {
    setupState: {
      exists: Boolean(options.setupState),
      fieldsCollected: collectedSetupFields(fields),
      fields: sanitizedSetupFields(fields),
      awaitingConfirmation: options.setupState?.awaitingConfirmation === true,
      connectionStatus: options.setupState?.connectionStatus ?? "untested",
      connectionMessage: options.setupState?.connectionMessage ?? null,
      updatedAt: options.setupState?.updatedAt ?? null,
    },
    operationalState: options.operationalState ?? {},
    lastUserMessage: safeLastUserMessage,
    tokenRedactionRequired:
      options.intentDecision.tokenRedactionRequired || safeLastUserMessage !== options.lastUserMessage,
    intentDecision: options.intentDecision,
    replyInstructions: {
      composeNaturally: true,
      doNotEchoTokenValues: true,
      doNotClaimASaveBeforeExplicitConfirmation: true,
      askForMissingSetupInformationWhenNeeded: true,
      respectAllowedToolsOnly: Array.from(ALLOWED_ARCHITECT_TOOL_NAMES),
      recoveryFallbackIfUnableToCompose: ARCHITECT_REPLY_FALLBACK,
    },
  };
}

function parseArchitectReplyResponse(result: InvokeResult): ArchitectReplyDecision | undefined {
  const content = result.choices[0]?.message.content;
  const raw = typeof content === "string" ? content : JSON.stringify(content ?? {});
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!parsed || typeof parsed !== "object") return undefined;
  const candidate = parsed as Partial<ArchitectReplyDecision>;
  if (typeof candidate.reply !== "string" || candidate.reply.trim().length === 0) return undefined;
  if (containsTokenLikeValue(candidate.reply)) return undefined;
  const decision: ArchitectReplyDecision = {
    reply: candidate.reply.trim(),
    requiresConfirmation: candidate.requiresConfirmation === true,
  };
  const callTool = candidate.callTool as ArchitectReplyCallTool | undefined;
  if (callTool) {
    if (!ALLOWED_ARCHITECT_TOOL_NAMES.has(callTool.name)) return undefined;
    decision.callTool = {
      name: callTool.name,
      args: typeof callTool.args === "object" && callTool.args !== null ? callTool.args : {},
    };
  }
  return decision;
}

export function buildArchitectReply(params: {
  message: string;
  intent: ArchitectIntentDecision;
  hasBuildTarget?: boolean;
}) {
  if (params.intent.tokenRedactionRequired || containsTokenLikeValue(params.message)) {
    return "I can help with credentials, but token values must stay in a Manus environment variable. Please provide only the env var name so I can continue safely.";
  }
  return ARCHITECT_REPLY_FALLBACK;
}

export async function generateArchitectReply(
  options: ArchitectReplyGeneratorOptions
): Promise<ArchitectReplyDecision> {
  const invoke = options.invoke ?? invokeLLM;
  const timeoutMs = options.timeoutMs ?? DEFAULT_REPLY_TIMEOUT_MS;
  const payload = buildReplyPayload(options);

  try {
    const result = await withTimeout(
      invoke({
        messages: [
          {
            role: "system",
            content: [loadArchitectSystemPrompt(), loadArchitectContextPrompt()].join("\n\n---\n\n"),
          },
          {
            role: "user",
            content: JSON.stringify(payload, null, 2),
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "architect_reply_generation",
            strict: true,
            schema: {
              type: "object",
              properties: {
                reply: { type: "string" },
                requiresConfirmation: { type: "boolean" },
                callTool: {
                  type: "object",
                  properties: {
                    name: {
                      type: "string",
                      enum: [
                        "buildTargets.testConnection",
                        "buildTargets.create",
                        "projectMemory.list",
                        "projectMemory.set",
                      ],
                    },
                    args: { type: "object", additionalProperties: true },
                  },
                  required: ["name", "args"],
                  additionalProperties: false,
                },
              },
              required: ["reply", "requiresConfirmation"],
              additionalProperties: false,
            },
          },
        },
      }),
      timeoutMs
    );

    const decision = parseArchitectReplyResponse(result);
    if (decision) return decision;
  } catch {
    // Recovery path only; normal Architect replies are composed by the LLM router.
  }

  return {
    reply: ARCHITECT_REPLY_FALLBACK,
    requiresConfirmation: false,
  };
}
