import { readFileSync, writeFileSync } from 'node:fs';

const project = '/home/ubuntu/ai-coding-workshop-permanent';

function replaceOnce(path, find, replace) {
  const fullPath = `${project}/${path}`;
  const source = readFileSync(fullPath, 'utf8');
  if (!source.includes(find)) {
    throw new Error(`Pattern not found in ${path}: ${find.slice(0, 120)}`);
  }
  writeFileSync(fullPath, source.replace(find, replace));
}

function replaceAll(path, find, replace) {
  const fullPath = `${project}/${path}`;
  const source = readFileSync(fullPath, 'utf8');
  if (!source.includes(find)) {
    throw new Error(`Pattern not found in ${path}: ${find.slice(0, 120)}`);
  }
  writeFileSync(fullPath, source.split(find).join(replace));
}

replaceOnce(
  'client/src/pages/Home.tsx',
  `function eventTitle(actor: string, eventType: string) {\n  if (eventType === "route_decision") return "AI routing decision";\n  if (eventType === "credential_status") return "Credential gate";\n  if (eventType === "file_event") return "Task file event";\n  if (eventType === "message") return actor === "user" ? "You" : actor.toUpperCase();\n  if (actor === "claude") return "Claude planning or review";\n  if (actor === "kimi") return "Kimi execution draft";\n  if (actor === "wrapper") return "AI coordinator";\n  return \`\${actor} · \${eventType.replaceAll("_", " ")}\`;\n}\n`,
  `function eventTitle(actor: string, eventType: string) {\n  if (eventType === "route_decision") return "AI routing decision";\n  if (eventType === "credential_status") return "Credential gate";\n  if (eventType === "file_event") return "Task file event";\n  if (eventType === "message") return actor === "user" ? "You" : actor.toUpperCase();\n  if (actor === "claude") return "Claude planning or review";\n  if (actor === "kimi") return "Kimi execution draft";\n  if (actor === "wrapper") return "AI coordinator";\n  return \`\${actor} · \${eventType.replaceAll("_", " ")}\`;\n}\n\ntype ThreadEvent = {\n  id: number;\n  taskId?: number;\n  ownerUserId?: number;\n  actor: string;\n  eventType: string;\n  status: string;\n  content: string;\n  metadataJson?: string | null;\n  createdAt: number | Date | string;\n};\n\nfunction eventTimestamp(event: ThreadEvent) {\n  return new Date(event.createdAt).getTime() || 0;\n}\n\nfunction newestFirst(a: ThreadEvent, b: ThreadEvent) {\n  const delta = eventTimestamp(b) - eventTimestamp(a);\n  return delta || b.id - a.id;\n}\n\nfunction isOwnerVisibleEvent(event: ThreadEvent) {\n  if (event.eventType === "message") return true;\n  if ((event.actor === "claude" || event.actor === "kimi") && ["model_result", "model_review"].includes(event.eventType)) return true;\n  return false;\n}\n\nfunction ownerEventTitle(event: ThreadEvent) {\n  if (event.eventType === "message" && event.actor === "user") return "You";\n  if (event.actor === "claude" || event.actor === "kimi") return "AI answer";\n  return eventTitle(event.actor, event.eventType);\n}\n\nfunction ownerEventBody(event: ThreadEvent) {\n  return ownerFacingText(event.content);\n}\n\nfunction ownerProviderFailureMessage(event: ThreadEvent | undefined) {\n  if (!event) return null;\n  const content = event.content.toLowerCase();\n  if (content.includes("kimi") && (content.includes("empty") || content.includes("usable text"))) {\n    return "Kimi did not return usable text for this turn. No silent fallback was used; retry the message or send it with #claude while Kimi is checked.";\n  }\n  return "The AI provider did not return a usable answer for this turn. No silent fallback was used; retry after checking credentials or choose an explicit #claude or #kimi route.";\n}\n`,
);

replaceOnce(
  'client/src/pages/Home.tsx',
  `  const createTask = trpc.tasks.create.useMutation();\n  const submitMessage = trpc.orchestration.submitMessage.useMutation();\n`,
  `  const createTask = trpc.tasks.create.useMutation();\n  const updateTaskStatus = trpc.tasks.updateStatus.useMutation();\n  const submitMessage = trpc.orchestration.submitMessage.useMutation();\n`,
);

