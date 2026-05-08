# PORTAL_PHASE_3_DIRECTIVE — §1A-CONV-FU-05 Ingestion Evidence

**Author:** Manus AI  
**Source artifact:** `/home/ubuntu/upload/Pasted_content_21.txt`  
**Directive:** `PORTAL_PHASE_3_DIRECTIVE — §1A-CONV-FU-05 Wizard Defaults Normalization + UI Recovery Polish`  
**Ingestion timestamp:** 2026-05-08  
**Working branch requested:** `agent-work/s1a-conv-fu-05` cut from `agent-work/s1a-conv-fu-04` at `0606f38`  
**Conservative verdict:** **PASSED FOR IMPLEMENTATION**. The directive is internally consistent, contains three scoped implementation components, forbids schema/provider/dependency changes, and supplies eight verifiable invariants. No out-of-scope feature expansion is required.

> The Product Owner directive explicitly states: “Authorization status: Approved by Product Owner. Begin immediately.” This artifact therefore records source ingestion, constraints, and invariant coverage before implementation, while treating the directive itself as the PO approval to proceed after ingestion evidence is complete.

## 1. Section Index and Read-State Summary

| Section | Lines | Type | Summary |
|---|---:|---|---|
| Title and authorization | 1–8 | Hybrid | The document identifies FU-05 as a Phase 3 polish/fix bundle following FU-04 live QA. It authorizes immediate implementation and binds the work to repo `viyo-ai/AI-API-Web-Portal-v2`, working branch `agent-work/s1a-conv-fu-05`, and base `agent-work/s1a-conv-fu-04` at `0606f38`. |
| Critical boundaries | 11–21 | Constraint | The directive preserves the wizard and `buildTargets.completeWizard` flow, forbids chat-path changes, carries forward FU-04 and §9 approval-gate guarantees, keeps tokens in env vars, prohibits schema/provider/dependency changes, freezes Architect prompt files, and requires separate OOS proposal commits for out-of-scope discoveries. |
| Execution discipline | 24–30 | Constraint | The directive requires this ingestion evidence artifact before code changes, constraint IDs using `PORTAL-P3-S1A-CONV-FU-05-HR-XX`, implementation against eight invariants, conventional commits with FU-05 prefixes, and an inline closeout package in chat. |
| Scope inventory | 33–54 | Work Item | The directive defines three components: wizard default normalization, stale recovery-note suppression, and composer send-control stability. Each component is scoped to UI/input-layer behavior or UI rendering/accessibility, with no API-layer or schema change requested. |
| Hard functional invariants | 57–68 | Hybrid | Eight invariants define exact verification outcomes for branch defaulting, protected branch fallback, validation command fallback, chat-path non-regression proof, stale note suppression with audit retention, send button DOM attributes, keyboard send shortcut, and tab-order stability. |
| Validation gates | 72–81 | Constraint | Required gates include TypeScript checking, targeted section/Architect contract tests, new or extended wizard/composer behavior tests, full test suite, and production build. |
| Closeout package | 85–98 | Constraint | Delivery must include a commit URL, validation gate table, diffs for all three components, test-count delta and invariant mapping, token-prefix grep result, three prose answers, and the exact Phase 3 boundary statement. |
| Begin instruction | 102–104 | Constraint | The directive restates immediate implementation and asks for a Manus Project gate so the Product Owner can publish locally when complete. |

## 2. Extracted Hard Requirements and Constraints

