# PORTAL_PHASE_2_DIRECTIVE — §4.5 Project-to-Task Auto-Wiring

**Authorization status:** Pending. Begin only after Product Owner explicitly accepts §4 Branch Isolation in writing. Stop at §4.5 acceptance and wait for Product Owner review. Do not declare Phase 2 complete. Do not begin §1A-FU-04 or §8 in the same session.

**Repo:** `viyo-ai/AI-API-Web-Portal-v2`, branch `main`.

**Source-of-truth observations (from PO audit before §4.5 begins):**
- The portal already has a per-turn context-assembly path that produces an AI Activity event labeled `"AI coordinator assembled task thread, global memory, task file metadata, route, and credential context for this turn."` §4.5 extends that path; it does not replace it.
- The Task Inspector → Context tab already documents: *"No memory is lost between workers. Every turn assembles the selected task thread, saved memory, and task-file list before any provider call."* The "task-file list" attachment path is the integration point.
- The §1A `buildTargets` schema already contains `governanceFilesJson`, `governanceBudgetEnforced`, and `agentEnvVarMapJson`. The helpers `enforceGovernanceBudget` and `renderGovernanceBlock` exist in `server/buildRunner/loadGovernance`. Reuse all of these.
- The first-class Global Files layer (owner-scoped global library + task attachment link records) already exists from the P1 implementation. Reuse.
- The §1A wizard creates Build Targets (= Projects) but does not yet associate Tasks with Projects. The `tasks.buildBranchId` column exists per the §1A schema test but is not wired through Task creation.
- Pre-existing PTY fallback issue (`Resize noted. Basic shell fallback is not a PTY` spam in Diagnostics terminal) is **out of scope** for §4.5. Do not touch the PTY layer.

---

## §4.5 Execution Discipline

Apply the same execution discipline used for §1A and §4:

1. Produce `.taskmaster/docs/ingestion-evidence/PORTAL_PHASE_2_DIRECTIVE-S4-5-ingestion.md` with structured constraint extraction (constraint IDs `PORTAL-P2-S4-5-HR-XX`), per-invariant coverage map, and a conservative verdict before claiming §4.5 complete.
2. Use existing scaffolds. Do not reinvent the per-turn context-assembly function. Extend the existing function that produces the `Shared context was prepared` AI Activity event.
3. Conventional commits prefixed `[PORTAL-P2-S4-5-XX]`. One commit per logical invariant where practical.
4. **Process correction reminder from §1A-FU:** if you discover work outside §4.5 scope (e.g., the PTY fallback spam, an unrelated test flake, a refactor opportunity), open a separate `[PORTAL-OOS-XX]` proposal commit and STOP for Product Owner approval. Do not bundle out-of-scope changes into §4.5 commits.

---

## §4.5 Plain-English Owner Standard (Hard Constraint)

The Product Owner is non-technical. Project-to-Task Auto-Wiring must be **invisible to the owner under normal operation**. The owner clicks "+ New task" and gets a task that already has full Project context loaded. They do not click "Create Build Branch," do not select "Project rule books," do not see the word "governance" in any UI label.

**Vocabulary the owner sees in §4.5 UI:** `Project`, `New task`, plain file names (`CLAUDE.md`, `FOUNDATION_LOCK.md`, etc.) shown without special labeling.

**Vocabulary the owner must NEVER see in non-Diagnostics surfaces:** `governance`, `rule books`, `Build Branch` (in task creation flow), `agent env var map`, `governanceBudgetEnforced`, `buildTargetId`, `cloneOrSyncBranch`, system-prompt token budget warnings.

**Diagnostics tab is exempted from the Plain-English Owner Standard.** Technical labels are acceptable inside Diagnostics. Power users see real labels there.

If a §4.5 surface needs a label that would otherwise read "Project rule books," replace it with "Project files" or omit the label and let the file names speak for themselves.

---

## §4.5 Hard Functional Invariants

