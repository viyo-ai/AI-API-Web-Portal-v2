import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
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
  Activity,
  Archive,
  Bot,
  Brain,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Download,
  File,
  FileCode2,
  FileText,
  Folder,
  FolderOpen,
  Loader2,
  LockKeyhole,
  MessageSquareText,
  Mic,
  PanelLeft,
  PanelRight,
  Paperclip,
  Plus,
  RotateCcw,
  Search,
  SendHorizontal,
  ShieldCheck,
  Smile,
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

function compactDate(value: number | Date | string | null | undefined) {
  if (!value) return "No timestamp";
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function ownerFacingText(value: string | null | undefined) {
  return (value ?? "")
    .replaceAll("Wrapper LLM", "AI coordinator")
    .replaceAll("Wrapper", "AI coordinator")
    .replaceAll("production three-pane shell", "plain-English AI coding workshop")
    .replaceAll("task-first production shell", "task-first production workspace");
}

function eventTitle(actor: string, eventType: string) {
  if (eventType === "route_decision") return "AI routing decision";
  if (eventType === "credential_status") return "Credential gate";
  if (eventType === "file_event") return "Task file event";
  if (eventType === "message") return actor === "user" ? "You" : actor.toUpperCase();
  if (actor === "claude") return "Claude planning or review";
  if (actor === "kimi") return "Kimi execution draft";
  if (actor === "wrapper") return "AI coordinator";
  return `${actor} · ${eventType.replaceAll("_", " ")}`;
}

type TaskFileRecord = {
  id: number;
  taskId?: number | null;
  scope?: "task" | "global";
  storageUrl: string;
  relativePath: string;
  displayName?: string;
  version?: number;
  mimeType: string | null;
  createdAt?: number;
  updatedAt?: number;
  sizeBytes?: number | null;
};

type AttachedGlobalFileRecord = {
  id: number;
  globalFileId: number;
  taskId: number;
  attachedLabel?: string | null;
  file: TaskFileRecord;
};

function fileNameFromPath(relativePath: string) {
  return relativePath.split("/").filter(Boolean).pop() || relativePath || "Untitled file";
}

function folderNameFromPath(relativePath: string) {
  const parts = relativePath.split("/").filter(Boolean);
  return parts.length > 1 ? parts[0] : "";
}

function readableFileKind(file: TaskFileRecord) {
  const path = file.relativePath.toLowerCase();
  if (file.mimeType?.includes("markdown") || path.endsWith(".md")) return "Markdown document";
  if (file.mimeType?.includes("json") || path.endsWith(".json")) return "JSON file";
  if (path.endsWith(".ts") || path.endsWith(".tsx") || path.endsWith(".js") || path.endsWith(".jsx")) return "Code file";
  if (file.mimeType?.includes("image")) return "Image file";
  if (file.mimeType?.includes("pdf") || path.endsWith(".pdf")) return "PDF document";
  return file.mimeType ?? "File";
}

function sanitizeUploadFileName(fileName: string) {
  return (
    fileName
      .trim()
      .replace(/[/\\]+/g, "-")
      .replace(/[^a-zA-Z0-9._ -]/g, "_")
      .replace(/\s+/g, "-")
      .slice(0, 140) || "uploaded-file"
  );
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("The selected file could not be read."));
    reader.readAsDataURL(file);
  });
}

function activityStepForEvent(event: ThreadEvent) {
  const baseDescription = ownerFacingText(event.content);
  if (event.eventType === "route_decision") {
    return { title: "AI coordinator chose the next worker", description: "The route for this turn was checked or selected. Provider availability remains visible in the credential status card.", tone: "slate" };
  }
  if (event.eventType === "context_snapshot") {
    return { title: "Shared context was prepared", description: "The task thread, saved memory, and task files were gathered so Claude and Kimi work from the same context.", tone: "sky" };
  }
  if (event.eventType === "model_start") {
    return { title: "AI worker started", description: baseDescription, tone: "amber" };
  }
  if (event.actor === "claude" && event.eventType === "model_review") {
    return { title: "Claude prepared a plan or review", description: "Claude added planning or review guidance for this task turn.", tone: "violet" };
  }
  if (event.actor === "claude") {
    return { title: "Claude answered", description: "Claude added an owner-visible response to the task thread.", tone: "violet" };
  }
  if (event.actor === "kimi") {
    return { title: "Kimi drafted execution", description: "Kimi added the implementation-oriented response for this task turn.", tone: "cyan" };
  }
  if (event.eventType === "file_event") {
    return { title: "Task files were updated", description: baseDescription, tone: "emerald" };
  }
  if (event.eventType === "error" || event.status === "failed" || event.status === "blocked") {
    return { title: "A worker needs attention", description: ownerProviderFailureMessage(event) ?? baseDescription, tone: "rose" };
  }
  if (event.eventType === "status") {
    return { title: "Task turn was saved", description: "The latest model output was recorded in this task timeline.", tone: "emerald" };
  }
  return { title: eventTitle(event.actor, event.eventType), description: baseDescription, tone: "slate" };
}

const activityDotTone: Record<string, string> = {
  amber: "bg-amber-400",
  cyan: "bg-cyan-400",
  emerald: "bg-emerald-500",
  rose: "bg-rose-500",
  sky: "bg-sky-500",
  slate: "bg-slate-400",
  violet: "bg-violet-500",
};

type ThreadEvent = {
  id: number;
  taskId?: number;
  ownerUserId?: number;
  actor: string;
  eventType: string;
  status: string;
  content: string;
  metadataJson?: string | null;
  createdAt: number | Date | string;
};

function eventTimestamp(event: ThreadEvent) {
  return new Date(event.createdAt).getTime() || 0;
}