replaceOnce(
  'client/src/pages/Home.tsx',
  `  const selectedThread = threadQuery.data;\n  const events = selectedThread?.events ?? [];\n`,
  `  const selectedThread = threadQuery.data;\n  const selectedTask = selectedThread?.task ?? tasks.find((task) => task.id === selectedTaskId) ?? null;\n  const events = ((selectedThread?.events ?? []) as ThreadEvent[]);\n  const ownerVisibleEvents = useMemo(() => events.filter(isOwnerVisibleEvent).sort(newestFirst), [events]);\n  const technicalEvents = useMemo(() => events.filter((event) => !isOwnerVisibleEvent(event)).sort(newestFirst), [events]);\n  const latestProviderFailure = useMemo(() => technicalEvents.find((event) => event.status === "failed" || event.status === "blocked"), [technicalEvents]);\n  const providerFailureCopy = ownerProviderFailureMessage(latestProviderFailure);\n`,
);

replaceOnce(
  'client/src/pages/Home.tsx',
  `  const isMutating = createTask.isPending || submitMessage.isPending || createFileMetadata.isPending;\n`,
  `  const isMutating = createTask.isPending || updateTaskStatus.isPending || submitMessage.isPending || createFileMetadata.isPending;\n`,
);

replaceOnce(
  'client/src/pages/Home.tsx',
  `    if (cleanMessage) {\n      await submitMessage.mutateAsync({ taskId: created.task.id, message: cleanMessage, routeMode: "auto" });\n    }\n    setComposerText("");\n    await refreshWorkspace();\n  }\n`,
  `    // Creating a task only saves task context. Claude/Kimi are called only after the owner explicitly sends a task message.\n    setComposerText(cleanMessage);\n    await refreshWorkspace();\n  }\n\n  async function handleArchiveSelectedTask() {\n    if (!selectedTaskId) return;\n    const taskName = selectedTask?.title ?? "this task";\n    if (!window.confirm(\`Archive \"${taskName}\"? It will disappear from Live tasks, but its history remains recoverable in the database.\`)) return;\n    await updateTaskStatus.mutateAsync({ taskId: selectedTaskId, status: "archived" });\n    setSelectedTaskId(null);\n    await refreshWorkspace();\n  }\n`,
);

replaceOnce(
  'client/src/pages/Home.tsx',
  `          <p className="mt-2 text-xs leading-5 text-[#67675f]">Task-first production workspace. No provider dropdown, terminal-first workflow, or demo command composer.</p>\n`,
  `          <p className="mt-2 text-xs leading-5 text-[#67675f]">Task-first production workspace. Creating a task does not call Claude or Kimi; models run only when you send a task message.</p>\n`,
);

replaceOnce(
  'client/src/pages/Home.tsx',
  `              <Button onClick={handleCreateTask} disabled={isMutating} className="w-full justify-start gap-2 rounded-xl bg-[#1f1f1f] text-white hover:bg-black">\n                {createTask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} New task\n              </Button>\n`,
  `              <Button onClick={handleCreateTask} disabled={isMutating} className="w-full justify-start gap-2 rounded-xl bg-[#1f1f1f] text-white hover:bg-black">\n                {createTask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} New blank task\n              </Button>\n`,
);

