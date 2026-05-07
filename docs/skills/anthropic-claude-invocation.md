# Skill: Anthropic Claude Opus 4.7 Invocation

**Skill ID:** `anthropic-claude-invocation`
**Version:** 1.0
**Scope:** Every server-side call to the Anthropic Messages API.

---

## Model String

```
claude-opus-4-7
```

This exact string. No alternatives. No version aliasing. No fallback to `claude-opus-4-6` if 4-7 fails — surface the error and let the owner decide.

---

## Required Configuration on Every Call

```ts
{
  model: "claude-opus-4-7",
  max_tokens: 8192,                              // default; raise per-call up to 16384
  thinking: {
    type: "enabled",
    budget_tokens: 4096                          // adaptive thinking on every call
  },
  system: <governance content>,                  // see below
  messages: [...]                                // task thread, oldest-first
}
```

### System prompt assembly order

The `system` field is concatenated in this exact order:

1. **Portal Operating Principles** (universal, from the Portal repo)
2. **Per-Project governance files** (from `governanceFilesJson`, in the order listed)
3. **Skills** explicitly attached to this Task (from the Skills Registry)
4. **Task-specific context** (saved memory, recent context notes)

If the assembled system prompt exceeds the configured `governanceBudgetEnforced` budget for the Project, truncate per-Project content (layer 2 only) with a `[truncated for budget]` marker. Layer 1 (Portal Operating Principles) is never truncated.

### Messages

`messages` is the full Task thread, oldest-first, in `{ role: "user" | "assistant", content: string }` format. Tool-use turns are serialized as part of the assistant content.

---

## Service Tier

**Standard tier only.** Never `service_tier: "priority"` unless explicitly enabled by Product Owner directive. Priority tier is a 5x cost premium with marginal latency improvement; not worth it for the Portal's use case.

If `service_tier` is omitted, Anthropic uses Standard by default — that's the desired behavior.

---

## Adaptive Thinking

Adaptive thinking is enabled on every call. The thinking output is included in the response but **MUST NOT** be surfaced to the owner unless explicitly requested.

### Stripping thinking blocks before render

```ts
const visibleContent = response.content.filter(block => block.type !== "thinking");
const visibleText = visibleContent
  .filter(block => block.type === "text")
  .map(block => block.text)
  .join("\n");
```

Render `visibleText` to the owner. Log the thinking block count in AI Activity for audit, but do not show contents.

### Thinking budget tuning

- **Default: 4096 tokens.** Adequate for routing decisions, plan reviews, simple verification.
- **Raise to 8192:** when the task involves multi-file refactoring analysis, architectural review, or risk assessment of Kimi's proposed changes.
- **Raise to 16384:** rarely. Only for deep verification turns on critical security-sensitive code (e.g., reviewing changes to `pushBranch`, `installPrePushHook`).
- **Never zero.** Adaptive thinking is non-negotiable per Portal architectural invariants.

---

## Error Handling

| Status | Meaning | Behavior |
|---|---|---|
| 200 | Success | Process response normally |
| 400 | Bad request | Log full payload to AI Activity (technical details). Surface plain-English error to owner. Do not retry. |
| 401 | Auth failure | Surface "Claude credentials are not configured." Mark provider as `missing_credential`. Do not retry. |
| 403 | Forbidden | Surface "Claude credentials don't have access to this model." Do not retry. |
| 429 | Rate limited | Exponential backoff: 1s, 2s, 4s. Max 3 retries. Then surface "Claude is busy. Try again in a minute." |
| 500, 502, 503 | Server error | 1 retry after 2s. Then surface "Claude is temporarily unavailable." |
| 529 | Overloaded | Surface "Claude is overloaded. Try again in a minute." Do not retry. |

### Empty content array

If response succeeds (200) but `response.content` is empty or contains no text blocks:
- Log to AI Activity as `claude_empty_response`
- Surface plain-English fallback: *"Claude didn't return anything that time. Try again or pick Kimi."*
- Do not silently retry

### Refusal

If Claude returns a refusal (typically a single text block explaining why it declined):
- Surface the refusal text **directly** to the owner. No paraphrasing, no summarization.
- Do not retry.
- Do not silently route to Kimi.
- Offer alternatives: *"Claude declined this. Try `#kimi` to ask Kimi instead, or rephrase the request."*

---

## Token Budget Tracking

Log per-call to AI Activity (technical-details disclosure):
- `input_tokens` from response usage
- `output_tokens` from response usage
- `cache_read_input_tokens` if prompt caching is used
- `cache_creation_input_tokens` if prompt caching is used

If a single call exceeds **32,000 output tokens**, flag for Product Owner review. This is unusual and may indicate a runaway loop.

If a Task accumulates more than **500,000 total tokens** across all turns, surface a soft warning: *"This conversation is getting long. Consider starting a new task to keep things fast and affordable."*

---

## Prompt Caching

For long-stable system prompts (Portal Operating Principles + per-Project governance), use prompt caching to reduce per-turn cost.

Add `cache_control: { type: "ephemeral" }` to the system prompt block. Anthropic caches the prefix; subsequent turns within ~5 minutes pay the cache-read rate (10% of normal input cost).

This typically reduces per-turn input cost by 60-80% for typical Project work.

---

## When to Use Claude vs Kimi

### Use Claude for
- Planning and architecture
- Risk assessment of proposed changes
- Long-context analysis (>50k tokens of input)
- Verification of Kimi's output
- Anything requiring nuanced judgment
- Final review turns

### Use Kimi for
- Code generation
- Refactoring
- Test writing
- Quick code lookups
- Multi-step compute-heavy tasks (Kimi's 256k context + 300 sub-agent capacity helps)

### When unclear, route to Claude
Default to Claude for ambiguous turns. Kimi excels at execution; Claude excels at judgment. Routing wrong toward Kimi can produce confidently wrong code; routing wrong toward Claude produces an extra clarification turn but no broken output.

---

## Tool Use

Claude Opus 4.7 supports the standard Anthropic tools API. When the Portal exposes tools to Claude (filesystem read, git status, web search), follow these rules:

- Tools are described in plain language. The tool description is what Claude sees.
- Never expose a tool that can write outside the Build Branch workspace.
- Never expose a tool that can read credential env vars.
- Always include the security-sensitive tools (workspace cleanup, branch deletion) only with explicit owner approval per turn.

---

## Streaming

The Portal currently uses non-streaming Messages API. Streaming may be added later. When added:
- Render thinking blocks invisibly during stream
- Render text blocks progressively
- Show typing indicator until stream `message_stop` event

Do not block on full response before showing partial output to owner — this dramatically improves perceived latency.

---

## Test Coverage Required

Every code path that calls the Anthropic API must have a behavioral test that:

1. **Mocks the fetch.** No real API calls in unit/contract tests.
2. **Asserts the request payload.** Specifically: model string, adaptive thinking config, system prompt assembly order, message format.
3. **Tests at least three response scenarios:** success, refusal, empty content array.
4. **Tests at least two error scenarios:** 401 (auth failure), 429 (rate limit retry).
