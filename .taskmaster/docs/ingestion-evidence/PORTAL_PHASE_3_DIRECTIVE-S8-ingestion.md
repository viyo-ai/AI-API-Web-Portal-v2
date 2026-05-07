# PORTAL Phase 3 Directive §8 Ingestion Evidence

**Document ingested:** `/home/ubuntu/upload/PORTALPHASE3DIRECTIVES8COMPOSERQUEUE.pdf`  
**Directive title:** `PORTAL_PHASE_3_DIRECTIVE — §8 Composer Queue UI + Stop Button`  
**Execution status:** §1A-FU-04 was accepted by the Product Owner at commit `fc0b3e0732bc17a9d4873e33fed60d85257ffbf1`; §8 is now authorized.  
**Repository and branch from directive:** `viyo-ai/AI-API-Web-Portal-v2`, branch `agent-work/s4-5-prep-inputs`.  
**Ingestion timestamp:** 2026-05-07  
**Builder:** Manus AI

## 1. Read-State Disclosure

I read the full nine-page attached directive from start to finish before beginning implementation. This ingestion artifact is intentionally written before any §8 code changes and will serve as the task landscape for the Composer Queue UI and Stop Button polish work.

The directive confirms that server-side queue and stop infrastructure already exists. The remaining authorized work is **UI-only polish** in `client/src/pages/Home.tsx`, plus state-aware Stop button wording for the §9 `awaiting_approval` state. If any server-side or foundation-lock change appears necessary, it must be handled as an out-of-scope proposal under `[PORTAL-OOS-XX]` and stopped for Product Owner approval.

## 2. Section Index and Summaries

| Section | Directive Area | Summary | Classification |
|---:|---|---|---|
| 1 | Authorization, repo, and phase context | The directive authorizes §8 only after §1A-FU-04 acceptance and instructs the builder to stop at §8 acceptance rather than declaring Phase 3 complete. It identifies the active repository and branch and explains that this is the final Phase 3 implementation section. | Constraint |
| 2 | Existing infrastructure and source-of-truth observations | The directive states that queue and stop procedures already exist server-side and that §9 already validated queue hold behavior during `awaiting_approval`. It identifies `Home.tsx`, `server/db.ts`, `server/routers.ts`, and existing behavior tests as the key implementation context. | Reference |
| 3 | §8 Execution Discipline | The directive mandates creation of this ingestion evidence file, use of existing scaffolds, conventional commit prefixes, Product Owner stop behavior for out-of-scope discoveries, and behavioral tests rather than source-string assertions. | Constraint |
| 4 | Plain-English Owner Standard | The directive locks exact owner-facing vocabulary for queue and Stop UI, including queue header, edit/cancel labels, full-queue copy, count indicator, and the `awaiting_approval` Stop label. It also forbids raw technical queue vocabulary from non-Diagnostics surfaces. | Hybrid |
| 5 | Hard Functional Invariants | The directive defines ten testable invariants, `INV-S8-01` through `INV-S8-10`, covering queueing during active turns, dropdown behavior, edit/cancel flows, full queue lockout, Stop visibility and label behavior, stop mutation behavior, FIFO flush, composer independence, and vocabulary enforcement. | Work Item |
| 6 | Functional Acceptance Criteria | The directive expands the invariants into owner-visible requirements for queue indicator, dropdown layout, edit flow, cancel flow, full-queue state, Stop visibility, confirmation dialog behavior, queue flush behavior, validation gates, backward compatibility, and test-count growth. | Hybrid |
| 7 | Out-of-Scope | The directive forbids wizard polish, queue capacity changes, drag reorder, bulk queue operations, cross-task queue visibility, server-side queue procedure changes, §9 logic changes, Build Branch logic changes, and new LLM providers. | Constraint |
| 8 | Architectural Notes for Implementation | The directive constrains implementation primarily to `client/src/pages/Home.tsx`, allows use of existing shadcn Popover or DropdownMenu primitives, defines state derivation from the thread query, describes inline edit and cancel behavior, and specifies confirmation dialog behavior for `awaiting_approval`. | Hybrid |
| 9 | Commit Discipline and Closeout Package | The directive requires `[PORTAL-P3-S8-XX]` commit prefixes, passing local gates before push, separate `[PORTAL-OOS-XX]` proposal commits for scope discoveries, and a final Product Owner message containing commit URL, validation table, diffs, prose answers, and boundary statement. | Constraint |
| 10 | Phase 3 Closeout Context | The directive states that after §8 Product Owner acceptance, Phase 3 will be formally closed and the Portal will be ready for VIYO onboarding as Project #1. It does not authorize automatic Phase 3 declaration before §8 acceptance. | Reference |

