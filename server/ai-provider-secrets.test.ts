import { describe, expect, it } from "vitest";
import { CLAUDE_DEFAULT_MODEL, KIMI_K26_CLOUDFLARE_MODEL } from "./wrapperLLM";

const TEST_TIMEOUT_MS = 30_000;

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

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "anthropic-version": "2023-06-01",
          "x-api-key": apiKey as string,
        },
        body: JSON.stringify({
          model: CLAUDE_DEFAULT_MODEL,
          max_tokens: 1,
          temperature: 0,
          messages: [{ role: "user", content: "Reply with one token." }],
        }),
      });

      if (!response.ok) {
        throw new Error(await readFailure(response));
      }
      const body = (await response.json()) as { content?: Array<{ type?: string; text?: string }> };
      expect(body.content?.some((item) => item.type === "text" && typeof item.text === "string")).toBe(true);
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

      const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${KIMI_K26_CLOUDFLARE_MODEL}`, {
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
        throw new Error(await readFailure(response));
      }
      const body = (await response.json()) as { success?: boolean; result?: unknown; errors?: unknown[] };
      expect(body.success, JSON.stringify(body.errors ?? body).slice(0, 500)).not.toBe(false);
      expect(body.result).toBeTruthy();
    },
    TEST_TIMEOUT_MS,
  );
});
