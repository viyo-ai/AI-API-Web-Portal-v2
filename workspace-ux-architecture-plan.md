# AI Coding Workshop Workspace UX Audit and Architecture Improvement Plan

**Author:** Manus AI  
**Date:** 2026-05-06  
**Project:** `ai-coding-workshop-permanent`  
**Scope:** Current three-panel task workspace, Claude/Kimi provider orchestration, task-scoped files, global memory, hidden developer diagnostics, and production-readiness recommendations.

## Executive Summary

The current AI Coding Workshop workspace is in a **working task-first state**. Browser validation confirmed that the live preview now returns real provider responses for the four critical routing paths: Auto planning input routes to **Claude**, Auto code-writing input routes to **Kimi**, manual **Kimi K2.6** override works, and manual **Claude Opus 4.7** override works. The stale runtime export issue is cleared, provider labels display as Claude or Kimi rather than `SYSTEM`, and technical orchestration records remain hidden behind an explicit disclosure instead of dominating the owner thread.

The product is strongest in its **honest state management**. Empty memory and file states do not pretend records exist, unsupported file actions remain disabled until metadata exists, credentials are explicitly surfaced, and Kimi empty responses are now treated as handled provider failures with owner-facing recovery guidance rather than silent fallback or a raw dead-end error. The main remaining improvement area is not core provider execution; it is **workflow maturity around memory capture, task-file operations, and the right-rail information architecture**.

| Area | Current Status | Product Risk | Recommended Priority |
|---|---:|---|---:|
| Provider routing and live responses | Working in browser validation | Low, provided credentials remain configured | P0 maintain/regression |
| Kimi empty-response recovery | Covered by focused tests | Low to medium; provider drift can reappear | P0 maintain/regression |
| Center task thread UX | Improved and usable | Medium; Claude plan responses can still feel too verbose for simple prompts | P1 |
| Left tasks and global memory | Functional display, honest empty states | Medium; memory is present but not yet an owner-visible capture workflow | P1 |
| Right task files and context | Metadata and workspace snapshots exist, visible actions are guarded | Medium-high; file controls need a clearer end-to-end owner workflow | P1 |
| Developer diagnostics | Hidden by default and explicitly disclosed | Low; still consumes right-rail space | P2 |
| Architecture documentation | This plan establishes current state and next steps | Low | P0 complete |

## Evidence-Based Current State

The current app uses a three-panel layout. The left panel contains task creation, live task search, task archive controls, and global memory. The center panel contains credential status chips, the selected task thread, technical-history disclosure, and a compact Manus-style composer with Auto, Kimi, and Claude route selection. The right panel contains production safeguards, task-scoped file metadata controls, hidden developer diagnostics, and a master files view.

| Workspace Section | Verified Current Behavior | Implementation Evidence |
|---|---|---|
| Left task list | Tasks are owner-scoped, searchable, status-labeled, and archive-protected by confirmation. | `client/src/pages/Home.tsx`, `server/routers.ts`, `server/db.ts` |
| Global memory | Memory entries can be created, listed, and searched server-side; the UI displays recent memory or an honest empty state. | `memory.create`, `memory.list`, `memory.search`; left-panel `Global memory` section |
| Center task thread | Owner-visible events are shown as compact message bubbles, technical records are hidden behind a details toggle, and provider failure guidance appears as a plain-English recovery note. | `Home.tsx` center thread and recovery note; focused behavior tests |
| Provider orchestration | Auto invokes OpenAI routing to choose Claude or Kimi, manual route selector and `#claude`/`#kimi` tags are supported, missing credentials block explicitly. | `resolveWrapperRoute`, `detectRouteOverride`, `submitMessage` |
| Kimi execution | Kimi calls Cloudflare Workers AI native model `@cf/moonshotai/kimi-k2.6` and returns owner-visible Kimi-labeled responses. | `wrapperLLM.ts` and browser validation notes |
| Claude execution | Claude uses the Claude API with `CLAUDE_API_KEY` gating and returns owner-visible Claude-labeled responses. | `wrapperLLM.ts` and browser validation notes |
| Task-scoped files | Metadata can be recorded manually; filesystem write/upload operations can create storage-backed task-file records and task events. | `files.createMetadata`, `filesystem.write`, `filesystem.upload` |
| Developer diagnostics | Terminal and filesystem panels remain hidden until the owner opens diagnostics; terminal has PTY/tmux mode and fallback handling. | `Home.tsx`, `TerminalPanel.tsx`, `FilesystemPanel.tsx` |

