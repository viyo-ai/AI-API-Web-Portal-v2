# FOUNDATION_LOCK.md

**Scope:** Portal-wide. Auto-attached to every Task in every Project as a Global File. Loaded into every model-call system prompt.

**Status:** Locked. Changes require explicit Product Owner directive.

**Version:** 1.0 — May 7, 2026.

---

## Purpose

This file locks the architectural contracts that govern the AI-API-Web-Portal. Any code, plan, or proposal that conflicts with these contracts must be rejected at review. These contracts cannot be silently relaxed by Claude, Kimi, the OpenAI coordinator, or any future provider.

If a Task's work would require violating one of these contracts, Claude must surface the conflict to the owner before proceeding.

---

## Contract 1: Provider Identity

The Portal uses three LLM providers, each with a specific role.

| Provider | Model | Role | Credential |
|---|---|---|---|
| Anthropic | `claude-opus-4-7` | Verifier and planner | `CLAUDE_API_KEY` |
| Cloudflare Workers AI | `@cf/moonshotai/kimi-k2.6` | Executor | `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` |
| OpenAI | (current routing model) | Coordinator | `OPENAI_API_KEY` |

**Locked:**
- Adaptive thinking is enabled on every Claude call. Budget configurable, never zero.
- Kimi is invoked via Cloudflare Workers AI native binding only. No Forge, no Moonshot direct, no aggregator.
- `CLAUDE_API_KEY` is the Anthropic credential. `ANTHROPIC_API_KEY` is explicitly ignored.
- No silent fallback between providers. If a provider is unavailable, the owner is told and chooses.

---

## Contract 2: Branch Isolation

Every code change happens on a Build Branch. The owner's `main` and `staging` branches are read-only from the agent perspective.

**Locked:**
- Build Branch names start with `agent-work/`. Enforced by `assertSafeBranchName`.
- `main` and `staging` are never push targets. Enforced by `assertBranchIsNotProtected` AND a workspace-installed pre-push hook.
- Each Build Branch has an isolated workspace path: `/{workspaceRoot}/owner-{userId}/target-{buildTargetId}/branch-{branchId}-{slug}`.
- Workspace files are removed when the Build Branch is deleted (`cleanupWorkspace`).
- The pre-push hook is reinstalled on every clone, sync, and push call. Manual deletion of the hook is not a supported workflow.

---

## Contract 3: Credential Isolation

The agent process never sees Portal server secrets unless explicitly mapped.

**Locked:**
- `.env.agent` is generated from the Project's `agentEnvVarMapJson` only.
- `.env.agent` lives at the workspace root, mode `0o600`, gitignored.
- `.env.agent` is never committed (enforced by pre-push hook checking staged files).
- `buildAgentProcessEnv` builds child env from explicit map only; never spreads `process.env`.
- Future agent-process spawners must use `buildAgentProcessEnv`. Never use `{ ...process.env }`.

---

## Contract 4: Plain-English Owner Standard

The owner is non-technical. Every owner-facing surface must be readable without technical vocabulary.

**Locked:**
- Acceptable owner-facing words: Project, Task, message, file, working branch, send, save, approve, try again, cancel.
- Forbidden owner-facing words on non-Diagnostics surfaces: `governance`, `rule book`, `agent env var`, `build target`, `subprocess`, `mutation`, `procedure`, `protected branch` (in normal flow), `commit SHA`, `stack trace`, `regex`.
- Diagnostics tab is exempted. Technical labels acceptable inside Diagnostics.
- Even in Diagnostics, secrets remain forbidden: API keys (mask `sk-…****`), tokens (mask `cf_…****`), authenticated repo URLs (use `redactRepoUrl`).
- Error messages follow the three-sentence format: what failed, why (if safe), what the owner can do.

---

## Contract 5: Verified Handoff Pattern

When the OpenAI coordinator chooses dual-path (Claude → Kimi → Claude), the wrapper produces a four-field result.

**Locked:**
- `claudePlan` — Claude's plan in plain prose (what changes, what files, what risks, what success looks like)
- `kimiResult` — Kimi's execution output
- `claudeReview` — Claude's review of Kimi's output (matched plan? omissions? scope creep?)
- `finalAnswer` — synthesis surfaced to the owner

