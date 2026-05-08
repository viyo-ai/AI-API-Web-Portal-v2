# PORTAL_PHASE_3_DIRECTIVE — §1A-CONV-FU-02 Ingestion Evidence

**Document ingested:** `/home/ubuntu/upload/Pasted_content_20.txt`  
**Directive title:** `§1A-CONV-FU-02 LLM-First Intent Classification + Inline Closeout Discipline`  
**Repository:** `viyo-ai/AI-API-Web-Portal-v2`  
**Working branch:** `agent-work/s1a-conv-fu-02`  
**Base commit:** `dad56cb` from `agent-work/s1a-conv-fu-01`  
**Ingestion verdict:** **PASSED FOR IMPLEMENTATION WITH STRICT SCOPE LOCK**. The directive is approved by the Product Owner and contains a bounded two-component scope. Implementation may proceed only against the listed FU-02 invariants and hard boundaries. Out-of-scope next-step ideas from FU-01 remain forbidden in this directive.

## Section Index and Read-State Evidence

| Section | Lines | Type | Summary | Downstream Action |
|---|---:|---|---|---|
| Title and Authorization | 1–14 | Hybrid | The directive approves immediate work on §1A-CONV-FU-02, identifies the repo and branch, states that FU-01 closed auto-save, and names two remaining blockers: brittle keyword intent classification and failed inline closeout discipline. | Create branch from `dad56cb`, produce ingestion evidence first, then implement only the classifier rewrite and closeout recovery. |
| Architectural Principle | 17–20 | Constraint | The wrapper LLM is the intended intent reader. Hand-written keyword classifiers are rejected as brittle maintenance debt for Architect-related routing. | Replace `detectArchitectIntent` keyword arrays and if/else logic with an LLM-first classifier. |
| Critical Boundaries | 23–33 | Constraint | The form wizard, `buildTargets.completeWizard`, FU-04 safety guarantees, §9 Kimi approval gate, env-var-only token handling, no-schema/no-provider/no-dependency locks, and frozen `architect.system.md` are all restated. FU-01 suggested next steps are expressly out of scope. | Enforce no schema, provider, dependency, wizard, or Brand Kit/test-credentials/transcript work. Prompt changes are limited to `architect.intent.md`. |
| Execution Discipline | 36–42 | Constraint | The directive requires this ingestion file before code changes, conventional commits with FU-02 prefix, implementation against six invariants, and a single inline closeout message. | Store this file, map HR constraints and invariants, and reserve final delivery for a comprehensive inline PO closeout. |
| Component 1 — LLM-First Intent Classification | 45–59 | Work Item | The keyword classifier in `server/architectLLM.ts` must be replaced by one LLM call through the existing free Manus OpenAI router. It must load `server/prompts/architect.intent.md`, return a strict decision shape, fall back to ambiguous on failure, and cache per `(taskThreadId, messageHash)`. | Implement classifier helper, prompt text, JSON parsing, timeout/error fallback, redaction marker, and in-memory retry cache without new dependencies. |
| Component 2 — Inline Closeout | 60–63 | Work Item | Completion must send one inline chat message covering both FU-01 and FU-02, not merely committed files or a short summary. | Collect all required closeout evidence during validation and paste it directly into the final PO-facing message. |
| Hard Functional Invariants | 66–76 | Hybrid | Six invariants define behavior and validation: FU-01 repro still setup, natural setup phrase setup, token-like substrings route credentials with redaction, build phrases bypass Architect, token-prefix grep stays clean, and FU-01 tests remain passing. | Add focused tests and run specified gates. Avoid literal token-prefix strings in new source outside allowed test construction. |
| Validation Gates | 79–86 | Constraint | Required gates are `pnpm check`, focused `architect.intent` tests, existing `section1a-conv` tests, full test suite, and production build. | Run and record all gates before checkpoint, commit, and closeout. |
| Mandatory Closeout Package | 89–105 | Constraint | Final PO message must contain commit URLs, validation table, full prompt text, before/after classifier diff, token grep, test delta, FU-01 record proof, four plain-prose answers, and the exact boundary statement. | Final response must be a single inline closeout message satisfying all nine requested contents. |
| Begin and Project Gate | 109–112 | Work Item | The directive instructs immediate implementation and requests a Manus Project gate for local publishing when complete. | Save a Manus checkpoint after successful validation and include the checkpoint attachment in closeout. |

## Constraint Register