## Browser Validation Summary

The latest browser validation used the live managed preview and an authenticated workspace state. A new task titled `Browser validation routing 1778048300` was created and used for routing checks. The following results were observed and recorded in `browser-validation-notes.md`.

| Validation Flow | Prompt Type | Expected Route | Observed Result |
|---|---|---|---|
| Auto planning route | Architecture planning prompt | Claude | Real Claude response rendered with provider label **Claude**. |
| Auto code route | TypeScript function prompt | Kimi | Real Kimi code-block response rendered with provider label **Kimi**. |
| Manual Kimi override | Direct Kimi prompt | Kimi | Real Kimi response returned `const provider = "kimi";`. |
| Manual Claude override | Direct Claude prompt | Claude | Real Claude response rendered with provider label **Claude** and Claude-only routing text. |
| Empty Kimi recovery | Mocked empty Kimi provider output | Recovery note, not success | Focused tests passed; raw diagnostics remain hidden behind technical details. |

These checks materially reduce the prior risk that the app was only showing recovery notes instead of real model responses. The app now demonstrates both routing selection and provider execution in the browser.

## UX Audit by Workspace Section

### Left Panel: Tasks and Global Memory

The left panel is structurally sound. It provides a compact workspace identity, task creation, search, live task cards, archive controls, and global memory. The archive action is appropriately confirmation-gated, and the empty-memory copy is honest. This panel currently succeeds as a task switcher and status surface.

The main gap is that **global memory is visible but not yet fully operable from the owner workflow**. The backend supports creating and searching memory records, but the owner UI does not provide a clear capture action such as “Save this decision to memory,” “Promote this message to memory,” or “Link this memory to the current task.” As a result, memory is architecturally present but product value depends on future capture affordances.

| Observation | Impact | Recommendation |
|---|---|---|
| Task cards are readable and status-labeled. | Owners can recover task context quickly. | Keep current card pattern and add optional filters for active/error/completed when task volume grows. |
| Archive is available and covered by tests. | Reduces clutter without destructive deletion. | Add an archived-task view later, not a permanent delete path by default. |
| Memory empty state is honest. | Avoids fake product value. | Add explicit memory capture from messages and file snapshots. |
| Memory list is limited to recent items. | Good for density but not discoverability. | Add search/filter UI once memory records become common. |

### Center Panel: Task Thread and Provider Routing

The center panel is the strongest current product surface. It has a compact composer, provider mode toggle, Enter-to-send behavior, credential chips, newest relevant owner-facing messages, and collapsed technical history. The core task workflow now works in the browser across Claude and Kimi paths.

The main UX concern is **response shape governance**. Manual Claude validation returned a plan-style response even though the prompt requested one sentence. That behavior is useful for orchestration transparency, but it may feel heavy in normal owner use. The next architecture improvement should introduce an output-shaping layer that distinguishes internal routing rationale from final owner answer. In short, the model can plan internally, but the owner-facing answer should respect the user’s requested format unless diagnostics are opened.

| Observation | Impact | Recommendation |
|---|---|---|
| Auto route chooses Claude for planning and Kimi for code. | Matches the intended provider specialization. | Preserve with regression tests and browser smoke checks. |
| Manual route buttons are visible and compact. | Owners can override without hidden syntax. | Keep buttons; continue supporting tags as shortcuts. |
| Technical history is collapsed. | Normal thread is more readable. | Keep collapsed by default; add filtering when diagnostics grow. |
| Claude may expose plan-style scaffolding for simple owner prompts. | Can violate concise-output expectations. | Split internal plan/route rationale from final answer in the owner-visible event model. |
| Provider failure note is plain English. | Prevents silent fallback confusion. | Keep recovery note, but add a one-click retry-with-Claude action in a future iteration. |

### Right Panel: Task Files, Context, and Diagnostics

The right panel is honest and technically capable, but it is the least mature from an owner-workflow perspective. It explains production safeguards, displays task-scoped file records, supports metadata recording, and hides developer diagnostics. The underlying API can write or upload files to a workspace and create storage-backed metadata records. However, the visible file controls are still closer to **metadata administration** than a natural “AI working on my files” experience.

