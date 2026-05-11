# Portal Build Log

## Phase 1 Complete — Build Targets, Branch Isolation, and Composer Queue/Stop

Phase 1 is complete after Product Owner acceptance of all three directed sections. Section 1 shipped Build Targets, including schema, server, tRPC, and UI support, and was accepted at commit `e0571f3`. Section 4 shipped branch isolation, environment-variable injection, push-policy enforcement, and protected-branch push blocking, and was accepted at commit `52bf8376`. Section 8 shipped Composer Behavior During Generation, including queued submissions during active generation and explicit Stop behavior, and was accepted at commit `0649bb0`.

| Phase 1 section | Accepted commit SHA | Accepted shipped scope |
|---|---:|---|
| Section 1 — Build Targets | `e0571f3` | Build target persistence, branch support, server/tRPC contracts, and Build Mode UI surface. |
| Section 4 — Branch Isolation, Push Policy, and Environment Variable Injection | `52bf8376` | Isolated build branches, protected-branch enforcement, push-policy mutation, and secret-name-only environment injection. |
| Section 8 — Composer Behavior During Generation | `0649bb0` | Composer queue during active generation, visible queued state, Stop handling, and stop-registry/tool-registry separation. |

There are no Product Owner-approved Phase 1 deviations pending from these accepted sections. The final Section 8 acceptance evidence was supplied for PO review from the local repository because the GitHub web cache was stale. Phase 1 is now closed, and the project must not begin Phase 2 work until the Product Owner delivers `PORTAL_PHASE_2_DIRECTIVE.md`.

Product Owner notification: "Phase 1 complete. Build Targets, branch isolation, queue/Stop behavior shipped. All acceptance gates passed. Ready for PO review and Phase 2 directive."

## Phase 2 Section 2 Complete — Governance Auto-Load for Build Mode

Section 2 shipped additive per-Build-Target governance auto-load without starting Section 3 or modifying accepted Phase 1 features. Build Targets now store ordered governance file configuration and budget settings; Build Mode turns resolve task → Build Branch → Build Target, load required and optional governance documents safely from the target workspace, block model execution when required governance files are missing, and prepend the loaded governance packet to wrapper prompts. The governance packet enforces provider-aware budget behavior by dropping optional documents first and truncating required documents only with explicit AI Activity evidence.

| Section 2 acceptance area | Result | Evidence |
|---|---|---|
| Schema and migration | Passed | Added additive Build Target governance columns and generated migration `drizzle/0008_chief_night_nurse.sql`. |
| Governance loader and blocking | Passed | Added safe loader and Build Mode gate before wrapper model execution; non-Build Mode legacy behavior remains unaffected. |
| Prompt injection and budget guard | Passed | Wrapper prompt assembly now receives governance context and logs budget drop/truncation evidence. |
| Owner Governance Files UI | Passed | Build Target settings now support add, remove, reorder, required, dynamic, role, resolver, and budget controls with validation. |
| Automated validation | Passed | `pnpm check`, `pnpm test` with 22 files and 94 tests passing, and `pnpm build` all completed successfully. |

Product Owner boundary: Section 2 is complete for review. Section 3 has not been started and must remain paused until the Product Owner explicitly instructs the build to proceed.

## Phase 2 §3A Complete — Plain-Language Vocabulary Rename

§3A from `PHASE_2_SECTION_3_REWRITE.md` is complete as the only active work item from the rewritten Section 3 directive. The implementation renames owner-facing Phase 1 and Section 2 vocabulary to plain-language labels while preserving existing database fields, tRPC procedure keys, environment-variable names, and internal build-runner contracts for backward compatibility.

| §3A acceptance area | Result | Evidence |
|---|---|---|
| Project vocabulary | Passed | Owner-facing Build Target/Build Mode language was renamed to Project/project-mode language in the primary UI and related human-readable messages while preserving internal `buildTarget` and `buildBranch` identifiers. |
| Rule-book vocabulary | Passed | Owner-facing Governance Files language was renamed to Project rule books; loader/module names and Section 2 rule-book injection behavior remain compatible with the accepted Section 2 implementation. |
| Plumbing-label cleanup | Passed | User-visible labels for validation, service checks, environment injection, commit-message policy, context limit, and push checks now use plain-language wording. |
| Focused acceptance coverage | Passed | `client/src/pages/Home.behavior.test.tsx` includes a §3A rendered-UI test that proves approved labels are present and banned owner-facing legacy labels are absent from the default visible UI copy. |
| Automated validation | Passed | `pnpm check`, `pnpm test` with 22 files and 95 tests passing, and `pnpm build` completed successfully. |

