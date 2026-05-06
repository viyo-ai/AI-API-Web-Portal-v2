# Portal Build Directive — Phase 1: Core Build Runner

**Version:** 1.0 (FROZEN)
**Date:** 2026-05-06
**Repository:** `viyo-ai/AI-API-Web-Portal-v2`
**Latest reviewed commit:** `e01f66e` on `main`
**For:** Manus AI (executor)
**Authority:** Product Owner only
**Phase:** 1 of 3 (Phase 2 and 3 will follow as separate directives after Phase 1 acceptance)

---

## What this directive is

Phase 1 of three. Converts the portal from a coding-chat workspace into a system that can target external repositories, work on isolated branches with isolated environment variables, and let the owner queue messages while the agent generates.

**Phase 1 scope (this directive):**
- Section 1 — Build Targets (external repo support)
- Section 4 — Branch isolation, push policy, environment variable injection
- Section 8 — Composer queue + Stop behavior during generation

**Out of scope for Phase 1 (will arrive in Phase 2 and 3):**
- Per-task governance auto-load
- Skill libraries
- LLM-driven setup wizard
- Task tracker sync
- Run Next Task workflow
- Lifecycle states
- Novice UX affordances (error explainers, demo gate executor, smoke test, cost visibility)

After Phase 1, the portal can target an external repository. The agent can commit to an isolated branch. Owners can queue messages. That's the foundational plumbing. Phase 2 builds governance and skills on top. Phase 3 adds tracker sync, lifecycle, and novice UX.

---

## Hard rules — read before any code

1. **Do not refactor any feature shipped at commit `e01f66e`.** OAuth, three-panel layout, chat composer, Global Files, AI Activity, Claude Opus 4.7 with adaptive thinking, Kimi via Cloudflare Workers AI, OpenAI orchestration, drag-drop upload, left-nav layout, `#claude`/`#kimi` overrides — all stay as-is.
2. **Do not produce another audit document.** No "current state vs desired state" tables. No "Fortune 500 recommendations" markdown.
3. **Do not switch providers, libraries, or major dependencies.** Stay on Vite + React, Hono/Express, Drizzle, PostgreSQL, pnpm, Anthropic SDK, Cloudflare Workers AI, OpenAI SDK.
4. **Do not introduce project-specific naming, hardcoded project paths, or hardcoded governance file lists in the codebase.** All project-specific data is owner-configurable through the UI and stored in the database.
5. **Do not implement Phase 2 or Phase 3 features ahead of schedule.** Per-task governance auto-load, skill libraries, setup wizard, task tracker sync, run-next-task workflow — none of these exist in Phase 1. If you find yourself building toward them, stop.
6. **Do not store credentials in plaintext in the database.** Phase 1 uses environment variables in the portal's deployment environment (Render's environment variable management, accessed via `process.env.<VAR_NAME>`). Database stores only references to env var names, not values.
7. **All tests must pass.** No `it.skip()`, no `passWithNoTests`, no `// FIXME later`.
8. **Conventional commits with portal task IDs:** e.g., `feat(buildRunner): add buildTargets schema [PORTAL-P1-S1-01]`.

If you find yourself drifting toward a hard-rule violation: stop, log to `/portal-build-log.md`, continue with directive scope.

---

## Section 1 — Build Targets (generic external project support)

**Purpose:** Convert the portal from "everything is a portal task" to "the owner configures external Build Targets, and tasks can optionally be scoped to a Build Target's branch." Legacy chat tasks continue to work; Build Targets are additive.

### 1.1 Schema (`shared/schema.ts`)

Add to existing Drizzle schema. Do not modify existing tables except the explicit ALTER below.

