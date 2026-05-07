# PORTAL_PHASE_3_DIRECTIVE-S9 Ingestion Evidence

**Source document:** `/home/ubuntu/upload/PORTAL_PHASE_3_DIRECTIVE_S9_VERIFIED_HANDOFF.md`

**Repo:** `viyo-ai/AI-API-Web-Portal-v2`

**Directive branch named by source:** `main`

**Inherited active working branch noted by session context:** `agent-work/s4-5-prep-inputs`; the active branch must be confirmed read-only before implementation and any commit must stay on the approved working branch unless the Product Owner directs otherwise.

**Ingestion verdict:** **PASSED FOR IMPLEMENTATION**. The directive defines a bounded §9 implementation universe of fourteen hard invariants, a mandatory chat-thread cleanup bundled with the approval pause, explicit plain-English vocabulary rules, additive persistence expectations, and validation gates. This artifact is created before §9 implementation code changes, as required by the directive and the VIYO document ingestion protocol.

## 1. Read-State and Scope Boundary

The §9 directive was read from beginning to end in three passes because the first full-file read output was truncated after the early acceptance criteria. Lines 1–94 established authorization, source-of-truth observations, execution discipline, owner-facing vocabulary, and the complete invariant table. Lines 85–200 completed functional acceptance criteria, out-of-scope boundaries, and most implementation notes. Lines 200–234 completed UI integration, commit discipline, delivery evidence, and the final hold requirement.

The source authorizes §9 only after §4.5 Product Owner acceptance. The inherited session context states that §4.5 is closed and accepted and that §9 has been authorized to begin. The directive also requires stopping after §9 acceptance review, not declaring Phase 3 complete, and not beginning §1A-FU-04 or §8. The implementation scope is therefore limited to the persisted pause between Claude's plan and Kimi's execution, the plain-English owner approval UI, the per-user default-on preference, diagnostics/status support needed for that pause, and the bundled chat-thread cleanup that hides technical noise from the owner-facing chat while preserving all events in AI Activity.

No implementation file has been changed as part of this ingestion step. All implementation targets below are plans, not completed work.

## 2. Section Index With Summaries

| Section | Source Lines | Classification | Summary |
|---:|---:|---|---|
| 1 | 1–23 | Hybrid | The directive identifies §9 as the first Phase 3 section, names the repo and source branch, records the prerequisite acceptance boundary, and summarizes the current Portal state. It confirms the four-field wrapper model already exists, dual-path turns currently run without a human pause, AI Activity already persists structured model events, the chat surface exposes technical noise that violates the owner standard, and §8 queue polish remains deferred. |
| 2 | 26–35 | Constraint | Execution discipline requires this exact ingestion artifact before completion claims, reuse of existing scaffolds, extension rather than replacement of `executeWrapperTurn`, conventional `[PORTAL-P3-S9-XX]` commits, separate `[PORTAL-OOS-XX]` proposal commits for out-of-scope discoveries, and behavioral rather than source-string tests. |
| 3 | 38–53 | Constraint | The Plain-English Owner Standard defines the only owner-facing terms permitted for the approval pause and lists forbidden technical vocabulary that must not appear in non-Diagnostics surfaces. Diagnostics is expressly exempt, which means tests must distinguish owner chat/settings surfaces from technical diagnostics. |
| 4 | 57–72 | Work Item | Approval-gate invariants `INV-S9-01` through `INV-S9-10` define the required backend pause, approval, revision, cancel, queue-hold, persistence, preference, single-provider bypass, and plain-English vocabulary behavior. These are hard functional requirements and each needs behavioral proof. |
| 5 | 74–81 | Work Item | Chat-thread cleanup invariants `INV-S9-11` through `INV-S9-14` require removing the technical history disclosure, removing the placeholder setup banner, filtering the boilerplate task-created event from chat, and replacing deny-list rendering with an explicit allow-list while leaving AI Activity complete. |
| 6 | 85–122 | Hybrid | Functional acceptance criteria translate the invariants into owner-visible flows: default-on approval for new users, plan bubble presentation, approve/revise/cancel UI behavior, settings toggle copy, diagnostics approval state, new AI Activity event copy, clean empty task state, legacy task filtering, validation gates, backward compatibility, and test-count growth. |
| 7 | 125–143 | Constraint | The out-of-scope section forbids §1A-FU-04, §8 polish, plan visualization, direct plan editing, non-dual-path approval, cost/quota work, broad wrapper refactors, routing logic changes, provider call-shape changes, new providers, Build Branch security changes, AI Activity removal, and database event renames. |
| 8 | 146–181 | Hybrid | Architectural notes recommend additive turn-state extension, a split `executeWrapperTurn` plan/execute flow, new tRPC procedures, additive `orchestration_turns` columns, a user preferences table or column, Stop registry integration, 24-hour timeout, refresh persistence, and existing failure handling after approval. |
| 9 | 183–193 | Work Item | Chat cleanup implementation notes require allow-list rendering, a single clean empty-state hint, no AI Activity removal, retroactive filtering of legacy events, and source removal of the boilerplate `tasks.create` system event for new tasks. |
| 10 | 195–201 | Work Item | UI integration notes require rendering `awaiting_owner_approval` as a normal Claude-like chat bubble, placing approval/revision/cancel controls inline, using existing `Button`, `Textarea`, and AlertDialog patterns, and using exact cancel confirmation copy. |
| 11 | 205–230 | Constraint | Commit and completion rules require prefixed commits, passing ingestion evidence plus all invariant tests and validation gates before push, a completion package containing commit URLs, validation table, diffs, precise prose answers, and a boundary statement. The PO must accept §9 before §1A-FU-04 begins. |
| 12 | 232–234 | Reference | The document ends at line 234 with no additional hidden requirements. |

