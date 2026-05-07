# BULLET_1_DIRECTIVE.md

**Scope:** Portal-wide. Auto-attached to every Task in every Project as a Global File. Loaded into every model-call system prompt.

**Status:** Active. The current bullet of work for the Portal itself.

**Bullet:** Phase 2 — Project-to-Task Auto-Wiring (§4.5).

**Version:** 1.0 — May 7, 2026.

---

## What "Bullet" Means

The Portal organizes its own development as a sequence of focused units called Bullets. Each Bullet is a single tightly-scoped objective with locked acceptance criteria. The Portal builds itself one Bullet at a time. The current Bullet is the only Bullet authorized to be in active development; all others are either accepted (locked) or deferred (queued).

When you (Claude or Kimi) work on a Task in any Project, this file tells you what the Portal is currently focused on building. This affects:
- What Portal features you can rely on existing
- What Portal features are coming soon (don't recommend them as available)
- What Portal features are deferred (don't suggest building them ad-hoc)

The pointer to the active Bullet lives in `CURRENT_BULLET.txt` at the Portal repo root. That file is the single source of truth for "what is the Portal working on right now."

---

## Current Bullet: §4.5 Project-to-Task Auto-Wiring

### Objective

Make every Task created on a Project automatically inherit the Project's full context — governance files, Build Branch, agent environment — without the owner clicking anything beyond "+ New task."

### What §4.5 builds

1. **Project picker on Task creation.** When a Project exists, "+ New task" shows a Project picker. Single-Project case auto-selects.

2. **Auto-attached governance files.** Within 2 seconds of Task creation, the Project's governance files (per `governanceFilesJson`) appear in the Task Inspector → Files panel. Owner did not upload them.

3. **Per-turn governance injection.** Every model call (Claude, Kimi, AI coordinator) prepends governance content to the system prompt for tasks attached to a Project.

4. **Silent Build Branch creation.** When the owner submits the first task message on a Project-attached Task, the Build Branch is created automatically in the background. Owner sees "Setting up your workspace…" and then the AI response.

5. **Read-only protection** for Project-attached files in the Task Inspector. Owner cannot accidentally delete a governance file from inside a Task.

6. **Diagnostics terminal Build Branch toggle.** When a Task has a Build Branch, the Diagnostics terminal offers a small toggle to switch between Personal workspace and Project Build Branch.

### What §4.5 does NOT build

- Project Settings page UI — future
- Multi-Project task switching (a Task drawing files from two Projects) — V2
- Skill Libraries integration into governance injection — future, possibly §3 follow-up
- Plain-English wizard rewrite — separate stream (§1A-FU-04)
- Composer Queue + Stop button — separate stream (§8)
- Verified Handoff approval gate (Claude plan → owner approves → Kimi executes) — future (§9)

### Acceptance criteria

Nine hard invariants (`INV-S4-5-01` through `INV-S4-5-09`) plus functional acceptance criteria. See `PORTAL_PHASE_2_DIRECTIVE_S4_5_PROJECT_TASK_AUTO_WIRING.md` for the full directive.

### Status

§4.5 directive is authored and authorized. §4 Branch Isolation accepted (commit `fa21473c`). §4.5 prep inputs (this file and siblings) committed on `agent-work/s4-5-prep-inputs`. §4.5 implementation begins on next Manus cycle. Acceptance pending.

---

## Portal Build Sequence

### Accepted (locked)

| Bullet | Scope | Status |
|---|---|---|
| Phase 1 | Provider routing, OAuth, three-panel workspace, Global Files library, AI Activity feed | Accepted |
| Phase 2 §1A | Project Setup Wizard with LLM-driven analysis, 6-card review, 24h cache, 90s timeout | Accepted |
| Phase 2 §4 | Branch Isolation: `agent-work/*` enforcement, `.env.agent` injection, pre-push hooks, workspace cleanup | Accepted |

### Active

| Bullet | Scope | Status |
|---|---|---|
| Phase 2 §4.5 | Project-to-Task Auto-Wiring | **Current — directive sent, awaiting Manus** |

### Queued

| Bullet | Scope | Authorization |
|---|---|---|
| Phase 2 §1A-FU-04 | Plain-English wizard rewrite | Deferred until §4.5 accepted |
| Phase 2 §8 | Composer Queue + Stop button | Deferred until §4.5 + §1A-FU-04 accepted |
| Phase 3 §9 | Verified Handoff with explicit approval gate (Claude plan → owner approves → Kimi executes) | Not yet authorized; will be next priority after §4.5 acceptance |
| Future | Skills Registry UI, multi-Project task switching, Project Settings page | Not yet scoped |

---

## What This Means for Your Current Task

If you (Claude or Kimi) are answering a task right now, you're operating with §4 capabilities and earlier. That means:

✅ **Available** — you can rely on these existing:
- Task creation (with manual Project association via existing UI)
- Auto / Claude / Kimi routing with `#claude` `#kimi` overrides
- Global Files (manual upload + library)
- Build Branch creation via UI button
- Build Branch push with protected-branch enforcement
- Governance helpers (`enforceGovernanceBudget`, `renderGovernanceBlock`) exist in `server/buildRunner/loadGovernance` but are not yet wired to per-turn injection

⚠️ **Not yet available** — do not promise these to the owner:
- Automatic governance file attachment on Task creation
- Automatic Build Branch creation on first message submit
- Project picker on Task creation
- Per-turn governance injection into the system prompt
- Diagnostics terminal Build Branch toggle

🚫 **Not authorized** — do not build these ad-hoc:
- Verified Handoff approval gate (§9)
- Composer Queue (§8)
- Skills Registry UI
- Project Settings page

If the owner asks for any of the "not yet available" features, explain that they are scheduled in the current Bullet and will land when §4.5 is accepted. If the owner asks for "not authorized" features, explain that they are queued for a future Bullet and require explicit Product Owner directive before work begins.

---

## Bullet Discipline

- **One Bullet at a time.** Only the current Bullet is in active development. Every other proposal is queued.
- **Phase boundaries are firm.** No work crosses a Phase boundary in a single change without Product Owner approval.
- **Out-of-scope discoveries during a Bullet** get a separate `[PORTAL-OOS-XX]` proposal commit and STOP for owner approval. Never bundle into the active Bullet's commits.
- **Bullet acceptance closes the Bullet.** After Product Owner sign-off, the Bullet is locked. Future changes require a new Bullet directive.

---

**End of BULLET_1_DIRECTIVE.md.**
