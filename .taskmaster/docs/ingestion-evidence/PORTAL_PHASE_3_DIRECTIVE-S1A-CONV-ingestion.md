# PORTAL_PHASE_3_DIRECTIVE — §1A-CONV Ingestion Evidence

**Document ingested:** `PORTAL_PHASE_3_DIRECTIVE_S1A_CONV_CONVERSATIONAL_ONBOARDING_1.md`  
**Ingestion artifact:** `.taskmaster/docs/ingestion-evidence/PORTAL_PHASE_3_DIRECTIVE-S1A-CONV-ingestion.md`  
**Prepared by:** Manus AI  
**Prepared before code changes:** Yes. This file is the required pre-implementation evidence artifact for §1A-CONV.  
**Task classification:** Code Build, Size L. The directive adds a new subsystem role, an additive database table, server procedures, UI surfaces, and at least ten new tests, so the task is not a small bug fix or single-file change.  
**Authorization note:** The directive text states that authorization is pending until the Product Owner explicitly accepts in writing. The Product Owner’s chat instruction, “Begin §1A-CONV implementation now per the directive,” is treated as the written authorization to begin.

## Conservative Verdict

**Verdict: PASSED FOR IMPLEMENTATION PLANNING, NOT YET PASSED FOR COMPLETION.** The directive has been read section by section, all hard boundaries have been extracted as enforceable requirements, and each of the ten `INV-S1A-CONV-XX` invariants is mapped to implementation surfaces and verification gates. Implementation may proceed only within the scope captured below. Completion cannot be claimed until the seven validation gates pass, closeout proofs are generated, commits are pushed, and the Product Owner receives the mandated sign-off package.

> The replacement scope is not a visual-polish task. §1A-FU-05 is deferred indefinitely. §1A-CONV introduces conversational onboarding, credential visibility/testing, task-management polish, and a per-project memory tier while preserving the existing form wizard as Advanced Setup.

## Section Index and Summaries

