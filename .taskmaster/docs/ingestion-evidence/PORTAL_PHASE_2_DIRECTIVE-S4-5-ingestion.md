# PORTAL_PHASE_2_DIRECTIVE-S4-5 Ingestion Evidence

**Source document:** `/home/ubuntu/upload/PORTAL_PHASE_2_DIRECTIVE_S4_5_PROJECT_TASK_AUTO_WIRING.md`

**Implementation branch:** `agent-work/s4-5-prep-inputs`

**Ingestion verdict:** **PASSED FOR IMPLEMENTATION**. The directive has nine explicit implementation invariants, all nine have a mapped implementation/test target, and the Product Owner has accepted `PORTAL-P2-S4-5-PREP-02` and authorized §4.5 work. This artifact is produced before implementation code changes, as required by §4.5 execution discipline.

## 1. Read-State and Scope Boundary

The §4.5 directive was read in two passes because the full read output was truncated after the architectural guidance heading. Lines 1–108 were read first, then lines 104–157 were read as a continuation. The governing boundaries are clear: §4.5 extends the existing per-turn context assembly, first-class Global Files, Project/build target governance fields, and §4 Build Branch machinery. It must not begin §1A-FU-04, §8 Composer Queue, Project Settings UI, PTY fallback repair, or Skill Libraries integration.

The Product Owner clarified one directive ambiguity before implementation began: `CURRENT_BULLET.txt` is the only additional root Global File included by the directive's `etc.` language. The four root Portal-wide defaults are therefore exactly `CLAUDE.md`, `FOUNDATION_LOCK.md`, `BULLET_1_DIRECTIVE.md`, and `CURRENT_BULLET.txt`. These root defaults are auto-attach targets when a Task is created with no Project association or when the selected Project's `governanceFilesJson` is empty. When a Project specifies its own governance files, those Project files load in addition to the four root files, and Project files come after root defaults so they layer on top.

## 2. Section Index With Summaries

| Section | Lines | Classification | Summary |
|---:|---:|---|---|
| 1 | 1–15 | Hybrid | The directive identifies the repository, states that §4.5 can begin only after Product Owner acceptance, and records source-of-truth observations about existing context assembly, Task Inspector wording, Project governance fields, Global Files, Build Branch schema, and the out-of-scope PTY fallback issue. These observations establish that §4.5 is an extension of existing scaffolds, not a replacement. |
| 2 | 17–25 | Constraint | Execution discipline requires a dedicated ingestion artifact, reuse of existing scaffolds, conventional commit prefixes, and separate out-of-scope proposal commits followed by a STOP for Product Owner approval. This section is process-governing and must be enforced throughout implementation. |
| 3 | 28–39 | Constraint | The Plain-English Owner Standard requires Project-to-Task Auto-Wiring to be invisible in normal owner-facing flows. The owner may see `Project`, `New task`, and natural file names, but non-Diagnostics surfaces must not expose governance jargon or implementation identifiers. |
| 4 | 42–57 | Work Item | The directive defines nine hard functional invariants `INV-S4-5-01` through `INV-S4-5-09`. These invariants cover Project file auto-attachment, per-turn prompt injection, budget truncation, silent Build Branch creation, backward compatibility, Project picker behavior, read-only Project-attached files, UI vocabulary enforcement, and Diagnostics terminal workspace switching. |
| 5 | 60–84 | Hybrid | Functional acceptance criteria expand the invariants into owner-visible behavior, diagnostics display requirements, validation gates, and backward-compatibility expectations. This section also confirms Project Settings UI remains out of scope and requires total test count to grow by at least nine. |
| 6 | 87–101 | Constraint | The out-of-scope section forbids touching PTY spam, §1A-FU-04, §8, Project Settings UI, multi-Project task switching, Skill Libraries integration, broad context-assembly refactors, unrelated event label improvements, and provider invocation-shape changes. Any discovery in these areas must become a separate `[PORTAL-OOS-XX]` proposal commit followed by STOP. |
| 7 | 104–127 | Hybrid | Architectural notes identify preferred integration points: reuse governance budget/render helpers, attach Global File links during Task creation, add link-source metadata, wrap existing Build Branch creation on first message, emit governance events, add Diagnostics context-size display, add terminal workspace toggle, introduce nullable `tasks.buildTargetId`, update the context event description, and handle empty Project governance cleanly. |
| 8 | 130–152 | Constraint | Commit and completion rules require `[PORTAL-P2-S4-5-XX]` commits, successful ingestion evidence and validation gates before push, explicit completion-package contents, and a boundary statement that Phase 2 closeout remains deferred and §1A-FU-04/§8 have not begun. |
| 9 | 154–156 | Reference | The directive ends at line 156 with no additional hidden requirements. |

