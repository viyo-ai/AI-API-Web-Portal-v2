# P1 Global Files and AI Activity Architecture

The P1 audit requires Global Files to become a first-class owner-scoped resource rather than a sentinel task-file row. The implementation will preserve existing task-specific file records in `task_files` for workspace snapshots and task uploads, add `global_files` for reusable object metadata, and add `task_global_file_links` as the reversible attachment table between tasks and reusable files. Object bytes remain stored once in Manus storage; task attachment stores only a link row, label, and timestamps.

| Layer | Decision | Rationale |
|---|---|---|
| Database | Add `global_files` with owner, display name, relative path, storage key, URL, MIME type, size, tags JSON, source, and timestamps. | A global file can exist independently of any task and can be listed by owner without abusing `taskId = 0`. |
| Database | Add `task_global_file_links` with task ID, global file ID, owner, attached label, timestamps, and a unique task/file pair. | The same stored object can be attached to multiple tasks without duplicate uploads and can later be detached safely. |
| Server helpers | Keep `createTaskFile` and `listTaskFiles` for true task-scoped files, replace `createGlobalFile` and `listGlobalFilesForOwner` to use `global_files`, and add attach/list helper functions. | Existing task-file behavior remains stable while Global Files get a dedicated contract. |
| Router | Add `files.uploadGlobal`, `files.attachGlobalToTask`, and `files.listGlobalForTask`; update `files.createMetadata(scope: global)` to create a `global_files` row. | The UI can upload independently of a task, list the library, and attach a reusable file to the selected task through protected owner-verified procedures. |
| Upload | Reuse `storagePut` directly for Global Files upload and keep the 5 MB limit plus safe relative-path validation. | This stores bytes once in the global namespace instead of writing a fake task workspace path. |
| UI | Show Global Files as a reusable library with scope labels, upload CTA, and “Attach to task” action; show attached global references in Task files. | Users can understand whether a file is task-local or reusable and can link reusable files without reuploading. |
| AI Activity | Rename the heading to “AI Activity,” keep plain-language steps, and make details disabled when there are no technical events. | This satisfies the P1 clarity acceptance criteria and prevents raw technical noise from dominating normal task work. |

No new external secrets or runtime services are needed. Security-sensitive ownership checks happen in protected router procedures before creating task links, and the database helper joins always filter by `ownerUserId`.