Product Owner boundary: §3A is complete for review. Rewritten §3 Skill Libraries and original §1A wizard work have not been started and must remain paused until Product Owner approval is received.

## Phase 2 Rewritten §3 Complete — Skill Libraries
Rewritten §3 from `PHASE_2_SECTION_3_REWRITE.md` is complete as the approved Skill Libraries section after §3A acceptance. The implementation adds an owner-facing Skill Libraries workspace with a Manus-style card grid, four approved creation paths, and server-backed persistence/import flows while preserving accepted §3A vocabulary and Section 2 Project rule book ordering.

| Rewritten §3 acceptance area | Result | Evidence |
|---|---|---|
| Four creation paths | Passed | Skill Libraries supports Build with AI, Upload a skill, Add from official, and Import from GitHub from the owner-facing workspace. |
| Skill persistence and contracts | Passed | Added additive Skill Library persistence, task selection records, official/catalog duplication, uploaded/AI/GitHub source metadata, and tRPC procedures for list/create/update/delete/selection/import flows. |
| Manus-style Skill Libraries UI | Passed | Added `client/src/pages/SkillLibraries.tsx` with rounded card-grid browsing, source/scope/status badges, filters, detail tabs, and creation dialogs. |
| Prompt integration | Passed | Selected and auto-resolved Skill Libraries are rendered after Project rule books and before the user turn-specific request, preserving accepted Section 2 ordering. |
| Regression coverage | Passed | Added `server/section3.skills.contract.test.ts` covering schema, backend procedure surface, creation sources, prompt integration, card-grid creation paths, and §3A/Section 2 non-regression. |
| Automated validation | Passed | `pnpm check`, `pnpm test` with 23 files and 101 tests passing, and `pnpm build` completed successfully. Browser smoke loaded the OAuth-protected app shell; authenticated workspace UI remains covered by automated tests because the browser session was not logged into Manus OAuth. |

Product Owner boundary: rewritten §3 is complete for review. §1A has not been started and must remain paused until Product Owner approval is received.

## Phase 2 Rewritten §3 Approval Follow-up — Task ID and Chat Markdown Restoration
The Product Owner approved rewritten §3 and identified two closeout corrections before §1A. The original rewritten §3 commit `650fbf94bd5620abaaa20febfe445c5e2778f19a` should be associated with task ID `[PORTAL-P2-S3-01]`; the original commit was not force-pushed or rewritten. A follow-up commit records this directive-compliance note and uses the required prefixed commit-message format for future continuity.

| Follow-up area | Result | Evidence |
|---|---|---|
| Commit-message directive note | Corrected by follow-up | Original commit `650fbf9` remains intact; this build log now maps rewritten §3 to `[PORTAL-P2-S3-01]` and future commits must use `type(scope): description [TASK-ID]`. |
| Assistant markdown rendering | Corrected by follow-up | `client/src/components/AIChatBox.tsx` restores Streamdown rendering for assistant messages so headings, lists, code blocks, and other Markdown are formatted in the chat UI. |
| Test compatibility rationale | Corrected by follow-up | The temporary plain-text replacement had been made only to bypass a Vitest dependency issue where Streamdown imported KaTeX CSS through an externalized package. The durable fix keeps Streamdown and inlines Streamdown/KaTeX-related dependencies in `vitest.config.ts` so tests transform the CSS dependency instead of degrading runtime UX. |
| Regression coverage | Added by follow-up | `server/section3.skills.contract.test.ts` now asserts Streamdown remains wired in the assistant chat component and the Vitest dependency-transform guard remains present. |

Product Owner boundary remains unchanged: §1A has not been started and must remain paused until both follow-ups are validated and reported.
## Phase 2 §1A Complete — LLM-Driven Project Setup Wizard

