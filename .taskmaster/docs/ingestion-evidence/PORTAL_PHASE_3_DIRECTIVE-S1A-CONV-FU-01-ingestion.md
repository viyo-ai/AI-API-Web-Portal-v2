# PORTAL_PHASE_3_DIRECTIVE — §1A-CONV-FU-01 Ingestion Evidence

**Directive source:** `/home/ubuntu/upload/pasted_content_2.txt`

**Directive title:** `PORTAL_PHASE_3_DIRECTIVE — §1A-CONV-FU-01 Conversational Auto-Save + Intent Classification Fix`

**Authorization status read:** Approved by Product Owner; begin immediately.

**Working branch required:** `agent-work/s1a-conv-fu-01`, cut from `agent-work/s1a-conv` at `f2d9ab2`.

**Conservative verdict:** **PASSED FOR IMPLEMENTATION UNDER THE DIRECTIVE.** The uploaded directive is explicit, narrowly scoped, and Product Owner approved. The implementation must remain limited to intent classification hardening, a server-side conversational setup state machine, and sidebar refresh after chat-driven save. No schema, provider, dependency, prompt-system, or approval-gate expansion is authorized.

## Structure-Preserving Section Index

| Section | Lines | Type | Consumption Summary |
|---|---:|---|---|
| Directive header and authorization | 1-13 | Hybrid | The directive authorizes §1A-CONV-FU-01 immediately on the named repository and branch. It identifies two verified gaps: setup language currently routes as credentials, and chat does not call the project creation path after collecting fields. |
| Critical boundaries | 16-27 | Constraint | The existing Advanced Setup wizard and `buildTargets.completeWizard` must remain intact. The implementation must preserve §1A-FU-04 safety guarantees, §9 approval gating, env-var-only credential handling, existing schema, existing providers, and per-project isolation. |
| Execution discipline | 30-38 | Constraint | An ingestion artifact must be produced first, before code changes. Work must be implemented against ten invariants, committed with the required prefix, validated through seven gates, and closed out inline in chat for Product Owner sign-off. |
| Scope inventory — three components | 42-64 | Work Item | The authorized work covers exactly three components: intent classifier hardening, conversational setup state machine, and sidebar refresh after successful chat save. The form wizard remains the source pattern for connection testing, save shape, invalidation, and selection behavior. |
| Hard functional invariants | 67-80 | Work Item | The directive provides ten invariants with explicit verification methods. They cover setup-vs-credentials classification, ordered field collection and validation, test-before-save, explicit confirmation, same create shape as the wizard, token-prefix safety, preservation of existing gates, and UI refresh/selection after save. |
| Validation gates | 84-92 | Constraint | Seven gates are required before push: `pnpm check`, two server Vitest targets including a new contract test, `Home.behavior.test.tsx`, full test suite, build, and token-prefix grep across the full diff. |
| Closeout package | 96-112 | Constraint | The final report must be pasted inline as a single Product Owner message. It must include commit URLs, validation table, full updated intent prompt, diffs, token grep result, test count delta, byte-equal record proof, and plain-prose answers to four operational questions. |
| Begin instruction | 116-118 | Constraint | The directive explicitly instructs implementation to begin and asks for a Manus Project gate for local publish when complete. |

## Constraint Extraction