| Constraint ID | Requirement | Applies To | Source Lines | Implementation Consequence |
|---|---|---|---:|---|
| PORTAL-P3-S1A-CONV-FU-05-HR-01 | Preserve the form wizard and `buildTargets.completeWizard` flow; fix defaults in the wizard UI only. | Wizard UI and tRPC submission layer | 11–14, 35–42 | Do not alter the backend completion procedure unless a test proves it is already broken independently of the directive. |
| PORTAL-P3-S1A-CONV-FU-05-HR-02 | Do not modify chat-path `buildTargets.create`; FU-01 byte-equal proof must remain unchanged. | Chat build-target creation path | 14, 64 | Keep code edits away from chat creation helpers and re-run or document the available proof. |
| PORTAL-P3-S1A-CONV-FU-05-HR-03 | Preserve FU-04 safety guarantees and the §9 approval gate. | Provider orchestration and approval UI | 15–16 | Do not change approval-state routing or provider execution policy. |
| PORTAL-P3-S1A-CONV-FU-05-HR-04 | Keep tokens in Manus env vars; do not expose or commit token values. | Secrets and repo changes | 17 | Use env-var names only; run a token-prefix grep in closeout. |
| PORTAL-P3-S1A-CONV-FU-05-HR-05 | No new schema, providers, or dependencies. | Database, provider layer, package manifest | 18 | Implement with existing TypeScript/React/test tooling. |
| PORTAL-P3-S1A-CONV-FU-05-HR-06 | `architect.system.md`, `architect.context.md`, and `architect.intent.md` are frozen. | Architect prompt/source files | 19 | Do not edit these files. |
| PORTAL-P3-S1A-CONV-FU-05-HR-07 | Out-of-scope discoveries require separate proposal commits and stop. | Scope control | 20 | Any unrelated issue found during implementation is logged but not fixed. |
| PORTAL-P3-S1A-CONV-FU-05-HR-08 | Produce this ingestion file before code changes. | Process evidence | 24–27 | This artifact is the first FU-05 implementation artifact. |
| PORTAL-P3-S1A-CONV-FU-05-HR-09 | Use conventional commits prefixed with `[PORTAL-P3-S1A-CONV-FU-05-XX]`. | Git commit | 28 | Commit message must include FU-05 prefix. |
| PORTAL-P3-S1A-CONV-FU-05-HR-10 | Deliver the complete closeout package inline in chat. | Delivery | 29, 85–98 | Final report must include all requested evidence and the full GitHub commit URL. |
| PORTAL-P3-S1A-CONV-FU-05-HR-11 | Default empty wizard branch to `agent-work/<sanitized-display-name>` and prepend `agent-work/` to explicit branch values missing the prefix, with inline note. | Wizard defaults | 35–42, 61 | Implement a deterministic helper at the wizard input layer. |
| PORTAL-P3-S1A-CONV-FU-05-HR-12 | Empty or invalid protected-branches input falls back to `[defaultBaseBranch]`. | Wizard defaults | 39, 62 | Use a tolerant parser that supports existing comma input and invalid JSON fallback. |
| PORTAL-P3-S1A-CONV-FU-05-HR-13 | Empty validation commands fall back to `pnpm check`, `pnpm test`, and `pnpm build`. | Wizard defaults | 40, 63 | Normalize before `completeWizardMutation.mutateAsync`. |
| PORTAL-P3-S1A-CONV-FU-05-HR-14 | Suppress stale provider failure notes only after a later successful assistant/review event for the same turn ID; keep audit records. | Thread rendering | 44–46, 65 | Implement UI filtering/suppression only. Do not delete events or mutate turn records. |
| PORTAL-P3-S1A-CONV-FU-05-HR-15 | Send button must have `data-testid="composer-send-button"` and `aria-label="Send message"`. | Composer accessibility | 47–52, 66 | Add stable DOM hooks and labels. |
| PORTAL-P3-S1A-CONV-FU-05-HR-16 | `Cmd/Ctrl+Enter` from the composer textarea sends the message and the button tooltip surfaces the shortcut. | Composer keyboard UX | 52, 67 | Extend existing Enter/Shift+Enter handling without breaking it. |
| PORTAL-P3-S1A-CONV-FU-05-HR-17 | Send-button tab order stays consistent across Files, AI Activity, Context, and Diagnostics tabs. | Composer and inspector layout | 53, 68 | Preserve DOM order and assert focus index stability in behavior coverage. |

## 3. Invariant Coverage Map