## 3. Structured Constraint Extraction

| Constraint ID | Rule Text | Applies To | Enforcement Plan |
|---|---|---|---|
| PORTAL-P3-S8-HR-01 | Produce `.taskmaster/docs/ingestion-evidence/PORTAL_PHASE_3_DIRECTIVE-S8-ingestion.md` before code changes. | Session governance | This file is created before implementation edits. |
| PORTAL-P3-S8-HR-02 | §8 is UI-only polish plus the `awaiting_approval` Stop label adjustment; existing server-side queue and stop infrastructure should be reused. | Scope control | Do not modify queue schemas or server-side queue semantics unless an unavoidable gap is discovered and escalated as OOS. |
| PORTAL-P3-S8-HR-03 | Use conventional commits prefixed `[PORTAL-P3-S8-XX]`. | Git history | Commit message must include the required prefix and remain scoped to §8 work. |
| PORTAL-P3-S8-HR-04 | Out-of-scope discoveries require separate `[PORTAL-OOS-XX]` proposal commits and a stop for Product Owner approval. | Scope control | Any server, provider, Build Branch, queue-capacity, or future-work request is halted and reported. |
| PORTAL-P3-S8-HR-05 | Tests must be behavioral tests, not source-string assertions. | Test design | New coverage will interact with rendered UI and mocked mutations rather than only checking code strings. |
| PORTAL-P3-S8-HR-06 | Owner-facing queue header must use plain English: “Queued messages (will send after current turn)”. | UI copy | Queue dropdown/panel header must use this string or an exact owner-facing equivalent only if already accepted; default is exact string. |
| PORTAL-P3-S8-HR-07 | Per-message queue action labels must be “Edit” and “Cancel”. | UI copy | Queue rows must expose accessible Edit and Cancel buttons. |
| PORTAL-P3-S8-HR-08 | Main active-turn Stop label must be “Stop” except during `awaiting_approval`, where it must be “Stop and discard plan”. | UI copy and state machine | Stop label derives from `activeTurn.state`. |
| PORTAL-P3-S8-HR-09 | Full queue message must be exactly “Queue is full. Wait for the current message to finish, or cancel a queued message.” | UI copy | Queue-full state renders the exact string and disables submission. |
| PORTAL-P3-S8-HR-10 | Composer queue indicator must show the owner-facing count format such as “1 of 5 queued”; full state must show “5 of 5 queued (full)”. | UI copy | Indicator derives from queued message count and capacity constant. |
| PORTAL-P3-S8-HR-11 | “Sent” is the owner-facing status pill for a queued message flushed to the thread. | UI copy | If a flushed/sent status is shown in visible UI, translate raw states to “Sent”. |
| PORTAL-P3-S8-HR-12 | Non-Diagnostics surfaces must never expose raw terms `enqueueTaskMessage`, `markQueuedMessagesProcessing`, `requestTurnStop`, `stopRegistry`, `taskMessageQueue`, `MAX_QUEUED_MESSAGES_PER_TASK`, `QueuedMessageState`, `processing`, `sent`, or `cleared`. | UI copy and tests | Add rendered-DOM vocabulary test excluding Diagnostics surfaces. |
| PORTAL-P3-S8-HR-13 | Queue dropdown must show up to five queued messages, newest at bottom, and be collapsible. | Queue UI | Existing queued messages render in original/FIFO order with newest naturally last; toggle controls visibility. |
| PORTAL-P3-S8-HR-14 | Queue row edit opens a textarea prefilled with content, saves through `orchestration.updateQueuedMessage`, and collapses back to display mode. | Queue UI and tRPC | Reuse existing mutation hook and refetch/optimistic behavior. |
| PORTAL-P3-S8-HR-15 | Queue row cancel calls `orchestration.clearQueuedMessage`, removes the row optimistically, and shows a brief “Canceled” confirmation or reverts on failure. | Queue UI and tRPC | Reuse existing mutation hook and display plain-English feedback. |
| PORTAL-P3-S8-HR-16 | When queue is 5/5, Send is disabled and Enter must not submit. | Composer behavior | Submission handler and button disabled state must both gate on full queue. |
| PORTAL-P3-S8-HR-17 | Stop button is visible only during active turn states: `context_assembly`, `model_calling`, `model_review`, `persisting_output`, and `awaiting_approval`. | Stop UI | Stop visibility derives from allowed active state set; hide for completed, failed, blocked, stopped, or no active turn. |
| PORTAL-P3-S8-HR-18 | Clicking Stop during `awaiting_approval` requires a confirmation dialog with title “Stop and discard this plan?” and description “Any queued messages will be sent after the next message you submit.” | Stop UI | Use existing AlertDialog/shadcn pattern and exact copy. |
| PORTAL-P3-S8-HR-19 | Awaiting-approval confirmation buttons are “Keep plan” and “Stop and discard”. | Stop UI | Dialog action buttons must match directive copy. |
| PORTAL-P3-S8-HR-20 | Clicking Stop during other active states fires stop immediately with no confirmation. | Stop behavior | Branch click handler by `activeTurn.state`. |
| PORTAL-P3-S8-HR-21 | After a successful stop action, owner sees “Stopped. Send a new message when you’re ready.” | Stop feedback | Toast or inline status must use the exact plain-English status. |
| PORTAL-P3-S8-HR-22 | After active turn completion, queued messages flush FIFO via existing `processQueuedMessagesAfterGeneration`, appear as normal user messages, and empty/decrement the queue UI. | Queue rendering | UI must reflect thread query updates without changing server flush logic. |
| PORTAL-P3-S8-HR-23 | Composer textarea is independent of queued messages; typing while queued messages exist cannot mutate queued row content. | Composer isolation | State variables for draft and edit rows must remain separate; tests prove isolation. |
| PORTAL-P3-S8-HR-24 | Validation gates are `pnpm check`, focused Home behavior tests, full test suite, and `pnpm build`. | Validation | Run and record all four before push. |
| PORTAL-P3-S8-HR-25 | Backward compatibility is required: existing queue behavior and §9 awaiting-approval queue hold must continue to work. | Regression control | Run existing tests and add invariant tests without weakening §9 tests. |
| PORTAL-P3-S8-HR-26 | Total test count must grow by at least ten, one per `INV-S8-XX`. | Test coverage | Add at least ten new behavior tests and record before/after counts. |
| PORTAL-P3-S8-HR-27 | Queue capacity must not increase beyond five. | Scope control | Use the existing capacity of five; do not modify server constant. |
| PORTAL-P3-S8-HR-28 | Do not modify §9 approval-gate logic; only consume `awaiting_approval` for Stop button UI. | Scope control | Changes remain in client UI and tests unless additive test harness changes require helper adjustment. |
| PORTAL-P3-S8-HR-29 | Do not modify Build Branch logic or add a new LLM provider. | Foundation lock | Any such need is an immediate OOS stop condition. |
| PORTAL-P3-S8-HR-30 | Final completion report must include commit URL, validation table, requested diffs/content, prose answers, and boundary statement. | Delivery | Prepare final message only after gates, push, and checkpoint. |