| Invariant | What it means | Test that proves it |
|---|---|---|
| `INV-S4-5-01` | A Task created on a Project automatically gets the Project's governance files (per `governanceFilesJson` from §1A's `buildTargets` table) attached as Global File link records to the Task within 2 seconds of Task creation. The owner did not upload them. | A behavioral test creates a Task on a Project with 3 governance files; asserts within 2 seconds that 3 Global File link records exist for the Task; asserts the Task Inspector → Files panel renders the 3 files. |
| `INV-S4-5-02` | The contents of every governance file linked to a Task are prepended to the system prompt for every model call (Claude, Kimi, AI coordinator routing) in that Task — not just the first turn. | A behavioral test mocks the Anthropic and Cloudflare Workers AI fetches; sends three sequential messages in a Task that has CLAUDE.md attached; asserts each model fetch payload's system prompt contains CLAUDE.md content. |
| `INV-S4-5-03` | The system-prompt governance injection respects `governanceBudgetEnforced` from `buildTargets`. If governance content exceeds the budget, the injection is truncated to the budget with a `[truncated for budget]` marker at the cut point — the model call still goes through, never silently drops governance, and never exceeds the budget. | A behavioral test attaches a governance file larger than the configured budget; asserts the system prompt sent to the model contains the truncation marker; asserts the model call succeeds; asserts an AI Activity event named `governance_truncated` is recorded with the original size, budget, and truncation point. |
| `INV-S4-5-04` | When a Task is created on a Project and no Build Branch exists yet for that Task, the Build Branch is created automatically and silently when the owner submits the first task message. The owner never clicks "Create Build Branch" in the task flow. The first model response only fires *after* the workspace is ready. | A behavioral test creates a Task on a Project with no pre-existing Build Branch; submits one user message; asserts a Build Branch row exists for the Task before the first model fetch is invoked; asserts the first model response lands in the task thread; asserts the owner-visible UI showed a single plain-English status (e.g., "Setting up your workspace…") between submit and response. |
| `INV-S4-5-05` | Backward compatibility: a Task created without a Project (legacy/freestanding) continues to work identically. No regression on existing 105+ tests. No governance injection when `projectId` is null. No Build Branch creation when `projectId` is null. | The existing test suite passes unchanged. One new freestanding-task test asserts no governance is injected and no Build Branch is created when `projectId` is null. |
| `INV-S4-5-06` | Task creation UI shows a Project picker only when at least one Project exists. If exactly one Project exists, it is pre-selected (no extra step). If zero Projects exist, the picker is hidden and the Task is created freestanding (current behavior). | A behavioral test renders `<Home />` with `buildTargets: [oneProject]`, clicks "+ New task", asserts the Project is pre-selected without an explicit picker step. A second test with `buildTargets: []` asserts no picker is shown. A third test with `buildTargets: [a, b]` asserts a picker dropdown is rendered with 2 options. |
| `INV-S4-5-07` | The auto-attached governance files are read-only from the owner's perspective in the Task. The owner cannot accidentally delete or modify them in the Task Inspector → Files panel. They can be detached from the Project (which would re-trigger on next Task creation), but not deleted from a single Task as if they were uploads. | A behavioral test attempts to call the existing `delete file` mutation on a governance-attached Global File link from within a Task context; asserts it returns a structured error explaining "Files attached from a Project are managed in Project settings, not here." Asserts the file remains attached. |
| `INV-S4-5-08` | Plain-English Owner Standard enforcement (UI vocabulary). | A test renders the Task creation flow with one Project and asserts the rendered HTML does not contain any of the forbidden strings (case-insensitive): `governance`, `rule book`, `Build Branch`, `agent env var`, `governanceBudgetEnforced`, `buildTargetId`. Diagnostics surfaces are excluded from this test scope. |
| `INV-S4-5-09` | When a Task has an associated Build Branch, the existing Diagnostics → Basic Shell Terminal offers a small toggle: `Show: [Personal workspace ▾]` with two options — `Personal workspace` (current `/tmp/ai-coding-workshop-…` path, default) and `Project Build Branch` (the §4 Build Branch workspace path). Switching points the terminal `cwd` at the Build Branch workspace. The toggle is hidden when no Build Branch exists for the Task. | A behavioral test renders a Task that has a Build Branch; asserts the toggle is visible; asserts switching to "Project Build Branch" updates the displayed `cwd` to the Build Branch's `workspacePath` from §4's `buildBranches` table. A second test renders a Task without a Build Branch; asserts the toggle is hidden. |

**Hard restriction on `INV-S4-5-09`:** the Diagnostics terminal toggle is read-only navigation. It does NOT enable terminal commands that could push to `main` or `staging` from inside the Build Branch workspace. The §4 pre-push hooks (`INV-S4-05`) remain authoritative — even if a power user runs `git push` from this terminal, the §4 hook layer rejects pushes to protected branches. The terminal is for inspection and debugging, not write operations to remote refs.