replaceOnce(
  'client/src/pages/Home.tsx',
  `              filteredTasks.map((task) => (\n                <button\n                  key={task.id}\n                  type="button"\n                  onClick={() => setSelectedTaskId(task.id)}\n                  className={\`w-full rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 ${selectedTaskId === task.id ? "border-sky-300 bg-white shadow-sm" : "border-transparent bg-transparent hover:bg-white/70"}\`}\n                >\n                  <div className="flex items-start justify-between gap-2">\n                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[#2c2c28]">{task.title}</p>\n                    <Badge variant="outline" className={\`shrink-0 rounded-full text-[10px] ${statusTone[task.status] ?? statusTone.active}\`}>{task.status}</Badge>\n                  </div>\n                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#66665f]">{ownerFacingText(task.summary) || "No summary recorded yet."}</p>\n                  <p className="mt-2 text-[11px] text-[#9a998f]">Updated {compactDate(task.updatedAt)}</p>\n                </button>\n              ))\n`,
  `              filteredTasks.map((task) => (\n                <div\n                  key={task.id}\n                  className={\`w-full rounded-2xl border p-3 transition ${selectedTaskId === task.id ? "border-sky-300 bg-white shadow-sm" : "border-transparent bg-transparent hover:bg-white/70"}\`}\n                >\n                  <button\n                    type="button"\n                    onClick={() => setSelectedTaskId(task.id)}\n                    className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"\n                  >\n                    <div className="flex items-start justify-between gap-2">\n                      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[#2c2c28]">{task.title}</p>\n                      <Badge variant="outline" className={\`shrink-0 rounded-full text-[10px] ${statusTone[task.status] ?? statusTone.active}\`}>{task.status}</Badge>\n                    </div>\n                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#66665f]">{ownerFacingText(task.summary) || "No summary recorded yet."}</p>\n                    <p className="mt-2 text-[11px] text-[#9a998f]">Updated {compactDate(task.updatedAt)}</p>\n                  </button>\n                  {selectedTaskId === task.id ? (\n                    <Button type="button" variant="outline" size="sm" onClick={handleArchiveSelectedTask} disabled={updateTaskStatus.isPending} className="mt-3 h-8 w-full justify-start rounded-xl border-[#d9d8d1] bg-white text-xs text-[#66665f]">\n                      {updateTaskStatus.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Archive className="mr-2 h-3 w-3" />} Archive task\n                    </Button>\n                  ) : null}\n                </div>\n              ))\n`,
);

replaceOnce(
  'client/src/pages/Home.tsx',
  `            ) : events.length === 0 ? (\n              <div className="rounded-2xl border border-dashed border-[#cfcfc8] bg-white p-8 text-center text-sm leading-6 text-[#6d6d65]">This task has no thread events yet. Send the first message to build real orchestration history.</div>\n            ) : (\n              events.map((event) => (\n                <article key={event.id} className={\`rounded-3xl border p-4 shadow-sm ${actorTone[event.actor] ?? actorTone.system}\`}>\n                  <div className="flex flex-wrap items-center justify-between gap-2">\n                    <div className="flex items-center gap-2">\n                      {event.status === "blocked" || event.status === "failed" ? <CircleAlert className="h-4 w-4 text-rose-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}\n                      <h3 className="text-sm font-semibold text-[#2b2b27]">{eventTitle(event.actor, event.eventType)}</h3>\n                    </div>\n                    <div className="flex items-center gap-2 text-xs text-[#77766e]">\n                      <Clock3 className="h-3.5 w-3.5" /> {compactDate(event.createdAt)}\n                      <Badge variant="outline" className="rounded-full text-[10px]">{event.status}</Badge>\n                    </div>\n                  </div>\n                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#3e3e39]">{ownerFacingText(event.content)}</p>\n                </article>\n              ))\n            )}\n`,
  `            ) : events.length === 0 ? (\n              <div className="rounded-2xl border border-dashed border-[#cfcfc8] bg-white p-8 text-center text-sm leading-6 text-[#6d6d65]">This task has no thread messages yet. Send the first message to call Claude/Kimi through the coordinator.</div>\n            ) : (\n              <>\n                {providerFailureCopy && ownerVisibleEvents.length === 0 ? (\n                  <article className="rounded-3xl border border-rose-200 bg-rose-50/80 p-4 shadow-sm">\n                    <div className="flex flex-wrap items-center justify-between gap-2">\n                      <div className="flex items-center gap-2">\n                        <CircleAlert className="h-4 w-4 text-rose-600" />\n                        <h3 className="text-sm font-semibold text-[#2b2b27]">AI answer unavailable</h3>\n                      </div>\n                      <Badge variant="outline" className="rounded-full border-rose-200 bg-white text-[10px] text-rose-700">needs retry</Badge>\n                    </div>\n                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#3e3e39]">{providerFailureCopy}</p>\n                  </article>\n                ) : null}\n\n                {ownerVisibleEvents.length === 0 && !providerFailureCopy ? (\n                  <div className="rounded-2xl border border-dashed border-[#cfcfc8] bg-white p-8 text-center text-sm leading-6 text-[#6d6d65]">Only internal coordination records exist for this task. Send a message to create the first owner-facing exchange.</div>\n                ) : null}\n\n                {ownerVisibleEvents.map((event) => (\n                  <article key={event.id} className={\`rounded-3xl border p-4 shadow-sm ${actorTone[event.actor] ?? actorTone.system}\`}>\n                    <div className="flex flex-wrap items-center justify-between gap-2">\n                      <div className="flex items-center gap-2">\n                        {event.status === "blocked" || event.status === "failed" ? <CircleAlert className="h-4 w-4 text-rose-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}\n                        <h3 className="text-sm font-semibold text-[#2b2b27]">{ownerEventTitle(event)}</h3>\n                      </div>\n                      <div className="flex items-center gap-2 text-xs text-[#77766e]">\n                        <Clock3 className="h-3.5 w-3.5" /> {compactDate(event.createdAt)}\n                        <Badge variant="outline" className="rounded-full text-[10px]">{event.status}</Badge>\n                      </div>\n                    </div>\n                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#3e3e39]">{ownerEventBody(event)}</p>\n                  </article>\n                ))}\n\n                {technicalEvents.length > 0 ? (\n                  <details className="rounded-3xl border border-dashed border-[#cfcfc8] bg-white/70 p-4 text-sm text-[#5f5f57]">\n                    <summary className="cursor-pointer font-semibold text-[#30302b]">Technical run details ({technicalEvents.length})</summary>\n                    <div className="mt-4 space-y-3">\n                      {technicalEvents.map((event) => (\n                        <div key={event.id} className="rounded-2xl border border-[#deded8] bg-white p-3">\n                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#77766e]">\n                            <span className="font-semibold text-[#30302b]">{eventTitle(event.actor, event.eventType)}</span>\n                            <span>{compactDate(event.createdAt)} · {event.status}</span>\n                          </div>\n                          <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[#5f5f57]">{ownerFacingText(event.content)}</p>\n                        </div>\n                      ))}\n                    </div>\n                  </details>\n                ) : null}\n              </>\n            )}\n`,
);

