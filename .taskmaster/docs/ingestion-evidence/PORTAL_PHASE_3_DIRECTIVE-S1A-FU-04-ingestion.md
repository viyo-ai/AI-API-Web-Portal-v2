# PORTAL_PHASE_3_DIRECTIVE — §1A-FU-04 Ingestion Evidence

**Author:** Manus AI  
**Date:** 2026-05-07  
**Source document:** `/home/ubuntu/upload/PORTALPHASE3DIRECTIVES1AFU04WIZARDPOLISH.pdf`  
**Directive scope:** §1A-FU-04 Project Setup Wizard Plain-English Polish + Private Repo Verification  
**Repository / branch:** `viyo-ai/AI-API-Web-Portal-v2`, `agent-work/s4-5-prep-inputs`  
**Ingestion verdict:** **CONSERVATIVE PASS FOR IMPLEMENTATION PLANNING ONLY** — the directive contains a bounded ten-invariant implementation set, no schema migration is allowed, PAT-only authentication is mandated, and §8 is explicitly out of scope. Implementation must not begin until this evidence is acknowledged as the §1A-FU-04 coverage gate for the session.

> This artifact is intentionally produced before any §1A-FU-04 source-code changes. It consolidates the section index, classification, hard-rule extraction, per-invariant coverage map, backward traceability, and reconciliation notes required by the directive and the VIYO document ingestion protocol.[1]

## Phase A — Structure-Preserving Section Index

The directive was read from beginning to end across all nine PDF pages. Because the PDF contains several top-level directive sections rather than a long conventional PRD, the sections below preserve the document’s native sequence and summarize each material block.

| Section # | Source Section | Summary Proof |
|---:|---|---|
| 1 | Directive title, authorization status, repository, branch, and phase context | The directive is a follow-up to the accepted §9 recovery and targets the Project Setup Wizard on branch `agent-work/s4-5-prep-inputs`. It states that the existing §1A wizard is functionally present but still exposes owner-facing technical vocabulary, and it adds a pre-save private repository connectivity verification step. |
| 2 | Source-of-truth observations | The directive confirms that PAT-based private GitHub repository support already exists, token values remain in Manus environment variables, and the Portal stores only `buildTargets.githubTokenEnvVar`. It also states that `buildTargets.testConnection` already exists but is not currently required before save, and that Diagnostics is exempt from the Plain-English Owner Standard. |
| 3 | §1A-FU-04 Execution Discipline | The directive requires one ingestion evidence artifact at `.taskmaster/docs/ingestion-evidence/PORTAL_PHASE_3_DIRECTIVE-S1A-FU-04-ingestion.md` before completion claims. It requires existing scaffolds to be extended rather than rewritten, conventional commits with `[PORTAL-P3-S1A-FU-04-XX]`, out-of-scope discoveries to be separated under `[PORTAL-OOS-XX]`, and behavioral tests rather than source-string assertions. |
| 4 | Plain-English Owner Standard — required and forbidden vocabulary | The directive defines exact owner-facing copy replacements, including “Connect a Project,” “Where is your code?”, “GitHub repository link,” “How should we sign in to your code?”, “GitHub token (stored as an environment variable),” “Where Claude and Kimi will work,” “Test the connection,” and “Save Project.” It also forbids raw technical terms in the wizard, including `BUILD_TARGET_GITHUB_TOKEN`, `Repo URL`, `Token Env Var`, `Default Base Branch`, `Build Target`, `Build Branch`, `agent-work/portal-task`, `governance`, `governanceBudgetEnforced`, `agent env var map`, and `protected branches`, except where explicitly permitted outside owner-facing wizard surfaces. |
| 5 | Plain-English token help text | The directive mandates a plain-English explanation that a GitHub Personal Access Token is used to read and write code, that the token value lives in Manus environment variables, and that the owner should enter only the environment variable name. It permits a “Need help generating a token?” expandable section with GitHub PAT documentation and makes that the only owner-facing location where “Personal Access Token” appears. |
| 6 | Hard Functional Invariants INV-S1A-FU-04-01 through INV-S1A-FU-04-10 | The directive defines ten mandatory invariants with explicit behavioral test expectations. They cover plain-English copy, actual-token paste rejection, connection-test wiring, save-button gating, failure-mode handling, token secrecy, repo URL validation, preservation of advanced settings and LLM analysis, keyboard accessibility, and a plain-English success confirmation. |
| 7 | Functional Acceptance Criteria | The directive describes the expected owner journey: a clean three- or four-step flow, safe token-field UX, connection testing within roughly five seconds with success or actionable failure, successful save confirmation, retry after failure without restarting, optional advanced settings, required validation gates, backward compatibility, and at least ten tests added. The data model must remain unchanged and existing Projects must continue to work without rerunning the wizard. |
| 8 | Out-of-Scope — hard forbidden work | The directive explicitly forbids §8 Composer Queue work, SSH authentication, GitHub App authentication, Bitbucket or GitLab support, multi-repo Projects, modification of the LLM-driven repo analysis logic, build target schema changes, credential-storage changes, renaming `buildTargets.githubTokenEnvVar`, and adding a new LLM provider. These are hard boundaries, not implementation suggestions. |
| 9 | Architectural Notes for Implementation | The directive identifies `client/src/pages/Home.tsx` as the wizard location and instructs the builder to extend the existing wizard rather than extract or rewrite unless necessary. It requires ephemeral connection-test state, token paste detection using `/^(ghp_|github_pat_|gho_|ghu_|ghs_|ghr_)/`, centralized error-message helpers for env-var-not-set, 401, and 404 cases, optional advanced settings disclosure, keyboard checks, and behavior-test mocking. |
| 10 | Commit Discipline and Product Owner closeout content | The directive requires commits prefixed `[PORTAL-P3-S1A-FU-04-XX]`, pushing only after ingestion evidence, all ten invariant tests, acceptance criteria, and validation gates pass locally. The final Product Owner message must include a commit URL, validation gate table, wizard-copy diff/content, connection-test enforcement diff, token paste-detection diff, answers to four plain-prose questions, and the boundary statement that §1A-FU-04 is complete for review while §8 has not begun. |
| 11 | End of directive | The document ends after reiterating that the §1A-FU-04 directive is complete. No §8 instructions are authorized for execution in this session. |

