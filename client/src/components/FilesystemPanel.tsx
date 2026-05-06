import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { FileCode2, FolderOpen, Loader2, RefreshCw, Save } from "lucide-react";
import React, { useMemo, useState } from "react";

export type FilesystemPanelProps = {
  workspaceId?: number;
};

type WorkspaceEntry = {
  name: string;
  relativePath: string;
  type: "file" | "directory";
  size?: number;
  modifiedAt?: number | string | Date;
  children?: WorkspaceEntry[];
};

function flattenEntries(entries: WorkspaceEntry[] = [], depth = 0): Array<WorkspaceEntry & { depth: number }> {
  return entries.flatMap(entry => [
    { ...entry, depth },
    ...flattenEntries(entry.children ?? [], depth + 1),
  ]);
}

export function FilesystemPanel({ workspaceId }: FilesystemPanelProps) {
  const utils = trpc.useUtils();
  const [directory, setDirectory] = useState("");
  const [selectedPath, setSelectedPath] = useState("README.md");
  const [draftContent, setDraftContent] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const treeQuery = trpc.filesystem.tree.useQuery({ relativePath: directory, depth: 3 });
  const readQuery = trpc.filesystem.read.useQuery({ relativePath: selectedPath }, { enabled: Boolean(selectedPath.trim()) });
  const writeMutation = trpc.filesystem.write.useMutation({
    onSuccess: async () => {
      setStatus("Saved to the authenticated workspace filesystem.");
      await Promise.all([
        utils.filesystem.tree.invalidate(),
        utils.filesystem.read.invalidate({ relativePath: selectedPath }),
        workspaceId ? utils.files.listForTask.invalidate({ taskId: workspaceId, limit: 200 }) : Promise.resolve(),
        utils.files.listAll.invalidate(),
      ]);
    },
    onError: error => setStatus(error.message),
  });
  const mkdirMutation = trpc.filesystem.mkdir.useMutation({
    onSuccess: async () => {
      setStatus("Directory created in the authenticated workspace filesystem.");
      await utils.filesystem.tree.invalidate();
    },
    onError: error => setStatus(error.message),
  });

  const entries = useMemo(() => flattenEntries(treeQuery.data ? [(treeQuery.data as WorkspaceEntry)] : []), [treeQuery.data]);
  const loadedContent = typeof readQuery.data?.content === "string" ? readQuery.data.content : "";
  const editorValue = draftContent || loadedContent;

  return (
    <Card className="border-[#deded8] bg-white text-[#242420]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2"><FolderOpen className="h-4 w-4 text-sky-600" /> Workspace filesystem</span>
          <Button type="button" variant="outline" size="sm" onClick={() => treeQuery.refetch()} className="h-8 rounded-xl border-[#d9d8d1] bg-white text-xs">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <Input value={directory} onChange={event => setDirectory(event.target.value)} placeholder="workspace directory, blank for root" className="h-9 rounded-xl bg-[#fbfaf7] text-xs" />
          <Button type="button" variant="outline" onClick={() => mkdirMutation.mutate({ relativePath: directory || "workspace" })} disabled={mkdirMutation.isPending} className="h-9 rounded-xl border-[#d9d8d1] bg-white text-xs">
            {mkdirMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FolderOpen className="mr-1.5 h-3.5 w-3.5" />} Mkdir
          </Button>
        </div>

        <ScrollArea className="h-36 rounded-2xl border border-[#deded8] bg-[#fbfaf7] p-2">
          {treeQuery.isLoading ? (
            <div className="p-3 text-xs text-[#77766e]">Loading authenticated workspace files...</div>
          ) : entries.length === 0 ? (
            <div className="p-3 text-xs leading-5 text-[#77766e]">No workspace files yet. Save a file below to create the first real file; nothing is fake-seeded.</div>
          ) : (
            <div className="space-y-1">
              {entries.map(entry => (
                <button
                  key={entry.relativePath}
                  type="button"
                  onClick={() => {
                    if (entry.type === "file") {
                      setSelectedPath(entry.relativePath);
                      setDraftContent("");
                    } else {
                      setDirectory(entry.relativePath);
                    }
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-xs hover:bg-white"
                  style={{ paddingLeft: `${8 + entry.depth * 14}px` }}
                >
                  {entry.type === "directory" ? <FolderOpen className="h-3.5 w-3.5 text-amber-600" /> : <FileCode2 className="h-3.5 w-3.5 text-sky-600" />}
                  <span className="truncate text-[#30302b]">{entry.name}</span>
                  {entry.type === "file" ? <span className="ml-auto text-[10px] text-[#77766e]">{entry.size ?? 0} bytes</span> : null}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <Input value={selectedPath} onChange={event => { setSelectedPath(event.target.value); setDraftContent(""); }} placeholder="relative/file.md" className="h-9 rounded-xl bg-[#fbfaf7] text-xs" />
        <Textarea value={editorValue} onChange={event => setDraftContent(event.target.value)} placeholder="Edit workspace file content. Saving can snapshot this file to the selected task when a task is active." className="min-h-32 rounded-2xl bg-[#fbfaf7] text-xs leading-5" />
        <Button
          type="button"
          onClick={() => writeMutation.mutate({ taskId: workspaceId ?? null, relativePath: selectedPath, content: editorValue })}
          disabled={!selectedPath.trim() || writeMutation.isPending}
          className="w-full rounded-xl bg-[#1f1f1f] text-xs text-white hover:bg-black"
        >
          {writeMutation.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />} Save workspace file
        </Button>
        {status ? <p className="rounded-xl border border-[#deded8] bg-[#fbfaf7] p-2 text-[11px] leading-4 text-[#66665e]">{status}</p> : null}
      </CardContent>
    </Card>
  );
}

export default FilesystemPanel;