## 4. Per-Invariant Coverage Map

| Invariant | Required Behavior | Planned Implementation Target | Planned Test Evidence | Coverage Verdict |
|---|---|---|---|---|
| INV-S8-01 | Submitting during any active, non-terminal turn queues via `enqueueTaskMessage`; composer shows queue indicator and dropdown with message text. | `Home.tsx` composer submit handler and queue indicator/dropdown rendering. | Behavioral test with mocked active turn and queue mutation; assert queue indicator “1 of 5 queued” and dropdown content. | COVERED BY PLAN |
| INV-S8-02 | Dropdown shows up to five queued messages, each with “Edit” and “Cancel”; dropdown is collapsible. | Queue dropdown/panel component inside composer area. | Behavioral test renders three queued messages, toggles dropdown, and checks accessible buttons per row. | COVERED BY PLAN |
| INV-S8-03 | Edit opens inline textarea prefilled with content; Save calls `updateQueuedMessage` and updated text displays. | Inline edit state keyed by queued message ID. | Behavioral test clicks Edit, edits content, clicks Save changes, and asserts mutation payload and displayed content. | COVERED BY PLAN |
| INV-S8-04 | Cancel calls `clearQueuedMessage`, removes row, and shows “Canceled” confirmation or inline equivalent. | Optimistic local pending-cancel state plus mutation/refetch. | Behavioral test clicks Cancel, asserts mutation call, removed row, and confirmation text. | COVERED BY PLAN |
| INV-S8-05 | Full queue disables Send, renders exact queue-full message, and Enter does not submit. | Queue capacity guard in submit handler, Send button disabled state, queue-full copy above input. | Behavioral test renders five queued messages, asserts disabled send and exact message, presses Enter, and asserts no enqueue/send call. | COVERED BY PLAN |
| INV-S8-06 | Stop visible for all active states; label is “Stop” except `awaiting_approval`, where it is “Stop and discard plan”. | Active state set and derived `stopButtonLabel`. | Behavioral test parameterizes active states and asserts visibility and labels. | COVERED BY PLAN |
| INV-S8-07 | Stop calls `orchestration.stopGeneration`; awaiting-approval path uses confirmation and owner sees “Stopped. Send a new message when you’re ready.” | Stop click handler branches confirmation only for `awaiting_approval`, then invokes existing stop mutation and feedback. | Behavioral tests for `model_calling` immediate stop and `awaiting_approval` confirmed stop. | COVERED BY PLAN |
| INV-S8-08 | Completed/stopped active turn flushes queued messages FIFO into thread and empties dropdown. | Render from thread query state; do not alter server flush. | Behavioral test models thread update from queued messages to user messages in order and empty queue. | COVERED BY PLAN |
| INV-S8-09 | Composer draft is independent from queued messages; typing draft does not change queued content; submitting adds a new queued message. | Separate composer draft state from queued edit state. | Behavioral test queues two messages, types new draft, asserts queued row content unchanged, submits, and asserts third queue mutation. | COVERED BY PLAN |
| INV-S8-10 | Queue and Stop non-Diagnostics UI must contain only plain-English vocabulary and none of the forbidden raw terms. | Owner-facing copy and rendered UI scan excluding Diagnostics surface. | Behavioral DOM scan test across queue + Stop UI for forbidden vocabulary absence. | COVERED BY PLAN |