The next improvement should convert the right rail into a clearer **task context drawer**. File recording should become an action-oriented flow: add file, preview file, ask AI to change file, view diff, accept snapshot, rollback. The current guarded buttons are good placeholders because they do not overclaim, but they should evolve into complete owner journeys.

| Observation | Impact | Recommendation |
|---|---|---|
| Empty task-file state is accurate. | Prevents fake files. | Keep this principle. |
| Metadata inputs require relative path and storage URL. | Functional but not owner-friendly. | Add upload/attach flow that generates storage records automatically. |
| Open, AI changes, rollback, and promote controls are disabled until real metadata exists. | Safe but not yet productive. | Implement each as a real workflow in priority order: preview, diff, rollback, library promotion. |
| Developer diagnostics are hidden. | Protects normal owner UX. | Move diagnostics behind a smaller advanced link or separate route when the right rail becomes crowded. |
| Master files view exists. | Useful for future workspace-level context. | Add filters by task, path, and modified date once file volume grows. |

## Architecture Assessment

The current architecture has a reasonable separation between authentication, task data, orchestration, provider execution, filesystem operations, terminal diagnostics, and UI rendering. Owner scoping is consistently enforced through protected procedures and owner-specific database helpers. The database schema captures task events, orchestration turns, global memory, task files, and credential status snapshots, which provides a good foundation for auditability.

The next architecture step is to separate **internal orchestration artifacts** from **owner-visible answer artifacts** more explicitly. Today, task events carry actor, event type, status, content, and metadata, and the UI filters technical history. That is workable. For long-term maintainability, the model call should produce a structured result with separate fields for `ownerAnswer`, `routeRationale`, `diagnostics`, `fileActions`, and `memoryCandidates`. This would reduce UI filtering complexity and prevent internal plan text from leaking into concise owner answers.

| Layer | Current Strength | Architecture Improvement |
|---|---|---|
| Route selection | OpenAI orchestration with manual overrides and credential gates. | Persist router decision confidence and expose a compact “why this provider” tooltip instead of full plan text. |
| Provider execution | Claude and Kimi direct paths validated. | Normalize provider responses into a common structured result before appending task events. |
| Failure handling | Empty Kimi output is handled as a failed provider turn with owner guidance. | Add retry policy metadata and safe user actions such as “retry same provider” and “retry with Claude.” |
| Task events | Flexible audit trail with actor/event/status metadata. | Add a stricter owner-visible event envelope to separate final answer from diagnostics. |
| Global memory | Schema and API exist. | Add automatic memory candidate extraction with user confirmation. |
| Files | Storage-backed metadata and workspace snapshots exist. | Add version lineage, diff records, and explicit file-action state transitions. |
| Diagnostics | Terminal/filesystem hidden by default. | Move advanced diagnostics into a developer mode route or collapsible drawer with clear audit warnings. |

## Recommended Implementation Roadmap

The roadmap below is intentionally incremental. It preserves the now-working routing path while improving the workspace into a more reliable task operating system.

| Priority | Initiative | Outcome | Suggested Acceptance Criteria |
|---:|---|---|---|
| P0 | Preserve provider routing and recovery regression suite. | Prevent recurrence of stale export, empty Kimi, or silent fallback failures. | `pnpm check`, `pnpm test`, `pnpm build`, plus browser smoke for Auto planning, Auto code, manual Claude, and manual Kimi. |
| P1 | Introduce structured provider result envelopes. | Separate final owner answer from route rationale and diagnostics. | Provider execution returns `ownerAnswer`, `diagnostics`, `routeRationale`, and optional `actions`; UI renders only `ownerAnswer` by default. |
| P1 | Add memory capture workflow. | Make global memory useful from real task work. | Owner can save a message, decision, or model summary to memory; memory appears in left panel and future task context. |
| P1 | Replace manual file metadata inputs with attach/upload flow. | Make task files usable by non-developer owners. | Owner can attach a file, see it in task files, open preview, and have storage metadata created automatically. |
| P1 | Implement file diff and AI-change review. | Turn right rail into a real file collaboration surface. | AI-generated file change creates a proposed diff; owner can accept, reject, or rollback. |
| P2 | Add task filters and archived view. | Improve navigation at scale. | Owner can filter active, blocked, error, completed, and archived tasks without losing current selection. |
| P2 | Move developer diagnostics into advanced workspace mode. | Reduce right-rail cognitive load. | Normal owner mode shows context and files only; diagnostics are available through explicit developer mode. |
| P2 | Add observability dashboard for provider calls. | Support troubleshooting without exposing raw logs in the owner thread. | Admin can inspect provider latency, route counts, credential errors, and failure reasons. |

