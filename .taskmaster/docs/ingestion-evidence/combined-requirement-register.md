# Combined Requirement Register — Original Product Vision + WEBpORTAL Decisions

Author: **Manus AI**

Source evidence:

| Source | Evidence File | Read Coverage |
|---|---|---|
| Original Product Vision | `.taskmaster/docs/ingestion-evidence/original-product-vision-ingestion.md` | Full source read, line 1 through line 84. |
| WEBpORTAL Decision Document | `.taskmaster/docs/ingestion-evidence/WEBpORTAL-decision-ingestion.md` | Full extracted document read, line 1 through line 1009, paragraph IDs P001 through P229. |

## Register Use and Status Policy

This register is the authoritative pre-audit map of the product requirements extracted from the two uploaded source documents. Because the user explicitly required **“READ FILE FIRST, FIX LATER,”** this version does **not** make final implementation-completeness claims. The implementation status column is intentionally marked **Pending code audit** until the relevant source files are read and mapped against each requirement in the next phase.

After the implementation inspection, this same register must be updated so each row becomes **Implemented**, **Partial**, or **Missing**, with direct file/function/component evidence.

## Hard Product Invariants

The following requirements are not optional design preferences. They are cross-source invariants because they are repeated in both documents and directly define the product’s identity.

| Invariant | Requirement | Source Coverage |
|---|---|---|
| Translator-first product | The portal’s central job is two-way translation between owner English and technical coding/terminal execution, with plain-English results. | OPV-001 to OPV-003; WP-001, WP-007, WP-015 |
| Terminal hidden by default | The owner must not see a terminal, raw commands, or raw terminal output during normal use. A terminal can be revealed only through an explicit advanced action. | OPV-002, OPV-008, OPV-009; WP-001, WP-007, WP-018 |
| Orchestration over provider selection | The normal workflow must auto-route and orchestrate Claude/Kimi. Provider selection must not be the primary owner-facing workflow. | OPV-004, OPV-008; WP-002, WP-004, WP-013, WP-014 |
| One task thread | The owner experiences one scrollable Manus-like thread per task, containing the request, plan, approvals, execution summaries, review, and decisions. | OPV-007; WP-003, WP-006, WP-007, WP-015 |
| Global memory | Memory persists across tasks/projects/conversations and remains browsable/searchable/editable in plain English. | OPV-006, OPV-010; WP-008, WP-011, WP-012 |
| Task-scoped files plus master view | The current task has its own file browser, while a separate master file view should organize files across tasks. | OPV-005; WP-008, WP-010, WP-012 |
| Non-developer usability | The product must be usable by a non-developer owner and avoid programmer jargon, unexplained technical choices, and raw errors. | OPV-009, OPV-010; WP-020 to WP-022, WP-025 |

## Combined Traceable Requirements

