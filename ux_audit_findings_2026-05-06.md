# UX Audit Findings — 2026-05-06

## Source and runtime evidence

The current composer visually renders four accessory icons — plus, paperclip, smile, and microphone — as non-interactive `<span>` elements with `aria-hidden="true"` in `client/src/pages/Home.tsx` lines 674-681. They do not have click handlers, keyboard affordances, tooltips, disabled states, or upload wiring. This directly confirms the user's report that the chat buttons appear present but do not actually work.

The send button and route selector are wired. `handleSendMessage` submits `orchestration.submitMessage`, Enter submits, Shift+Enter creates a new line, and the Auto/Kimi/Claude radio buttons update `routeMode`. The failing area is specifically the accessory controls, not the core text send flow.

Drag-and-drop upload is not exposed in the owner-facing UI. The backend has `filesystem.upload` in `server/routers.ts` lines 548-590, and `server/filesystem.ts` uploads bytes through storage, but the main UI does not include `<input type="file">`, `onDrop`, `onDragOver`, `DataTransfer`, or a normal upload/drop zone. The visible task-file card only supports advanced manual metadata linking via `files.createMetadata`, which records an existing storage URL and does not create/upload the file.

The database model stores task files in `task_files` with required `taskId` and `ownerUserId`. The `All recorded files` view is owner-wide, but it is derived from task-linked records. There is no first-class global file-library table or true project/global folder independent of a task. Separately, local workspace files are provisioned per authenticated user under `/tmp/ai-coding-workshop-workspaces/user-{ownerUserId}` through the terminal/filesystem layer.

The `What the AI is doing` section is implemented as a read-only owner-facing activity feed derived from task events where `eventType !== "message"`; it intentionally does not execute commands. Its purpose is traceability: show AI coordinator, Claude, Kimi, file, credential, and context events without exposing the terminal by default. The current copy explains this but still competes with file management in the right rail.

The left navigation remains visually clipped in the live preview. The screenshot from `webdev_check_status` and browser inspection shows task cards extend beyond the visible sidebar boundary, archive controls are partially clipped, and long task titles are not constrained cleanly. This indicates the previous left-nav fix is incomplete at the actual viewport.

## Validation run

Automated validation was run on the current state. `pnpm test` passed 14 files and 57 tests. `pnpm check` completed with no TypeScript errors. `pnpm build` completed successfully, with the existing bundle-size warning for a large client chunk. Managed project status reports the dev server running, LSP clean, TypeScript clean, and dependencies OK.

## Gaps not covered by current tests

Current tests cover route selector behavior, Enter-to-send, credential refresh, manual metadata creation, terminal disclosure, filesystem write, and several layout strings. They do not prove that the composer accessory icons are intentionally disabled or functional, do not cover drag-and-drop upload, do not cover a first-class global file library, and did not catch the left-navigation clipping seen in the browser preview.
