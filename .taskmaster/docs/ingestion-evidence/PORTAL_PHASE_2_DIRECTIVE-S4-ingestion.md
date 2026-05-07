# PORTAL_PHASE_2_DIRECTIVE — §4 Branch Isolation Ingestion Evidence

## Source and Read State

This ingestion file records the authorized start of **§4 Branch Isolation** after Product Owner acceptance of §1A. The direct source is `/home/ubuntu/upload/pasted_content.txt`, which explicitly authorizes §4, names `PORTAL_BUILD_DIRECTIVE_V3.md Section 4` as the controlling section, and requires this evidence file before §4 completion is claimed.[1]

| Source Item | Read Status | Scope Decision |
|---|---:|---|
| `pasted_content.txt` lines 1-2 | Read | §4 is authorized; §1A is accepted; §8 and Phase 2 closeout are not authorized. |
| `pasted_content.txt` lines 5-8 | Read | Evidence, buildRunner scaffold reuse, commit hygiene, and out-of-scope proposal discipline are mandatory. |
| `pasted_content.txt` lines 10-11 | Read | Six hard security invariants define required behavior and tests. |
| `pasted_content.txt` lines 12-20 | Read | Functional acceptance includes wizard-created branch, UI creation/deletion, structured protected-branch errors, `.env.agent`, and validation gates. |
| `pasted_content.txt` lines 22-28 | Read | Commits must be `[PORTAL-P2-S4-XX]`, pushed only after local gates pass, and reported with explicit Phase 2 boundary. |

## Section Index

### Authorization and Execution Boundary

§4 work may begin only because §1A is fully accepted. The directive explicitly prohibits declaring Phase 2 complete and requires stopping at §4 acceptance for Product Owner review before any §8 Composer Queue work begins.[1]

### Scaffold Reuse Requirement

Implementation must use the existing `buildRunner` scaffold, specifically `cloneOrSyncBranch`, `assertSafeBranchName`, `pushBranch`, and `getBuildBranchGitStatus`. Replacing this scaffold or inventing a parallel branch-isolation engine is outside scope.[1]

### Out-of-Scope Process Correction

Any discovered work outside §4 scope, such as unrelated transient test flakes, missing logs, or refactor opportunities, must become a separate `[PORTAL-P2-OOS-XX]` proposal commit and then stop for Product Owner approval. Such work must not be bundled into §4 commits.[1]

### Hard Security Invariants

The directive defines six mandatory invariants: protected branches must never be pushed from agent workspaces; branch names must match the configured prefix; workspaces must be isolated per Build Branch; agent subprocess environments must include only mapped variables; pre-push hooks must block protected-branch pushes as defense in depth; and workspace deletion must remove `.git`, `.env.agent`, and uncommitted files.[1]

### Functional Acceptance

Acceptance requires wizard completion to create a Build Branch with isolation guarantees, UI creation on existing Build Targets, visible cloning-to-clean transition, Filesystem panel visibility, structured protected-branch push errors, `.env.agent` generation and `.gitignore`, atomic UI deletion, six invariant tests, `Home.tsx` test cases for creation/protected push/deletion, and `pnpm check`, `pnpm test --run`, and `pnpm build` passing.[1]

## Constraint Extraction