```typescript
export const buildTargets = pgTable('build_targets', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => users.id),

  name: text('name').notNull(),
  // Owner-chosen display name. No assumption about what kind of project.

  repoUrl: text('repo_url').notNull(),
  defaultBaseBranch: text('default_base_branch').notNull().default('main'),
  // The branch agent branches fork from.
  // Default is 'main' (simple two-branch model for pre-MVP projects).
  // Owner can change to 'staging' or any other branch.

  workspaceRootPath: text('workspace_root_path').notNull(),
  // Where the portal clones this target's repo on the server filesystem.
  // e.g. /var/portal-workspaces/{ownerId}/{buildTargetId}

  githubTokenEnvVar: text('github_token_env_var').notNull(),
  // Name of the env var holding this target's GitHub PAT.
  // e.g. 'BUILD_TARGET_VIYO_GITHUB_TOKEN'
  // The portal reads process.env[githubTokenEnvVar] when needed.
  // The actual token value is set in Render's environment variable
  // management, never in the database.

  protectedBranches: text('protected_branches').array().notNull().default(sql`ARRAY['main','staging']`),
  // Branches the pre-push hook must block. Defaults are sensible — owner can
  // adjust per target.

  // Service isolation health checks (Phase 1: declared but not auto-verified;
  // verification UI lands in Phase 3 novice UX)
  serviceChecks: jsonb('service_checks').notNull().default('[]'),
  // Schema:
  // [
  //   { type: 'github_branch_protection', branches: ['main'] },
  //   { type: 'vercel_production_branch', value: 'main' },
  //   ... extensible
  // ]

  // Validation commands run before push. Owner can override defaults.
  validationCommands: jsonb('validation_commands').notNull().default('[]'),
  // Schema: [ { name: string, command: string, required: boolean } ]
  // If empty array: portal uses sensible defaults at runtime:
  //   [{ name: 'check', command: 'pnpm check', required: true },
  //    { name: 'test', command: 'pnpm test --bail', required: true },
  //    { name: 'build', command: 'pnpm build', required: true }]

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const buildBranches = pgTable('build_branches', {
  id: uuid('id').primaryKey().defaultRandom(),
  buildTargetId: uuid('build_target_id').notNull()
    .references(() => buildTargets.id, { onDelete: 'cascade' }),

  branchName: text('branch_name').notNull(),
  // e.g. 'agent-work/<owner-named-slug>' — owner provides at branch creation
  baseBranch: text('base_branch').notNull(),
  // The branch this was forked from

  state: text('state').notNull().default('clean'),
  // 'clean' | 'cloning' | 'working' | 'committing' | 'pushing' | 'error'
  // Phase 1 implements clean | cloning | error transitions only.
  // Phase 3 expands the state machine with full lifecycle.
  errorMessage: text('error_message'),

  lastSyncedCommit: text('last_synced_commit'),
  workspacePath: text('workspace_path').notNull(),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Add to existing tasks table
ALTER TABLE tasks ADD COLUMN build_branch_id uuid REFERENCES build_branches(id);
// Nullable. NULL = legacy chat task, behavior unchanged.
// Non-null = Build Mode task.
```

### 1.2 Server module (`server/buildRunner.ts`)

Implement using `simple-git` (npm-compatible in this stack). Functions:

- `createBuildTarget(input)` — validates GitHub token (referenced via `githubTokenEnvVar`) can clone the repo. Persists row.
- `cloneOrSyncBranch(buildBranchId)` — ensures workspace at `workspacePath` is current. Creates branch from `baseBranch` if it doesn't exist on remote. Installs the `pre-push` hook (Section 4.5) on first clone.
- `getBranchStatus(buildBranchId)` — returns git state: branch name, ahead/behind count, working-tree clean state, last commit SHA.
- `commitChanges(buildBranchId, message, paths)` — stages specified paths, validates commit message format (Section 4.3), commits.
- `pushBranch(buildBranchId)` — runs validation suite (Section 4.2), pushes to origin only on success.
- `cleanupWorkspace(buildBranchId)` — deletes the workspace directory. Refuses if branch is mid-task.

Use `simple-git`'s SSH-via-HTTPS pattern: clone URL becomes `https://x-access-token:${process.env[githubTokenEnvVar]}@github.com/<owner>/<repo>.git`. This works for both public and private repos with one auth mechanism — no SSH keys needed.

### 1.3 tRPC router (`server/routers/buildTarget.ts`)

Endpoints:

- `buildTarget.create` — input includes name, repoUrl, githubTokenEnvVar (the env var name, not the value), defaultBaseBranch, optional protectedBranches, optional serviceChecks, optional validationCommands. Validates that `process.env[githubTokenEnvVar]` is defined and the token can clone the repo. Returns the persisted target.
- `buildTarget.list` — returns owner's targets.
- `buildTarget.update` — modify name, defaultBaseBranch, protectedBranches, serviceChecks, validationCommands. NOT githubTokenEnvVar (that requires a separate "rotate" flow in Phase 3).
- `buildTarget.delete` — cascading delete with confirmation (deletes all child branches' workspaces).
- `buildBranch.create` — input: buildTargetId, branchName, baseBranch (defaults to target's defaultBaseBranch). Spawns `cloneOrSyncBranch` async. Returns immediately with the branch row in `cloning` state. Updates to `clean` when clone completes.
- `buildBranch.list` — branches for a target.
- `buildBranch.getStatus` — current git status (cached for 30s to avoid hammering filesystem).
- `buildBranch.delete` — removes workspace and row.

### 1.4 UI surface

Add a top-level navigation item: **"Build Targets"** in the left panel, positioned above the existing "Tasks" section.

**List view** of Build Targets shows cards. Each card has:
- Target name (large)
- Repo URL (truncated, monospace, clickable to GitHub)
- Active branch with state pill (`clean` green, `cloning` yellow, `error` red)
- "Open" button (primary)
- "Settings" gear icon (opens settings page)

**Build Target creation form** (Phase 1 — manual; LLM wizard arrives in Phase 2):
- Name (required, free text)
- GitHub repo URL (required, validated as a GitHub URL)
- GitHub token env var name (required) — labeled clearly: *"The name of the environment variable in Render where you set this repo's GitHub PAT. e.g. `BUILD_TARGET_VIYO_GITHUB_TOKEN`. The token value itself never goes in this form — set it in Render."*
- Default base branch (required, default `main`) — with helper text: *"For new pre-MVP projects, use 'main'. For projects with a separate staging environment, use 'staging'."*
- Protected branches (optional, defaults `['main', 'staging']`) — chip input, owner adds/removes
- Validation commands (optional, leave empty for sensible defaults)
- Service checks (optional, leave empty for now)

**Build Target settings page** has the same fields as creation, plus:
- "Test connection" button — verifies the env var is set, the token works, the repo is accessible
- "Cleanup all branches" button (destructive) — removes all child workspaces

**When a Build Target is opened**, the workspace switches to **Build Mode**:
- Left panel: shows tasks scoped to this target's currently-active branch
- Center composer: gains an indicator banner above the composer: *"Build Mode: {target.name} on branch {branch.branchName}"*
- Right panel: shows files from the workspace filesystem at `workspacePath` (read-only file tree)
- Header bar: target name, current branch, current state pill

**When Build Target is not opened** (default state): legacy coding-chat mode, unchanged. Build Targets are purely additive — existing tasks continue to function identically.

### 1.5 Acceptance for Section 1

- [ ] Owner can create a Build Target with a public OR private repo URL
- [ ] Owner can create a Build Target without setting up SSH keys (HTTPS + token works for both public and private)
- [ ] Token is referenced by env var name in the form, never pasted into the form directly
- [ ] Cloning populates `workspacePath` with the full repo
- [ ] `git status` inside `workspacePath` shows clean state on a fresh clone
- [ ] `git remote -v` inside `workspacePath` shows origin pointing at the configured repo
- [ ] Build Target appears in left panel; opening it switches the workspace to Build Mode
- [ ] Closing the Build Target returns the workspace to legacy coding-chat mode
- [ ] Existing legacy tasks (without `build_branch_id`) continue to work unchanged in tests and behavior
- [ ] "Test connection" button correctly distinguishes: env var missing / token invalid / repo not accessible / all good
- [ ] All `buildTargets`, `buildBranches`, and `tasks` migrations apply without destructive data loss

---

## Section 4 — Branch Isolation, Push Policy, Environment Variable Injection

**Purpose:** Agent commits land on agent-managed branches with isolated environment variables. Production-like branches are protected from direct agent writes.

### 4.1 Branch model (configurable per target)

Per Build Target, the owner declares:
- `defaultBaseBranch`: which branch agent branches fork from
- `protectedBranches`: which branches the agent must NEVER push to

For a pre-MVP project (single environment): `defaultBaseBranch='main'`, `protectedBranches=['main']`. Agent works on `agent-work/<slug>` branches forked from `main`. When done, owner manually merges `agent-work/<slug>` → `main` via GitHub (Phase 2 will add a "merge to base branch" button; Phase 1 is manual GitHub).

For a staging-aware project: `defaultBaseBranch='staging'`, `protectedBranches=['main','staging']`. Agent works on `agent-work/<slug>` from `staging`. Owner merges `agent-work/<slug>` → `staging` after preview verified, then `staging` → `main` separately.

The portal does NOT prescribe one model. It supports both via configuration.

### 4.2 Push policy

After every agent commit:

1. `git pull --rebase origin <branch>` to pick up external changes
2. Run target's `validationCommands` array sequentially. If empty, use defaults: `pnpm check`, `pnpm test --bail`, `pnpm build`. Each required command must exit 0.
3. (Migration validation deferred to Phase 2 — Phase 1 doesn't run migrations against a sandbox; if the agent writes a migration, owner reviews manually before merge.)
4. If any required validation fails: `git reset --soft HEAD~1`, surface error in AI Activity, do NOT push. Branch stays in `error` state.
5. If all pass: `git push origin <branch>`. Branch state goes to `clean`.

### 4.3 Conventional commit enforcement

Regex: `^(feat|fix|chore|docs|refactor|test|build|perf|ci|style)\([^)]+\): .+ \[[A-Z0-9-]+\]$`

If a commit message doesn't match: portal rejects, agent is asked to retry with corrected message. The retry happens automatically — portal sends the agent: *"Last commit rejected. Conventional commit format required: `<type>(<scope>): <subject> [task-id]`. Please redo the commit with a valid message."*

### 4.4 Environment variable injection (`.env.agent` file)

When a workspace is provisioned, the portal writes a `.env.agent` file into `workspacePath`. The file contains environment variables specific to the agent's preview operations.

For Phase 1, the contents come from a **simple owner-declared mapping** stored on the Build Target:

```typescript
// Add to buildTargets schema:
agentEnvVarMap: jsonb('agent_env_var_map').notNull().default('{}'),
// Schema: { [agentEnvVarName: string]: string (env var name on portal server) }
// Example for VIYO:
// {
//   "DATABASE_URL": "BUILD_TARGET_VIYO_AGENT_DATABASE_URL",
//   "REDIS_URL": "BUILD_TARGET_VIYO_AGENT_REDIS_URL",
//   "ANTHROPIC_API_KEY": "ANTHROPIC_API_KEY"
// }
// At workspace provision time, portal writes:
// DATABASE_URL=<value of process.env.BUILD_TARGET_VIYO_AGENT_DATABASE_URL>
// etc.
```

The owner sets up the actual env var values in Render's dashboard. The portal reads them via `process.env[mappedName]` and writes them to `.env.agent` in the workspace.

**Critical rule:** the portal never injects production credentials. The owner must explicitly map `agentEnvVarMap` to point at preview-scoped env vars they've created in Render. The portal cannot enforce this — it's owner's responsibility to set sensible mappings. Phase 3 will add a wizard that helps owners distinguish preview vs production env vars.

The Build Target settings page has a UI for editing `agentEnvVarMap` — a key-value editor. Each row: agent env var name (left, e.g. `DATABASE_URL`), portal server env var name (right, e.g. `BUILD_TARGET_VIYO_AGENT_DATABASE_URL`). Owner can add, edit, delete rows.

### 4.5 Pre-push hook

Installed at workspace clone time as `.git/hooks/pre-push`:

```bash
#!/bin/sh
protected="<space-separated list from buildTargets.protectedBranches>"
remote="$1"
url="$2"
while read local_ref local_sha remote_ref remote_sha; do
  for branch in $protected; do
    if [ "$remote_ref" = "refs/heads/$branch" ]; then
      echo "ERROR: Direct push to protected branch '$branch' blocked by portal."
      exit 1
    fi
  done
done
exit 0
```

The hook is regenerated every clone using the target's current `protectedBranches` list. Made executable via `chmod +x`. The agent cannot bypass it without explicit `git push --no-verify`, which the portal's wrapper does not allow.

### 4.6 Acceptance for Section 4

- [ ] Agent commits land on the configured agent branch, never on protected branches
- [ ] Pre-push hook is installed at workspace clone and prevents pushes to protected branches with clear error message
- [ ] `validationCommands` run before every push; failures block the push and surface clear error
- [ ] `.env.agent` file exists in workspace and contains the values mapped via `agentEnvVarMap`
- [ ] Owner-declared `agentEnvVarMap` is editable via Build Target settings UI
- [ ] When the env var name in the map points to a non-existent server env var: portal logs warning, omits that variable from `.env.agent`, does not crash
- [ ] Conventional commit enforcement rejects malformed messages and triggers retry

---

## Section 8 — Composer Behavior During Generation

**Purpose:** While the agent is generating a response, the owner can keep typing and queue messages without interrupting. The current generation completes, then queued messages are auto-processed as the next turn. Owner has explicit Stop button as override.

### 8.1 Composer states

**State A — Idle.** No generation in progress. Composer enabled. Send button labeled "Send". Standard send-on-Enter, Shift+Enter for newline (preserved from current behavior).

**State B — Agent generating, composer empty.** Composer enabled and focused-ready. Send button replaced visually by red **"Stop"** button (prominent).

**State C — Agent generating, owner typing.** Composer accepts input. Send button label changes from "Send" to **"Queue"** with a count badge: e.g., **"Queue (1)"**. Stop button remains visible separately (not on the send button).

**State D — Agent generating, owner has queued messages.** Below the composer, a chip strip shows the queued messages with order numbers and X buttons to remove each. Each chip displays the first ~50 chars of the message. Each chip is editable on click. Maximum queue: 5 messages.

**State E — Agent finished, queue has messages.** Agent's final response renders in thread normally. Then portal automatically processes queue: concatenates queued messages into a single follow-up turn formatted as:

```
Note: the following messages were queued during your previous response.
Apply them as additional context. If any are now obsolete based on what
you just produced, ask for clarification before acting on them.

1. {first queued message}
2. {second queued message}
... (etc)
```

This becomes a normal user message in the thread. Queue clears (rows transition to `state='sent'`). Agent generates next turn responding to the queued context.

**State F — Owner clicks Stop.** Current generation halts (subject to Section 8.3 below for destructive tool calls). Whatever the agent had produced stays in the thread, marked `(stopped)` and visually faded. Composer returns to State A. Any queued messages remain queued — composer shows them as still-editable chips. Owner can edit, send as a fresh turn, or clear them.

### 8.2 Persistent queue schema

```typescript
export const taskMessageQueue = pgTable('task_message_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id').notNull()
    .references(() => tasks.id, { onDelete: 'cascade' }),
  ownerId: uuid('owner_id').notNull().references(() => users.id),

  position: integer('position').notNull(),
  // 1-indexed order within the queue for this task
  content: text('content').notNull(),
  attachments: jsonb('attachments').notNull().default('[]'),
  // [{ fileId: uuid, fileName: string, status: 'uploading' | 'uploaded' | 'failed' }]

  state: text('state').notNull().default('queued'),
  // 'queued' | 'processing' | 'sent' | 'cleared'

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

CREATE INDEX idx_queue_task_state_position
  ON task_message_queue (task_id, state, position);
```

The queue persists across browser tab closes and portal server restarts. When the user returns, they see whatever's still in `state='queued'`.

### 8.3 Stop behavior — destructive vs non-destructive tool calls

When the owner clicks Stop while the agent is mid-tool-call, behavior depends on whether the tool call is destructive.

**Non-destructive tool calls** (read file, run typecheck, run test, search, list files, etc.):
- Cancel cleanly — abort the tool call, mark the turn as `(stopped)` faded
- Return composer to State A immediately

**Destructive tool calls** (file write, git commit, git push, run migration, exec shell command):
- Allow the current operation to complete (interrupting mid-write produces corrupt state)
- Show in AI Activity: *"Stopping after current operation completes…"*
- After operation finishes, halt the agent
- Mark the turn as `(stopped after <operation>)`

The wrapper distinguishes by tool name. Maintain a registry at `server/wrapperLLM/tool-registry.ts` listing destructive tool names. Default is "non-destructive cancellable" unless explicitly registered as destructive. For Phase 1, the destructive list includes: `filesystem.write`, `filesystem.upload`, `git.commit`, `git.push`, `shell.exec` (any shell run), `db.migrate`.

### 8.4 Edge cases

- **Queue full (5 messages):** chip strip shows a warning chip *"Queue full. Stop and restart, or wait for current turn."* Send/Queue button disables until a queue slot frees.
- **Owner uses `#claude` or `#kimi` tag in a queued message:** override applies to the next turn (when queue processes), not retroactively to the current turn.
- **Browser tab closes mid-generation:** agent keeps running on server. Queued messages persist in DB. On return, owner sees current state with the queued chips still present.
- **Queued message becomes obsolete due to current generation's output:** portal cannot auto-detect. The State E auto-prepended framing ("If any are now obsolete based on what you just produced, ask for clarification before acting on them") shifts responsibility to the agent.
- **Two tasks running on different branches/targets:** each has its own independent queue and Stop button.
- **File upload in queued message:** upload happens immediately when the chip is queued (so the file is ready when queue processes). Chip displays an uploading indicator. If upload fails, chip shows error state and queue processing skips that message's attachment.
- **Adaptive thinking interrupted mid-think:** treated as non-destructive cancellable. Stop discards the partial reasoning cleanly.

### 8.5 UI rules

1. Send/Queue button label always reflects the current state. Owner always knows what hitting send will do.
2. Stop button is visible during all generation states. Never buried in a menu. Always one click away.
3. Queued chips are visible, editable on click, removable via X button — until the chip is processed.
4. AI Activity logs queue events: *"Owner queued message #2"*, *"Queue processed: 2 messages flushed to agent"*.

### 8.6 Acceptance for Section 8

- [ ] Typing while agent generates: Send button changes to "Queue (N)" with count
- [ ] Hitting Queue stores message in `task_message_queue` table; current generation continues uninterrupted
- [ ] When agent finishes, queued messages auto-process as a new turn with the framing from §8.1 State E
- [ ] Stop halts non-destructive tool calls cleanly with `(stopped)` visual marker
- [ ] Stop during destructive tool wait for completion, then halts with `(stopped after <operation>)` marker
- [ ] Queued messages persist across tab close — verifiable by closing tab and reopening
- [ ] Queue maximum of 5 enforced with warning chip and disabled send
- [ ] Tag overrides (`#claude`/`#kimi`) in queued messages apply to next turn only
- [ ] File uploads attached to queued messages upload immediately, chip shows progress

---

## Section 9 — Phase 1 Closeout

### 9.1 Execution order

Build Phase 1 sections in this order. Each must pass acceptance gate before next:

1. Section 1 — Build Targets (schema, server, tRPC, UI)
2. Section 4 — Branch isolation (pre-push hook, env var injection, push policy)
3. Section 8 — Composer queue + Stop behavior

### 9.2 Per-section closeout

After each section:
- Acceptance gate passes (every checkbox in §1.5, §4.6, §8.6)
- All tests green: `pnpm check && pnpm test && pnpm build`
- Commit with conventional format: e.g., `feat(buildRunner): complete section 1 build targets [PORTAL-P1-S1-CLOSE]`
- Append paragraph to `/portal-build-log.md`: which section, what shipped, any deviations from directive, evidence (acceptance gate passes), what's next
- Push to `main` of the portal repo
- Stop. Do not start the next section automatically.

### 9.3 Phase 1 final closeout

After all three sections pass:
- Append "Phase 1 Complete" entry to `/portal-build-log.md` with the three commit SHAs
- Notify the Product Owner: *"Phase 1 complete. Build Targets, branch isolation, queue/Stop behavior shipped. All acceptance gates passed. Ready for PO review and Phase 2 directive."*
- **Do not begin Phase 2 work.** Wait for the PO to deliver `PORTAL_PHASE_2_DIRECTIVE.md`.

### 9.4 Out of scope for Phase 1

These features are for later phases. **Do not build them in Phase 1**:

- Per-task governance auto-load (Phase 2)
- Skill libraries (Phase 2)
- LLM-driven Build Target setup wizard (Phase 2)
- Task tracker adapter system / Airtable sync (Phase 3)
- "Run Next Task" workflow (Phase 3)
- Full Build Mode lifecycle states machine (Phase 3 — Phase 1 only implements clean/cloning/error)
- Demo gate executor / smoke test / cost visibility (Phase 3)
- Plain-English error explainers and blocker UX (Phase 3)
- Service-level isolation health check verification UI (Phase 3 — Phase 1 only stores the declared checks in `serviceChecks` JSON)
- Branch-per-bullet PR-creation flow (out of scope entirely; owner opens PRs manually via GitHub)
- Multi-owner / team support, real-time collaboration, observability dashboard (out of scope entirely)
- Opencode.ai integration (out of scope entirely)

If you find yourself drifting toward any of these: stop, log to `/PORTAL_BACKLOG.md`, continue with Phase 1 scope.

---

## Final note

The portal at commit `e01f66e` is good work. **Do not undo or refactor it.** Phase 1 layers Build Targets, branch isolation, and the queue/Stop composer on top.

When Phase 1 completes, the portal can target external repositories with isolated branches — the foundational plumbing. Phase 2 will add governance auto-load, skills, and the setup wizard on top of that plumbing. Phase 3 will add tracker sync, lifecycle, and novice UX.

After all three phases, the portal becomes a full project-agnostic build runner that a non-technical founder can use end-to-end.

— END PORTAL PHASE 1 DIRECTIVE 1.0 —