| Section | Lines | Classification | Summary |
|---|---:|---|---|
| Title and authorization | 1-9 | Hybrid | The directive defines §1A-CONV as the replacement for §1A-FU-05 and positions it as the v0 foundation for Architect-in-Portal. The work must begin only after written Product Owner authorization and must stop at §1A-CONV acceptance for review. |
| Source-of-truth observations | 11-18 | Reference | The directive explains why the form wizard is demoted to Advanced Setup, identifies existing Claude/Reviewer and composer-routing seams, confirms token-value storage remains in Manus environment variables, and notes that task title and last-activity data already exist. |
| Execution discipline | 22-29 | Constraint | The directive requires this ingestion evidence artifact before code changes, requires use of existing scaffolds, mandates conventional commit prefixes, forbids bundling out-of-scope work, and requires behavioral tests for functional invariants. |
| Hard boundaries | 32-47 | Constraint | The directive forbids removing the form wizard, weakening §1A-FU-04 safety behavior, modifying queue/approval mechanics, exposing token values, adding providers/dependencies, modifying Diagnostics, or replacing existing Kimi/Reviewer routing. |
| Component 1 — Architect Claude Role Module | 52-57 | Work Item + Constraint | A new Architect-specific Claude role must be introduced separately from Reviewer Claude. It can handle setup/credentials/onboarding with defined tools but cannot modify schema, echo tokens, bypass §9, or route to Kimi. |
| Component 2 — Intent Detection in Composer | 58-64 | Work Item + Constraint | Auto-route composer messages matching setup/credentials/onboarding to Architect while preserving existing routing for build work. Ambiguity must present an owner choice with a chat-default escape behavior. |
| Component 3 — Conversational Project Onboarding Flow | 65-81 | Work Item + Constraint | Architect must guide a stepwise onboarding conversation, validate name/repo/env-var/branch inputs, run connection testing before save, and call the existing save flow after explicit owner confirmation. |
| Component 4 — Conversational Credential Management | 83-92 | Work Item + Constraint | Architect must support token-rotation conversations by identifying project context, instructing the owner to update Manus env vars, running connection tests, and never requesting or echoing token values. |
| Component 5 — Credentials Drawer | 94-104 | Work Item + Constraint | A new credentials drawer must show one row per known project credential with label, env var, status, timestamp, and Test now button. It is read-only and must never reveal token values. |
| Component 6 — Task Rename | 106-110 | Work Item + Constraint | Task names become inline-editable display names only. Enter or blur saves, Escape cancels, validation limits title content, and persistence must use `tasks.rename`. |
| Component 7 — Task List Sort | 112-115 | Work Item + Constraint | Sidebar tasks must be sorted by `lastActivityAt` descending. Live and Archived tasks are separate sections, both sorted most-recently-used first, with no user sort toggle. |
| Component 8 — Per-Project Memory Tier | 117-127 | Work Item + Constraint | A new additive `project_memory` key-value table is required with a unique `(buildTargetId, key)` index. All Architect memory reads and writes must be scoped to the active project. |
| Component 9 — Architect Memory UI Surface | 129-131 | Work Item + Constraint | A read-only Project Memory UI surface must show per-project key/value entries and timestamps so the owner can inspect what Architect knows. |
| Component 10 — Advanced Setup Escape Hatch | 133-138 | Work Item + Constraint | The existing form wizard remains accessible as Advanced Setup from the Credentials Drawer footer, sidebar Projects section, and Architect fallback. No visual polish is required for the form in this directive. |
| Functional invariants | 142-155 | Constraint + Verification | Ten invariants define required routing, token-safety, save-path equivalence, safety-gate inheritance, credentials drawer behavior, task rename/sort, per-project memory isolation, and Advanced Setup preservation. |
| Functional acceptance criteria | 159-179 | Verification | Acceptance requires end-to-end conversational onboarding, credential drawer and rotation behavior, task rename/sort, Advanced Setup preservation, §9 gate preservation, token-prefix grep proof, seven validation gates, at least ten new tests, and minimized backend changes. |
| Out-of-scope | 182-195 | Constraint | Phase 4 expansion, VIYO onboarding, §1A-FU-05 visual polish, token UI editing, configurable sort, single-list archive view, slug rename, cross-project memory, §9 changes, new providers, and Reviewer replacement are forbidden. |
| Architectural notes | 199-234 | Reference + Work Item | The directive recommends `architectLLM.ts` or role-parameterized wrapper logic, `server/prompts/architect.system.md`, an intent classifier prompt, routeMode `architect`, migration `0013_project_memory.sql`, `CredentialsDrawer.tsx`, inline edit UI, task sorting, token grep proof, and Advanced Setup discoverability. |
| Commit discipline and closeout package | 237-271 | Constraint + Delivery | Commits must use `[PORTAL-P3-S1A-CONV-XX]`, be logically grouped, and push only after all gates pass. The final Product Owner message must include commit URLs, validation table, full Architect prompt, intent prompt, diffs, grep proof, test delta, five plain-prose answers, and the exact boundary statement. |

## Hard Requirement Extraction