| Constraint ID | Rule Text | Applies To | Enforcement |
|---|---|---|---|
| PORTAL-P3-S1A-CONV-FU-01-HR-01 | Keep the existing form wizard as Advanced Setup; do not remove it and do not modify `buildTargets.completeWizard`. | Backend router and Home page wizard flow | Existing wizard tests must remain unchanged and pass. |
| PORTAL-P3-S1A-CONV-FU-01-HR-02 | Preserve §1A-FU-04 safety guarantees: paste detection, connection test before save, and plain-English errors. | Chat setup flow and validation helpers | Reuse existing regex/copy semantics and assert test-before-create. |
| PORTAL-P3-S1A-CONV-FU-01-HR-03 | §9 approval gate still applies to all Kimi build turns; Architect setup does not bypass approval. | Orchestration submit path | Do not touch Kimi approval code paths; regression tests must pass. |
| PORTAL-P3-S1A-CONV-FU-01-HR-04 | Token values stay in Manus env vars. Architect handles env var names only and never stores, echoes, or logs token values. | Intent detector, chat state, events, tests | Token redaction remains active and token-prefix grep must show zero new matches outside existing paste-detection tests. |
| PORTAL-P3-S1A-CONV-FU-01-HR-05 | No new schema. Use only existing `build_targets` and `project_memory` tables if persistence is needed. | Data model | Prefer in-memory state keyed by `(ownerUserId, taskThreadId)` or existing scoped memory; no migrations. |
| PORTAL-P3-S1A-CONV-FU-01-HR-06 | No new LLM providers. FOUNDATION_LOCK stop condition remains active. | Provider and runtime wiring | Do not add provider integrations or dependencies. |
| PORTAL-P3-S1A-CONV-FU-01-HR-07 | No new npm dependencies. | Package management | Do not modify dependencies. |
| PORTAL-P3-S1A-CONV-FU-01-HR-08 | `architect.system.md` is frozen; modify only `architect.intent.md` and the conversational state machine. | Prompt files and Architect runtime | Do not edit system prompt. |
| PORTAL-P3-S1A-CONV-FU-01-HR-09 | Enforce per-project memory isolation at query level; cross-project bleed is forbidden. | Memory reads/writes and setup state | State key must include owner and task thread, and any project memory access must be owner plus target scoped. |
| PORTAL-P3-S1A-CONV-FU-01-HR-10 | Out-of-scope discoveries require separate `[PORTAL-OOS-XX]` proposal commits and Product Owner approval. | All work | Do not bundle unrelated fixes. |
| PORTAL-P3-S1A-CONV-FU-01-HR-11 | Successful chat-driven save must refresh the Projects sidebar and select the new project using the existing invalidation pattern. | Client Home page orchestration result handling | Reuse existing `buildTargets.list.invalidate()` and selected project state behavior. |
| PORTAL-P3-S1A-CONV-FU-01-HR-12 | Final closeout must be inline in chat, not only a committed evidence file. | Delivery | Single PO-facing closeout message required. |

## Per-Invariant Coverage Map

| Invariant | Required Implementation Surface | Planned Verification | Coverage Status |
|---|---|---|---|
| INV-FU-01-01 | `detectArchitectIntent` and `architect.intent.md` examples | Exact repro behavioral test in `server/architect.intent.contract.test.ts` | COVERED BY PLAN |
| INV-FU-01-02 | `detectArchitectIntent` setup and credentials signal precedence | Table-driven setup and credentials tests | COVERED BY PLAN |
| INV-FU-01-03 | Conversational setup state machine in Architect chat path | New `server/section1a-conv-fu-01.contract.test.ts` with ordered collection and validation assertions | COVERED BY PLAN |
| INV-FU-01-04 | Test-before-save inside chat path | New server contract test asserting `testConnection` before create and no create on failure | COVERED BY PLAN |
| INV-FU-01-05 | Explicit confirmation branch in chat state machine | New server contract test proving no create before `yes` / `save` / `confirm` | COVERED BY PLAN |
| INV-FU-01-06 | Chat calls the same `buildTargets.create` arg shape as form wizard path | New server test comparing chat-created and wizard-shaped records by normalized hash or SQL comparison | COVERED BY PLAN |
| INV-FU-01-07 | Token-prefix safety across diff | Token-prefix grep gate | COVERED BY PLAN |
| INV-FU-01-08 | `buildTargets.completeWizard` unchanged | Existing §1A-FU-04 and full test gates; git diff review confirms no changes to the procedure | COVERED BY PLAN |
| INV-FU-01-09 | §9 Kimi approval gate unchanged | Existing orchestration/approval tests and no code changes to approval gate | COVERED BY PLAN |
| INV-FU-01-10 | Sidebar Projects list refreshes and selects new chat-created project | `Home.behavior.test.tsx` extension or existing mutation result handling via new orchestration response metadata | COVERED BY PLAN |

