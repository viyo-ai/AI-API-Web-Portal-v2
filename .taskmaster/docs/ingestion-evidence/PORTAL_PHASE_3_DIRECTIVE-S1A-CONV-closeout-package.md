# §1A-CONV Conversational Project Onboarding — Product Owner Closeout Package

**Status:** Ready for Product Owner sign-off. Phase 3 should remain on hold until Product Owner acceptance is given in writing.

Commit URL: https://github.com/viyo-ai/AI-API-Web-Portal-v2/commit/25fd6cbab7153824aae3e74d333ff21eebf3d8b4

Commit URL: https://github.com/viyo-ai/AI-API-Web-Portal-v2/commit/14009b085b3f0d047bfd9da64e1ab145e49948b2

**Review branch:** `agent-work/s1a-conv`.

## Scope Delivered

§1A-CONV replaces the deferred §1A-FU-05 visual polish work with a v0 **Architect-in-Portal** foundation. The implementation adds a permanent Architect role surface, intent detection, conversational onboarding, conversational credential-management responses, a read-only Credentials Drawer, task rename, task sorting, per-project memory, a read-only memory viewer, and Advanced Setup escape hatches. The existing form wizard remains available as **Advanced Setup** and was not removed.

| Component | Delivered Surface | Evidence |
|---|---|---|
| Architect Role Module | `server/architectLLM.ts`, `server/prompts/architect.system.md` | Role is separate from Reviewer and build routing. |
| Intent Detection | `detectArchitectIntent` and `server/prompts/architect.intent.md` | Setup/credential/onboarding intents route to Architect; build turns remain on existing routes. |
| Conversational Onboarding | Home composer/onboarding card and Architect replies | Asks for display name, repo URL, token env var name, and base branch; promises test-before-save and explicit confirmation. |
| Conversational Credential Management | Architect credential response path | Token rotation guidance uses env var names only and directs owners to Manus environment variables plus Test now. |
| Credentials Drawer | Read-only UI rows with status and Test now | No token values are displayed or editable. |
| Task Rename | Inline display-name editing | Enter/blur save; Escape cancel; display title only. |
| Task Sort | Live and Archived task sections | Both are sorted by `lastActivityAt` descending. |
| Per-Project Memory Tier | `project_memory` schema/migration and scoped helpers | Additive table only; unique `(buildTargetId, key)` index; owner and build-target predicates on reads/writes. |
| Memory UI Viewer | Read-only Project Memory UI | Shows selected-project key/value facts and timestamps. |
| Advanced Setup Escape Hatch | Sidebar Projects, Credentials Drawer footer, Architect fallback | Existing form wizard stays reachable. |

## Validation Gates

| Gate | Requirement | Result | Notes |
|---|---|---|---|
| 1 | Ingestion evidence, invariant coverage, additive migration, database table presence | PASS | `.taskmaster/docs/ingestion-evidence/PORTAL_PHASE_3_DIRECTIVE-S1A-CONV-ingestion.md` was produced before code changes. `project_memory` table presence was verified. |
| 2 | TypeScript/project static check | PASS | `pnpm check` completed with no errors. |
| 3 | Focused §1A-CONV behavior and contract tests | PASS | `pnpm vitest run server/section1a-conv.contract.test.ts client/src/pages/Home.behavior.test.tsx` passed `2` files and `63` tests. |
| 4 | Full Vitest suite | PASS | `pnpm test --run` passed `25` files and `160` tests. |
| 5 | Production build | PASS | `pnpm build` completed successfully; only pre-existing chunk-size warnings were emitted. |
| 6 | Token-prefix grep verification | PASS | `TOKEN PREFIX GREP: PASS - no raw token prefixes detected in §1A-CONV source set`. |
| 7 | Diff sanity, dependency proof, backend/schema scope proof, environment health | PASS | `git diff --check` was clean; dependency diff was empty; managed project health check succeeded. |

## Token-Prefix Grep Verification

The final token-prefix verification returned the following pass proof:

```text
TOKEN PREFIX GREP: PASS - no raw token prefixes detected in §1A-CONV source set
```

The implementation preserves token safety by treating token values as out of bounds. Test fixtures construct token-like strings at runtime instead of committing literal provider prefixes. Architect uses environment variable names only and never stores, renders, logs, requests, or echoes token values.

## Full Architect System Prompt

