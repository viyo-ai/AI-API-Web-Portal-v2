# §4.5 FU-01 Follow-Up Instruction — Section Index

Source: `/home/ubuntu/upload/Pasted_content_16.txt`.

## Section 1 — Conditional acceptance and follow-up scope, lines 1–3

The Product Owner conditionally accepts the prior §4.5 implementation but requires a follow-up commit before final sign-off. The required commit identifier is `[PORTAL-P2-S4-5-FU-01]`, and it must land on the same `agent-work/s4-5-prep-inputs` branch.

## Section 2 — INV-S4-5-07 read-only Project files, lines 4–11

The instruction requires a guarded task-level deletion path for task Global File links that rejects deletion when the link source is `project` or `root_default`. The rejection must use the exact structured error text, and a behavioral server contract must prove the deletion fails and leaves the link intact.

## Section 3 — INV-S4-5-09 Diagnostics terminal Build Branch toggle, lines 12–20

The Diagnostics tab must expose a hidden-by-default Build Branch terminal scope option only when the current task has an associated Build Branch. The default remains the Personal workspace, while selecting Project Build Branch changes the displayed/used cwd to the Build Branch workspace path resolved by `getBuildBranchWorkspacePath`.

## Section 4 — INV-S4-5-08 vocabulary enforcement behavioral test, lines 21–26

The Home behavior suite must render the task creation flow with at least one Project and assert that owner-facing HTML, excluding Diagnostics content, does not contain forbidden internal vocabulary. If existing owner-facing copy already violates this rule, the build must stop and treat it as a separate `[PORTAL-OOS-XX]` discovery rather than silently renaming labels.

## Section 5 — INV-S4-5-06 Project picker behavioral tests, lines 27–31

The Home behavior suite must cover all Project picker states: no picker when there are zero Projects, one Project pre-selected without an explicit picker step, and two Projects shown as two dropdown options.

## Section 6 — Replace source-string assertions with behavioral tests, lines 32–34

The §4.5 server contract suite must replace invalid `readSource(...) + toContain(...)` checks for S4-5-03, S4-5-04, S4-5-05, S4-5-06, S4-5-08, and S4-5-09 with tests that exercise procedures or components and assert behavior. Static schema and constant equality checks may remain.

## Section 7 — Boundary and validation, line 35

The follow-up must not start §1A-FU-04 or §8. All four validation gates must pass before push, and the agent must hold for Product Owner sign-off after the commit lands.
