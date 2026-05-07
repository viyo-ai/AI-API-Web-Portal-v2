# Skill: Kimi K2.6 via Cloudflare Workers AI

**Skill ID:** `kimi-cloudflare-invocation`
**Version:** 1.0
**Scope:** Every server-side call to Kimi K2.6 via Cloudflare Workers AI.

---

## Model String

```
@cf/moonshotai/kimi-k2.6
```

This exact string. No alternatives. No fallback to K2.5 if K2.6 fails — surface the error.

---

## Endpoint and Credentials

Cloudflare Workers AI native binding:

- `CLOUDFLARE_ACCOUNT_ID` — required
- `CLOUDFLARE_API_TOKEN` — required, must have Workers AI Read permission

Endpoint: `https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/@cf/moonshotai/kimi-k2.6`

**Do not** route through:
- Forge API
- OpenAI-compatible Kimi proxies
- Moonshot's direct API
- Any aggregator (APIYI, AIHubMix, etc.)

The Portal's architectural invariant is native Cloudflare Workers AI binding only. This is enforced for billing isolation, latency consistency, and credential boundary clarity.

---

## Required Configuration on Every Call

```ts
{
  model: "@cf/moonshotai/kimi-k2.6",
  max_tokens: 8192,                              // default
  messages: [
    { role: "system", content: <governance> },   // see below
    ...taskThread                                // user/assistant turns
  ],
  tools: [...]                                   // optional, OpenAI-style tools protocol
}
```

### System prompt assembly

Same order as Claude (see `anthropic-claude-invocation` skill):

1. Portal Operating Principles
2. Per-Project governance files
3. Skills attached to this Task
4. Task-specific context

Kimi K2.6 supports system prompts as either:
- The first message with `role: "system"` (preferred, OpenAI-compatible)
- A dedicated `system` field on the request body (also accepted)

Use `role: "system"` first message for consistency with Anthropic API shape.

---

## Prefix Mode (Partial Mode)

When you need structured JSON output, use Kimi K2.6's Partial Mode to force the response shape:

```ts
{
  model: "@cf/moonshotai/kimi-k2.6",
  messages: [
    { role: "system", content: "...respond with JSON only..." },
    { role: "user", content: "..." },
    { role: "assistant", content: "{\"" }       // prefix continuation
  ]
}
```

Kimi continues from the `{"` prefix, producing valid JSON without preamble like *"Sure, here's the JSON:"*.

This eliminates the most common Kimi failure mode: returning prose explanation when JSON was requested.

---

## Sub-Agent Capacity

Kimi K2.6 supports up to 300 concurrent sub-agents per swarm and up to 4,000 coordination steps per task. For long-horizon work:

- **Multi-file refactors:** allow Kimi to spawn sub-agents per file rather than orchestrating from the Portal layer.
- **Test-suite generation:** allow Kimi to spawn one sub-agent per test file.
- **Bullet-scope work** (e.g., VIYO Studio Core Loop): Kimi can self-decompose into sub-tasks.

**Don't** orchestrate at the Portal layer when Kimi can self-orchestrate. Portal-layer orchestration adds round-trip latency and routing cost without improving quality.

The Portal's role is task-level orchestration (which provider answers each Task turn). Sub-task orchestration within a single turn is Kimi's responsibility.

---

## Error Handling

| Status | Meaning | Behavior |
|---|---|---|
| 200 | Success | Process response normally |
| 400 | Bad request | Log payload to AI Activity. Surface plain-English error. No retry. |
| 401, 403 | Auth failure | Surface "Kimi credentials are not configured." Mark provider as `missing_credential`. No retry. |
| 429 | Rate limited | Exponential backoff: 1s, 2s, 4s. Max 3 retries. Then surface "Kimi is busy. Try again in a minute." |
| 500, 502, 503 | Server error | 1 retry after 2s. Then surface "Kimi is temporarily unavailable." |
| Cloudflare-specific 1xxx errors | Edge issues | Treat as 503 |

### Empty content (known failure mode)

