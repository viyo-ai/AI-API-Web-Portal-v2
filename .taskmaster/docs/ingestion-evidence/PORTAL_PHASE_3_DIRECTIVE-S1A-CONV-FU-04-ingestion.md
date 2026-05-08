# PORTAL_PHASE_3_DIRECTIVE — §1A-CONV-FU-04 Ingestion Evidence

**Directive:** §1A-CONV-FU-04 LLM-First Architect Reply Generation + Architect Context Document  
**Repository:** `viyo-ai/AI-API-Web-Portal-v2`  
**Required branch:** `agent-work/s1a-conv-fu-04`, cut from `agent-work/s1a-conv-fu02` at `8635bf6`  
**Prepared before code changes:** Yes. This artifact is the required pre-implementation ingestion record for the directive.  
**Constraint ID prefix:** `PORTAL-P3-S1A-CONV-FU-04-HR-XX`

## Section index and summaries

| Section | Lines | Classification | Summary |
|---|---:|---|---|
| Title and authorization | 1–8 | Hybrid | The directive authorizes immediate implementation of §1A-CONV-FU-04 on the AI API Web Portal repo and names the working branch/base commit. It identifies the trigger bug: Architect replies still use hardcoded templates, including the incorrect phrase “remaining setup fields” on a first turn where no fields were collected. |
| Architectural principle | 11–14 | Constraint | The wrapper LLM is treated as the system for reply composition. `architect.system.md` provides constitutional rules, the new `architect.context.md` provides platform knowledge, and the LLM must compose replies within those boundaries instead of relying on hand-written templates. |
| Critical boundaries | 17–28 | Constraint | The directive freezes several system boundaries: the existing form wizard and `buildTargets.completeWizard` stay untouched, safety guarantees persist, §9 approval remains binding, token values never flow into prompts or calls, no new schema/providers/dependencies are allowed, and `architect.system.md` must remain unchanged. |
| Execution discipline | 31–37 | Hybrid | The implementation must first produce this ingestion evidence file, then implement against eight invariants. Commits must use directive prefixes, and the final closeout must be a single inline Product Owner message containing all required evidence. |
| Component 1 — Architect Context Document | 40–76 | Work Item + Constraint | A new `server/prompts/architect.context.md` file must be created with exactly seven required sections in the specified order. Runtime loading must mirror existing prompt loaders and include this context alongside `architect.system.md` for every reply-generation call. |
| Component 2 — LLM-First Reply Generation | 78–91 | Work Item + Constraint | Hardcoded Architect reply templates must be replaced by a single LLM call per Architect turn. The new reply generator must use sanitized state, the FU-02 intent decision, the existing `invokeLLM` Gemini Flash router, strict JSON schema, and a single allowed recovery fallback for timeout or malformed output while preserving the existing state machine. |
| Hard functional invariants | 95–106 | Constraint + Verification | The directive defines eight invariants covering prompt loading, trigger bug prevention, strict schema and template removal, token redaction before prompts, fallback safety and state preservation, FU-01/FU-02 regression preservation, token-prefix diff grep, and `architect.system.md` immutability. |
| Validation gates | 110–118 | Constraint | The required validation gates are `pnpm check`, focused FU-02 tests, new FU-04 reply tests, preserved §1A-CONV tests, full Vitest suite, and production build. These must be run and reported with actual evidence. |
| Closeout package | 121–137 | Constraint | Final delivery must be a single inline chat message containing the working commit URL, validation table, full context prompt text, before/after reply-generation diff, token grep result, test delta, production transcript proof from a real call, four specific plain-prose answers, and the exact boundary statement. |
| Begin instruction | 141–143 | Constraint | The directive orders immediate implementation and requests a Manus Project gate for local publishing when complete. A managed checkpoint must therefore be created at the end so the user can publish through the Manus UI. |

## Hard requirements and constraint extraction