| Register ID | Source Requirement IDs | Requirement | Acceptance Evidence Required During Audit | Current Implementation Status |
|---|---|---|---|---|
| CR-001 | OPV-001, OPV-002, OPV-003, WP-001 | The default product experience must be a two-way translator: owner English in, technical execution behind the scenes, plain-English plans/results/errors out. | UI copy and task flow show plain-English task entry, plan, status, completion, and error summaries. No normal workflow requires reading command output. | Pending code audit |
| CR-002 | OPV-002, OPV-008, OPV-009, WP-018 | The terminal must not be visible by default. It may only appear after an explicit action such as “Show me the terminal.” | Home/workspace UI initializes with terminal hidden; tests prove the terminal is absent by default and appears only after explicit toggle. | Pending code audit |
| CR-003 | OPV-008, WP-002, WP-013, WP-014 | Provider selection must not be a main-screen choice. AUTO orchestration is the default; overrides belong in Advanced or tag-based flows. | No primary provider dropdown or route selector appears in the normal task composer; any override is secondary and clearly labeled. | Pending code audit |
| CR-004 | OPV-004, WP-002, WP-003, WP-016, WP-017 | Claude and Kimi have separate orchestrated responsibilities. Claude handles planning/review/explanation through native Anthropic API if possible; Kimi handles build/code/test execution through Cloudflare Workers AI/OpenCode. | Backend routing code separates planner/reviewer and executor stages; environment gates match required credentials; task events record plan/build/review. | Pending code audit |
| CR-005 | WP-005, WP-006, WP-015 | Task flow must be request → Claude plan → owner approval → Kimi build → Claude review → owner decision, with optional change loop or rollback. | Task state model and UI expose plan, approval, build, review, decision, change, and rollback stages. | Pending code audit |
| CR-006 | OPV-007, WP-007, WP-015 | All CLI/execution activity that reaches the owner must be translated into real-time plain-English updates in a single scrollable thread. | Thread messages contain readable stage updates; raw logs are hidden or summarized; execution stream does not require terminal reading. | Pending code audit |
| CR-007 | WP-008, WP-009, WP-012 | The layout must be Manus-like: left sidebar with tasks, global memory, and Skills/MCP/API connections; center task thread; right collapsible task file system. | Home page has these three regions with readable, accessible controls and no clipping. | Pending code audit |
| CR-008 | OPV-006, WP-011 | Memory must be global, persistent, and organized into Decisions, Features, Research, and Past Tasks. | Data model and UI support global memory categories/views, search/browse, and editing or correction. | Pending code audit |
| CR-009 | OPV-006, WP-011 | Claude must be able to use global memory automatically when planning and reviewing. | Orchestration prompt/context assembly reads memory and passes it to planner/reviewer stages. | Pending code audit |
| CR-010 | OPV-005, WP-010, WP-012 | The current task’s file browser must show task-scoped files, and a master view must show all files across tasks organized by task. | UI and backend distinguish current-task files from all-task file browsing. | Pending code audit |
| CR-011 | OPV-005 | File browser must support browse, open/read, before-after change view, English change explanation, rollback, library promotion, and download. | File UI has explicit controls or documented missing states for each file capability. | Pending code audit |
| CR-012 | WP-018, WP-019, WP-020, WP-021, WP-022 | Credentials are global and owner-only. Missing required credentials must block task start and route to a simple Credentials Dashboard, without connection-test buttons in v1. | Backend credential status and UI dashboard exist; task creation/build path blocks on missing credentials with plain-English message. | Pending code audit |
| CR-013 | WP-015, WP-016, WP-017, WP-023 | Required credential values are Anthropic/Claude API key, Cloudflare Account ID, Cloudflare Workers AI API Token, with optional model defaults and Claude thinking settings. | Environment/config code checks these values without exposing secrets; defaults are visible/editable only where appropriate. | Pending code audit |
| CR-014 | OPV-009, WP-020, WP-022 | Technical failures must be translated into plain English, including whether the issue is credential-related and what the owner can do next. | Error handling code maps raw errors into owner-facing summaries and next-action prompts. | Pending code audit |
| CR-015 | OPV-007, WP-003, WP-006 | Owner checkpoints must be explicit: before starting, while working, when done, and if something breaks; owner approves handoffs and final outcomes. | UI thread includes approval controls and decision controls rather than silently running all steps. | Pending code audit |
| CR-016 | WP-005, WP-013 | Owner may use `#kimi` or `#claude` tags to override the normal orchestration path when needed. | Task input parsing or route override logic recognizes tags and still keeps the UI plain-English. | Pending code audit |
| CR-017 | OPV-005, OPV-006, WP-008 | Right-side surfaces must remain readable and accessible; navigation and file controls must not be clipped. | Browser/UI inspection confirms no clipped right sidebar controls across expected viewport sizes. | Pending code audit |
| CR-018 | OPV-010, WP-025 | The product must be assessed as a production-ready real orchestration MVP for a non-developer owner, not merely as a technical demo. | Validation includes TypeScript, tests, build, browser inspection, and requirement traceability. | Pending code audit |
| CR-019 | WP-023, WP-025 | Claude default target is Opus 4.7 with adaptive thinking and Standard Tier where supported; Kimi target is Kimi K2.6 through Cloudflare Workers AI. | API invocation code is audited for actual supported model/service-tier configuration and avoids false claims if unavailable. | Pending code audit |
| CR-020 | WP-024 | Historical GitHub deployment target was `viyo-ai/AI-API-Web-Portal-v2` main branch, but current work is in the managed Manus project unless the user explicitly asks for GitHub push/deploy work. | No action unless current user request reactivates GitHub deployment. | Pending current-user confirmation |

## Known Confirmed UI Gaps From Source Evidence Alone

The source documents alone already confirm that the following user-reported defects are valid targets for later implementation work. These are not final implementation statuses, because the code audit still needs to attach exact file evidence, but they are direct requirement conflicts if present in the running UI.

| Confirmed Gap Candidate | Requirement Conflict | Next Audit Target |
|---|---|---|
| Visible shell terminal in the default owner view | Conflicts with CR-002 and the repeated no-terminal-default requirement. | `client/src/pages/Home.tsx`, `client/src/components/TerminalPanel.tsx`, related tests. |
| Confusing “Chat Wrapper” or implementation-centric language | Conflicts with CR-001 and CR-018. | Home page copy, task thread labels, test expectations. |
| Right sidebar navigation/control clipping | Conflicts with CR-017 and task-scoped file browser usability. | `client/src/pages/Home.tsx`, `client/src/components/FilesystemPanel.tsx`, browser preview. |

## Next Required Step

The next phase must read the implementation files and update this register with actual evidence-backed statuses. The minimum code evidence set is `Home.tsx`, `TerminalPanel.tsx`, `FilesystemPanel.tsx`, `server/routers.ts`, and the orchestration/backend files needed to evaluate Claude/Kimi routing and credential behavior. Only after this register is updated with implemented/partial/missing statuses should code fixes begin.
