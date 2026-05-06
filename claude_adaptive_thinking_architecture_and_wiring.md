# Claude Opus 4.7 Adaptive Thinking Architecture and Wiring Plan

**Author:** Manus AI  
**Date:** 2026-05-06  
**Project:** AI Coding Workshop Portal, `/home/ubuntu/ai-coding-workshop-permanent`  
**Scope:** Enable adaptive thinking whenever Claude Opus 4.7 is invoked through the portal’s Claude provider path.

## Requirement Summary

The owner requirement is that Claude Opus 4.7 must have adaptive thinking enabled **anytime it loads**. The verified Anthropic documentation states that Claude Opus 4.7 uses `thinking: { "type": "adaptive" }`; it also states that the older manual extended-thinking form `thinking: { "type": "enabled", "budget_tokens": N }` is rejected for Claude Opus 4.7. The implementation must therefore inject `thinking: { type: "adaptive" }` into every direct Anthropic Messages API payload where `model` is `claude-opus-4-7`.

| Verified Documentation Point | Decision for This Project |
|---|---|
| Claude Opus 4.7 model identifier is `claude-opus-4-7`. | Keep `CLAUDE_DEFAULT_MODEL` as the central source of model truth. |
| Adaptive thinking is off unless explicitly set. | Add a central request-body helper that always includes adaptive thinking for Opus 4.7. |
| Manual `type: "enabled"` with `budget_tokens` is rejected for Opus 4.7. | Do not use a fixed token-budget payload for this model. |
| Adaptive thinking can be combined with optional `effort`. | Do not add effort in this change; use the documented minimum compliant setting to avoid changing cost/latency policy without a separate owner decision. |

## 1. Component Inventory

| # | Component | Type | Path | Purpose | New/Modified |
|---|---|---|---|---|---|
| 1 | Claude request-body helper and adaptive-thinking constant | Module function/constant | `server/wrapperLLM.ts` | Centralize construction of Anthropic Messages API payloads and attach `thinking: { type: "adaptive" }` whenever the model is Claude Opus 4.7. | Modified |
| 2 | Claude direct invocation | Provider adapter | `server/wrapperLLM.ts` | Replace inline JSON request construction with the central helper so planner and reviewer calls cannot drift. | Modified |
| 3 | Provider adapter regression tests | Vitest suite | `server/aiRouting.provider-adapters.test.ts` | Prove Claude-only and dual-route Claude plan/review requests include adaptive thinking while Kimi calls remain unchanged. | Modified |
| 4 | Live Claude credential smoke test | Vitest suite | `server/ai-provider-secrets.test.ts` | Ensure the direct live Anthropic test payload also follows the project-wide Opus 4.7 adaptive-thinking contract. | Modified |
| 5 | Task tracker | Project metadata | `todo.md` | Track completion of documentation verification, implementation, regression coverage, and validation. | Modified |
| 6 | Findings and plan documents | Project documentation | `claude_adaptive_thinking_findings.md`, `claude_adaptive_thinking_architecture_and_wiring.md` | Preserve source-verified implementation rationale and wiring plan. | New |

## 2. Data Flow

The primary execution flow remains unchanged except for the Claude request payload. A task-thread message flows through route selection and eventually reaches the Claude provider adapter only when the resolved route requires Claude.

```text
Owner submits task-thread message → orchestration.submitMessage → resolveWrapperRoute() → executeWrapperTurn() → runClaudePlan()/runClaudeReview() → invokeClaude() → buildClaudeMessagesRequestBody() → Anthropic Messages API → normalized text stored as task event
```

For a Claude-only route, `executeWrapperTurn()` calls `runClaudePlan()`, which calls `invokeClaude()`. For a dual route, `executeWrapperTurn()` calls Claude once for planning and once again for review; both calls use the same `invokeClaude()` helper, so a provider-layer payload helper covers both invocation points. The Kimi-only route remains unaffected because it calls `invokeKimi()` and Cloudflare Workers AI.

## 3. Dependency Map

| Component | Depends On | Type | Notes |
|---|---|---|---|
| `invokeClaude()` | `CLAUDE_DEFAULT_MODEL` | Internal constant | Default model remains `claude-opus-4-7` unless `CLAUDE_MODEL` overrides it. |
| `buildClaudeMessagesRequestBody()` | Anthropic Messages API request contract | External API contract | Adds `thinking: { type: "adaptive" }` only for the Opus 4.7 model string. |
| Provider adapter tests | Vitest and mocked `fetch` | Test dependency | Assertions inspect serialized request bodies before mocked provider responses are returned. |
| Credential smoke test | Anthropic Messages API | External service | Uses the same adaptive-thinking payload shape so live verification does not violate the global requirement. |

## 4. Technology Decisions

**Decision:** Implement adaptive thinking as a provider-layer request-body helper in `server/wrapperLLM.ts`.

**Context:** The user’s requirement is platform-wide. Scattering `thinking` objects at individual planner, reviewer, or test call sites would make the guarantee fragile and would increase the chance that a future Claude call omits the required setting.

**Options Considered:** One option was to add `thinking` inline inside the existing `fetch()` body. Another was to add the setting at each Claude role function, such as `runClaudePlan()` and `runClaudeReview()`. The chosen option is a single helper that constructs the entire Anthropic payload.

**Chosen:** A central helper is the safest approach because both current Claude invocation roles and future direct Claude calls can use one contract. The helper can also be exported for tests if needed, avoiding duplicated request-shape logic.