| ID | Requirement or constraint | Applies to | Evidence / source lines |
|---|---|---|---:|
| PORTAL-P3-S1A-CONV-FU-04-HR-01 | Produce `.taskmaster/docs/ingestion-evidence/PORTAL_PHASE_3_DIRECTIVE-S1A-CONV-FU-04-ingestion.md` before code changes, with constraint IDs, invariant coverage, and conservative verdict. | Process / documentation | Execution discipline | 31–37 |
| PORTAL-P3-S1A-CONV-FU-04-HR-02 | Work on branch `agent-work/s1a-conv-fu-04` cut from `agent-work/s1a-conv-fu02` at `8635bf6`. | Git workflow | Authorization header | 3–6 |
| PORTAL-P3-S1A-CONV-FU-04-HR-03 | Create `server/prompts/architect.context.md` with seven required sections in directive order. | Prompt artifact | Component 1 | 42–75 |
| PORTAL-P3-S1A-CONV-FU-04-HR-04 | Load `architect.context.md` at runtime through `loadArchitectContextPrompt()` parallel to existing prompt loaders using the same `readFileSync`/`process.cwd()` pattern. | Server prompt loading | Component 1 | 76 |
| PORTAL-P3-S1A-CONV-FU-04-HR-05 | Replace hardcoded Architect reply templates with one LLM reply-generation call per Architect turn. | Architect replies | Component 2 | 78–83 |
| PORTAL-P3-S1A-CONV-FU-04-HR-06 | Build reply-generation messages with `architect.system.md` plus `architect.context.md` in the system role and structured sanitized JSON state in the user role. | Architect replies / prompt safety | Component 2 | 83–86 |
| PORTAL-P3-S1A-CONV-FU-04-HR-07 | Use the existing `invokeLLM` helper and same Gemini Flash router; no new provider, schema, npm dependency, or foundation change is allowed. | Server implementation | Critical boundaries and Component 2 | 23–25, 86 |
| PORTAL-P3-S1A-CONV-FU-04-HR-08 | Use strict JSON schema response shape `{ reply, requiresConfirmation, callTool? }`. | LLM response contract | Component 2 | 86 |
| PORTAL-P3-S1A-CONV-FU-04-HR-09 | Redact token-like values before prompt construction; no token value may flow into prompt, LLM call, log, response, or database. | Security / prompt payload | Critical boundaries and Component 2 | 22, 85 |
| PORTAL-P3-S1A-CONV-FU-04-HR-10 | On timeout or malformed output, return only the allowed recovery fallback: “I'm having trouble composing a reply right now. Please try again, or open Advanced Setup.” | Failure handling | Component 2 | 87 |
| PORTAL-P3-S1A-CONV-FU-04-HR-11 | Preserve the state machine for field collection, validation regex, connection testing, create calls, and sidebar refresh. | Existing product behavior | Component 2 | 91 |
| PORTAL-P3-S1A-CONV-FU-04-HR-12 | Preserve the existing form wizard and `buildTargets.completeWizard`; Advanced Setup remains the escape hatch. | Existing wizard behavior | Critical boundaries | 19 |
| PORTAL-P3-S1A-CONV-FU-04-HR-13 | Preserve paste detection, connection-test-before-save, and plain-English errors from §1A-FU-04 safety guarantees. | Safety behavior | Critical boundaries | 20 |
| PORTAL-P3-S1A-CONV-FU-04-HR-14 | Architect does not bypass §9 approval; build requests still route to Kimi/Claude execution paths. | Approval boundary | Critical boundaries and Context requirements | 21, 74 |
| PORTAL-P3-S1A-CONV-FU-04-HR-15 | Per-project memory isolation is query-level enforced; cross-project bleed is forbidden. | Project memory | Critical boundaries | 26 |
| PORTAL-P3-S1A-CONV-FU-04-HR-16 | Out-of-scope discoveries require separate `[PORTAL-OOS-XX]` proposal commits and stop; do not implement them inside FU-04. | Scope control | Critical boundaries | 27 |
| PORTAL-P3-S1A-CONV-FU-04-HR-17 | Add a sibling source-grep test proving known canned Architect strings are absent from production source. | Tests | Component 2 and invariants | 89, 101 |
| PORTAL-P3-S1A-CONV-FU-04-HR-18 | Run all required validation gates and capture production transcript proof from a real call for `help me set up my repo`. | Validation / closeout | Validation gates and closeout | 110–137 |
| PORTAL-P3-S1A-CONV-FU-04-HR-19 | Keep `architect.system.md` unchanged in this directive and verify by diff. | Prompt immutability | Critical boundaries and invariant 8 | 25, 106 |
| PORTAL-P3-S1A-CONV-FU-04-HR-20 | Final closeout must be a single inline Product Owner message with all specified items and the exact boundary statement. | Delivery | Closeout package | 121–137 |

