# Original Product Vision — Full No-Skim Ingestion Record

Source file: `/home/ubuntu/upload/OroginalProductVision.txt`
Read status: **Full file read from line 1 through line 84.**

## Document Identity

The document defines **My AI Coding Workshop** as a portal whose central job is a two-way translator between the owner’s plain English and terminal/code work. The core product is not framed as a developer terminal, command console, or raw coding cockpit; it is framed as a human-language wrapper over technical execution, visible files, persistent memory, and safety checkpoints.

## Line-Referenced Requirement Extraction

| ID | Source Lines | Requirement / Decision | Implementation Implication To Audit Later |
|---|---:|---|---|
| OPV-001 | 1-4 | The product is “My AI Coding Workshop,” and the most important job is the wrapper that translates owner words into terminal code and translates terminal replies back into human language while remembering everything and showing files. | The main UI must emphasize human-language task requests, translated outcomes, memory, and file visibility rather than raw terminal-first operation. |
| OPV-002 | 5-9 | The unique product promise is a **two-way translator**. The owner never writes a command and never reads command output during normal use. | Raw terminal/command output must not be visible by default. The app must mediate commands and outputs through plain English. |
| OPV-003 | 11-19 | The portal translates incoming owner requests into technical instructions for OpenCode/Kimi/Claude and translates technical output or errors back into plain English, including one-click recovery language. | Task creation and execution flows must show plain-English plans, summaries, and error explanations; errors should include understandable next steps. |
| OPV-004 | 20-39 | Behind the scenes, Cloudflare Workers AI is envisioned as a single connection for Kimi K2 and Claude, with OpenCode configured once to use that connection. Kimi handles fast building; Claude handles careful thinking/review. | Provider plumbing should be hidden from normal users, configured once, and presented as simple status/advanced controls rather than exposed provider-management complexity. |
| OPV-005 | 41-52 | Files are always visible and owner-controlled. The owner can browse files by project, open files, see before/after changes, roll back changes, promote files to a cross-project library, and download files. | File browsing should be prominent and always available. Audit must distinguish implemented browse/open/download metadata from missing diff, rollback, library promotion, and full history. |
| OPV-006 | 54-70 | Memory persists across conversations, projects, tasks, and time. It stores decisions, conventions, fixes, names, and task history. It appears through a right-side drawer with views for Decisions, Features, Research, and Past Tasks. | Memory must be searchable/browsable/editable in plain English. A small “global memory” list is not the full requested memory drawer if it lacks views, search, edit, and cross-project continuity UX. |
| OPV-007 | 71-74 | The translator has four checkpoints: before starting, while working, when done, and if something breaks. Each checkpoint is translated into English. | The task thread must show English plan, status updates, completion summary, and human-readable failure recovery. |
| OPV-008 | 75-77 | Advanced controls are optional. A small Advanced toggle can allow manual Kimi/Claude choice. A “Show me the terminal” button can reveal OpenCode terminal only when requested. | The terminal must be hidden by default and gated behind an explicit owner action. Provider selection should be advanced/optional, not the default mental model. |
| OPV-009 | 78-80 | The owner should never see, by default, a terminal, unsolicited code, programmer error messages, config files, confusing technical choices, surprise bills, unexplained vanished files, or decisions they must remember unaided. | Default UI must avoid raw terminal panels, shell fallback labels, programmer jargon, and unexplained technical output. |
| OPV-010 | 81-84 | The bottom line reiterates translator + visible file system + never-forgetting memory as the usable product for a non-developer vision owner. | Final acceptance must evaluate the app against non-developer usability, not only technical feature wiring. |

## Explicit Visual/UI Consequences Captured Before Code Audit

The product vision directly supports the user’s later screenshot feedback: a visible **Basic Shell Terminal** in the normal right-side view conflicts with lines 8, 16, 75-80. The wording around “Wrapper” must be owner-understandable because the vision describes a translator, not an internal implementation layer. The file browser and memory surfaces must be visible and usable, but not at the expense of clipped navigation or hidden controls.

## Read Completeness Statement

This ingestion record was produced after reading the full text file from line 1 through line 84. No implementation fixes are authorized from this record alone until the WEBpORTAL decision document is also fully ingested and the combined requirement register is created.
