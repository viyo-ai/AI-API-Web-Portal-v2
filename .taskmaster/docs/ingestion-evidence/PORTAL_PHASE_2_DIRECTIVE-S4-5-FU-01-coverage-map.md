# §4.5 FU-01 Follow-Up Instruction — Coverage Map and Hallucination Check

## Forward traceability

| Section | Requirement | Planned implementation or verification | Coverage status |
|---|---|---|---|
| Section 1 | Follow-up commit on same branch with `[PORTAL-P2-S4-5-FU-01]`. | Work on `agent-work/s4-5-prep-inputs`; commit and push with requested identifier. | COVERED |
| Section 2 | Guard Project/root-default Global File link deletion and prove rejection behavior. | Add helper/path and behavioral server contract asserting rejection text and preserved record. | COVERED |
| Section 3 | Diagnostics terminal scope toggle for Build Branch tasks. | Update Home Diagnostics state and terminal cwd behavior; add Home behavior tests. | COVERED |
| Section 4 | Vocabulary behavioral test and stop on existing violation. | Add owner-facing HTML test excluding Diagnostics; halt if failure reveals existing copy violation. | COVERED |
| Section 5 | Project picker behavioral tests for zero/one/two Projects. | Add Home behavior tests for each requested state. | COVERED |
| Section 6 | Replace invalid source-string assertions with behavioral tests. | Refactor §4.5 contract suite to remove `readSource(...).toContain(...)` checks for the listed invariants. | COVERED |
| Section 7 | No §1A-FU-04/§8; all validation gates pass; hold for sign-off. | Keep scope locked, run configured gates plus pipeline check after push, then report and stop. | COVERED |

## Backward traceability

| Work item | Source section | Traceability status |
|---|---|---|
| Read-only file deletion guard and server behavior test | Section 2 | TRACED |
| Diagnostics terminal Build Branch toggle and UI behavior test | Section 3 | TRACED |
| Vocabulary enforcement behavior test with OOS stop rule | Section 4 | TRACED |
| Project picker behavior tests | Section 5 | TRACED |
| Contract-suite refactor away from source-string checks | Section 6 | TRACED |
| Validation, commit, push, and hold boundary | Sections 1 and 7 | TRACED |

Verdict: PASSED for implementation planning. No orphan sections and no hallucinated work items were identified.