**Consequences:** The change is small, testable, and limited to the provider adapter. It does not alter database schema, authentication, frontend UI, routing semantics, or Kimi execution. It also corrects the inherited budget-token assumption by following the current Anthropic Opus 4.7 adaptive-thinking contract.

## 5. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---:|---:|---|
| Using the older `type: "enabled"` budget payload causes Anthropic 400 errors for Opus 4.7. | Medium | High | Use current documentation-verified `thinking: { type: "adaptive" }` and add tests that reject drift. |
| Future Claude call sites bypass the provider helper. | Medium | Medium | Export and test the helper; add source-level assertions in provider tests for all current direct Anthropic calls. |
| Live credential smoke test fails due to too-small `max_tokens` with adaptive thinking. | Low | Medium | Use a modest smoke-test output limit instead of `max_tokens: 1`, while still keeping the test lightweight. |
| Adding optional `effort` changes latency/cost unexpectedly. | Medium | Medium | Do not add `effort` in this change; leave effort policy as a separate owner decision. |
| Kimi route behavior changes accidentally. | Low | Medium | Keep `invokeKimi()` untouched and preserve Kimi-specific adapter tests. |

# Wiring Blueprint

## Frontend → API Connections

No frontend code changes are required. Existing task-thread submission continues to call the same tRPC procedure.

| # | UI Component | Action/Event | Endpoint | Method | Request Payload | Expected Response | Auth? |
|---|---|---|---|---|---|---|---|
| 1 | `Home.tsx` task composer | Owner submits a task-thread message | `/api/trpc/orchestration.submitMessage` | tRPC POST | `{ taskId: number, message: string, routeMode: "auto" | "claude" | "kimi" | "dual" }` | Updated task thread with provider events and final answer | Yes |

## API → Database Connections

No database schema or query behavior changes are required. Existing event persistence remains unchanged after the provider response is normalized.

| # | Handler/Function | Operation | Table/Collection | Query Pattern | Input Fields | Output Fields |
|---|---|---|---|---|---|---|
| 1 | `executeWrapperTurn()` | INSERT/UPDATE via imported helpers | Task events and turns | Append provider progress/result events; update turn state; complete or fail turn | `taskId`, `ownerUserId`, `turnId`, provider output | Persisted event rows and completed/failed turn state |

## API → External Service Connections

| # | Caller | Service | Endpoint/SDK | Auth Method | Request Shape | Response Shape | Fallback |
|---|---|---|---|---|---|---|---|
| 1 | `invokeClaude()` | Anthropic Messages API | `https://api.anthropic.com/v1/messages` | `x-api-key` using `ANTHROPIC_API_KEY` or `CLAUDE_API_KEY` | `{ model: "claude-opus-4-7", system, messages, max_tokens, thinking: { type: "adaptive" } }` | `{ content: [{ type: "text", text: string }] }` | Existing Manus Forge fallback if direct Anthropic fails |
| 2 | `invokeKimi()` | Cloudflare Workers AI | `/client/v4/accounts/{accountId}/ai/run/@cf/moonshotai/kimi-k2.6` | Bearer `CLOUDFLARE_API_TOKEN` | `{ messages }` | Provider response text from `result` | Existing explicit error path; no Claude fallback |

## Event Flows

| # | Trigger | Event | Handler | Side Effects | Async? |
|---|---|---|---|---|---|
| 1 | Claude-only route selected | Claude planning invocation | `runClaudePlan()` → `invokeClaude()` | Calls Anthropic with adaptive thinking; appends Claude plan event; completes turn | Yes |
| 2 | Dual route selected | Claude planning, Kimi execution, Claude review | `executeWrapperTurn()` | First and second Claude calls both include adaptive thinking; Kimi call remains Cloudflare-only | Yes |
| 3 | Direct credential smoke test | Live Anthropic credential validation | `ai-provider-secrets.test.ts` | Sends adaptive-thinking payload to Anthropic when the test is run with credentials | Yes |

## Environment Variables

| # | Variable Name | Used By | Purpose | Required? | Default |
|---|---|---|---|---|---|
| 1 | `CLAUDE_MODEL` | `server/wrapperLLM.ts` | Optional override for Claude model id | No | `claude-opus-4-7` |
| 2 | `ANTHROPIC_API_KEY` | `invokeClaude()` and credential smoke test | Direct Anthropic API credential | Yes for direct Anthropic path | None |
| 3 | `CLAUDE_API_KEY` | `invokeClaude()`, credential state, and smoke test | Alternate Claude API credential | Yes for direct Anthropic path if `ANTHROPIC_API_KEY` absent | None |
| 4 | `BUILT_IN_FORGE_API_URL` | `invokeLLM()` fallback | Manus Forge fallback endpoint | Existing platform env | Platform-injected |
| 5 | `BUILT_IN_FORGE_API_KEY` | `invokeLLM()` fallback | Manus Forge fallback credential | Existing platform env | Platform-injected |

## Verification Plan

| Gate | Command or Method | Pass Criteria |
|---|---|---|
| Focused provider tests | `pnpm vitest run server/aiRouting.provider-adapters.test.ts` | Claude-only and dual Claude calls include `thinking: { type: "adaptive" }`; Kimi route remains unchanged. |
| Full unit/regression suite | `pnpm test` | All Vitest suites pass. |
| TypeScript check | `pnpm check` | No TypeScript errors. |
| Production build | `pnpm build` | Vite/Express build completes successfully. |
| Managed health check | Project health status check | No TypeScript/LSP/server errors after the change. |
| TODO review | Read `todo.md` before checkpoint | Adaptive-thinking items accurately marked complete. |
