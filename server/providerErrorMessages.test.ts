import { describe, expect, it } from "vitest";
import { classifyProviderFailure, providerFailureNotice, providerFailureOwnerMessage } from "./providerErrorMessages";

describe("provider error owner-safe mapping table", () => {
  it.each([
    ["quota_exceeded", "anthropic", "monthly quota exceeded: spend cap reached"],
    ["rate_limited", "kimi", "429 too many requests retry-after: 7"],
    ["auth_failed", "kimi", "401 unauthorized token rejected"],
    ["provider_unavailable", "kimi", "503 service unavailable upstream worker unavailable"],
    ["network_timeout", "anthropic", "request timed out while waiting"],
    ["unknown", "kimi", "unexpected provider envelope"],
  ] as const)("classifies %s failures", (kind, provider, rawMessage) => {
    expect(classifyProviderFailure(provider, rawMessage)).toEqual(expect.objectContaining({ provider, kind, providerMessage: rawMessage }));
  });

  it("maps Anthropic quota exhaustion to the exact owner pause notice while preserving Kimi route availability", () => {
    const failure = classifyProviderFailure("anthropic", "monthly spend cap reached");

    expect(providerFailureOwnerMessage(failure)).toContain("Anthropic monthly spend cap reached");
    expect(providerFailureOwnerMessage(failure)).toContain("Build turns through Kimi continue to work");
    expect(providerFailureNotice(failure)).toBe("Architect paused — Anthropic cap reached");
  });

  it("maps Kimi credential and rate-limit failures to route-specific recovery guidance", () => {
    const authFailure = classifyProviderFailure("kimi", "Cloudflare token unauthorized");
    const rateFailure = classifyProviderFailure("kimi", "429 rate limit retry-after: 9");

    expect(providerFailureOwnerMessage(authFailure)).toContain("CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN");
    expect(providerFailureNotice(authFailure)).toBe("Kimi paused — credentials");
    expect(providerFailureOwnerMessage(rateFailure)).toBe("Kimi is rate-limited. Retrying in 9 seconds.");
    expect(providerFailureOwnerMessage(rateFailure, { retryExhausted: true })).toBe("Kimi remains rate-limited. Try again in a minute, or switch the composer to Claude Opus 4.7 for this turn.");
  });
});
