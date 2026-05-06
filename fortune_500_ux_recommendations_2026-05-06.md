# AI Coding Workshop Portal — Fortune 500 UX Audit and Fix Recommendations

**Author:** Manus AI  
**Date:** May 6, 2026  
**Scope:** Chat controls, drag-and-drop files, storage model, global folder requirement, AI activity feed, left navigation, and the requested fix-review-confirm loop.

## Executive Summary

I reviewed the current portal as both a product experience and an implementation surface. The most important conclusion is that the application is technically deployable, but several visible controls create a **trust gap** because they look like finished product features while being only decorative or advanced-maintenance affordances. The chat’s plus, paperclip, smile, and microphone icons are rendered as non-interactive spans, not buttons, so the user’s statement that “none of these buttons in the chat actually work” is correct for those accessory controls.[1] The backend already has a protected file-upload mutation, but the normal owner-facing interface does not expose a file picker, drop zone, or drag-and-drop handlers.[2]

The current file model is **owner-scoped but task-linked**. Each persisted file record requires both `ownerUserId` and `taskId`, while the “All recorded files” panel is only an owner-wide index over task files, not a first-class global file library.[3] The user’s request for a **global folder besides per-project/task folders** is therefore not fully implemented today; it needs a dedicated global-library product model, schema, and UI.

The right-side “What the AI is doing” section has a valid purpose: it is a read-only activity feed showing coordinator, Claude, Kimi, credential, context, and file events. However, it should be repositioned and renamed so non-technical users understand it as **AI activity/status**, not a command runner or hidden terminal.[4] The left navigation remains visually clipped in the live preview, especially around task cards and archive controls, so the earlier navigation fix is incomplete in the real viewport.

## Direct Answers to Your Questions

| Question | Current Answer | Recommendation |
|---|---|---|
| **1. Are files stored globally or per project?** | Persisted file records are not truly global. They are stored per authenticated owner and attached to a specific task. The all-files view aggregates those task files for the owner, but every record still has a `taskId`.[3] Local filesystem workspace files are also per authenticated user, not a cross-project global folder. | Keep task folders, but add a separate **Global Library** with explicit ownership, optional project/task links, tags, search, and clear copy that explains where files live. |
| **2. I asked besides the per-project file folder for a GLOBAL folder.** | That global folder does not exist as a first-class product feature yet. The current “All recorded files” card is only an index of task-attached files. | Build a top-level **Global Files** section in the left or right navigation, backed by a new schema/table and reusable upload flow. Allow users to attach global files into tasks without duplicating storage bytes. |
| **3. What is the “What the AI is doing” section for?** | It is currently a read-only task activity feed. It summarizes non-message task events, such as routing decisions, credential checks, context snapshots, model starts/results, and file events.[4] | Rename it to **AI Activity** or **Run Status**, move details behind progressive disclosure, and show user-centered steps: “Reading task context,” “Checking files,” “Calling Claude,” “Saving response.” |
| **4. Left navigation is still not fixed.** | Confirmed. Browser inspection shows the live sidebar still clips or truncates task-card content and archive controls. | Redesign the left rail as a fixed-width, scroll-isolated navigation with clear task rows, a visible selected state, and a non-clipped overflow/action menu. Add visual regression tests or DOM-width assertions for this exact viewport. |

## Evidence-Based Findings

| Area | Evidence | Product Impact | Severity |
|---|---|---|---|
| Chat accessory buttons | The plus, paperclip, smile, and microphone icons are rendered as `aria-hidden` spans with no click handlers.[1] | Users expect upload, emoji, or voice actions and lose trust when nothing happens. | Critical UX |
| Drag-and-drop files | Backend upload exists, but no owner-facing file input, `onDrop`, `onDragOver`, or normal upload control exists in the main UI.[2] | File workflow is blocked for non-technical users. | Critical UX |
| File storage model | `task_files` requires `taskId` and `ownerUserId`; there is no separate global library table.[3] | The UI suggests broader file availability than the data model supports. | Product architecture |
| Activity feed | “What the AI is doing” maps non-message task events into activity cards.[4] | Valid feature, but wording and placement create confusion. | Medium UX |
| Left navigation | Browser preview shows clipped task cards and partial archive controls. | The main workspace navigation feels unfinished and hard to use. | High UX |
| Automated validation | `pnpm test` passed 57 tests, `pnpm check` passed, and `pnpm build` succeeded. | Current code is technically stable, but tests do not cover the reported UX gaps. | Test gap |

## Recommended Fortune 500 Portal Direction

The portal should shift from a developer-console layout to an **executive-grade workbench**. That means every visible control must be either functional, clearly disabled with an explanation, or removed. Enterprise portals establish trust by making system state, ownership, and next actions obvious. The current experience has strong foundations—OAuth, task ownership, provider routing, activity logging, and storage-backed file records—but the presentation still exposes implementation seams.

