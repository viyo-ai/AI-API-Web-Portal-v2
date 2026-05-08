export type ProviderFailureProvider = "anthropic" | "kimi";

export type ProviderFailureKind =
  | "quota_exceeded"
  | "rate_limited"
  | "auth_failed"
  | "provider_unavailable"
  | "network_timeout"
  | "unknown";

export type ProviderFailure = {
  provider: ProviderFailureProvider;
  kind: ProviderFailureKind;
  retryAfterSec?: number;
  providerMessage: string;
};

const PROVIDER_LABELS: Record<ProviderFailureProvider, string> = {
  anthropic: "Anthropic",
  kimi: "Kimi",
};

const PROVIDER_ENV_HINTS: Record<ProviderFailureProvider, string> = {
  anthropic: "CLAUDE_API_KEY or ANTHROPIC_API_KEY",
  kimi: "CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN",
};

function truncateProviderMessage(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized;
}

function parseRetryAfterSec(rawMessage: string) {
  const retryAfterMatch = rawMessage.match(/retry[-\s]?after[:=\s]+(\d+)/i);
  if (retryAfterMatch?.[1]) return Number(retryAfterMatch[1]);
  const secondsMatch = rawMessage.match(/(?:retry|again).*?(\d+)\s*(?:s|sec|second|seconds)/i);
  if (secondsMatch?.[1]) return Number(secondsMatch[1]);
  return undefined;
}

export function classifyProviderFailure(provider: ProviderFailureProvider, rawMessage: string): ProviderFailure {
  const providerMessage = rawMessage || "Unknown provider failure";
  const normalized = providerMessage.toLowerCase();

  if (provider === "anthropic" && (normalized.includes("quota") || normalized.includes("spend cap") || normalized.includes("monthly cap") || normalized.includes("credit balance"))) {
    return { provider, kind: "quota_exceeded", providerMessage };
  }

  if (normalized.includes("rate limit") || normalized.includes("rate_limited") || normalized.includes("too many requests") || normalized.includes("429")) {
    const retryAfterSec = parseRetryAfterSec(providerMessage);
    return { provider, kind: "rate_limited", ...(retryAfterSec ? { retryAfterSec } : {}), providerMessage };
  }

  if (normalized.includes("credential") || normalized.includes("api key") || normalized.includes("token") || normalized.includes("unauthorized") || normalized.includes("forbidden") || normalized.includes("401") || normalized.includes("403")) {
    return { provider, kind: "auth_failed", providerMessage };
  }

  if (normalized.includes("timeout") || normalized.includes("timed out") || normalized.includes("econnreset") || normalized.includes("etimedout")) {
    return { provider, kind: "network_timeout", providerMessage };
  }

  if (normalized.includes("unavailable") || normalized.includes("overloaded") || normalized.includes("bad gateway") || normalized.includes("gateway") || normalized.includes("503") || normalized.includes("502") || normalized.includes("504")) {
    return { provider, kind: "provider_unavailable", providerMessage };
  }

  return { provider, kind: "unknown", providerMessage };
}

export function providerFailureOwnerMessage(failure: ProviderFailure, options: { retryExhausted?: boolean } = {}) {
  const label = PROVIDER_LABELS[failure.provider];
  if (failure.provider === "anthropic" && failure.kind === "quota_exceeded") {
    return "Anthropic monthly spend cap reached. Architect and Reviewer are paused until next billing cycle, or until the cap is raised in the Anthropic console. Build turns through Kimi continue to work.";
  }

  if (failure.provider === "kimi" && failure.kind === "rate_limited" && failure.retryAfterSec && !options.retryExhausted) {
    return `Kimi is rate-limited. Retrying in ${failure.retryAfterSec} seconds.`;
  }

  if (failure.provider === "kimi" && failure.kind === "rate_limited") {
    return "Kimi remains rate-limited. Try again in a minute, or switch the composer to Claude Opus 4.7 for this turn.";
  }

  if (failure.kind === "auth_failed") {
    return `${label} credentials are not accepting our calls. Check the ${PROVIDER_ENV_HINTS[failure.provider]} env var in Manus environment variables, then retry.`;
  }

  return `${label} call failed: ${truncateProviderMessage(failure.providerMessage)}. Retry, or switch routes.`;
}

export function providerFailureNotice(failure: ProviderFailure) {
  if (failure.provider === "anthropic" && failure.kind === "quota_exceeded") return "Architect paused — Anthropic cap reached";
  if (failure.provider === "kimi" && failure.kind === "auth_failed") return "Kimi paused — credentials";
  if (failure.provider === "anthropic" && failure.kind === "auth_failed") return "Architect paused — credentials";
  if (failure.provider === "kimi" && failure.kind === "rate_limited") return "Kimi paused — rate limit";
  return null;
}