## Invariant coverage map

| Invariant | Covered by implementation work | Covered by tests / validation | Source requirements |
|---|---|---|---|
| INV-FU-04-01 | Add `architect.context.md` and `loadArchitectContextPrompt()`; include both system and context prompts in every `generateArchitectReply` call. | New behavioral test asserts both prompt files are read on each reply-generation call. | HR-03, HR-04, HR-06 |
| INV-FU-04-02 | Remove the first-turn canned setup template that emits “remaining setup fields.” | Behavioral/source test asserts the known bug string and canonical bad substring are absent. | HR-05, HR-17 |
| INV-FU-04-03 | Route normal Architect replies through `invokeLLM` using a strict JSON schema and delete hardcoded production templates. | New contract test asserts strict schema and source-grep absence of known canned strings. | HR-05, HR-07, HR-08, HR-17 |
| INV-FU-04-04 | Sanitize the last user message with token redaction before prompt construction. | Behavioral test injects a token-like value and asserts prompt payload contains `[redacted-token-value]` and not the token. | HR-09 |
| INV-FU-04-05 | Return only the allowed fallback string on timeout or malformed output while preserving setup state. | Behavioral test simulates timeout/malformed output and asserts fallback plus unchanged setup state. | HR-10, HR-11 |
| INV-FU-04-06 | Do not weaken FU-01 or FU-02 suites or production paths. | Run existing `server/section1a-conv.contract.test.ts` and `server/architect.intent.contract.test.ts`; report unchanged purpose and pass results. | HR-11, HR-12, HR-13, HR-14 |
| INV-FU-04-07 | Ensure token-prefix grep across FU-04 diff returns zero new token-value matches outside allowed regex test patterns. | Run compact grep on added diff lines for `ghp_`, `github_pat_`, `gho_`, `ghu_`, `ghs_`, `ghr_` and report clean/fail result. | HR-09, HR-18 |
| INV-FU-04-08 | Do not modify `architect.system.md`. | Run `git diff -- server/prompts/architect.system.md` and report no diff. | HR-19 |

## Implementation plan derived from ingestion

| Work item | Source sections | Expected files |
|---|---|---|
| Add Architect context document in the exact required section order. | Component 1 | `server/prompts/architect.context.md` |
| Add runtime prompt loader and LLM-first reply generator. | Component 1, Component 2 | `server/architectSetup.ts` and/or existing Architect modules as discovered; prompt loader functions must follow existing project pattern. |
| Replace normal canned replies while preserving orchestration state-machine behavior. | Component 2, Critical boundaries | Existing Architect reply/state-machine files only; no schema, provider, or dependency changes. |
| Add FU-04 contract suite. | Invariants and Validation gates | `server/architect.reply.contract.test.ts`; existing FU-01/FU-02 test files remain preservation gates. |
| Run mandated validation and closeout evidence capture. | Validation gates and Closeout package | Shell validation evidence, production transcript proof, managed checkpoint, GitHub review branch. |

## Out-of-scope / stop conditions

| Condition | Required response |
|---|---|
| Need for tool calls outside `buildTargets.testConnection`, `buildTargets.create`, `projectMemory.list`, or `projectMemory.set` inside Architect context. | Surface as `[PORTAL-OOS-XX]` proposal and stop; do not invent calls. |
| Need to change database schema, providers, npm dependencies, or foundation architecture. | Stop under FOUNDATION_LOCK and request PO approval as separate scope. |
| Discovery that FU-01/FU-02 tests must be weakened or rewritten to pass. | Stop and report preservation failure; do not hide regression. |
| Token value would be included in prompt, response, logs, or records. | Stop and treat as a security blocker; token values must remain in Manus env vars only. |

## Conservative verdict

**PASSED FOR IMPLEMENTATION WITH STRICT SCOPE CONTROL.** The directive is sufficiently specific to implement without additional Product Owner clarification because it provides two bounded components, eight invariants, explicit validation gates, and the final closeout shape. The implementation must remain limited to reply-generation composition and the new context prompt primitive. Any need to alter schema, providers, dependencies, `architect.system.md`, `buildTargets.completeWizard`, or §9 approval behavior is a stop condition rather than implied authorization.