| Constraint ID | Directive Constraint | Implementation Implication | Test / Evidence Obligation |
|---|---|---|---|
| PORTAL-P2-S4-AUTH-01 | §4 is authorized after §1A acceptance. | Work may begin on Branch Isolation only. | Ingestion file and final report must state §4 only. |
| PORTAL-P2-S4-BOUNDARY-01 | Do not declare Phase 2 complete. | Delivery must stop at §4 Product Owner review. | Final report must include explicit boundary. |
| PORTAL-P2-S4-BOUNDARY-02 | Do not begin §8 Composer Queue. | No queue/composer implementation may be touched unless already part of §4 wiring and unchanged. | Diff review must show no §8 work. |
| PORTAL-P2-S4-SCAFFOLD-01 | Use existing `buildRunner` scaffold. | Extend `cloneOrSyncBranch`, `assertSafeBranchName`, `pushBranch`, and `getBuildBranchGitStatus`; do not create competing primitives. | Code review and focused tests must target scaffold behavior. |
| PORTAL-P2-S4-OOS-01 | Out-of-scope discoveries require `[PORTAL-P2-OOS-XX]` proposal and STOP. | Any unrelated fix must not be applied in §4 commits. | Validation failure triage must classify in-scope vs OOS before edits. |
| INV-S4-01 | Agent workspaces never push to protected branches. | `pushBranch` must reject protected targets before network push. | Unit test attempts `main` push and proves no git push subprocess is spawned. |
| INV-S4-02 | Branch names must match configured prefix and reject unsafe names. | `assertSafeBranchName` must enforce configured prefix and path-safety rules. | Unit tests cover empty string, `..`, `/etc/passwd`, `main`, `staging`, valid `agent-work/foo-bar`, Unicode, and whitespace. |
| INV-S4-03 | Each Build Branch workspace has an isolated path. | Workspace path generation must be unique per Build Branch and under the workspace root. | Test creates two Build Branches concurrently and proves paths and files do not overlap. |
| INV-S4-04 | Agent child process receives only mapped environment variables. | `.env.agent` and child env assembly must derive only from `agentEnvVarMapJson`; parent server secrets must not leak. | Test spawns a child process and asserts unmapped `ANTHROPIC_API_KEY` is absent unless explicitly mapped. |
| INV-S4-05 | Every cloned workspace installs pre-push protected-branch hook. | `cloneOrSyncBranch` must install hook in `.git/hooks/pre-push`. | Test attempts protected-branch push from workspace and receives hook rejection. |
| INV-S4-06 | Deleting a Build Branch removes workspace files and DB row atomically. | Delete procedure/helper must remove `.git`, `.env.agent`, uncommitted files, and database state as one operation with rollback/error handling where available. | Test writes workspace files, deletes Build Branch, and asserts path and row are gone. |
| PORTAL-P2-S4-UI-01 | Wizard completion creates a Build Branch. | §1A completion path must call existing branch-isolation creation path after Build Target creation. | Functional/server test verifies Build Branch record/workspace after wizard completion. |
| PORTAL-P2-S4-UI-02 | Existing Build Target can create Build Branch from UI and show cloning → clean. | Home UI must expose branch creation action/state and reflect status transitions. | `Home.tsx` tests cover creation and visible transition. |
| PORTAL-P2-S4-UI-03 | Protected push errors are structured and clear in UI. | Server must return typed error object; UI must render clear message. | Server and `Home.tsx` tests cover failed `main` push. |
| PORTAL-P2-S4-ENV-01 | `.env.agent` is generated from `agentEnvVarMapJson`, lives only in workspace root, and is gitignored. | Clone/create path must write `.env.agent` and `.gitignore` safely. | Workspace file assertions verify content, location, and ignore rule. |
| PORTAL-P2-S4-DELETE-01 | UI deletion removes workspace path and DB row atomically. | Delete mutation and UI action must be wired to cleanup helper. | `Home.tsx` deletion test plus server cleanup invariant. |
| PORTAL-P2-S4-VALIDATION-01 | Six invariants, `pnpm check`, `pnpm test --run`, and `pnpm build` must pass. | No push before all gates pass. | Validation table in final report. |
| PORTAL-P2-S4-COMMIT-01 | Commit messages must be conventional and prefixed `[PORTAL-P2-S4-XX]`. | Commit must use `feat(branch-isolation): ... [PORTAL-P2-S4-XX]` or sub-ID. | Commit URL(s) in Product Owner package. |

## Coverage Map

| Directive Requirement | Planned Coverage Target | Acceptance Signal |
|---|---|---|
| Reuse `buildRunner` scaffold | Audit and extend the existing branch helper functions only. | Diff shows no competing branch runner and tests invoke scaffold functions. |
| INV-S4-01 protected branch push rejection | Enforce rejection in `pushBranch` before any network operation. | Focused test spies/stubs push execution and proves it was not called. |
| INV-S4-02 safe branch names | Strengthen `assertSafeBranchName` against invalid, protected, path traversal, whitespace, and non-prefix names. | Exhaustive branch-name unit table passes. |
| INV-S4-03 workspace isolation | Ensure per-Build-Branch workspace path uniqueness under one workspace root. | Concurrent branch creation test proves path and file isolation. |
| INV-S4-04 mapped-only agent env | Generate `.env.agent` and child env only from configured map. | Child-process test shows parent secrets do not leak. |
| INV-S4-05 pre-push hook | Install protected-branch hook during clone/sync. | Hook rejection test passes. |
| INV-S4-06 cleanup | Wire deletion cleanup for workspace and DB row. | Cleanup test proves `.git`, `.env.agent`, uncommitted files, and row are gone. |
| Wizard completion creates Build Branch | Connect accepted §1A completion to Build Branch creation path. | Functional test verifies branch creation after wizard completion. |
| Existing target branch UI | Add/verify UI control and state rendering. | `Home.tsx` creation/state test passes. |
| Structured protected push UI message | Return structured protected-branch result and render message. | Server and UI tests pass. |
| `.env.agent` gitignored | Write file at workspace root and append/ensure ignore entry. | File content/location/gitignore assertions pass. |
| Validation gates | Run `pnpm check`, focused §4 tests, `pnpm test --run`, and `pnpm build`. | Final build-log and Product Owner report include gate table. |

## Conservative Verdict

**READY TO IMPLEMENT WITH CONDITIONS.** The §4 authorization is explicit and bounded, but completion cannot be claimed until all six invariants have direct tests, the Home UI acceptance cases are covered, and all required local validation gates pass. Any non-§4 issue discovered during implementation must be treated as an out-of-scope proposal and must not be bundled into §4 commits.

## References

[1]: file:///home/ubuntu/upload/pasted_content.txt "Uploaded §4 Branch Isolation authorization and acceptance directive"
