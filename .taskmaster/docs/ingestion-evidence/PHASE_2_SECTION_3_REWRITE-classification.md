# PHASE_2_SECTION_3_REWRITE.md — Classification and Constraints

Source: `/home/ubuntu/upload/PHASE_2_SECTION_3_REWRITE.md`
Classification date: 2026-05-06

## Section Classification

| Section | Type | Downstream action for this session |
|---|---|---|
| Frontmatter and authority | Constraint | Treat as PO-authoritative source; do not override with the superseded original Section 3. |
| Why this rewrite | Hybrid | Preserve design rationale for later rewritten §3; apply §3A rationale immediately to existing UI. |
| Section 3 — Skills (Rewritten) | Work Item | Deferred until after §3A acceptance and PO review. Do not implement now. |
| 3.1 Schema additions | Work Item | Deferred to §3. Requires schema migration when §3 starts. |
| 3.2 Skill file format | Work Item | Deferred to §3. Requires parser/import/export behavior. |
| 3.3 Skills page UI | Work Item | Deferred to §3. Requires Manus-style card grid and navigation. |
| 3.4 The + Add dropdown | Work Item | Deferred to §3. Requires four creation paths. |
| 3.4.1 Build with AI | Work Item | Deferred to §3. Requires AI-guided modal and source metadata. |
| 3.4.2 Upload a skill | Work Item | Deferred to §3. Requires file/zip upload parser and duplicate handling. |
| 3.4.3 Add from official | Work Item | Deferred to §3. Requires catalog sub-page and fork/copy behavior. |
| 3.4.4 Import from GitHub | Work Item | Deferred to §3. Requires repo scanning/import flow and ephemeral private repo auth. |
| 3.5 Skill detail page | Work Item | Deferred to §3. Requires detail tabs, editor, and preview/fork actions. |
| 3.6 Per-task skill display | Work Item | Deferred to §3, except vocabulary labels are part of §3A if existing surfaces contain them. |
| 3.7 Official catalog | Work Item | Deferred to §3. Phase 2 catalog ships empty with UI surface. |
| 3.8 Auto-attachment, prompt injection, AI Activity logging | Hybrid | Mechanics deferred to §3, but label vocabulary informs §3A tests where existing AI Activity labels exist. |
| 3.9 Acceptance for Section 3 | Constraint | Acceptance deferred; not used to expand §3A scope. |
| Section 3A — Plain-Language Vocabulary | Hybrid | Immediate implementation scope. Rename existing user-facing UI only; preserve internal code/API names. |
| 3A.1 Vocabulary rules | Constraint | Apply mapping and keep/hide rules to all existing Phase 1 and Phase 2 §2 surfaces. |
| 3A.2 Specific UI label changes | Work Item | Immediate §3A implementation. Exact label list drives code/test changes. |
| 3A.3 Acceptance for §3A | Constraint | Immediate acceptance gate. Tests must prove rendered UI excludes banned terms and existing tests still pass. |
| Section 4 — Phase 2 Closeout | Constraint | Execute order as §3A, then §3, then §1A; after §3A append build log, commit, push, stop. |
| Final note | Constraint | UI copy must be understandable to non-technical owners. |

## Extracted Constraints

| Constraint ID | Rule text | Applies to |
|---|---|---|
| S3R-C01 | `PHASE_2_SECTION_3_REWRITE.md` v1.0 supersedes Section 3 of `PORTAL_PHASE_2_DIRECTIVE.md` in full. | All future Section 3 work. |
| S3R-C02 | Execution order is §3A first, rewritten §3 second, and original §1A wizard third. | Current session and next Phase 2 sections. |
| S3R-C03 | Stop after each section acceptance, append to `portal-build-log.md`, commit, push, and wait for PO review. | §3A closeout and later §3/§1A closeouts. |
| S3R-C04 | §3A renames user-facing strings only; database tables, function names, internal types, and backend contracts stay unchanged. | §3A implementation. |
| S3R-C05 | Existing Section 3 work in progress that does not fit the card-grid/four-path design must be discarded; reusable pieces may be retained only if aligned. | Future §3 work; current §3A must not implement old Skills design. |
| S3R-C06 | No skills are pre-seeded; the official catalog starts empty in Phase 2. | Future §3 implementation. |
| S3R-C07 | User-facing vocabulary must use plain English or GitHub-native terms; pure plumbing terms must not surface. | §3A implementation and all future UI copy. |
| S3R-C08 | §3A acceptance requires a source/rendered UI check proving banned user-facing terms do not appear and existing tests still pass. | §3A validation. |
