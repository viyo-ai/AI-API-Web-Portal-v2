import { useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { toast } from "sonner";
import { AIChatBox, type Message as AIChatMessage } from "@/components/AIChatBox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import { Bot, Check, Copy, Download, FileUp, Github, HelpCircle, Loader2, MoreHorizontal, Plus, Search, SlidersHorizontal, Sparkles, Trash2, UploadCloud } from "lucide-react";

type SkillScope = "global" | "task-type" | "file-pattern" | "manual-only";
type SkillSource = "created" | "uploaded" | "official" | "github_imported" | "ai_built";
type SkillTaskType = "code-write" | "refactor" | "test-write" | "planning" | "review" | "other";

type SkillPayload = {
  slug?: string;
  name: string;
  scope: SkillScope;
  content: string;
  taskTypes: SkillTaskType[];
  filePatterns: string[];
  enabled: boolean;
  version: string;
  description?: string | null;
  source: SkillSource;
  sourceMetadata?: Record<string, unknown> | null;
};

type SkillRecord = SkillPayload & {
  id: number;
  slug: string;
  isOfficial?: boolean;
  ownerUserId?: number;
  createdAt?: number | string | Date;
  updatedAt?: number | string | Date;
  loadReason?: { type?: string; taskType?: string; pattern?: string };
  displayTag?: string;
};

type ParsedSkillFile = { filename: string; skill: SkillPayload };
type ParsedFrontmatterValue = string | boolean | Array<string | boolean>;

type GithubPreviewItem = {
  id: string;
  filePath: string;
  commitSha?: string | null;
  skill: SkillPayload;
};

const scopeLabels: Record<SkillScope, string> = {
  global: "Always-on",
  "task-type": "For certain kinds of tasks",
  "file-pattern": "When working on certain files",
  "manual-only": "Only when I pick it",
};

const taskTypeLabels: Record<SkillTaskType, string> = {
  "code-write": "Writing code",
  refactor: "Cleaning up code",
  "test-write": "Writing tests",
  planning: "Planning",
  review: "Reviewing",
  other: "Other",
};

const sourceLabels: Record<SkillSource, string> = {
  created: "Created",
  uploaded: "Uploaded",
  official: "Official",
  github_imported: "From GitHub",
  ai_built: "Built with AI",
};

const buildWithAiStarter: AIChatMessage[] = [
  {
    role: "assistant",
    content: "Tell me what you want your AI assistant to do differently. I will ask a few short questions, draft the skill, and help you save it when it looks right.",
  },
];

function formatDate(value: unknown) {
  if (!value) return "Not yet updated";
  const date = new Date(value as string | number | Date);
  if (Number.isNaN(date.getTime())) return "Not yet updated";
  return date.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "skill";
}

function incrementPatch(version: string | undefined) {
  const [major, minor, patch] = (version || "1.0.0").split(".").map((part) => Number.parseInt(part, 10));
  if ([major, minor, patch].some((part) => Number.isNaN(part))) return "1.0.1";
  return `${major}.${minor}.${patch + 1}`;
}

function parseScalar(raw: string): ParsedFrontmatterValue {
  const trimmed = raw.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed.slice(1, -1).split(",").map((item) => parseScalar(item)).filter((value): value is string | boolean => typeof value === "string" || typeof value === "boolean").filter(Boolean);
  }
  return trimmed;
}

function parseFrontmatter(text: string, filename: string): SkillPayload {
  const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) throw new Error(`upload-error: missing YAML frontmatter in '${filename}'`);
  const [, yaml, body] = match;
  const data: Record<string, unknown> = {};
  let currentListKey: string | null = null;
  for (const rawLine of yaml.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const listItem = line.match(/^\s*-\s*(.+)$/);
    if (listItem && currentListKey) {
      const existing = Array.isArray(data[currentListKey]) ? data[currentListKey] as unknown[] : [];
      data[currentListKey] = [...existing, parseScalar(listItem[1])];
      continue;
    }
    const keyValue = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!keyValue) continue;
    const [, key, value] = keyValue;
    if (value === "") {
      data[key] = [];
      currentListKey = key;
    } else {
      data[key] = parseScalar(value);
      currentListKey = null;
    }
  }
  const name = typeof data.name === "string" ? data.name.trim() : "";
  if (!name) throw new Error(`upload-error: missing required field 'name' in '${filename}'`);
  const scope = typeof data.scope === "string" ? data.scope as SkillScope : "manual-only";
  if (!Object.keys(scopeLabels).includes(scope)) throw new Error(`upload-error: invalid scope in '${filename}'`);
  const content = body.trim();
  if (!content) throw new Error(`upload-error: missing skill body in '${filename}'`);
  return {
    slug: typeof data.slug === "string" && data.slug.trim() ? slugify(data.slug) : slugify(name),
    name,
    description: typeof data.description === "string" ? data.description : null,
    scope,
    taskTypes: Array.isArray(data.taskTypes) ? data.taskTypes.filter((value): value is SkillTaskType => typeof value === "string" && value in taskTypeLabels) : [],
    filePatterns: Array.isArray(data.filePatterns) ? data.filePatterns.filter((value): value is string => typeof value === "string" && value.trim().length > 0) : [],
    content,
    enabled: typeof data.enabled === "boolean" ? data.enabled : true,
    version: typeof data.version === "string" && /^\d+\.\d+\.\d+$/.test(data.version) ? data.version : "1.0.0",
    source: "uploaded",
  };
}