§1A from `PORTAL_PHASE_2_DIRECTIVE.md` is complete for acceptance review. The implementation adds a wizard-first Project setup flow that analyzes a Project name, Repo URL, optional commit SHA, and optional Project notes through the server-side wizard contract, then presents reviewable recommendations before creating the Project. The existing manual Project configuration remains available as the Advanced setup fallback.

| §1A acceptance area | Result | Evidence |
|---|---|---|
| LLM-driven wizard contract | Passed | Added secure server-side wizard recommendation and completion procedures backed by cached wizard sessions, using existing server-side LLM helpers and safe fallback recommendations when provider output is unavailable or malformed. |
| Project setup wizard UI | Passed | Added wizard-first UI copy using accepted §3A vocabulary: Project, Repo URL, Project rule books, AI Activity, and Project setup. |
| Review-before-create workflow | Passed | Wizard recommendations populate Project setup fields for description, branch, install/build/test/service commands, AI Activity checks, environment variable mapping, and Project rule books before Project creation. |
| Manual fallback preservation | Passed | Advanced setup remains available and continues to expose the existing manual Project configuration flow with Test connection and Add Project controls. |
| Regression coverage | Passed | `client/src/pages/Home.behavior.test.tsx` covers wizard analyze/complete behavior, §3A vocabulary, recommendation review cards, completion payload mapping, and manual fallback preservation; `server/section1.build-targets.contract.test.ts` covers wizard cache schema and tRPC procedure surfaces. |
| Automated validation | Passed | `pnpm check`, `pnpm test -- --run` with 23 files and 103 tests passing, focused §1A tests passing, and `pnpm build` completed successfully. A first full-test attempt hit transient external TLS socket resets against Anthropic/Cloudflare, and the same external credential tests passed immediately afterward and in the final full suite. |

Product Owner boundary: §1A is complete for review. Phase 2 is not being declared complete; the build is stopped at §1A acceptance pending Product Owner review.

## Phase 2 §1A Follow-up Complete — Cache-HIT Behavior, Model Visibility, and Timeout Budget

The §1A Product Owner follow-up items are complete and remain limited to the Project setup wizard acceptance corrections. FU-01 adds a behavioral cache-HIT tRPC test proving that a valid wizard cache entry returns `cacheStatus: "hit"` after connection and repository context checks while bypassing both LLM analysis and cache writes. FU-02 adds one-time operational model visibility logging for the Project analysis model. FU-03 documents and enforces the directive's 90-second Project analysis budget as one composite full-path timeout around repository context, cache lookup, LLM analysis, and cache write work.

| §1A follow-up area | Result | Evidence |
|---|---|---|
| FU-01 behavioral cache-HIT test | Passed | `server/section1.build-targets.contract.test.ts` now mocks connection, clone/revparse, wizard cache lookup, LLM analysis, and cache writes, then asserts cache-HIT response and LLM/cache-write bypass while preserving the structural cache-ordering test. |
| FU-02 model visibility | Passed | `server/routers.ts` logs `[wizard] Project analysis model: ${CLAUDE_DEFAULT_MODEL}` once on first `analyzeWizard` invocation. |
| FU-03 composite timeout intent | Passed | `analyzeWizard` now wraps the full repository-context/cache/LLM/cache-write path in one `withWizardTimeout` call and includes an inline directive-intent comment. |
| Validation-only smoke-test hardening | Passed | `server/ai-provider-secrets.test.ts` now retries transient fetch exceptions and treats repeated provider-network failures the same way as retryable provider HTTP unavailability, without changing product runtime behavior. |
| Automated validation | Passed | `pnpm check`, `pnpm test --run server/section1.build-targets.contract.test.ts` with 4 tests passing, and `pnpm test --run` with 23 files and 105 tests passing. An initial full-suite attempt exposed repeated Anthropic TLS `ECONNRESET` failures in the live credential smoke test; deterministic product tests passed, connectivity to Anthropic was confirmed separately, and the validation-only retry hardening allowed the final full suite to complete successfully. |

Product Owner boundary: §4 Branch Isolation remains paused. No §4 implementation work has begun, and the build must wait for explicit Product Owner confirmation of this §1A follow-up before proceeding.

## Phase 2 §4 Complete — Branch Isolation, Push Policy, and Environment Injection

