# Skill: Plain-English Owner Standard

**Skill ID:** `plain-english-owner-standard`
**Version:** 1.0
**Scope:** Universal — applies to every owner-facing surface in the Portal.

---

## When to Apply

Apply on every owner-facing surface:
- Chat messages from Claude or Kimi
- Error messages
- Status indicators
- Button labels
- File panel labels
- AI Activity event descriptions
- System notifications
- Toast messages
- Modal copy

**Exception:** the Diagnostics tab is exempted. Inside Diagnostics, technical labels are acceptable. The owner has explicitly opted into power-user view.

---

## Vocabulary Substitutions

| Don't say (technical) | Say (owner-facing) |
|---|---|
| Build Target | Project |
| Build Branch | working branch (rare; usually omit entirely) |
| governance file | Project file |
| agent env var map | (don't surface; internal only) |
| protected branch | (don't surface in normal flow; only acceptable in error context) |
| commit SHA | (omit; use timestamp instead — "saved 2 minutes ago") |
| stack trace | (never surface) |
| `/tmp/...` paths | (never surface) |
| HTTP 500, 502, 503 | "Something went wrong" + retry hint |
| race condition | (never surface; reword to "the system is doing two things at once") |
| token bucket exhausted | "Service is busy right now" |
| schema migration | (never surface; internal only) |
| foreign key violation | "I can't save this — the [related thing] doesn't exist" |
| WebSocket disconnect | "Lost connection. Reconnecting…" |
| TypeScript error | "I made a mistake in the code. Let me fix it." |

---

## Error Message Format

Three sentences maximum:

1. **What failed.** In plain words.
2. **Why.** Only if known and safe to share.
3. **What the owner can do.** Specific action: retry button, pick different option, contact support.

### Examples

**Bad:** `Error: ECONNREFUSED at fetch (api.anthropic.com:443) — token bucket exhausted (rate limit: 50/min)`

**Good:** *"I couldn't reach Claude just now. The service is busy. Try again in a minute, or pick Kimi instead."*

---

**Bad:** `UniqueConstraintViolation: duplicate key value violates unique constraint "tasks_owner_user_id_title_unique"`

**Good:** *"You already have a task with that name. Pick a different name to create a new one."*

---

**Bad:** `Error: Build Branch state transition invalid: cannot move from 'cloning' to 'pushed' without intermediate 'clean' state`

**Good:** *"Your workspace isn't ready yet. Wait a few seconds and try again."*

---

## Status Indicator Format

Verb in present tense, continuous form, plus plain object. End with ellipsis until done.

- "Setting up your workspace…"
- "Asking Claude…"
- "Saving your file…"
- "Pushing your changes…"
- "Done."

**Avoid:**
- "Initializing" (too formal)
- "Provisioning" (jargon)
- "Resolving dependencies" (jargon)
- "Mutating database state" (technical)
- "Bootstrapping" (jargon)
- "Reconciling" (jargon)

---

## Button Labels

Action verb + plain object.

**Use:**
- "Send"
- "Save"
- "Approve and continue"
- "Try again"
- "Cancel"
- "Delete this task"
- "Add a project"
- "Open"

**Avoid:**
- "Submit" (formal)
- "Execute" (technical)
- "Proceed" (formal)
- "Confirm operation" (technical)
- "Initialize" (jargon)
- "Acknowledge" (formal)
- "Dismiss" (formal — use "Close" or "OK")

---

## Confirmation Dialogs

When the owner is about to do something irreversible:

- **Title:** plain action verb in present tense — *"Delete this task?"*
- **Body:** explain what will happen, in plain words — *"This task and all its messages will be removed. You can't undo this."*
- **Confirm button:** the action verb + object — *"Delete task"*. Never just "Yes" or "OK".
- **Cancel button:** "Cancel" or "Keep it"

---

## AI Activity Event Descriptions

Each event surfaces a one-line description in plain English. Technical detail goes into the expandable "Technical details" disclosure.

| Event type | Plain-English description |
|---|---|
| `task_created` | "New task created." |
| `shared_context_prepared` | "AI coordinator assembled task thread, global memory, project files, and the current message for this turn." |
| `claude_plan_drafted` | "Claude prepared a plan." |
| `kimi_drafted_execution` | "Kimi drafted the implementation." |
| `claude_review_completed` | "Claude reviewed the work." |
| `governance_assembled` | "Project files were attached to this turn." |
| `governance_truncated` | "Project files were trimmed to fit." |
| `kimi_empty_response` | "Kimi didn't return anything. Switching to Claude." |
| `claude_refusal` | "Claude declined this request." |
| `provider_failure` | "[Provider name] couldn't respond." |

---

## Forbidden Phrases

Never use these in any owner-facing copy:

- "Mutation"
- "Procedure"
- "Endpoint"
- "Webhook"
- "Schema"
- "Migration"
- "Index" (database sense)
- "Foreign key"
- "Cascade"
- "Atomic"
- "Idempotent"
- "Eventual consistency"
- "Race condition"
- "Mutex"
- "Deadlock"
- "Buffer overflow"
- "Heap"
- "Stack trace"
- "Throw" (as in "throw an error")
- "Exception" (technical sense)
- "Promise" (JS/async sense)
- "Async" (technical sense)
- "Hash"
- "Salt"
- "JWT"
- "OAuth" (use "sign-in" or the provider name)
- "Bearer token"

---

## Diagnostics Tab Exemption

Inside the Diagnostics tab, technical labels are acceptable:
- "Pre-push hook installed at .git/hooks/pre-push" — OK
- "Workspace path: /tmp/ai-coding-workshop-build-targets/owner-42/target-7/branch-301" — OK
- "Token usage: 1,847 / 8,000" — OK

Even in Diagnostics, **secrets are still forbidden:**
- API key values (mask: `sk-...****`)
- Token values (mask: `cf_...****`)
- Full env var values (show variable name only)
- Authenticated repo URLs (use `redactRepoUrl` helper)

---

## Test Assertion

Behavioral tests for owner-facing surfaces should assert the rendered HTML does NOT contain forbidden vocabulary. Example:

```ts
const html = container.innerHTML.toLowerCase();
const forbidden = ["governance", "mutation", "rule book", "agent env var", "protected branch"];
for (const word of forbidden) {
  expect(html).not.toContain(word);
}
```

This test should run on every owner-facing component snapshot.