function extractJsonObject(text: string): Partial<SkillPayload> | null {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i)?.[1];
  const candidates = [fenced, text.match(/\{[\s\S]*\}/)?.[0]].filter(Boolean) as string[];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && typeof parsed.name === "string" && typeof parsed.content === "string") return parsed;
    } catch {
      // Keep looking for a valid JSON object.
    }
  }
  return null;
}

function serializeMarkdown(skill: SkillRecord | SkillPayload) {
  const taskTypes = (skill.taskTypes ?? []).map((value) => `  - ${value}`).join("\n");
  const filePatterns = (skill.filePatterns ?? []).map((value) => `  - \"${value}\"`).join("\n");
  return `---\nslug: ${skill.slug ?? slugify(skill.name)}\nname: ${skill.name}\ndescription: ${skill.description ?? ""}\nscope: ${skill.scope}\nversion: ${skill.version ?? "1.0.0"}\ntaskTypes:${taskTypes ? `\n${taskTypes}` : " []"}\nfilePatterns:${filePatterns ? `\n${filePatterns}` : " []"}\n---\n\n${skill.content}\n`;
}

function downloadSkill(skill: SkillRecord) {
  const blob = new Blob([serializeMarkdown(skill)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${skill.slug || slugify(skill.name)}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function SkillLibrariesPanel() {
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [search, setSearch] = useState("");
  const [libraryView, setLibraryView] = useState<"all" | "custom" | "official">("all");
  const [enabledFilter, setEnabledFilter] = useState<"all" | "enabled" | "disabled">("all");
  const [scopeFilter, setScopeFilter] = useState<SkillScope | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<SkillSource | "all">("all");
  const [selectedSkill, setSelectedSkill] = useState<SkillRecord | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pendingDuplicate, setPendingDuplicate] = useState<ParsedSkillFile | null>(null);
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [aiMessages, setAiMessages] = useState<AIChatMessage[]>(buildWithAiStarter);
  const [aiDraft, setAiDraft] = useState<Partial<SkillPayload> | null>(null);
  const [showGithubDialog, setShowGithubDialog] = useState(false);
  const [githubRepoUrl, setGithubRepoUrl] = useState("");
  const [githubPath, setGithubPath] = useState("");
  const [githubBranch, setGithubBranch] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [githubPreview, setGithubPreview] = useState<GithubPreviewItem[]>([]);
  const [selectedGithubIds, setSelectedGithubIds] = useState<Set<string>>(new Set());
  const [showOfficialCatalog, setShowOfficialCatalog] = useState(false);
  const [testTaskId, setTestTaskId] = useState<number | null>(null);
  const [detailDraft, setDetailDraft] = useState<SkillRecord | null>(null);

  const skillListInput = useMemo(() => ({ includeDisabled: true, includeOfficial: true, limit: 200 }), []);
  const skillsQuery = trpc.skills.list.useQuery(skillListInput);
  const officialCatalogQuery = trpc.skills.officialCatalog.useQuery({ limit: 200 });
  const tasksQuery = trpc.tasks.list.useQuery({ includeArchived: false, limit: 100 });
  const aiDraftMutation = trpc.skills.aiDraft.useMutation();
  const createSkillMutation = trpc.skills.create.useMutation({ onSuccess: () => utils.skills.list.invalidate() });
  const replaceBySlugMutation = trpc.skills.replaceBySlug.useMutation({ onSuccess: () => utils.skills.list.invalidate() });
  const updateSkillMutation = trpc.skills.update.useMutation({ onSuccess: () => utils.skills.list.invalidate() });
  const setEnabledMutation = trpc.skills.setEnabled.useMutation({ onSuccess: () => utils.skills.list.invalidate() });
  const duplicateMutation = trpc.skills.duplicate.useMutation({ onSuccess: () => utils.skills.list.invalidate() });
  const forkOfficialMutation = trpc.skills.forkOfficial.useMutation({ onSuccess: () => utils.skills.list.invalidate() });
  const deleteSkillMutation = trpc.skills.delete.useMutation({ onSuccess: () => utils.skills.list.invalidate() });
  const githubPreviewMutation = trpc.skills.previewGithubImport.useMutation();
  const githubImportMutation = trpc.skills.importGithubSelected.useMutation({ onSuccess: () => utils.skills.list.invalidate() });
  const taskSkillInput = useMemo(() => ({ taskId: testTaskId ?? 1 }), [testTaskId]);
  const taskSkillsQuery = trpc.skills.listForTask.useQuery(taskSkillInput, { enabled: Boolean(testTaskId) });
  const pickForTaskMutation = trpc.skills.pickForTask.useMutation({
    onSuccess: async () => {
      await utils.skills.listForTask.invalidate(taskSkillInput);
      toast.success("Skill attached to this task. It will load in the next AI turn.");
    },
    onError: (error) => toast.error(error.message),
  });
  const removeForTaskMutation = trpc.skills.removeForTask.useMutation({
    onSuccess: async () => {
      await utils.skills.listForTask.invalidate(taskSkillInput);
      toast.success("Skill removed from this task.");
    },
    onError: (error) => toast.error(error.message),
  });

  const skills = (skillsQuery.data ?? []) as SkillRecord[];
  const customSkillCount = skills.filter((skill) => !skill.isOfficial).length;
  const officialSkillCount = skills.filter((skill) => skill.isOfficial).length;
  const hasActiveListFilters = Boolean(search.trim()) || libraryView !== "all" || enabledFilter !== "all" || scopeFilter !== "all" || sourceFilter !== "all";
  const filteredSkills = useMemo(() => {
    const term = search.trim().toLowerCase();
    return skills.filter((skill) => {
      if (libraryView === "official" && !skill.isOfficial) return false;
      if (libraryView === "custom" && skill.isOfficial) return false;
      if (enabledFilter === "enabled" && !skill.enabled) return false;
      if (enabledFilter === "disabled" && skill.enabled) return false;
      if (scopeFilter !== "all" && skill.scope !== scopeFilter) return false;
      if (sourceFilter !== "all" && skill.source !== sourceFilter) return false;
      if (!term) return true;
      return [skill.name, skill.slug, skill.description ?? ""].join(" ").toLowerCase().includes(term);
    });
  }, [enabledFilter, libraryView, scopeFilter, search, skills, sourceFilter]);

  function revealFullLibrary() {
    setLibraryView("all");
    setEnabledFilter("all");
    setScopeFilter("all");
    setSourceFilter("all");
    setSearch("");
  }

  const selectedTask = (tasksQuery.data ?? []).find((task: any) => task.id === testTaskId);
  const selectedTaskSkills = (taskSkillsQuery.data?.skills ?? []) as SkillRecord[];
  const isSelectedSkillAttached = Boolean(selectedSkill && selectedTaskSkills.some((skill) => skill.id === selectedSkill.id));
  const taskSkillActionPending = pickForTaskMutation.isPending || removeForTaskMutation.isPending;

  function attachSelectedSkillToTask() {
    if (!selectedSkill || !testTaskId) return;
    pickForTaskMutation.mutate({ taskId: testTaskId, skillId: selectedSkill.id } as any);
  }

  function removeSelectedSkillFromTask() {
    if (!selectedSkill || !testTaskId) return;
    removeForTaskMutation.mutate({ taskId: testTaskId, skillId: selectedSkill.id, reason: "Owner removed from skill detail" } as any);
  }

  async function createParsedSkill(parsed: ParsedSkillFile) {
    const payload: SkillPayload = {
      ...parsed.skill,
      source: parsed.skill.source,
      sourceMetadata: {
        ...(parsed.skill.sourceMetadata ?? {}),
        originalFilename: parsed.filename,
        uploadedAt: new Date().toISOString(),
      },
    };
    try {
      const created = await createSkillMutation.mutateAsync(payload as any) as SkillRecord;
      revealFullLibrary();
      setSelectedSkill(created);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("already exists")) {
        revealFullLibrary();
        setPendingDuplicate(parsed);
        return false;
      }
      toast.error(message);
      return false;
    }
  }

  async function handleUploadFiles(files: FileList | File[]) {
    const parsed: ParsedSkillFile[] = [];
    for (const file of Array.from(files)) {
      try {
        if (file.name.toLowerCase().endsWith(".zip")) {
          const zip = await JSZip.loadAsync(file);
          const entries = Object.values(zip.files).filter((entry) => !entry.dir && !entry.name.includes("/") && /\.(md|skill)$/i.test(entry.name));
          for (const entry of entries) {
            const text = await entry.async("text");
            parsed.push({ filename: entry.name, skill: parseFrontmatter(text, entry.name) });
          }
        } else if (/\.(md|skill)$/i.test(file.name)) {
          parsed.push({ filename: file.name, skill: parseFrontmatter(await file.text(), file.name) });
        } else {
          toast.error(`upload-error: unsupported file type in '${file.name}'`);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
      }
    }
    let createdCount = 0;
    for (const item of parsed) {
      const created = await createParsedSkill(item);
      if (created) createdCount += 1;
    }
    if (createdCount > 0) toast.success(`Created ${createdCount} skills.`);
  }

  async function handleAiMessage(content: string) {
    const nextMessages: AIChatMessage[] = [...aiMessages, { role: "user", content }];
    setAiMessages(nextMessages);
    try {
      const result = await aiDraftMutation.mutateAsync({ messages: nextMessages.map((message) => ({ role: message.role, content: message.content })) } as any) as { content: string; draft?: Partial<SkillPayload> | null };
      const assistantMessage = { role: "assistant" as const, content: result.content };
      setAiMessages([...nextMessages, assistantMessage]);
      const draft = result.draft ?? extractJsonObject(result.content);
      if (draft) setAiDraft(draft);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Claude could not draft the skill yet.");
      setAiMessages([...nextMessages, { role: "assistant", content: "I could not reach Claude for this draft. Please try again after checking the server credential." }]);
    }
  }

  async function saveAiDraft() {
    if (!aiDraft?.name || !aiDraft.content) {
      toast.error("Ask the AI to produce the final JSON draft before saving.");
      return;
    }
    const created = await createSkillMutation.mutateAsync({
      slug: aiDraft.slug ? slugify(aiDraft.slug) : slugify(aiDraft.name),
      name: aiDraft.name,
      description: aiDraft.description ?? null,
      scope: (aiDraft.scope as SkillScope) ?? "manual-only",
      taskTypes: (aiDraft.taskTypes ?? []) as SkillTaskType[],
      filePatterns: aiDraft.filePatterns ?? [],
      content: aiDraft.content,
      enabled: true,
      version: "1.0.0",
      source: "ai_built",
      sourceMetadata: { sessionId: crypto.randomUUID(), builtAt: new Date().toISOString(), modelUsed: "claude-opus-4-7" },
    } as any) as SkillRecord;
    setSelectedSkill(created);
    await utils.skills.list.invalidate();
    await skillsQuery.refetch();
    setShowAiDialog(false);
    setAiDraft(null);
    setAiMessages(buildWithAiStarter);
    toast.success("Built with AI skill saved and added to the library.");
  }

  async function saveDetailDraft() {
    if (!detailDraft) return;
    const updated = await updateSkillMutation.mutateAsync({
      skillId: detailDraft.id,
      name: detailDraft.name,
      version: detailDraft.version,
      description: detailDraft.description ?? null,
      content: detailDraft.content,
      enabled: detailDraft.enabled,
      scope: detailDraft.scope,
      taskTypes: detailDraft.taskTypes ?? [],
      filePatterns: detailDraft.filePatterns ?? [],
    } as any) as SkillRecord;
    setSelectedSkill(updated);
    setDetailDraft(null);
    toast.success("Skill saved.");
  }

  async function handleGithubPreview() {
    const result = await githubPreviewMutation.mutateAsync({ repoUrl: githubRepoUrl, path: githubPath || undefined, branch: githubBranch || undefined, githubToken: githubToken || undefined } as any) as { skills: GithubPreviewItem[] };
    setGithubPreview(result.skills);
    setSelectedGithubIds(new Set(result.skills.map((item) => item.id)));
    if (result.skills.length === 0) toast.info("No valid skill files were found in that repo path.");
  }

  async function handleGithubImport() {
    const selected = githubPreview.filter((item) => selectedGithubIds.has(item.id));
    const result = await githubImportMutation.mutateAsync({ repoUrl: githubRepoUrl, path: githubPath || undefined, branch: githubBranch || undefined, selected } as any) as { created: SkillRecord[] };
    setShowGithubDialog(false);
    setGithubPreview([]);
    setSelectedGithubIds(new Set());
    if (result.created[0]) setSelectedSkill(result.created[0]);
    toast.success(`Imported ${result.created.length} skills from GitHub.`);
  }

  function renderCard(skill: SkillRecord) {
    return (
      <Card key={skill.id} className="group cursor-pointer rounded-3xl border-[#dddcd5] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" onClick={() => { setSelectedSkill(skill); setDetailDraft(null); }}>
        <CardHeader className="space-y-3 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="truncate text-xl tracking-[-0.03em] text-[#242420]">{skill.name}</CardTitle>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#66665f]">Version {skill.version} — {skill.description || "No description yet."}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2" onClick={(event) => event.stopPropagation()}>
              {skill.isOfficial ? <Badge className="rounded-full border-amber-200 bg-amber-100 text-amber-800">Official</Badge> : null}
              <Switch checked={skill.enabled} aria-label={`Enable ${skill.name}`} onCheckedChange={(enabled) => setEnabledMutation.mutate({ skillId: skill.id, enabled } as any)} />
            </div>
          </div>
        </CardHeader>
        <CardFooter className="flex items-center justify-between border-t border-[#ecebe4] px-6 py-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="rounded-full border-[#d9d8d1] bg-[#fbfaf7] text-[#66665f]">{sourceLabels[skill.source] ?? "Created"}</Badge>
            <span className="text-xs text-[#77766e]">Updated on {formatDate(skill.updatedAt)}</span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={(event) => event.stopPropagation()} aria-label={`More actions for ${skill.name}`}><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
              <DropdownMenuItem onSelect={() => { setSelectedSkill(skill); setDetailDraft({ ...skill, version: incrementPatch(skill.version) }); }}>Edit</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => duplicateMutation.mutate({ skillId: skill.id } as any)}><Copy className="mr-2 h-4 w-4" />Duplicate</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => downloadSkill(skill)}><Download className="mr-2 h-4 w-4" />Export</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-700" onSelect={() => { if (confirm(`Delete '${skill.name}'?`)) deleteSkillMutation.mutate({ skillId: skill.id } as any); }}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardFooter>
      </Card>
    );
  }

  const detail = detailDraft ?? selectedSkill;

  return (
    <section
      className={`h-full min-h-0 overflow-hidden bg-[#f7f6f2] p-6 ${isDragging ? "ring-4 ring-sky-200" : ""}`}
      onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => { event.preventDefault(); setIsDragging(false); void handleUploadFiles(event.dataTransfer.files); }}
    >
      <input ref={fileInputRef} type="file" accept=".md,.skill,.zip" multiple className="hidden" onChange={(event) => { if (event.target.files) void handleUploadFiles(event.target.files); event.currentTarget.value = ""; }} />
      {showOfficialCatalog ? (
        <div className="mx-auto flex h-full max-w-6xl flex-col gap-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Button variant="ghost" className="mb-2 rounded-full px-0 text-[#5d6d92]" onClick={() => setShowOfficialCatalog(false)}>Back to Skills</Button>
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#242420]">Official catalog</h1>
              <p className="mt-2 text-sm text-[#66665f]">Pre-built skills from the catalog.</p>
            </div>
          </div>
          {officialCatalogQuery.isLoading ? <p className="text-sm text-[#77766e]">Loading official catalog...</p> : (officialCatalogQuery.data ?? []).length === 0 ? (
            <Card className="rounded-3xl border-dashed border-[#cfcfc8] bg-white/70 p-8 text-center text-[#66665f]">No official skills yet. The official catalog is curated by the portal owner and grows over time.</Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {((officialCatalogQuery.data ?? []) as SkillRecord[]).map((skill) => (
                <Card key={skill.id} className="rounded-3xl bg-white">
                  <CardHeader><CardTitle>{skill.name}</CardTitle><p className="text-sm text-[#66665f]">{skill.description}</p></CardHeader>
                  <CardFooter><Button onClick={() => forkOfficialMutation.mutate({ skillId: skill.id } as any)} className="rounded-xl bg-[#1f1f1f] text-white hover:bg-black"><Check className="mr-2 h-4 w-4" />Add to my library</Button></CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : selectedSkill ? (
        <div className="mx-auto flex h-full max-w-6xl flex-col gap-5 overflow-hidden">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <Button variant="ghost" className="mb-2 rounded-full px-0 text-[#5d6d92]" onClick={() => { setSelectedSkill(null); setDetailDraft(null); }}>Back to Skills</Button>
              <h1 className="truncate text-3xl font-semibold tracking-[-0.04em] text-[#242420]">{detail?.name}</h1>
              <p className="mt-2 text-sm text-[#66665f]">{scopeLabels[detail?.scope ?? "manual-only"]} · {sourceLabels[detail?.source ?? "created"]}</p>
            </div>
            <Switch checked={Boolean(detail?.enabled)} onCheckedChange={(enabled) => setDetailDraft({ ...(detail as SkillRecord), enabled })} aria-label="Enable selected skill" />
          </div>
          <Tabs defaultValue="about" className="flex min-h-0 flex-1 flex-col">
            <TabsList className="w-fit rounded-full bg-white"><TabsTrigger value="about">About</TabsTrigger><TabsTrigger value="content">Content</TabsTrigger><TabsTrigger value="loads">Where it loads</TabsTrigger></TabsList>
            <TabsContent value="about" className="min-h-0 flex-1 overflow-auto">
              <Card className="rounded-3xl bg-white">
                <CardContent className="grid gap-4 p-6 md:grid-cols-2">
                  <div><Label>Name</Label><Input value={detail?.name ?? ""} onChange={(event) => setDetailDraft({ ...(detail as SkillRecord), name: event.target.value })} className="mt-2 rounded-xl" /></div>
                  <div><Label>Version</Label><Input value={detail?.version ?? "1.0.0"} onChange={(event) => setDetailDraft({ ...(detail as SkillRecord), version: event.target.value })} className="mt-2 rounded-xl" /></div>
                  <div className="md:col-span-2"><Label>Description</Label><Textarea value={detail?.description ?? ""} onChange={(event) => setDetailDraft({ ...(detail as SkillRecord), description: event.target.value })} className="mt-2 min-h-24 rounded-xl" /></div>
                  <div className="rounded-2xl border border-[#ecebe4] bg-[#fbfaf7] p-4"><p className="text-sm font-semibold">Scope</p><p className="mt-1 text-sm text-[#66665f]">{scopeLabels[detail?.scope ?? "manual-only"]}. To change scope, edit the skill content and loading settings.</p></div>
                  <div className="rounded-2xl border border-[#ecebe4] bg-[#fbfaf7] p-4"><p className="text-sm font-semibold">Source</p><p className="mt-1 text-sm text-[#66665f]">{sourceLabels[detail?.source ?? "created"]} {detail?.sourceMetadata ? `· ${JSON.stringify(detail.sourceMetadata)}` : ""}</p></div>
                  <div className="md:col-span-2 rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <Label>Test on a task</Label>
                      <select value={testTaskId ?? ""} onChange={(event) => setTestTaskId(event.target.value ? Number(event.target.value) : null)} className="h-9 rounded-xl border border-[#d9d8d1] bg-white px-3 text-sm"><option value="">Pick a task</option>{(tasksQuery.data ?? []).map((task: any) => <option key={task.id} value={task.id}>{task.title}</option>)}</select>
                      {selectedTask ? (
                        isSelectedSkillAttached ? (
                          <Button type="button" variant="outline" className="rounded-xl bg-white" onClick={removeSelectedSkillFromTask} disabled={taskSkillActionPending}>{taskSkillActionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Remove from task</Button>
                        ) : (
                          <Button type="button" className="rounded-xl bg-[#1f1f1f] text-white hover:bg-black" onClick={attachSelectedSkillToTask} disabled={taskSkillActionPending}>{taskSkillActionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Attach to task</Button>
                        )
                      ) : null}
                    </div>
                    {selectedTask ? <p className="mt-2 text-xs text-[#4d6484]">{isSelectedSkillAttached ? "Attached: this skill will be included in the next AI turn for this task." : "Attach this skill to make it available to the selected task's next AI turn."}</p> : null}
                    {selectedTask ? <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap rounded-xl bg-white p-3 text-xs text-[#45453e]">{`Skill preview for task: ${selectedTask.title}\n\n<skill name="${detail?.name}" scope="${scopeLabels[detail?.scope ?? "manual-only"]}">\n${detail?.content}\n</skill>`}</pre> : null}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="content" className="min-h-0 flex-1 overflow-auto">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="rounded-3xl bg-white"><CardHeader><CardTitle>Markdown editor</CardTitle></CardHeader><CardContent><Textarea value={detail?.content ?? ""} onChange={(event) => setDetailDraft({ ...(detail as SkillRecord), content: event.target.value, version: incrementPatch(detail?.version) })} className="min-h-[480px] rounded-2xl font-mono text-sm" /></CardContent></Card>
                <Card className="rounded-3xl bg-white"><CardHeader><CardTitle>Live preview</CardTitle></CardHeader><CardContent><pre className="whitespace-pre-wrap rounded-2xl bg-[#fbfaf7] p-4 text-sm leading-6 text-[#45453e]">{detail?.content ?? ""}</pre></CardContent></Card>
              </div>
            </TabsContent>
            <TabsContent value="loads" className="min-h-0 flex-1 overflow-auto">
              <Card className="rounded-3xl bg-white"><CardContent className="space-y-4 p-6">
                {detail?.scope === "global" ? <p>This skill loads automatically on every task in every project.</p> : null}
                {detail?.scope === "task-type" ? <div><p>This skill loads when you create a task of these kinds.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{Object.entries(taskTypeLabels).map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-xl border p-3"><Checkbox checked={(detail.taskTypes ?? []).includes(key as SkillTaskType)} onCheckedChange={(checked) => { const current = new Set(detail.taskTypes ?? []); checked ? current.add(key as SkillTaskType) : current.delete(key as SkillTaskType); setDetailDraft({ ...detail, taskTypes: Array.from(current) }); }} />{label}</label>)}</div></div> : null}
                {detail?.scope === "file-pattern" ? <div><p>This skill loads automatically when the AI works with files matching these patterns.</p><div className="mt-3 space-y-2">{(detail.filePatterns ?? []).map((pattern, index) => <Input key={`${pattern}-${index}`} value={pattern} onChange={(event) => { const next = [...(detail.filePatterns ?? [])]; next[index] = event.target.value; setDetailDraft({ ...detail, filePatterns: next }); }} className="rounded-xl" />)}<Button type="button" variant="outline" onClick={() => setDetailDraft({ ...detail, filePatterns: [...(detail.filePatterns ?? []), "src/**"] })} className="rounded-xl bg-white">Add pattern</Button></div></div> : null}
                {detail?.scope === "manual-only" ? <p>This skill only loads when you attach it to a task from the task test control or another task Skills panel.</p> : null}
              </CardContent></Card>
            </TabsContent>
          </Tabs>
          <div className="flex flex-wrap justify-end gap-2 border-t border-[#deded8] pt-4">
            <Button variant="outline" className="rounded-xl bg-white" onClick={() => duplicateMutation.mutate({ skillId: selectedSkill.id } as any)}>Duplicate</Button>
            <Button variant="outline" className="rounded-xl bg-white" onClick={() => downloadSkill(selectedSkill)}>Export as .md</Button>
            <Button variant="outline" className="rounded-xl bg-white text-red-700" onClick={() => { if (confirm(`Delete '${selectedSkill.name}'?`)) { deleteSkillMutation.mutate({ skillId: selectedSkill.id } as any); setSelectedSkill(null); } }}>Delete</Button>
            <Button variant="outline" className="rounded-xl bg-white" onClick={() => setDetailDraft(null)} disabled={!detailDraft}>Cancel</Button>
            <Button className="rounded-xl bg-[#1f1f1f] text-white hover:bg-black" onClick={saveDetailDraft} disabled={!detailDraft || updateSkillMutation.isPending}>{updateSkillMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save</Button>
          </div>
        </div>
      ) : (
        <div className="mx-auto flex h-full max-w-7xl flex-col gap-5 overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-4xl font-semibold tracking-[-0.05em] text-[#242420]">Skills</h1>
              <p className="mt-2 flex items-center gap-2 text-sm text-[#66665f]">Prepackaged and repeatable best practices & tools for your AI <Tooltip><TooltipTrigger asChild><HelpCircle className="h-4 w-4 cursor-help" /></TooltipTrigger><TooltipContent className="max-w-xs">Skills are short instructions you give your AI assistant. Some apply to every task; others only when the AI is doing certain kinds of work or working with certain files.</TooltipContent></Tooltip></p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Popover><PopoverTrigger asChild><Button variant="outline" className="rounded-xl bg-white"><SlidersHorizontal className="mr-2 h-4 w-4" />Filter</Button></PopoverTrigger><PopoverContent align="end" className="w-80 space-y-4 rounded-2xl bg-white">
                <div><Label>Scope</Label><select value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value as any)} className="mt-2 h-9 w-full rounded-xl border px-3 text-sm"><option value="all">All scopes</option>{Object.entries(scopeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
                <div><Label>Enabled state</Label><select value={enabledFilter} onChange={(event) => setEnabledFilter(event.target.value as any)} className="mt-2 h-9 w-full rounded-xl border px-3 text-sm"><option value="all">All</option><option value="enabled">Enabled</option><option value="disabled">Disabled</option></select></div>
                <div><Label>Source type</Label><select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as any)} className="mt-2 h-9 w-full rounded-xl border px-3 text-sm"><option value="all">All sources</option>{Object.entries(sourceLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
              </PopoverContent></Popover>
              <div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#8a8980]" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search skills" className="h-10 w-64 rounded-xl bg-white pl-9" /></div>
              <div className="flex rounded-full border border-[#dddcd5] bg-white p-1" aria-label="Skill library view filter">
                {(["all", "custom", "official"] as const).map((view) => (
                  <Button key={view} type="button" variant={libraryView === view ? "default" : "ghost"} size="sm" onClick={() => setLibraryView(view)} className="h-8 rounded-full px-3 text-xs capitalize">
                    {view === "all" ? `All ${skills.length}` : view === "custom" ? `Custom ${customSkillCount}` : `Official ${officialSkillCount}`}
                  </Button>
                ))}
              </div>
              <DropdownMenu><DropdownMenuTrigger asChild><Button className="rounded-xl bg-[#1f1f1f] text-white hover:bg-black"><Plus className="mr-2 h-4 w-4" />Add</Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-80 rounded-2xl bg-white p-2">
                <DropdownMenuLabel>Add a skill</DropdownMenuLabel>
                <DropdownMenuItem className="items-start gap-3 rounded-xl p-3" onSelect={() => setShowAiDialog(true)}><Bot className="mt-0.5 h-5 w-5" /><span><span className="block font-medium">Build with AI</span><span className="block text-xs text-muted-foreground">Build a skill through conversation</span></span></DropdownMenuItem>
                <DropdownMenuItem className="items-start gap-3 rounded-xl p-3" onSelect={() => fileInputRef.current?.click()}><FileUp className="mt-0.5 h-5 w-5" /><span><span className="block font-medium">Upload a skill</span><span className="block text-xs text-muted-foreground">Upload .md, .skill, or .zip</span></span></DropdownMenuItem>
                <DropdownMenuItem className="items-start gap-3 rounded-xl p-3" onSelect={() => setShowOfficialCatalog(true)}><Check className="mt-0.5 h-5 w-5" /><span><span className="block font-medium">Add from official</span><span className="block text-xs text-muted-foreground">Pre-built skills from the catalog</span></span></DropdownMenuItem>
                <DropdownMenuItem className="items-start gap-3 rounded-xl p-3" onSelect={() => setShowGithubDialog(true)}><Github className="mt-0.5 h-5 w-5" /><span><span className="block font-medium">Import from GitHub</span><span className="block text-xs text-muted-foreground">Paste a repository link</span></span></DropdownMenuItem>
              </DropdownMenuContent></DropdownMenu>
            </div>
          </div>
          {isDragging ? <div className="rounded-3xl border-2 border-dashed border-sky-300 bg-sky-50 p-6 text-center text-sm text-sky-800"><UploadCloud className="mx-auto mb-2 h-6 w-6" />Drop .md, .skill, or .zip files to create skills.</div> : null}
          <ScrollArea className="min-h-0 flex-1 pr-3">
            {skillsQuery.isLoading ? <div className="rounded-3xl bg-white p-8 text-center text-[#66665f]">Loading skills...</div> : filteredSkills.length === 0 ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-[#cfcfc8] bg-white/70 p-10 text-center">
                <Sparkles className="mb-4 h-12 w-12 text-[#b7b5aa]" />
                <h2 className="text-xl font-semibold text-[#30302b]">{skills.length > 0 && hasActiveListFilters ? "No skills match these filters." : "No skills yet."}</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-[#66665f]">{skills.length > 0 && hasActiveListFilters ? "Your skill library has saved skills, but the current view or filters are hiding them. Switch to All or clear the filters to see uploaded custom skills." : "Tap + Add to create your first one. Skills tell your AI assistant how to behave on every task."}</p>
                {skills.length > 0 && hasActiveListFilters ? <Button type="button" variant="outline" className="mt-4 rounded-xl bg-white" onClick={revealFullLibrary}>Show all skills</Button> : null}
              </div>
            ) : <div className="grid gap-4 xl:grid-cols-2">{filteredSkills.map(renderCard)}</div>}
          </ScrollArea>
        </div>
      )}

      <Dialog open={showAiDialog} onOpenChange={setShowAiDialog}>
        <DialogContent className="max-w-4xl rounded-3xl bg-white"><DialogHeader><DialogTitle>Build with AI</DialogTitle><DialogDescription>Build a skill through conversation. Claude asks a few short questions, drafts the content, then you can save it.</DialogDescription></DialogHeader>
          <AIChatBox messages={aiMessages} onSendMessage={handleAiMessage} isLoading={aiDraftMutation.isPending} height={460} emptyStateMessage="Start with what behavior you want." suggestedPrompts={["Help my AI write safer database migrations", "Create a skill for honest status reporting"]} />
          {aiDraft ? <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-900"><p className="font-semibold">Draft ready: {aiDraft.name}</p><p>{aiDraft.description}</p></div> : null}
          <DialogFooter><Button variant="outline" className="rounded-xl bg-white" onClick={() => setShowAiDialog(false)}>Cancel</Button><Button className="rounded-xl bg-[#1f1f1f] text-white hover:bg-black" onClick={saveAiDraft} disabled={!aiDraft || createSkillMutation.isPending}>Save this skill?</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(pendingDuplicate)} onOpenChange={(open) => { if (!open) setPendingDuplicate(null); }}>
        <DialogContent className="rounded-3xl bg-white"><DialogHeader><DialogTitle>Replace existing skill?</DialogTitle><DialogDescription>{pendingDuplicate ? `A skill with slug '${pendingDuplicate.skill.slug}' already exists. Replace it or create a new copy?` : ""}</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" className="rounded-xl bg-white" onClick={async () => { if (!pendingDuplicate) return; await createParsedSkill({ ...pendingDuplicate, skill: { ...pendingDuplicate.skill, slug: `${pendingDuplicate.skill.slug}-${Date.now()}` } }); setPendingDuplicate(null); }}>Create as new copy</Button><Button className="rounded-xl bg-[#1f1f1f] text-white hover:bg-black" onClick={async () => { if (!pendingDuplicate) return; const replaced = await replaceBySlugMutation.mutateAsync(pendingDuplicate.skill as any) as SkillRecord; revealFullLibrary(); setSelectedSkill(replaced); setPendingDuplicate(null); toast.success("Skill replaced and shown in your library."); }}>Replace existing</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showGithubDialog} onOpenChange={setShowGithubDialog}>
        <DialogContent className="max-w-3xl rounded-3xl bg-white"><DialogHeader><DialogTitle>Import from GitHub</DialogTitle><DialogDescription>Paste a repository link. Public repos work without auth; private repos can use an ephemeral GitHub token for this import only.</DialogDescription></DialogHeader>
          <div className="grid gap-3 md:grid-cols-2"><div className="md:col-span-2"><Label>Repo URL</Label><Input value={githubRepoUrl} onChange={(event) => setGithubRepoUrl(event.target.value)} placeholder="https://github.com/org/repo" className="mt-2 rounded-xl" /></div><div><Label>Optional path</Label><Input value={githubPath} onChange={(event) => setGithubPath(event.target.value)} placeholder="skills/" className="mt-2 rounded-xl" /></div><div><Label>Optional branch</Label><Input value={githubBranch} onChange={(event) => setGithubBranch(event.target.value)} placeholder="main" className="mt-2 rounded-xl" /></div><div className="md:col-span-2"><Label>GitHub token for private repos</Label><Input value={githubToken} type="password" onChange={(event) => setGithubToken(event.target.value)} placeholder="Used once; not stored" className="mt-2 rounded-xl" /></div></div>
          {githubPreview.length > 0 ? <div className="rounded-2xl border p-3"><p className="mb-2 text-sm font-semibold">Found {githubPreview.length} skills in this repo. Which would you like to import?</p><ScrollArea className="max-h-56"><div className="space-y-2 pr-3">{githubPreview.map((item) => <label key={item.id} className="flex items-start gap-3 rounded-xl border p-3"><Checkbox checked={selectedGithubIds.has(item.id)} onCheckedChange={(checked) => setSelectedGithubIds((current) => { const next = new Set(current); checked ? next.add(item.id) : next.delete(item.id); return next; })} /><span><span className="block font-medium">{item.skill.name}</span><span className="block text-xs text-[#66665f]">{item.filePath}</span></span></label>)}</div></ScrollArea></div> : null}
          <DialogFooter><Button variant="outline" className="rounded-xl bg-white" onClick={() => setShowGithubDialog(false)}>Cancel</Button><Button variant="outline" className="rounded-xl bg-white" onClick={handleGithubPreview} disabled={!githubRepoUrl.trim() || githubPreviewMutation.isPending}>{githubPreviewMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Preview</Button><Button className="rounded-xl bg-[#1f1f1f] text-white hover:bg-black" onClick={handleGithubImport} disabled={selectedGithubIds.size === 0 || githubImportMutation.isPending}>Import selected</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