## 3. Structured Constraint Extraction

| Constraint ID | Source Lines | Rule Text | Applies To | Enforcement Plan |
|---|---:|---|---|---|
| PORTAL-P2-S4-5-HR-01 | 17–25 | Produce `.taskmaster/docs/ingestion-evidence/PORTAL_PHASE_2_DIRECTIVE-S4-5-ingestion.md` before claiming §4.5 complete. | Process and repo artifacts | This file is created before implementation code changes. |
| PORTAL-P2-S4-5-HR-02 | 21–24 | Reuse existing scaffolds and extend the existing per-turn context assembly that produces the shared-context activity event. | Backend prompt/context assembly | Implementation must modify the existing context path rather than creating a parallel provider path. |
| PORTAL-P2-S4-5-HR-03 | 23, 130–136 | Commit messages must use `[PORTAL-P2-S4-5-XX]`; out-of-scope discoveries require separate `[PORTAL-OOS-XX]` proposal commits and STOP. | Git commits | Only §4.5 files are included in §4.5 commits; OOS work is not bundled. |
| PORTAL-P2-S4-5-HR-04 | 28–39 | Non-Diagnostics owner-facing UI must not use forbidden technical vocabulary. | Home/task creation/files UI | UI copy and tests must exclude forbidden strings outside Diagnostics scope. |
| PORTAL-P2-S4-5-HR-05 | 46–54 | All nine invariants `INV-S4-5-01` through `INV-S4-5-09` are hard functional requirements. | Backend, frontend, tests | Create focused contract/behavior tests with one or more assertions per invariant. |
| PORTAL-P2-S4-5-HR-06 | 56 | Diagnostics terminal toggle is read-only navigation and must not weaken §4 protected-branch hooks. | Diagnostics terminal | Only current working directory selection changes; no push bypass or hook changes are allowed. |
| PORTAL-P2-S4-5-HR-07 | 62–76 | Project picker, auto-attached files, silent workspace setup, per-turn Project file injection, context-size Diagnostics, terminal toggle, and backward compatibility are acceptance criteria. | End-to-end task flow | Implement and validate each acceptance criterion with focused tests and full-suite checks. |
| PORTAL-P2-S4-5-HR-08 | 74 | Project Settings page UI is out of scope for §4.5. | Frontend | Do not add Project Settings management surfaces. |
| PORTAL-P2-S4-5-HR-09 | 87–101 | PTY fallback spam, §1A-FU-04, §8, multi-Project task switching, Skill Libraries governance integration, broad refactors, unrelated labels, and provider call-shape changes are forbidden. | Entire implementation | Stop for PO approval if work requires these changes; do not touch PTY/provider request shapes beyond system-prompt content. |
| PORTAL-P2-S4-5-HR-10 | 108–127 | Use existing governance budget/render helpers, first-class Global Files, Build Branch creation flow, task events, Diagnostics pattern, and nullable Project association. | Architecture | Prefer additive changes in existing modules. |
| PORTAL-P2-S4-5-HR-11 | PO clarification | Root defaults are exactly `CLAUDE.md`, `FOUNDATION_LOCK.md`, `BULLET_1_DIRECTIVE.md`, and `CURRENT_BULLET.txt`; Project files layer after root defaults. | Auto-attachment and prompt assembly | Add tests for root-default fallback and Project-over-root layering. |

## 4. Per-Invariant Coverage Map