## Current State Versus Desired State

| Capability | Current State | Desired State |
|---|---|---|
| Task-first workflow | Working: create/select task, send message, route to providers, archive task. | Add richer task lifecycle actions, filters, and archived recovery. |
| Provider routing | Working: Auto and manual Claude/Kimi routes validated in browser. | Add concise owner answer enforcement and route-confidence transparency. |
| Failure recovery | Working for empty Kimi response with tests. | Add guided retry buttons and provider health recommendations. |
| Global memory | Backend and display exist; no clear owner capture flow in visible UI. | Owner can promote decisions, research, and task learnings into memory with confirmation. |
| Task files | Metadata and storage-backed workspace snapshot paths exist; owner controls are partially placeholder-like. | End-to-end attach, preview, AI edit, diff, accept, rollback, and promote workflows. |
| Technical diagnostics | Hidden by default and usable as advanced tools. | Separated into developer mode, with owner context rail kept focused. |
| Validation posture | Strong: targeted tests and browser validation are current. | Add automated browser smoke scripts for four provider routes after each provider change. |

## Immediate Next Recommendations

The next development iteration should avoid destabilizing provider routing. The most valuable next step is to implement the **structured provider result envelope** and update the UI so internal route plans and diagnostics cannot override a concise owner-requested answer. After that, add **memory capture** and **file attach/preview** because those improvements convert existing architecture into visible owner value.

The current checkpoint should be saved after final validation. The project is in a reviewable state: Claude and Kimi live routing are working, recovery behavior is covered, and the remaining recommendations are product improvements rather than blockers to the fixed provider architecture.


## Final Validation Addendum — May 6, 2026

The final implementation state was validated through both live browser checks and automated regression coverage. The browser checks confirmed Auto planning routes to **Claude**, Auto code-writing routes to **Kimi**, manual selector overrides work for both providers, and actual `#claude` / `#kimi` text tags route correctly while stripping the tag from the user-facing owner message. The browser also confirmed the three-panel workspace remains usable after the provider fixes, including configured Claude/Kimi credential chips, an honest Global Memory empty state, and guarded task-file actions.

The automated suite passed with `pnpm check`, focused `server/workspace.security.test.ts`, full `pnpm test`, and `pnpm build`. The focused workspace security coverage includes global-memory create/list/search and source-task ownership behavior. The full suite passed with **14 test files** and **57 tests**. The production build completed successfully; the remaining Vite large-chunk warning is a performance optimization opportunity, not a functional blocker.

| Area | Verified Current State | Remaining Recommendation |
|---|---|---|
| Provider routing | OpenAI/Forge orchestration, manual selector overrides, and `#claude` / `#kimi` tag overrides route to provider-labeled Claude or Kimi turns. | Add a compact routing trace view for owners that explains why Auto selected a provider without exposing raw diagnostics by default. |
| Provider failure handling | Empty Kimi output is treated as a handled model execution failure with owner-facing recovery guidance and raw details hidden behind technical disclosure. | Expand the same recovery pattern to other provider failure classes, including rate limits and malformed provider payloads. |
| Global Memory | Empty-state UI is honest; server tests cover owner-scoped create/list/search and source-task ownership behavior. | Add a small in-workspace memory creation affordance and a visible “promote message to memory” action once product scope approves it. |
| Task files and context | Task-scoped files panel is guarded and metadata-backed, with unsupported actions disabled unless real records exist. | Convert metadata-only file entry into a clearer guided flow: attach, preview, promote, and rollback with explicit storage provenance. |
| Workspace layout | Three-panel task-first workspace remains readable and validates the core workshop workflow. | Continue refining density, right-panel hierarchy, and optional technical disclosures so the owner-facing thread remains the primary surface. |
