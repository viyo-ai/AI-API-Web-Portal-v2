import { describe, expect, it } from "vitest";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const itWhenCloudflareSecretsExist = accountId && apiToken ? it : it.skip;

describe("Cloudflare Workers AI credentials", () => {
  itWhenCloudflareSecretsExist("can authenticate against the Workers AI models endpoint", async () => {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/models/search?search=llama`,
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    const body = (await response.json()) as {
      success?: boolean;
      errors?: Array<{ code?: number; message?: string }>;
    };

    expect(response.status, JSON.stringify(body.errors ?? [])).toBeLessThan(400);
    expect(body.success, JSON.stringify(body.errors ?? [])).toBe(true);
  }, 20000);
});