| Invariant | Source Lines | Component | Planned Implementation Surface | Planned Verification |
|---|---:|---|---|---|
| INV-FU-05-01 | 61 | Wizard defaults | Wizard branch normalization helper in `client/src/pages/Home.tsx` or extracted local helper without API changes. | Behavioral test verifies empty `initialBuildBranch` submits `agent-work/` plus sanitized display name. |
| INV-FU-05-02 | 62 | Wizard defaults | Protected branch parser/fallback before `completeWizardMutation.mutateAsync`. | Behavioral test verifies empty and invalid-JSON values fall back to `[defaultBaseBranch]`. |
| INV-FU-05-03 | 63 | Wizard defaults | Validation command parser/fallback before `completeWizardMutation.mutateAsync`. | Behavioral test verifies empty commands submit the canonical three-command list. |
| INV-FU-05-04 | 64 | Boundary proof | No edits to chat-path `buildTargets.create`; run the existing FU-01 proof or equivalent available test/query. | Closeout includes proof command/result or equivalent hash evidence. |
| INV-FU-05-05 | 65 | Recovery-note UI | Thread event rendering suppression when a later successful event shares the same turn ID. | Behavioral test asserts failure note hidden while the audit event/record remains present in mocked data. |
| INV-FU-05-06 | 66 | Composer accessibility | Composer send button DOM attributes. | DOM assertion test. |
| INV-FU-05-07 | 67 | Composer keyboard UX | Textarea keydown handler for `metaKey` or `ctrlKey` with Enter. | Behavioral test fires Ctrl/Cmd+Enter and asserts send mutation. |
| INV-FU-05-08 | 68 | Composer focus stability | Stable send-button placement and focusability across inspector tab toggles. | Behavioral test records relative focus index before and after tab switches. |

## 4. Backward Traceability and Hallucination Check

| Planned Work Item | Source Section | Traceability Status | Notes |
|---|---|---|---|
| Create ingestion evidence before code changes | Execution discipline | TRACED | Required explicitly by lines 24–27. |
| Normalize `initialBuildBranch` defaults and prefix handling | Component 1 and INV-FU-05-01 | TRACED | Required by lines 38 and 61. |
| Normalize `protectedBranches` defaults | Component 1 and INV-FU-05-02 | TRACED | Required by lines 39 and 62. |
| Normalize `validationCommands` defaults | Component 1 and INV-FU-05-03 | TRACED | Required by lines 40 and 63. |
| Preserve chat `buildTargets.create` record proof | Critical boundaries and INV-FU-05-04 | TRACED | Required by lines 14 and 64. |
| Suppress stale recovery-note UI only | Component 2 and INV-FU-05-05 | TRACED | Required by lines 44–46 and 65. |
| Add send-button test ID and aria label | Component 3 and INV-FU-05-06 | TRACED | Required by lines 50–51 and 66. |
| Add Cmd/Ctrl+Enter shortcut and tooltip | Component 3 and INV-FU-05-07 | TRACED | Required by lines 52 and 67. |
| Validate tab-order stability across inspector tabs | Component 3 and INV-FU-05-08 | TRACED | Required by lines 53 and 68. |
| Run required validation gates and closeout package | Validation gates and closeout package | TRACED | Required by lines 72–81 and 85–98. |

No planned work item lacks a source section. No additional features, schema changes, providers, dependencies, or Architect prompt-file edits are authorized by this directive.

## 5. Conservative Scope Verdict

The directive is implementable as a small, bounded, UI-focused correctness and accessibility fix. The backend API contract is a constraint, not a modification target. The highest-risk area is stale recovery-note suppression because the UI must hide stale owner-facing noise without erasing audit evidence; therefore the implementation will prefer a pure rendering predicate over any data mutation.

| Gate | Verdict | Rationale |
|---|---|---|
| Source read completeness | PASSED | Every section and line range was indexed and summarized. |
| Constraint extraction | PASSED | Seventeen hard requirements were extracted with FU-05 IDs. |
| Forward coverage | PASSED | All directive sections map to either a work item or an explicit process/boundary constraint. |
| Backward traceability | PASSED | Every planned work item traces to a directive section and invariant. |
| Out-of-scope risk | CONTROLLED | Any unrelated issue will be logged as `[PORTAL-OOS-XX]` and not fixed in this commit. |
| Implementation authorization | PASSED | The directive states Product Owner approval and immediate start authorization. |

## 6. Implementation Guardrails

Implementation must avoid edits to `server/routers.ts` complete-wizard schema unless tests reveal a non-directive regression, avoid all chat-path `buildTargets.create` changes, avoid schema and dependency changes, and avoid the frozen Architect files. Validation evidence must distinguish tests actually run from tests skipped or unavailable. The final Product Owner message must include the exact boundary sentence requested in the directive.
