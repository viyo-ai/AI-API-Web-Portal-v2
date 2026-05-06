# Browser Validation Notes

Date: 2026-05-06
Preview URL: https://3000-iqeee61l7ryw6x12rr1f0-51598878.us2.manus.computer/

The managed preview rendered the public AI Coding Workshop landing page for an unauthenticated browser session. The page title is "AI Coding Workshop" and the copy confirms Manus OAuth protection, a task-first Wrapper LLM workspace for Claude and Kimi, live tasks/global memory on the left, task thread in the center, task files on the right, explicit server-side credential gates, and no silent provider fallback.

The managed status screenshot also showed an authenticated workspace state with the three-panel layout, provider status chips for Claude and Kimi, live tasks, global memory, center task thread, and right-side task file/context panel.

## 2026-05-06 Post-Restart Validation

The live preview loaded successfully at `https://3000-iqeee61l7ryw6x12rr1f0-51598878.us2.manus.computer` after the dev-server restart. The previously reported stale export error for `orchestrateWithOpenAI` was no longer visible in the browser state or the managed health check output.

The selected task `Live wrapper smoke kimi 1778047972103` rendered a real Kimi response with the provider label **Kimi**, not `SYSTEM`. The response content was a TypeScript `add(a, b)` function code block, confirming Kimi output is displayed in the normal owner thread. The user message below it was labeled **You** and the technical history remained collapsed behind `Show technical details (3)`.

Both credential pills showed configured states: `claude: configured` and `kimi: configured`. The compact composer remained in place with route selector pills for `Auto (Default) dual`, `Kimi K2.6`, and `Claude Opus 4.7`, plus the inline hint `Enter sends · Shift+Enter adds a line`.

The right sidebar showed honest task-file empty-state text and guarded actions: `Record file metadata`, `Open real file`, `View AI changes`, `Rollback intent`, and `Promote to library`. The Global Memory section stated that durable memory is empty and will only populate after real records exist.

### Validation Caveats

The page currently includes existing smoke tasks, including one older Kimi smoke task in `error` status from before the provider parsing/restart fixes. Newer smoke tasks show active status and real Claude/Kimi outputs. Manual browser typing for new #claude/#kimi overrides still needs to be completed or replaced with an authenticated automated UI flow before final delivery.

## 2026-05-06 Auto Planning Route Browser Validation

A new task titled `Browser validation routing 1778048300` was created from the left-panel task title field. In Auto mode, the message `I need help planning a project architecture for a small task-tracking app. Please outline the core modules and risks.` was submitted successfully. The thread returned a real **Claude** response, not a recovery note or `SYSTEM` label. The response included an execution plan for task-tracking app architecture, objective, plan, risks, acceptance checks, routing decision, and non-blocking inputs.

The task stayed active, credential chips remained `claude: configured` and `kimi: configured`, the owner message was shown as **You**, and the technical records remained hidden behind `Show technical details (5)`. This confirms the stale `orchestrateWithOpenAI` export cache issue is cleared for the browser path and architecture/planning input routes to Claude.

## 2026-05-06 Auto Code Route Submission Attempt

A second Auto-mode prompt was prepared in the center composer: `Write a TypeScript function slugifyTitle(input: string): string. Respond with only the code block.` The browser automation populated the textarea, but the most recent visible snapshot still showed the prompt in the composer and did not yet show a submitted **You** turn or Kimi response. The send button appeared visually available in the lower-right composer area, but it was not represented as a separate indexed element in the automation snapshot.

## 2026-05-06 Auto Code Route Browser Validation

The Auto-mode code prompt `Write a TypeScript function slugifyTitle(input: string): string. Respond with only the code block.` submitted successfully after the browser snapshot refreshed. The thread showed a real **Kimi** response containing a TypeScript `slugifyTitle` implementation in a code block. The response was not labeled `SYSTEM`, the submitted message appeared as **You**, and the task remained active with `Show technical details (9)`. This confirms code-oriented Auto routing reaches Kimi through the live browser flow.

## 2026-05-06 Manual Kimi Override Preparation

The **Kimi K2.6** manual provider toggle was selected in the center composer. A direct-provider validation prompt was entered: `Manual Kimi check: return only a one-line TypeScript constant named provider with value "kimi".` At the latest captured state, the prompt was visible in the composer and ready for submission; no direct manual Kimi result had appeared yet.

## 2026-05-06 Manual Kimi Override Submission Attempt

After selecting **Kimi K2.6**, pressing Enter did not submit the direct-provider prompt from the current automation focus state. A coordinate click against the visible send control also failed because the page snapshot changed before the click could be applied. The prompt remained visible in the composer in the last captured state. Auto-mode Kimi validation is already confirmed; manual override validation still needs an updated snapshot or alternate keyboard path.

