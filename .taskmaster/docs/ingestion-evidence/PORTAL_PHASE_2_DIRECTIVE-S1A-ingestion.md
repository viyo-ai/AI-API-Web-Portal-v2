# PORTAL_PHASE_2_DIRECTIVE.md §1A Ingestion Evidence

## Section Index

### Directive overview and hard rules

The Phase 2 directive freezes the repository, scope, and execution order. It explicitly includes Section 1A as the LLM-driven setup wizard layer after Section 2 governance and Section 3 Skill Libraries, while forbidding Phase 1 refactors, provider/library switches, pre-seeded skills, Phase 3 features, skipped tests, and non-conventional commits without portal task IDs.

### Section 1A.1 — Wizard flow

The `+ Add Build Target` action must open a multi-step wizard while preserving the Phase 1 raw form behind an `Advanced setup` link. Step 1 collects display name, GitHub repo URL, and GitHub PAT env var name, then validates by calling the existing `buildTarget.testConnection` endpoint. Step 2 performs read-only repo analysis, sends structured repo context to Claude Opus 4.7 with adaptive thinking, and uses a 90-second timeout with a continue-waiting/manual-setup fallback. Step 3 renders six recommendation cards with approve/override controls. Step 4 persists approved/overridden values, triggers the branch clone/sync, cleans the temporary wizard clone, and opens the new Project workspace.

### Section 1A.2 — Caching the LLM analysis

The expensive Step 2 LLM result must be cached in a `wizardSessions` table keyed by owner, Repo URL, and clone-time commit SHA, with a 24-hour TTL. Re-running the wizard against the same repo at the same commit within the TTL should reuse the cached recommendation rather than invoking analysis again.

### Section 1A.3 — Fallback to Phase 1 form

If validation, clone, LLM, network, repo-size, or timeout problems prevent wizard completion, the UI must surface `Setup wizard couldn't complete. Switch to manual setup?` and keep the Phase 1 inline form fully functional as a fallback. The wizard list view must also expose an `Advanced setup` link for power users.

### Section 1A.4 — Acceptance

Acceptance requires the add action to open the wizard, Step 1 to classify validation failures and OK state, Step 2 to clone/analyze a representative repo with timeout behavior, Step 3 to render all six cards with inline override editors and the empty Project rule books explanation, Step 4 to persist approved plus overridden values, cached analysis reuse within 24 hours, manual fallback, and all existing Phase 1, Section 2, and Section 3 tests passing.

## Constraint Extraction

| Constraint ID | Rule Text | Applies To |
|---|---|---|
| PORTAL-P2-HR-01 | Do not refactor Phase 1 shipped features. | Wizard implementation and Build Target fallback |
| PORTAL-P2-HR-02 | Do not switch providers, libraries, or major dependencies. | LLM and frontend implementation |
| PORTAL-P2-HR-03 | Do not introduce project-specific naming or hardcoded governance paths. | Recommendation schema and persistence |
| PORTAL-P2-HR-04 | Do not implement Phase 3 features ahead of schedule. | Task tracker card captures only recommended type |
| PORTAL-P2-HR-05 | All tests must pass with no skipped tests. | Validation gate |
| PORTAL-P2-HR-06 | Use conventional commits with portal task IDs. | §1A closeout commit |

## Coverage Map

| Source Section | Implementation Coverage |
|---|---|
| §1A.1 Step 1 | Add Project setup wizard entry, validation against existing connection endpoint, §3A vocabulary labels |
| §1A.1 Step 2 | Add server-side repo snapshot and LLM recommendation contract, 90-second timeout/fallback behavior |
| §1A.1 Step 3 | Add six review cards with approve/override editors and empty Project rule books message |
| §1A.1 Step 4 | Persist approved/overridden Project fields and preserve existing manual fallback behavior |
| §1A.2 | Add wizard session schema/cache lookup by owner, Repo URL, and commit SHA with 24-hour TTL |
| §1A.3 | Preserve manual Phase 1 setup through Advanced setup and failure fallback |
| §1A.4 | Add focused contract/UI tests and run check/test/build |

## Verdict

PASSED for the current §1A task landscape. The remaining source sections from the Phase 2 directive are already accepted or explicitly out of scope for §1A; Phase 2 final closeout remains deferred until the Product Owner accepts §1A.