| ID | Requirement | Applies To | Source Lines | Enforcement |
|---|---|---|---:|---|
| `PORTAL-P3-S1A-CONV-HR-01` | Produce this ingestion evidence file before implementation and before claiming completion. | Documentation, process | 22-29 | File exists before code changes and is referenced in closeout. |
| `PORTAL-P3-S1A-CONV-HR-02` | Preserve the existing form wizard as Advanced Setup; do not remove it. | Frontend, tests | 36, 133-138, 187 | UI and tests must prove reachability. |
| `PORTAL-P3-S1A-CONV-HR-03` | Preserve all §1A-FU-04 safety behavior: paste detection, connection-test-before-save, and plain-English errors. | Architect flow, form wizard, server | 37, 81, 149 | Existing tests must pass unchanged; new conversational variants must be added. |
| `PORTAL-P3-S1A-CONV-HR-04` | Preserve §8 queue capacity and mechanics. | Composer/orchestration | 38, 62 | No queue-capacity or mechanics changes in diff. |
| `PORTAL-P3-S1A-CONV-HR-05` | Preserve §9 approval workflow for Kimi build turns; Architect never bypasses approval. | Orchestration, approval card | 39, 56, 167, 193 | No approval state-machine changes; tests ensure build intents route as before. |
| `PORTAL-P3-S1A-CONV-HR-06` | Never store, render, log, request, or echo token values; operate on env var names only. | Prompts, server, UI, tests | 40, 54, 72, 92, 103, 147, 168 | Prompt hard rules, paste-detection tests, and token-prefix grep proof. |
| `PORTAL-P3-S1A-CONV-HR-07` | Architect must not write to the database without explicit user confirmation. | Architect flow, server procedures | 41, 78, 126 | Onboarding save flow must require confirmation. |
| `PORTAL-P3-S1A-CONV-HR-08` | No new providers or dependencies; use existing Anthropic/OpenAI routing and existing UI stack. | Package, server, frontend | 42-43, 194 | Dependency diff proof and package lock review. |
| `PORTAL-P3-S1A-CONV-HR-09` | Do not modify the Diagnostics tab. | Frontend | 44 | Diff review and focused UI test preservation. |
| `PORTAL-P3-S1A-CONV-HR-10` | Enforce per-project memory isolation by `buildTargetId`; cross-project memory bleed is forbidden. | Schema, DB queries, router | 45, 127, 154, 192 | Project-memory contract tests seed two projects and assert scoped reads. |
| `PORTAL-P3-S1A-CONV-HR-11` | Architect handles only setup, credentials, and onboarding intents; it does not replace Kimi or Reviewer Claude. | Role routing | 46, 195 | Routing tests for setup vs build messages. |
| `PORTAL-P3-S1A-CONV-HR-12` | Add only one additive schema table: `project_memory`, migration `0013_project_memory.sql`; do not change existing tables. | Drizzle, migration | 119-125, 209-224 | Schema diff proof and migration review. |
| `PORTAL-P3-S1A-CONV-HR-13` | Implement specified new procedures only: `architect.startConversation`, `architect.sendMessage`, `tasks.rename`, `projectMemory.list`, `projectMemory.set`. | tRPC | 178 | Router diff and tests. If an existing `tasks.rename` exists, reuse and verify instead of duplicating. |
| `PORTAL-P3-S1A-CONV-HR-14` | Run all seven validation gates before push. | Validation | 169-176 | Gate table with command output captured. |
| `PORTAL-P3-S1A-CONV-HR-15` | Add at least ten new tests, one per invariant, plus integration coverage for full conversational flow. | Tests | 177 | Test-count delta and invariant mapping. |
| `PORTAL-P3-S1A-CONV-HR-16` | Use conventional commits prefixed `[PORTAL-P3-S1A-CONV-XX]`; out-of-scope discoveries require `[PORTAL-OOS-XX]` proposal commits and STOP. | Git/process | 26-27, 237-252 | Commit log review. |
| `PORTAL-P3-S1A-CONV-HR-17` | Final handoff must include the full Architect system prompt, intent prompt, token-prefix grep proof, five plain-prose answers, and boundary statement. | Delivery | 254-271 | Closeout package checklist. |

## Invariant Coverage Map

