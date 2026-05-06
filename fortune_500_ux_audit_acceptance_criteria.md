# Fortune 500 UX Audit Acceptance Criteria Extract

This checklist is extracted from the user-provided audit document `AI_Coding_Workshop_Portal_—_Fortune_500_UX_Audit_and_Fix_Recommendations.docx` and is used only as evidence for the current implementation review.

| Priority | Fix | Acceptance Criteria | Test Requirement |
|---|---|---|---|
| P0 | Make chat accessory controls honest | Wire plus/paperclip to upload, hide smile/mic until implemented, or show explicit coming-soon tooltips/toasts. No decorative control should look clickable without behavior. | Behavior tests proving visible composer controls either call handlers or announce unavailable status. |
| P0 | Add task file upload and drag-and-drop | Users can drag files onto the task file area or click Upload file, see progress, then see the file in Task Files. | Client tests for file selection/drop and server tests for filesystem.upload path safety and task ownership. |
| P0 | Fix left navigation clipping | At the current preview width, task titles, summaries, status, timestamps, and archive/menu actions remain visible or intentionally truncated without clipping controls. | Layout assertions for task row structure and a browser validation screenshot. |
| P1 | Add first-class Global Files | Users can upload files to a global library independent of a task, attach/link them to tasks, and understand scope from labels. | Schema tests, router ownership tests, and UI tests for global-library upload/list/attach flows. |
| P1 | Clarify AI Activity | Rename “What the AI is doing” to “AI Activity,” show plain-language steps, and hide technical events behind a details disclosure. | Tests for readable activity labels and disabled details state. |
| P2 | Reorganize right rail into task inspector tabs | Files, AI Activity, Context, and Advanced Diagnostics are organized into clear panels; normal users do not see advanced terminal/filesystem controls unless they opt in. | Interaction tests for tab state and hidden diagnostics. |
| P2 | Add empty-state and onboarding guidance | Empty task, empty files, and empty global library states each explain the next action in one sentence plus one button. | Tests for accessible empty-state CTAs. |

The audit’s proposed storage model expects object bytes to be stored once, with metadata stored separately. Global file records should own the storage key, URL, size, MIME type, display name, owner, tags, and source. Task attachments should be link records that point from tasks to global files, avoiding duplicate uploads and making attachment reversible.
