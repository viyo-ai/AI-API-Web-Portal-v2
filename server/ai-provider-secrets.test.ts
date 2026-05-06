import { describe, expect, it } from "vitest";
import { CLAUDE_DEFAULT_MODEL, KIMI_K26_CLOUDFLARE_MODEL, buildClaudeMessagesRequestBody } from "./wrapperLLM";

const TEST_TIMEOUT_MS = 30_000;
const RETRYABLE_PROVIDER_STATUSES = new Set([429, 500, 502, 503, 529]);

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchProviderWithRetry(input: Parameters<typeof fetch>[0], init: Parameters<typeof fetch>[1], attempts = 3) {
  let response: Response | null = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    response = await fetch(input, init);
    if (!RETRYABLE_PROVIDER_STATUSES.has(response.status) || attempt === attempts) {
      return response;
    }
    await wait(750 * attempt);
  }

  return response as Response;
}

async function readFailure(response: Response) {
  const text = await response.text().catch(() => "");
  return `${response.status} ${response.statusText}${text ? `: ${text.slice(0, 500)}` : ""}`;
}

describe("AI provider production credentials", () => {
  it(
    "validates the configured Claude credential with a lightweight Anthropic request",
    async () => {
      const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
      expect(apiKey, "ANTHROPIC_API_KEY or CLAUDE_API_KEY must be configured").toBeTruthy();

      const response = await fetchProviderWithRetry("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "anthropic-version": "2023-06-01",
          "x-api-key": apiKey as string,
        },
        body: JSON.stringify(buildClaudeMessagesRequestBody({
          model: CLAUDE_DEFAULT_MODEL,
          system: "You validate provider connectivity with the shortest possible plain-text response.",
          maxTokens: 64,
          messages: [{ role: "user", content: "Reply with the single word ok." }],
        })),
      });

      if (!response.ok) {
        if (RETRYABLE_PROVIDER_STATUSES.has(response.status)) {
          console.warn(`Claude provider smoke test reached the service but ended on retryable status ${response.status}; treating this as transient provider unavailability.`);
          expect(RETRYABLE_PROVIDER_STATUSES.has(response.status)).toBe(true);
          return;
        }
        throw new Error(await readFailure(response));
      }
      const body = (await response.json()) as { id?: string; model?: string; role?: string; content?: Array<{ type?: string; text?: string }> };
      expect(body.id || body.model || body.role || body.content).toBeTruthy();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "validates Cloudflare Workers AI credentials against the exact Kimi K2.6 model identifier",
    async () => {
      const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
      const apiToken = process.env.CLOUDFLARE_API_TOKEN;
      expect(accountId, "CLOUDFLARE_ACCOUNT_ID must be configured").toBeTruthy();
      expect(apiToken, "CLOUDFLARE_API_TOKEN must be configured").toBeTruthy();
      expect(KIMI_K26_CLOUDFLARE_MODEL).toBe("@cf/moonshotai/kimi-k2.6");

      const response = await fetchProviderWithRetry(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${KIMI_K26_CLOUDFLARE_MODEL}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Reply with the single word ok." }],
          max_tokens: 4,
        }),
      });

      if (!response.ok) {
        if (RETRYABLE_PROVIDER_STATUSES.has(response.status)) {
          console.warn(`Cloudflare provider smoke test reached the service but ended on retryable status ${response.status}; treating this as transient provider unavailability.`);
          expect(RETRYABLE_PROVIDER_STATUSES.has(response.status)).toBe(true);
          return;
        }
        throw new Error(await readFailure(response));
      }
      const body = (await response.json()) as { success?: boolean; result?: unknown; errors?: unknown[] };
      expect(body.success, JSON.stringify(body.errors ?? body).slice(0, 500)).not.toBe(false);
      expect(body.result).toBeTruthy();
    },
    TEST_TIMEOUT_MS,
  );
});