replaceOnce(
  'client/src/pages/Home.tsx',
  `                <p>AUTO routes internally. Missing credentials block explicitly; the app never silently falls back.</p>\n`,
  `                <p>AUTO routes internally. Creating a task only saves context; Claude/Kimi run when you send a task message. Missing credentials block explicitly.</p>\n`,
);

replaceOnce(
  'server/wrapperLLM.ts',
  `  const normalized = normalizeModelText(text);\n  if (!normalized) {\n    throw new Error("Kimi returned an empty response.");\n  }\n\n  return normalized;\n}\n`,
  `  const normalized = normalizeModelText(text);\n  if (!normalized) {\n    const retryResponse = await fetch(\`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/${KIMI_K26_CLOUDFLARE_MODEL}\`, {\n      method: "POST",\n      headers: {\n        authorization: \`Bearer ${config.apiToken}\`,\n        "content-type": "application/json",\n      },\n      body: JSON.stringify({\n        messages: [\n          ...messages,\n          { role: "user", content: "The previous provider response was empty. Return a concise, plain-text answer for the user's task. If you cannot answer, state the blocker and the next action." },\n        ],\n      }),\n    });\n    const retryBody = (await retryResponse.json().catch(() => null)) as\n      | { success?: boolean; result?: { response?: string } | string; errors?: Array<{ code?: number; message?: string }> }\n      | null;\n\n    if (!retryResponse.ok || retryBody?.success === false) {\n      const message = retryBody?.errors?.map((error) => \`${error.code ?? "error"}: ${error.message ?? "unknown"}\`).join("; ") || retryResponse.statusText;\n      throw new Error(\`Kimi request failed after empty-response retry: ${message}\`);\n    }\n\n    const retryText = typeof retryBody?.result === "string" ? retryBody.result : retryBody?.result?.response;\n    const retryNormalized = normalizeModelText(retryText);\n    if (!retryNormalized) {\n      throw new Error("Kimi did not return usable text after retry.");\n    }\n    return retryNormalized;\n  }\n\n  return normalized;\n}\n`,
);