## 5. Functional Acceptance Criteria Traceability

| FAC | Acceptance Requirement | Planned Coverage |
|---:|---|---|
| 1 | Composer queue indicator appears when queued messages exist and opens dropdown. | INV-S8-01 and INV-S8-02 tests. |
| 2 | Dropdown vertical list includes text, timestamp, Edit, Cancel, truncation/expand handling, outside/Escape close. | INV-S8-02 plus implementation audit; Escape behavior will be covered where practical by the dropdown test. |
| 3 | Edit flow uses prefilled textarea, Save changes, Discard, tRPC update, and collapse. | INV-S8-03 plus Discard assertion tied to closeout prose answer. |
| 4 | Cancel flow removes optimistically and restores/error-displays on server failure. | INV-S8-04 covers success path; failure path will be implemented with plain-English error where existing mutation error handling allows. |
| 5 | Queue full disables Send, shows exact copy, indicator shows full state, and re-enables after queue count drops. | INV-S8-05 covers full lockout; queue count drop verified through cancel/edit state behavior. |
| 6 | Stop visible only during active states and hidden for terminal/no-turn states. | INV-S8-06. |
| 7 | Awaiting-approval Stop label and confirmation dialog exact copy/buttons. | INV-S8-06 and INV-S8-07. |
| 8 | Other active states use immediate Stop without confirmation. | INV-S8-07. |
| 9 | Queue flush after completion is reflected in FIFO thread order and queue decrement/empty. | INV-S8-08. |
| 10 | Required validation gates pass. | Phase 7 validation evidence. |
| 11 | Backward compatibility with existing queue behavior and §9 hold is preserved. | Full test suite plus focused behavior tests. |
| 12 | Test count grows by at least ten. | Add one named behavior test per `INV-S8-XX`. |

