# Global File Library Architecture

Author: **Manus AI**  
Date: 2026-05-06

## Scope Decision

The global file folder will be implemented as an **owner-scoped global library** that exists beside the current selected-task folder. The current task folder remains task-specific. The new global library is not a replacement for task files; it is a reusable file shelf where the owner can keep files that should be available across tasks in the same authenticated workspace.

This decision keeps the UX simple for non-programmers. Users will see two clearly labeled areas in the right workspace panel: **Global library** for reusable files and **This task** for files attached to the selected task. Uploads from the global area are saved without a task assignment, while task-folder uploads continue to attach directly to the selected task.

## Component Inventory

| Component | Path | Decision |
|---|---|---|
| Database schema | `drizzle/schema.ts` | Extend `task_files.task_id` to be nullable so owner-scoped global files can exist without a task link. |
| Database helpers | `server/db.ts` | Add or reuse file helper queries to list owner files with optional task filtering. |
| API procedures | `server/routers.ts` | Add global-file list and upload paths or extend existing filesystem upload/list procedures with `scope: "task" | "global"`. |
| Workspace UI | `client/src/pages/Home.tsx` | Add a clear global library card above the task folder and route uploads to the correct scope. |
| Tests | `client/src/pages/Home.behavior.test.tsx`, server contract tests | Prove global library is visible, task folder remains separate, and upload scope is explicit. |

## Data Flow

A global upload starts when the user clicks **Upload to global library** or drops a file onto the global drop zone. The browser reads the file, sends name, MIME type, byte size, and base64 content to the protected upload procedure with `scope: "global"`, and the server stores bytes through the existing storage bridge. The resulting file record is saved with `owner_id` and `task_id = null`. The right panel refreshes global files and task files independently.

A task upload continues through the same storage bridge but sends `scope: "task"` and the selected `taskId`. The saved record keeps the selected `task_id`, preserving the current per-task folder behavior.

## Technology Decisions

| Decision | Rationale | Consequence |
|---|---|---|
| Use nullable `task_id` for global files | Avoids duplicating storage metadata tables and keeps one file list model. | Server helpers must be explicit about `task_id IS NULL` versus `task_id = selectedTaskId`. |
| Keep files owner-scoped | Prevents cross-user leakage while matching the requested global-within-workspace behavior. | A future project-level sharing model can be added later if needed. |
| Reuse existing storage upload path | Avoids introducing a second storage mechanism. | UI and API must make scope obvious so users know where uploads went. |
| Show global library in normal right panel | Makes the feature discoverable without exposing developer diagnostics. | Right panel needs concise hierarchy to avoid clutter. |

## Acceptance Criteria

| Requirement | Acceptance Criteria |
|---|---|
| Global folder exists | The right panel has a visible **Global library** section separate from **This task**. |
| Global uploads work | Clicking or dropping into the global area uploads through the server and creates a file record with no task link. |
| Task files remain task-specific | Task uploads still appear only under **This task** for the selected task. |
| Honest storage language | Copy states that the global library is owner/workspace scoped, not internet-public or cross-account global. |
| Regression coverage | Tests assert separate global/task upload scopes and visible labels. |

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Existing SQL schema may already require non-null `task_id`. | Inspect generated migrations/schema and apply the least destructive migration path. |
| Users may confuse global with public storage. | Use plain language: “available across your tasks in this workspace.” |
| Right panel may become too dense. | Keep global library compact and collapse advanced manual-link controls below normal file actions. |