---

## §4.5 Functional Acceptance Criteria

1. **Task creation flow.** When at least one Project exists, "+ New task" opens a single small input (task title) with the Project pre-selected (single-Project case) or a dropdown picker (multi-Project case). No other inputs. No "Build Branch" name field. No governance file selector.

2. **Auto-attached files.** Within 2 seconds of Task creation against a Project, the Task Inspector → Files panel shows the Project's governance files auto-attached. The panel does not label them as "governance" or "rule books" — they appear as their natural file names (`CLAUDE.md`, `FOUNDATION_LOCK.md`, `BULLET_1_DIRECTIVE.md`, etc.) in the existing "Attached Global Files" section, which can keep its current label.

3. **Silent Build Branch creation.** The first task message submission triggers Build Branch creation behind the scenes. The owner sees a single plain-English progress indicator ("Setting up your workspace…") that auto-clears within 5 seconds (typical) or up to 90 seconds (large repo first clone). If creation fails, the message is held and a plain-English error appears: "I couldn't set up your workspace. [Error in plain English]. Try again or pick a different project." No technical jargon.

4. **Per-turn governance injection.** Every model call in the Task (Claude, Kimi, AI coordinator) prepends governance content to the system prompt. The existing `Shared context was prepared` AI Activity event extends its description naturally — for example: *"AI coordinator assembled task thread, global memory, task file metadata, project files, route, and credential context for this turn."* Note: the owner-facing phrase is "project files," not "governance files."

5. **Diagnostics size display.** The Task Inspector → Diagnostics tab gains a new visible field: **"Project context size"** showing the tokens used by injected governance plus the configured budget (e.g., `1,847 / 8,000 tokens`). If governance was truncated this turn, also show: `Truncated: yes — last 312 tokens dropped to fit budget.` Diagnostics labels are technical (Plain-English Owner Standard does not apply here).

6. **Diagnostics terminal Build Branch toggle.** Per `INV-S4-5-09`. Visible only on Tasks with a Build Branch. Toggle labels may be technical (`Personal workspace`, `Project Build Branch`) but must not use `governance`, `rule book`, `agent env var`, or `buildTargetId`.

7. **Project Settings page.** **Out of scope for §4.5.** Governance file management for now happens via direct DB or via the existing `updateBuildTarget` mutation called from a developer console. Owner-facing settings UI is a future directive (likely §1A-FU-04 or later).

8. **Backward compatibility.** Every existing test passes. New freestanding-task test passes. Total test count grows by at least 9 (one per invariant) plus existing.

9. **Validation gates:**
   - `pnpm check`
   - Focused: `pnpm test --run server/section4-5.project-task-wiring.contract.test.ts` (new file)
   - Focused: `pnpm test --run client/src/pages/Home.behavior.test.tsx`
   - Full: `pnpm test --run`
   - `pnpm build`

---

## §4.5 Out-of-Scope (Hard Forbidden)

Do **not** address these in §4.5. If you find yourself touching them, stop and propose `[PORTAL-OOS-XX]` separately.

- The `Resize noted. Basic shell fallback is not a PTY` spam in Diagnostics tab. Pre-existing `node-pty` fallback issue. Out of scope.
- §1A-FU-04 plain-English wizard rewrite. Separate stream.
- §8 Composer Queue. Separate stream.
- Project Settings page UI. Future.
- Multi-Project task switching (a Task that needs files from two Projects). V2.
- Skill Libraries integration into governance injection. Future, possibly §3 follow-up.
- Refactoring the existing context-assembly function beyond the minimum needed to add governance. If the function is "ugly" but works, leave it.
- Improving the existing "AI worker started" / "Task turn was saved" event labels. They're fine.
- Modifying the Anthropic API call shape (`buildClaudeMessagesRequestBody`). Only the system-prompt content changes.
- Modifying the Cloudflare Workers AI invocation pattern for Kimi. Only the system-prompt content changes.

---

## §4.5 Architectural Notes for Implementation

These are guidance, not constraints. Use what works.