## Surface Inspection Notes

| Surface | Current Observation | Directive Implication |
|---|---|---|
| `server/prompts/architect.intent.md` | Current credential rule includes environment variable names broadly, which can overtake setup phrasing when env var names appear during onboarding. | Add explicit setup examples and narrow credentials to existing-token rotation/status signals. |
| `server/architectLLM.ts` | `detectArchitectIntent` currently marks `env var` and `environment variable` as credentials, while `setup` is evaluated after credentials. The repro contains both setup and env-var language, creating the regression. | Reorder or refine detection so setup wins when no selected project exists or when setup/onboarding language is dominant. |
| `appendArchitectTurn` in `server/routers.ts` | Current Architect flow appends route-decision and message events, optionally writes `architect.last_intent` only when a build target is already selected, and returns `true`. | Extend this path with a setup state machine that can collect fields, test connection, request confirmation, create a build target, and append structured metadata. |
| `buildTargets.create` in `server/routers.ts` | Existing create procedure validates input, calls `testBuildTargetConnection`, then `createBuildTarget({ ...input, ownerUserId })`. | Chat save should use the same server-side helper/arg shape semantics without modifying `completeWizard`. |
| `buildTargets.testConnection` in `server/routers.ts` | Existing connection test procedure delegates to `testBuildTargetConnection`. | Chat state machine must call the same connection helper before asking for save confirmation. |
| `buildTargets.completeWizard` in `server/routers.ts` | Advanced Setup performs test-before-create, creates the target, updates settings, creates initial isolated branch, and returns `{ target, branch }`. | Must remain functionally unchanged; chat can create a Project target without altering the wizard. |
| `client/src/pages/Home.tsx` | Existing manual and wizard flows invalidate `buildTargets.list` and set `selectedBuildTargetId` after creation. | Chat-driven save should surface a created target in the orchestration response so Home can reuse invalidation and selection logic. |
| `client/src/pages/Home.behavior.test.tsx` | Existing tests mock tRPC invalidation and assert refresh after setup mutations. | Extend tests to assert chat-driven save refreshes sidebar and selects the new project. |

## Implementation Boundary Decision

The directive authorizes implementation immediately. The implementation should use an in-memory setup state keyed by `ownerUserId:taskThreadId`, because current `project_memory` helpers are build-target scoped and chat setup begins before a project exists. This avoids new schema while satisfying the directive’s allowed state choices. The code must clear state on save, cancel, token rejection, abandonment detected by topic change, and task closure/archival handling where available.

## Task Landscape

| Component | Task | Source Section | Status |
|---|---|---|---|
| Intent Classification Hardening | Harden setup and credentials classification in prompt and detector. | Component 1 and INV-FU-01-01/02 | READY |
| Conversational State Machine | Add server-side ordered field collection, inline validation, connection test, explicit confirmation, and chat-driven create. | Component 2 and INV-FU-01-03/04/05/06 | READY |
| Sidebar Refresh | Return created-target metadata from chat save and reuse existing invalidation/selection pattern. | Component 3 and INV-FU-01-10 | READY |
| Validation and Closeout | Add/extend tests, run seven gates, grep token prefixes, commit/push, and deliver inline closeout. | Validation gates and closeout package | READY |

## Orphan and Hallucination Check

No source section is orphaned. No task above is invented outside the directive. The only implementation choice not dictated exactly by the directive is state storage. The conservative choice is in-memory state keyed by `(ownerUserId, taskThreadId)`, which is explicitly allowed by Component 2 and avoids forcing pre-project state into build-target-scoped project memory.
