# PHASE_2_SECTION_3_REWRITE.md — Coverage Map and Hallucination Check

Source: `/home/ubuntu/upload/PHASE_2_SECTION_3_REWRITE.md`
Coverage date: 2026-05-06

## Forward Traceability

| Section | Section title | Current task mapping | Coverage status |
|---|---|---|---|
| Frontmatter and authority | Authority metadata | Current §3A implementation must follow PO authority and repository target. | COVERED |
| Why this rewrite | Rationale | Current §3A applies owner-friendly language; rewritten §3 card-grid rationale is deferred by explicit PO order. | COVERED |
| Section 3 | Skills rewritten | Deferred until after §3A PO review. | DEFERRED BY PO ORDER |
| 3.1 | Schema additions | Deferred to §3. | DEFERRED BY PO ORDER |
| 3.2 | Skill file format | Deferred to §3. | DEFERRED BY PO ORDER |
| 3.3 | Skills page UI | Deferred to §3. | DEFERRED BY PO ORDER |
| 3.4 | + Add dropdown | Deferred to §3. | DEFERRED BY PO ORDER |
| 3.4.1 | Build with AI | Deferred to §3. | DEFERRED BY PO ORDER |
| 3.4.2 | Upload a skill | Deferred to §3. | DEFERRED BY PO ORDER |
| 3.4.3 | Add from official | Deferred to §3. | DEFERRED BY PO ORDER |
| 3.4.4 | Import from GitHub | Deferred to §3. | DEFERRED BY PO ORDER |
| 3.5 | Skill detail page | Deferred to §3. | DEFERRED BY PO ORDER |
| 3.6 | Per-task skill display | Deferred to §3, except vocabulary labels are covered if existing strings are present. | PARTIAL: §3A ONLY |
| 3.7 | Official catalog | Deferred to §3. | DEFERRED BY PO ORDER |
| 3.8 | Auto-attachment, prompt injection, AI Activity logging | Existing visible AI Activity labels are in §3A scope; new mechanics deferred to §3. | PARTIAL: §3A ONLY |
| 3.9 | Section 3 acceptance | Deferred to §3 acceptance. | DEFERRED BY PO ORDER |
| Section 3A | Plain-Language Vocabulary | Current implementation item: rename existing Phase 1 and Phase 2 §2 owner-facing UI labels only. | COVERED |
| 3A.1 | Vocabulary rules | Current implementation constraint: apply label mapping and hide plumbing terms in visible copy. | COVERED |
| 3A.2 | Specific UI label changes | Current implementation item: update left nav, project creation, Project Mode header, settings, AI Activity, skill chips if present, and toasts/errors in shipped UI. | COVERED |
| 3A.3 | §3A acceptance | Current validation item: existing tests pass and new rendered-UI banned-terms test exists. | COVERED |
| Section 4 | Phase 2 closeout | Current closeout item: append log, commit/push, and stop for PO review after §3A. | COVERED |
| Final note | Plain-English standard | Current UI copy standard: non-technical owner language. | COVERED |

## Backward Traceability and Scope Guard

| Planned action | Source section | Traceability status |
|---|---|---|
| Rename existing owner-facing Build Target labels to Project labels while preserving internal buildTarget code names. | §3A.1, §3A.2 | TRACED |
| Rename existing owner-facing governance labels to Project rule books labels while preserving internal governance loader/module names. | §3A.1, §3A.2 | TRACED |
| Hide or replace owner-facing plumbing labels such as workspace path, pre-push hook, conventional commit, token budget, and .env.agent where surfaced in UI copy. | §3A.1, §3A.2 | TRACED |
| Add or update tests proving banned terms are absent from rendered UI strings and existing tests still pass. | §3A.3 | TRACED |
| Append §3A closeout evidence, commit, push, and stop before rewritten §3 or §1A. | §4.1 | TRACED |
| Implement rewritten Skills card grid and four creation paths now. | §3, §4.1 | NOT IN CURRENT SCOPE — explicitly deferred until after PO review of §3A. |
| Implement §1A wizard now. | §4.1 | NOT IN CURRENT SCOPE — explicitly deferred until after rewritten §3 and its PO review. |

Verdict: PASSED for the current §3A-only task landscape. Deferred Section 3 and §1A items are not orphans; they are explicitly sequenced after §3A acceptance by the PO-provided execution order.
