# §4.5 FU-01 Follow-Up Instruction — Classification

| Section | Type | Downstream handling |
|---|---|---|
| Section 1 — Conditional acceptance and follow-up scope | Hybrid | Implement the FU-01 work on the existing branch and preserve commit identifier/boundary constraints. |
| Section 2 — INV-S4-5-07 read-only Project files | Work Item | Add guarded deletion helper/path and behavioral server contract coverage. |
| Section 3 — INV-S4-5-09 Diagnostics terminal Build Branch toggle | Work Item | Add UI toggle, cwd behavior, and Home behavior coverage. |
| Section 4 — INV-S4-5-08 vocabulary enforcement behavioral test | Hybrid | Add behavioral vocabulary test; stop for `[PORTAL-OOS-XX]` if an existing owner-facing violation is found. |
| Section 5 — INV-S4-5-06 Project picker behavioral tests | Work Item | Add three Home behavior tests for each requested state. |
| Section 6 — Replace source-string assertions with behavioral tests | Constraint | Replace invalid source-string assertions while keeping schema/constant static checks. |
| Section 7 — Boundary and validation | Constraint | Do not start §1A-FU-04 or §8; run all validation gates; hold for PO sign-off. |

## Extracted constraints

| Constraint ID | Rule | Applies to |
|---|---|---|
| FU01-C01 | Use commit identifier `[PORTAL-P2-S4-5-FU-01]`. | Git commit and delivery report. |
| FU01-C02 | Structured error text must be exactly: “This file is attached from your Project. To remove it, change your Project’s settings — not this task.” | Read-only file deletion guard. |
| FU01-C03 | Do not silently rename existing owner-facing forbidden vocabulary; stop and open `[PORTAL-OOS-XX]` proposal if the vocabulary test reveals an existing violation. | Home behavior vocabulary test and implementation. |
| FU01-C04 | Replace source-string contract checks for S4-5-03, S4-5-04, S4-5-05, S4-5-06, S4-5-08, and S4-5-09 with behavioral assertions. | `server/section4-5.project-task-wiring.contract.test.ts`. |
| FU01-C05 | Do not start §1A-FU-04 or §8. | Entire session. |
| FU01-C06 | Run all four validation gates before push and hold for Product Owner sign-off. | Completion workflow. |