## Phase B — Document Classification

The directive combines actionable work, hard constraints, and reference context. Each section below is classified according to its downstream use in implementation planning.

| Section # | Source Section | Classification | Downstream Action |
|---:|---|---|---|
| 1 | Title, authorization, repository, branch, and phase context | Hybrid | Treat as scope and branch constraint plus implementation context for the wizard follow-up. |
| 2 | Source-of-truth observations | Hybrid | Preserve existing PAT/env-var architecture, reuse `buildTargets.testConnection`, and treat Diagnostics as exempt from plain-English scan. |
| 3 | Execution Discipline | Constraint | Enforce evidence-first work, existing scaffold reuse, commit prefix, out-of-scope handling, and behavioral-test requirement. |
| 4 | Plain-English Owner Standard vocabulary | Hybrid | Implement copy updates and forbidden-string behavioral coverage. |
| 5 | Token help text | Work Item | Implement exact token-help wording and optional GitHub PAT help disclosure without exposing token values. |
| 6 | Hard Functional Invariants | Work Item | Implement and test INV-S1A-FU-04-01 through INV-S1A-FU-04-10. |
| 7 | Functional Acceptance Criteria | Hybrid | Use as acceptance gate and validation checklist; preserve backward compatibility and unchanged data model. |
| 8 | Out-of-Scope hard forbidden work | Constraint | Block schema migrations, credential-storage changes, SSH, GitHub Apps, multi-repo work, and §8. |
| 9 | Architectural Notes | Hybrid | Constrain implementation files, state shape, helper design, disclosure pattern, keyboard behavior, and test strategy. |
| 10 | Commit Discipline and PO closeout | Constraint | Enforce commit/push discipline and final report format. |
| 11 | End of directive | Reference | Confirms no additional hidden directive content follows. |

## Phase C — Structured Constraint Extraction

The following hard rules are extracted as `PORTAL-P3-S1A-FU-04-HR-XX` constraints. These constraints govern all implementation and validation work for this session.

