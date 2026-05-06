import { appRouter } from "../server/routers";
import { getTaskThread, getUserByOpenId, upsertUser } from "../server/db";
import { CLAUDE_ADAPTIVE_THINKING_CONFIG, CLAUDE_DEFAULT_MODEL } from "../server/wrapperLLM";
import { writeFile } from "node:fs/promises";
import { mkdir } from "node:fs/promises";
import path from "node:path";

type CapturedAnthropicCall = {
  timestamp: string;
  url: string;
  model: string | null;
  maxTokens: number | null;
  thinking: unknown;
  messageCount: number | null;
  hasSystemPrompt: boolean;
  hasApiKeyHeader: boolean;
  responseStatus?: number;
  responseOk?: boolean;
};

const projectRoot = process.cwd();
const evidenceDir = path.join(projectRoot, "test-results");
const evidencePath = path.join(evidenceDir, "live-adaptive-thinking-validation.json");
const originalFetch = globalThis.fetch.bind(globalThis);
const capturedAnthropicCalls: CapturedAnthropicCall[] = [];

function getHeader(headers: HeadersInit | undefined, key: string) {
  if (!headers) return undefined;
  if (headers instanceof Headers) return headers.get(key) ?? undefined;
  if (Array.isArray(headers)) {
    return headers.find(([headerKey]) => headerKey.toLowerCase() === key.toLowerCase())?.[1];
  }
  return Object.entries(headers).find(([headerKey]) => headerKey.toLowerCase() === key.toLowerCase())?.[1] as string | undefined;
}

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const isAnthropicMessagesCall = url === "https://api.anthropic.com/v1/messages";
  let callRecord: CapturedAnthropicCall | null = null;

  if (isAnthropicMessagesCall) {
    const bodyText = typeof init?.body === "string" ? init.body : null;
    const parsedBody = bodyText ? JSON.parse(bodyText) : null;
    callRecord = {
      timestamp: new Date().toISOString(),
      url,
      model: parsedBody?.model ?? null,
      maxTokens: parsedBody?.max_tokens ?? null,
      thinking: parsedBody?.thinking,
      messageCount: Array.isArray(parsedBody?.messages) ? parsedBody.messages.length : null,
      hasSystemPrompt: typeof parsedBody?.system === "string" && parsedBody.system.length > 0,
      hasApiKeyHeader: Boolean(getHeader(init?.headers, "x-api-key")),
    };
    capturedAnthropicCalls.push(callRecord);
  }

  const response = await originalFetch(input, init);
  if (callRecord) {
    callRecord.responseStatus = response.status;
    callRecord.responseOk = response.ok;
  }
  return response;
};

async function getOrCreateValidationUser() {
  const ownerOpenId = process.env.OWNER_OPEN_ID?.trim();
  const validationOpenId = ownerOpenId || "live-adaptive-thinking-validation-user";
  let user = await getUserByOpenId(validationOpenId);
  if (!user) {
    await upsertUser({
      openId: validationOpenId,
      name: ownerOpenId ? process.env.OWNER_NAME || "Project Owner" : "Live Adaptive Thinking Validation",
      role: ownerOpenId ? "admin" : "user",
      loginMethod: "live-validation-script",
    });
    user = await getUserByOpenId(validationOpenId);
  }
  if (!user) {
    throw new Error("Unable to create or retrieve a validation user for the live router call.");
  }
  return user;
}

async function main() {
  await mkdir(evidenceDir, { recursive: true });
  const user = await getOrCreateValidationUser();
  const caller = appRouter.createCaller({
    user,
    req: {} as never,
    res: { clearCookie: () => undefined } as never,
  });

  const startedAt = new Date().toISOString();
  const taskTitle = `LIVE Claude adaptive-thinking validation ${startedAt}`;
  const created = await caller.tasks.create({
    title: taskTitle,
    summary: "One-off validation that the real portal orchestration path sends Claude Opus 4.7 requests with Anthropic adaptive thinking enabled.",
    routeMode: "claude",
  });

  const taskId = created.task.id;
  const liveMessage = "#claude Live validation only: reply with one short sentence confirming you received this adaptive-thinking provider-path test.";
  let submitError: string | null = null;
  try {
    await caller.orchestration.submitMessage({ taskId, message: liveMessage, routeMode: "claude" });
  } catch (error) {
    submitError = error instanceof Error ? error.message : String(error);
  }

  const thread = await getTaskThread(taskId, user.id);
  const events = thread?.events.map((event) => ({
    id: event.id,
    actor: event.actor,
    eventType: event.eventType,
    status: event.status,
    contentPreview: event.content.slice(0, 500),
    metadataJson: event.metadataJson,
  })) ?? [];

  const adaptiveThinkingCalls = capturedAnthropicCalls.filter((call) =>
    call.model === CLAUDE_DEFAULT_MODEL
    && JSON.stringify(call.thinking) === JSON.stringify(CLAUDE_ADAPTIVE_THINKING_CONFIG),
  );

  const evidence = {
    startedAt,
    finishedAt: new Date().toISOString(),
    validation: {
      passed: adaptiveThinkingCalls.length > 0,
      expectedModel: CLAUDE_DEFAULT_MODEL,
      expectedThinking: CLAUDE_ADAPTIVE_THINKING_CONFIG,
      capturedAnthropicCallCount: capturedAnthropicCalls.length,
      adaptiveThinkingCallCount: adaptiveThinkingCalls.length,
      submitError,
    },
    task: {
      id: taskId,
      title: taskTitle,
      ownerUserId: user.id,
      finalStatus: thread?.task.status ?? null,
      routeMode: thread?.task.routeMode ?? null,
    },
    capturedAnthropicCalls,
    eventEvidence: events,
  };

  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ evidencePath, validation: evidence.validation, task: evidence.task }, null, 2));

  if (!evidence.validation.passed) {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  await mkdir(evidenceDir, { recursive: true });
  const failure = {
    finishedAt: new Date().toISOString(),
    validation: { passed: false },
    error: error instanceof Error ? error.stack || error.message : String(error),
    capturedAnthropicCalls,
  };
  await writeFile(evidencePath, `${JSON.stringify(failure, null, 2)}\n`, "utf8");
  console.error(error);
  process.exit(1);
});
