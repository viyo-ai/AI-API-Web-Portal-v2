import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import FilesystemPanel from "@/components/FilesystemPanel";
import TerminalPanel from "@/components/TerminalPanel";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  Archive,
  Bot,
  Brain,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileCode2,
  FileText,
  FolderOpen,
  History,
  Library,
  RotateCcw,
  Download,
  Loader2,
  LockKeyhole,
  MessageSquareText,
  PanelLeft,
  PanelRight,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";

const statusTone: Record<string, string> = {
  active: "bg-sky-100 text-sky-800 border-sky-200",
  waiting: "bg-amber-100 text-amber-800 border-amber-200",
  blocked: "bg-rose-100 text-rose-800 border-rose-200",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  archived: "bg-stone-100 text-stone-700 border-stone-200",
  error: "bg-red-100 text-red-800 border-red-200",
};

const actorTone: Record<string, string> = {
  user: "border-slate-200 bg-white",
  claude: "border-violet-200 bg-violet-50/80",
  kimi: "border-cyan-200 bg-cyan-50/80",
  wrapper: "border-slate-300 bg-slate-50",
  system: "border-stone-200 bg-stone-50",
};

const starterPrompts = [
  "Architect a production-safe implementation plan for the next UI slice before coding.",
  "Review the current task context and identify any missing wiring before implementation.",
  "Use #kimi to produce a precise execution draft for a narrowly scoped code change.",
  "Use #claude to review risk, acceptance criteria, and user-facing behavior before build.",
];