| Constraint ID | Rule Text | Applies To |
|---|---|---|
| PORTAL-P3-S1A-FU-04-HR-01 | Produce `.taskmaster/docs/ingestion-evidence/PORTAL_PHASE_3_DIRECTIVE-S1A-FU-04-ingestion.md` before claiming completion and before source-code changes. | Ingestion, planning, closeout |
| PORTAL-P3-S1A-FU-04-HR-02 | Extend the existing wizard scaffold in `client/src/pages/Home.tsx`; do not rewrite the wizard architecture. | Frontend implementation |
| PORTAL-P3-S1A-FU-04-HR-03 | Use conventional commits prefixed `[PORTAL-P3-S1A-FU-04-XX]` for in-scope work. | Git history |
| PORTAL-P3-S1A-FU-04-HR-04 | Out-of-scope discoveries require separate `[PORTAL-OOS-XX]` proposal commits and a stop for Product Owner approval. | Scope governance |
| PORTAL-P3-S1A-FU-04-HR-05 | Use behavioral tests, not source-string assertions, for invariant coverage. | Test strategy |
| PORTAL-P3-S1A-FU-04-HR-06 | Owner-facing wizard surfaces must use the directive’s plain-English vocabulary and must not expose the forbidden technical vocabulary, excluding the Diagnostics tab. | Wizard UI copy and tests |
| PORTAL-P3-S1A-FU-04-HR-07 | The GitHub token field must accept only an environment variable name; pasted token-looking values beginning with `ghp_`, `github_pat_`, `gho_`, `ghu_`, `ghs_`, or `ghr_` must be blocked with the exact structured error. | Token input validation |
| PORTAL-P3-S1A-FU-04-HR-08 | A successful connection test through the existing `buildTargets.testConnection` procedure is required before a Project can be saved. | Wizard state and backend interaction |
| PORTAL-P3-S1A-FU-04-HR-09 | Editing any wizard field after a successful connection test invalidates that test and disables Save until the test is re-run successfully. | Wizard state management |
| PORTAL-P3-S1A-FU-04-HR-10 | The connection test must map env-var-not-set, 401 authentication failure, and 404 repo-not-found-or-token-lacks-access into specific actionable plain-English messages. | Error handling |
| PORTAL-P3-S1A-FU-04-HR-11 | The token value itself must never be logged, displayed, stored, or transmitted to the UI; server logs may reference only the env var name. | Security and privacy |
| PORTAL-P3-S1A-FU-04-HR-12 | Invalid repository URL errors must be plain-English and actionable, including exact messages for empty input and missing `https://github.com/` prefix. | Validation UX |
| PORTAL-P3-S1A-FU-04-HR-13 | LLM-driven repo analysis, advanced agent env var map configuration, governance file list editing, and protected branch list access must be preserved. | Backward compatibility |
| PORTAL-P3-S1A-FU-04-HR-14 | Advanced settings may be moved into a clearly marked optional disclosure that defaults closed; this relocation must not remove existing functionality. | Frontend architecture |
| PORTAL-P3-S1A-FU-04-HR-15 | The wizard must remain keyboard accessible for logical Tab order, Enter activation, and Escape disclosure/wizard closing behavior. | Accessibility |
| PORTAL-P3-S1A-FU-04-HR-16 | Successful save must display exactly “Your Project is connected. You can start a new task whenever you’re ready.” and must not expose internal IDs. | Success state UX |
| PORTAL-P3-S1A-FU-04-HR-17 | The data model is unchanged; no schema migrations, no `pnpm db:push`, no rename or semantic change to `buildTargets.githubTokenEnvVar`. | Database and persistence |
| PORTAL-P3-S1A-FU-04-HR-18 | Authentication scope is PAT-only; SSH keys and GitHub Apps are explicitly forbidden. | GitHub integration |
| PORTAL-P3-S1A-FU-04-HR-19 | Do not modify credential storage; tokens stay in Manus environment variables, never in the database and never in owner-facing UI. | Security and persistence |
| PORTAL-P3-S1A-FU-04-HR-20 | Do not begin §8 Composer Queue work and do not declare Phase 3 complete after this task; hold for Product Owner sign-off at §1A-FU-04 acceptance. | Scope and delivery |
| PORTAL-P3-S1A-FU-04-HR-21 | Do not modify the underlying LLM-driven repo analysis logic from §1A; only adjust how wizard output and flow are presented. | Backend/frontend behavior |
| PORTAL-P3-S1A-FU-04-HR-22 | Required validation gates are `pnpm check`, focused Home behavior tests, focused Section 1 build-target contract tests, full `pnpm test --run`, and `pnpm build`. | Validation |
| PORTAL-P3-S1A-FU-04-HR-23 | Total test count must grow by at least ten, one per INV-S1A-FU-04-XX invariant, while preserving existing tests. | Test coverage |
| PORTAL-P3-S1A-FU-04-HR-24 | Push to the working branch only after ingestion evidence, all ten invariant tests, acceptance criteria, and validation gates pass locally. | Git and delivery |