§4 from the authorized Phase 2 continuation directive is complete for Product Owner acceptance review. The implementation remains limited to Branch Isolation, Push Policy, and Environment Variable Injection; §8 Composer Queue/Stop work has not been started. The existing `buildRunner` scaffold was extended rather than replaced, and Project setup now creates isolated `agent-work/` branches with per-branch workspace paths, protected-branch push blocking, mapped-only agent environment generation, and cleanup behavior.

| §4 acceptance area | Result | Evidence |
|---|---|---|
| Branch namespace and isolation | Passed | Build Branch names are required to start with `agent-work/`, unsafe names are rejected, and workspace paths are finalized with the persisted Build Branch ID so each branch receives a distinct workspace root. |
| Push policy | Passed | Protected branches are blocked before network push attempts, push results are returned as structured `pushed`, `blocked`, or `error` states, and cloned workspaces install a defense-in-depth pre-push hook that rejects protected remote refs. |
| Environment injection | Passed | `.env.agent` is generated in the workspace root from `agentEnvVarMapJson`, `.env.agent` is gitignored, missing mapped source variables fail closed, and the isolated child-process environment helper exposes only configured mapped variables. |
| Project setup and existing Project UI | Passed | Wizard-created Projects and existing Project branch creation both use the same id-finalized isolated workspace path and agent environment mapping. The UI defaults branch creation to the `agent-work/` namespace and renders structured protected-push blocks as owner-readable policy messages instead of transport failures. |
| Cleanup | Passed | Build Branch deletion removes the workspace path, including `.git`, `.env.agent`, and uncommitted files, while removing the Build Branch record through the existing owned-branch deletion flow. |
| Regression coverage | Passed | `server/section4.branch-policy.contract.test.ts` covers all six §4 invariants, including prefix enforcement, workspace isolation, mapped-only env behavior, pre-push protection, structured protected push results, and cleanup. `client/src/pages/Home.behavior.test.tsx` covers `agent-work/` branch creation, protected-push UI handling, and deletion behavior. |
| Automated validation | Passed | `pnpm check`, `pnpm test -- --run`, and `pnpm build` completed successfully after the final §4 implementation repair. |

Product Owner boundary: §4 is complete for acceptance review. Phase 2 is not being declared complete, and §8 Composer Queue/Stop remains paused until Product Owner approval explicitly authorizes the next section.

## T73 Complete — Studio Editing Router

T73 is complete for Product Owner review. The implementation is intentionally bounded to the existing wrapper routing and §9 handoff architecture: Studio-class image or visual-editing directives are classified before provider execution, routed to Kimi K2.6 for implementation drafting, surfaced through the existing owner approval gate, and reviewed by Claude Opus 4.7 with the required §9 `code-review-protocol` skill metadata. No database schema, UI surface, deployment pipeline, or unrelated build-runner architecture was changed.

| T73 acceptance area | Result | Evidence |
|---|---|---|
| Studio classification | Passed | `server/wrapperLLM.ts` exports deterministic Studio directive detection while preserving OpenAI routing for normal non-Studio messages. |
| Kimi execution route | Passed | `server/routers.ts` forces Studio directives to Kimi execution after OpenAI classification and records Studio metadata in the route-decision event. |
| §9 owner approval and verifier handoff | Passed | The existing approval gate is reused for Studio turns, and Claude verifier review receives the `code-review-protocol` skill metadata with explicit Studio verifier requirements. |
| Regression coverage | Passed | `server/aiRouting.provider-adapters.test.ts` adds a Studio route integration test covering OpenAI classification, owner approval surfacing, Kimi execution, and Claude §9 verifier review; `server/workspace.security.test.ts` mock exports were updated to preserve existing security coverage. |
| Automated validation | Passed with scoped caveat | `pnpm check`, `vitest run server/workspace.security.test.ts server/aiRouting.provider-adapters.test.ts`, and `pnpm build` passed. An unrestricted `pnpm test` run still reports pre-existing environment/schema smoke-test failures, including live provider credential checks, GitHub token validation, and the v2 schema startup table assertion; those failures were not introduced by T73 and are outside this bounded router patch. |

Product Owner boundary: T73 is ready for review as a router/verifier patch only. No new Studio UI, media-generation runtime, database migration, or deployment publication was started in this change set.