The wrapper data model exists today (`server/wrapperLLM.ts WrapperExecutionResult`). §9 (future directive) adds the explicit owner approval gate between Claude's plan and Kimi's execution. Until §9 ships, the dual-path turn happens within a single user turn without human pause.

---

## Contract 6: Test Discipline

Source-string assertions are insufficient. Every wrapper, AI coordinator, or LLM-call path requires behavioral tests.

**Locked:**
- Behavioral tests mock provider fetches, assert request payload shape, assert side effects (DB write, AI Activity event, UI state change).
- Every directive produces an ingestion evidence file at `.taskmaster/docs/ingestion-evidence/` BEFORE code changes.
- Every directive's invariants get dedicated contract tests in `server/section{N}.{topic}.contract.test.ts`.
- Validation gates before push: `pnpm check`, focused contract tests, `pnpm test --run`, `pnpm build`. All four must pass.
- Out-of-scope discoveries get `[PORTAL-OOS-XX]` proposal commits and STOP for owner approval. Never bundle.

---

## Contract 7: Per-Project Governance Layering

Every Project carries its own governance files (loaded via §4.5 mechanism). These extend, but do not override, the Portal-wide contracts in this file.

**Locked:**
- Per-Project governance is loaded from the cloned Build Branch workspace via paths in `governanceFilesJson`.
- Per-Project governance is prepended to every model-call system prompt for tasks attached to that Project.
- Per-Project content respects `governanceBudgetEnforced` token budget. Truncation is logged with `governance_truncated` event.
- Portal-wide contracts (this file, PORTAL_OPERATING_PRINCIPLES.md, CLAUDE.md) are loaded BEFORE per-Project content and are NEVER truncated.
- If per-Project governance contradicts Portal-wide contracts, Portal-wide wins. Plain-English Owner Standard, security stop conditions, and provider failure behaviors are not overridable.

---

## Contract 8: Phase Boundary Discipline

Work is sequenced by Phase directives. Each Phase closes with explicit Product Owner acceptance.

**Locked:**
- Phase 1: Provider routing, OAuth, three-panel workspace — accepted.
- Phase 2: Multi-Project orchestration. Sub-sections sequenced: §1A (accepted), §4 (accepted), §4.5 (current), §1A-FU-04 (deferred), §8 (deferred).
- Phase 3: Verified handoff workflow (§9), advanced skill management — not yet authorized.

No work begins on a future Phase without explicit Product Owner directive. Cross-phase commits in a single change are not permitted.

---

## Contract 9: Cost Discipline

The owner pays per-token for both Claude and Kimi. Wasted tokens are wasted dollars.

**Locked:**
- No filler in model responses. No restating the question. No "Great question!" preamble.
- Long explanations only when explicitly requested. Default to terse.
- Adaptive thinking output is never surfaced to the owner unless explicitly requested. Strip thinking blocks before render.
- Per-call token usage logged to AI Activity (technical-details disclosure).
- Single calls exceeding 32k output tokens flag for Product Owner review (likely runaway loop).
- Tasks accumulating >500k total tokens surface a soft warning to start a fresh task.

---

## Contract 10: Stop Conditions

These conditions require an immediate halt. No exception, no override.

**Locked stop conditions:**
1. Any change that would expose secrets (API keys, tokens, env values) in error messages, logs, owner UI, AI Activity events, or response bodies.
2. Any change to security-critical functions (`pushBranch`, `cloneOrSyncBranch`, `assertSafeBranchName`, `assertBranchIsNotProtected`, `installPrePushHook`, `injectAgentEnvFile`, `cleanupWorkspace`, `buildAgentProcessEnv`, `normalizeAgentEnvVarMap`) without re-running all `INV-S4-*` contract tests.
3. Any operation that would touch `main` or `staging` branches directly.
4. Any operation that would commit credential files (matching `.env*`, `*.key`, `*.pem`, `*.crt`, `id_rsa*`).
5. Any destructive operation (delete branch, force-push, drop database, deploy) without explicit owner confirmation in the current turn.
6. Any addition of a new LLM provider without Product Owner architectural review.
7. Any cross-Phase commit without explicit Product Owner approval.

When a stop condition is hit, Claude or Kimi must:
- Halt the current operation
- Surface the conflict to the owner in plain English
- Wait for explicit confirmation, redirection, or cancellation

---

**End of FOUNDATION_LOCK.md.**
