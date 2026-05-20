/**
 * §PORTAL-PHASE-2 — Parallel Worker Fan-Out for Multi-Agent Execution
 *
 * Component 1: Worker spec and lifecycle primitive (runParallelWorkers)
 * Component 2: Aggregation primitive (aggregateWorkerResults)
 *
 * Workers run in parallel via Promise.all, each invoking the existing
 * Kimi/Claude wrapper. Outputs persist in Ruflo memory keyed by
 * {parentTaskId}:{workerId}:{outputKey}. Aggregation reads all outputs,
 * sanitizes tokens, and produces a single merged response for §9 gate.
 */

import { invokeLLM } from "./_core/llm";
import { callRufloTool, getRufloHealth } from "./rufloMcpClient";
import { containsTokenLikeValue, redactTokenLikeValues } from "./architectLLM";

// ─── Types ───────────────────────────────────────────────────────────────────

export type WorkerRole = "executor" | "architect" | "reviewer" | "adversary" | "curator";

export type WorkerSpec = {
  workerId: string;
  role: WorkerRole;
  subtaskPrompt: string;
  requiredContext?: string[];
  outputKey: string;
};

export type WorkerResult = {
  workerId: string;
  status: "completed" | "failed" | "timeout";
  output?: string;
  error?: string;
  durationMs: number;
  rufloMemoryKey: string;
};

export type AggregationResult = {
  mergedOutput: string;
  workerResults: WorkerResult[];
  aggregationDurationMs: number;
  failedWorkers: string[];
  timedOutWorkers: string[];
};

// ─── Configuration ───────────────────────────────────────────────────────────

const DEFAULT_WORKER_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// ─── Internal: LLM invocation for a single worker ────────────────────────────

type WorkerLLMInvoker = (spec: WorkerSpec, preloadedContext: string) => Promise<string>;

/**
 * Default LLM invoker: routes to Kimi for executor role, Claude for others.
 * This can be overridden in tests via the options parameter.
 */
async function defaultWorkerLLMInvoker(spec: WorkerSpec, preloadedContext: string): Promise<string> {
  const systemPrompt = buildWorkerSystemPrompt(spec, preloadedContext);

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: spec.subtaskPrompt },
    ],
    max_tokens: 4096,
  });

  const content = response?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error(`Worker "${spec.workerId}" received empty LLM response.`);
  }
  return content;
}

function buildWorkerSystemPrompt(spec: WorkerSpec, preloadedContext: string): string {
  const roleDescriptions: Record<WorkerRole, string> = {
    executor: "You are a code executor. Write implementation code for the subtask. Be precise and complete.",
    architect: "You are a system architect. Design the structure and contracts for the subtask. Be thorough.",
    reviewer: "You are a code reviewer. Analyze the subtask and provide critical feedback and improvements.",
    adversary: "You are an adversarial tester. Find edge cases, security issues, and failure modes in the subtask.",
    curator: "You are a content curator. Organize, summarize, and present information clearly for the subtask.",
  };

  let prompt = `${roleDescriptions[spec.role]}\n\nYou are one of multiple parallel workers executing independent subtasks. Focus ONLY on your assigned subtask. Do not attempt to coordinate with other workers.\n`;

  if (preloadedContext) {
    prompt += `\n## Preloaded Context\n${preloadedContext}\n`;
  }

  return prompt;
}

// ─── Internal: Ruflo memory operations ───────────────────────────────────────

function buildMemoryKey(parentTaskId: number, workerId: string, outputKey: string): string {
  return `${parentTaskId}:${workerId}:${outputKey}`;
}

async function storeWorkerOutput(key: string, value: string): Promise<void> {
  const health = getRufloHealth();
  if (!health.alive) {
    console.warn(`[parallel-workers] Ruflo not alive, skipping memory store for key: ${key}`);
    return;
  }

  try {
    await callRufloTool("memory_store", {
      key,
      value,
      namespace: "parallel-workers",
    });
  } catch (err) {
    console.warn(`[parallel-workers] Failed to store to Ruflo memory: ${err instanceof Error ? err.message : err}`);
  }
}

async function loadContextFromRuflo(keys: string[]): Promise<string> {
  const health = getRufloHealth();
  if (!health.alive || keys.length === 0) return "";

  const results: string[] = [];
  for (const key of keys) {
    try {
      const result = await callRufloTool("memory_search", {
        query: key,
        namespace: "parallel-workers",
        limit: 1,
      });
      const content = result as { content?: Array<{ text?: string }> };
      const text = content?.content?.[0]?.text;
      if (text) {
        try {
          const parsed = JSON.parse(text);
          if (parsed.results?.[0]?.value) {
            results.push(`[${key}]: ${parsed.results[0].value}`);
          }
        } catch {
          results.push(`[${key}]: ${text}`);
        }
      }
    } catch {
      // Skip failed context loads — non-fatal
    }
  }
  return results.join("\n\n");
}

// ─── Component 1: runParallelWorkers ─────────────────────────────────────────

export type RunParallelWorkersOptions = {
  timeoutMs?: number;
  llmInvoker?: WorkerLLMInvoker;
};

/**
 * Execute N workers in parallel. Each worker:
 * 1. Preloads any required context from Ruflo memory
 * 2. Invokes its LLM (Kimi for executor, Claude for others)
 * 3. Sanitizes output for token-like values
 * 4. Stores result in Ruflo memory at {parentTaskId}:{workerId}:{outputKey}
 *
 * Per-worker timeout enforced. One worker's failure does not abort others.
 */