## 3. Document Classification Summary

| Classification | Sections | Downstream Action |
|---|---|---|
| Work Item | 4, 5, 9, 10 | Implement in backend, frontend, and behavioral tests exactly within the invariant universe. |
| Constraint | 2, 3, 7, 11 | Enforce through scope control, commit discipline, vocabulary tests, and delivery packaging. |
| Hybrid | 1, 6, 8 | Use as both requirements and implementation guidance; extract hard rules separately from optional guidance. |
| Reference | 12 | Preserve as read-state evidence only. |

## 4. Structured Constraint Extraction

| Constraint ID | Source Lines | Rule Text | Applies To | Enforcement Plan |
|---|---:|---|---|---|
| PORTAL-P3-S9-HR-01 | 1–7, inherited context | §9 may begin only after §4.5 acceptance and must stop at §9 acceptance review; Phase 3 must not be declared complete. | Process and delivery | Treat §9 as an isolated implementation stream and end with a review package that requests PO acceptance. |
| PORTAL-P3-S9-HR-02 | 3, 125–143, 230 | Do not begin §1A-FU-04 or §8 during this task. | Entire repo | Reject or isolate any discovered work in those areas; do not touch their implementation unless required by §9 queue-hold compatibility and already-existing queue hooks. |
| PORTAL-P3-S9-HR-03 | 30 | Create `.taskmaster/docs/ingestion-evidence/PORTAL_PHASE_3_DIRECTIVE-S9-ingestion.md` before code changes. | Repository evidence | This artifact is created as the first §9 repository change. |
| PORTAL-P3-S9-HR-04 | 31, 136–139 | Reuse existing scaffolds and extend the existing wrapper handoff model; do not replace `executeWrapperTurn`, change routing logic, change provider call shapes, or add providers. | `server/wrapperLLM.ts` and provider adapters | Split the current flow only at the Claude-plan/Kimi-execute boundary and keep current Claude, Kimi, and OpenAI invocation contracts intact. |
| PORTAL-P3-S9-HR-05 | 32–34, 205–212 | Commits must use `[PORTAL-P3-S9-XX]` or `[PORTAL-P3-S9-CLEANUP-XX]`; out-of-scope discoveries require separate `[PORTAL-OOS-XX]` proposal commits and STOP. | Git workflow | Commit only §9 logical units; stop for PO approval if a forbidden area must be changed. |
| PORTAL-P3-S9-HR-06 | 35, 112–121 | Tests must be behavioral, all validation gates must pass, and test count must grow by at least fourteen. | Test suite | Add `server/section9.verified-handoff.contract.test.ts` and extend `Home.behavior.test.tsx`; avoid source-string-only assertions. |
| PORTAL-P3-S9-HR-07 | 38–53, 72, 97–108 | Owner-facing non-Diagnostics UI must use exact plain-English labels and must not expose forbidden technical vocabulary. | Chat thread, settings, status messages | Add render-level tests that query accessible UI and inspect non-Diagnostics rendered HTML for forbidden terms. |
| PORTAL-P3-S9-HR-08 | 63–70, 150–179 | Dual-path or auto-routed turns with the default-on preference must pause after Claude's plan, persist `awaiting_approval`, preserve for refresh, and not invoke Kimi until approval. | Schema, DB helpers, wrapper, router, UI | Add turn state/columns, plan event persistence, approval procedures, and behavioral tests for pause/resume/reload. |
| PORTAL-P3-S9-HR-09 | 65, 154–158 | Approval resumes existing execution with Claude's plan supplied to Kimi and persists `kimiResult`, review, and completion using existing semantics. | Wrapper Phase B | Implement a resume path that reads the persisted plan and uses existing Kimi/review persistence paths. |
| PORTAL-P3-S9-HR-10 | 66, 93, 162, 199 | Revision sends owner notes plus original plan back to Claude, persists each updated plan, rerenders the approval UI, and enforces a five-revision limit. | Router, DB helpers, wrapper/revision prompt, UI | Track `approvalRevisionCount` and `approvalFeedbackJson`; hide or disable Send-back action after five revisions with a forced approve/cancel choice. |
| PORTAL-P3-S9-HR-11 | 67, 95, 163, 175, 201 | Cancel must use the existing Stop registry, make no Kimi call, transition to `stopped`, and show plain-English cancel status after confirmation. | Router, Stop registry, UI | Call `requestTurnStop`, persist `owner_canceled_plan`, update state, and render the required status copy. |
| PORTAL-P3-S9-HR-12 | 68, 119 | Messages submitted while a turn is awaiting owner review must stay queued and must not bypass the pause. | Existing queue path and orchestration router | Ensure active-turn checks treat `awaiting_approval` as active and process queued messages only after approval completion. |
| PORTAL-P3-S9-HR-13 | 70, 173–174 | The preference is per-user, defaults ON for new users and users without prior preference, and OFF preserves current dual-path behavior. | Schema, DB helpers, settings UI | Create or extend `user_preferences` and make reads default true when no row exists. |
| PORTAL-P3-S9-HR-14 | 71 | Single-provider `claude` and `kimi` routes never engage the approval pause regardless of preference. | Wrapper routing branch | Gate only auto/dual dual-path execution, not explicit single-provider execution. |
| PORTAL-P3-S9-HR-15 | 78–81, 183–193 | Chat-thread cleanup must filter only owner-facing chat rendering; AI Activity continues to show full persisted history. | `Home.tsx` chat thread and activity tab | Replace chat rendering with an explicit allow-list and do not remove historical event storage or AI Activity rendering. |
| PORTAL-P3-S9-HR-16 | 79, 108, 187 | Empty tasks show only `Send a message to start working on this task.` and do not show the placeholder banner or Review setup details button. | Chat empty state | Implement an allow-list empty-state component and behavioral assertions. |
| PORTAL-P3-S9-HR-17 | 80, 193 | The boilerplate `tasks.create` system event is not rendered in chat and should no longer be emitted for new tasks. Existing rows remain persisted and visible in AI Activity. | `server/routers.ts`, `Home.tsx` | Remove new emission at source; rely on allow-list for existing events. |
| PORTAL-P3-S9-HR-18 | 81, 185 | Chat rendering must use an explicit allow-list of event types and default unknown types to hidden in chat. | Chat renderer | Define the exact allow-list from `INV-S9-14` and test known allowed/disallowed event types. |
| PORTAL-P3-S9-HR-19 | 99–106 | Diagnostics must expose approval state and AI Activity must include the five new approval-related event types with owner-readable copy. | Task Inspector tabs | Add diagnostics formatting while leaving Diagnostics exempt from vocabulary restrictions. |
| PORTAL-P3-S9-HR-20 | 112–118 | Required validation gates are `pnpm check`, focused server §9 test, focused Home behavior test, full `pnpm test --run`, and `pnpm build`. | Validation | Run gates in the specified order before push and record results. |
| PORTAL-P3-S9-HR-21 | 214–228 and project instruction | The completion message must include commit URL lines, validation table, required diffs/prose answers, and the exact boundary statement; section-completion reports must include full GitHub commit URL on a standalone line. | Delivery | Include `Commit URL: https://github.com/viyo-ai/AI-API-Web-Portal-v2/commit/<full-SHA>` in the final §9 report. |

