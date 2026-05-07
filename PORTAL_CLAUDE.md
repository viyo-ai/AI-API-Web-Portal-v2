# Portal CLAUDE.md

This file governs any AI (Manus, Kimi, Claude, future) doing work on the **AI-API-Web-Portal-v2 codebase itself**. It applies to the Portal's own source code, not to projects built using the Portal.

This file lives at the Portal repo root and is the first thing any new contributor reads.

---

## Identity

The Portal is a non-technical-operator wrapper around three LLM providers:

- **Anthropic Claude Opus 4.7** via direct API (`CLAUDE_API_KEY`). Claude is the verifier and planner.
- **Moonshot Kimi K2.6** via Cloudflare Workers AI native (`@cf/moonshotai/kimi-k2.6`). Kimi is the executor.
- **OpenAI** as the routing coordinator. OpenAI decides which provider answers each turn.

The Portal is built for owners who do not write code, do not read repos, and do not use the command line. Every owner-facing surface must reflect this.

---

## Architecture Invariants (Non-Negotiable)

These cannot be changed without an explicit Product Owner directive. Code that violates them is rejected at review.

1. **Adaptive thinking is enabled on every Claude call.** Budget is configurable per call but never zero.
2. **Kimi is invoked via Cloudflare Workers AI native binding only.** No Forge fallback. No OpenAI-compatible proxy.
3. **`CLAUDE_API_KEY` is the Anthropic credential.** `ANTHROPIC_API_KEY` is explicitly ignored.
4. **Build Branch names must start with `agent-work/`.** Protected branches (`main`, `staging`) are never push targets.
5. **`.env.agent` is generated from the Project's `agentEnvVarMap` only.** Never committed. Never echoed in logs. Never surfaced to UI. Mode `0o600`.
6. **Conventional commits are enforced via pre-push hook.** Format: `<type>(<scope>?): <summary>` where type is one of `feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert`.
7. **Every Phase directive produces an ingestion evidence file** at `.taskmaster/docs/ingestion-evidence/` before any code changes.
8. **Validation gates must all pass before push:** `pnpm check`, focused contract tests, `pnpm test --run`, `pnpm build`.

---

## Plain-English Owner Standard

Every owner-facing surface must be readable without technical vocabulary.

**Acceptable owner-facing words:** Project, Task, message, file, working branch, send, save, approve, try again, cancel.

**Forbidden owner-facing words on non-Diagnostics surfaces:** governance, rule book, agent env var, build target, subprocess, transaction, mutex, hash, SHA, regex, exception, throw, mutation, query, foreign key, index.

**Diagnostics tab is exempted.** Inside Diagnostics, technical labels are acceptable. The owner has opted into power-user view. Secrets and credential values are still forbidden, even in Diagnostics.

---

## Code Discipline

### Out-of-scope discoveries

If during a directive's execution you discover work outside the directive's scope (unrelated test flakes, refactor opportunities, pre-existing bugs), open a separate commit prefixed `[PORTAL-OOS-XX]` and STOP for Product Owner approval. Never bundle out-of-scope work into a directive's commits.

### Behavioral tests required

Source-string assertions (grep-style matches against rendered HTML or function bodies) are insufficient. Any new wrapper, AI coordinator, or LLM-call path requires a behavioral test that:

- Mocks the provider fetch
- Asserts the request payload shape
- Asserts the response handling
- Asserts the side effect (DB write, AI Activity event, UI state change)

### Conventional commits

Every commit message follows the pattern. Commits that change multiple unrelated concerns are split. The pre-push hook enforces format; reviewers enforce scope.

### No silent fallback

The provider routing layer never silently switches providers. If Claude is unavailable, surface "Claude is not configured" to the owner. Do not route to Kimi without explicit `#kimi` tag.

---

## Stop Conditions

These conditions require an immediate halt and Product Owner sign-off before continuing.

1. **Any change that would expose secrets** in error messages, logs, owner-visible UI, AI Activity events, or response bodies. No exception. Fix before continuing.
2. **Any change to security-critical functions:** `pushBranch`, `cloneOrSyncBranch`, `assertSafeBranchName`, `assertBranchIsNotProtected`, `installPrePushHook`, `injectAgentEnvFile`, `cleanupWorkspace`, `buildAgentProcessEnv`, `normalizeAgentEnvVarMap`. Re-run all `INV-S4-*` contract tests.
3. **Any change that crosses Phase boundaries** in a single commit (e.g., touches both §1A and §4 code). Requires explicit Product Owner approval.
4. **Any change that adds a new LLM provider.** Requires Product Owner architectural review.
5. **Any change that adds a new env var requirement** at server startup. Document in this file before merging.

---

## Provider Failure Behavior

### Claude unavailable
Surface "Claude is not configured" or "Claude is temporarily unavailable" to the owner. Do not route to Kimi automatically. The owner can manually retry with `#kimi`.

### Kimi unavailable
Surface "Kimi is not configured" or "Kimi is temporarily unavailable" to the owner. Do not route to Claude automatically. The owner can manually retry with `#claude`.

### Both providers down
Hold the message. Surface "Both providers are unavailable. Try again in a minute." Do not loop-retry indefinitely.

### Empty Kimi response (known failure mode)
Treated as a provider error. Route the next turn to Claude with explicit failure context. Surface a plain-English note in the AI Activity feed.

---

## Phase Boundary Discipline

Phase 1 — Provider routing, OAuth, three-panel workspace — accepted.
Phase 2 — Multi-Project orchestration: §1A Project Setup Wizard accepted, §4 Branch Isolation accepted, §4.5 Project-to-Task Auto-Wiring authorized but pending, §1A-FU-04 wizard polish deferred, §8 Composer Queue deferred.
Phase 3 — Verified handoff workflow (§9), advanced skill management — not yet authorized.

Each Phase is closed by an explicit Product Owner acceptance package. No work begins on a deferred Phase without authorization.
