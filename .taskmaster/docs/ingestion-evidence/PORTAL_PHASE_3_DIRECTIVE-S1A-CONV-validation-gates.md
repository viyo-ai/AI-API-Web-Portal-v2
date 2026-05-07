# §1A-CONV Validation Gates

Generated: 2026-05-07.

This evidence file records the seven validation gates and closeout proofs required for **§1A-CONV Conversational Project Onboarding**. Commands were run from `/home/ubuntu/ai-coding-workshop-permanent` after the focused contract alignment fixes, token-prefix fixture rewrite, and final full-suite validation.

| Gate | Requirement | Command / Proof | Final Result | Evidence Notes |
|---|---|---|---|---|
| 1 | Directive ingestion, invariant coverage, additive migration, and live table presence | `test -f .taskmaster/docs/ingestion-evidence/PORTAL_PHASE_3_DIRECTIVE-S1A-CONV-ingestion.md`; invariant grep/count; migration shape grep; database `SHOW TABLES LIKE 'project_memory'` verification | PASS | Ingestion evidence exists. Ten `INV-S1A-CONV-XX` invariants are mapped. `0013_project_memory.sql` creates only `project_memory` plus indexes. Live database table presence was verified with one matching row. |
| 2 | TypeScript/project static check | `pnpm check` | PASS | `tsc --noEmit` completed with no errors. |
| 3 | Focused §1A-CONV behavior and contract tests | `pnpm vitest run server/section1a-conv.contract.test.ts client/src/pages/Home.behavior.test.tsx` | PASS | Final focused run passed `2` files and `63` tests. Coverage includes Architect prompt/routing, token redaction, additive memory schema, scoped project-memory helpers, conversational onboarding UI, credentials drawer, task rename/sort, memory viewer, and Advanced Setup reachability. |
| 4 | Full Vitest suite | `pnpm test --run` | PASS | Final full-suite run passed `25` files and `160` tests. |
| 5 | Production build | `pnpm build` | PASS | Vite and server bundle completed successfully. Vite emitted pre-existing chunk-size warnings but returned success. |
| 6 | Token-prefix grep verification | Precision grep over §1A-CONV source set for provider token prefixes including `ghp_`, `github_pat_`, `gho_`, `ghu_`, `ghs_`, `ghr_`, `sk-`, bearer strings, Slack token prefixes, and Google API-key prefixes | PASS | Final proof line: `TOKEN PREFIX GREP: PASS - no raw token prefixes detected in §1A-CONV source set`. Test fixtures were rewritten to construct token-like values at runtime so source grep remains clean without weakening token-safety coverage. |
| 7 | Diff sanity, dependency proof, backend/schema scope proof, and environment health | `git diff --check`; `git diff -- package.json pnpm-lock.yaml`; backend/drizzle diff review; managed project health check | PASS | `git diff --check` produced no output. Dependency diff is empty. Backend/schema changes are limited to Architect module/prompts, focused router/db procedures, focused tests, and additive `project_memory` schema/migration. Managed project status check completed successfully before closeout. |

## Closeout Proofs

| Proof | Result | Evidence |
|---|---|---|
| Token-prefix grep proof | PASS | `/tmp/s1a-conv-token-grep.out` recorded the final pass line with no matching source files. |
| Dependency diff | PASS | `git diff -- package.json pnpm-lock.yaml` was empty; no new provider or package was added. |
| Additive schema proof | PASS | `drizzle/0013_project_memory.sql` creates only `project_memory` and its indexes; `drizzle/schema.ts` adds `projectMemory` and related types without modifying existing table definitions. |
| Per-project isolation proof | PASS | `server/section1a-conv.contract.test.ts` covers scoped project-memory helpers with separate build targets and no cross-project leakage. |
| Prompt disclosure proof | PASS | `server/prompts/architect.system.md` and `server/prompts/architect.intent.md` are committed prompt artifacts and are reproduced in the Product Owner closeout package. |
| Test-count proof | PASS | Final suite count is `160` tests; focused §1A-CONV coverage adds at least ten invariant-mapped behavioral/contract assertions plus integration coverage for the conversational UI path. |

## Non-Pass Observations

No validation gate is open. A production-build chunk-size warning remains from the existing application bundle shape and did not block build success. No out-of-scope proposal commit was required.

## Authenticated Browser Visual Evidence

A managed browser inspection of the authenticated preview confirmed the core §1A-CONV surfaces are present in the live UI: the existing form wizard remains visible as Advanced Setup, the center thread includes the Architect-in-Portal onboarding card, the Credentials drawer triggers are visible, the task list exposes Rename and most-recent sorting, Project Memory is scoped to the selected project state, and the Task Inspector still includes the Diagnostics tab unchanged. This browser inspection is the authenticated visual source of truth for the screenshot closeout package.
