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

- [ ] Run a full browser-based Fix → Review → Fix → Review → Confirm UX loop on the live workspace flow, including task selection, Task Inspector tabs, Global Memory, Draft memory note, composer focus, provider controls, file controls, and visible error states.
- [ ] Document concrete browser-loop evidence before checkpointing again, including screenshots or machine-readable results from each pass.
- [ ] Fix any issue found during the browser loop, add focused regression coverage where feasible, then re-run automated validation and the confirmation browser pass.

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

- [ ] Section 3 Skill Libraries directive ingestion: re-read `PORTAL_PHASE_2_DIRECTIVE.md` Section 3 and required VIYO protocols before implementation.
- [ ] Section 3 Skill Libraries schema and migration: add only the persistence required for Skill Libraries while preserving approved Section 2 behavior.
- [ ] Section 3 Skill Libraries backend contracts: implement library persistence, selection, validation, and Build Mode resolution per directive acceptance requirements.
- [ ] Section 3 Skill Libraries prompt integration: wire selected skill library content into Build Mode execution without altering Section 2 governance ordering or behavior.
- [ ] Section 3 Skill Libraries owner UI: add the required Skill Libraries management and selection flows with validation and clear non-placeholder behavior.
- [ ] Section 3 acceptance tests: cover schema, backend contracts, UI validation, Build Mode integration, Section 2 regression, and legacy non-Build behavior without skipped tests.
- [ ] Section 3 closeout: pass validation, append `portal-build-log.md`, commit and push Section 3, report standalone `Commit URL: https://github.com/viyo-ai/AI-API-Web-Portal-v2/commit/<full-SHA>`, then stop before Section 1A.

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
- [ ] Fresh Manus publish checkpoint: save a current checkpoint for the validated §1A follow-up work so the user has an up-to-date publish point without starting §4.
