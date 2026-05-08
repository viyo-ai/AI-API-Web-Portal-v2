import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FilesystemPanel from "@/components/FilesystemPanel";
import TerminalPanel from "@/components/TerminalPanel";
import SkillLibrariesPanel from "./SkillLibraries";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  WIZARD_CONNECTION_SUCCESS,
  WIZARD_PREFIX_ADDED_NOTE,
  WIZARD_PROJECT_CONNECTED_SUCCESS,
  defaultWizardInitialBranch,
  normalizeWizardInitialBranch,
  normalizeWizardProtectedBranches,
  normalizeWizardValidationCommands,
  validateWizardRepoLink,
  validateWizardTokenEnvVarName,
  wizardConnectionResultMessage,
} from "@/lib/projectWizardCopy";
import {
  Activity,
  Archive,
  Bot,
  Brain,
  CheckCircle2,
  CircleAlert,
  Clock3,
  GitBranch,
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

const MAX_QUEUED_MESSAGES_PER_TASK_UI = 5;
const ACTIVE_TURN_STATES = new Set(["context_assembly", "model_calling", "model_review", "persisting_output", "awaiting_approval"]);

function compactDate(value: number | Date | string | null | undefined) {
  if (!value) return "No timestamp";
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function ownerFacingText(value: string | null | undefined) {
  return (value ?? "")
    .replaceAll("Wrapper LLM", "AI coordinator")
    .replaceAll("Wrapper", "AI coordinator")
    .replaceAll("governance files", "rule books")
    .replaceAll("Governance", "Rule book")
    .replaceAll("token budget", "AI context limit")
    .replaceAll("production three-pane shell", "plain-English AI coding workshop")
    .replaceAll("task-first production shell", "task-first production workspace");
}

function pushStatusLabel(value: string | null | undefined) {
  if (value === "pushed") return "Pushed";
  if (value === "push_failed") return "Last push failed";
  return "Never pushed";
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
  source: "root_default" | "project" | "manual";
  file: TaskFileRecord;
};

function attachedGlobalFileSourceLabel(source: AttachedGlobalFileRecord["source"]) {
  if (source === "root_default") return "Root default";
  if (source === "project") return "Project";
  return "Manual";
}

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

type QueuedComposerMessage = {
  id: number;
  taskId: number;
  position: number;
  content: string;
  state: "queued" | "processing" | "sent" | "cleared";
  createdAt: number | Date | string;
  updatedAt: number | Date | string;
};

type GovernanceFileRow = {
  path: string;
  required: boolean;
  dynamic: boolean;
  role: "governance" | "placeholder_resolver";
  resolverKey?: string;
};

type WizardConfidence = "low" | "medium" | "high";

type WizardRecommendationCard<T> = {
  value: T;
  confidence: WizardConfidence;
  rationale: string;
};

type ProjectWizardRecommendation = {
  defaultBaseBranch: WizardRecommendationCard<string>;
  branchStrategy: WizardRecommendationCard<{
    initialBuildBranch: string;
    protectedBranches: string[];
  }>;
  validationCommands: WizardRecommendationCard<string[]>;
  serviceChecks: WizardRecommendationCard<string[]>;
  projectRuleBooks: WizardRecommendationCard<GovernanceFileRow[]>;
  environmentVariables: WizardRecommendationCard<Record<string, string>>;
};

type ProjectWizardAnalysisResult = {
  status: "ok" | "validation_failed" | "analysis_failed";
  connection?: { status: string; message?: string };
  repoContext?: {
    normalizedRepoUrl?: string;
    commitSha?: string;
    fileCount?: number;
    scripts?: string[];
    detectedFrameworks?: string[];
    ruleBookCandidates?: string[];
  };
  recommendation?: ProjectWizardRecommendation;
  fallbackMessage?: string | null;
  cacheStatus?: "hit" | "miss";
  errorMessage?: string;
};

const defaultGovernanceRow = (): GovernanceFileRow => ({
  path: "docs/governance.md",
  required: true,
  dynamic: false,
  role: "governance",
  resolverKey: "",
});

function confidenceTone(confidence: WizardConfidence) {
  if (confidence === "high") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (confidence === "medium") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function formatEnvMapForInput(value: Record<string, string>) {
  return Object.entries(value).map(([workspaceEnvName, sourceEnvName]) => `${workspaceEnvName}=${sourceEnvName}`).join("\n");
}

function governanceRowsFromPaths(value: string) {
  return value
    .split("\n")
    .map((path) => path.trim())
    .filter(Boolean)
    .map((path): GovernanceFileRow => ({
      path,
      required: true,
      dynamic: false,
      role: "governance",
      resolverKey: "",
    }));
}

type ActiveTurnRecord = {
  id: number;
  state: string;
  route?: string | null;
  approvalStatus?: "not_required" | "awaiting_owner" | "approved" | "revision_requested" | "cancelled" | string | null;
  approvalPlanContent?: string | null;
  approvalDecisionMessage?: string | null;
  approvalRequestedAt?: number | Date | string | null;
  approvalResolvedAt?: number | Date | string | null;
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

function isAwaitingOwnerApproval(turn: ActiveTurnRecord | null | undefined) {
  return turn?.state === "awaiting_approval" && turn.approvalStatus === "awaiting_owner";
}

function isActiveTurnState(turn: ActiveTurnRecord | null | undefined) {
  return Boolean(turn?.state && ACTIVE_TURN_STATES.has(turn.state));
}

function queuedMessageStateLabel(state: QueuedComposerMessage["state"]) {
  if (state === "sent") return "Sent";
  if (state === "cleared") return "Canceled";
  if (state === "processing") return "Sending";
  return "Waiting";
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

function eventTurnId(event: ThreadEvent | undefined) {
  if (!event?.metadataJson) return null;
  try {
    const metadata = JSON.parse(event.metadataJson) as { turnId?: unknown; turn_id?: unknown };
    const rawTurnId = metadata.turnId ?? metadata.turn_id;
    const numericTurnId = typeof rawTurnId === "number" ? rawTurnId : Number(rawTurnId);
    return Number.isFinite(numericTurnId) ? numericTurnId : null;
  } catch {
    return null;
  }
}

function hasLaterSuccessfulProviderEventForSameTurn(event: ThreadEvent, events: ThreadEvent[]) {
  const failedTurnId = eventTurnId(event);
  if (failedTurnId === null) return false;
  const failedAt = eventTimestamp(event);
  return events.some((candidate) => {
    if (eventTurnId(candidate) !== failedTurnId) return false;
    if (!isOwnerVisibleEvent(candidate)) return false;
    if (candidate.status !== "completed") return false;
    return eventTimestamp(candidate) > failedAt || (eventTimestamp(candidate) === failedAt && candidate.id > event.id);
  });
}

function latestActionableProviderFailure(events: ThreadEvent[]) {
  const newestTechnicalEvents = events.filter((event) => !isOwnerVisibleEvent(event)).sort(newestFirst);
  return newestTechnicalEvents.find((event) => {
    if (event.status !== "failed" && event.status !== "blocked") return false;
    return !hasLaterSuccessfulProviderEventForSameTurn(event, events);
  });
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

  const [activeWorkspacePanel, setActiveWorkspacePanel] = useState<"tasks" | "skills">("tasks");
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [taskTitle, setTaskTitle] = useState("AI coding workshop task");
  const [composerText, setComposerText] = useState("");
  const [routeMode, setRouteMode] = useState<"auto" | "kimi" | "claude">("auto");
  const [searchTerm, setSearchTerm] = useState("");
  const [filePath, setFilePath] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [showAdvancedTools, setShowAdvancedTools] = useState(false);
  const [selectedBuildTargetId, setSelectedBuildTargetId] = useState<number | null>(null);
  const [buildTargetName, setBuildTargetName] = useState("Workshop repo");
  const [buildTargetRepoUrl, setBuildTargetRepoUrl] = useState("");
  const [buildBranchName, setBuildBranchName] = useState("");
  const [buildTargetTokenEnvVar, setBuildTargetTokenEnvVar] = useState("VIYO_GITHUB_TOKEN");
  const [buildTargetDefaultBaseBranch, setBuildTargetDefaultBaseBranch] = useState("main");
  const [buildTargetProtectedBranches, setBuildTargetProtectedBranches] = useState("main,staging");
  const [buildTargetValidationCommands, setBuildTargetValidationCommands] = useState("");
  const [buildTargetServiceChecks, setBuildTargetServiceChecks] = useState("");
  const [buildTargetAgentEnvMap, setBuildTargetAgentEnvMap] = useState("WORKSHOP_GITHUB_TOKEN=VIYO_GITHUB_TOKEN");
  const [buildTargetGovernanceFiles, setBuildTargetGovernanceFiles] = useState<GovernanceFileRow[]>([defaultGovernanceRow()]);
  const [buildTargetGovernanceBudgetEnforced, setBuildTargetGovernanceBudgetEnforced] = useState(true);
  const [isWizardMode, setIsWizardMode] = useState(true);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [wizardAnalysis, setWizardAnalysis] = useState<ProjectWizardAnalysisResult | null>(null);
  const [wizardDisplayName, setWizardDisplayName] = useState("Workshop repo");
  const [wizardRepoUrl, setWizardRepoUrl] = useState("");
  const [wizardTokenEnvVar, setWizardTokenEnvVar] = useState("VIYO_GITHUB_TOKEN");
  const [wizardBaseBranch, setWizardBaseBranch] = useState("main");
  const [wizardInitialBranch, setWizardInitialBranch] = useState(defaultWizardInitialBranch("Workshop repo"));
  const [wizardProtectedBranches, setWizardProtectedBranches] = useState("main");
  const [wizardValidationCommands, setWizardValidationCommands] = useState("");
  const [wizardServiceChecks, setWizardServiceChecks] = useState("");
  const [wizardAgentEnvMap, setWizardAgentEnvMap] = useState("");
  const [wizardGovernanceFiles, setWizardGovernanceFiles] = useState<GovernanceFileRow[]>([]);
  const [wizardConnectionStatus, setWizardConnectionStatus] = useState<"untested" | "testing" | "ok" | "failed">("untested");
  const [wizardConnectionMessage, setWizardConnectionMessage] = useState("");
  const [showWizardAdvancedSettings, setShowWizardAdvancedSettings] = useState(false);
  const [credentialsDrawerOpen, setCredentialsDrawerOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState("");
  const [taskSortMode, setTaskSortMode] = useState<"recent" | "created">("recent");
  const [openedBuildBranch, setOpenedBuildBranch] = useState<any | null>(null);
  const [useBuildBranchDiagnosticsWorkspace, setUseBuildBranchDiagnosticsWorkspace] = useState(false);
  const [showThreadDetails, setShowThreadDetails] = useState(false);
  const [workspaceNotice, setWorkspaceNotice] = useState("");
  const [queuePanelOpen, setQueuePanelOpen] = useState(true);
  const [editingQueueItemId, setEditingQueueItemId] = useState<number | null>(null);
  const [editingQueueContent, setEditingQueueContent] = useState("");
  const [cancelledQueueItemIds, setCancelledQueueItemIds] = useState<number[]>([]);
  const [editedQueueContentById, setEditedQueueContentById] = useState<Record<number, string>>({});
  const [stopConfirmOpen, setStopConfirmOpen] = useState(false);
  const [approvalRevisionText, setApprovalRevisionText] = useState("");
  const [isFileDragActive, setIsFileDragActive] = useState(false);
  const [isGlobalFileDragActive, setIsGlobalFileDragActive] = useState(false);
  const [uploadScope, setUploadScope] = useState<"task" | "global">("task");
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const globalUploadInputRef = useRef<HTMLInputElement | null>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const taskListInput = useMemo(() => ({ includeArchived: true, limit: 75 }), []);
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
  const approvalPreferenceQuery = trpc.orchestration.kimiApprovalPreference.useQuery(undefined, { enabled: isAuthenticated });
  const buildTargetsInput = useMemo(() => ({ includeArchived: false, limit: 50 }), []);
  const buildTargetsQuery = trpc.buildTargets.list.useQuery(buildTargetsInput, { enabled: isAuthenticated });
  const wizardRepoValidationMessage = validateWizardRepoLink(wizardRepoUrl);
  const wizardTokenValidationMessage = validateWizardTokenEnvVarName(wizardTokenEnvVar);

  const createTask = trpc.tasks.create.useMutation();
  const updateTaskStatus = trpc.tasks.updateStatus.useMutation();
  const renameTaskMutation = trpc.tasks.rename.useMutation();
  const submitMessage = trpc.orchestration.submitMessage.useMutation();
  const updateQueuedMessageMutation = trpc.orchestration.updateQueuedMessage.useMutation();
  const clearQueuedMessageMutation = trpc.orchestration.clearQueuedMessage.useMutation();
  const stopGenerationMutation = trpc.orchestration.stopGeneration.useMutation();
  const updateApprovalPreferenceMutation = trpc.orchestration.updateKimiApprovalPreference.useMutation();
  const approveKimiHandoffMutation = trpc.orchestration.approveKimiHandoff.useMutation();
  const requestKimiHandoffRevisionMutation = trpc.orchestration.requestKimiHandoffRevision.useMutation();
  const cancelKimiHandoffMutation = trpc.orchestration.cancelKimiHandoff.useMutation();
  const createFileMetadata = trpc.files.createMetadata.useMutation();
  const uploadWorkspaceFileMutation = trpc.filesystem.upload.useMutation();
  const attachGlobalToTaskMutation = trpc.files.attachGlobalToTask.useMutation();
  const credentialsRefreshMutation = trpc.credentials.refresh.useMutation();
  const createBuildTargetMutation = trpc.buildTargets.create.useMutation();
  const createBuildBranchMutation = trpc.buildBranches.create.useMutation();
  const updateBuildTargetSettingsMutation = trpc.buildTargets.updateSettings.useMutation();
  const pushBuildBranchMutation = trpc.buildBranches.push.useMutation();
  const testBuildTargetConnectionMutation = trpc.buildTargets.testConnection.useMutation();
  const analyzeWizardMutation = trpc.buildTargets.analyzeWizard.useMutation();
  const completeWizardMutation = trpc.buildTargets.completeWizard.useMutation();

  const selectedThread = threadQuery.data;
  const selectedTask = selectedThread?.task ?? tasks.find((task) => task.id === selectedTaskId) ?? null;
  const activeTurn = selectedThread?.activeTurn as ActiveTurnRecord | null | undefined;
  const queuedMessages = ((selectedThread?.queuedMessages ?? []) as QueuedComposerMessage[]);
  const isWaitingForKimiApproval = isAwaitingOwnerApproval(activeTurn);
  const hasActiveGeneration = isActiveTurnState(activeTurn);
  const visibleQueuedMessages = queuedMessages.filter((queueItem) => !cancelledQueueItemIds.includes(queueItem.id));
  const queueCount = Math.min(visibleQueuedMessages.length, MAX_QUEUED_MESSAGES_PER_TASK_UI);
  const isQueueFull = hasActiveGeneration && queueCount >= MAX_QUEUED_MESSAGES_PER_TASK_UI;
  const queueCountLabel = `${queueCount} of ${MAX_QUEUED_MESSAGES_PER_TASK_UI} queued${isQueueFull ? " (full)" : ""}`;
  const stopButtonLabel = isWaitingForKimiApproval ? "Stop and discard plan" : "Stop";
  const events = ((selectedThread?.events ?? []) as ThreadEvent[]);
  const ownerVisibleEvents = useMemo(() => events.filter(isOwnerVisibleEvent).sort(oldestFirst), [events]);
  const technicalEvents = useMemo(() => events.filter((event) => !isOwnerVisibleEvent(event)).sort(newestFirst), [events]);
  const latestProviderFailure = useMemo(() => latestActionableProviderFailure(events), [events]);
  const providerFailureCopy = ownerProviderFailureMessage(latestProviderFailure);
  const taskFiles = (taskFilesQuery.data ?? []) as TaskFileRecord[];
  const attachedGlobalFiles = (attachedGlobalFilesQuery.data ?? []) as AttachedGlobalFileRecord[];
  const allFiles = (allFilesQuery.data ?? []) as TaskFileRecord[];
  const globalFiles = (globalFilesQuery.data ?? []) as TaskFileRecord[];
  const memories = memoryQuery.data ?? [];
  const credentials = credentialsQuery.data?.runtimeStates ?? [];
  const buildTargets = buildTargetsQuery.data ?? [];
  const alwaysRequireKimiApproval = approvalPreferenceQuery.data?.alwaysRequireKimiApproval !== false;
  const selectedBuildTarget = buildTargets.find((target) => target.id === selectedBuildTargetId) ?? buildTargets[0] ?? null;
  const projectMemoryInput = useMemo(() => ({ buildTargetId: selectedBuildTarget?.id ?? 0, limit: 30 }), [selectedBuildTarget?.id]);
  const projectMemoryQuery = trpc.projectMemory.list.useQuery(projectMemoryInput, { enabled: isAuthenticated && Boolean(selectedBuildTarget?.id) });
  const projectMemories = projectMemoryQuery.data ?? [];
  const isBuildModeOpen = Boolean(selectedBuildTarget && openedBuildBranch);
  const diagnosticsBuildBranchPath = useBuildBranchDiagnosticsWorkspace && openedBuildBranch?.workspacePath ? openedBuildBranch.workspacePath : null;
  const diagnosticsWorkspaceLabel = diagnosticsBuildBranchPath ? "Project Build Branch" : "Personal workspace";
  const selectedBuildTargetEnvMap = useMemo(() => {
    try {
      return selectedBuildTarget?.agentEnvVarMapJson ? JSON.parse(selectedBuildTarget.agentEnvVarMapJson) as Record<string, string> : {};
    } catch {
      return {};
    }
  }, [selectedBuildTarget]);
  const selectedBuildTargetGovernanceFiles = useMemo(() => {
    try {
      const parsed = selectedBuildTarget?.governanceFilesJson ? JSON.parse(selectedBuildTarget.governanceFilesJson) : [];
      return Array.isArray(parsed) ? parsed as GovernanceFileRow[] : [];
    } catch {
      return [];
    }
  }, [selectedBuildTarget]);

  useEffect(() => {
    if (!selectedBuildTarget) return;
    setBuildTargetAgentEnvMap(Object.entries(selectedBuildTargetEnvMap).map(([key, value]) => `${key}=${value}`).join("\n") || "WORKSHOP_GITHUB_TOKEN=VIYO_GITHUB_TOKEN");
    setBuildTargetGovernanceFiles(selectedBuildTargetGovernanceFiles.length > 0 ? selectedBuildTargetGovernanceFiles : [defaultGovernanceRow()]);
    setBuildTargetGovernanceBudgetEnforced(selectedBuildTarget.governanceBudgetEnforced !== false);
  }, [selectedBuildTarget, selectedBuildTargetEnvMap, selectedBuildTargetGovernanceFiles]);

  useEffect(() => {
    if (!openedBuildBranch?.workspacePath) setUseBuildBranchDiagnosticsWorkspace(false);
  }, [openedBuildBranch]);

  const filteredTasks = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const searchedTasks = query ? tasks.filter((task) => `${task.title} ${task.summary ?? ""} ${task.status}`.toLowerCase().includes(query)) : tasks;
    return [...searchedTasks].sort((a, b) => {
      const aTime = new Date(taskSortMode === "recent" ? a.updatedAt ?? a.createdAt : a.createdAt).getTime() || 0;
      const bTime = new Date(taskSortMode === "recent" ? b.updatedAt ?? b.createdAt : b.createdAt).getTime() || 0;
      return bTime - aTime || b.id - a.id;
    });
  }, [tasks, searchTerm, taskSortMode]);
  const liveTasks = useMemo(() => filteredTasks.filter((task) => task.status !== "archived"), [filteredTasks]);
  const archivedTasks = useMemo(() => filteredTasks.filter((task) => task.status === "archived"), [filteredTasks]);

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

  const isMutating = createTask.isPending || updateTaskStatus.isPending || renameTaskMutation.isPending || submitMessage.isPending || updateQueuedMessageMutation.isPending || clearQueuedMessageMutation.isPending || stopGenerationMutation.isPending || updateApprovalPreferenceMutation.isPending || approveKimiHandoffMutation.isPending || requestKimiHandoffRevisionMutation.isPending || cancelKimiHandoffMutation.isPending || createFileMetadata.isPending || uploadWorkspaceFileMutation.isPending || attachGlobalToTaskMutation.isPending || createBuildTargetMutation.isPending || createBuildBranchMutation.isPending || updateBuildTargetSettingsMutation.isPending || pushBuildBranchMutation.isPending || testBuildTargetConnectionMutation.isPending || analyzeWizardMutation.isPending || completeWizardMutation.isPending;

  async function refreshWorkspace() {
    await Promise.all([
      utils.tasks.list.invalidate(),
      utils.tasks.thread.invalidate(),
      utils.files.listForTask.invalidate(),
      utils.files.listGlobalForTask.invalidate(),
      utils.files.listAll.invalidate(),
      utils.files.listGlobal.invalidate(),
      utils.memory.list.invalidate(),
      utils.projectMemory.list.invalidate(),
      utils.credentials.status.invalidate(),
      utils.orchestration.kimiApprovalPreference.invalidate(),
      utils.filesystem.tree.invalidate(),
      utils.buildTargets.list.invalidate(),
      utils.buildBranches.list.invalidate(),
      utils.buildBranch.list.invalidate(),
    ]);
  }

  function parseAgentEnvMapInput() {
    const entries = buildTargetAgentEnvMap
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [workspaceEnvName, ...sourceParts] = line.split("=");
        return [workspaceEnvName?.trim(), sourceParts.join("=").trim()] as const;
      })
      .filter(([workspaceEnvName, sourceEnvName]) => Boolean(workspaceEnvName && sourceEnvName));
    return Object.fromEntries(entries);
  }

  function governanceValidationErrors(rows: GovernanceFileRow[]) {
    const activeRows = rows.map((row) => ({ ...row, path: row.path.trim(), resolverKey: row.resolverKey?.trim() })).filter((row) => row.path);
    const errors: string[] = [];
    const resolverKeys = new Set(activeRows.filter((row) => row.role === "placeholder_resolver" && row.resolverKey).map((row) => row.resolverKey as string));
    if (activeRows.length > 0 && !activeRows.some((row) => row.role === "governance")) errors.push("Add at least one rule book row before saving project rule books.");
    activeRows.forEach((row, index) => {
      const label = `Rule book row ${index + 1}`;
      if (row.path.startsWith("/") || row.path.includes("..")) errors.push(`${label} must use a safe relative path and cannot include '..'.`);
      if (row.role === "placeholder_resolver" && !row.resolverKey) errors.push(`${label} needs a resolver key.`);
      if (row.dynamic) {
        const placeholders = Array.from(row.path.matchAll(/\{([A-Za-z0-9_-]+)\}/g)).map((match) => match[1]);
        placeholders.forEach((placeholder) => {
          if (!resolverKeys.has(placeholder)) errors.push(`${label} references {${placeholder}} without a matching placeholder resolver row.`);
        });
      }
    });
    return errors;
  }

  function normalizedGovernanceRows() {
    return buildTargetGovernanceFiles
      .map((row) => ({ path: row.path.trim(), required: row.required, dynamic: row.dynamic, role: row.role, resolverKey: row.resolverKey?.trim() || undefined }))
      .filter((row) => row.path);
  }

  function normalizedWizardGovernanceRows() {
    return wizardGovernanceFiles
      .map((row) => ({ path: row.path.trim(), required: row.required, dynamic: row.dynamic, role: row.role, resolverKey: row.resolverKey?.trim() || undefined }))
      .filter((row) => row.path);
  }

  function parseWizardAgentEnvMapInput() {
    const entries = wizardAgentEnvMap
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [workspaceEnvName, ...sourceParts] = line.split("=");
        return [workspaceEnvName?.trim(), sourceParts.join("=").trim()] as const;
      })
      .filter(([workspaceEnvName, sourceEnvName]) => Boolean(workspaceEnvName && sourceEnvName));
    return Object.fromEntries(entries);
  }

  function invalidateWizardConnectionIfNeeded() {
    if (wizardConnectionStatus === "ok") {
      setWizardConnectionStatus("untested");
      setWizardConnectionMessage("Test the connection again after your change.");
    }
  }

  function updateWizardTextField(setter: (value: string) => void, value: string) {
    setter(value);
    invalidateWizardConnectionIfNeeded();
  }

  function updateWizardGovernanceRows(value: GovernanceFileRow[]) {
    setWizardGovernanceFiles(value);
    invalidateWizardConnectionIfNeeded();
  }

  function applyWizardRecommendation(recommendation: ProjectWizardRecommendation) {
    const normalizedInitialBranch = normalizeWizardInitialBranch(recommendation.branchStrategy.value.initialBuildBranch, wizardDisplayName);
    setWizardBaseBranch(recommendation.defaultBaseBranch.value);
    setWizardInitialBranch(normalizedInitialBranch.value);
    setWizardProtectedBranches(normalizeWizardProtectedBranches(recommendation.branchStrategy.value.protectedBranches.join(","), recommendation.defaultBaseBranch.value).join(","));
    setWizardValidationCommands(normalizeWizardValidationCommands(recommendation.validationCommands.value.join("\n")).join("\n"));
    setWizardServiceChecks(recommendation.serviceChecks.value.join("\n"));
    setWizardGovernanceFiles(recommendation.projectRuleBooks.value);
    setWizardAgentEnvMap(formatEnvMapForInput(recommendation.environmentVariables.value));
  }

  async function handleAnalyzeWizard() {
    const validationMessage = wizardRepoValidationMessage || wizardTokenValidationMessage;
    if (validationMessage) {
      setWorkspaceNotice(validationMessage);
      toast.warning(validationMessage);
      return;
    }
    if (wizardConnectionStatus !== "ok") {
      const message = "Test the connection before reviewing the Project setup.";
      setWorkspaceNotice(message);
      toast.warning(message);
      return;
    }
    setWizardStep(2);
    setWizardAnalysis(null);
    try {
      const result = await analyzeWizardMutation.mutateAsync({
        displayName: wizardDisplayName.trim() || "Workshop repo",
        repoUrl: wizardRepoUrl.trim(),
        githubTokenEnvVar: wizardTokenEnvVar.trim(),
        defaultBaseBranch: wizardBaseBranch.trim() || "main",
      }) as ProjectWizardAnalysisResult;
      setWizardAnalysis(result);
      if (result.status !== "ok" || !result.recommendation) {
        const message = result.fallbackMessage || "Setup wizard couldn't complete. Switch to manual setup?";
        setWizardStep(1);
        setWorkspaceNotice(message);
        toast.warning(message);
        return;
      }
      applyWizardRecommendation(result.recommendation);
      setWizardStep(3);
      const cacheCopy = result.cacheStatus === "hit" ? " using the cached recommendation" : "";
      const message = `Project recommendations are ready${cacheCopy}. Review them, test again if you make changes, then save the Project.`;
      setWorkspaceNotice(message);
      toast.success(message);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Setup wizard couldn't complete. Switch to manual setup?";
      setWizardAnalysis({ status: "analysis_failed", fallbackMessage: "Setup wizard couldn't complete. Switch to manual setup?", errorMessage: message });
      setWizardStep(1);
      setWorkspaceNotice("Setup wizard couldn't complete. Switch to manual setup?");
      toast.error("Setup wizard couldn't complete. Switch to manual setup?");
    }
  }

  function handleUseAdvancedSetup() {
    setIsWizardMode(false);
    setBuildTargetName(wizardDisplayName.trim() || buildTargetName);
    setBuildTargetRepoUrl(wizardRepoUrl.trim() || buildTargetRepoUrl);
    setBuildTargetTokenEnvVar(wizardTokenEnvVar.trim() || buildTargetTokenEnvVar);
    setBuildTargetDefaultBaseBranch(wizardBaseBranch.trim() || buildTargetDefaultBaseBranch);
    setBuildTargetProtectedBranches(wizardProtectedBranches.trim() || buildTargetProtectedBranches);
    setBuildTargetValidationCommands(wizardValidationCommands);
    setBuildTargetServiceChecks(wizardServiceChecks);
    setBuildTargetAgentEnvMap(wizardAgentEnvMap || buildTargetAgentEnvMap);
    setBuildTargetGovernanceFiles(wizardGovernanceFiles.length ? wizardGovernanceFiles : buildTargetGovernanceFiles);
  }

  async function handleCompleteWizard() {
    const validationMessage = wizardRepoValidationMessage || wizardTokenValidationMessage;
    if (validationMessage) {
      setWorkspaceNotice(validationMessage);
      toast.warning(validationMessage);
      return;
    }
    if (wizardConnectionStatus !== "ok") {
      const message = "Test the connection before saving this Project.";
      setWorkspaceNotice(message);
      toast.warning(message);
      return;
    }
    const normalizedInitialBranch = normalizeWizardInitialBranch(wizardInitialBranch, wizardDisplayName);
    const protectedBranches = normalizeWizardProtectedBranches(wizardProtectedBranches, wizardBaseBranch);
    const validationCommands = normalizeWizardValidationCommands(wizardValidationCommands);
    const serviceChecks = wizardServiceChecks.split("\n").map((value) => value.trim()).filter(Boolean);
    if (normalizedInitialBranch.value !== wizardInitialBranch.trim()) setWizardInitialBranch(normalizedInitialBranch.value);
    if (protectedBranches.join(",") !== wizardProtectedBranches.trim()) setWizardProtectedBranches(protectedBranches.join(","));
    if (validationCommands.join("\n") !== wizardValidationCommands.trim()) setWizardValidationCommands(validationCommands.join("\n"));
    const governanceFiles = normalizedWizardGovernanceRows();
    const errors = governanceValidationErrors(governanceFiles);
    if (errors.length > 0) {
      const message = errors[0];
      setWorkspaceNotice(message);
      toast.warning(message);
      return;
    }
    if (!protectedBranches.length || !validationCommands.length) {
      const message = "Review requires at least one branch-protection entry and one validation command before saving the Project.";
      setWorkspaceNotice(message);
      toast.warning(message);
      return;
    }
    try {
      const result = await completeWizardMutation.mutateAsync({
        displayName: wizardDisplayName.trim() || "Workshop repo",
        repoUrl: wizardRepoUrl.trim(),
        githubTokenEnvVar: wizardTokenEnvVar.trim(),
        defaultBaseBranch: wizardBaseBranch.trim() || "main",
        initialBuildBranch: normalizedInitialBranch.value,
        protectedBranches,
        validationCommands,
        serviceChecks,
        governanceFiles,
        agentEnvVarMap: parseWizardAgentEnvMapInput(),
      }) as { target: any; branch: any };
      setSelectedBuildTargetId(result.target.id);
      setOpenedBuildBranch(result.branch);
      setBuildTargetName(result.target.name ?? wizardDisplayName);
      setBuildTargetRepoUrl("");
      setWizardStep(4);
      setWizardConnectionStatus("untested");
      const message = WIZARD_PROJECT_CONNECTED_SUCCESS;
      setWorkspaceNotice(message);
      toast.success(message);
      await refreshWorkspace();
    } catch (error) {
      const message = error instanceof Error ? error.message : "The Project could not be created from the setup wizard.";
      setWorkspaceNotice(message);
      toast.error(message);
    }
  }

  function updateGovernanceRow(index: number, patch: Partial<GovernanceFileRow>) {
    setBuildTargetGovernanceFiles((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  }

  function moveGovernanceRow(index: number, direction: -1 | 1) {
    setBuildTargetGovernanceFiles((rows) => {
      const next = [...rows];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= next.length) return rows;
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }

  async function handleUpdateBuildTargetSettings() {
    if (!selectedBuildTarget) return;
    try {
      const governanceFiles = normalizedGovernanceRows();
      const errors = governanceValidationErrors(governanceFiles);
      if (errors.length > 0) {
        const message = errors[0];
        setWorkspaceNotice(message);
        toast.warning(message);
        return;
      }
      const updated = await updateBuildTargetSettingsMutation.mutateAsync({
        targetId: selectedBuildTarget.id,
        agentEnvVarMap: parseAgentEnvMapInput(),
        governanceFiles,
        governanceBudgetEnforced: buildTargetGovernanceBudgetEnforced,
      });
      const message = `Saved AI environment variables and project rule books for ${updated?.name ?? selectedBuildTarget.name}.`;
      setWorkspaceNotice(message);
      toast.success(message);
      await refreshWorkspace();
    } catch (error) {
      const message = error instanceof Error ? error.message : "The project settings could not be saved.";
      setWorkspaceNotice(message);
      toast.error(message);
    }
  }

  async function handlePushBuildBranch() {
    if (!openedBuildBranch) return;
    try {
      const pushed = await pushBuildBranchMutation.mutateAsync({ branchId: openedBuildBranch.id });
      if (pushed.branch) setOpenedBuildBranch(pushed.branch);
      if (pushed.pushState !== "pushed") {
        const message = pushed.errorMessage ?? "The working branch push was blocked by Section 4 policy.";
        setWorkspaceNotice(message);
        toast.error(message);
        await refreshWorkspace();
        return;
      }
      const commit = pushed.pushedCommit ? ` at ${pushed.pushedCommit.slice(0, 12)}` : "";
      const message = `Pushed ${openedBuildBranch.branchName}${commit}.`;
      setWorkspaceNotice(message);
      toast.success(message);
      await refreshWorkspace();
    } catch (error) {
      const message = error instanceof Error ? error.message : "The working branch push was blocked by project policy.";
      setWorkspaceNotice(message);
      toast.error(message);
      await refreshWorkspace();
    }
  }

  async function handleCreateBuildTarget() {
    if (!buildTargetRepoUrl.trim()) {
      const message = "Add a GitHub repository URL before creating a project.";
      setWorkspaceNotice(message);
      toast.warning(message);
      return;
    }
    try {
      const created = await createBuildTargetMutation.mutateAsync({
        name: buildTargetName.trim() || "Workshop repo",
        repoUrl: buildTargetRepoUrl.trim(),
        githubTokenEnvVar: buildTargetTokenEnvVar.trim(),
        defaultBaseBranch: buildTargetDefaultBaseBranch.trim() || "main",
        protectedBranches: buildTargetProtectedBranches.split(",").map((value) => value.trim()).filter(Boolean),
        validationCommands: buildTargetValidationCommands.split("\n").map((value) => value.trim()).filter(Boolean),
        serviceChecks: buildTargetServiceChecks.split("\n").map((value) => value.trim()).filter(Boolean),
      });
      setSelectedBuildTargetId(created.id);
      setBuildTargetRepoUrl("");
      const message = `Project created for ${created.name}.`;
      setWorkspaceNotice(message);
      toast.success(message);
      await refreshWorkspace();
    } catch (error) {
      const message = error instanceof Error ? error.message : "The project could not be created.";
      setWorkspaceNotice(message);
      toast.error(message);
    }
  }

  async function handleTestWizardConnection() {
    const validationMessage = wizardRepoValidationMessage || wizardTokenValidationMessage;
    if (validationMessage) {
      setWizardConnectionStatus("failed");
      setWizardConnectionMessage(validationMessage);
      setWorkspaceNotice(validationMessage);
      toast.warning(validationMessage);
      return;
    }
    setWizardConnectionStatus("testing");
    setWizardConnectionMessage("Testing GitHub access…");
    try {
      const result = await testBuildTargetConnectionMutation.mutateAsync({
        repoUrl: wizardRepoUrl.trim(),
        githubTokenEnvVar: wizardTokenEnvVar.trim(),
        defaultBaseBranch: wizardBaseBranch.trim() || "main",
      }) as { status?: string; message?: string | null };
      const message = wizardConnectionResultMessage(result);
      setWizardConnectionMessage(message);
      setWorkspaceNotice(message);
      if (result.status === "ok") {
        setWizardConnectionStatus("ok");
        toast.success(WIZARD_CONNECTION_SUCCESS);
      } else {
        setWizardConnectionStatus("failed");
        toast.error(message);
      }
    } catch (error) {
      const message = wizardConnectionResultMessage({ status: "unknown", message: error instanceof Error ? error.message : null });
      setWizardConnectionStatus("failed");
      setWizardConnectionMessage(message);
      setWorkspaceNotice(message);
      toast.error(message);
    }
  }

  async function handleTestBuildTargetConnection() {
    if (!buildTargetRepoUrl.trim()) {
      const message = "Add a GitHub repository URL before testing the connection.";
      setWorkspaceNotice(message);
      toast.warning(message);
      return;
    }
    try {
      const result = await testBuildTargetConnectionMutation.mutateAsync({ repoUrl: buildTargetRepoUrl.trim(), githubTokenEnvVar: buildTargetTokenEnvVar.trim(), defaultBaseBranch: buildTargetDefaultBaseBranch.trim() || "main" });
      setWorkspaceNotice(result.message);
      if (result.status === "ok") toast.success(result.message);
      else toast.warning(`${result.status.replaceAll("_", " ")}: ${result.message}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The project connection test failed.";
      setWorkspaceNotice(message);
      toast.error(message);
    }
  }

  async function handleCreateBuildBranch() {
    if (!selectedBuildTarget) {
      const message = "Create or select a project before opening project mode.";
      setWorkspaceNotice(message);
      toast.warning(message);
      return;
    }
    const cleanBranchName = buildBranchName.trim() || `agent-work/portal-task-${selectedTaskId ?? Date.now()}`;
    try {
      const branch = await createBuildBranchMutation.mutateAsync({ buildTargetId: selectedBuildTarget.id, branchName: cleanBranchName, baseBranch: selectedBuildTarget.defaultBaseBranch, taskId: selectedTaskId });
      setBuildBranchName("");
      setOpenedBuildBranch(branch);
      const message = branch.state === "clean" ? `Project ready on ${branch.branchName}.` : `Working branch recorded, but clone failed: ${branch.errorMessage ?? "check repository access"}.`;
      setWorkspaceNotice(message);
      if (branch.state === "clean") toast.success(message); else toast.warning(message);
      await refreshWorkspace();
    } catch (error) {
      const message = error instanceof Error ? error.message : "The working branch could not be created.";
      setWorkspaceNotice(message);
      toast.error(message);
    }
  }

  async function handleRefreshCredentials() {
    await credentialsRefreshMutation.mutateAsync({ providers: ["claude", "kimi"] });
    await utils.credentials.status.invalidate();
  }

  async function handleRefreshCredential(provider: "claude" | "kimi") {
    await credentialsRefreshMutation.mutateAsync({ providers: [provider] });
    await utils.credentials.status.invalidate();
  }

  function beginTaskRename(task: { id: number; title: string }) {
    setEditingTaskId(task.id);
    setEditingTaskTitle(task.title);
  }

  async function handleRenameTask(taskId: number) {
    const cleanTitle = editingTaskTitle.trim();
    if (!cleanTitle) {
      toast.warning("Task title is required.");
      return;
    }
    await renameTaskMutation.mutateAsync({ taskId, title: cleanTitle });
    setEditingTaskId(null);
    setEditingTaskTitle("");
    await refreshWorkspace();
  }

  function draftArchitectOnboardingMessage(kind: "setup" | "credentials") {
    const draft = kind === "credentials"
      ? "Help me connect credentials using env var names only. Show me what is connected and what needs testing."
      : "Architect, help me set up this project conversationally. Ask for the repo, branch, validation commands, and env var names one step at a time.";
    setComposerText(draft);
    setRouteMode("auto");
    setWorkspaceNotice("Architect draft added to the composer. Review it, then send it when ready.");
  }

  async function createTaskRecordOnly() {
    const cleanTitle = taskTitle.trim() || "Untitled production task";
    const created = await createTask.mutateAsync({
      title: cleanTitle,
      summary: "Task-first v2 workspace item created from the plain-English AI coding workshop.",
      routeMode,
      buildTargetId: selectedBuildTargetId ?? undefined,
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
    if (isQueueFull) {
      setWorkspaceNotice("Queue is full. Wait for the current message to finish, or cancel a queued message.");
      return;
    }
    const taskId = selectedTaskId ?? (await createTaskRecordOnly());
    if (!taskId) return;
    const queued = hasActiveGeneration;
    const response = await submitMessage.mutateAsync({
      taskId,
      message: cleanMessage,
      routeMode,
      buildTargetId: selectedBuildTargetId ?? selectedTask?.buildTargetId ?? undefined,
    });
    const createdBuildTargetId = response && "architectSetupCreatedBuildTargetId" in response ? response.architectSetupCreatedBuildTargetId : undefined;
    if (typeof createdBuildTargetId === "number") {
      setSelectedBuildTargetId(createdBuildTargetId);
    }
    setComposerText("");
    setWorkspaceNotice(
      typeof createdBuildTargetId === "number"
        ? "Project created from chat and selected in the sidebar."
        : queued
          ? "Message queued. It will be sent automatically after the current turn finishes."
          : "Message sent to the task."
    );
    setQueuePanelOpen(true);
    await refreshWorkspace();
  }

  function startEditingQueuedMessage(queueItem: QueuedComposerMessage) {
    setEditingQueueItemId(queueItem.id);
    setEditingQueueContent(editedQueueContentById[queueItem.id] ?? queueItem.content);
    setQueuePanelOpen(true);
  }

  function discardQueuedMessageEdit() {
    setEditingQueueItemId(null);
    setEditingQueueContent("");
  }

  async function handleClearQueuedMessage(queueItemId: number) {
    if (!selectedTaskId) return;
    setCancelledQueueItemIds((ids) => Array.from(new Set([...ids, queueItemId])));
    try {
      await clearQueuedMessageMutation.mutateAsync({ taskId: selectedTaskId, queueItemId });
      setWorkspaceNotice("Canceled");
      await refreshWorkspace();
    } catch (error) {
      setCancelledQueueItemIds((ids) => ids.filter((id) => id !== queueItemId));
      const message = error instanceof Error ? error.message : "The queued message could not be canceled. Try again.";
      setWorkspaceNotice(message);
      toast.error(message);
    }
  }

  async function handleSaveQueuedMessage(queueItem: QueuedComposerMessage) {
    const nextContent = editingQueueContent.trim();
    if (!selectedTaskId || !nextContent) return;
    await updateQueuedMessageMutation.mutateAsync({ taskId: selectedTaskId, queueItemId: queueItem.id, content: nextContent });
    setEditedQueueContentById((current) => ({ ...current, [queueItem.id]: nextContent }));
    setEditingQueueItemId(null);
    setEditingQueueContent("");
    setWorkspaceNotice("Queued message updated.");
    await refreshWorkspace();
  }

  async function handleStopGeneration() {
    if (!selectedTaskId || !activeTurn?.id) return;
    await stopGenerationMutation.mutateAsync({ taskId: selectedTaskId, turnId: activeTurn.id, activeOperation: activeTurn.state ?? null });
    setWorkspaceNotice("Stopped. Send a new message when you’re ready.");
    setStopConfirmOpen(false);
    await refreshWorkspace();
  }

  function handleStopButtonClick() {
    if (isWaitingForKimiApproval) {
      setStopConfirmOpen(true);
      return;
    }
    void handleStopGeneration();
  }

  async function handleToggleKimiApprovalPreference() {
    const nextValue = !alwaysRequireKimiApproval;
    await updateApprovalPreferenceMutation.mutateAsync({ alwaysRequireKimiApproval: nextValue });
    setWorkspaceNotice(nextValue ? "Kimi approval checks are on. Claude will show a plan before Kimi runs." : "Kimi approval checks are off. Auto coordination can pass Claude plans into Kimi without stopping for review.");
    await refreshWorkspace();
  }

  async function handleApproveKimiHandoff() {
    if (!selectedTaskId || !activeTurn?.id) return;
    await approveKimiHandoffMutation.mutateAsync({ taskId: selectedTaskId, turnId: activeTurn.id });
    setWorkspaceNotice("Approved. Kimi is now running with the Claude plan you reviewed.");
    setApprovalRevisionText("");
    await refreshWorkspace();
  }

  async function handleRequestKimiRevision() {
    if (!selectedTaskId || !activeTurn?.id || !approvalRevisionText.trim()) return;
    await requestKimiHandoffRevisionMutation.mutateAsync({ taskId: selectedTaskId, turnId: activeTurn.id, revisionMessage: approvalRevisionText.trim() });
    setWorkspaceNotice("Revision requested. Claude will produce an updated plan before Kimi can run.");
    setApprovalRevisionText("");
    await refreshWorkspace();
  }

  async function handleCancelKimiHandoff() {
    if (!selectedTaskId || !activeTurn?.id) return;
    await cancelKimiHandoffMutation.mutateAsync({ taskId: selectedTaskId, turnId: activeTurn.id });
    setWorkspaceNotice("Cancelled. Kimi did not run for this Claude plan.");
    setApprovalRevisionText("");
    await refreshWorkspace();
  }

  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!submitMessage.isPending && composerText.trim() && !isQueueFull) {
        void handleSendMessage();
      } else if (isQueueFull) {
        setWorkspaceNotice("Queue is full. Wait for the current message to finish, or cancel a queued message.");
      }
    }
  }

  function draftComposerMessage(message: string, notice: string) {
    setComposerText((current) => {
      if (!current.trim()) return message;
      if (current.trim() === message.trim()) return current;
      return `${current.trimEnd()}\n\n${message}`;
    });
    setWorkspaceNotice(notice);
    composerTextareaRef.current?.focus();
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
          <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-[#deded8] bg-white p-1">
            <Button type="button" variant="ghost" onClick={() => setActiveWorkspacePanel("tasks")} className={`h-9 rounded-xl text-xs ${activeWorkspacePanel === "tasks" ? "bg-[#1f1f1f] text-white hover:bg-black hover:text-white" : "text-[#66665f]"}`}>Tasks</Button>
            <Button type="button" variant="ghost" onClick={() => setActiveWorkspacePanel("skills")} className={`h-9 rounded-xl text-xs ${activeWorkspacePanel === "skills" ? "bg-[#1f1f1f] text-white hover:bg-black hover:text-white" : "text-[#66665f]"}`}>Skills</Button>
          </div>
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
            <GitBranch className="h-3.5 w-3.5" /> Projects
          </div>
          <div className="mb-6 space-y-2">
            <div className="rounded-2xl border border-[#d9d8d1] bg-white p-3" data-testid="project-setup-wizard">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[#30302b]">Connect a Project</p>
                  <p className="mt-1 text-[11px] leading-4 text-[#77766e]">Add your GitHub repository link, tell us where your token is stored, test the connection, then save the Project.</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button type="button" variant="ghost" onClick={() => setIsWizardMode(false)} className="h-7 rounded-xl px-2 text-[11px] text-[#5f5f58]">Advanced setup</Button>
                  <Badge variant="outline" className="rounded-full border-sky-200 bg-sky-50 text-[10px] text-sky-700">§1A</Badge>
                </div>
              </div>

              {isWizardMode ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-4 gap-1 text-[10px] font-semibold text-[#77766e]" aria-label="Connect a Project steps">
                    {["Where is your code?", "How should we sign in to your code?", "Where Claude and Kimi will work", "Test the connection"].map((label, index) => (
                      <div key={label} className={`rounded-full border px-2 py-1 text-center ${wizardStep === index + 1 ? "border-[#1f1f1f] bg-[#1f1f1f] text-white" : "border-[#deded8] bg-[#fbfaf7]"}`}>{index + 1}. {label}</div>
                    ))}
                  </div>

                  {wizardStep === 4 ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-900">
                      <CheckCircle2 className="mb-2 h-4 w-4" /> {WIZARD_PROJECT_CONNECTED_SUCCESS}
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <label className="block text-[11px] font-semibold text-[#30302b]" htmlFor="wizard-project-name">Project name</label>
                    <Input id="wizard-project-name" aria-label="Project name" value={wizardDisplayName} onChange={(event) => updateWizardTextField(setWizardDisplayName, event.target.value)} placeholder="Project name" className="h-9 rounded-xl border-[#d9d8d1] bg-white text-xs" />
                    <label className="block text-[11px] font-semibold text-[#30302b]" htmlFor="wizard-repo-link">Where is your code?</label>
                    <Input id="wizard-repo-link" aria-label="GitHub repository link" value={wizardRepoUrl} onChange={(event) => updateWizardTextField(setWizardRepoUrl, event.target.value)} placeholder="GitHub repository link, for example https://github.com/your-name/your-repo" className="h-9 rounded-xl border-[#d9d8d1] bg-white font-mono text-xs" />
                    {wizardRepoValidationMessage ? <p role="alert" className="text-[11px] leading-4 text-rose-700">{wizardRepoValidationMessage}</p> : null}
                    <label className="block text-[11px] font-semibold text-[#30302b]" htmlFor="wizard-token-env">How should we sign in to your code?</label>
                    <Input id="wizard-token-env" aria-label="GitHub token (stored as an environment variable)" value={wizardTokenEnvVar} onChange={(event) => updateWizardTextField(setWizardTokenEnvVar, event.target.value)} placeholder="VIYO_GITHUB_TOKEN" className="h-9 rounded-xl border-[#d9d8d1] bg-white font-mono text-xs" />
                    {wizardTokenValidationMessage ? <p role="alert" className="text-[11px] leading-4 text-rose-700">{wizardTokenValidationMessage}</p> : null}
                    <p className="text-[11px] leading-4 text-[#77766e]">We use a GitHub token to read and write code in your repository. The token value lives in your Manus environment — we only need its name here. Don’t paste the token here; paste only the environment variable name where you stored it (for example: VIYO_GITHUB_TOKEN).</p>
                    <details className="rounded-xl border border-[#deded8] bg-[#fbfaf7] p-2 text-[11px] leading-4 text-[#686861]">
                      <summary className="cursor-pointer font-semibold text-[#30302b]">Need help generating a token?</summary>
                      <p className="mt-2">Generate a fine-grained GitHub Personal Access Token scoped to this one repository with Contents read and write permission.</p>
                      <a className="mt-2 inline-block text-sky-700 underline" href="https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens" target="_blank" rel="noreferrer">Open GitHub’s token guide</a>
                    </details>
                    <label className="block text-[11px] font-semibold text-[#30302b]" htmlFor="wizard-base-branch">Where Claude and Kimi will work</label>
                    <Input id="wizard-base-branch" aria-label="Main branch name (usually main or master)" value={wizardBaseBranch} onChange={(event) => updateWizardTextField(setWizardBaseBranch, event.target.value)} placeholder="Main branch name (usually main or master)" className="h-9 rounded-xl border-[#d9d8d1] bg-white text-xs" />
                    <Button type="button" variant="outline" onClick={handleTestWizardConnection} disabled={isMutating || Boolean(wizardRepoValidationMessage || wizardTokenValidationMessage) || testBuildTargetConnectionMutation.isPending} className="w-full rounded-xl border-sky-200 bg-white text-xs text-sky-900">
                      {testBuildTargetConnectionMutation.isPending || wizardConnectionStatus === "testing" ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="mr-2 h-3.5 w-3.5" />} Test the connection
                    </Button>
                    {wizardConnectionMessage ? <p role="status" className={`rounded-xl border px-3 py-2 text-[11px] leading-4 ${wizardConnectionStatus === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>{wizardConnectionMessage}</p> : null}
                  </div>

                  {wizardStep === 2 || analyzeWizardMutation.isPending ? (
                    <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3 text-xs leading-5 text-sky-900">
                      <Loader2 className="mb-2 h-4 w-4 animate-spin" /> Reviewing the repository setup with AI. If review cannot complete, you can use optional advanced settings.
                    </div>
                  ) : null}

                  {wizardAnalysis && wizardAnalysis.status !== "ok" ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                      <p className="font-semibold">{wizardAnalysis.fallbackMessage || "Setup wizard couldn't complete. Switch to manual setup?"}</p>
                      {wizardAnalysis.errorMessage ? <p className="mt-1">{wizardAnalysis.errorMessage}</p> : null}
                      <Button type="button" variant="outline" onClick={handleUseAdvancedSetup} className="mt-2 h-8 w-full rounded-xl border-amber-300 bg-white text-xs">Switch to manual setup</Button>
                    </div>
                  ) : null}

                  {wizardStep === 3 && wizardAnalysis?.recommendation ? (
                    <div className="space-y-2" data-testid="project-wizard-review">
                      <div className="rounded-2xl border border-[#deded8] bg-[#fbfaf7] p-3 text-xs leading-5 text-[#66665f]">
                        <p className="font-semibold text-[#30302b]">Review AI recommendations</p>
                        <p>Each card can be approved as-is or adjusted before the Project is created. Repository context: {wizardAnalysis.repoContext?.detectedFrameworks?.join(", ") || "frameworks not detected"}.</p>
                      </div>

                      <div className="rounded-2xl border border-[#deded8] bg-white p-3" data-testid="setup-wizard-review-card">
                        <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold text-[#30302b]">Where Claude and Kimi will work</p><Badge variant="outline" className={`rounded-full text-[10px] ${confidenceTone(wizardAnalysis.recommendation.defaultBaseBranch.confidence)}`}>{wizardAnalysis.recommendation.defaultBaseBranch.confidence}</Badge></div>
                        <p className="mt-1 text-[11px] leading-4 text-[#77766e]">{wizardAnalysis.recommendation.defaultBaseBranch.rationale}</p>
                        <Input value={wizardBaseBranch} onChange={(event) => updateWizardTextField(setWizardBaseBranch, event.target.value)} className="mt-2 h-8 rounded-xl border-[#d9d8d1] bg-white text-xs" />
                      </div>

                      <div className="rounded-2xl border border-[#deded8] bg-white p-3" data-testid="setup-wizard-review-card">
                        <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold text-[#30302b]">First workspace name</p><Badge variant="outline" className={`rounded-full text-[10px] ${confidenceTone(wizardAnalysis.recommendation.branchStrategy.confidence)}`}>{wizardAnalysis.recommendation.branchStrategy.confidence}</Badge></div>
                        <p className="mt-1 text-[11px] leading-4 text-[#77766e]">{wizardAnalysis.recommendation.branchStrategy.rationale}</p>
                        <Input value={wizardInitialBranch} onChange={(event) => updateWizardTextField(setWizardInitialBranch, event.target.value)} placeholder="agent-work/workshop-repo" className="mt-2 h-8 rounded-xl border-[#d9d8d1] bg-white text-xs" />
                        {wizardInitialBranch.trim() && !wizardInitialBranch.trim().startsWith("agent-work/") ? <p role="note" className="mt-2 text-[11px] leading-4 text-sky-800">{WIZARD_PREFIX_ADDED_NOTE}</p> : null}
                      </div>

                      <div className="rounded-2xl border border-[#deded8] bg-white p-3" data-testid="setup-wizard-review-card">
                        <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold text-[#30302b]">Validation commands</p><Badge variant="outline" className={`rounded-full text-[10px] ${confidenceTone(wizardAnalysis.recommendation.validationCommands.confidence)}`}>{wizardAnalysis.recommendation.validationCommands.confidence}</Badge></div>
                        <p className="mt-1 text-[11px] leading-4 text-[#77766e]">{wizardAnalysis.recommendation.validationCommands.rationale}</p>
                        <Textarea value={wizardValidationCommands} onChange={(event) => updateWizardTextField(setWizardValidationCommands, event.target.value)} className="mt-2 min-h-[58px] rounded-xl border-[#d9d8d1] bg-white font-mono text-xs" />
                      </div>

                      <div className="rounded-2xl border border-[#deded8] bg-white p-3" data-testid="setup-wizard-review-card">
                        <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold text-[#30302b]">Service checks</p><Badge variant="outline" className={`rounded-full text-[10px] ${confidenceTone(wizardAnalysis.recommendation.serviceChecks.confidence)}`}>{wizardAnalysis.recommendation.serviceChecks.confidence}</Badge></div>
                        <p className="mt-1 text-[11px] leading-4 text-[#77766e]">{wizardAnalysis.recommendation.serviceChecks.rationale}</p>
                        <Textarea value={wizardServiceChecks} onChange={(event) => updateWizardTextField(setWizardServiceChecks, event.target.value)} placeholder="Optional service checks, one per line" className="mt-2 min-h-[50px] rounded-xl border-[#d9d8d1] bg-white font-mono text-xs" />
                      </div>

                      <div className="rounded-2xl border border-[#deded8] bg-white p-3" data-testid="setup-wizard-advanced-disclosure" onKeyDown={(event) => { if (event.key === "Escape") setShowWizardAdvancedSettings(false); }}>
                        <button type="button" aria-expanded={showWizardAdvancedSettings} onClick={() => setShowWizardAdvancedSettings((value) => !value)} className="flex w-full items-center justify-between text-left text-xs font-semibold text-[#30302b]">
                          <span>Advanced settings (optional)</span>
                          <span aria-hidden="true">{showWizardAdvancedSettings ? "Hide" : "Show"}</span>
                        </button>
                        {showWizardAdvancedSettings ? (
                          <div className="mt-3 space-y-3" data-testid="setup-wizard-advanced-settings">
                            <div data-testid="wizard-protected-branch-list">
                              <label className="text-[11px] font-semibold text-[#30302b]">Branch protection list</label>
                              <Input value={wizardProtectedBranches} onChange={(event) => updateWizardTextField(setWizardProtectedBranches, event.target.value)} placeholder="main, production" className="mt-1 h-8 rounded-xl border-[#d9d8d1] bg-white text-xs" />
                            </div>
                            <div data-testid="wizard-governance-files-editor">
                              <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold text-[#30302b]">Project rule books</p><Badge variant="outline" className={`rounded-full text-[10px] ${confidenceTone(wizardAnalysis.recommendation.projectRuleBooks.confidence)}`}>{wizardAnalysis.recommendation.projectRuleBooks.confidence}</Badge></div>
                              <p className="mt-1 text-[11px] leading-4 text-[#77766e]">{wizardAnalysis.recommendation.projectRuleBooks.rationale}</p>
                              {wizardGovernanceFiles.length === 0 ? <p className="mt-2 rounded-xl border border-dashed border-[#d9d8d1] bg-[#fbfaf7] p-2 text-[11px] text-[#77766e]">No Project rule books were detected. Leaving this empty is safe; add one path per line only if a repository document should guide AI work.</p> : null}
                              <Textarea value={wizardGovernanceFiles.map((row) => row.path).join("\n")} onChange={(event) => updateWizardGovernanceRows(governanceRowsFromPaths(event.target.value))} placeholder="Project rule books, one path per line" className="mt-2 min-h-[50px] rounded-xl border-[#d9d8d1] bg-white font-mono text-xs" />
                            </div>
                            <div data-testid="wizard-agent-env-map-editor">
                              <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold text-[#30302b]">AI environment variables</p><Badge variant="outline" className={`rounded-full text-[10px] ${confidenceTone(wizardAnalysis.recommendation.environmentVariables.confidence)}`}>{wizardAnalysis.recommendation.environmentVariables.confidence}</Badge></div>
                              <p className="mt-1 text-[11px] leading-4 text-[#77766e]">{wizardAnalysis.recommendation.environmentVariables.rationale}</p>
                              <Textarea value={wizardAgentEnvMap} onChange={(event) => updateWizardTextField(setWizardAgentEnvMap, event.target.value)} placeholder="WORKSPACE_ENV=SERVER_ENV_SOURCE" className="mt-2 min-h-[50px] rounded-xl border-[#d9d8d1] bg-white font-mono text-xs" />
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <Button type="button" onClick={handleCompleteWizard} disabled={isMutating || wizardConnectionStatus !== "ok"} className="w-full rounded-xl bg-[#1f1f1f] text-xs text-white hover:bg-black">
                        {completeWizardMutation.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-2 h-3.5 w-3.5" />} Save Project
                      </Button>
                    </div>
                  ) : (
                    <Button type="button" onClick={handleAnalyzeWizard} disabled={isMutating || wizardConnectionStatus !== "ok"} className="w-full rounded-xl bg-[#1f1f1f] text-xs text-white hover:bg-black">
                      {analyzeWizardMutation.isPending || wizardStep === 2 ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-2 h-3.5 w-3.5" />} Review recommended setup
                    </Button>
                  )}

                </div>
              ) : (
                <div className="space-y-2" data-testid="advanced-project-setup">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-[#30302b]">Advanced setup</p>
                    <Button type="button" variant="ghost" onClick={() => setIsWizardMode(true)} className="h-7 rounded-xl px-2 text-[11px] text-[#5f5f58]">Use setup wizard</Button>
                  </div>
                  <Input value={buildTargetName} onChange={(event) => setBuildTargetName(event.target.value)} placeholder="Project name" className="h-9 rounded-xl border-[#d9d8d1] bg-white text-xs" />
                  <Input value={buildTargetRepoUrl} onChange={(event) => setBuildTargetRepoUrl(event.target.value)} placeholder="GitHub repository link, for example https://github.com/org/repo" className="h-9 rounded-xl border-[#d9d8d1] bg-white font-mono text-xs" />
                  <Input value={buildTargetTokenEnvVar} onChange={(event) => setBuildTargetTokenEnvVar(event.target.value)} placeholder="VIYO_GITHUB_TOKEN" className="h-9 rounded-xl border-[#d9d8d1] bg-white font-mono text-xs" />
                  <p className="text-[11px] leading-4 text-[#77766e]">Enter only the environment variable name where the GitHub token is stored. The token value itself never goes in this form.</p>
                  <Input value={buildTargetDefaultBaseBranch} onChange={(event) => setBuildTargetDefaultBaseBranch(event.target.value)} placeholder="Main branch name, for example main or staging" className="h-9 rounded-xl border-[#d9d8d1] bg-white text-xs" />
                  <Input value={buildTargetProtectedBranches} onChange={(event) => setBuildTargetProtectedBranches(event.target.value)} placeholder="Branch protection list: main,staging" className="h-9 rounded-xl border-[#d9d8d1] bg-white text-xs" />
                  <Textarea value={buildTargetValidationCommands} onChange={(event) => setBuildTargetValidationCommands(event.target.value)} placeholder="Optional validation commands, one per line" className="min-h-[62px] rounded-xl border-[#d9d8d1] bg-white text-xs" />
                  <Textarea value={buildTargetServiceChecks} onChange={(event) => setBuildTargetServiceChecks(event.target.value)} placeholder="Optional service checks, one per line" className="min-h-[50px] rounded-xl border-[#d9d8d1] bg-white text-xs" />
                  <Textarea value={buildTargetAgentEnvMap} onChange={(event) => setBuildTargetAgentEnvMap(event.target.value)} placeholder="WORKSPACE_ENV=SERVER_ENV_SOURCE" className="min-h-[62px] rounded-xl border-[#d9d8d1] bg-white font-mono text-xs" data-testid="agent-env-var-map-input" />
                  <p className="text-[11px] leading-4 text-[#77766e]">Paste only the env var names where you set tokens and secrets. The actual values go in your portal environment, never in this form.</p>
                  <Button type="button" variant="outline" onClick={handleTestBuildTargetConnection} disabled={isMutating || !buildTargetRepoUrl.trim() || !buildTargetTokenEnvVar.trim()} className="w-full rounded-xl border-[#d9d8d1] bg-white text-xs">Test connection</Button>
                  <Button type="button" onClick={handleCreateBuildTarget} disabled={isMutating || !buildTargetRepoUrl.trim() || !buildTargetTokenEnvVar.trim()} className="w-full rounded-xl bg-[#1f1f1f] text-xs text-white hover:bg-black">
                    {createBuildTargetMutation.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-2 h-3.5 w-3.5" />} Add Project
                  </Button>
                </div>
              )}
            </div>
            {buildTargetsQuery.isLoading ? (
              <div className="rounded-2xl border border-[#d9d8d1] bg-white p-3 text-xs text-[#6d6d65]">Loading projects...</div>
            ) : buildTargets.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#cfcfc8] bg-white/70 p-3 text-xs leading-5 text-[#6d6d65]">No projects yet. Existing tasks stay intact until you connect a repository.</div>
            ) : (
              buildTargets.slice(0, 5).map((target) => (
                <button key={target.id} type="button" onClick={() => setSelectedBuildTargetId(target.id)} className={`w-full rounded-2xl border p-3 text-left text-xs transition ${selectedBuildTarget?.id === target.id ? "border-emerald-300 bg-white shadow-sm" : "border-transparent bg-transparent hover:bg-white/70"}`}>
                  <span className="block truncate text-sm font-semibold text-[#30302b]">{target.name}</span>
                  <a href={target.repoUrl} target="_blank" rel="noreferrer" className="mt-1 block truncate font-mono text-[11px] text-[#5c6f99] underline-offset-2 hover:underline" onClick={(event) => event.stopPropagation()}>{target.repoUrl}</a>
                  <span className="mt-1 block truncate text-[#77766e]">Base {target.defaultBaseBranch} · Env mappings: {Object.keys(JSON.parse(target.agentEnvVarMapJson || "{}")).length}</span>
                </button>
              ))
            )}
          </div>
          <div className="mb-2 flex items-center justify-between gap-2 px-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#77766e]">
            <span className="inline-flex items-center gap-2"><PanelLeft className="h-3.5 w-3.5" /> Live tasks</span>
            <Button type="button" variant="outline" onClick={() => setTaskSortMode((mode) => mode === "recent" ? "created" : "recent")} className="h-7 rounded-full border-[#d9d8d1] bg-white px-2.5 text-[11px] normal-case tracking-normal text-[#55554f]" data-testid="section1a-conv-task-sort">
              Sort: {taskSortMode === "recent" ? "Most recent" : "Created"}
            </Button>
          </div>
          <div className="space-y-2" data-testid="section1a-conv-live-tasks">
            {tasksQuery.isLoading ? (
              <div className="rounded-2xl border border-[#d9d8d1] bg-white p-4 text-sm text-[#6d6d65]">Loading tasks...</div>
            ) : liveTasks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#cfcfc8] bg-white/70 p-4 text-sm leading-6 text-[#6d6d65]">
                No live tasks yet. Create one from the title and task message to establish Claude/Kimi coordination context.
                <Button type="button" onClick={handleCreateTask} disabled={isMutating} className="mt-3 w-full rounded-xl bg-[#1f1f1f] text-xs text-white hover:bg-black">Create first task</Button>
              </div>
            ) : (
              liveTasks.map((task) => (
                <article
                  key={task.id}
                  data-testid="left-nav-task-card"
                  className={`max-w-full overflow-hidden rounded-2xl border p-3 text-left transition ${selectedTaskId === task.id ? "border-sky-300 bg-white shadow-sm" : "border-transparent bg-transparent hover:bg-white/70"}`}
                >
                  <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                    <button type="button" onClick={() => setSelectedTaskId(task.id)} className="min-w-0 overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200">
                      {editingTaskId === task.id ? (
                        <Input value={editingTaskTitle} onChange={(event) => setEditingTaskTitle(event.target.value)} onClick={(event) => event.stopPropagation()} aria-label={`Rename ${task.title}`} className="h-8 rounded-xl border-[#d9d8d1] bg-white text-sm font-semibold" />
                      ) : (
                        <p className="truncate text-sm font-semibold text-[#2c2c28]">{task.title}</p>
                      )}
                    </button>
                    <Badge variant="outline" className={`max-w-[96px] shrink-0 truncate rounded-full text-[10px] ${statusTone[task.status] ?? statusTone.active}`}>{task.status}</Badge>
                  </div>
                  <button type="button" onClick={() => setSelectedTaskId(task.id)} className="mt-2 block w-full min-w-0 overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200">
                    <p className="line-clamp-2 text-xs leading-5 text-[#66665f]">{ownerFacingText(task.summary) || "No summary recorded yet."}</p>
                    <p className="mt-2 truncate text-[11px] text-[#9a998f]">Updated {compactDate(task.updatedAt)}</p>
                  </button>
                  <div className="mt-3 flex min-w-0 flex-wrap justify-end gap-2">
                    {editingTaskId === task.id ? (
                      <>
                        <Button type="button" variant="outline" size="sm" onClick={() => void handleRenameTask(task.id)} disabled={renameTaskMutation.isPending} className="h-8 rounded-full border-emerald-200 bg-emerald-50 px-3 text-[11px] text-emerald-900">Save</Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => { setEditingTaskId(null); setEditingTaskTitle(""); }} className="h-8 rounded-full border-[#d9d8d1] bg-white px-3 text-[11px] text-[#66665f]">Cancel</Button>
                      </>
                    ) : (
                      <Button type="button" variant="outline" size="sm" onClick={() => beginTaskRename(task)} className="h-8 rounded-full border-[#d9d8d1] bg-white px-3 text-[11px] text-[#66665f] hover:text-[#2c2c28]" data-testid="section1a-conv-task-rename">Rename</Button>
                    )}
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
          <div className="mt-5 space-y-2" data-testid="section1a-conv-archived-tasks">
            <div className="px-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#77766e]">Archived tasks</div>
            {archivedTasks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#cfcfc8] bg-white/70 p-3 text-xs leading-5 text-[#6d6d65]">No archived tasks match this search.</div>
            ) : (
              archivedTasks.map((task) => (
                <button key={task.id} type="button" onClick={() => setSelectedTaskId(task.id)} className="w-full rounded-2xl border border-transparent bg-white/40 p-3 text-left opacity-80 hover:bg-white/70">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#2c2c28]">{task.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#66665f]">{ownerFacingText(task.summary) || "No summary recorded yet."}</p>
                    </div>
                    <Badge variant="outline" className={`max-w-[96px] shrink-0 truncate rounded-full text-[10px] ${statusTone[task.status] ?? statusTone.archived}`}>{task.status}</Badge>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="mt-6 mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#77766e]">
            <Brain className="h-3.5 w-3.5" /> Global memory
          </div>
          <div className="space-y-2 pb-4">
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/80 p-3" data-testid="section1a-conv-project-memory-viewer">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-indigo-950">Project Memory</p>
                <Badge variant="outline" className="rounded-full border-indigo-200 bg-white text-[10px] text-indigo-800">{selectedBuildTarget ? selectedBuildTarget.name : "No project"}</Badge>
              </div>
              <p className="mt-1 text-[11px] leading-4 text-indigo-900/80">Scoped to the selected project only. Cross-project context is not shown here.</p>
              <div className="mt-2 space-y-2">
                {!selectedBuildTarget ? (
                  <p className="rounded-xl border border-dashed border-indigo-200 bg-white/70 p-2 text-[11px] leading-4 text-indigo-900/70">Select an Advanced Setup project before project-scoped memory appears.</p>
                ) : projectMemories.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-indigo-200 bg-white/70 p-2 text-[11px] leading-4 text-indigo-900/70">No project memory is saved for this project yet.</p>
                ) : (
                  projectMemories.slice(0, 5).map((memory) => (
                    <div key={memory.id} className="rounded-xl border border-indigo-100 bg-white p-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[11px] font-semibold text-[#30302b]">{memory.key}</p>
                        <Badge variant="outline" className="rounded-full text-[10px]">Project</Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[#74746c]">{memory.value}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
            {memories.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#cfcfc8] bg-white/70 p-4 text-xs leading-5 text-[#6d6d65]">
                Durable memory is empty. Decisions, features, research, and past-task learnings will appear here only after real records exist.
                <Button type="button" variant="outline" onClick={() => draftComposerMessage("Record the key decision or reusable context for this task.", "Memory-note draft added to the task composer. Review it, then send it to save durable context through the task thread.")} className="mt-3 w-full rounded-xl border-[#d9d8d1] bg-white text-xs">Draft memory note</Button>
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
            {selectedBuildTarget ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-emerald-100 bg-white p-3 text-xs leading-5 text-[#686861]" data-testid="section4-env-settings">
                  <p className="font-semibold text-[#30302b]">AI environment variables</p>
                  <p className="mt-1">These get written into a hidden file inside the project's working folder so the AI can use them. The file is gitignored — the AI cannot accidentally commit your secrets.</p>
                  <p className="mt-1 font-mono text-[11px] text-emerald-800">Current: {Object.entries(selectedBuildTargetEnvMap).map(([key, value]) => `${key}←${value}`).join(", ") || "none"}</p>
                </div>
                <div className="rounded-2xl border border-violet-100 bg-white p-3 text-xs leading-5 text-[#686861]" data-testid="section2-governance-files-settings">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-[#30302b]">Project rule books</p>
                      <p className="mt-1">Files in your repo that the AI reads on every task before doing anything. Required rule books that are missing will block tasks until you add them.</p>
                    </div>
                    <Badge className="rounded-full border-violet-200 bg-violet-50 text-violet-800">{buildTargetGovernanceFiles.filter((row) => row.path.trim()).length} files</Badge>
                  </div>
                  <label className="mt-3 flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50 px-3 py-2 text-[11px] font-medium text-violet-900">
                    <input type="checkbox" checked={buildTargetGovernanceBudgetEnforced} onChange={(event) => setBuildTargetGovernanceBudgetEnforced(event.target.checked)} className="h-3.5 w-3.5 rounded border-violet-300" />
                    Trim rule books if they're too long for the AI's brain. Recommended on: optional rule books are trimmed first, and required rule books note what was shortened.
                  </label>
                  <div className="mt-3 space-y-2">
                    {buildTargetGovernanceFiles.map((row, index) => (
                      <div key={`${index}-${row.path}`} className="rounded-xl border border-[#e4e2db] bg-[#fbfaf7] p-2" data-testid="governance-file-row">
                        <Input value={row.path} onChange={(event) => updateGovernanceRow(index, { path: event.target.value })} aria-label="Path in repo" placeholder="docs/rules.md or specs/{taskSlug}.md" className="h-8 rounded-lg border-[#d9d8d1] bg-white font-mono text-[11px]" />
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <label className="flex items-center gap-1.5 rounded-lg border border-[#deded8] bg-white px-2 py-1 text-[11px]" title="If checked, missing this file blocks the AI from starting tasks."><input type="checkbox" checked={row.required} onChange={(event) => updateGovernanceRow(index, { required: event.target.checked })} /> Required</label>
                          <label className="flex items-center gap-1.5 rounded-lg border border-[#deded8] bg-white px-2 py-1 text-[11px]" title="For advanced rule books whose path changes based on what the AI is currently working on. Leave unchecked unless you know you need this."><input type="checkbox" checked={row.dynamic} onChange={(event) => updateGovernanceRow(index, { dynamic: event.target.checked })} /> Path includes current focus</label>
                        </div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-[1.2fr_1fr]">
                          <div className="grid grid-cols-2 gap-1 rounded-lg border border-[#d9d8d1] bg-white p-1" aria-label="Rule book or current focus indicator">
                            {(["governance", "placeholder_resolver"] as const).map((role) => (
                              <button
                                key={role}
                                type="button"
                                onClick={() => updateGovernanceRow(index, { role })}
                                className={`rounded-md px-2 py-1 text-[10px] font-semibold transition ${row.role === role ? "bg-[#242420] text-white" : "text-[#686861] hover:bg-[#f0efea]"}`}
                              >
                                {role === "governance" ? "Rule book" : "Current focus indicator"}
                              </button>
                            ))}
                          </div>
                          <Input value={row.resolverKey ?? ""} onChange={(event) => updateGovernanceRow(index, { resolverKey: event.target.value })} aria-label="Focus indicator name" placeholder="Focus indicator name, e.g. taskSlug" className="h-8 rounded-lg border-[#d9d8d1] text-[11px]" />
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          <Button type="button" variant="outline" onClick={() => moveGovernanceRow(index, -1)} disabled={index === 0 || isMutating} className="h-8 rounded-lg border-[#d9d8d1] bg-white text-[11px]">Up</Button>
                          <Button type="button" variant="outline" onClick={() => moveGovernanceRow(index, 1)} disabled={index === buildTargetGovernanceFiles.length - 1 || isMutating} className="h-8 rounded-lg border-[#d9d8d1] bg-white text-[11px]">Down</Button>
                          <Button type="button" variant="outline" onClick={() => setBuildTargetGovernanceFiles((rows) => rows.length > 1 ? rows.filter((_, rowIndex) => rowIndex !== index) : [defaultGovernanceRow()])} disabled={isMutating} className="h-8 rounded-lg border-rose-100 bg-rose-50 text-[11px] text-rose-700">Remove</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button type="button" variant="outline" onClick={() => setBuildTargetGovernanceFiles((rows) => [...rows, defaultGovernanceRow()])} disabled={isMutating} className="mt-2 w-full rounded-xl border-violet-100 bg-violet-50 text-xs text-violet-900">Add rule book</Button>
                  <Button type="button" variant="outline" onClick={handleUpdateBuildTargetSettings} disabled={isMutating} className="mt-2 w-full rounded-xl border-emerald-200 bg-emerald-50 text-xs text-emerald-900">Save project settings</Button>
                </div>
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </aside>

      <section className="flex h-screen min-h-0 min-w-0 flex-col bg-[#fbfaf7]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#deded8] bg-white/80 px-5 py-4 backdrop-blur">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#77766e]">
              {activeWorkspacePanel === "skills" ? <Sparkles className="h-4 w-4" /> : <MessageSquareText className="h-4 w-4" />} {activeWorkspacePanel === "skills" ? "Skill Libraries" : "Center task thread"}
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em] text-[#20201d]">{activeWorkspacePanel === "skills" ? "Reusable AI instructions" : selectedThread?.task.title ?? "Create or select a task"}</h1>
          </div>

          {activeWorkspacePanel === "tasks" && selectedBuildTarget ? (
            <div className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">Project: {selectedBuildTarget.name}</p>
                  <p className="mt-1 text-xs text-emerald-800">Base branch {selectedBuildTarget.defaultBaseBranch}. Protected branches are never direct push targets.</p>
                </div>
                <div className="flex min-w-[220px] flex-1 gap-2 sm:flex-none">
                  <Input value={buildBranchName} onChange={(event) => setBuildBranchName(event.target.value)} placeholder="agent-work/portal-task" className="h-9 rounded-xl border-emerald-200 bg-white text-xs" />
                  <Button type="button" onClick={handleCreateBuildBranch} disabled={isMutating} className="h-9 rounded-xl bg-emerald-700 px-3 text-xs text-white hover:bg-emerald-800">
                    {createBuildBranchMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Open"}
                  </Button>
                  {isBuildModeOpen ? (
                    <Button type="button" variant="outline" onClick={() => setOpenedBuildBranch(null)} className="h-9 rounded-xl border-emerald-200 bg-white px-3 text-xs text-emerald-900">
                      Close
                    </Button>
                  ) : null}
                </div>
              </div>
              {isBuildModeOpen ? (
                <div className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-xs text-emerald-900" data-testid="section4-push-policy">
                  <p className="font-semibold">Project: {selectedBuildTarget.name} • Branch: {openedBuildBranch.branchName}</p>
                  <p className="mt-1">Push checks: protected branches blocked, working tree must be clean, AI environment file is never committed.</p>
                  <Button type="button" variant="outline" onClick={handlePushBuildBranch} disabled={isMutating || openedBuildBranch.state !== "clean"} className="mt-2 rounded-xl border-emerald-200 bg-white text-xs text-emerald-900" data-testid="section4-push-button">
                    {pushBuildBranchMutation.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <GitBranch className="mr-2 h-3.5 w-3.5" />} Push branch
                  </Button>
                  <span className="ml-2 font-mono text-[11px]">Push status: {pushStatusLabel(openedBuildBranch.pushState)}</span>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              {credentials.map((credential: { provider: string; configured: boolean; status: string; reason?: string }) => (
                <Badge key={credential.provider} variant="outline" title={credential.reason} className={`rounded-full ${credential.configured ? "border-emerald-200 bg-emerald-100 text-emerald-800" : "border-rose-200 bg-rose-100 text-rose-800"}`}>
                  {credential.provider}: {credential.status}
                </Badge>
              ))}
              <Button variant="outline" onClick={() => logout()} className="rounded-full border-[#d9d8d1] bg-white">Logout</Button>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" aria-label="Open provider status drawer" onClick={() => setCredentialsDrawerOpen(true)} className="h-8 rounded-full border-violet-200 bg-violet-50 px-3 text-xs text-violet-900" data-testid="section1a-conv-credentials-drawer-open">
                <LockKeyhole className="mr-1.5 h-3.5 w-3.5" /> Credentials drawer
              </Button>
              <Button type="button" variant="outline" onClick={() => draftArchitectOnboardingMessage("setup")} className="h-8 rounded-full border-indigo-200 bg-indigo-50 px-3 text-xs text-indigo-900" data-testid="section1a-conv-architect-start">
                <Bot className="mr-1.5 h-3.5 w-3.5" /> Ask Architect
              </Button>
            </div>
            {credentials.some((credential: { configured: boolean }) => !credential.configured) ? (
              <p className="max-w-xl text-right text-[11px] leading-4 text-[#77766e]">
                {credentials.filter((credential: { configured: boolean }) => !credential.configured).map((credential: { reason?: string }) => credential.reason).filter(Boolean).join(" ")}
              </p>
            ) : null}
          </div>
        </header>

        {activeWorkspacePanel === "skills" ? (
          <SkillLibrariesPanel />
        ) : (
          <>
        <div className="min-h-0 flex-1 overflow-y-auto p-5" data-testid="center-task-thread-scroll">
          <div className="mx-auto max-w-4xl space-y-4">
            <div className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-white to-indigo-50/70 p-4 shadow-sm" data-testid="section1a-conv-onboarding-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700">
                    <Bot className="h-4 w-4" /> Architect-in-Portal
                  </div>
                  <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-[#20201d]">Conversational project onboarding</h2>
                  <p className="mt-1 text-sm leading-6 text-[#5f5e57]">Use the task composer for setup, credentials, and onboarding questions. Build turns still pause for the same §9 review before Kimi runs.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => draftArchitectOnboardingMessage("setup")} className="rounded-full border-indigo-200 bg-white text-xs text-indigo-900">Start setup chat</Button>
                  <Button type="button" variant="outline" aria-label="Draft provider setup question" onClick={() => draftArchitectOnboardingMessage("credentials")} className="rounded-full border-violet-200 bg-white text-xs text-violet-900">Check credentials</Button>
                  <Button type="button" variant="outline" aria-label="Open form wizard escape hatch" onClick={() => setIsWizardMode(false)} className="rounded-full border-[#d9d8d1] bg-white text-xs text-[#42423c]" data-testid="section1a-conv-advanced-setup-escape">Advanced Setup</Button>
                </div>
              </div>
            </div>
            {selectedTaskId ? (
              <div data-testid="handoff-indicator" className="flex flex-wrap items-center gap-2 rounded-2xl border border-sky-100 bg-sky-50/80 px-3 py-2 text-xs leading-5 text-[#4f5f68]">
                <Sparkles className="h-4 w-4 text-sky-600" />
                <span className="font-semibold text-[#26333a]">Claude → owner review → Kimi</span>
                <span>Claude prepares the plan first. When approval checks are on, Kimi waits until you approve, request a revision, or cancel the handoff.</span>
              </div>
            ) : null}
            {!selectedTaskId ? (
              <div className="flex min-h-[42vh] items-end justify-center pb-8 text-center text-sm leading-6 text-[#77766e]">
                <p className="max-w-lg">Start typing below. A task record is created quietly, and the first submitted message starts the selected model route.</p>
              </div>
            ) : threadQuery.isLoading ? (
              <div className="rounded-2xl border border-[#deded8] bg-white p-5 text-sm text-[#6d6d65]">Loading task thread...</div>
            ) : events.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#cfcfc8] bg-white p-8 text-center text-sm leading-6 text-[#6d6d65]">This task has no owner messages yet. Creating it only made the task record; send the first message to initialize Claude Opus 4.7 and Kimi K2.6 through the coordinator.<Button type="button" onClick={() => setComposerText((value) => value || "Please plan the first implementation step for this task.")} className="mt-4 rounded-xl bg-[#1f1f1f] text-xs text-white hover:bg-black">Draft first message</Button></div>
            ) : (
              <div className="space-y-4">
                {ownerVisibleEvents.length === 0 && !providerFailureCopy && !isWaitingForKimiApproval ? (
                  <div className="rounded-2xl border border-dashed border-[#cfcfc8] bg-white p-8 text-center text-sm leading-6 text-[#6d6d65]">
                    No owner-facing task message is ready yet. Send a message below to start the AI coordinator.
                  </div>
                ) : null}

                {isWaitingForKimiApproval ? (
                  <article className="rounded-3xl border border-amber-200 bg-amber-50/90 p-4 shadow-sm" data-testid="section9-kimi-approval-card">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-amber-700" />
                          <h3 className="text-sm font-semibold text-[#2b2b27]">Review Claude&apos;s plan before Kimi runs</h3>
                          <Badge variant="outline" className="rounded-full border-amber-300 bg-white text-[10px] text-amber-800">waiting for you</Badge>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-[#4b4a43]">Claude has prepared a plan. Review it below, then choose whether Kimi should execute it, Claude should revise it, or the handoff should stop here.</p>
                      </div>
                      <Badge variant="outline" className="rounded-full border-amber-200 bg-white text-[10px] text-amber-800">Turn #{activeTurn?.id}</Badge>
                    </div>
                    <div className="mt-4 rounded-2xl border border-amber-100 bg-white p-3">
                      <div className="mb-2 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#77766e]">
                        <span>Claude plan for review</span>
                        <span>Kimi has not run</span>
                      </div>
                      <p className="max-h-64 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-[#34342f]">{ownerFacingText(activeTurn?.approvalPlanContent || "Claude plan is ready for review.")}</p>
                    </div>
                    <div className="mt-3 grid gap-2 rounded-2xl border border-amber-100 bg-white/70 p-3 text-xs leading-5 text-[#5c5749] sm:grid-cols-3" data-testid="section9-approval-diagnostics">
                      <span><strong>Route:</strong> {activeTurn?.route ?? "dual"}</span>
                      <span><strong>Status:</strong> waiting for owner approval</span>
                      <span><strong>Requested:</strong> {compactDate(activeTurn?.approvalRequestedAt)}</span>
                    </div>
                    <Textarea
                      value={approvalRevisionText}
                      onChange={(event) => setApprovalRevisionText(event.target.value)}
                      placeholder="Optional: tell Claude what to revise before Kimi runs."
                      className="mt-3 min-h-20 resize-none rounded-2xl border-amber-100 bg-white text-sm"
                      data-testid="section9-approval-revision-input"
                    />
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button type="button" onClick={() => void handleApproveKimiHandoff()} disabled={isMutating} className="rounded-full bg-[#1f1f1f] px-4 text-xs text-white hover:bg-black" data-testid="section9-approve-kimi">
                        {approveKimiHandoffMutation.isPending ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3 w-3" />}
                        Approve Kimi
                      </Button>
                      <Button type="button" variant="outline" onClick={() => void handleRequestKimiRevision()} disabled={isMutating || !approvalRevisionText.trim()} className="rounded-full border-amber-200 bg-white px-4 text-xs text-amber-800" data-testid="section9-request-revision">
                        {requestKimiHandoffRevisionMutation.isPending ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <RotateCcw className="mr-1.5 h-3 w-3" />}
                        Revise plan
                      </Button>
                      <Button type="button" variant="outline" onClick={() => void handleCancelKimiHandoff()} disabled={isMutating} className="rounded-full border-rose-200 bg-white px-4 text-xs text-rose-700" data-testid="section9-cancel-kimi">
                        {cancelKimiHandoffMutation.isPending ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <CircleAlert className="mr-1.5 h-3 w-3" />}
                        Cancel handoff
                      </Button>
                    </div>
                  </article>
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
            {hasActiveGeneration || visibleQueuedMessages.length > 0 ? (
              <div className="mb-3 rounded-2xl border border-sky-100 bg-sky-50/90 px-3 py-2 text-xs leading-5 text-[#40545f]" data-testid="section8-generation-queue-panel" onKeyDown={(event) => { if (event.key === "Escape") setQueuePanelOpen(false); }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    {hasActiveGeneration && !isWaitingForKimiApproval ? <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-700" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                    <span className="font-semibold text-[#26333a]">Queued messages (will send after current turn)</span>
                    <Badge variant="outline" className={`rounded-full bg-white text-[10px] ${isQueueFull ? "border-rose-200 text-rose-700" : "border-sky-200 text-sky-800"}`} data-testid="section8-queue-count">{queueCountLabel}</Badge>
                    {isQueueFull ? <span className="text-rose-700">Queue is full. Wait for the current message to finish, or cancel a queued message.</span> : isWaitingForKimiApproval ? <span>Messages sent now wait until you approve, revise, or stop the plan.</span> : hasActiveGeneration ? <span>Messages sent now wait and run after the current turn.</span> : <span>Queued messages can be edited or canceled before they are sent.</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {activeTurn?.id ? <Badge variant="outline" className="rounded-full border-sky-200 bg-white text-[10px] text-sky-800">Turn #{activeTurn.id}</Badge> : null}
                    <Button type="button" variant="outline" onClick={() => setQueuePanelOpen((open) => !open)} aria-expanded={queuePanelOpen} aria-controls="section8-queued-messages" className="h-7 rounded-full border-sky-200 bg-white px-2.5 text-[11px] text-sky-800" data-testid="section8-queue-toggle">
                      {queuePanelOpen ? "Hide queue" : "Show queue"}
                    </Button>
                  </div>
                </div>
                {visibleQueuedMessages.length > 0 && queuePanelOpen ? (
                  <div id="section8-queued-messages" className="mt-2 flex flex-col gap-2" data-testid="section8-queued-messages">
                    {visibleQueuedMessages.slice(0, MAX_QUEUED_MESSAGES_PER_TASK_UI).map((queueItem) => {
                      const displayedContent = editedQueueContentById[queueItem.id] ?? queueItem.content;
                      const isEditing = editingQueueItemId === queueItem.id;
                      return (
                        <div key={queueItem.id} className="rounded-xl border border-sky-100 bg-white px-3 py-2">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#77766e]">
                                <span>Queued #{queueItem.position}</span>
                                <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 text-[10px] text-slate-700">{queuedMessageStateLabel(queueItem.state)}</Badge>
                                <span>{compactDate(queueItem.createdAt)}</span>
                              </div>
                              {isEditing ? (
                                <Textarea value={editingQueueContent} onChange={(event) => setEditingQueueContent(event.target.value)} aria-label={`Edit queued message ${queueItem.position}`} className="min-h-20 resize-none rounded-xl border-sky-100 bg-white text-xs leading-5" />
                              ) : (
                                <p className="min-w-0 whitespace-pre-wrap break-words text-[#34434a]">{displayedContent}</p>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              {isEditing ? (
                                <>
                                  <Button type="button" variant="outline" onClick={() => void handleSaveQueuedMessage(queueItem)} disabled={isMutating || !editingQueueContent.trim()} className="h-7 rounded-full border-emerald-200 bg-emerald-50 px-2 text-[11px] text-emerald-800">Save changes</Button>
                                  <Button type="button" variant="outline" onClick={discardQueuedMessageEdit} disabled={isMutating} className="h-7 rounded-full border-[#d9d8d1] bg-white px-2 text-[11px]">Discard</Button>
                                </>
                              ) : (
                                <>
                                  <Button type="button" variant="outline" onClick={() => startEditingQueuedMessage(queueItem)} disabled={isMutating} className="h-7 rounded-full border-[#d9d8d1] bg-white px-2 text-[11px]">Edit</Button>
                                  <Button type="button" variant="outline" onClick={() => void handleClearQueuedMessage(queueItem.id)} disabled={isMutating} className="h-7 rounded-full border-rose-200 bg-white px-2 text-[11px] text-rose-700">Cancel</Button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
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
                <button
                  type="button"
                  role="switch"
                  aria-checked={alwaysRequireKimiApproval}
                  onClick={() => void handleToggleKimiApprovalPreference()}
                  disabled={updateApprovalPreferenceMutation.isPending}
                  className={`h-7 rounded-full border px-2.5 text-[11px] font-semibold transition ${alwaysRequireKimiApproval ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-[#d9d8d1] bg-white text-[#66665f]"}`}
                  data-testid="section9-kimi-approval-preference"
                >
                  Always check before Kimi runs: {alwaysRequireKimiApproval ? "On" : "Off"}
                </button>
                <span className="hidden sm:inline">{hasActiveGeneration ? "Enter queues · Shift+Enter adds a line" : "Enter sends · Shift+Enter adds a line"}</span>
                {hasActiveGeneration ? (
                  <Button type="button" variant="outline" onClick={handleStopButtonClick} disabled={!activeTurn?.id || stopGenerationMutation.isPending} className="h-7 rounded-full border-rose-200 bg-white px-2.5 text-[11px] text-rose-700" data-testid="section8-stop-generation">
                    {stopGenerationMutation.isPending ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <CircleAlert className="mr-1.5 h-3 w-3" />}
                    {stopButtonLabel}
                  </Button>
                ) : null}
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
                ref={composerTextareaRef}
                value={composerText}
                onChange={(event) => setComposerText(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder="Send message to the task..."
                id="task-message-composer"
                aria-label="Task message"
                aria-describedby="task-composer-send-help"
                aria-controls="section8-send-or-queue-button"
                aria-keyshortcuts="Enter"
                data-testid="section8-task-message-composer"
                className="max-h-36 min-h-11 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm leading-6 shadow-none focus-visible:ring-0"
              />
              <p id="task-composer-send-help" className="sr-only">Press Enter in the task message composer or activate the stable send button to submit the current task message. Press Shift and Enter to add a line break.</p>
              <Button type="button" id="section8-send-or-queue-button" onClick={handleSendMessage} disabled={submitMessage.isPending || !composerText.trim() || isQueueFull} className={`mb-1 h-9 shrink-0 rounded-full px-3 text-white hover:bg-black ${hasActiveGeneration ? "w-auto bg-sky-700 hover:bg-sky-800" : "w-9 bg-[#1f1f1f] p-0"}`} aria-label={hasActiveGeneration ? "Queue message for task" : "Send message to task"} aria-controls="task-message-composer" aria-describedby="task-composer-send-help" aria-keyshortcuts="Enter" data-testid="section8-send-or-queue-button">
                {submitMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : hasActiveGeneration ? <span className="text-xs font-semibold">Queue</span> : <SendHorizontal className="h-4 w-4" />}
              </Button>
            </div>
            <Drawer open={credentialsDrawerOpen} onOpenChange={setCredentialsDrawerOpen} direction="right">
        <DrawerContent className="bg-[#fbfaf7] text-[#30302b]" data-testid="section1a-conv-credentials-drawer">
          <DrawerHeader>
            <DrawerTitle>Credentials Drawer</DrawerTitle>
            <DrawerDescription>Token values stay in Manus env vars. This view shows provider status and env var names only.</DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-4">
            {credentials.map((credential: { provider: string; configured: boolean; status: string; reason?: string; lastCheckedAt?: number | string | Date | null; envVarName?: string | null }) => (
              <div key={credential.provider} className="rounded-2xl border border-[#deded8] bg-white p-3" data-testid="section1a-conv-credential-row">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold capitalize text-[#30302b]">{credential.provider}</p>
                    <p className="mt-1 font-mono text-[11px] text-[#6d6d65]">{credential.envVarName ?? credential.provider.toUpperCase() + "_API_KEY"}</p>
                  </div>
                  <Badge variant="outline" className={credential.configured ? "rounded-full border-emerald-200 bg-emerald-50 text-[10px] text-emerald-800" : "rounded-full border-rose-200 bg-rose-50 text-[10px] text-rose-800"}>{credential.status}</Badge>
                </div>
                {credential.reason ? <p className="mt-2 text-xs leading-5 text-[#6d6d65]">{credential.reason}</p> : null}
                <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-[#77766e]">
                  <span>Last tested: {compactDate(credential.lastCheckedAt)}</span>
                  <Button type="button" variant="outline" onClick={() => { if (credential.provider === "claude" || credential.provider === "kimi") void handleRefreshCredential(credential.provider); }} disabled={credentialsRefreshMutation.isPending || (credential.provider !== "claude" && credential.provider !== "kimi")} className="h-7 rounded-full border-[#d9d8d1] bg-white px-2.5 text-[11px]">Test now</Button>
                </div>
              </div>
            ))}
            {credentials.length === 0 ? <p className="rounded-2xl border border-dashed border-[#cfcfc8] bg-white/70 p-3 text-xs leading-5 text-[#77766e]">No credential rows are available yet.</p> : null}
          </div>
          <DrawerFooter>
            <Button type="button" variant="outline" aria-label="Open form wizard from drawer" onClick={() => { setCredentialsDrawerOpen(false); setIsWizardMode(false); }} className="rounded-xl border-[#d9d8d1] bg-white text-xs">Advanced Setup</Button>
            <Button type="button" onClick={() => setCredentialsDrawerOpen(false)} className="rounded-xl bg-[#242420] text-xs text-white hover:bg-black">Close drawer</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <AlertDialog open={stopConfirmOpen} onOpenChange={setStopConfirmOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Stop and discard this plan?</AlertDialogTitle>
                  <AlertDialogDescription>Any queued messages will be sent after the next message you submit.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep plan</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void handleStopGeneration()} className="bg-rose-700 text-white hover:bg-rose-800">Stop and discard</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            {workspaceNotice ? <p className="mt-2 text-xs leading-5 text-[#66665f]" role="status" aria-live="polite">{workspaceNotice}</p> : null}
          </div>
        </footer>
          </>
        )}
      </section>

      <aside className="flex h-screen min-h-0 min-w-0 flex-col overflow-hidden border-l border-[#d9d8d1] bg-[#f0efeb] lg:col-span-2 xl:col-span-1">
        <Tabs defaultValue="files" className="flex h-full min-h-0 flex-col" data-testid="task-inspector-tabs">
          <div className="border-b border-[#d9d8d1] p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#77766e]">
              <PanelRight className="h-4 w-4" /> Task inspector
            </div>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[#20201d]">Files and activity, context, and diagnostics</h2>
            <TabsList className="mt-4 grid w-full grid-cols-4 rounded-2xl border border-[#deded8] bg-white p-1">
              <TabsTrigger value="files" className="rounded-xl px-2 text-[11px] data-[state=active]:bg-[#1f1f1f] data-[state=active]:text-white">Files</TabsTrigger>
              <TabsTrigger value="activity" className="rounded-xl px-2 text-[11px] data-[state=active]:bg-[#1f1f1f] data-[state=active]:text-white">AI Activity</TabsTrigger>
              <TabsTrigger value="context" className="rounded-xl px-2 text-[11px] data-[state=active]:bg-[#1f1f1f] data-[state=active]:text-white">Context</TabsTrigger>
              <TabsTrigger value="diagnostics" className="rounded-xl px-2 text-[11px] data-[state=active]:bg-[#1f1f1f] data-[state=active]:text-white">Diagnostics</TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="min-h-0 min-w-0 flex-1 p-4">
            <TabsContent value="files" className="mt-0 space-y-4">
              <Card
                className={`border-[#deded8] bg-white text-[#242420] transition ${isFileDragActive ? "border-sky-300 ring-2 ring-sky-100" : ""}`}
                data-testid="windows-file-manager"
                aria-label="Task files drop zone"
                onDragOver={handleFileDragOver}
                onDragLeave={handleFileDragLeave}
                onDrop={handleFileDrop}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base"><FolderOpen className="h-4 w-4 text-amber-600" /> Task folder</CardTitle>
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
                    <div className="rounded-2xl border border-dashed border-[#cfcfc8] bg-[#fbfaf7] p-4 text-xs leading-5 text-[#6d6d65]">This task folder is empty. Files will appear here only after a real storage-backed file record exists.<Button type="button" variant="outline" onClick={() => openUploadPicker("task")} disabled={!selectedTaskId || uploadWorkspaceFileMutation.isPending} className="mt-3 w-full rounded-xl border-[#d9d8d1] bg-white text-xs">Upload first task file</Button></div>
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
                              <span className="hidden text-[10px] text-[#687568] sm:inline">Source: {attachedGlobalFileSourceLabel(link.source)}</span>
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
                    <div className="rounded-2xl border border-dashed border-[#cfcfc8] bg-[#fbfaf7] p-4 text-xs leading-5 text-[#6d6d65]">Global Files is empty. Add reusable briefs, standards, screenshots, or references here when they should not belong to only one task.<Button type="button" variant="outline" onClick={() => openUploadPicker("global")} disabled={uploadWorkspaceFileMutation.isPending} className="mt-3 w-full rounded-xl border-[#d9d8d1] bg-white text-xs">Upload first Global File</Button></div>
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
                  <CardTitle className="flex items-center gap-2 text-base"><Archive className="h-4 w-4 text-stone-600" /> All recorded files</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {allFiles.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#cfcfc8] bg-[#fbfaf7] p-4 text-xs leading-5 text-[#6d6d65]">The all-files index is empty because no real task or global files have been recorded yet.<Button type="button" variant="outline" onClick={() => openUploadPicker("global")} className="mt-3 w-full rounded-xl border-[#d9d8d1] bg-white text-xs">Upload reusable file</Button></div>
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
            </TabsContent>

            <TabsContent value="activity" className="mt-0 space-y-4">
              <Card className="border-[#deded8] bg-white text-[#242420]" data-testid="worker-action-log">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4 text-emerald-600" /> AI Activity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-3 text-xs leading-5 text-[#4f6756]">This is a read-only activity feed for the AI coordinator, Claude, and Kimi. It does not run commands; terminal access remains a separate advanced diagnostic tool.</p>
                  {workerActivityItems.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#cfcfc8] bg-[#fbfaf7] p-4 text-xs leading-5 text-[#6d6d65]">No worker activity has been recorded for this task yet. Send a message to start the first Claude or Kimi turn.<Button type="button" onClick={() => setComposerText((value) => value || "Start the first AI turn for this task.")} className="mt-3 w-full rounded-xl bg-[#1f1f1f] text-xs text-white hover:bg-black">Draft first AI turn</Button></div>
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
            </TabsContent>

            <TabsContent value="context" className="mt-0 space-y-4">
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
              <Card className="border-[#deded8] bg-white text-[#242420]" data-testid="context-memory-panel">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base"><Brain className="h-4 w-4 text-violet-600" /> Context memory</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs leading-5 text-[#686861]">
                  <p>Claude and Kimi receive the selected task thread, task files, attached Global Files, and saved memory before each coordinated turn.</p>
                  {memories.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#cfcfc8] bg-[#fbfaf7] p-4 text-xs leading-5 text-[#6d6d65]">
                      No saved memory records are available yet. Add a durable decision in the task thread, then it can appear here for future turns.
                      <Button type="button" variant="outline" onClick={() => setComposerText((value) => value || "Record this decision as reusable context for future AI turns.")} className="mt-3 w-full rounded-xl border-[#d9d8d1] bg-white text-xs">Draft context note</Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {memories.slice(0, 6).map((memory) => (
                        <div key={memory.id} className="rounded-2xl border border-[#deded8] bg-[#fbfaf7] p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-xs font-semibold text-[#30302b]">{memory.title}</p>
                            <Badge variant="outline" className="rounded-full text-[10px]">{memory.category.replace("_", " ")}</Badge>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#74746c]">{memory.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="diagnostics" className="mt-0 space-y-4">
              <Card className="border-[#deded8] bg-white text-[#242420]" data-testid="diagnostics-summary">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Advanced tools</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs leading-5 text-[#686861]">
                  <p>Diagnostics are intentionally opt-in. The normal folder view stays non-technical while raw terminal and filesystem controls stay hidden unless you explicitly open advanced tools.</p>
                  <Button type="button" variant="outline" onClick={() => setShowAdvancedTools((value) => !value)} className="w-full rounded-xl border-[#d9d8d1] bg-white text-xs">
                    {showAdvancedTools ? "Hide developer diagnostics" : "Show developer diagnostics"}
                  </Button>
                </CardContent>
              </Card>
              {showAdvancedTools ? (
                <div className="space-y-4">

                  {selectedBuildTarget ? (
                    <div className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs leading-5 text-emerald-900">
                      <p className="font-semibold">Read-only project tree</p>
                      <p className="mt-1">This task is linked to {selectedBuildTarget.name}. Git writes stay behind explicit working-branch actions; shipped task files below are not replaced.</p>
                    </div>
                  ) : null}
                  <FilesystemPanel workspaceId={selectedTaskId ?? undefined} />
                  <div className="rounded-2xl border border-[#deded8] bg-[#fbfaf7] p-4 text-xs leading-5 text-[#686861]" data-testid="diagnostics-workspace-toggle">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold text-[#30302b]">Terminal workspace</p>
                        <p className="mt-1">Choose where developer diagnostics open. Personal workspace is the default; Project Build Branch is available only after a branch is opened for the selected Project.</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!openedBuildBranch?.workspacePath}
                        onClick={() => setUseBuildBranchDiagnosticsWorkspace((value) => !value)}
                        className="rounded-xl border-[#d9d8d1] bg-white text-xs"
                      >
                        {diagnosticsBuildBranchPath ? "Use Personal workspace" : "Use Project Build Branch"}
                      </Button>
                    </div>
                    <p className="mt-3 text-[11px] font-medium text-[#55554f]">Current diagnostics terminal: {diagnosticsWorkspaceLabel}</p>
                    {!openedBuildBranch?.workspacePath ? (
                      <p className="mt-2 text-[11px] text-[#85857b]">Open a Project Build Branch before using the Project Build Branch terminal workspace.</p>
                    ) : null}
                  </div>
                  <TerminalPanel workspacePath={diagnosticsBuildBranchPath} workspaceLabel={diagnosticsWorkspaceLabel} />
                </div>
              ) : null}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </aside>
    </main>
  );
}