The target experience should use three clear zones. The left rail should be a stable **Work Navigation** area containing tasks, global memory, and a separate Global Files entry. The center should be a **Conversation and Decision Thread** with only the controls that actually work. The right rail should become a contextual **Inspector** that changes based on the selected task: task files, AI activity, credentials, and advanced diagnostics should be tabs or sections, not competing cards in one scroll stack.

## Prioritized Fix Plan

| Priority | Fix | Acceptance Criteria | Test Requirement |
|---|---|---|---|
| P0 | Make chat accessory controls honest. | Either wire plus/paperclip to upload, hide smile/mic until implemented, or show explicit “coming soon” tooltips/toasts. No decorative control should look clickable without behavior. | Add behavior tests proving visible composer controls either call handlers or announce unavailable status. |
| P0 | Add task file upload and drag-and-drop. | Users can drag files onto the task file area or click “Upload file,” see progress, then see the file in Task Files. | Add client tests for file selection/drop and server tests for `filesystem.upload` path safety and task ownership. |
| P0 | Fix left navigation clipping. | At the current preview width, task titles, summaries, status, timestamps, and archive/menu actions remain visible or intentionally truncated without clipping controls. | Add layout assertions for task row structure and a browser validation screenshot. |
| P1 | Add first-class Global Files. | Users can upload files to a global library independent of a task, attach/link them to tasks, and understand scope from labels. | Add schema tests, router ownership tests, and UI tests for global-library upload/list/attach flows. |
| P1 | Clarify AI Activity. | Rename “What the AI is doing” to “AI Activity,” show plain-language steps, and hide technical events behind a details disclosure. | Add tests for readable activity labels and disabled details state. |
| P2 | Reorganize right rail into task inspector tabs. | Files, AI Activity, Context, and Advanced Diagnostics are organized into clear panels; normal users do not see terminal/filesystem controls unless they opt in. | Add interaction tests for tab state and hidden advanced diagnostics. |
| P2 | Add empty-state and onboarding guidance. | Empty task, empty files, and empty global library states each explain the next action in one sentence plus one button. | Add tests for accessible empty-state CTAs. |

## Proposed Storage Model

| Layer | Scope | Purpose | Recommended Product Label |
|---|---|---|---|
| Global Library | Owner-level, not tied to a task by default | Durable reusable files, references, brand assets, source documents, screenshots, and uploaded context | **Global Files** |
| Project Folder | Project/workspace-level grouping, if multiple projects are introduced in this app | Files that belong to a specific app/workshop/project but not necessarily one task | **Project Files** |
| Task Folder | Task-level | Files generated, uploaded, or attached for one task’s AI context | **Task Files** |
| Local Workspace | Owner-level runtime filesystem | Developer diagnostics and generated workspace files | **Developer Workspace** or hidden advanced label |

The clean architecture is to store the file bytes once in object storage and store metadata separately. A global file record should own the storage key, URL, size, MIME type, display name, owner, tags, and source. Task attachments should be link records that point from tasks to global files. This avoids duplicate uploads and makes “attach to task” reversible without losing the global asset.

## Fix-Review-Fix-Review-Confirm Loop

I recommend implementing the fixes in short controlled passes rather than one large rewrite. The first pass should fix the trust-breaking UI elements: chat accessory controls, real upload/drop, and left navigation clipping. After that, I should run TypeScript, Vitest, production build, and browser validation, then review screenshots and behavior against the acceptance criteria. The second pass should build the Global Files model and reorganize the right rail. After each pass, any failed or ambiguous behavior should go back into the fix queue before checkpointing.

| Loop Step | What I Will Do |
|---|---|
| Fix | Implement the smallest coherent set of changes for one priority group. |
| Review | Inspect code paths, UI states, accessibility labels, and ownership/security impact. |
| Fix | Correct any discovered regressions or confusing copy. |
| Review | Re-run automated tests, build, and browser validation. |
| Confirm | Save a checkpoint only after the acceptance criteria are met and report exactly what passed and what remains. |

## Recommended Immediate Decision

The next implementation session should start with **P0: make the visible workspace trustworthy**. Specifically, I recommend wiring paperclip/plus into a real upload/drop flow, hiding smile and mic behind “coming soon” or removing them, repairing the left navigation layout, and adding regression coverage so these exact issues cannot pass again. The global folder should follow immediately after because it requires a schema/API/UI decision rather than a pure visual fix.

## References

[1]: client/src/pages/Home.tsx lines 674-681 — Composer accessory icons rendered as hidden non-interactive spans.  
[2]: server/routers.ts lines 548-590 and client/src/pages/Home.tsx lines 759-812 — Backend upload exists, but the owner-facing task-file card only exposes manual metadata linking.  
[3]: drizzle/schema.ts lines 129-148 — `task_files` requires `taskId` and `ownerUserId`; no global file-library schema exists.  
[4]: client/src/pages/Home.tsx lines 288-294 and 722-756 — Activity feed derives non-message events and renders the “What the AI is doing” card.