| Invariant | Implementation Coverage Required | Verification Evidence Required | Notes |
|---|---|---|---|
| `INV-S1A-CONV-01` | Composer Auto intent detection routes setup/credentials/onboarding to Architect, while build work continues existing routing. | Behavioral test with “connect a project” and “implement feature X.” | Must not touch §8 queue mechanics or §9 approval. |
| `INV-S1A-CONV-02` | Architect prompt and flow reject token-looking pasted values and never echo token substrings. | Behavioral test with `ghp_test123`-like input and token-prefix grep proof. | Test fixtures must avoid real token values. |
| `INV-S1A-CONV-03` | Conversational save reuses existing `buildTargets.create` validation and write shape. | Contract test comparing conversational and form-wizard create payload shape/resulting record. | Requires explicit owner confirmation before DB write. |
| `INV-S1A-CONV-04` | Conversational path inherits §1A-FU-04 paste detection, connection-test-before-save, plain-English errors, and edit-invalidates-test behavior. | Existing §1A-FU-04 tests pass unchanged; new conversational variants pass. | No existing locked tests should be modified to weaken assertions. |
| `INV-S1A-CONV-05` | Credentials Drawer shows project credential rows with safe env var names and no token values. | UI behavioral test with two projects and DOM token-prefix absence assertion. | Drawer is read-only. |
| `INV-S1A-CONV-06` | Drawer “Test now” calls existing `testConnection` and updates status/timestamp. | UI mutation test for success/failure display. | Should reuse existing build-target test procedure. |
| `INV-S1A-CONV-07` | Sidebar task title inline edit saves on Enter/blur and cancels on Escape through `tasks.rename`. | UI test for edit/save/cancel and mutation call. | Display name only; no slug or ID change. |
| `INV-S1A-CONV-08` | Live and Archived task sections sort by `lastActivityAt` descending. | UI or server test with seeded timestamps and archive state. | No alternate sort toggles. |
| `INV-S1A-CONV-09` | Project memory DB helper and procedure scope all reads/writes by `buildTargetId`. | Server contract test seeding two projects and asserting no cross-project rows leak. | This is a security boundary. |
| `INV-S1A-CONV-10` | Advanced Setup remains reachable from required entry points and existing wizard behavior stays unchanged. | Existing form-wizard tests pass unchanged; new drawer/sidebar reachability test passes. | The form is not visually polished in this directive. |

## Surface-by-Surface Inspection and Implementation Notes

| Component | Surface / Layer | Expected Change | Locked Non-Change |
|---|---|---|---|
| Architect Role Module | Server AI role module, prompt file | Add Architect-specific Claude role and full system prompt, separate from Reviewer. | Do not replace Reviewer Claude or Kimi routing. |
| Intent Detection | Composer Auto routing | Classify setup/credentials/onboarding vs build/other and route to Architect when appropriate. | Do not change queue capacity, Stop behavior, or Kimi approval workflow. |
| Conversational Onboarding | Center task thread/composer plus server flow | Guide name, repo, env-var, branch, test, confirmation, and save. | Do not save before successful connection test or explicit owner confirmation. |
| Conversational Credential Management | Architect flow and build-target test | Guide token rotation by env var name and verify after owner confirms env update. | Do not ask for, accept, store, or echo token values. |
| Credentials Drawer | Sidebar entry and drawer/modal surface | Add read-only rows with project, label, env var, status, timestamp, and Test now. | Do not provide edit-in-place for token values. |
| Task Rename | Sidebar task list | Add inline edit for task display title, Enter/blur save, Escape cancel. | Do not rename slugs, IDs, build branches, or repository paths. |
| Task Sort | Sidebar task list | Sort live and archived tasks by `lastActivityAt` descending in separate sections. | Do not add a user-configurable sort toggle. |
| Per-Project Memory Tier | Drizzle schema, migration, DB helpers, tRPC | Add additive `project_memory` table and scoped read/write helpers. | Do not alter existing tables or allow unscoped queries. |
| Memory UI Viewer | Task Inspector right panel | Add read-only memory viewer tab or extend Context tab with key/value entries and timestamps. | Do not modify Diagnostics tab. |
| Advanced Setup Escape Hatch | Sidebar Projects, Credentials Drawer footer, Architect fallback | Keep the existing form wizard reachable as Advanced Setup. | Do not remove or visually overhaul the form wizard under §1A-CONV. |