| Constraint ID | Rule | Applies To | Implementation Implication |
|---|---|---|---|
| PORTAL-P3-S1A-CONV-FU-02-HR-01 | Work is Product Owner approved and begins immediately. | Session execution | No extra approval is needed before implementation once ingestion evidence exists. |
| PORTAL-P3-S1A-CONV-FU-02-HR-02 | Branch must be `agent-work/s1a-conv-fu-02` from `agent-work/s1a-conv-fu-01` at `dad56cb`. | Git workflow | Create branch before code changes and push to GitHub review branch. |
| PORTAL-P3-S1A-CONV-FU-02-HR-03 | Keyword classifier architecture is rejected. | `server/architectLLM.ts` | Delete signal arrays and their if/else consumers. |
| PORTAL-P3-S1A-CONV-FU-02-HR-04 | LLM classifier must return exactly one of `setup`, `credentials`, `onboarding`, `build`, `ambiguous`, `other`, plus `shouldRouteToArchitect` and one-sentence reason. | Classifier contract | Use strict parsing and safe normalization. |
| PORTAL-P3-S1A-CONV-FU-02-HR-05 | Classification prompt must live in `server/prompts/architect.intent.md` and include category definitions plus examples. | Prompt storage | Update only this intent prompt, not `architect.system.md`. |
| PORTAL-P3-S1A-CONV-FU-02-HR-06 | Token values are never retained; token-like substrings classify as credentials and mark redaction required. | Classifier and response safety | Add/propagate `tokenRedactionRequired` without storing raw values. |
| PORTAL-P3-S1A-CONV-FU-02-HR-07 | Timeout or router error returns ambiguous, routes to Architect, and asks for clarification. | Failure behavior | Use bounded timeout and catch/normalize errors. |
| PORTAL-P3-S1A-CONV-FU-02-HR-08 | Cache classification per `(taskThreadId, messageHash)` for the thread lifetime. | Classifier performance | Use in-memory map; clear naturally on process/thread lifecycle, no schema. |
| PORTAL-P3-S1A-CONV-FU-02-HR-09 | Existing wizard and `buildTargets.completeWizard` remain untouched. | Build target setup | Do not edit wizard persistence semantics. |
| PORTAL-P3-S1A-CONV-FU-02-HR-10 | §1A-FU-04 safety guarantees and §9 Kimi approval gate remain unchanged. | Security and build flow | Do not add Architect bypass paths. |
| PORTAL-P3-S1A-CONV-FU-02-HR-11 | Token values stay in Manus env vars; Architect uses env var names only. | Chat setup state | Preserve FU-01 token env-var validation. |
| PORTAL-P3-S1A-CONV-FU-02-HR-12 | No new schema, providers, or npm dependencies. | Foundation lock | Use existing LLM helper and built-in router only. |
| PORTAL-P3-S1A-CONV-FU-02-HR-13 | `architect.system.md` is frozen. | Prompt changes | Do not modify system prompt. |
| PORTAL-P3-S1A-CONV-FU-02-HR-14 | Brand Kit seeding, guided credential repair, and transcript proof are out of scope. | Scope control | Do not implement FU-01 suggested next steps. |
| PORTAL-P3-S1A-CONV-FU-02-HR-15 | Conventional commits must be prefixed with `[PORTAL-P3-S1A-CONV-FU-02-XX]`. | Git commit | Use directive prefix in final commit message. |
| PORTAL-P3-S1A-CONV-FU-02-HR-16 | Closeout must be pasted inline as one PO-facing chat message and must cover FU-01 plus FU-02. | Delivery | Final message must include all nine requested evidence blocks. |

## Invariant Coverage Map

| Invariant | Source Lines | Planned Evidence | Coverage Status |
|---|---:|---|---|
| INV-FU-02-01 | 70 | Behavioral test for the exact Product Owner FU-01 repro string classifying as `setup`. | COVERED BY PLANNED TEST |
| INV-FU-02-02 | 71 | Behavioral test for `help me set up my repo` classifying as `setup` without metadata. | COVERED BY PLANNED TEST |
| INV-FU-02-03 | 72 | Behavioral test builds token-like strings at runtime and asserts `credentials` plus redaction marker. | COVERED BY PLANNED TEST |
| INV-FU-02-04 | 73 | Table-driven test for implement, fix bug, refactor, and deploy phrasings classifying as `build` with `shouldRouteToArchitect: false`. | COVERED BY PLANNED TEST |
| INV-FU-02-05 | 74 | Diff-scoped grep for token prefixes written in split form here to avoid adding matches: `gh` + `p_`, `github` + `_pat_`, `gh` + `o_`, `gh` + `u_`, `gh` + `s_`, `gh` + `r_`. | COVERED BY VALIDATION GATE |
| INV-FU-02-06 | 75 | Run existing `server/section1a-conv.contract.test.ts` without weakening FU-01 tests. | COVERED BY VALIDATION GATE |

## Backward Traceability and Hallucination Check

| Planned Change | Source Section | Traceability Verdict |
|---|---|---|
| Rewrite `detectArchitectIntent` to call existing router LLM and parse JSON. | Component 1, lines 49–58 | TRACED |
| Update `architect.intent.md` with six categories, definitions, examples, and token-redaction rule. | Component 1, lines 53–55 | TRACED |
| Add in-memory classification cache keyed by task thread and message hash. | Component 1, line 58 | TRACED |
| Add `architect.intent.contract.test.ts` for FU-02 invariants. | Hard Functional Invariants, lines 68–75 | TRACED |
| Preserve FU-01 setup state machine and wizard save path. | Critical Boundaries, lines 25–31 and INV-FU-02-06 | TRACED |
| Produce one inline closeout package with FU-01 and FU-02 evidence. | Component 2 and Closeout Package, lines 60–105 | TRACED |

## Scope Exclusions

The directive explicitly excludes Brand Kit seeding, guided test-credentials repair, PO-facing transcript proof implementation, schema changes, new providers, new dependencies, changes to `architect.system.md`, and any bypass of §9 Kimi approval. These items are not implementation targets for FU-02. If any are discovered as useful, they must be handled as separate out-of-scope proposal commits and then stop.

## Airtable and Taskmaster Reconciliation Note

This task is driven by a Product Owner directive with an explicit required ingestion evidence artifact and a concrete branch target. No Airtable write authorization was provided. The local `todo.md` now tracks the FU-02 work items; this evidence file provides the directive coverage map and backward traceability required before implementation. No generated Taskmaster task IDs are introduced here, so there are no hallucinated task records to reconcile.

## Conservative Readiness Verdict

**PASSED FOR IMPLEMENTATION.** The directive is sufficiently bounded, all sections have coverage, no orphan work items remain, and all planned changes trace directly to the directive. Implementation must remain inside the listed constraints and must not claim completion until every validation gate and the mandatory inline closeout package are complete.