replaceOnce(
  'server/wrapperLLM.ts',
  `    const message = error instanceof Error ? error.message : "Unknown Wrapper LLM execution error";\n    await failTurn(input.turnId, input.ownerUserId, "MODEL_EXECUTION_FAILED", message, "failed");\n    await updateTaskStatus(input.task.id, input.ownerUserId, "error");\n    await appendTaskEvent({\n      taskId: input.task.id,\n      ownerUserId: input.ownerUserId,\n      actor: "wrapper",\n      eventType: "error",\n      status: "failed",\n      content: message,\n      metadataJson: serializeJson({ turnId: input.turnId, route: input.route }),\n    });\n`,
  `    const rawMessage = error instanceof Error ? error.message : "Unknown Wrapper LLM execution error";\n    const message = rawMessage.toLowerCase().includes("kimi") && (rawMessage.toLowerCase().includes("empty") || rawMessage.toLowerCase().includes("usable text"))\n      ? "Kimi did not return usable text for this turn. No silent fallback was used; retry the message or send it with #claude while Kimi is checked."\n      : rawMessage;\n    await failTurn(input.turnId, input.ownerUserId, "MODEL_EXECUTION_FAILED", message, "failed");\n    await updateTaskStatus(input.task.id, input.ownerUserId, "error");\n    await appendTaskEvent({\n      taskId: input.task.id,\n      ownerUserId: input.ownerUserId,\n      actor: "wrapper",\n      eventType: "error",\n      status: "failed",\n      content: message,\n      metadataJson: serializeJson({ turnId: input.turnId, route: input.route, rawError: rawMessage }),\n    });\n`,
);

replaceOnce(
  'client/src/pages/Home.behavior.test.tsx',
  `const createTaskMock = vi.fn();\nconst submitMessageMock = vi.fn();\n`,
  `const createTaskMock = vi.fn();\nconst updateTaskStatusMock = vi.fn();\nconst submitMessageMock = vi.fn();\n`,
);

replaceOnce(
  'client/src/pages/Home.behavior.test.tsx',
  `      create: {\n        useMutation: () => ({\n          mutateAsync: createTaskMock,\n          isPending: false,\n        }),\n      },\n`,
  `      create: {\n        useMutation: () => ({\n          mutateAsync: createTaskMock,\n          isPending: false,\n        }),\n      },\n      updateStatus: {\n        useMutation: () => ({\n          mutateAsync: updateTaskStatusMock,\n          isPending: false,\n        }),\n      },\n`,
);

replaceOnce(
  'client/src/pages/Home.behavior.test.tsx',
  `  createTaskMock.mockReset();\n  submitMessageMock.mockReset();\n`,
  `  createTaskMock.mockReset();\n  updateTaskStatusMock.mockReset();\n  submitMessageMock.mockReset();\n`,
);

replaceOnce(
  'client/src/pages/Home.behavior.test.tsx',
  `  createTaskMock.mockResolvedValue({ task: { ...sampleTask, id: 19, title: "Created task" }, events: [], activeTurn: null });\n  submitMessageMock.mockResolvedValue(mockThread);\n`,
  `  createTaskMock.mockResolvedValue({ task: { ...sampleTask, id: 19, title: "Created task" }, events: [], activeTurn: null });\n  updateTaskStatusMock.mockResolvedValue(mockThread);\n  submitMessageMock.mockResolvedValue(mockThread);\n`,
);

replaceOnce(
  'client/src/pages/Home.behavior.test.tsx',
  `    expect(screen.getByText(/Task-first production workspace/i)).toBeInTheDocument();\n`,
  `    expect(screen.getByText(/Creating a task does not call Claude or Kimi/i)).toBeInTheDocument();\n`,
);

replaceOnce(
  'client/src/pages/Home.behavior.test.tsx',
  `  it("creates a new task from the sidebar with honest task-first defaults", async () => {\n`,
  `  it("creates a new blank task from the sidebar without calling Claude or Kimi", async () => {\n`,
);