## Validation Gate Extraction

| Gate | Command / Proof | Required Result |
|---|---|---|
| 1 | `pnpm check` | Pass |
| 2 | `pnpm test --run client/src/pages/Home.behavior.test.tsx` | Pass |
| 3 | `pnpm test --run server/section1.build-targets.contract.test.ts` | Pass |
| 4 | `pnpm test --run server/architect.role.contract.test.ts` | Pass |
| 5 | `pnpm test --run server/project-memory.contract.test.ts` | Pass |
| 6 | `pnpm test --run` | Pass |
| 7 | `pnpm build` | Pass |
| Closeout proof A | Token-prefix grep over commit diff for `ghp_`, `github_pat_`, `gho_`, `ghu_`, `ghs_`, `ghr_` | Zero new matches outside existing paste-detection regex/tests |
| Closeout proof B | Dependency diff (`package.json`, lockfile) | No new packages |
| Closeout proof C | Backend/schema diff review | Existing tables unchanged; only additive `project_memory` schema/migration |
| Closeout proof D | Prompt disclosure | Full `server/prompts/architect.system.md` and intent detection prompt included |
| Closeout proof E | Test-count delta | At least ten new tests mapped to invariants plus conversational-flow integration coverage |

## Implementation Scope Lock

The implementation may touch the following file families only if inspection confirms they are the existing anchors for this feature: `drizzle/schema.ts`, `drizzle/migrations/0013_project_memory.sql`, server AI role/prompt files, `server/db.ts`, `server/routers.ts`, focused server contract tests, `client/src/pages/Home.tsx`, a new `client/src/components/CredentialsDrawer.tsx`, and focused `Home.behavior.test.tsx` updates. Any need to modify Diagnostics, queue-capacity logic, approval state-machine logic, dependency manifests, or unrelated infrastructure is an out-of-scope discovery and must be handled through a separate `[PORTAL-OOS-XX]` proposal commit followed by a stop for Product Owner approval.

## Required Closeout Questions Captured Up Front

| Question | Evidence to Provide at Closeout |
|---|---|
| Where is the Architect system prompt stored, and how is it loaded? | Path, loader/import logic, and full prompt content. |
| When the owner says “my token changed for VIYO,” what exact dialogue does Architect produce? | Plain-prose flow with the actual response copy or prompt-driven response template. |
| What happens if intent detection misclassifies a build message as setup? How does the owner correct it? | Escape/override behavior and owner-visible correction path. |
| How is per-project memory isolation enforced at the query level? | DB helper/procedure predicate showing `buildTargetId` scoping and server test evidence. |
| Where is the Advanced Setup escape hatch reachable from? | Complete entry-point list: sidebar Projects, Credentials Drawer footer, Architect fallback, plus any implemented composer suggestion. |

## References

| Reference | Evidence Used |
|---|---|
| §1A-CONV directive lines 1-9 | Authorization status, repo/branch, replacement scope, Architect-in-Portal context. |
| §1A-CONV directive lines 22-47 | Execution discipline and hard boundaries. |
| §1A-CONV directive lines 52-138 | Ten component scopes. |
| §1A-CONV directive lines 142-179 | Ten invariants, acceptance criteria, seven validation gates, and minimized backend-change rule. |
| §1A-CONV directive lines 182-195 | Out-of-scope and hard-forbidden exclusions. |
| §1A-CONV directive lines 199-234 | Architectural implementation notes. |
| §1A-CONV directive lines 237-271 | Commit discipline and closeout package requirements. |
| `viyo-document-ingestion-protocol` | Required section-by-section ingestion, constraint extraction, traceability, and completeness gate. |
| `viyo-development-protocol-v2` | Code-build classification, scope lock, validation, commit discipline, and Product Owner gate expectations. |
| `quality-gate` | Evidence-based completion and no false-confirmation standard. |
| `task-master` | CLI task tracking expectations and structured progress logging conventions. |