function compactDate(value: number | Date | string | null | undefined) {
  if (!value) return "No timestamp";
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function eventTitle(actor: string, eventType: string) {
  if (eventType === "route_decision") return "Wrapper route decision";
  if (eventType === "credential_status") return "Credential gate";
  if (eventType === "file_event") return "Task file event";
  if (eventType === "message") return actor === "user" ? "You" : actor.toUpperCase();
  if (actor === "claude") return "Claude planning/review";
  if (actor === "kimi") return "Kimi execution draft";
  return `${actor} · ${eventType.replaceAll("_", " ")}`;
}

export default function Home() {
  const { user, loading, error, isAuthenticated, logout } = useAuth();
  const loginUrl = useMemo(() => getLoginUrl(), []);
  const utils = trpc.useUtils();

  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [taskTitle, setTaskTitle] = useState("Production v2 rebuild task");
  const [composerText, setComposerText] = useState("Architect the next production-safe step, verify wiring, then proceed only if it matches the approved v2 plan.");
  const [searchTerm, setSearchTerm] = useState("");
  const [filePath, setFilePath] = useState("");
  const [fileUrl, setFileUrl] = useState("");

  const taskListInput = useMemo(() => ({ includeArchived: false, limit: 50 }), []);
  const tasksQuery = trpc.tasks.list.useQuery(taskListInput, { enabled: isAuthenticated });
  const tasks = tasksQuery.data ?? [];

  useEffect(() => {
    if (!selectedTaskId && tasks.length > 0) {
      setSelectedTaskId(tasks[0].id);
    }
  }, [selectedTaskId, tasks]);

  const threadInput = useMemo(() => ({ taskId: selectedTaskId ?? 0 }), [selectedTaskId]);
  const threadQuery = trpc.tasks.thread.useQuery(threadInput, { enabled: isAuthenticated && Boolean(selectedTaskId) });
  const filesInput = useMemo(() => ({ taskId: selectedTaskId ?? 0, limit: 200 }), [selectedTaskId]);
  const taskFilesQuery = trpc.files.listForTask.useQuery(filesInput, { enabled: isAuthenticated && Boolean(selectedTaskId) });
  const allFilesInput = useMemo(() => ({ limit: 400 }), []);
  const allFilesQuery = trpc.files.listAll.useQuery(allFilesInput, { enabled: isAuthenticated });
  const memoryInput = useMemo(() => ({ limit: 40 }), []);
  const memoryQuery = trpc.memory.list.useQuery(memoryInput, { enabled: isAuthenticated });
  const credentialsQuery = trpc.credentials.status.useQuery(undefined, { enabled: isAuthenticated, refetchInterval: 15000 });

  const createTask = trpc.tasks.create.useMutation();
  const submitMessage = trpc.orchestration.submitMessage.useMutation();
  const createFileMetadata = trpc.files.createMetadata.useMutation();
  const credentialsRefreshMutation = trpc.credentials.refresh.useMutation();

  const selectedThread = threadQuery.data;
  const events = selectedThread?.events ?? [];
  const taskFiles = taskFilesQuery.data ?? [];
  const allFiles = allFilesQuery.data ?? [];
  const memories = memoryQuery.data ?? [];
  const credentials = credentialsQuery.data?.runtimeStates ?? [];

  const filteredTasks = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return tasks;
    return tasks.filter((task) => `${task.title} ${task.summary ?? ""} ${task.status}`.toLowerCase().includes(query));
  }, [tasks, searchTerm]);

  const isMutating = createTask.isPending || submitMessage.isPending || createFileMetadata.isPending;

  async function refreshWorkspace() {
    await Promise.all([
      utils.tasks.list.invalidate(),
      utils.tasks.thread.invalidate(),
      utils.files.listForTask.invalidate(),
      utils.files.listAll.invalidate(),
      utils.memory.list.invalidate(),
      utils.credentials.status.invalidate(),
    ]);
  }

  async function handleRefreshCredentials() {
    await credentialsRefreshMutation.mutateAsync({ providers: ["claude", "kimi"] });
    await utils.credentials.status.invalidate();
  }

  async function handleCreateTask() {
    const cleanTitle = taskTitle.trim() || "Untitled production task";
    const cleanMessage = composerText.trim();
    const created = await createTask.mutateAsync({
      title: cleanTitle,
      summary: "Task-first v2 workspace item created from the production three-pane shell.",
      routeMode: "auto",
    });
    if (!created) return;
    setSelectedTaskId(created.task.id);
    if (cleanMessage) {
      await submitMessage.mutateAsync({ taskId: created.task.id, message: cleanMessage, routeMode: "auto" });
    }
    setComposerText("");
    await refreshWorkspace();
  }

  async function handleSendMessage() {
    if (!selectedTaskId || !composerText.trim()) return;
    await submitMessage.mutateAsync({ taskId: selectedTaskId, message: composerText.trim(), routeMode: "auto" });
    setComposerText("");
    await refreshWorkspace();
  }

  async function handleCreateFileMetadata() {
    if (!selectedTaskId || !filePath.trim() || !fileUrl.trim()) return;
    await createFileMetadata.mutateAsync({
      taskId: selectedTaskId,
      relativePath: filePath.trim(),
      storageKey: filePath.trim(),
      storageUrl: fileUrl.trim(),
      mimeType: "text/markdown",
      sizeBytes: 0,
      version: 1,
    });
    await refreshWorkspace();
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f6f2] text-[#242420]">
        <div className="flex items-center gap-3 rounded-2xl border border-[#deded8] bg-white px-5 py-4 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-sky-500" />
          <span className="text-sm font-medium text-[#5f5f57]">Checking secure Manus OAuth session...</span>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen overflow-hidden bg-[#f7f6f2] text-[#242420]">
        <section className="container grid min-h-screen items-center gap-10 py-16 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d9d8d1] bg-white px-4 py-2 text-sm font-semibold text-[#4d4d46] shadow-sm">
              <LockKeyhole className="h-4 w-4 text-sky-500" /> Manus OAuth protected production workspace
            </div>
            <div className="space-y-5">
              <h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.045em] text-[#1f1f1f] md:text-7xl">
                A task-first Wrapper LLM workspace for Claude and Kimi.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-[#66665f]">
                Log in to run the approved v2 workflow: live tasks and global memory on the left, a task thread in the center, and task files on the right. The system routes Claude and Kimi server-side with explicit credential gates and no silent provider fallback.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="rounded-full bg-[#1f1f1f] px-7 text-white hover:bg-black">
                <a href={loginUrl}>Log in with Manus</a>
              </Button>
              {error ? <p className="text-sm text-rose-600">{String(error)}</p> : null}
            </div>
          </div>

          <Card className="border-[#deded8] bg-white text-[#242420] shadow-xl shadow-black/5">
            <CardContent className="space-y-5 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#d9d8d1] bg-[#f3f2ed]">
                  <Workflow className="h-6 w-6 text-sky-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#76766e]">Wrapper LLM v2</p>
                  <h2 className="text-2xl font-semibold tracking-[-0.03em] text-[#1f1f1f]">Production routing before execution</h2>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {["Claude plans and reviews", "Kimi drafts execution", "AUTO resolves internally", "Credentials block explicitly"].map((step) => (
                  <div key={step} className="rounded-2xl border border-[#deded8] bg-[#fbfaf7] p-4 text-sm font-medium text-[#45453e]">
                    <CheckCircle2 className="mb-3 h-5 w-5 text-emerald-600" /> {step}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen bg-[#f7f6f2] text-[#242420] lg:grid-cols-[300px_minmax(0,1fr)_360px]">
      <aside className="flex min-h-screen flex-col border-r border-[#d9d8d1] bg-[#f0efeb]">
        <div className="border-b border-[#d9d8d1] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-lg font-semibold tracking-[-0.03em] text-[#1f1f1f]">
              <Bot className="h-5 w-5" /> manus
            </div>
            <Badge className="rounded-full border-emerald-200 bg-emerald-100 text-emerald-800">v2</Badge>
          </div>
          <p className="mt-2 text-xs leading-5 text-[#67675f]">Task-first production shell. No provider dropdown, terminal-first workflow, or demo command composer.</p>
        </div>

        <div className="space-y-3 border-b border-[#d9d8d1] p-4">
          <Button onClick={handleCreateTask} disabled={isMutating} className="w-full justify-start gap-2 rounded-xl bg-[#1f1f1f] text-white hover:bg-black">
            {createTask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} New task
          </Button>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#8a8980]" />
            <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search live tasks" className="h-10 rounded-xl border-[#d9d8d1] bg-white pl-9 text-sm" />
          </div>
          <Input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="New task title" className="h-10 rounded-xl border-[#d9d8d1] bg-white text-sm" />
        </div>

        <ScrollArea className="min-h-0 flex-1 px-3 py-3">
          <div className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#77766e]">
            <PanelLeft className="h-3.5 w-3.5" /> Live tasks
          </div>
          <div className="space-y-2">
            {tasksQuery.isLoading ? (
              <div className="rounded-2xl border border-[#d9d8d1] bg-white p-4 text-sm text-[#6d6d65]">Loading tasks...</div>
            ) : filteredTasks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#cfcfc8] bg-white/70 p-4 text-sm leading-6 text-[#6d6d65]">
                No live tasks yet. Create one from the title and composer text to establish Claude/Kimi orchestration context.
              </div>
            ) : (
              filteredTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => setSelectedTaskId(task.id)}
                  className={`w-full rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 ${selectedTaskId === task.id ? "border-sky-300 bg-white shadow-sm" : "border-transparent bg-transparent hover:bg-white/70"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[#2c2c28]">{task.title}</p>
                    <Badge variant="outline" className={`shrink-0 rounded-full text-[10px] ${statusTone[task.status] ?? statusTone.active}`}>{task.status}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#74746c]">{task.summary || "No summary recorded yet."}</p>
                  <p className="mt-2 text-[11px] text-[#9a998f]">Updated {compactDate(task.updatedAt)}</p>
                </button>
              ))
            )}
          </div>

          <div className="mt-6 mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#77766e]">
            <Brain className="h-3.5 w-3.5" /> Global memory
          </div>
          <div className="space-y-2 pb-4">
            {memories.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#cfcfc8] bg-white/70 p-4 text-xs leading-5 text-[#6d6d65]">
                Durable memory is empty. Decisions, features, research, and past-task learnings will appear here only after real records exist.
              </div>
            ) : (
              memories.slice(0, 6).map((memory) => (
                <div key={memory.id} className="rounded-2xl border border-[#deded8] bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-semibold text-[#30302b]">{memory.title}</p>
                    <Badge variant="outline" className="rounded-full text-[10px]">{memory.category.replace("_", " ")}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#74746c]">{memory.content}</p>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </aside>

      <section className="flex min-h-screen min-w-0 flex-col bg-[#fbfaf7]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#deded8] bg-white/80 px-5 py-4 backdrop-blur">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#77766e]">
              <MessageSquareText className="h-4 w-4" /> Center task thread
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em] text-[#20201d]">{selectedThread?.task.title ?? "Create or select a task"}</h1>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              {credentials.map((credential: { provider: string; configured: boolean; status: string; reason?: string }) => (
                <Badge key={credential.provider} variant="outline" title={credential.reason} className={`rounded-full ${credential.configured ? "border-emerald-200 bg-emerald-100 text-emerald-800" : "border-rose-200 bg-rose-100 text-rose-800"}`}>
                  {credential.provider}: {credential.status}
                </Badge>
              ))}
              <Button variant="outline" onClick={() => logout()} className="rounded-full border-[#d9d8d1] bg-white">Logout</Button>
            </div>
            {credentials.some((credential: { configured: boolean }) => !credential.configured) ? (
              <p className="max-w-xl text-right text-[11px] leading-4 text-[#77766e]">
                {credentials.filter((credential: { configured: boolean }) => !credential.configured).map((credential: { reason?: string }) => credential.reason).filter(Boolean).join(" ")}
              </p>
            ) : null}
          </div>
        </header>

        <ScrollArea className="min-h-0 flex-1 p-5">
          <div className="mx-auto max-w-4xl space-y-4">
            {!selectedTaskId ? (
              <Card className="border-dashed border-[#cfcfc8] bg-white text-[#242420]">
                <CardContent className="p-8 text-center">
                  <Sparkles className="mx-auto mb-4 h-10 w-10 text-sky-500" />
                  <h2 className="text-xl font-semibold tracking-[-0.03em]">Start with a production task</h2>
                  <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#686861]">Use the composer below to create a task. AUTO routing stays inside the Wrapper LLM and can be overridden only with #claude or #kimi tags in the message.</p>
                </CardContent>
              </Card>
            ) : threadQuery.isLoading ? (
              <div className="rounded-2xl border border-[#deded8] bg-white p-5 text-sm text-[#6d6d65]">Loading task thread...</div>
            ) : events.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#cfcfc8] bg-white p-8 text-center text-sm leading-6 text-[#6d6d65]">This task has no thread events yet. Send the first message to build real orchestration history.</div>
            ) : (
              events.map((event) => (
                <article key={event.id} className={`rounded-3xl border p-4 shadow-sm ${actorTone[event.actor] ?? actorTone.system}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {event.status === "blocked" || event.status === "failed" ? <CircleAlert className="h-4 w-4 text-rose-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                      <h3 className="text-sm font-semibold text-[#2b2b27]">{eventTitle(event.actor, event.eventType)}</h3>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#77766e]">
                      <Clock3 className="h-3.5 w-3.5" /> {compactDate(event.createdAt)}
                      <Badge variant="outline" className="rounded-full text-[10px]">{event.status}</Badge>
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#3e3e39]">{event.content}</p>
                </article>
              ))
            )}
          </div>
        </ScrollArea>

        <footer className="border-t border-[#deded8] bg-white p-4">
          <div className="mx-auto max-w-4xl space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {starterPrompts.map((prompt) => (
                <button key={prompt} type="button" onClick={() => setComposerText(prompt)} className="rounded-2xl border border-[#deded8] bg-[#fbfaf7] p-3 text-left text-xs leading-5 text-[#55554e] hover:border-sky-200 hover:bg-sky-50">
                  {prompt}
                </button>
              ))}
            </div>
            <Textarea value={composerText} onChange={(event) => setComposerText(event.target.value)} placeholder="Describe the next task step. Use #claude or #kimi only when you need an explicit override." className="min-h-28 rounded-2xl border-[#d9d8d1] bg-[#fbfaf7] text-sm leading-6" />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1 text-xs leading-5 text-[#77766e]">
                <p>AUTO routes internally. Missing credentials block explicitly; the app never silently falls back.</p>
                <Button type="button" variant="outline" onClick={handleRefreshCredentials} disabled={credentialsRefreshMutation.isPending} className="h-8 rounded-full border-[#d9d8d1] bg-white px-3 text-[11px]">
                  {credentialsRefreshMutation.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RotateCcw className="mr-2 h-3 w-3" />}
                  Refresh credential status
                </Button>
              </div>
              <Button onClick={selectedTaskId ? handleSendMessage : handleCreateTask} disabled={isMutating || !composerText.trim()} className="rounded-full bg-[#1f1f1f] px-6 text-white hover:bg-black">
                {isMutating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Workflow className="mr-2 h-4 w-4" />}
                {selectedTaskId ? "Send to Wrapper" : "Create task"}
              </Button>
            </div>
          </div>
        </footer>
      </section>

      <aside className="flex min-h-screen min-w-0 flex-col border-l border-[#d9d8d1] bg-[#f0efeb]">
        <div className="border-b border-[#d9d8d1] p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#77766e]">
            <PanelRight className="h-4 w-4" /> Task files and context
          </div>
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[#20201d]">Right sidebar</h2>
        </div>

        <ScrollArea className="min-h-0 flex-1 p-4">
          <div className="space-y-4">
            <Card className="border-[#deded8] bg-white text-[#242420]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Production safeguards</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs leading-5 text-[#686861]">
                <p>The main UX remains task-first; terminal and filesystem tools are supporting panels, not the orchestration source of truth.</p>
                <p>No provider dropdown. Tags are explicit overrides; AUTO remains orchestration-owned.</p>
                <p>No fake seeded files or memories. Empty states stay honest until real records exist.</p>
                <p>The workspace operates on your task-scoped files and task history; unsupported file actions stay disabled until real file metadata exists.</p>
              </CardContent>
            </Card>

            <Card className="border-[#deded8] bg-white text-[#242420]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><FolderOpen className="h-4 w-4 text-sky-600" /> Task-scoped files</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {taskFiles.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#cfcfc8] bg-[#fbfaf7] p-4 text-xs leading-5 text-[#6d6d65]">No files have been attached to this task yet. Add metadata only when a real storage URL exists.</div>
                ) : (
                  taskFiles.map((file: { id: number; storageUrl: string; relativePath: string; version: number; mimeType: string | null }) => (
                    <a key={file.id} href={file.storageUrl} className="block rounded-2xl border border-[#deded8] bg-[#fbfaf7] p-3 text-sm hover:border-sky-200" target="_blank" rel="noreferrer">
                      <div className="flex items-center gap-2 font-semibold text-[#30302b]"><FileCode2 className="h-4 w-4 text-sky-600" /> <span className="truncate">{file.relativePath}</span></div>
                      <p className="mt-1 text-xs text-[#77766e]">v{file.version} · {file.mimeType ?? "unknown type"}</p>
                    </a>
                  ))
                )}
                <div className="space-y-2 rounded-2xl border border-[#deded8] bg-[#fbfaf7] p-3">
                  <Input value={filePath} onChange={(event) => setFilePath(event.target.value)} className="h-9 rounded-xl bg-white text-xs" placeholder="relative/path.md" />
                  <Input value={fileUrl} onChange={(event) => setFileUrl(event.target.value)} className="h-9 rounded-xl bg-white text-xs" placeholder="/manus-storage/..." />
                  <Button variant="outline" onClick={handleCreateFileMetadata} disabled={!selectedTaskId || !filePath.trim() || !fileUrl.trim() || createFileMetadata.isPending} className="w-full rounded-xl border-[#d9d8d1] bg-white text-xs">
                    <FileText className="mr-2 h-3.5 w-3.5" /> Record file metadata
                  </Button>
                  <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                    <Button type="button" variant="outline" disabled={taskFiles.length === 0} className="h-auto justify-start rounded-xl border-[#d9d8d1] bg-white px-3 py-2 text-left text-[11px] leading-4">
                      <FileCode2 className="mr-2 h-3.5 w-3.5" /> Open real file
                    </Button>
                    <Button type="button" variant="outline" disabled={taskFiles.length === 0} className="h-auto justify-start rounded-xl border-[#d9d8d1] bg-white px-3 py-2 text-left text-[11px] leading-4">
                      <History className="mr-2 h-3.5 w-3.5" /> View AI changes
                    </Button>
                    <Button type="button" variant="outline" disabled={taskFiles.length === 0} className="h-auto justify-start rounded-xl border-[#d9d8d1] bg-white px-3 py-2 text-left text-[11px] leading-4">
                      <RotateCcw className="mr-2 h-3.5 w-3.5" /> Rollback intent
                    </Button>
                    <Button type="button" variant="outline" disabled={taskFiles.length === 0} className="h-auto justify-start rounded-xl border-[#d9d8d1] bg-white px-3 py-2 text-left text-[11px] leading-4">
                      <Library className="mr-2 h-3.5 w-3.5" /> Promote to library
                    </Button>
                  </div>
                  <p className="text-[11px] leading-4 text-[#77766e]">
                    Open, AI-change, rollback, download, and library-promotion intentions unlock only after real task file metadata is recorded; empty states never pretend a file exists.
                  </p>
                </div>
              </CardContent>
            </Card>

            <FilesystemPanel workspaceId={selectedTaskId ?? undefined} />

            <TerminalPanel />

            <Card className="border-[#deded8] bg-white text-[#242420]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><Archive className="h-4 w-4 text-stone-600" /> Master files view</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {allFiles.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#cfcfc8] bg-[#fbfaf7] p-4 text-xs leading-5 text-[#6d6d65]">The all-files index is empty because no real task files have been recorded yet.</div>
                ) : (
                  allFiles.slice(0, 10).map((file: { id: number; relativePath: string; taskId: number; createdAt: number }) => (
                    <div key={file.id} className="rounded-xl border border-[#deded8] bg-[#fbfaf7] p-2 text-xs text-[#5d5d55]">
                      <span className="font-semibold text-[#30302b]">{file.relativePath}</span>
                      <p className="mt-1 text-[#77766e]">Task #{file.taskId} · {compactDate(file.createdAt)}</p>
                      <p className="mt-1 flex items-center gap-1 text-[#77766e]"><Download className="h-3 w-3" /> Download intent follows the recorded storage URL.</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </aside>
    </main>
  );
}