```markdown
# Architect-in-Portal System Prompt

You are Architect-in-Portal, a permanent Claude Opus 4.7 role embedded inside the AI API Web Portal owner experience. Your purpose is to guide conversational project onboarding, credential management, and setup clarification. You are not the build executor and you do not bypass the owner approval gate for Kimi build turns.

You operate under these non-negotiable boundaries:

1. Preserve the existing form-based project setup wizard as Advanced Setup. Never remove or weaken paste detection, connection-test-before-save gating, or plain-English setup errors.
2. Treat all token values as out of bounds. Token values stay in Manus environment variables. Token values must remain in Manus environment variables. You may mention and validate environment variable names only.
3. If a user pastes a token-like value, refuse to echo it, instruct the user to put it in Manus environment variables, and continue using only the env var name.
4. Route only setup, onboarding, and credential-management conversations to Architect. Build work remains on the existing Auto, Claude, Kimi, or dual build routes.
5. Do not bypass the §9 approval gate. Any Kimi build plan still requires the existing owner approval flow before Kimi execution.
6. Store durable setup facts only in per-project memory scoped by owner user and build target. Cross-project memory bleed is forbidden.
7. Ask concise, practical questions that help the owner connect a project: project display name, GitHub repository URL, token environment variable name, default base branch, and confirmation after a successful connection test.
8. Explain failures in plain English and give the next safe action.
9. Never modify backend schema except through the additive project_memory table required by §1A-CONV.
10. When the owner wants the form path, direct them to Advanced Setup.

Architect response style should be direct, operational, and conservative. Avoid implementation promises when a connection test has not passed. Avoid requesting secrets. Use environment variable names such as BUILD_TARGET_GITHUB_TOKEN, never token values.
```

## Full Architect Intent Detection Prompt

```markdown
# Architect Intent Detection Prompt

Classify the owner’s latest portal composer message into exactly one intent: setup, credentials, onboarding, build, ambiguous, or other. Return a structured decision that includes shouldRouteToArchitect as the boolean routing key.

Return setup when the owner is trying to connect a project, add a repository, configure a GitHub repository, choose a base branch, or begin project onboarding.

Return credentials when the owner is discussing credential status, environment variable names, token rotation, connection testing, or credential verification. Token values themselves are never valid inputs to retain; if token-like text appears, classify as credentials and mark token redaction required.

Return onboarding when the owner is answering the setup questions needed to create or confirm a project connection.

Return build when the owner is asking to implement, fix, refactor, test, ship, or otherwise change product code. Build turns must remain on the existing Auto, Claude, Kimi, or dual route and must not be routed to Architect.

Return ambiguous when setup or credentials language appears in the same message as build work. Architect should ask the owner to choose setup or resend as a build turn, and must not silently execute build work.

Return other when none of the setup, credential, onboarding, or build signals are present.

The classification must preserve these boundaries: Architect never sees or stores token values, does not bypass the §9 Kimi approval gate, and uses per-project memory only for the selected project.
```

## Required Plain-Prose Answers

| Question | Answer |
|---|---|
| Where is the Architect system prompt stored, and how is it loaded? | The system prompt is stored at `server/prompts/architect.system.md`. It is loaded by `loadArchitectSystemPrompt()` in `server/architectLLM.ts`, which resolves `server/prompts/architect.system.md` from `process.cwd()` and reads it with `readFileSync`. The intent prompt follows the same pattern through `loadArchitectIntentPrompt()` and `server/prompts/architect.intent.md`. |
| When the owner says “my token changed for VIYO,” what exact dialogue does Architect produce? | Intent detection sees `token changed` as a credential signal and routes to Architect. If a project is selected, Architect responds: “I can help verify credential status for the selected project by env var name only. If a token changed, update it in Manus environment variables first, then run Test now in the Credentials Drawer. If the credential mapping itself needs to change, open Advanced Setup after the new env var exists.” If no project is selected, Architect first asks the owner to select or connect a project and repeats that token values must stay in Manus environment variables. |
| What happens if intent detection misclassifies a build message as setup? How does the owner correct it? | Ambiguous setup-plus-build language is routed to Architect only to ask for clarification; it does not execute build work. The owner-visible correction path is to resend the work as a build turn with `#kimi` or `#claude`, which keeps it on the existing build route. The exact ambiguous response says: “This could be setup work or a build request. For setup, reply with the project name, GitHub repository URL, GitHub token environment variable name, and default base branch. For build work, resend the message with #kimi or #claude so it stays on the existing build route. If you prefer the form-based path, open Advanced Setup.” |
| How is per-project memory isolation enforced at the query level? | `listProjectMemoryForTarget(ownerUserId, buildTargetId)` filters with both `eq(projectMemory.ownerUserId, ownerUserId)` and `eq(projectMemory.buildTargetId, buildTargetId)`. `upsertProjectMemoryForTarget` uses the same owner/build-target/key predicates for lookup, update, and final readback. The schema adds a unique `(buildTargetId, key)` index, and the focused contract test seeds separate build targets to verify no cross-project rows leak. |
| Where is the Advanced Setup escape hatch reachable from? | Advanced Setup remains reachable from the sidebar Projects section, the Credentials Drawer footer, and Architect fallback copy. The onboarding and credential-management responses both direct the owner to Advanced Setup when they prefer or need the form-based path. |

## Boundary Statement

The existing form wizard stays as Advanced Setup. All §1A-FU-04 safety guarantees apply unchanged: paste-detection, connection-test before save, and plain-English errors. §9 approval gate still applies to all Kimi build turns. Architect does not bypass approval. Token values stay in Manus env vars. Architect operates on env var names only. The new schema is additive only: one new table, `project_memory`, through `0013_project_memory.sql`; no existing tables were changed. Per-project memory isolation is enforced at query level, and cross-project bleed is forbidden.

## Product Owner Gate

This package is delivered for Product Owner review. §1A-CONV should not be marked accepted, and Phase 3 should not be closed, until the Product Owner signs off in writing.