## 5. Per-Invariant Coverage Map

| Invariant | Source Lines | Implementation Target | Behavioral Test Target | Coverage Status |
|---|---:|---|---|---|
| INV-S9-01 | 63 | Add `awaiting_approval` persistence and make `executeWrapperTurn` pause after Claude plan for dual/auto routes when the user's always-check preference is true; Kimi must not be called. | `server/section9.verified-handoff.contract.test.ts` mocks dual route, Claude plan, Kimi invocation, and DB state updates. | COVERED BY PLANNED WORK |
| INV-S9-02 | 64 | Render the plan as an inline chat bubble with buttons labeled `Approve and let Kimi run`, `Send back to Claude with notes`, and `Cancel`; avoid modal-only UI and forbidden terms. | `client/src/pages/Home.behavior.test.tsx` renders persisted awaiting approval state and queries buttons by accessible name. | COVERED BY PLANNED WORK |
| INV-S9-03 | 65 | Add approval mutation and wrapper resume path that supplies persisted Claude plan to Kimi, persists `kimiResult`, runs review when applicable, and exits awaiting state. | Server contract test approves a paused turn and inspects Kimi prompt payload, persisted result, and state transition. | COVERED BY PLANNED WORK |
| INV-S9-04 | 66 | Add revision mutation/UI that collects notes, sends original plan plus feedback to Claude, persists updated plan revision, increments count, rerenders UI, and caps revisions at five. | Server and Home tests submit notes, verify Claude prompt payload and count; sixth revision removes or disables Send-back action. | COVERED BY PLANNED WORK |
| INV-S9-05 | 67 | Add cancel mutation/UI confirmation using Stop registry, transition turn to `stopped`, append cancellation event, and render `Plan canceled. Send a new message when you're ready.` | Server test cancels awaiting turn and asserts no Kimi call; Home test confirms status text after cancel. | COVERED BY PLANNED WORK |
| INV-S9-06 | 68 | Treat `awaiting_approval` as an active turn in queue logic so new submissions remain queued until approval completion. | Server test submits while awaiting approval, asserts queued state, then approval completion drains through existing queue processor. | COVERED BY PLANNED WORK |
| INV-S9-07 | 69 | Persist plan, state, timestamps, and events so a fresh page load reconstructs the approval UI; enforce a 24-hour timeout path. | Home test unmounts/remounts with persisted events and approves successfully; server test covers timeout helper or cleanup behavior. | COVERED BY PLANNED WORK |
| INV-S9-08 | 70 | Add per-user preference with label `Always check with me before Kimi runs`, default true, persistence, and OFF bypass preserving current behavior. | Server test covers default true and OFF bypass; Home test toggles preference and verifies persistence across rerender. | COVERED BY PLANNED WORK |
| INV-S9-09 | 71 | Ensure explicit `claude` and `kimi` route modes never enter awaiting approval regardless of preference. | Server contract test runs explicit routes with preference ON and asserts immediate single-provider behavior. | COVERED BY PLANNED WORK |
| INV-S9-10 | 72 | Enforce forbidden vocabulary absence in non-Diagnostics rendered HTML while allowing Diagnostics to retain technical labels. | Home behavior test renders approval UI/chat/settings and asserts forbidden terms absent from non-Diagnostics scope. | COVERED BY PLANNED WORK |
| INV-S9-11 | 78 | Remove `Technical history` disclosure from chat while preserving route/context/model events in AI Activity. | Home behavior test renders mixed events, asserts no chat disclosure, switches to AI Activity, and sees the events there. | COVERED BY PLANNED WORK |
| INV-S9-12 | 79 | Replace placeholder setup banner and Review setup details button with the clean empty-state hint. | Home behavior test renders new empty task and asserts required hint present and placeholder/button absent. | COVERED BY PLANNED WORK |
| INV-S9-13 | 80 | Stop rendering the boilerplate task-created system event in chat and stop emitting it for new tasks while preserving existing event visibility in AI Activity. | Router test verifies new task omits emission; Home test verifies legacy event hidden from chat and present in AI Activity. | COVERED BY PLANNED WORK |
| INV-S9-14 | 81 | Implement explicit chat allow-list: `message`, `claude_plan_drafted`, `awaiting_owner_approval`, `kimi_drafted_execution`, `claude_review_completed`, `owner_approved_handoff`, `owner_requested_revision`, `owner_canceled_plan`, `kimi_executed_after_approval`. | Home behavior test renders all allow-listed plus unknown/disallowed events and confirms only allow-listed events appear in chat; AI Activity still shows all. | COVERED BY PLANNED WORK |

