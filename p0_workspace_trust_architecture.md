# P0 Workspace Trust Fix — Architecture and Wiring Plan

**Author:** Manus AI  
**Date:** May 6, 2026  
**Project:** AI Coding Workshop v2  

## Scope Confirmation

This P0 pass implements the user-approved trust fixes for the visible workspace. The pass will wire plus and paperclip into a real task-file upload flow, add drag-and-drop upload to the task file area, make smile and microphone controls explicitly communicate “coming soon,” repair the left navigation clipping, and add regression coverage so decorative controls and clipped navigation cannot silently pass again.

The first-class global folder is intentionally deferred to the next pass because it requires schema, API, and product-model decisions. This P0 pass will not create a global-library schema or change the existing `task_files` storage model.

## Component Inventory

| Component | File | Change Type | Responsibility |
|---|---|---|---|
| Workspace page | `client/src/pages/Home.tsx` | Modify | Add upload state, hidden file input, plus/paperclip handlers, drop-zone handlers, coming-soon feedback, and left-nav layout repairs. |
| Behavior tests | `client/src/pages/Home.behavior.test.tsx` | Modify | Add regression tests for composer upload controls, drag/drop upload, coming-soon controls, and non-clipped left-nav structure. |
| TODO tracking | `todo.md` | Modify | Track and mark P0 implementation/test items. |

## Data Flow

| Flow | Steps | Expected Result |
|---|---|---|
| Click plus or paperclip upload | User clicks plus or paperclip → hidden file input opens → selected file is read in the browser as base64 → `trpc.filesystem.upload.useMutation()` is called with selected task id, safe relative path, base64 content, and MIME type → task files and all files queries are invalidated. | The uploaded file appears in the selected task’s files list and is backed by the existing storage pipeline. |
| Drag-and-drop upload | User drags files over task file card → card shows active drop affordance → drop handler reads the first accepted file → calls the same upload mutation → resets drag state and invalidates file queries. | Drag-and-drop becomes a real user-facing upload path. |
| Smile/mic coming soon | User clicks smile or mic → accessible toast/status text appears explaining that the feature is coming soon and no upload/action was attempted. | Controls are honest and keyboard-accessible rather than decorative. |
| Left navigation repair | Sidebar task cards use constrained widths, overflow-safe rows, shrink-safe text containers, and menu/archive controls that do not exceed the rail. | Task names, status, timestamps, and actions remain readable or intentionally truncated without clipping controls. |

## Wiring Blueprint

| Source | Target | Payload / State | Verification |
|---|---|---|---|
| `Home.tsx` plus button | Hidden `<input type="file">` | Browser file selection event | Test clicks plus and asserts file input is reachable/triggered. |
| `Home.tsx` paperclip button | Same hidden file input | Browser file selection event | Test clicks paperclip and verifies upload mutation after file selection. |
| `Home.tsx` drop zone | `filesystem.upload` tRPC mutation | `{ taskId, relativePath, base64Content, mimeType }` | Test fires drag/drop with a File and verifies mutation input. |
| `filesystem.upload` mutation | Existing server upload and task-file metadata path | Existing task-scoped storage flow | Existing server ownership/path validation remains unchanged. |
| Smile and mic buttons | Local accessible status/toast state | Coming-soon message | Test clicks each and verifies user-visible feedback. |
| Left task card DOM | CSS utility classes and test ids | Layout-safe class structure | Test verifies task rows expose action controls and overflow-safe class names. |

## Technology Decisions

| Decision | Choice | Rationale | Consequence |
|---|---|---|---|
| Upload API | Reuse existing `filesystem.upload` tRPC mutation. | The backend already writes local workspace files, snapshots to storage, creates task-file metadata, and enforces task ownership. | P0 remains a frontend trust fix and avoids unnecessary schema changes. |
| File encoding | Browser `FileReader.readAsDataURL`, strip data URL prefix before sending base64. | Compatible with the current mutation contract. | Large files remain limited by existing backend constraints; UI should report failures clearly. |
| Coming-soon controls | Real `<button>` elements with visible feedback, not hidden spans. | Visible controls must be keyboard accessible and honest. | Smile and mic can later be upgraded without changing the composer layout. |
| Global folder | Defer to P1. | It requires a separate product model and schema, not just UI work. | P0 keeps scope tight and testable. |

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Upload tests may be brittle in JSDOM because file input behavior differs from browsers. | Test the handler through `userEvent.upload` and drag/drop events rather than relying on native file-dialog behavior. |
| Existing tRPC mocks may not include `filesystem.upload`. | Extend the Home behavior test mock surface only for the new mutation. |
| Drop zone could interfere with normal scrolling/clicking. | Scope drag handlers to the task-files card and prevent default only during file drag/drop. |
| Left-nav fix could regress visual density. | Use constrained rows, truncation, and accessible labels instead of increasing the rail width dramatically. |

## Approval Status

The user has approved the P0 scope in chat. This document records the implementation and wiring plan before code changes, and implementation will follow this exact boundary.