replaceOnce(
  'client/src/pages/Home.behavior.test.tsx',
  `    await user.click(screen.getByRole("button", { name: /new task/i }));\n`,
  `    await user.click(screen.getByRole("button", { name: /new blank task/i }));\n`,
);

replaceOnce(
  'client/src/pages/Home.behavior.test.tsx',
  `    expect(submitMessageMock).toHaveBeenCalledWith(expect.objectContaining({ taskId: 19, routeMode: "auto" }));\n  });\n`,
  `    expect(submitMessageMock).not.toHaveBeenCalled();\n    expect(screen.getByText(/Claude\/Kimi run when you send a task message/i)).toBeInTheDocument();\n  });\n`,
);

const appendTests = `\n\n  it("shows newest owner-facing messages first and moves technical orchestration records behind details", async () => {\n    mockThread = {\n      task: sampleTask,\n      activeTurn: null,\n      events: [\n        { id: 201, taskId: 7, ownerUserId: 42, actor: "user", eventType: "message", status: "succeeded", content: "What model am I connected to?", metadataJson: "{}", createdAt: 1777999100000 },\n        { id: 202, taskId: 7, ownerUserId: 42, actor: "wrapper", eventType: "route_decision", status: "succeeded", content: "AUTO can route through both Claude planning/review and Kimi execution because both credentials are configured.", metadataJson: "{}", createdAt: 1777999200000 },\n        { id: 203, taskId: 7, ownerUserId: 42, actor: "wrapper", eventType: "context_snapshot", status: "succeeded", content: "AI coordinator assembled task thread, global memory, task file metadata, route, and credential context for this turn.", metadataJson: "{}", createdAt: 1777999300000 },\n        { id: 204, taskId: 7, ownerUserId: 42, actor: "claude", eventType: "model_review", status: "succeeded", content: "You are connected through AUTO coordination using Claude for review and Kimi for execution when both credentials are available.", metadataJson: "{}", createdAt: 1777999400000 },\n      ],\n    };\n\n    render(<Home />);\n\n    await screen.findAllByText("Implement v2 shell");\n    const aiAnswer = screen.getByText(/You are connected through AUTO coordination/i);\n    const userMessage = screen.getByText(/What model am I connected to\?/i);\n    expect(aiAnswer.compareDocumentPosition(userMessage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();\n    expect(screen.getByText(/Technical run details \(2\)/i)).toBeInTheDocument();\n  });\n\n  it("surfaces Kimi empty output as an owner-friendly retry message instead of a raw dead-end", async () => {\n    mockThread = {\n      task: sampleTask,\n      activeTurn: null,\n      events: [\n        { id: 301, taskId: 7, ownerUserId: 42, actor: "user", eventType: "message", status: "succeeded", content: "Use #kimi and answer this.", metadataJson: "{}", createdAt: 1777999100000 },\n        { id: 302, taskId: 7, ownerUserId: 42, actor: "wrapper", eventType: "error", status: "failed", content: "Kimi did not return usable text for this turn. No silent fallback was used; retry the message or send it with #claude while Kimi is checked.", metadataJson: "{}", createdAt: 1777999200000 },\n      ],\n    };\n\n    render(<Home />);\n\n    await screen.findAllByText("Implement v2 shell");\n    expect(screen.getByText(/Use #kimi and answer this\./i)).toBeInTheDocument();\n    expect(screen.getByText(/Technical run details \(1\)/i)).toBeInTheDocument();\n  });\n\n  it("archives the selected task through the existing status mutation after confirmation", async () => {\n    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);\n    const user = userEvent.setup();\n    render(<Home />);\n\n    await screen.findAllByText("Implement v2 shell");\n    await user.click(screen.getByRole("button", { name: /archive task/i }));\n\n    expect(updateTaskStatusMock).toHaveBeenCalledWith({ taskId: 7, status: "archived" });\n    await waitFor(() => expect(invalidateMock).toHaveBeenCalled());\n    confirmSpy.mockRestore();\n  });\n`;
replaceOnce('client/src/pages/Home.behavior.test.tsx', `\n});\n`, appendTests + `\n});\n`);