function newestFirst(a: ThreadEvent, b: ThreadEvent) {
  const delta = eventTimestamp(b) - eventTimestamp(a);
  return delta || b.id - a.id;
}

function oldestFirst(a: ThreadEvent, b: ThreadEvent) {
  const delta = eventTimestamp(a) - eventTimestamp(b);
  return delta || a.id - b.id;
}

function isOwnerVisibleEvent(event: ThreadEvent) {
  if (event.eventType === "message") return true;
  if ((event.actor === "claude" || event.actor === "kimi") && ["model_result", "model_review"].includes(event.eventType)) return true;
  return false;
}

function ownerEventTitle(event: ThreadEvent) {
  if (event.eventType === "message" && event.actor === "user") return "You";
  if (event.actor === "claude") return "Claude";
  if (event.actor === "kimi") return "Kimi";
  return eventTitle(event.actor, event.eventType);
}

function ownerEventBody(event: ThreadEvent) {
  return ownerFacingText(event.content);
}

function ownerProviderFailureMessage(event: ThreadEvent | undefined) {
  if (!event) return null;
  const content = event.content.toLowerCase();
  if (content.includes("missing credentials") || content.includes("credential") || content.includes("not connected")) {
    return "This task can’t start yet because Claude or Kimi is not connected. Open the owner credentials dashboard or update the project secrets, then retry the message.";
  }
  if (content.includes("kimi") && (content.includes("empty") || content.includes("usable text"))) {
    return "Kimi did not return usable text for this turn. No silent fallback was used; retry the message or send it with #claude while Kimi is checked.";
  }
  return "The AI provider did not return a usable answer for this turn. No silent fallback was used; retry after checking credentials or choose an explicit #claude or #kimi route.";
}