## Phase C — Invariant Task Landscape

No full-document `parse-prd` operation was used. The directive already supplies a fixed, bounded ten-invariant task landscape, so the implementation plan is derived directly from those source invariants and the architectural notes instead of relying on lossy automated parsing.

| Invariant Task | Source Invariant | Implementation Target(s) | Behavioral Test Target |
|---|---|---|---|
| S1A-FU-04-T01 | INV-S1A-FU-04-01 | Replace owner-facing wizard labels, placeholders, button labels, and help text with required plain-English copy in `client/src/pages/Home.tsx`; exclude Diagnostics from forbidden scan. | Render wizard, clone rendered DOM excluding Diagnostics tab, assert required strings present and forbidden strings absent. |
| S1A-FU-04-T02 | INV-S1A-FU-04-02 | Add token-looking prefix detection for the token env-var-name field and disable Save while invalid. | Type `ghp_abc123...`, assert exact error and disabled Save until corrected. |
| S1A-FU-04-T03 | INV-S1A-FU-04-03 | Wire “Test the connection” button to `buildTargets.testConnection` with repo URL, env var name, and base branch; display success/failure result. | Mock success and failure cases; assert “Connected. Read access confirmed.” or mapped error text. |
| S1A-FU-04-T04 | INV-S1A-FU-04-04 | Track successful test in ephemeral wizard state and reset it whenever any relevant field changes. | Assert Save disabled before test, enabled after successful test, and disabled after repo URL edit. |
| S1A-FU-04-T05 | INV-S1A-FU-04-05 | Centralize owner-facing connection-test error mapping for env-var-not-set, 401, and 404 failure modes. | Mock each failure type and assert the corresponding actionable plain-English message appears. |
| S1A-FU-04-T06 | INV-S1A-FU-04-06 | Ensure server and UI never echo token values; use env var names only in logs/errors and sanitize failure display. | Inject known token value in a failure path and assert logs and DOM do not contain the token substring. |
| S1A-FU-04-T07 | INV-S1A-FU-04-07 | Add plain-English validation for empty repo link and missing `https://github.com/` prefix. | Type invalid variants and assert exact expected messages. |
| S1A-FU-04-T08 | INV-S1A-FU-04-08 | Preserve LLM-driven repo analysis and relocate advanced agent env var map, governance file list, and protected branches into optional advanced settings if needed. | Render wizard, verify default basic fields, expand “Advanced settings (optional),” and assert advanced editors remain accessible. |
| S1A-FU-04-T09 | INV-S1A-FU-04-09 | Maintain logical form order and add explicit key handlers only if native behavior is insufficient. | Simulate keyboard navigation, Enter activation of focused button, and Escape closing open disclosure. |
| S1A-FU-04-T10 | INV-S1A-FU-04-10 | Replace save success confirmation with exact required plain-English message and suppress internal IDs. | Mock successful save and assert exact success text appears with no internal ID leakage. |

## Phase D — Forward Traceability Coverage Map

Every source section has either generated implementation tasks, supplied hard constraints for those tasks, or been classified as reference/context. There are no unhandled source sections.

| Section # | Source Section | Generated Task(s) / Constraint(s) | Coverage Status |
|---:|---|---|---|
| 1 | Directive title, authorization, repository, branch, phase context | HR-18, HR-20, HR-24; all S1A-FU-04 tasks scoped to branch and PAT-only follow-up | COVERED |
| 2 | Source-of-truth observations | T03, T06, T08; HR-06, HR-08, HR-11, HR-13 | COVERED |
| 3 | Execution Discipline | HR-01 through HR-05, HR-24 | COVERED |
| 4 | Plain-English Owner Standard vocabulary | T01, T07, T10; HR-06, HR-12, HR-16 | COVERED |
| 5 | Plain-English token help text | T01, T02; HR-07, HR-19 | COVERED |
| 6 | Hard Functional Invariants | T01 through T10 | COVERED |
| 7 | Functional Acceptance Criteria | T01 through T10; HR-17, HR-22, HR-23 | COVERED |
| 8 | Out-of-Scope hard forbidden work | HR-17 through HR-21 | COVERED |
| 9 | Architectural Notes | T01 through T09; HR-02, HR-07, HR-10, HR-14, HR-15 | COVERED |
| 10 | Commit Discipline and PO closeout | HR-03, HR-04, HR-22, HR-24; final report requirements | COVERED |
| 11 | End of directive | Scope boundary note; no additional work generated | COVERED |

