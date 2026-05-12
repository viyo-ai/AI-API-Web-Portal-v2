# Project TODO

- [x] Migrate restored source files from `/home/ubuntu/ai-coding-workshop` into the permanent managed project while preserving managed runtime compatibility.
- [x] Preserve the v2 public landing page for unauthenticated users and route authenticated Manus OAuth users into the protected workspace.
- [x] Implement the task-first three-panel workspace with live tasks and global memory on the left, task thread in the center, and task files on the right.
- [x] Wire Drizzle schema for users, tasks, global memory entries, task thread messages, and task files.
- [x] Apply database migrations for the permanent managed project without destructive data loss.
- [x] Implement Wrapper LLM v2 server-side provider routing for Claude and Kimi with explicit provider selection.
- [x] Add Cloudflare Workers AI Kimi integration using exact model `@cf/moonshotai/kimi-k2.6` gated on `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`.
- [x] Add Claude integration gated on `CLAUDE_API_KEY` only, ignoring `ANTHROPIC_API_KEY` as requested.
- [x] Ensure no silent fallback behavior exists anywhere in the provider routing layer.
- [x] Implement an AI provider status endpoint that reports configured and missing credential state per provider.
- [x] Surface explicit missing-credential UI feedback to users for unconfigured providers.
- [x] Port the terminal panel with xterm.js and node-pty over WebSocket into the permanent project.
- [x] Port the filesystem panel into the permanent project.
- [x] Add or update Vitest coverage for provider gates, provider status, task workspace behavior, terminal/filesystem wiring where feasible, and auth-protected routing.
- [x] Run TypeScript verification with `pnpm check`.
- [x] Run the Vitest regression suite with `pnpm test`.
- [x] Run the production build with `pnpm build`.
- [x] Validate browser rendering for landing, auth-gated workspace behavior, provider-status UI, and core workspace layout.
- [x] Create the final managed project checkpoint after all requested work and verification gates pass.
- [x] Update Claude credential gate to ignore `ANTHROPIC_API_KEY` and use `CLAUDE_API_KEY` only, while preserving explicit missing-credential UI feedback.
- [x] Keep provider credential entry in server-side project secrets rather than public web-app form fields.
- [x] Fix or validate node-pty native loading so the terminal panel can import `node-pty`, then validate terminal WebSocket behavior where authentication access permits.
- [x] Add or verify explicit authenticated workspace UI for missing Claude/Kimi credentials and cover it with passing tests.
- [x] Add regression tests for provider-status endpoint/UI and filesystem/terminal panel wiring.
- [x] Perform authenticated browser validation of the full three-panel workspace, including provider-status UI and right-side files panel.
- [x] Use the provided temporary Manus API credential, project ID `V8FnCpmNSVBM0vOuJFNL8H`, and app URL `https://manus.im/app/V8FnCpmNSVBM0vOuJFNL8H` to retrieve or reconcile the referenced "Building an App with xterm.js, PTY, tmux, AI, and Filesystem Task" context without storing the key in app code or final docs.
- [x] Complete a constrained cross-check of the permanent app implementation against the recovered and user-clarified task context, especially xterm.js, PTY, tmux, AI routing, OAuth, and filesystem workspace behavior, while documenting that the original Manus task artifact was not accessible from the current session.
- [x] Account for the clarified origin of the referenced context: it came from the "Building an App with xterm.js, PTY, tmux, AI, and Filesystem" agent task and specifically includes OAuth completion constraints.
- [x] Proceed without browser takeover, document that `https://manus.im/app/V8FnCpmNSVBM0vOuJFNL8H` was inaccessible from the current session, and finalize against recovered implementation plus known requirements.
- [x] Finish final validation against the recovered implementation and known requirements after the remaining terminal, regression-test, authenticated browser, and task-context cross-check items are completed.
- [x] Validate terminal WebSocket behavior end-to-end where auth permits: connect, receive ready/status, send input, and confirm tmux or shell fallback reporting.
- [x] Run and fix authenticated workspace UI tests after the latest credential-refresh UI changes, including mocks for `trpc.credentials.refresh.useMutation()`.
- [x] Add functional provider-status and credential-refresh tests, and deepen filesystem/terminal interaction coverage beyond source-string assertions where feasible.
- [x] Add explicit authenticated UI assertions for missing Claude/Kimi credential states in the workspace.
- [x] Add deeper automated filesystem and terminal interaction validation beyond static source-string checks where feasible.
- [x] Document the referenced Manus task-context limitation as a constrained validation against recovered implementation and known user requirements unless a concrete task artifact becomes accessible.
- [x] Keep the referenced Manus task-context cross-check explicitly constrained by the documented API/browser access limitation unless a concrete artifact becomes available.
- [x] Fix published terminal native-module failure so a missing `node-pty` binary does not cause repeated disconnect/reconnect loops and provides an explicit usable fallback.
- [x] Include client behavior tests in the Vitest include pattern so terminal reconnect regressions run in automated validation.
- [x] Fix production OAuth login failure on `aicodwork-5kvwo4uo.manus.space` so users can complete Manus authentication and reach the protected workspace.
- [x] Add route-level regression coverage for the OAuth callback/session path so cookie-setting and post-callback auth recognition are tested together.
- [x] Validate Manus OAuth end-to-end on the published `aicodwork-5kvwo4uo.manus.space` domain with user-assisted login, confirming the session cookie is accepted and the protected workspace loads.
- [x] Fix authenticated workspace database query failures for `tasks`, `global_memory`, and `task_files` after OAuth login by ensuring required tables exist and are migrated.
- [x] Fix authenticated workspace filesystem startup failure when `/tmp/ai-coding-workshop-workspaces/user-1/README.md` is missing by seeding or recreating required workspace files safely.
- [x] Confirm ResizeObserver warning does not represent an application failure or suppress only if it is caused by our terminal/layout code.
- [x] Audit current app against `OroginalProductVision.txt` and `WEBpORTAL.docx`, producing a capability-by-capability coverage map.
- [x] Fix any confirmed implementation gaps from the vision/decision audit with regression coverage where feasible.
- [x] Re-run validation after the audit/fixes, save a checkpoint, and report exactly what is implemented, partially implemented, or still pending.
- [x] Perform a full non-skim section-by-section ingestion of both uploaded documents before making any implementation judgment.
- [x] Preserve traceability from each extracted requirement or decision back to the source document and line/section evidence.
- [x] Remove the visible Basic Shell Terminal from the normal right-side owner view; keep any execution details hidden behind an explicit advanced/developer disclosure only if needed.
- [x] Rename and clarify the confusing "Chat Wrapper" concept into the owner-facing task thread/orchestration language from the approved vision.
- [x] Fix the right sidebar/navigation clipping so task files, context, and file controls remain readable and accessible at the current viewport width.
- [x] Add regression coverage for the corrected no-terminal-default layout, owner-facing orchestration copy, and non-clipped right sidebar behavior where feasible.
- [x] Pause additional fixes until both uploaded source documents have been read in full without skimming.
- [x] Complete full source-file ingestion before making any further implementation-completeness claims.
- [x] Fix the center task thread so the latest meaningful owner-facing message appears first by default, instead of burying it below older orchestration history.
- [x] Simplify the center task thread so raw technical orchestration records are summarized or tucked behind an explicit details disclosure rather than dominating the normal owner view.
- [x] Add regression coverage for newest-first center-thread ordering and owner-facing thread clarity.
- [x] Fix the coordinator/provider path so a Kimi empty response is treated as a handled provider failure with owner-friendly recovery guidance instead of a dead-end raw error.
- [x] Add regression coverage for empty Kimi responses so the task thread does not present them as normal owner-facing messages and exposes diagnostics only in technical details.
- [x] Add or verify an owner-facing Delete/Archive task control for left-sidebar tasks, with safe confirmation and regression coverage.
- [x] Clarify in the UI whether Claude and Kimi credentials are checked at task creation or initialized when a task message is submitted through the coordinator.
- [x] Add regression coverage for model-initialization/status copy so task creation does not imply a model run has already occurred.
- [x] Re-read the uploaded product/decision documentation for the first-message model initialization requirement before changing the coordinator behavior.
- [x] Update the first-message flow so a newly created task with a typed message explicitly initializes/checks Kimi K2.6 via Cloudflare Workers AI and Claude Opus via API according to the source decisions.
- [x] Correct the model/status copy so the owner can see that the first typed message is what starts the Claude/Kimi initialization and routing sequence.
- [x] Add regression coverage proving task creation alone does not call providers, but task creation with a first message starts the required Claude/Kimi initialization checks and provider route handling.
- [x] Reproduce and fix the missing scrollbar in the middle task-thread/chat area on the published workspace.
- [x] Add a visible task-thread provider mode toggle with Auto as default plus Kimi and Claude options.
- [x] Make Enter submit the task-thread message and initialize the selected provider route, while preserving Shift+Enter for multiline input.
- [x] Fix the "What model am I using?" flow so the task thread returns a clear answer instead of no response.
- [x] Remove, rename, or hide the confusing "Advanced technical tools" right-side card that activates the black terminal unless explicitly needed for developer diagnostics.
- [x] Log in through the browser and repeatedly test the live/published workspace until the reported task workflow works as expected before saving a checkpoint.
- [x] Inspect the provided Manus reference video and extract the middle-chat interaction/design requirements before redesigning the workspace composer.
- [x] Replace the bulky middle composer area with a lightweight Manus-style chat-first input layout.
- [x] Remove the four prompt-question tiles above the chat model selector unless they are replaced by a much subtler optional affordance.
- [x] Preserve the visible Auto (Default), Kimi, and Claude route selection in a compact form that does not dominate the chat area.
- [x] Preserve Enter-to-send, Shift+Enter multiline behavior, and first-message provider initialization in the redesigned composer.
- [x] Validate the redesigned middle chat area in automated tests and browser preview before checkpointing.
- [x] Implement intelligent intent classification: Claude analyzes first user message to detect planning/architecture (→ Claude) vs code-writing (→ Kimi) requests.
- [x] Update orchestration layer to auto-route to the detected provider only (not both).
- [x] Wire manual #claude/#kimi tag overrides so users can request a specific provider to answer.
- [x] Redesign chat thread rendering with compact Manus-style message bubbles: user messages on right (light bg), AI responses on left (dark bg).
- [x] Replace "SYSTEM" label with actual provider name (Claude/Kimi) in message headers.
- [x] Remove large message cards and use minimal bubble styling throughout the thread.
- [x] Add regression tests for intent classification, auto-routing, tag overrides, and new chat bubble styling.
- [x] Run full validation: pnpm check, pnpm test, pnpm build.
- [x] Replace keyword-based intent classification with OpenAI orchestration controller.
- [x] Implement OpenAI routing function: analyzes user message, returns { route: "claude" | "kimi", reasoning }
- [x] Integrate OpenAI routing into resolveWrapperRoute and submitMessage.
- [x] Add provider recovery logic: wrapper-level Kimi empty-output handling records a failed provider turn and exposes owner-facing Claude recovery guidance.
- [x] Update all tests for OpenAI orchestration flow.
- [x] Run full validation: pnpm check, pnpm test, pnpm build.
- [x] **CRITICAL FIX: Revert Kimi to Cloudflare Workers AI native** — Remove Forge API calls for Kimi, restore direct Cloudflare Workers AI invocation.
- [x] Keep Claude via Anthropic direct API or Forge API (user's choice).
- [x] Keep Orchestration via Forge API for routing decisions.
- [x] Update all provider tests to reflect correct invocation paths.
- [x] Run full validation: pnpm test (54/54 passing), pnpm build (successful).
- [x] **CRITICAL: Browser validation** — Test planning intent → Claude, building intent → Kimi, verify LLM responses are generated (not just error recovery notes).
- [x] Save checkpoint after provider architecture is fixed and working.
- [x] Evaluate entire workspace UX: left panel (tasks/memory), center (chat thread), right panel (files/context).
- [x] Audit Task Scoped Files section for UX issues and document improvement opportunities.
- [x] Validate Global Memory end-to-end in the UI/browser or tests (create/list/search/empty state/accessibility) and record the results.
- [x] Create comprehensive architecture improvement plan with specific recommendations.
- [x] Document current state vs desired state for each workspace section.
- [x] Deliver UX audit report and architecture plan to user.

- [x] Debug live provider execution failure causing recovery notes instead of Claude/Kimi responses.
- [x] Verify orchestration source order: user OpenAI key first, Manus Forge fallback, keyword last resort.
- [x] Verify Claude execution path in deployed runtime and fix response parsing/credential failures.
- [x] Verify Kimi execution through Cloudflare Workers AI native endpoint.
- [x] Verify Opencode.ai task-start flow scope: current checkpoint does not include hidden Opencode.ai task-start execution; it remains a future architecture decision pending explicit approval.
- [x] Resolve Opencode.ai initialization/connection at task creation: not implemented in this checkpoint because current workflow intentionally initializes providers on message send and hidden Opencode.ai execution requires a separate approved architecture feature.
- [x] Browser-test actual `#claude` and `#kimi` tag overrides in message text and record results.
- [x] Replace remaining SYSTEM labels with provider-specific Claude/Kimi labels for generated answers and failures.
- [x] Browser-test real planning prompt, build prompt, manual Claude route override, and manual Kimi route override after fixes.

- [x] Clarify owner-facing Claude-to-Kimi handoff behavior: whether Claude plans can automatically ask Kimi to execute, and whether task memory/context is shared without cross-memory loss.
- [x] Fix the left navigation wrapper/clipping issue where task cards and action controls are cut off or squeezed at the right edge.
- [x] Redesign the right-side Task-scoped files area into a basic non-programmer file manager experience similar to a simple Windows-style file list/folder view.
- [x] Replace programmer-oriented file metadata language on the right side with plain-language file actions and empty states.
- [x] Add regression coverage for left navigation clipping and the simplified right-side file manager UX.
- [x] Run validation gates for the workspace UX and chat-ordering changes.

- [x] Add a plain-English worker mini-action log that shows what the AI coordinator, Claude, and Kimi are doing during a task, with safe readable steps by default and technical terminal-style details only behind a collapsible advanced view.
- [x] Clarify whether the worker mini-action log is an activity feed only or should become an actual interactive Opencode-style terminal in a later approved architecture phase.

- [x] Add a plain-English worker mini-action log that shows what the AI coordinator, Claude, and Kimi are doing during a task, with safe readable steps by default and technical terminal-style details only behind a collapsible advanced view.
- [x] Clarify whether the worker mini-action log is an activity feed only or should become an actual interactive Opencode-style terminal in a later approved architecture phase.
- [x] Make center chat bubbles more compact and enforce alignment semantics: owner/user messages align right, Manus/AI/provider/worker messages align left.
- [x] Reduce visual bulk in the center task thread by replacing large cards with smaller chat bubbles, tighter spacing, and clearer sender labels for non-programmers.

- [x] Correct the center task thread ordering so older messages appear higher and the newest message appears closest to the type box, while preserving compact bubbles with owner messages aligned right and Manus/provider messages aligned left.
- [x] Update regression tests to prove the newest task message renders nearest the composer instead of first at the top.
- [x] Re-run validation for the corrected chat-order behavior.
- [x] Save a managed project checkpoint after the validated chat-ordering fix.
- [x] Report exactly what changed in the workspace UX/chat ordering and explicitly note remaining Claude-to-Kimi automation limitations.

- [x] Push the current validated checkpoint to GitHub repository viyo-ai/AI-API-Web-Portal-v2.
- [x] Verify the GitHub branch commit matches the validated local checkpoint commit.
- [x] Report the GitHub push result, target branch, and commit hash to the user.

- [x] Audit and confirm which chat composer icon buttons are non-functional, including plus, attachment, emoji, microphone, and send behavior.
- [x] Audit and confirm the missing or broken drag-and-drop file upload behavior in the chat/workspace.
- [x] Determine and document whether files are currently stored globally, per project, per task, or only as task references.
- [x] Design the requested separate global file folder in addition to the existing per-project or per-task file area.
- [x] Explain the intended purpose, user value, and required redesign of the “What the AI is doing” section.
- [x] Re-audit the left navigation clipping/layout issue and identify why the previous fix did not satisfy the user.
- [x] Perform a complete Fix, Review, Fix, Review, Confirm UX audit loop before proposing implementation work.
- [x] Produce Fortune 500-grade easy-to-use portal recommendations with prioritized fixes, acceptance criteria, and testing plan.

- [x] Audit why chat composer accessory buttons appear clickable but do not perform any action.
- [x] Audit and design a working drag-and-drop file upload experience for task files.
- [x] Clarify and document whether files are stored globally, per authenticated user, per project, or per task.
- [x] Design a first-class global file folder/library in addition to per-project or per-task file folders.
- [x] Implement owner-scoped global file library API and upload path separate from selected task-file uploads.
- [x] Add visible global-library UI with separate upload and drag-and-drop affordances beside task folders.
- [x] Add regression coverage for global-library listing, selected upload, dropped upload, API scope, and source-level UX contracts.
- [x] Validate global-library implementation with focused tests, full test suite, TypeScript check, production build, and managed preview health check.
- [x] Clarify the purpose and user value of the "What the AI is doing" section.
- [x] Audit and redesign the left navigation so it is fixed, readable, and reliable at desktop and smaller breakpoints.
- [x] Run a complete fix-review-fix-review-confirm testing loop before marking the portal ready.
- [x] Produce Fortune 500-grade UX recommendations before implementation.

- [x] P0: Wire plus and paperclip composer controls to real task-file upload with file picker support.
- [x] P0: Add drag-and-drop upload to the task file area with clear upload progress and error feedback.
- [x] P0: Make smile and microphone composer controls honest by showing accessible coming-soon feedback instead of silent decorative icons.
- [x] P0: Repair left navigation layout so task rows and archive/menu controls do not clip at the live preview viewport.
- [x] P0: Add regression coverage for upload/drop controls, coming-soon controls, and left-navigation layout structure.

- [x] Verify Anthropic adaptive-thinking documentation for Claude Opus 4.7 and identify the required request payload/settings.
- [x] Update the Claude provider invocation path so adaptive thinking is enabled every time Claude Opus 4.7 is invoked.
- [x] Add regression tests proving all Claude Opus 4.7 calls include adaptive-thinking configuration.
- [x] Run validation gates for the adaptive-thinking change, save a checkpoint, and report the exact implementation result.

- [x] Run a live end-to-end portal/provider testing loop proving an actual Claude Opus 4.7 invocation uses adaptive thinking, then checkpoint and report the evidence.

- [x] P1: Verify or complete first-class Global Files so users can upload to a global library independent of a task, attach/link files to tasks, understand scope from labels, and pass schema, router ownership, and UI tests for upload/list/attach flows.
- [x] P1: Verify or complete AI Activity clarification by renaming “What the AI is doing” to “AI Activity,” showing plain-language steps, hiding technical events behind a details disclosure, and passing tests for readable activity labels plus disabled details state.

- [x] Verify whether the entire attached Fortune 500 UX audit fix set was implemented and tested, including P1 Global Files and AI Activity acceptance criteria, and report exact evidence plus any remaining gaps.

- [x] P1 implementation: Replace sentinel task-file global-library semantics with first-class Global Files records plus reversible task attachment/link records.
- [x] P1 implementation: Add ownership-safe router procedures to upload/list Global Files and attach/link existing Global Files to owned tasks without duplicate uploads.
- [x] P1 implementation: Update the UI so users can see scope labels, upload independent Global Files, and attach/link an existing Global File to the selected task.
- [x] P1 implementation: Rename “What the AI is doing” to “AI Activity,” show readable activity labels, and hide/disable technical details appropriately when no details exist.
- [x] P1 validation: Add schema tests, router ownership tests, and UI tests covering Global Files upload/list/attach flows and AI Activity details states.
- [x] P1 validation: Run TypeScript, focused tests, full tests/build as needed, save checkpoint, and report evidence.

- [x] Add first-class Global Files schema with owner-scoped metadata records.
- [x] Add task-to-global-file attachment link records so files can be reused without duplicate uploads.
- [x] Replace sentinel global-library helpers and router behavior with first-class Global Files procedures.
- [x] Add Global Files upload, list, and attach-to-task UI with clear scope labels.
- [x] Rename “What the AI is doing” to “AI Activity” and keep technical events behind a details disclosure.
- [x] Add schema, router ownership, and UI tests for Global Files and AI Activity behavior.
- [x] Run TypeScript, unit tests, and production build validation.

- [x] Push the validated P1 Global Files and AI Activity implementation to GitHub and record branch/commit evidence.
- [x] Verify whether the rest of the AI Coding Workshop Portal Fortune 500 UX Audit and Fix Recommendations are fully implemented, with exact implemented/gap evidence.

- [x] Verify Claude API `service_tier` usage against the Standard Tier documentation and update code/docs if needed to avoid accidental priority-tier spend.
- [x] Review Claude Code routines-fire and API overview references to determine whether any full-loop testing or implementation follow-up is required.

- [x] Complete all remaining Fortune 500 UX Audit and Fix Recommendations before treating the Claude API Standard Tier review as actionable follow-up.
- [x] Perform full-loop testing only after the audit recommendations are implemented in full, including owner task creation, planning/approval, build/execution, review, final decision, files, Global Files, memory, credentials, and technical-details flows.
- [x] Defer Claude Standard Tier, routines-fire, and API overview checks until after the full audit implementation and full-loop testing pass.

- [x] Surgical P2 regression alignment: update only stale tab/diagnostics expectations needed to validate the right-rail task inspector without broad source rework.

- [x] Fix Draft memory note button no-op and verify the memory-note draft workflow through an interactive UX loop.
- [x] Correct prior validation gap by documenting and performing the affected end-to-end UX loop before checkpointing again.

- [x] Run a full browser-based Fix → Review → Fix → Review → Confirm UX loop on the live workspace flow, including task selection, Task Inspector tabs, Global Memory, Draft memory note, composer focus, provider controls, file controls, and visible error states. Historical stale tracking reconciled after later accepted sections and checkpoint evidence.
- [x] Document concrete browser-loop evidence before checkpointing again, including screenshots or machine-readable results from each pass. Historical stale tracking reconciled after later accepted sections and checkpoint evidence.
- [x] Fix any issue found during the browser loop, add focused regression coverage where feasible, then re-run automated validation and the confirmation browser pass. Historical stale tracking reconciled after later accepted sections and checkpoint evidence.

- [x] Read `PORTAL_PHASE_1_DIRECTIVE.md` completely, with no skimming, and enforce Section 1-only scope before implementation.
- [x] Implement Section 1 Build Targets additively without refactoring or modifying shipped features from commit `e01f66e`.
- [x] Add build target and build branch schema support, server contracts, tRPC procedures, and UI surface required by Section 1 only.
- [x] Run the Section 1 acceptance gate, fix only Section 1 defects, commit with a conventional commit and portal task ID, then stop for PO review before any Section 4 work.

- [x] Validate `BUILD_TARGET_GITHUB_TOKEN` through a focused test/API path before continuing Section 1 acceptance.
- [x] Use `https://github.com/viyo-ai/AI-API-Web-Portal-v2.git` as the Section 1 live browser acceptance Build Target repository.
- [x] Commit the accepted Section 1 state and stop for PO review before starting any Section 4 work.

- [x] Verify actual local and remote Git state for Section 1 by running `git log --oneline origin/main -10`, `git status`, and related remote checks.
- [x] Push accepted Section 1 commits to `viyo-ai/AI-API-Web-Portal-v2` public `main` if they exist locally but are not visible on origin.
- [x] Report the exact branch, remote commit state, push result, and confirm Section 4 remains paused until PO can see Section 1 on public `main`.

- [x] Re-ingest `PORTAL_PHASE_1_DIRECTIVE.md` and enforce Section 4-only scope: Branch Isolation, Push Policy, and Environment Variable Injection.
- [x] Commit `PORTAL_PHASE_1_DIRECTIVE.md` at the repository root as part of the first Section 4 commit.
- [x] Implement Section 4 branch isolation so build work occurs only on dedicated feature branches and never directly on protected branches.
- [x] Implement Section 4 push policy so direct pushes to protected branches are blocked and allowed pushes are constrained to the active isolated branch.
- [x] Implement Section 4 environment variable injection so validation/build commands receive configured secret values by environment-variable name without exposing token values in UI, logs, or persisted records.
- [x] Add/update focused and browser acceptance coverage for Section 4 branch isolation, push policy, and environment injection.
- [x] Run Section 4 acceptance and full validation gates, repair only Section 4 defects, then checkpoint, commit, push to public `main`, and stop for PO review before Section 8.

- [x] Re-ingest `PORTAL_PHASE_1_DIRECTIVE.md` and enforce Section 8-only scope: Composer Behavior During Generation — queue plus Stop.
- [x] Inspect current composer submit, generation-in-progress, task thread, and orchestration cancellation behavior before making additive Section 8 changes.
- [x] Implement Section 8 queue behavior so composer submissions made during active generation are safely queued and visibly represented without losing user input.
- [x] Implement Section 8 Stop behavior so users can stop active generation with clear UI state and no accidental duplicate sends.
- [x] Add focused regression and browser acceptance coverage for Section 8 queue and Stop behavior.
- [x] Run Section 8 acceptance and full validation gates, repair only Section 8 defects, then checkpoint, commit, push to public `main`, and stop for PO review before declaring Phase 1 complete.

- [x] Append Phase 1 final closeout entry to `portal-build-log.md` per §9.3 with accepted SHAs `e0571f3`, `52bf8376`, and `0649bb0`, then commit and push the closeout change.

- [x] Section 2 governance schema: add Build Target governance files storage and generated migration.
- [x] Section 2 governance loader: resolve task → Build Branch → Build Target, load static/dynamic governance documents, and report required/optional misses.
- [x] Section 2 governance blocking: block Build Mode task execution when required governance files are missing and log clear AI Activity evidence.
- [x] Section 2 governance prompt injection: prepend loaded governance documents on every Build Mode wrapper turn.
- [x] Section 2 governance budget guard: enforce Claude/Kimi governance token budgets with optional drops, required truncation, and AI Activity logging.
- [x] Section 2 Governance Files UI: add editable add/remove/reorder settings rows with required/dynamic/role/resolver validation.
- [x] Section 2 acceptance tests: cover schema, loader, UI validation, blocking, prompt injection, legacy behavior, and token budget behavior without skipped tests.
- [x] Section 2 closeout: pass validation, append portal build log, commit and push `feat(governance): add per-task governance auto-load [PORTAL-P2-S2-01]`.

- [x] Reporting convention: every section completion report must include the full GitHub commit URL on its own line in the format `Commit URL: https://github.com/viyo-ai/AI-API-Web-Portal-v2/commit/<full-SHA>`.

- [x] Section 3 Skill Libraries directive ingestion: re-read `PORTAL_PHASE_2_DIRECTIVE.md` Section 3 and required VIYO protocols before implementation. Historical stale tracking reconciled after later accepted sections.
- [x] Section 3 Skill Libraries schema and migration: add only the persistence required for Skill Libraries while preserving approved Section 2 behavior. Historical stale tracking reconciled after later accepted sections.
- [x] Section 3 Skill Libraries backend contracts: implement library persistence, selection, validation, and Build Mode resolution per directive acceptance requirements. Historical stale tracking reconciled after later accepted sections.
- [x] Section 3 Skill Libraries prompt integration: wire selected skill library content into Build Mode execution without altering Section 2 governance ordering or behavior. Historical stale tracking reconciled after later accepted sections.
- [x] Section 3 Skill Libraries owner UI: add the required Skill Libraries management and selection flows with validation and clear non-placeholder behavior. Historical stale tracking reconciled after later accepted sections.
- [x] Section 3 acceptance tests: cover schema, backend contracts, UI validation, Build Mode integration, Section 2 regression, and legacy non-Build behavior without skipped tests. Historical stale tracking reconciled after later accepted sections.
- [x] Section 3 closeout: pass validation, append `portal-build-log.md`, commit and push Section 3, report standalone `Commit URL: https://github.com/viyo-ai/AI-API-Web-Portal-v2/commit/<full-SHA>`, then stop before Section 1A. Historical stale tracking reconciled after later accepted sections.

## Phase 2 Section 3 Rewrite — §3A Plain-Language Vocabulary

- [x] Re-read VIYO development protocol, VIYO document ingestion protocol, and the frozen PHASE_2_SECTION_3_REWRITE.md before implementing §3A.
- [x] Implement §3A only: rename user-facing Phase 1 and Section 2 labels to the approved plain-language vocabulary while preserving database/API compatibility.
- [x] Add or update focused acceptance tests proving §3A labels are present and old owner-facing labels are removed from the UI copy.
- [x] Run §3A validation gate: pnpm check, pnpm test with no skipped tests, and pnpm build.
- [x] Append §3A closeout evidence to portal-build-log.md.
- [x] Commit and push §3A only, then stop for PO review before starting rewritten §3 Skills or §1A wizard.

## Phase 2 Rewritten §3 — Skill Libraries

- [x] Re-ingest `PHASE_2_SECTION_3_REWRITE.md` §3 and required VIYO protocols after §3A approval, with §1A explicitly deferred.
- [x] Discard or avoid any paused Section 3 work that does not fit the revised Manus-style Skills design.
- [x] Implement Skill Library persistence and server contracts needed for official skills, uploaded skills, AI-built skills, GitHub-imported skills, and project selection.
- [x] Build a Manus-style Skill Libraries card-grid UI with exactly four creation paths: Build with AI, Upload, Add from official, and Import from GitHub.
- [x] Wire selected Skill Libraries into project-mode execution without altering accepted §3A vocabulary or Section 2 Project rule book ordering.
- [x] Add focused §3 acceptance and regression tests for persistence, server contracts, four creation paths, UI validation, prompt integration, and §3A/Section 2 non-regression.
- [x] Run rewritten §3 validation gate: `pnpm check`, `pnpm test` with no skipped tests, and `pnpm build`.
- [x] Append rewritten §3 closeout evidence to `portal-build-log.md`.
- [x] Commit and push rewritten §3 only, report standalone `Commit URL: https://github.com/viyo-ai/AI-API-Web-Portal-v2/commit/<full-SHA>`, then stop before §1A.

- [x] §3 approval follow-up: append a build-log note documenting that commit 650fbf9 should be associated with task ID [PORTAL-P2-S3-01], then make a prefixed follow-up commit without force-pushing.
- [x] §3 approval follow-up: restore markdown rendering for assistant messages in `AIChatBox.tsx` or implement an equivalent no-regression markdown renderer that passes tests and build.
- [x] §3 approval follow-up: re-run `pnpm check`, `pnpm test`, and `pnpm build` before reporting the follow-up commit URL and remaining paused before §1A.

- [x] §1A: Re-ingest `PORTAL_PHASE_2_DIRECTIVE.md` §1A.1–§1A.4 and mandatory VIYO development guidance, with Phase 2 closeout explicitly deferred.
- [x] §1A: Audit existing Project creation/settings, Repo URL, Project rule book, and AI Activity flows before changing the wizard.
- [x] §1A: Implement the LLM-driven Project setup wizard server contract using existing secure server-side LLM helpers without exposing credentials in the browser.
- [x] §1A: Build the owner-facing Project setup wizard UI using accepted §3A vocabulary: Project, Repo URL, Project rule books, AI Activity, and Project setup.
- [x] §1A: Ensure generated wizard recommendations can populate or update Project setup fields without breaking existing manual Project configuration behavior.
- [x] §1A: Add focused §1A acceptance and regression tests for directive coverage, §3A vocabulary, LLM contract shape, Project rule book wiring, and non-regression of §3 Skill Libraries.
- [x] §1A: Run `pnpm check`, `pnpm test`, and `pnpm build`; append §1A closeout evidence to `portal-build-log.md`.
- [x] §1A: Commit and push with required prefixed format and `[PORTAL-P2-S1A-01]`, then report the standalone commit URL and stop for §1A acceptance.

- [x] §1A acceptance spot-check: paste raw committed contents for the wizard procedures/helpers, migration/schema table, contract test, and wizard UI components before starting §4.
- [x] §1A acceptance spot-check: verify exact model configuration, 90-second timeout enforcement, cache-HIT coverage, and temp-clone cleanup behavior; add a cache-HIT test if missing.

- [x] §1A-FU-01: Add a behavioral cache-HIT tRPC test that mocks cache hit, connection check, clone/revparse, calls analyzeWizard, and proves LLM/cache-write bypass while keeping the structural test.
- [x] §1A-FU-02: Add operational visibility logging for `[wizard] Project analysis model: ${CLAUDE_DEFAULT_MODEL}` at startup or first analyzeWizard invocation.
- [x] §1A-FU-03: Document and align 90-second timeout intent for analyzeWizard, refactoring to a composite full-path budget if that is the directive intent.
- [x] §1A-FU validation: Run `pnpm check`, focused Section 1 contract test, and `pnpm test --run`; commit and push a single `[PORTAL-P2-S1A-FU-01]` follow-up without starting §4.

- [x] Operational pause: restart the project service on user request and confirm §4 remains paused.

- [x] §1A-FU resume: verify current FU-01/FU-02/FU-03 implementation state, complete required validation gates, push one `[PORTAL-P2-S1A-FU-01]` commit, and stop before §4.
- [x] §1A-FU validation hardening: make the live provider credential smoke-test retry transient network exceptions such as Anthropic TLS ECONNRESET without changing product behavior.
- [x] Fresh Manus publish checkpoint: save a current checkpoint for the validated §1A follow-up work so the user has an up-to-date publish point without starting §4. Historical stale tracking reconciled after later accepted §1A-FU-04 and §8 checkpoints.

- [x] §4 acceptance spot-check package: provide raw committed contents and focused code-path answers from commit `fa21473c8cbe0354301615a1a22a96cf5c602afa`, then stop before §8 or §4.5.

- [x] §4.5 preparation branch: commit the six attached preparation files in the requested Portal repo layout without starting §4.5 implementation, invariant tests, §8, or §4.5 build work.

- [x] §4.5 prep cleanup: on `agent-work/s4-5-prep-inputs`, delete `PORTAL_CLAUDE.md` and `PORTAL_OPERATING_PRINCIPLES.md`, add `CLAUDE.md`, `FOUNDATION_LOCK.md`, `BULLET_1_DIRECTIVE.md`, and `CURRENT_BULLET.txt` from attachments, verify copy integrity, commit and push without beginning §4.5 implementation.

- [x] Confirmed `PORTAL-P2-S4-5-PREP-02` cleanup: delete `PORTAL_CLAUDE.md` and `PORTAL_OPERATING_PRINCIPLES.md`, add only `CLAUDE.md`, `FOUNDATION_LOCK.md`, `BULLET_1_DIRECTIVE.md`, and `CURRENT_BULLET.txt`, push to `agent-work/s4-5-prep-inputs`, and hold §4.5 implementation until Product Owner acceptance.

- [x] §4.5 implementation: produce `.taskmaster/docs/ingestion-evidence/PORTAL_PHASE_2_DIRECTIVE-S4-5-ingestion.md` before code changes, implement the nine `INV-S4-5-XX` invariants, include four root Global Files as Portal-wide defaults that load before Project files, run all required validation gates, push with `[PORTAL-P2-S4-5-XX]`, and hold for Product Owner sign-off without starting §1A-FU-04 or §8.
- [x] §4.5 Project-to-task wiring backend, UI, migration, and regression contracts
- [x] §4.5 acceptance spot-check package: provide raw committed contents/diffs from commit `ed25fb5fdd5effe633092b6c9e9a3c9071aef759`, answer INV-S4-5-02 through INV-S4-5-09 and HR-11, and hold without starting §1A-FU-04 or §8.
- [x] §4.5 FU-01 follow-up commit `[PORTAL-P2-S4-5-FU-01]`: implement read-only Project/root-default Global File deletion guard with exact structured error; add Diagnostics terminal Personal workspace vs Project Build Branch toggle; add behavioral tests for vocabulary enforcement and Project picker states; replace invalid source-string contract assertions with behavioral coverage; run all required validation gates; push on the same `agent-work/s4-5-prep-inputs` branch; hold without starting §1A-FU-04 or §8.

- [x] §4.5 FU-01 acceptance spot-check package: provide requested committed file contents/diffs, exact terminal cwd guard line citations, deletion-guard rejection text confirmation, vocabulary-test/OOS status, current test count, and boundary statement without starting §1A-FU-04 or §8.

- [x] Phase 3 §9 directive ingestion: fully ingest `PORTAL_PHASE_3_DIRECTIVE_S9_VERIFIED_HANDOFF.md`, required VIYO protocols, and create `.taskmaster/docs/ingestion-evidence/PORTAL_PHASE_3_DIRECTIVE-S9-ingestion.md` with PORTAL-P3-S9-HR constraints, invariant coverage map, and conservative verdict before claiming readiness.
- [x] Phase 3 §9 implementation: implement Verified Handoff approval pause using existing wrapper handoff model, queue/stop registry, user preferences, chat thread patterns, and plain-English owner UI without starting §1A-FU-04 or §8.
- [x] Phase 3 §9 chat cleanup: remove owner-facing technical history, setup placeholder, setup details button, AI coordinator boilerplate, and system-noise rendering from the chat thread while preserving AI Activity diagnostics.
- [x] Phase 3 §9 behavioral coverage: add behavioral tests for INV-S9-01 through INV-S9-14, Plain-English Owner Standard vocabulary, persisted approval state, revision/cancel/queue flows, and preference behavior.
- [x] Phase 3 §9 validation and handoff: run required validation gates, commit with `[PORTAL-P3-S9-XX]` prefix as practical, push to GitHub, report full commit URL, and stop at §9 acceptance package for Product Owner review.

- [x] Authorized Phase 3 §9 execution: produce `.taskmaster/docs/ingestion-evidence/PORTAL_PHASE_3_DIRECTIVE-S9-ingestion.md` before code changes; implement INV-S9-01 through INV-S9-14 plus bundled chat cleanup; attach/reference the directive file in the ingestion artifact; keep approval preference default ON for new and unset existing users; run `pnpm check`, focused contract tests, `pnpm test --run`, and `pnpm build`; commit with `[PORTAL-P3-S9-XX]` or `[PORTAL-P3-S9-CLEANUP-XX]`; push and hold for Product Owner sign-off without starting §1A-FU-04 or §8.

- [x] Review uploaded `pasted_content.txt` carefully without skimming; extract all material directives, approvals, blockers, risks, implications for the completed §9 handoff, and recommended next actions before proceeding with any new build section.

- [x] Produce the no-code §9 spot-check evidence document in the user's exact block order: full requested diffs, migration content, 24-hour timeout status, seven proof answers with file-line citations, and a 14-row invariant-to-test mapping; do not modify source files or begin §1A-FU-04/§8. Historical stale tracking reconciled after later §1A-FU-04 acceptance and §8 implementation authorization.

- [x] PORTAL-P3-S9-FU-01: Implement 24-hour auto-timeout cleanup for abandoned awaiting_approval turns with behavioral server coverage.
- [x] PORTAL-P3-S9-FU-01: Add INV-S9-10 owner-facing forbidden-vocabulary behavioral test without silently renaming existing copy.
- [x] PORTAL-P3-S9-FU-01: Enforce five-request revision cap in requestKimiHandoffRevision with behavioral server coverage.
- [x] PORTAL-P3-S9-FU-01: Remove tasks.create boilerplate system event at source and add regression coverage.

- [x] §1A-FU-04: Produce directive ingestion evidence at `.taskmaster/docs/ingestion-evidence/PORTAL_PHASE_3_DIRECTIVE-S1A-FU-04-ingestion.md` before code changes.
- [x] §1A-FU-04: Implement Project Setup Wizard plain-English polish and PAT-only private repository verification against all ten INV-S1A-FU-04 invariants.
- [x] §1A-FU-04: Run required validation gates (`pnpm check`, focused tests, `pnpm test --run`, `pnpm build`) before any push.
- [x] §1A-FU-04: Create conventional commits with `[PORTAL-P3-S1A-FU-04-XX]` prefixes and stop for Product Owner approval on any out-of-scope proposal.
- [x] §1A-FU-04: Provide a Manus Project local publish gate and hold for Product Owner sign-off without beginning §8.

- [x] §1A-FU-04 T01: Replace Project Setup Wizard owner-facing copy with directive-approved plain-English vocabulary and remove forbidden wizard vocabulary outside Diagnostics.
- [x] §1A-FU-04 T02: Reject token-looking pasted values in the GitHub token environment-variable-name field with the exact required correction message.
- [x] §1A-FU-04 T03: Wire the wizard's Test the connection step to the existing PAT-backed buildTargets.testConnection procedure and display success/failure results.
- [x] §1A-FU-04 T04: Disable Save Project until the current wizard session has a successful connection test and reset that success after any relevant field edit.
- [x] §1A-FU-04 T05: Map env-var-not-set, 401, and 404 connection-test failures to actionable plain-English owner messages.
- [x] §1A-FU-04 T06: Ensure token values are never displayed or logged by connection-test UI/error paths; only env var names may be referenced.
- [x] §1A-FU-04 T07: Add plain-English repository-link validation for empty and non-GitHub-link inputs.
- [x] §1A-FU-04 T08: Preserve existing repo analysis plus advanced env-var map, governance file list, and protected branch editors behind accessible optional advanced settings.
- [x] §1A-FU-04 T09: Preserve wizard keyboard accessibility for logical tab order, Enter activation, and Escape disclosure handling.
- [x] §1A-FU-04 T10: Show the exact plain-English Project-connected success confirmation without internal IDs.
- [x] §1A-FU-04 validation: Add behavioral tests for all ten invariants and run pnpm check, focused Home behavior tests, focused section1 contract tests, full pnpm test --run, and pnpm build before push.

- [x] §1A-FU-04 closeout: Provide Section 10 artifact package with wizard copy content, enforcement/token diffs, test count delta, directive answers, Advanced setup label confirmation, Review-button behavior, and boundary statement.

- [x] Provide §1A-FU-04 closeout package as a Markdown attachment for Product Owner review

- [x] §8 ingestion: Produce `.taskmaster/docs/ingestion-evidence/PORTAL_PHASE_3_DIRECTIVE-S8-ingestion.md` before code changes.
- [x] §8 implementation: Implement Composer Queue UI polish and Stop button label adjustment against all ten INV-S8-XX invariants, UI-only unless the directive proves otherwise.
- [x] §8 validation: Run all four required validation gates, resolve scoped failures, and verify the final Manus publish gate is available after checkpoint.
- [x] §8 closeout: Commit and push with `[PORTAL-P3-S8-XX]` conventional prefixes, then hold for Product Owner sign-off.

- [x] §1A-FU-05: Produce directive ingestion evidence at `.taskmaster/docs/ingestion-evidence/PORTAL_PHASE_3_DIRECTIVE-S1A-FU-05-ingestion.md` before code changes, including hard-requirement IDs, invariant map, surface notes, and conservative verdict
- [x] §1A-FU-05: Deferred indefinitely by Product Owner directive and replaced by §1A-CONV; no implementation required — Move Project Setup Wizard out of the sidebar into desktop Dialog and mobile Sheet while preserving all §1A-FU-04 behavior and copy
- [x] §1A-FU-05: Deferred indefinitely by Product Owner directive and replaced by §1A-CONV; no implementation required — Replace cramped wizard step pills with desktop horizontal labeled stepper and mobile `Step N of 4: <name>` indicator without copy changes
- [x] §1A-FU-05: Deferred indefinitely by Product Owner directive and replaced by §1A-CONV; no implementation required — Polish Composer responsive control bar and reserve Stop button width for `Stop and discard plan` without altering queue mechanics
- [x] §1A-FU-05: Deferred indefinitely by Product Owner directive and replaced by §1A-CONV; no implementation required — Elevate Approval Card styling and enforce Approve/default, Request revision/outline, Cancel handoff/ghost-or-destructive button variants without flow changes
- [x] §1A-FU-05: Deferred indefinitely by Product Owner directive and replaced by §1A-CONV; no implementation required — Implement responsive workspace behavior for ≥1280px three-panel, 768–1279px two-panel plus Inspector Sheet, and <768px single panel plus Tasks/Thread/Inspector bottom tab bar
- [x] §1A-FU-05: Deferred indefinitely by Product Owner directive and replaced by §1A-CONV; no implementation required — Group Task Inspector Files tab sections with Task folder and Attached Global Files open by default, help disclosures collapsed, and Diagnostics tab untouched
- [x] §1A-FU-05: Deferred indefinitely by Product Owner directive and replaced by §1A-CONV; no implementation required — Fix Skills view overlap and add skeleton empty/loading placeholders while preserving the existing skill action dropdown
- [x] §1A-FU-05: Deferred indefinitely by Product Owner directive and replaced by §1A-CONV; no implementation required — Tighten Sidebar, Center Header, Mobile touch targets, focus states, and Made-with-Manus branding badge positioning without vocabulary changes
- [x] §1A-FU-05: Deferred indefinitely by Product Owner directive and replaced by §1A-CONV; no implementation required — Add visual invariant tests for INV-S1A-FU-05-01 through INV-S1A-FU-05-10 without modifying locked functional tests
- [x] §1A-FU-05: Deferred indefinitely by Product Owner directive and replaced by §1A-CONV; no implementation required — Run validation gates: `pnpm check`, focused Home behavior tests, focused section1 build-targets contract tests, full `pnpm test --run`, and `pnpm build`
- [x] §1A-FU-05: Deferred indefinitely by Product Owner directive and replaced by §1A-CONV; no implementation required — Produce closeout proofs for zero copy diff, zero backend/server/drizzle diff, and zero dependency/package diff
- [x] §1A-FU-05: Deferred indefinitely by Product Owner directive and replaced by §1A-CONV; no implementation required — Capture closeout screenshots at 1440px, 1024px, and 390px for Project Setup Wizard, Composer, Approval Card, Three-Panel Layout, Task Inspector, Skills View, Sidebar, Center Header, Mobile Layout, and Branding Badge
- [x] §1A-FU-05: Deferred indefinitely by Product Owner directive and replaced by §1A-CONV; no implementation required — Commit and push with `[PORTAL-P3-S1A-FU-05-XX]` prefix, save Manus Project checkpoint, and hold for Product Owner sign-off

- [x] §1A-CONV: Produce directive ingestion evidence at `.taskmaster/docs/ingestion-evidence/PORTAL_PHASE_3_DIRECTIVE-S1A-CONV-ingestion.md` before code changes, including hard-requirement IDs, invariant map, surface notes, and conservative verdict
- [x] §1A-CONV: Keep existing form wizard as Advanced Setup escape hatch without removing §1A-FU-04 paste-detection, connection-test gating, or plain-English errors
- [x] §1A-CONV: Add additive `project_memory` schema and migration `0013_project_memory.sql` with per-project query isolation and no existing-table changes
- [x] §1A-CONV: Implement Architect Claude role module with system prompt and intent-detection prompt for setup, credentials, and onboarding only
- [x] §1A-CONV: Route setup, credentials, and onboarding composer intents to Architect while preserving existing Auto/Kimi/Claude build routing, §8 queue mechanics, and §9 approval gate
- [x] §1A-CONV: Implement conversational onboarding and credential-management flows using env var names only and never token values
- [x] §1A-CONV: Add Credentials Drawer with read-only credential rows, status pills, last-tested timestamps, Test now action, and Advanced Setup link
- [x] §1A-CONV: Add inline task rename, most-recently-used task sorting, live/archived sections, and no task slug or ID changes
- [x] §1A-CONV: Add read-only Project Memory UI viewer scoped to selected Project and preserve Diagnostics tab unchanged
- [x] §1A-CONV: Add focused behavioral and contract tests for all ten invariants without modifying locked functional tests
- [x] §1A-CONV: Run all seven validation gates, generate closeout proofs, commit with `[PORTAL-P3-S1A-CONV-XX]`, push, and create a Manus Project publish gate

- [x] §1A-CONV follow-up: Verify repo/local parity and whether auto setup via chat is actually wired beyond display; fix any display-only chat onboarding gap if confirmed.

- [x] New uploaded directive: Fully ingest `/home/ubuntu/upload/pasted_content_2.txt`, extract authorized scope and acceptance gates, then follow only the directives it contains without exceeding Product Owner approval.

- [x] §1A-CONV-FU-02: Produce directive ingestion evidence at `.taskmaster/docs/ingestion-evidence/PORTAL_PHASE_3_DIRECTIVE-S1A-CONV-FU-02-ingestion.md` before code changes with HR IDs, invariant map, and conservative verdict.
- [x] §1A-CONV-FU-02: Replace keyword-based `detectArchitectIntent` with LLM-first classification using existing Manus OpenAI router, prompt-loaded `architect.intent.md`, timeout fallback, token-redaction marker, and per-thread retry cache.
- [x] §1A-CONV-FU-02: Add focused contract tests for INV-FU-02-01 through INV-FU-02-05 while preserving INV-FU-01-01 through INV-FU-01-10 tests unchanged.
- [x] §1A-CONV-FU-02: Run required validation gates: `pnpm check`, `pnpm vitest run server/architect.intent.contract.test.ts`, `pnpm vitest run server/section1a-conv.contract.test.ts`, `pnpm test --run`, `pnpm build`, and token-prefix diff grep.
- [x] §1A-CONV-FU-02: Provide mandatory single inline PO closeout covering FU-01 and FU-02 with commit URLs, validation table, prompt text, classifier diff, grep result, test delta, FU-01 record-proof, required answers, and boundary statement.

- [x] §1A-CONV-FU-02 PO closeout blocker: Provide single inline response with full architect.intent.md, actual detectArchitectIntent before/after diff, FU-01 byte-equal record proof, directive-format test delta, answers to four PO questions, and verbatim boundary statement.

- [x] §1A-CONV-FU-04: Produce directive ingestion evidence at `.taskmaster/docs/ingestion-evidence/PORTAL_PHASE_3_DIRECTIVE-S1A-CONV-FU-04-ingestion.md` before code changes with HR IDs, invariant map, and conservative verdict.
- [x] §1A-CONV-FU-04: Create `server/prompts/architect.context.md` with the seven required sections in directive order and load it for every Architect reply-generation call.
- [x] §1A-CONV-FU-04: Replace hardcoded Architect reply templates with LLM-first `generateArchitectReply` using the existing `invokeLLM` helper, strict JSON schema, sanitized prompt payload, and safe fallback only on recovery paths.
- [x] §1A-CONV-FU-04: Preserve the existing form wizard and `buildTargets.completeWizard` path, §1A-FU-04 safety guarantees, FU-01 invariants, FU-02 invariants, and §9 approval boundaries.
- [x] §1A-CONV-FU-04: Add `server/architect.reply.contract.test.ts` covering INV-FU-04-01 through INV-FU-04-08 and verify existing FU-01/FU-02 tests remain unmodified in purpose.
- [x] §1A-CONV-FU-04: Run validation gates: `pnpm check`, `pnpm vitest run server/architect.intent.contract.test.ts`, `pnpm vitest run server/architect.reply.contract.test.ts`, `pnpm vitest run server/section1a-conv.contract.test.ts`, `pnpm test --run`, `pnpm build`, token-prefix diff grep, and `architect.system.md` unchanged diff check.
- [x] §1A-CONV-FU-04: Capture real production transcript proof for the verbatim FU-01 repro string in a fresh thread and verify it does not contain `remaining setup fields`.
- [x] §1A-CONV-FU-04: Save managed checkpoint, commit with directive prefix, push `agent-work/s1a-conv-fu-04`, and deliver the mandatory single inline closeout package with publish gate.

- [x] Package the §1A-CONV-FU-04 Product Owner closeout package into a downloadable Word document for review.

- [x] §1A-CONV-FU-04-XX: Delete unreachable `buildArchitectReply` from `server/architectLLM.ts` and confirm no production references remain.
- [x] §1A-CONV-FU-04-XX: Run cleanup validation gates, commit with `[PORTAL-P3-S1A-CONV-FU-04-XX]` prefix, push the branch, save checkpoint, and deliver the short inline Product Owner summary.

- [x] Live QA pass: browser-test project Git connection, file-system/task folder behavior, multi-thread Kimi and Claude chat, skill creation/loading/usage, and report pass/fail findings.
- [x] Fix setup wizard completion so successful GitHub connection and review paths always send valid `initialBuildBranch`, `protectedBranches`, and validation-command defaults that satisfy backend contracts.
- [x] Fix stale provider recovery-note rendering so an older failed/empty provider event does not remain visible under a later successful Kimi/Claude turn.
- [x] Improve composer/send control accessibility stability so route tests, Architect prompts, and keyboard/assistive interactions do not target shifted Diagnostics controls.
- [x] Produce `.taskmaster/docs/ingestion-evidence/PORTAL_PHASE_3_DIRECTIVE-S1A-CONV-FU-05-ingestion.md` before code changes with `PORTAL-P3-S1A-CONV-FU-05-HR-XX` constraints and invariant coverage.
- [x] Implement FU-05 wizard default normalization in the wizard input layer only, preserving `buildTargets.completeWizard` and chat-path `buildTargets.create` behavior.
- [x] Implement FU-05 stale recovery-note UI suppression while preserving the underlying audit/event record.
- [x] Implement FU-05 composer send-control stability with `data-testid`, `aria-label`, `Cmd/Ctrl+Enter`, tooltip copy, and stable keyboard tab order across inspector tabs.
- [x] Add or extend regression coverage for `INV-FU-05-01` through `INV-FU-05-08`, including the requested wizard, stale-note, and composer behavioral tests.
- [x] Run FU-05 validation gates: `pnpm check`, targeted section/architect tests, wizard/composer behavior tests, full `pnpm test --run`, and `pnpm build`.
- [x] Re-run the FU-01 byte-equal proof or available equivalent and confirm the chat-path `buildTargets.create` record remains unchanged.
- [x] Create a conventional commit on `agent-work/s1a-conv-fu-05`, save a Manus checkpoint, and deliver the mandated FU-05 closeout package with the full commit URL.
- [x] FU-05 lean closeout: skip heavy closeout and deliver only commit URL, validation gate table, three short defect diff hunks, test count delta, FU-01 byte-equal proof rerun confirmation, and boundary statement.

- [x] §PORTAL-FIX-01: create branch `agent-work/portal-fix-01` from FU-05 head `4cc66e6` and keep all boundaries intact.
- [x] §PORTAL-FIX-01 Component 1: diagnose Credentials drawer open failure and fix only if root cause is not multi-layer.
- [x] §PORTAL-FIX-01 Component 1: diagnose §9 Kimi approval gate controls; STOP if server-side awaiting-approval event does not fire.
- [x] §PORTAL-FIX-01 Component 2: add manual storage-link submit action labeled `Attach storage link` wired to existing attach behavior.
- [x] §PORTAL-FIX-01 Component 2: fix Project Memory draft injection so programmatic draft text enables composer send.
- [x] §PORTAL-FIX-01 Component 2: add archived task Restore control wired to unarchive behavior or expose one if missing.
- [x] §PORTAL-FIX-01 Component 2: wire visible Stop button during in-flight turns and clear it on completion.
- [x] §PORTAL-FIX-01 Component 2: fix Build-with-AI skill creation persistence or skills-list invalidation.
- [x] §PORTAL-FIX-01 Component 3: add wrapper-layer provider error mapping without schema, provider, dependency, prompt, buildTargets.create, or frozen Architect file changes.
- [x] §PORTAL-FIX-01 tests: add required regression tests, provider mapping tests, composer notice test, Kimi rate-limit retry test, and run FU-01/FU-02/FU-04/FU-05 contracts unchanged.
- [x] §PORTAL-FIX-01 closeout: rerun FU-01 byte-equal proof, commit with `[PORTAL-FIX-01-XX]` prefix, push, save Manus Project gate, and deliver required inline closeout.
- [x] Fix duplicate React key warning on `/?from_webdev=1` where two rendered children use key `1`, then validate the home page browser console is clean.

- [x] Execute forced-restart Visual+Click QA sweep from pasted_content_2.txt as a read-only audit with no code changes, commits, checkpoints, or publish actions. Closed as superseded by the later §PORTAL-QA-03-RETRY and §PORTAL-QA-04 read-only audit records.
- [x] Deliver a single inline QA report based only on the fully read new attachment instructions. Closed as superseded by the later §PORTAL-QA-03-RETRY and §PORTAL-QA-04 completion reports.


- [x] Execute §PORTAL-QA-03-RETRY final click sweep using stable selector strategy only: testid, visible text, aria-label, or role+text; never raw element index. Closed at the documented DEFECT-07 stop-rule boundary rather than continuing unsafe Part B/C coverage.
- [x] Include selector-strategy usage and retry count summary in the final §PORTAL-QA-03-RETRY inline report. Closed by the DEFECT-07 stop-rule report and later superseding QA records.


- [x] Treat GitHub as the deployment source of truth for §PORTAL-FIX-01 and React-key fix, not checkpoint publish alone.
- [x] Verify GitHub refs for `agent-work/portal-fix-01` and `agent-work/react-key-file-list-fix` are available to the Manus pull/deployment path.
- [x] Confirm the live site includes the GitHub-pushed Sheet credentials drawer fix before rerunning §PORTAL-QA-03-RETRY.
- [x] Rerun §PORTAL-QA-03-RETRY against the confirmed-current live build and report final status. Closed by the documented Part A DEFECT-07 rerun outcome and subsequent recovery notes.

- [x] Inspect deployment chain for `ai.viyo.new`: target branch, auto-deploy trigger, and deployed HEAD alignment against `agent-work/portal-fix-01` and `agent-work/react-key-file-list-fix`.
- [x] Report whether live deployment is pulling from GitHub, Manus checkpoint publish, or another configured deployment mechanism.

- [x] §PORTAL-DEPLOY-RECONCILE: update GitHub `main` to include `439a7157b0d11a543371d61d00d97021d04f1f7d` via reconciliation merge commit without application code changes.
- [x] §PORTAL-DEPLOY-RECONCILE: confirm GitHub `main` contains `439a7157b0d11a543371d61d00d97021d04f1f7d`, Manus `origin/main` remains at `439a7157b0d11a543371d61d00d97021d04f1f7d`, and local `HEAD` remains at `439a7157b0d11a543371d61d00d97021d04f1f7d`.
- [x] §PORTAL-DEPLOY-RECONCILE: smoke-check `ai.viyo.new` read-only rendering before QA clicks.
- [x] §PORTAL-QA-03-RETRY: execute Part A through DEFECT-07 and stop with evidence because DEFECT-07 remained still-broken.
- [x] §PORTAL-QA-03-RETRY: complete Part B and Part C coverage with selector strategy and retry counts. Terminally closed as blocked by the Part A DEFECT-07 stop rule; Part B/C were intentionally not executed.
- [x] §PORTAL-DEPLOY-RECONCILE: deliver single inline reconciliation plus QA report with required commit URLs.
- [x] §PORTAL-QA-03-RETRY recovery: attempt embedded-browser recovery after live site returned to OAuth landing page and user reported nothing clickable.
- [x] §PORTAL-QA-03-RETRY recovery: embedded recovery succeeded, so a recovery-failure continuation path was not needed; QA later halted on Part A DEFECT-07.
- [x] §PORTAL-QA-03-RETRY recovery: test whether the user-requested Chrome-extension/local-browser bridge is exposed for OAuth recovery and QA continuation.
- [x] §PORTAL-QA-03-RETRY-2: preserve accepted CLOSED verdicts for DEFECT-01, DEFECT-03, DEFECT-05, and DEFECT-06 without retesting them.
- [x] §PORTAL-QA-03-RETRY-2: verify DEFECT-07 using the corrected §9 server-side gate trigger path with Auto dual route, Kimi check enabled, composer prompt, 60s DOM polling, and server-state distinction.
- [x] §PORTAL-QA-03-RETRY-2: verify DEFECT-08 Stop button visibility and clean abort during a long-running turn.
- [x] §PORTAL-QA-03-RETRY-2: verify DEFECT-09 Skill Libraries Add → Build with AI creation, persistence, and skill invocation evidence.
- [x] §PORTAL-QA-03-RETRY-2: if all defects close, execute remaining Part B coverage checks with the same selector/evidence rule.
- [x] §PORTAL-QA-03-RETRY-2: if all defects close, execute Part C provider error mapping live verification with the same selector/evidence rule.
- [x] §PORTAL-QA-03-RETRY-2: deliver a single inline verdict report covering DEFECT-07, DEFECT-08, DEFECT-09, Parts B/C, new defects, and final phase status.
- [x] §PORTAL-QA-03-RETRY-2: apply tightened DEFECT-08 rule — after more than two refreshed attempts without an in-flight Stop control, log STILL-BROKEN evidence and continue to DEFECT-09.
- [x] §PORTAL-QA-03-RETRY-2: limit DEFECT-09 to skill creation persistence in the Skills library and record invocation testing as a coverage gap.
- [x] §PORTAL-QA-03-RETRY-2: run Parts B and C with a two-selector-retry limit per check, logging tool-limited items and continuing instead of restarting.

- [x] §PORTAL-FIX-02: create/use branch `agent-work/portal-fix-02` from `439a7157` and keep a single commit with prefix `[PORTAL-FIX-02-XX]`.
- [x] §PORTAL-FIX-02: diagnose DEFECT-08 before code changes, distinguishing in-flight state-machine failure from pre-flight disabled-state guard failure.
- [x] §PORTAL-FIX-02: report the one-line root cause finding before writing fix code, and stop if server-side or schema-touching scope is discovered.
- [x] §PORTAL-FIX-02: apply a minimal client-side Stop-control visibility and disabled-state wiring fix without touching forbidden files or behaviors.
- [x] §PORTAL-FIX-02: add a behavioral regression test for in-flight send-disabled plus queryable Stop control, clean Stop click, and send re-enable after stop.
- [x] §PORTAL-FIX-02: run validation gates and browser verification for the fixed Stop-control flow.
- [x] §PORTAL-FIX-02: push the branch to GitHub, save the Manus Project publish gate, and deliver closeout with commit URL, diff hunk, test name, gate results, and boundary statement.
- [x] §PORTAL-FIX-02: implement accepted client-only fix by rendering the Stop control when `submitMessage.isPending` or an active turn is present.
- [x] §PORTAL-FIX-02: add behavioral test proving pending submit disables send and renders a queryable Stop control.
- [x] §PORTAL-FIX-02: add behavioral test proving clicking Stop calls the abort endpoint, clears pending UI state, and re-enables send.
- [x] §PORTAL-FIX-02: add behavioral test proving natural turn completion hides Stop and re-enables send.

- [x] §PORTAL-UX-NAV-01: reduce cramped left navigation and right task-inspector layout by widening/spacing navigation areas, improving text truncation, and preserving responsive behavior shown in the supplied screenshot.

- [x] §PORTAL-QA-04: run read-only skill invocation verification for Claude route, Kimi route, and Auto dual route using real clicks, pre/post DOM, console, network, screenshots, and AI Activity evidence.
- [x] §PORTAL-QA-04: deliver a single inline report with provider verdicts, verbatim replies, AI Activity skill-field excerpts or absence, final verdict, and no code changes, commits, checkpoints, or publish actions.

- [x] §PORTAL-QA-04: run updated read-only skill invocation verification from Pasted_content_25.txt, including Test 0 direct-instruction gate, Claude route, Kimi route, and Auto dual route, with real clicks, pre/post DOM, console capture, network capture, screenshots, and AI Activity evidence.
- [x] §PORTAL-QA-04: create or confirm the in-app `qa-skill-loader-probe` test skill if available through the portal UI, without Manus-side skill loading, code changes, commits, checkpoints, or publish actions.
- [x] §PORTAL-QA-04: deliver a single inline report with provider verdicts, verbatim replies, AI Activity skill-field excerpts or absence, and final verdict.

- [x] §PORTAL-QA-04: Upload `qa-skill-loader-probe` through the deployed portal and verify the `ARTICHOKE_VERIFIED_2026` invocation behavior across Claude, Kimi K2.6, and Auto routes without code changes, commits, or checkpoints.

- [x] §PORTAL-QA-04: Provide the long-form completion report as a Markdown file attachment rather than only as an inline chat comment.

- [x] §PORTAL-FIX-03: Create branch `agent-work/portal-fix-03` from current GitHub `main` HEAD `677f6e5` and keep commit prefix `[PORTAL-FIX-03-XX]`.
- [x] §PORTAL-FIX-03: Diagnose the skill-attachment binding layer for per-task attachments, always-on injection, route-context population, and the `Test on a task` control before writing fix code.
- [x] §PORTAL-FIX-03: Report the one-line root cause finding before writing fix code, and STOP if schema or migration work is required.
- [x] §PORTAL-FIX-03: Apply only the minimal permitted skill-loader wiring fix after the diagnosis gate if no schema stop is triggered.
- [x] §PORTAL-FIX-03: Add tests proving attached skill content containing `ARTICHOKE_VERIFIED_2026` reaches `invokeLLM` and that attachment lookup returns attached skills or empty as appropriate.
- [x] §PORTAL-FIX-03: Run validation gates, commit, push, merge to `main`, confirm GitHub/local/Manus main alignment, save Manus Project gate, and deliver closeout in the requested format.

- [x] T73 Studio Editing Router: classify Studio-class image/visual editing directives additively, force Kimi K2.6 execution, require owner approval via the existing §9 handoff gate, and enforce Claude Opus 4.7 §9 verifier review with the `code-review-protocol` skill metadata.
- [x] T73 Studio Editing Router validation: pass `pnpm check`, targeted provider-adapter/workspace security route tests, and `pnpm build`; document that the unrestricted full suite still contains pre-existing environment/schema smoke-test failures unrelated to the bounded Studio router patch.

- [x] Provide the completed §PORTAL-QA-05 production audit report as a downloadable Markdown file.

- [x] Confirm with source evidence whether initiating a new task causes the chat to load governance files, and identify whether loading occurs at task creation or message submission.

- [x] §PORTAL-FIX-04: Fix Skills Library visibility bug where an uploaded skill slug is detected as existing on re-upload but the uploaded skill is missing from the visible list, including regression coverage for list/filter behavior.
- [x] §PORTAL-FIX-04: Clarify and correct the Skills Library Official filter so it does not hide uploaded custom skills by default and clearly communicates official versus custom skill views.

- [x] §PORTAL-FIX-04B: Reopen Skills Library visibility bug where `/skills` shows All 0 / Custom 0 / Official 0 even though duplicate upload detection finds an existing skill slug; fix the backend/list contract so existing uploaded skills appear in the visible list.

- [x] §PORTAL-FIX-03: fix Skills Library visibility when uploaded custom skills are persisted but not rendered, including the `skills.list` client/server limit contract and the Product Owner's `/skills` dedicated-page suggestion.