export default function Home() {
  const { user, loading, error, isAuthenticated, logout } = useAuth();
  const loginUrl = useMemo(() => getLoginUrl(), []);
  const utils = trpc.useUtils();

  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [taskTitle, setTaskTitle] = useState("AI coding workshop task");
  const [composerText, setComposerText] = useState("");
  const [routeMode, setRouteMode] = useState<"auto" | "kimi" | "claude">("auto");
  const [searchTerm, setSearchTerm] = useState("");
  const [filePath, setFilePath] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [showAdvancedTools, setShowAdvancedTools] = useState(false);
  const [showThreadDetails, setShowThreadDetails] = useState(false);
  const [workspaceNotice, setWorkspaceNotice] = useState("");
  const [isFileDragActive, setIsFileDragActive] = useState(false);
  const [isGlobalFileDragActive, setIsGlobalFileDragActive] = useState(false);
  const [uploadScope, setUploadScope] = useState<"task" | "global">("task");
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const globalUploadInputRef = useRef<HTMLInputElement | null>(null);

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
  const attachedGlobalFilesQuery = trpc.files.listGlobalForTask.useQuery(filesInput, { enabled: isAuthenticated && Boolean(selectedTaskId) });
  const allFilesInput = useMemo(() => ({ limit: 400 }), []);
  const allFilesQuery = trpc.files.listAll.useQuery(allFilesInput, { enabled: isAuthenticated });
  const globalFilesInput = useMemo(() => ({ limit: 200 }), []);
  const globalFilesQuery = trpc.files.listGlobal.useQuery(globalFilesInput, { enabled: isAuthenticated });
  const memoryInput = useMemo(() => ({ limit: 40 }), []);
  const memoryQuery = trpc.memory.list.useQuery(memoryInput, { enabled: isAuthenticated });
  const credentialsQuery = trpc.credentials.status.useQuery(undefined, { enabled: isAuthenticated, refetchInterval: 15000 });

  const createTask = trpc.tasks.create.useMutation();
  const updateTaskStatus = trpc.tasks.updateStatus.useMutation();
  const submitMessage = trpc.orchestration.submitMessage.useMutation();
  const createFileMetadata = trpc.files.createMetadata.useMutation();
  const uploadWorkspaceFileMutation = trpc.filesystem.upload.useMutation();
  const attachGlobalToTaskMutation = trpc.files.attachGlobalToTask.useMutation();
  const credentialsRefreshMutation = trpc.credentials.refresh.useMutation();

  const selectedThread = threadQuery.data;
  const selectedTask = selectedThread?.task ?? tasks.find((task) => task.id === selectedTaskId) ?? null;
  const events = ((selectedThread?.events ?? []) as ThreadEvent[]);
  const ownerVisibleEvents = useMemo(() => events.filter(isOwnerVisibleEvent).sort(oldestFirst), [events]);
  const technicalEvents = useMemo(() => events.filter((event) => !isOwnerVisibleEvent(event)).sort(newestFirst), [events]);
  const latestProviderFailure = useMemo(() => technicalEvents.find((event) => event.status === "failed" || event.status === "blocked"), [technicalEvents]);
  const providerFailureCopy = ownerProviderFailureMessage(latestProviderFailure);
  const taskFiles = (taskFilesQuery.data ?? []) as TaskFileRecord[];
  const attachedGlobalFiles = (attachedGlobalFilesQuery.data ?? []) as AttachedGlobalFileRecord[];
  const allFiles = (allFilesQuery.data ?? []) as TaskFileRecord[];
  const globalFiles = (globalFilesQuery.data ?? []) as TaskFileRecord[];
  const memories = memoryQuery.data ?? [];
  const credentials = credentialsQuery.data?.runtimeStates ?? [];

  const filteredTasks = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return tasks;
    return tasks.filter((task) => `${task.title} ${task.summary ?? ""} ${task.status}`.toLowerCase().includes(query));
  }, [tasks, searchTerm]);

  const fileExplorerGroups = useMemo(() => {
    const folders = new Map<string, TaskFileRecord[]>();
    const rootFiles: TaskFileRecord[] = [];
    for (const file of taskFiles) {
      const folder = folderNameFromPath(file.relativePath);
      if (!folder) {
        rootFiles.push(file);
        continue;
      }
      folders.set(folder, [...(folders.get(folder) ?? []), file]);
    }
    return {
      folders: Array.from(folders.entries()).map(([name, files]) => ({ name, files })),
      rootFiles,
    };
  }, [taskFiles]);

  const workerActivityItems = useMemo(() => {
    return events
      .filter((event) => event.eventType !== "message")
      .sort(newestFirst)
      .slice(0, 8)
      .map((event) => ({ ...activityStepForEvent(event), id: event.id, status: event.status, createdAt: event.createdAt }));
  }, [events]);

  const isMutating = createTask.isPending || updateTaskStatus.isPending || submitMessage.isPending || createFileMetadata.isPending || uploadWorkspaceFileMutation.isPending || attachGlobalToTaskMutation.isPending;

  async function refreshWorkspace() {
    await Promise.all([
      utils.tasks.list.invalidate(),
      utils.tasks.thread.invalidate(),
      utils.files.listForTask.invalidate(),
      utils.files.listGlobalForTask.invalidate(),
      utils.files.listAll.invalidate(),
      utils.files.listGlobal.invalidate(),
      utils.memory.list.invalidate(),
      utils.credentials.status.invalidate(),
      utils.filesystem.tree.invalidate(),
    ]);
  }

  async function handleRefreshCredentials() {
    await credentialsRefreshMutation.mutateAsync({ providers: ["claude", "kimi"] });
    await utils.credentials.status.invalidate();
  }

  async function createTaskRecordOnly() {
    const cleanTitle = taskTitle.trim() || "Untitled production task";
    const created = await createTask.mutateAsync({
      title: cleanTitle,
      summary: "Task-first v2 workspace item created from the plain-English AI coding workshop.",
      routeMode,
    });
    if (!created) return null;
    setSelectedTaskId(created.task.id);
    await refreshWorkspace();
    return created.task.id as number;
  }

  async function handleCreateTask() {
    await createTaskRecordOnly();
  }

  async function handleSendMessage() {
    const cleanMessage = composerText.trim();
    if (!cleanMessage) return;
    const taskId = selectedTaskId ?? (await createTaskRecordOnly());
    if (!taskId) return;
    await submitMessage.mutateAsync({ taskId, message: cleanMessage, routeMode });
    setComposerText("");
    await refreshWorkspace();
  }

  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!isMutating && composerText.trim()) {
        void handleSendMessage();
      }
    }
  }

  async function handleArchiveTask(taskId: number, title: string) {
    const confirmed = window.confirm(`Archive task "${title}"? It will leave the live task list but stay recoverable in task history.`);
    if (!confirmed) return;
    await updateTaskStatus.mutateAsync({ taskId, status: "archived" });
    if (selectedTaskId === taskId) setSelectedTaskId(null);
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
    setWorkspaceNotice(`Connected ${filePath.trim()} to this task folder.`);
    await refreshWorkspace();
  }

  function openUploadPicker(scope: "task" | "global" = "task") {
    if (scope === "task" && !selectedTaskId) {
      const message = "Create or select a task before uploading files.";
      setWorkspaceNotice(message);
      toast.warning(message);
      return;
    }
    setUploadScope(scope);
    if (scope === "global") {
      globalUploadInputRef.current?.click();
      return;
    }
    uploadInputRef.current?.click();
  }

  function showComingSoon(feature: "emoji reactions" | "voice input") {
    const message = `${feature} are coming soon. For now, send text or upload files with the plus and paperclip buttons.`;
    setWorkspaceNotice(message);
    toast.info(message);
  }

  async function uploadSelectedFile(file: File, scope: "task" | "global") {
    const taskId = selectedTaskId;
    if (scope === "task" && !taskId) {
      const message = "Create or select a task before uploading files.";
      setWorkspaceNotice(message);
      toast.warning(message);
      return;
    }
    try {
      const safeName = sanitizeUploadFileName(file.name);
      const prefix = scope === "global" ? "global-files" : "uploads";
      const relativePath = `${prefix}/${Date.now()}-${safeName}`;
      const destination = scope === "global" ? "Global Files" : "this task folder";
      setWorkspaceNotice(`Uploading ${file.name} to ${destination}...`);
      const base64Content = await readFileAsBase64(file);
      await uploadWorkspaceFileMutation.mutateAsync({
        taskId: scope === "global" ? null : taskId,
        scope,
        relativePath,
        base64Content,
        mimeType: file.type || "application/octet-stream",
      });
      const message = `Uploaded ${file.name} to ${destination}.`;
      setWorkspaceNotice(message);
      toast.success(message);
      await refreshWorkspace();
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "The file could not be uploaded. Please try again.";
      setWorkspaceNotice(message);
      toast.error(message);
    }
  }

  async function uploadSelectedTaskFile(file: File) {
    await uploadSelectedFile(file, "task");
  }

  async function uploadSelectedGlobalFile(file: File) {
    await uploadSelectedFile(file, "global");
  }

  function handleUploadInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void uploadSelectedFile(file, uploadScope);
  }

  function handleGlobalUploadInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void uploadSelectedGlobalFile(file);
  }

  function handleFileDragOver(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    if (selectedTaskId) setIsFileDragActive(true);
  }

  function handleFileDragLeave(event: React.DragEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsFileDragActive(false);
    }
  }

  function handleFileDrop(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsFileDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void uploadSelectedTaskFile(file);
  }

  function handleGlobalFileDragOver(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsGlobalFileDragActive(true);
  }

  function handleGlobalFileDragLeave(event: React.DragEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsGlobalFileDragActive(false);
    }
  }

  function handleGlobalFileDrop(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsGlobalFileDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void uploadSelectedGlobalFile(file);
  }

  async function attachGlobalFileToSelectedTask(file: TaskFileRecord) {
    if (!selectedTaskId) {
      const message = "Select a task before attaching a Global File.";
      setWorkspaceNotice(message);
      toast.warning(message);
      return;
    }
    try {
      await attachGlobalToTaskMutation.mutateAsync({ taskId: selectedTaskId, globalFileId: file.id, attachedLabel: file.displayName ?? fileNameFromPath(file.relativePath) });
      const message = `${file.displayName ?? fileNameFromPath(file.relativePath)} is now attached to this task.`;
      setWorkspaceNotice(message);
      toast.success(message);
      await refreshWorkspace();
    } catch (error) {
      const message = error instanceof Error ? error.message : "The Global File could not be attached. Please try again.";
      setWorkspaceNotice(message);
      toast.error(message);
    }
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
                A plain-English AI coding workshop for Claude and Kimi.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-[#66665f]">
                Log in to run the approved v2 workflow: live tasks and global memory on the left, a task thread in the center, and task files on the right. Claude and Kimi are coordinated behind the scenes with explicit credential gates and no silent provider fallback.
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
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#76766e]">AI coding workshop v2</p>
                  <h2 className="text-2xl font-semibold tracking-[-0.03em] text-[#1f1f1f]">Plain-English planning before execution</h2>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {["Claude plans and reviews", "Kimi drafts execution", "AUTO coordinates internally", "Credentials block explicitly"].map((step) => (
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
    <main className="grid h-screen w-full min-w-0 overflow-hidden overflow-x-hidden bg-[#f7f6f2] text-[#242420] lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_390px]">
      <aside className="flex h-screen min-h-0 min-w-0 flex-col overflow-hidden border-r border-[#d9d8d1] bg-[#f0efeb]">
        <div className="border-b border-[#d9d8d1] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-lg font-semibold tracking-[-0.03em] text-[#1f1f1f]">
              <Bot className="h-5 w-5 shrink-0" /> <span className="truncate">manus</span>
            </div>
            <Badge className="rounded-full border-emerald-200 bg-emerald-100 text-emerald-800">v2</Badge>
          </div>
          <p className="mt-2 text-xs leading-5 text-[#67675f]">Task-first production workspace with an explicit Auto, Kimi, or Claude route selector in the center composer.</p>
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

        <ScrollArea className="min-h-0 min-w-0 flex-1 px-3 py-3">
          <div className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#77766e]">
            <PanelLeft className="h-3.5 w-3.5" /> Live tasks
          </div>
          <div className="space-y-2">
            {tasksQuery.isLoading ? (
              <div className="rounded-2xl border border-[#d9d8d1] bg-white p-4 text-sm text-[#6d6d65]">Loading tasks...</div>
            ) : filteredTasks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#cfcfc8] bg-white/70 p-4 text-sm leading-6 text-[#6d6d65]">
                No live tasks yet. Create one from the title and task message to establish Claude/Kimi coordination context.
              </div>
            ) : (
              filteredTasks.map((task) => (
                <article
                  key={task.id}
                  data-testid="left-nav-task-card"
                  className={`max-w-full overflow-hidden rounded-2xl border p-3 text-left transition ${selectedTaskId === task.id ? "border-sky-300 bg-white shadow-sm" : "border-transparent bg-transparent hover:bg-white/70"}`}
                >
                  <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                    <button type="button" onClick={() => setSelectedTaskId(task.id)} className="min-w-0 overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200">
                      <p className="truncate text-sm font-semibold text-[#2c2c28]">{task.title}</p>
                    </button>
                    <Badge variant="outline" className={`max-w-[96px] shrink-0 truncate rounded-full text-[10px] ${statusTone[task.status] ?? statusTone.active}`}>{task.status}</Badge>
                  </div>
                  <button type="button" onClick={() => setSelectedTaskId(task.id)} className="mt-2 block w-full min-w-0 overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200">
                    <p className="line-clamp-2 text-xs leading-5 text-[#66665f]">{ownerFacingText(task.summary) || "No summary recorded yet."}</p>
                    <p className="mt-2 truncate text-[11px] text-[#9a998f]">Updated {compactDate(task.updatedAt)}</p>
                  </button>
                  <div className="mt-3 flex min-w-0 justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleArchiveTask(task.id, task.title)}
                      disabled={updateTaskStatus.isPending}
                      aria-label={`Archive task ${task.title}`}
                      className="h-8 rounded-full border-[#d9d8d1] bg-white px-3 text-[11px] text-[#66665f] hover:text-[#2c2c28]"
                    >
                      <Archive className="mr-1.5 h-3.5 w-3.5" /> Archive
                    </Button>
                  </div>
                </article>
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

      <section className="flex h-screen min-h-0 min-w-0 flex-col bg-[#fbfaf7]">
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

        <div className="min-h-0 flex-1 overflow-y-auto p-5" data-testid="center-task-thread-scroll">
          <div className="mx-auto max-w-4xl space-y-4">
            {selectedTaskId ? (
              <div data-testid="handoff-indicator" className="flex flex-wrap items-center gap-2 rounded-2xl border border-sky-100 bg-sky-50/80 px-3 py-2 text-xs leading-5 text-[#4f5f68]">
                <Sparkles className="h-4 w-4 text-sky-600" />
                <span className="font-semibold text-[#26333a]">Claude → shared task context → Kimi</span>
                <span>Claude’s plan can be passed into Kimi automatically during Auto coordination; both workers read the same task thread, saved memory, and task files for the turn.</span>
              </div>
            ) : null}
            {!selectedTaskId ? (
              <div className="flex min-h-[42vh] items-end justify-center pb-8 text-center text-sm leading-6 text-[#77766e]">
                <p className="max-w-lg">Start typing below. A task record is created quietly, and the first submitted message starts the selected model route.</p>
              </div>
            ) : threadQuery.isLoading ? (
              <div className="rounded-2xl border border-[#deded8] bg-white p-5 text-sm text-[#6d6d65]">Loading task thread...</div>
            ) : events.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#cfcfc8] bg-white p-8 text-center text-sm leading-6 text-[#6d6d65]">This task has no owner messages yet. Creating it only made the task record; send the first message to initialize Claude Opus 4.7 and Kimi K2.6 through the coordinator.</div>
            ) : (
              <div className="space-y-4">
                {ownerVisibleEvents.length === 0 && !providerFailureCopy ? (
                  <div className="rounded-2xl border border-dashed border-[#cfcfc8] bg-white p-8 text-center text-sm leading-6 text-[#6d6d65]">
                    No owner-facing task message is ready yet. Technical setup records are available below if you need them.
                  </div>
                ) : null}

                {technicalEvents.length > 0 ? (
                  <div className="rounded-3xl border border-[#deded8] bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-[#2b2b27]">Technical history</h3>
                        <p className="mt-1 text-xs leading-5 text-[#77766e]">Routing decisions, context snapshots, and model-call records are hidden above the normal owner chat so the newest message stays closest to the type box.</p>
                      </div>
                      <Button type="button" variant="outline" onClick={() => setShowThreadDetails((value) => !value)} className="rounded-full border-[#d9d8d1] bg-white text-xs">
                        {showThreadDetails ? "Hide technical details" : `Show technical details (${technicalEvents.length})`}
                      </Button>
                    </div>
                    {showThreadDetails ? (
                      <div className="mt-4 space-y-3">
                        {technicalEvents.map((event) => (
                          <article key={event.id} className={`rounded-2xl border p-3 ${actorTone[event.actor] ?? actorTone.system}`}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <h4 className="text-xs font-semibold text-[#2b2b27]">{eventTitle(event.actor, event.eventType)}</h4>
                              <div className="flex items-center gap-2 text-[11px] text-[#77766e]">
                                <Clock3 className="h-3 w-3" /> {compactDate(event.createdAt)}
                                <Badge variant="outline" className="rounded-full text-[10px]">{event.status}</Badge>
                              </div>
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-[#55554e]">{ownerFacingText(event.content)}</p>
                          </article>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {ownerVisibleEvents.map((event) => {
                  const isUser = event.actor === "user";
                  return (
                    <div key={event.id} className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
                      <div
                        data-testid={isUser ? "chat-bubble-user" : "chat-bubble-ai"}
                        className={`max-w-[78%] rounded-2xl border px-3 py-2 text-[13px] leading-5 shadow-sm sm:max-w-[65%] ${
                          isUser
                            ? "rounded-br-md border-[#242420] bg-[#242420] text-white"
                            : `${actorTone[event.actor] ?? actorTone.system} rounded-bl-md text-[#30302b]`
                        }`}
                      >
                        <div className={`mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] ${isUser ? "justify-end text-white/70" : "justify-between text-[#77766e]"}`}>
                          <span>{ownerEventTitle(event)}</span>
                          {event.status === "blocked" || event.status === "failed" ? <CircleAlert className="h-3 w-3 text-rose-500" /> : <CheckCircle2 className={`h-3 w-3 ${isUser ? "text-white/70" : "text-emerald-600"}`} />}
                        </div>
                        <p className={`whitespace-pre-wrap ${isUser ? "text-white" : "text-[#34342f]"}`}>{ownerEventBody(event)}</p>
                        <div className={`mt-1 text-[10px] ${isUser ? "text-right text-white/60" : "text-[#77766e]"}`}>{compactDate(event.createdAt)}</div>
                      </div>
                    </div>
                  );
                })}

                {providerFailureCopy ? (
                  <article className="rounded-3xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm" data-testid="owner-provider-recovery">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <CircleAlert className="h-4 w-4 text-amber-700" />
                        <h3 className="text-sm font-semibold text-[#2b2b27]">Plain-English recovery note</h3>
                      </div>
                      <Badge variant="outline" className="rounded-full border-amber-300 bg-white text-[10px] text-amber-800">needs attention</Badge>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#3e3e39]">{providerFailureCopy}</p>
                  </article>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <footer className="shrink-0 border-t border-[#deded8] bg-white/95 px-4 py-3 shadow-[0_-18px_45px_rgba(31,31,31,0.06)] backdrop-blur">
          <div className="mx-auto max-w-4xl">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] leading-4 text-[#77766e]">
              <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Model route">
                {([
                  { value: "auto", label: "Auto (Default)", detail: "dual" },
                  { value: "kimi", label: "Kimi", detail: "K2.6" },
                  { value: "claude", label: "Claude", detail: "Opus 4.7" },
                ] as const).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={routeMode === option.value}
                    onClick={() => setRouteMode(option.value)}
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${routeMode === option.value ? "border-[#1f1f1f] bg-[#1f1f1f] text-white" : "border-[#d9d8d1] bg-white text-[#66665f] hover:border-sky-300 hover:text-[#242420]"}`}
                  >
                    {option.label} <span className="font-normal opacity-75">{option.detail}</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline">Enter sends · Shift+Enter adds a line</span>
                <Button type="button" variant="outline" onClick={handleRefreshCredentials} disabled={credentialsRefreshMutation.isPending} className="h-7 rounded-full border-[#d9d8d1] bg-white px-2.5 text-[11px]">
                  {credentialsRefreshMutation.isPending ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <RotateCcw className="mr-1.5 h-3 w-3" />}
                  Credentials
                </Button>
              </div>
            </div>

            <div className="flex items-end gap-2 rounded-[1.65rem] border border-[#d9d8d1] bg-[#fbfaf7] p-2 shadow-sm focus-within:border-sky-300 focus-within:ring-2 focus-within:ring-sky-100" data-testid="manus-style-composer">
              <input ref={uploadInputRef} type="file" className="sr-only" aria-label="Upload task file" onChange={handleUploadInputChange} />
              <input ref={globalUploadInputRef} type="file" className="sr-only" aria-label="Upload Global Files file" onChange={handleGlobalUploadInputChange} />
              <div className="hidden items-center gap-1 pb-1 sm:flex">
                <button type="button" onClick={() => openUploadPicker("task")} disabled={uploadWorkspaceFileMutation.isPending} className="flex h-8 w-8 items-center justify-center rounded-full text-[#77766e] transition hover:bg-white hover:text-[#242420] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 disabled:opacity-50" aria-label="Add file to task">
                  <Plus className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => openUploadPicker("task")} disabled={uploadWorkspaceFileMutation.isPending} className="flex h-8 w-8 items-center justify-center rounded-full text-[#77766e] transition hover:bg-white hover:text-[#242420] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 disabled:opacity-50" aria-label="Attach file to task">
                  <Paperclip className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => showComingSoon("emoji reactions")} className="flex h-8 w-8 items-center justify-center rounded-full text-[#77766e] transition hover:bg-white hover:text-[#242420] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200" aria-label="Emoji reactions coming soon">
                  <Smile className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => showComingSoon("voice input")} className="flex h-8 w-8 items-center justify-center rounded-full text-[#77766e] transition hover:bg-white hover:text-[#242420] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200" aria-label="Voice input coming soon">
                  <Mic className="h-4 w-4" />
                </button>
              </div>
              <Textarea
                value={composerText}
                onChange={(event) => setComposerText(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder="Send message to the task..."
                aria-label="Task message"
                className="max-h-36 min-h-11 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm leading-6 shadow-none focus-visible:ring-0"
              />
              <Button type="button" onClick={handleSendMessage} disabled={isMutating || !composerText.trim()} className="mb-1 h-9 w-9 shrink-0 rounded-full bg-[#1f1f1f] p-0 text-white hover:bg-black" aria-label="Send message">
                {isMutating ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
              </Button>
            </div>
            {workspaceNotice ? <p className="mt-2 text-xs leading-5 text-[#66665f]" role="status" aria-live="polite">{workspaceNotice}</p> : null}
          </div>
        </footer>
      </section>

      <aside className="flex h-screen min-h-0 min-w-0 flex-col overflow-hidden border-l border-[#d9d8d1] bg-[#f0efeb] lg:col-span-2 xl:col-span-1">
        <div className="border-b border-[#d9d8d1] p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#77766e]">
            <PanelRight className="h-4 w-4" /> Files and activity
          </div>
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[#20201d]">Task folder</h2>
        </div>

        <ScrollArea className="min-h-0 min-w-0 flex-1 p-4">
          <div className="space-y-4">
            <Card className="border-[#deded8] bg-white text-[#242420]" data-testid="handoff-explanation">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><Workflow className="h-4 w-4 text-sky-600" /> Claude and Kimi handoff</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs leading-5 text-[#686861]">
                <p><span className="font-semibold text-[#2f2f2a]">No memory is lost between workers.</span> Every turn assembles the selected task thread, saved memory, and task-file list before any provider call.</p>
                <div className="rounded-2xl border border-sky-100 bg-sky-50/80 p-3">
                  <p className="font-semibold text-[#26333a]">Auto route: Claude plans → Kimi executes → Claude can review.</p>
                  <p className="mt-1">When Auto chooses a dual path, Kimi receives Claude’s plan in the same execution turn instead of starting from a blank conversation.</p>
                </div>
                <p className="text-[11px] text-[#77766e]">Credential gates remain explicit. If either worker is unavailable, the task blocks visibly rather than silently switching providers.</p>
              </CardContent>
            </Card>

            <Card className="border-[#deded8] bg-white text-[#242420]" data-testid="worker-action-log">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4 text-emerald-600" /> AI Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-3 text-xs leading-5 text-[#4f6756]">This is a read-only activity feed for the AI coordinator, Claude, and Kimi. It does not run commands; terminal access remains a separate advanced diagnostic tool.</p>
                {workerActivityItems.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#cfcfc8] bg-[#fbfaf7] p-4 text-xs leading-5 text-[#6d6d65]">No worker activity has been recorded for this task yet. Send a message to start the first Claude or Kimi turn.</div>
                ) : (
                  <div className="space-y-2">
                    {workerActivityItems.map((item) => (
                      <div key={item.id} className="flex gap-3 rounded-2xl border border-[#ededdf] bg-[#fbfaf7] p-3">
                        <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${activityDotTone[item.tone] ?? activityDotTone.slate}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-[#30302b]">{item.title}</p>
                          <p className="mt-1 line-clamp-3 text-xs leading-5 text-[#686861]">{item.description}</p>
                          <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[#8a8980]">{item.status} · {compactDate(item.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Button type="button" variant="outline" onClick={() => setShowThreadDetails((value) => !value)} disabled={technicalEvents.length === 0} className="w-full rounded-xl border-[#d9d8d1] bg-white text-xs">
                  {showThreadDetails ? "Hide activity details" : `Show activity details (${technicalEvents.length})`}
                </Button>
                {showThreadDetails && technicalEvents.length > 0 ? (
                  <div className="space-y-2 rounded-2xl border border-[#deded8] bg-[#fbfaf7] p-3" data-testid="worker-technical-details">
                    {technicalEvents.slice(0, 6).map((event) => (
                      <div key={event.id} className="text-[11px] leading-5 text-[#66665f]">
                        <span className="font-semibold text-[#30302b]">{eventTitle(event.actor, event.eventType)}:</span> {ownerFacingText(event.content)}
                      </div>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card
              className={`border-[#deded8] bg-white text-[#242420] transition ${isFileDragActive ? "border-sky-300 ring-2 ring-sky-100" : ""}`}
              data-testid="windows-file-manager"
              aria-label="Task files drop zone"
              onDragOver={handleFileDragOver}
              onDragLeave={handleFileDragLeave}
              onDrop={handleFileDrop}
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><FolderOpen className="h-4 w-4 text-amber-600" /> Task files</CardTitle>
                <div className="mt-2 flex items-center gap-1 rounded-xl border border-[#deded8] bg-[#fbfaf7] px-3 py-2 text-[11px] text-[#66665f]">
                  <Folder className="h-3.5 w-3.5 text-amber-600" /> This task <span>/</span> Files
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className={`rounded-2xl border border-dashed p-3 text-xs leading-5 transition ${isFileDragActive ? "border-sky-300 bg-sky-50 text-sky-800" : "border-[#cfcfc8] bg-[#fbfaf7] text-[#6d6d65]"}`} data-testid="task-file-drop-zone">
                  <p className="font-semibold text-[#30302b]">Drop files here or use plus/paperclip.</p>
                  <p className="mt-1">Uploads are stored in the selected task folder and then appear in this file list.</p>
                  <Button type="button" variant="outline" onClick={() => openUploadPicker("task")} disabled={!selectedTaskId || uploadWorkspaceFileMutation.isPending} className="mt-3 w-full rounded-xl border-[#d9d8d1] bg-white text-xs">
                    {uploadWorkspaceFileMutation.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Paperclip className="mr-2 h-3.5 w-3.5" />}
                    Upload file
                  </Button>
                </div>
                {taskFiles.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#cfcfc8] bg-[#fbfaf7] p-4 text-xs leading-5 text-[#6d6d65]">This task folder is empty. Files will appear here only after a real storage-backed file record exists.</div>
                ) : (
                  <div className="space-y-2 rounded-2xl border border-[#deded8] bg-[#fbfaf7] p-2">
                    {fileExplorerGroups.folders.map((folder) => (
                      <div key={folder.name} className="rounded-xl bg-white/80 p-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-[#30302b]">
                          <Folder className="h-4 w-4 text-amber-600" /> <span className="truncate">{folder.name}</span>
                          <Badge variant="outline" className="ml-auto rounded-full text-[10px]">{folder.files.length} file{folder.files.length === 1 ? "" : "s"}</Badge>
                        </div>
                        <div className="mt-2 space-y-1 pl-4">
                          {folder.files.map((file) => (
                            <a key={file.id} href={file.storageUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs text-[#4d4d46] hover:bg-sky-50" aria-label={`Open or download ${file.relativePath}`}>
                              <File className="h-3.5 w-3.5 text-sky-600" />
                              <span className="min-w-0 flex-1 truncate">{fileNameFromPath(file.relativePath)}</span>
                              <span className="hidden text-[10px] text-[#8a8980] sm:inline">v{file.version} · {readableFileKind(file)}</span>
                              <Download className="h-3.5 w-3.5 text-[#8a8980]" />
                            </a>
                          ))}
                        </div>
                      </div>
                    ))}
                    {fileExplorerGroups.rootFiles.map((file) => (
                      <a key={file.id} href={file.storageUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl bg-white/80 px-3 py-2 text-xs text-[#4d4d46] hover:bg-sky-50" aria-label={`Open or download ${file.relativePath}`}>
                        <FileCode2 className="h-4 w-4 text-sky-600" />
                        <span className="min-w-0 flex-1 truncate">{fileNameFromPath(file.relativePath)}</span>
                        <span className="hidden text-[10px] text-[#8a8980] sm:inline">v{file.version} · {readableFileKind(file)}</span>
                        <Download className="h-3.5 w-3.5 text-[#8a8980]" />
                      </a>
                    ))}
                  </div>
                )}
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3 text-xs leading-5 text-emerald-800" data-testid="attached-global-files">
                  <p className="font-semibold text-[#30302b]">Attached Global Files</p>
                  {attachedGlobalFiles.length === 0 ? (
                    <p className="mt-1">No Global Files are attached to this task yet. Use “Attach to task” in Global Files below to reuse shared context without uploading another copy.</p>
                  ) : (
                    <div className="mt-2 space-y-1">
                      {attachedGlobalFiles.map((link) => (
                        <a key={link.id} href={link.file.storageUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg bg-white/80 px-2 py-2 text-[#345343] hover:bg-white" aria-label={`Open attached Global File ${link.file.relativePath}`}>
                          <File className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="min-w-0 flex-1 truncate">{link.attachedLabel ?? link.file.displayName ?? fileNameFromPath(link.file.relativePath)}</span>
                          <Badge variant="outline" className="rounded-full border-emerald-200 text-[10px]">Global</Badge>
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-[#deded8] bg-[#fbfaf7] p-3 text-xs leading-5 text-[#686861]">
                  <p className="font-semibold text-[#30302b]">Need to add a file?</p>
                  <p className="mt-1">Files now appear here after plus, paperclip, or drag-and-drop upload. Manual storage-link entry is kept as an advanced maintenance action so the normal folder view stays non-technical.</p>
                  <details className="mt-3 rounded-xl border border-[#deded8] bg-white p-3">
                    <summary className="cursor-pointer text-xs font-semibold text-[#30302b]">Advanced: connect a stored file manually</summary>
                    <div className="mt-3 space-y-2">
                      <Input value={filePath} onChange={(event) => setFilePath(event.target.value)} className="h-9 rounded-xl bg-white text-xs" placeholder="relative/path.md" />
                      <Input value={fileUrl} onChange={(event) => setFileUrl(event.target.value)} className="h-9 rounded-xl bg-white text-xs" placeholder="/manus-storage/..." />
                      <Button variant="outline" onClick={handleCreateFileMetadata} disabled={!selectedTaskId || !filePath.trim() || !fileUrl.trim() || createFileMetadata.isPending} className="w-full rounded-xl border-[#d9d8d1] bg-white text-xs">
                        <FileText className="mr-2 h-3.5 w-3.5" /> Add file to this task
                      </Button>
                      <p className="text-[11px] leading-4 text-[#77766e]">Advanced fields record an existing storage-backed file reference only; they do not create fake files or run workspace commands.</p>
                    </div>
                  </details>
                </div>
              </CardContent>
            </Card>

            <Card
              className={`border-[#deded8] bg-white text-[#242420] transition ${isGlobalFileDragActive ? "border-emerald-300 ring-2 ring-emerald-100" : ""}`}
              data-testid="global-file-library"
              aria-label="Global Files drop zone"
              onDragOver={handleGlobalFileDragOver}
              onDragLeave={handleGlobalFileDragLeave}
              onDrop={handleGlobalFileDrop}
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><Archive className="h-4 w-4 text-emerald-600" /> Global Files</CardTitle>
                <div className="mt-2 flex items-center gap-1 rounded-xl border border-emerald-100 bg-emerald-50/80 px-3 py-2 text-[11px] text-emerald-800">
                  <Folder className="h-3.5 w-3.5 text-emerald-600" /> Reusable across tasks <span>/</span> Global Files
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className={`rounded-2xl border border-dashed p-3 text-xs leading-5 transition ${isGlobalFileDragActive ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-[#cfcfc8] bg-[#fbfaf7] text-[#6d6d65]"}`} data-testid="global-file-drop-zone">
                  <p className="font-semibold text-[#30302b]">Drop reusable files here or choose upload.</p>
                  <p className="mt-1">Global Files are owner-scoped reusable references. Attach them to a task when the task should use the same brief, screenshot, standard, or source file.</p>
                  <Button type="button" variant="outline" onClick={() => openUploadPicker("global")} disabled={uploadWorkspaceFileMutation.isPending} className="mt-3 w-full rounded-xl border-[#d9d8d1] bg-white text-xs">
                    {uploadWorkspaceFileMutation.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Paperclip className="mr-2 h-3.5 w-3.5" />}
                    Upload to Global Files
                  </Button>
                </div>
                {globalFiles.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#cfcfc8] bg-[#fbfaf7] p-4 text-xs leading-5 text-[#6d6d65]">Global Files is empty. Add reusable briefs, standards, screenshots, or references here when they should not belong to only one task.</div>
                ) : (
                  <div className="space-y-2 rounded-2xl border border-[#deded8] bg-[#fbfaf7] p-2">
                    {globalFiles.slice(0, 12).map((file) => (
                      <a key={file.id} href={file.storageUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl bg-white/80 px-3 py-2 text-xs text-[#4d4d46] hover:bg-emerald-50" aria-label={`Open or download global file ${file.relativePath}`}>
                        <File className="h-4 w-4 text-emerald-600" />
                        <span className="min-w-0 flex-1 truncate">{fileNameFromPath(file.relativePath)}</span>
                        <span className="hidden text-[10px] text-[#8a8980] sm:inline">{readableFileKind(file)}</span>
                        <Download className="h-3.5 w-3.5 text-[#8a8980]" />
                      </a>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-[#deded8] bg-white text-[#242420]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-stone-600" /> Advanced tools</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs leading-5 text-[#686861]">
                <p>Developer filesystem and terminal controls stay closed during normal task work. Open them only when you need raw diagnostics.</p>
                <Button type="button" variant="outline" onClick={() => setShowAdvancedTools((value) => !value)} className="w-full rounded-xl border-[#d9d8d1] bg-white text-xs">
                  {showAdvancedTools ? "Hide developer diagnostics" : "Show developer diagnostics"}
                </Button>
              </CardContent>
            </Card>

            {showAdvancedTools ? (
              <>
                <FilesystemPanel workspaceId={selectedTaskId ?? undefined} />
                <TerminalPanel />
              </>
            ) : null}

            <Card className="border-[#deded8] bg-white text-[#242420]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><Archive className="h-4 w-4 text-stone-600" /> All recorded files</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {allFiles.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#cfcfc8] bg-[#fbfaf7] p-4 text-xs leading-5 text-[#6d6d65]">The all-files index is empty because no real task or global files have been recorded yet.</div>
                ) : (
                  allFiles.slice(0, 10).map((file) => (
                    <a key={file.id} href={file.storageUrl} target="_blank" rel="noreferrer" className="block rounded-xl border border-[#deded8] bg-[#fbfaf7] p-2 text-xs text-[#5d5d55] hover:border-sky-200" aria-label={`Open or download ${file.relativePath}`}>
                      <span className="font-semibold text-[#30302b]">{file.relativePath}</span>
                      <p className="mt-1 text-[#77766e]">{file.scope === "global" || file.taskId === null ? "Global Files" : `Task #${file.taskId ?? "unknown"}`} · {compactDate(file.createdAt)}</p>
                      <p className="mt-1 flex items-center gap-1 text-[#77766e]"><Download className="h-3 w-3" /> Open or download from the recorded storage link.</p>
                    </a>
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