## Phase E — Backward Traceability and Hallucination Check

Every planned implementation task traces to a specific directive invariant. No task below introduces SSH, GitHub Apps, schema changes, credential-storage changes, §8 Composer Queue work, or multi-repo support.

| Task ID | Task Title | Source Section / Invariant | Traceability Status |
|---|---|---|---|
| S1A-FU-04-T01 | Plain-English wizard vocabulary and forbidden-string coverage | Section 6, INV-S1A-FU-04-01; Section 4 vocabulary list | TRACED |
| S1A-FU-04-T02 | Token-looking pasted value rejection | Section 6, INV-S1A-FU-04-02; Section 9 token regex | TRACED |
| S1A-FU-04-T03 | Connection-test button and success/failure result | Section 6, INV-S1A-FU-04-03; Section 2 existing procedure observation | TRACED |
| S1A-FU-04-T04 | Save gating and re-test after edits | Section 6, INV-S1A-FU-04-04; Section 7 failure recovery | TRACED |
| S1A-FU-04-T05 | Three connection failure modes with actionable copy | Section 6, INV-S1A-FU-04-05; Section 9 error helper note | TRACED |
| S1A-FU-04-T06 | Token value secrecy in logs and UI | Section 6, INV-S1A-FU-04-06; Section 8 credential storage boundary | TRACED |
| S1A-FU-04-T07 | Plain-English repository URL validation | Section 6, INV-S1A-FU-04-07 | TRACED |
| S1A-FU-04-T08 | Preserve LLM analysis and advanced settings | Section 6, INV-S1A-FU-04-08; Section 9 advanced disclosure note | TRACED |
| S1A-FU-04-T09 | Keyboard accessibility | Section 6, INV-S1A-FU-04-09; Section 9 keyboard accessibility note | TRACED |
| S1A-FU-04-T10 | Plain-English save success confirmation | Section 6, INV-S1A-FU-04-10; Section 7 successful save criterion | TRACED |

**Hallucination check verdict:** **PASS**. The task landscape consists only of the ten directive invariants plus their extracted hard constraints. No invented feature scope is present.

## Phase F — Reconciliation Notes

The directive’s implementation landscape is the fixed set of ten INV-S1A-FU-04-XX invariants. No Taskmaster `parse-prd` call was run on the whole directive, and no Airtable write was performed during ingestion because the inherited Product Owner instruction prioritizes this single evidence artifact before implementation and does not authorize tracker repair or record creation in this step.

| Reconciliation Item | Status | Notes |
|---|---|---|
| Existing task scope | OBSERVED FROM INHERITED CONTEXT | §1A-FU-04 is already Product Owner-authorized as the active follow-up. |
| New task generation | MANUAL INVARIANT MAP | The ten directive-supplied invariants are the task landscape; no additional work items are introduced. |
| Airtable write | NOT PERFORMED | No explicit PO authorization was given for Airtable record creation or repair during this ingestion step. |
| Schema migration | FORBIDDEN | The directive requires unchanged data model and no buildTargets schema changes. |
| Out-of-scope stream §8 | BLOCKED | §8 Composer Queue directive remains out of scope and must not begin. |

## Completeness Gate Verdict

**Verdict:** **CONSERVATIVE PASS FOR §1A-FU-04 IMPLEMENTATION PLANNING**.

This verdict is conservative because it confirms zero orphan directive sections and zero hallucinated implementation tasks while also preserving the directive’s hard boundaries. The next implementation phase must remain limited to the ten invariant tasks above, PAT-only private repository verification through the existing `buildTargets.testConnection` path, owner-facing wizard copy polish, behavioral tests, and the listed validation gates. Any discovery requiring schema changes, SSH, GitHub Apps, credential-storage changes, §8 Composer Queue work, or unrelated LLM-provider work must become a separate `[PORTAL-OOS-XX]` proposal and stop for Product Owner approval.

## References

[1]: file:///home/ubuntu/upload/PORTALPHASE3DIRECTIVES1AFU04WIZARDPOLISH.pdf "PORTAL_PHASE_3_DIRECTIVE — §1A-FU-04 Project Setup Wizard Plain-English Polish + Private Repo Verification"