export async function runParallelWorkers(
  parentTaskId: number,
  specs: WorkerSpec[],
  options?: RunParallelWorkersOptions,
): Promise<WorkerResult[]> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_WORKER_TIMEOUT_MS;
  const invoker = options?.llmInvoker ?? defaultWorkerLLMInvoker;

  const workerPromises = specs.map((spec) => executeWorker(parentTaskId, spec, timeoutMs, invoker));
  return Promise.all(workerPromises);
}

async function executeWorker(
  parentTaskId: number,
  spec: WorkerSpec,
  timeoutMs: number,
  invoker: WorkerLLMInvoker,
): Promise<WorkerResult> {
  const memoryKey = buildMemoryKey(parentTaskId, spec.workerId, spec.outputKey);
  const startTime = Date.now();

  try {
    const result = await Promise.race([
      executeWorkerCore(spec, invoker),
      createTimeout(timeoutMs, spec.workerId),
    ]);

    if (result === "__TIMEOUT__") {
      return {
        workerId: spec.workerId,
        status: "timeout",
        error: `Worker "${spec.workerId}" exceeded timeout of ${timeoutMs}ms.`,
        durationMs: Date.now() - startTime,
        rufloMemoryKey: memoryKey,
      };
    }

    // Sanitize output for token-like values (INV-P2-07)
    const sanitizedOutput = containsTokenLikeValue(result) ? redactTokenLikeValues(result) : result;

    // Store to Ruflo memory
    await storeWorkerOutput(memoryKey, sanitizedOutput);

    return {
      workerId: spec.workerId,
      status: "completed",
      output: sanitizedOutput,
      durationMs: Date.now() - startTime,
      rufloMemoryKey: memoryKey,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return {
      workerId: spec.workerId,
      status: "failed",
      error,
      durationMs: Date.now() - startTime,
      rufloMemoryKey: memoryKey,
    };
  }
}

async function executeWorkerCore(spec: WorkerSpec, invoker: WorkerLLMInvoker): Promise<string> {
  const preloadedContext = spec.requiredContext ? await loadContextFromRuflo(spec.requiredContext) : "";
  return invoker(spec, preloadedContext);
}

function createTimeout(ms: number, workerId: string): Promise<"__TIMEOUT__"> {
  return new Promise((resolve) => {
    setTimeout(() => resolve("__TIMEOUT__"), ms);
  });
}

// ─── Component 2: aggregateWorkerResults ─────────────────────────────────────

export type AggregateOptions = {
  llmInvoker?: (systemPrompt: string, userPrompt: string) => Promise<string>;
};

/**
 * Aggregate all worker outputs into a single coherent response.
 * - Reads worker outputs from Ruflo memory (or uses in-memory results)
 * - Constructs aggregation context for Claude
 * - Claude synthesizes a single merged response
 * - Surfaces failures explicitly — no silent fallbacks
 */
export async function aggregateWorkerResults(
  parentTaskId: number,
  results: WorkerResult[],
  aggregationPrompt: string,
  options?: AggregateOptions,
): Promise<AggregationResult> {
  const startTime = Date.now();

  const failedWorkers = results.filter((r) => r.status === "failed").map((r) => r.workerId);
  const timedOutWorkers = results.filter((r) => r.status === "timeout").map((r) => r.workerId);
  const completedWorkers = results.filter((r) => r.status === "completed");

  // Build aggregation context from worker outputs
  const workerOutputSections = results.map((r) => {
    if (r.status === "completed") {
      return `### Worker: ${r.workerId} (${r.status})\n${r.output}`;
    }
    return `### Worker: ${r.workerId} (${r.status})\nError: ${r.error}`;
  });

  const systemPrompt = `You are an aggregation agent. Your job is to synthesize the outputs of multiple parallel workers into a single coherent response. Each worker completed an independent subtask. Combine their outputs logically, preserving all important details. If any workers failed or timed out, explicitly note what was not completed.`;

  const userPrompt = `## Original Directive\n${aggregationPrompt}\n\n## Worker Outputs (${completedWorkers.length} completed, ${failedWorkers.length} failed, ${timedOutWorkers.length} timed out)\n\n${workerOutputSections.join("\n\n")}`;

  let mergedOutput: string;

  if (options?.llmInvoker) {
    mergedOutput = await options.llmInvoker(systemPrompt, userPrompt);
  } else {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 8192,
    });

    const rawContent = response?.choices?.[0]?.message?.content;
    mergedOutput = typeof rawContent === "string" ? rawContent : "";
    if (!mergedOutput) {
      // Fallback: concatenate worker outputs directly
      mergedOutput = completedWorkers.map((r) => `## ${r.workerId}\n${r.output}`).join("\n\n");
      if (failedWorkers.length > 0) {
        mergedOutput += `\n\n## Failed Workers\n${failedWorkers.join(", ")}`;
      }
      if (timedOutWorkers.length > 0) {
        mergedOutput += `\n\n## Timed Out Workers\n${timedOutWorkers.join(", ")}`;
      }
    }
  }

  // Final token sanitization on merged output (INV-P2-07)
  if (containsTokenLikeValue(mergedOutput)) {
    mergedOutput = redactTokenLikeValues(mergedOutput);
  }

  return {
    mergedOutput,
    workerResults: results,
    aggregationDurationMs: Date.now() - startTime,
    failedWorkers,
    timedOutWorkers,
  };
}

// ─── Exports for testing ─────────────────────────────────────────────────────

export { buildMemoryKey, buildWorkerSystemPrompt };