## 2026-05-06 Manual Kimi Override Browser Validation

The **Kimi K2.6** manual provider selector submitted successfully. The prompt `Manual Kimi check: return only a one-line TypeScript constant named provider with value "kimi".` produced a real **Kimi** response with:

```typescript
const provider = "kimi";
```

The message was displayed as **You**, the response was provider-labeled **Kimi**, and technical history stayed collapsed behind `Show technical details (13)`. This confirms the manual Kimi override path works in the live browser UI.

## 2026-05-06 Manual Claude Override Preparation

The **Claude Opus 4.7** manual provider selector was selected in the center composer. A direct-provider validation prompt was entered: `Manual Claude check: briefly explain why architecture planning belongs to Claude. Keep it to one sentence.` The last captured state showed the prompt visible in the composer and ready for submission; the browser had not yet displayed the resulting Claude turn.

## 2026-05-06 Manual Claude Override Browser Validation

The **Claude Opus 4.7** manual provider selector submitted successfully. The prompt `Manual Claude check: briefly explain why architecture planning belongs to Claude. Keep it to one sentence.` produced a real **Claude** response headed `Plan: Manual Claude Routing Check`, with explicit routing text stating `Claude only` and `Do not invoke Kimi`. The response was displayed as provider-labeled **Claude**, the submitted message appeared as **You**, and technical history remained hidden behind `Show technical details (17)`. This confirms the manual Claude override path works in the live browser UI.

## 2026-05-06 Claude Recovery Interjection Verification

Focused regression coverage passed for the empty-Kimi-output recovery path:

```text
pnpm vitest run server/aiRouting.cloudflare-fallback.test.ts client/src/pages/Home.behavior.test.tsx --reporter=dot
Test Files  2 passed (2)
Tests       20 passed (20)
```

The server regression confirms empty Kimi output is treated as `MODEL_EXECUTION_FAILED`, stores owner-friendly recovery guidance that begins `Kimi did not return usable text`, preserves raw diagnostic metadata (`Kimi returned an empty response`), and does not complete the turn as a normal successful answer. The UI regression confirms the task thread surfaces the recovery note while keeping raw diagnostics behind technical details.

## 2026-05-06 Actual `#claude` Tag Override Browser Validation

With **Auto (Default)** selected, the prompt `#claude Tag override validation: explain in one sentence why long-context architecture review should use Claude.` submitted successfully through the live UI after using the composer keyboard submission path. The visible owner thread stripped the tag from the user-facing message and showed the resulting assistant response as provider-labeled **Claude**, with a long-context architecture review rationale and explicit statement that Kimi was not involved. This validates the actual text-tag override path for `#claude` in the browser.

## 2026-05-06 Actual `#kimi` Tag Override Browser Validation

With **Auto (Default)** selected, the prompt `#kimi Tag override validation: return only a TypeScript const named tagProvider with value "kimi".` submitted successfully through the live UI. The visible owner thread stripped the tag from the user-facing message and showed the assistant response as provider-labeled **Kimi**, returning:

```typescript
const tagProvider = "kimi";
```

This validates the actual text-tag override path for `#kimi` in the browser and confirms that tag-driven routing works for both approved providers in addition to the manual route selector.

## 2026-05-06 Final Automated Validation

The final validation suite passed before checkpointing:

```text
pnpm check
pnpm vitest run server/workspace.security.test.ts --reporter=dot
pnpm test
pnpm build

Focused global-memory/workspace security suite: server/workspace.security.test.ts passed 11 tests.
Full regression suite: 14 test files passed, 57 tests passed.
Production build: Vite build and server bundle completed successfully.
```

The focused workspace security suite now includes global-memory procedure coverage for owner-scoped create/list/search behavior and source-task ownership enforcement. The live browser validation already confirmed the left-panel Global Memory empty state is accessible and honest when no durable records exist.

The production build completed with the existing Vite warning that the main client chunk exceeds 500 kB after minification. This is a performance follow-up rather than a functional build failure.

## 2026-05-06 Post-Scope Final Validation

After resolving the Opencode.ai scope-confirmation items as a documented future architecture decision rather than an implemented hidden execution feature, the project was validated again:

```text
pnpm check
pnpm test
pnpm build

Full regression suite: 14 test files passed, 57 tests passed.
Production build: Vite build and server bundle completed successfully.
```

The remaining Vite large-chunk warning is unchanged and remains a performance optimization follow-up, not a failing validation gate.