## 6. Forward Traceability Matrix

| Section | Work or Constraint Extracted | Planned Implementation or Enforcement | Coverage Status |
|---:|---|---|---|
| 1 | §9 scope, existing four-field model, technical-noise observations, §8 deferred | Use existing `WrapperExecutionResult` fields and clean chat surface without changing AI Activity; do not start §8 polish. | COVERED |
| 2 | Ingestion, scaffold reuse, commit discipline, OOS stop, behavioral tests | Create this artifact first; implement additively; use required commit prefixes; add behavior tests. | COVERED |
| 3 | Owner vocabulary rules | Use exact labels and forbidden-vocabulary tests for non-Diagnostics UI. | COVERED |
| 4 | Approval-gate invariants 1–10 | Backend + UI implementation and tests. | COVERED |
| 5 | Chat cleanup invariants 11–14 | Chat renderer allow-list, empty-state replacement, AI Activity preservation, tests. | COVERED |
| 6 | Functional acceptance criteria and validation gates | Map copy, UI flows, diagnostics, events, backward compatibility, and required commands into implementation and final report. | COVERED |
| 7 | Out-of-scope boundaries | Maintain no-touch list; stop if required changes exceed §9. | COVERED |
| 8 | Architectural notes | Use as additive implementation guidance in schema, DB, router, wrapper, and cleanup paths; avoid provider/routing call-shape changes. | COVERED |
| 9 | Chat cleanup notes | Implement allow-list, clean empty state, source boilerplate removal. | COVERED |
| 10 | UI integration notes | Use existing button/textarea/dialog patterns inside chat bubble. | COVERED |
| 11 | Commit and delivery requirements | Gather commit URLs, diffs, validation table, prose answers, and boundary statement. | COVERED |
| 12 | End marker | No implementation required. | JUSTIFIED NO TASK |