| Invariant | Source Lines | Implementation Target | Test Target | Coverage Status |
|---|---:|---|---|---|
| INV-S4-5-01 | 46 | Task creation must attach selected Project files as Global File link records within the task flow. Root defaults apply when no Project or empty Project files; Project files layer after root defaults. | `server/section4-5.project-task-wiring.contract.test.ts` plus `Home.behavior.test.tsx` for Files panel expectations. | COVERED BY PLANNED WORK |
| INV-S4-5-02 | 47 | Per-turn system prompt assembly must prepend loaded Project/root file content for Claude, Kimi, and coordinator routing every turn. | Contract test inspects prompt assembly hooks/payload construction and sequential-turn behavior where feasible with mocks/source guards. | COVERED BY PLANNED WORK |
| INV-S4-5-03 | 48 | Budget enforcement must truncate rather than drop context, include `[truncated for budget]`, allow model calls, and append `governance_truncated` activity metadata. | Contract test exercises oversized content and verifies truncation metadata/event fields. | COVERED BY PLANNED WORK |
| INV-S4-5-04 | 49 | First task message on a Project task must silently create the Build Branch before model invocation; failure must hold the message and surface plain English. | Contract test validates router ordering/source path; behavior test validates owner status wording. | COVERED BY PLANNED WORK |
| INV-S4-5-05 | 50 | Freestanding tasks must remain backward-compatible: no Project injection and no Build Branch creation when `buildTargetId` is null. Root Portal defaults are clarified as file defaults for tasks lacking Project association, so tests must distinguish no Project-specific Build Branch from root file context. | Contract test asserts nullable Project path does not create Build Branch and does not inject Project-specific files. Existing suite guards regressions. | COVERED BY PLANNED WORK WITH PO CLARIFICATION |
| INV-S4-5-06 | 51 | New task UI must hide Project picker with zero Projects, preselect one Project, and show picker with multiple Projects. | `Home.behavior.test.tsx` Project picker tests. | COVERED BY PLANNED WORK |
| INV-S4-5-07 | 52 | Project-attached Global File links must be read-only from Task context and reject task-level deletion with a structured plain-English error. | Contract test covers link-source metadata and delete/detach rejection path. | COVERED BY PLANNED WORK |
| INV-S4-5-08 | 53 | Non-Diagnostics task creation flow must pass forbidden-vocabulary checks. | `Home.behavior.test.tsx` renders non-Diagnostics UI and excludes forbidden terms. | COVERED BY PLANNED WORK |
| INV-S4-5-09 | 54–56, 70–72, 120 | Diagnostics terminal must show Personal workspace / Project Build Branch toggle only when a Build Branch exists and switch displayed cwd to branch workspace path. | `Home.behavior.test.tsx` toggle visibility and cwd assertions. | COVERED BY PLANNED WORK |

## 5. Backward Traceability and Hallucination Check

No Taskmaster task generation was run from this directive because the Product Owner directly authorized the implementation stream and specified the exact nine invariants as the implementation universe. The implementation task landscape is therefore the nine invariant rows above plus the required ingestion artifact and validation gates. There are no hallucinated work items in this ingestion artifact; every planned implementation target traces to a directive invariant, an architectural note, an acceptance criterion, or the explicit Product Owner clarification about the four root Global Files.

| Planned Work Item | Source | Traceability Status |
|---|---|---|
| Ingestion artifact | Lines 17–25 | TRACED |
| Project/root file auto-attachment | Lines 46, 62–65, 110, PO clarification | TRACED |
| Per-turn prompt injection | Lines 47, 68, 108 | TRACED |
| Budget truncation and event metadata | Lines 48, 70, 116 | TRACED |
| Silent Build Branch creation | Lines 49, 66, 114 | TRACED |
| Freestanding compatibility | Lines 50, 76, 122, 126, PO clarification | TRACED |
| Project picker UI | Lines 51, 62 | TRACED |
| Read-only Project-attached files | Lines 52, 112 | TRACED |
| Plain-English vocabulary enforcement | Lines 28–39, 53 | TRACED |
| Diagnostics context size and terminal toggle | Lines 54–56, 70–72, 118–120 | TRACED |
| Validation and completion package | Lines 78–84, 138–150 | TRACED |

## 6. Airtable and Taskmaster Reconciliation

This repo is already on the dedicated §4.5 preparation branch. The directive requires the artifact and implementation, but it does not require creating new Taskmaster CLI tasks for each invariant before coding. The current session todo entry records the authorized implementation scope, and the required repo-tracked evidence file is created here. Airtable reconciliation is not executed in this sandbox pass because no Airtable Build Tracker base/table identifiers were provided in the directive or project context; this is recorded as a process limitation, not an implementation blocker, because the Product Owner supplied direct written authorization to begin §4.5.

## 7. Conservative Verdict

**PASSED FOR IMPLEMENTATION.** The directive has been section-indexed, constraints have been extracted, every invariant has a mapped implementation and test target, forbidden work has been isolated, and the clarified root Global File universe is recorded. Implementation may proceed only within §4.5, on the accepted branch, with `[PORTAL-P2-S4-5-XX]` commits, full validation gates, and a final hold for Product Owner sign-off.