1. **Where to inject governance into the system prompt.** Reuse existing `enforceGovernanceBudget` and `renderGovernanceBlock` from `server/buildRunner/loadGovernance` (visible in §1A's imports). The integration point is wherever the AI coordinator currently builds the model-call system prompt — extend that function to call these helpers when the Task has a Project association.

2. **Where to attach Global File link records at Task creation.** The first-class Global Files layer from the P1 implementation already supports task attachment link records. Reuse that linking mutation. Call it from the Task creation flow once per governance file when the Project association is set.

3. **Read-only protection for governance-attached files.** Add a `source` enum column on the global file link table (or extend the existing metadata): `'owner_upload' | 'project_governance'`. When `source = 'project_governance'`, deletion via Task UI is rejected with a structured error.

4. **Silent Build Branch creation.** Wrap the existing `createBuildBranch` + `cloneOrSyncBranch` flow (from §4) in a Task-message-submit middleware. If the Task has a Project association and no Build Branch exists for the Task, create it before the model call. If creation fails, hold the message and surface the plain-English error.

5. **AI Activity events for governance.** Add new event types `governance_assembled` (succeeded variant) and `governance_truncated` (informational variant). Reuse the existing `appendTaskEvent` helper.

6. **Task Inspector "Project context size" display.** Add a small field to Diagnostics. Reuse the existing diagnostic rendering pattern. Do not build a new tab.

7. **Diagnostics terminal toggle.** The toggle is a small `<Select>` or `<Tabs>` on top of the existing terminal component. The terminal's `cwd` for the WebSocket session changes based on the toggle. The Build Branch workspace path comes from the existing `buildBranches.workspacePath` (resolved via `getBuildBranchWorkspacePath`). If the Build Branch is in `state: 'cloning'` or `'error'`, disable the toggle and show a small inline status.

8. **Task → Project association.** The schema currently has `tasks.buildBranchId` (nullable). For §4.5, also add `tasks.buildTargetId` (nullable, foreign key to `buildTargets.id`). On Task creation with a Project picker, populate `buildTargetId` immediately. `buildBranchId` is populated lazily on first message submit (per `INV-S4-5-04`). Both columns nullable preserves backward compatibility for freestanding tasks (`INV-S4-5-05`).

9. **AI coordinator routing event description.** Update the existing `Shared context was prepared` event description to include "project files" when a Project is associated. Plain-English in description, technical in metadata JSON.

10. **Empty governance file handling.** If `governanceFilesJson` is `[]` (Project has no rule books configured), Task creation still associates the Project but no files are auto-attached. The system prompt is unchanged for that turn. No `governance_assembled` event is emitted. This is the "Project with no governance" case and must work cleanly.

---

## §4.5 Commit Discipline

- One or more commits prefixed `[PORTAL-P2-S4-5-XX]`.
- Commit messages describe the invariant they address (e.g., `feat(project-task-wiring): auto-attach project governance files to new tasks [PORTAL-P2-S4-5-01 / INV-S4-5-01]`).
- Push to `main` only when ingestion evidence + all 9 invariant tests + functional acceptance criteria + validation gates pass locally.
- Do not bundle §1A-FU-04 or §8 work.
- Out-of-scope discoveries → separate `[PORTAL-OOS-XX]` proposal commits → stop for Product Owner approval.

When complete, send the Product Owner a single message containing:

1. Commit URL(s).
2. Validation gate table identical to §1A and §4 acceptance packages (Gate / Result columns).
3. The full diff of the new contract test file (`server/section4-5.project-task-wiring.contract.test.ts`).
4. The full diff of the wizard/Home component changes for the Project picker and the Diagnostics terminal toggle.
5. The full diff of the system-prompt assembly change.
6. Plain-prose answers to:
   - Where exactly is governance content prepended to the model call's system prompt? (file + function name)
   - What happens when a Project has zero governance files and a Task is created on it? (per Architectural Note 10)
   - How is silent Build Branch creation rolled back if `cloneOrSyncBranch` fails partway through? (cleanup path)
   - What is the maximum end-to-end time from "+ New task" click to first AI response when the Build Branch must be created from scratch? (best-case + worst-case)
7. Explicit boundary statement: *"§4.5 is complete for review. Phase 2 final closeout remains deferred until the Product Owner accepts §4.5. §1A-FU-04 and §8 have not begun."*

Wait for written acceptance from the Product Owner before §1A-FU-04 begins.

---

**End of §4.5 directive.**