There are no orphan directive sections. Sections classified as constraints or reference are covered by enforcement rows rather than implementation code where appropriate.

## 7. Backward Traceability and Hallucination Check

No Taskmaster task generation was run from this directive because the Product Owner supplied a bounded invariant universe and the inherited context states §9 was already authorized with todo entries created. The planned work below traces directly to directive lines, acceptance criteria, architectural notes, or project-level delivery instructions. No planned work item is invented outside the directive.

| Planned Work Item | Source Lines | Traceability Status |
|---|---:|---|
| Create §9 ingestion artifact | 30 | TRACED |
| Add approval turn state and additive approval metadata | 63, 152, 165–171 | TRACED |
| Add approval-related event types and owner-readable activity copy | 101–106 | TRACED |
| Add per-user default-on always-check preference | 70, 97, 173–174 | TRACED |
| Split wrapper into plan pause and approved execution path | 63, 65, 154–158 | TRACED |
| Add approve, revise, and cancel tRPC procedures | 160–164 | TRACED |
| Keep explicit single-provider routes ungated | 71, 133 | TRACED |
| Hold queued messages during awaiting owner approval | 68, 119 | TRACED |
| Preserve refresh/restart approval UI state and timeout stale turns | 69, 177–179 | TRACED |
| Render inline approval UI with exact labels | 42–48, 64, 89–97, 197–201 | TRACED |
| Add settings toggle with required label/subtitle | 70, 97 | TRACED |
| Add Diagnostics approval-state display | 99 | TRACED |
| Remove placeholder banner and technical-history chat disclosure | 15–20, 78–80, 108, 183–193 | TRACED |
| Implement chat event allow-list and preserve AI Activity | 78–81, 141–142, 185–189 | TRACED |
| Stop new boilerplate system event emission in `tasks.create` | 193 | TRACED |
| Add fourteen behavioral invariant tests | 61–81, 112–121 | TRACED |
| Run required validation gates | 112–118 | TRACED |
| Commit, push, checkpoint, and produce completion package with full commit URL | 205–228 and project instruction | TRACED |

## 8. Airtable and Taskmaster Reconciliation

The directive does not provide a Build Tracker Feature ID or Airtable record identifier. The inherited session context states the §9 plan and `todo.md` were already updated before this context handoff, and the directive itself defines the fourteen invariants as the complete implementation universe. Because this session was explicitly resumed at the mandatory ingestion-artifact step and no new task generation is needed to discover scope, this artifact records a reconciliation limitation rather than creating speculative Airtable records.

Before final delivery, `todo.md` must be reconciled so every completed §9 item is marked complete. Any Taskmaster or Airtable status updates must remain read/default unless the Product Owner explicitly authorizes writes, consistent with the VIYO development protocol.

## 9. Conservative Verdict

**PASSED FOR IMPLEMENTATION.** The source directive has been section-indexed, classified, constraint-extracted, forward-traced, and backward-traced. All fourteen `INV-S9-XX` invariants map to implementation targets and behavioral test targets. The out-of-scope boundary is explicit, and no untraced work item is included. Implementation may proceed only within §9, using existing scaffolds, with default-on user preference behavior, full AI Activity preservation, non-Diagnostics plain-English vocabulary enforcement, required validation gates, and a final hold for Product Owner review.