Kimi K2.6 via Cloudflare Workers AI has a known failure mode where the response succeeds (200) but `response.result.response` is empty string or contains only whitespace.

When detected:
- Log to AI Activity as `kimi_empty_response`
- Surface plain-English note: *"Kimi didn't return anything that time. Switching to Claude for this turn."*
- **Automatically route the next turn to Claude** with the failure context appended to the system prompt: *"The previous turn was attempted with Kimi but returned empty output. Continuing with Claude."*
- Do not silently retry Kimi. The empty-response mode is often a long-context thrashing issue; Claude handles it better.

### Malformed JSON when Partial Mode requested

If Kimi returns JSON-shaped output that fails `JSON.parse`:
- Log to AI Activity as `kimi_malformed_json`
- One retry with explicit corrective prompt: *"Your previous response was not valid JSON. Return ONLY the JSON object, no other text."*
- If second attempt fails, surface error and pause the turn.

---

## Token Budget Tracking

Log per-call to AI Activity (technical-details disclosure):
- `prompt_tokens` from `response.usage`
- `completion_tokens` from `response.usage`
- `total_tokens`

Cloudflare Workers AI billing is per-token. Pricing (as of K2.6) is significantly cheaper than Anthropic Claude — typically $0.50–$1.00 per million input tokens and $2–$3 per million output tokens, vs. Anthropic's $15/$75. Kimi-heavy days cost a fraction of Claude-heavy days.

If a single Kimi call exceeds **32,000 output tokens**, flag for Product Owner review. Likely a runaway sub-agent loop.

---

## Tool Use

Kimi K2.6 supports OpenAI-style tools protocol natively. When tools are exposed:

```ts
{
  ...
  tools: [
    {
      type: "function",
      function: {
        name: "read_file",
        description: "Read a file from the workspace.",
        parameters: { ... }
      }
    }
  ],
  tool_choice: "auto"
}
```

Function-calling reliability on Kimi K2.6: top-tier on Berkeley Function-Calling Leaderboard, approaching GPT-5 level. Use confidently.

---

## Streaming

Cloudflare Workers AI supports streaming via Server-Sent Events. Add `stream: true` to the request:

```ts
{
  model: "@cf/moonshotai/kimi-k2.6",
  stream: true,
  messages: [...]
}
```

The response is an SSE stream of `data: {...}` chunks. Render text progressively to the owner. End on `data: [DONE]`.

The Portal currently uses non-streaming. When streaming is added, follow the same patterns as Claude streaming.

---

## When to Use Kimi vs Claude

### Use Kimi for
- Code generation (Kimi K2.6 ranks 58.6 on SWE-Bench Pro, top among open models, beats Claude Opus 4.6 on this benchmark)
- Refactoring across multiple files
- Test writing and test fixing
- Quick code lookups
- Long-horizon agentic tasks (300 sub-agents, 4,000 coordination steps)
- Cost-sensitive turns where Claude's 10x price isn't justified

### Use Claude for
- Planning and architectural review
- Verification of Kimi's output
- Long-form creative writing (rare in the Portal)
- Math-heavy reasoning (use GPT-5.4 if extreme; Claude is good enough for most)
- Anything requiring nuanced judgment

### Auto's routing logic
The OpenAI coordinator classifies intent per turn:
- "How do I…" → Claude (planning)
- "Build / write / implement / fix…" → Kimi (execution)
- "Is this safe / does this work / review this…" → Claude (verification)
- Ambiguous → dual-path (Claude plans → Kimi executes → Claude reviews)

---

## Test Coverage Required

Every code path that calls the Cloudflare Workers AI Kimi binding must have a behavioral test that:

1. **Mocks the fetch.** No real API calls in unit/contract tests.
2. **Asserts the model string** is exactly `@cf/moonshotai/kimi-k2.6`.
3. **Asserts the endpoint URL** uses the correct Cloudflare account ID.
4. **Tests at least three response scenarios:** success, empty response (the known failure mode), 429 rate limit.
5. **Asserts the empty-response handler** routes the next turn to Claude with failure context.