## 6. Out-of-Scope and Stop Conditions

The following items are hard-forbidden in §8. If implementation reveals that any one is required, I must create a separate `[PORTAL-OOS-XX]` proposal commit and stop for Product Owner approval rather than folding it into §8.

| OOS Area | Directive Boundary | Stop Trigger |
|---|---|---|
| §1A-FU-04 wizard polish | Already accepted separately and closed. | Any wizard UX or validation change requested by the code path. |
| Queue capacity | Capacity remains five. | Any need to change `MAX_QUEUED_MESSAGES_PER_TASK`. |
| Reordering or bulk operations | Future work only. | Any drag/drop or cancel-all implementation pressure. |
| Cross-task queue visibility | Future work only. | Any sidebar or global queue design requirement. |
| Server-side queue procedures | Must not modify queue procedure semantics. | Any need to alter `enqueueTaskMessage`, `processQueuedMessagesAfterGeneration`, or related server logic. |
| §9 approval logic | Only consume `awaiting_approval` for UI state. | Any need to change approval gate logic. |
| Build Branch logic or LLM providers | FOUNDATION_LOCK stop conditions. | Any dependency on branch-system or provider changes. |

## 7. Implementation Landscape

The directive identifies `client/src/pages/Home.tsx` as the primary and expected implementation file. The existing server-side queue and stop procedures are treated as already complete infrastructure. Tests are expected in the existing Home behavior test suite, likely `client/src/pages/Home.behavior.test.tsx`, because the directive names existing queue behavior tests there and requests behavioral rather than source-string assertions.

Potential implementation targets are intentionally narrow. The queue dropdown should anchor near the composer send button, should render queued message rows with owner-facing labels, and should keep composer draft state separate from queued-message edit state. The Stop button should use a state-aware label and add a confirmation dialog only for `awaiting_approval`.

## 8. Validation Plan

| Gate | Command | Required Result |
|---|---|---|
| Type/check gate | `pnpm check` | PASS |
| Focused behavior gate | `pnpm test --run client/src/pages/Home.behavior.test.tsx` | PASS |
| Full test gate | `pnpm test --run` | PASS |
| Production build gate | `pnpm build` | PASS |

The final completion package must also include the test-count delta and the names of the ten new invariant tests if requested or needed for acceptance evidence.

## 9. Conservative Verdict

**PASSED FOR IMPLEMENTATION WITH UI-ONLY SCOPE.** The directive has zero orphaned implementation requirements after ingestion: all ten `INV-S8-XX` invariants map to concrete UI and behavior-test targets, and all out-of-scope boundaries are explicit. No server-side schema change, queue procedure change, provider change, or Build Branch change is authorized by §8.

Implementation may now proceed only within the boundaries captured above. If an out-of-scope dependency is discovered, work must stop under the `[PORTAL-OOS-XX]` process.
