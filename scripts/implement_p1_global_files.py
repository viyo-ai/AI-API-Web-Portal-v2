from pathlib import Path

ROOT = Path('/home/ubuntu/ai-coding-workshop-permanent')

schema = ROOT / 'drizzle/schema.ts'
text = schema.read_text()
text = text.replace(
    '  InsertGlobalMemory,\n  InsertOrchestrationTurn,',
    '  InsertGlobalMemory,\n  InsertGlobalFile,\n  InsertTaskGlobalFileLink,\n  InsertOrchestrationTurn,'
) if False else text
text = text.replace(
    'export const taskFiles = mysqlTable(\n',
    'export const globalFiles = mysqlTable(\n  "global_files",\n  {\n    id: int("id").autoincrement().primaryKey(),\n    ownerUserId: int("ownerUserId").notNull(),\n    displayName: varchar("displayName", { length: 220 }).notNull(),\n    relativePath: varchar("relativePath", { length: 1024 }).notNull(),\n    storageKey: text("storageKey").notNull(),\n    storageUrl: text("storageUrl").notNull(),\n    mimeType: varchar("mimeType", { length: 160 }),\n    sizeBytes: bigint("sizeBytes", { mode: "number" }).default(0).notNull(),\n    source: mysqlEnum("source", ["upload", "manual", "task_snapshot"]).default("upload").notNull(),\n    tagsJson: longtext("tagsJson"),\n    createdAt: bigint("createdAt", { mode: "number" }).notNull(),\n    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),\n  },\n  (table) => ({\n    ownerPathIdx: index("global_files_owner_path_idx").on(table.ownerUserId, table.relativePath),\n    ownerUpdatedIdx: index("global_files_owner_updated_idx").on(table.ownerUserId, table.updatedAt),\n  }),\n);\n\nexport const taskGlobalFileLinks = mysqlTable(\n  "task_global_file_links",\n  {\n    id: int("id").autoincrement().primaryKey(),\n    taskId: int("taskId").notNull(),\n    globalFileId: int("globalFileId").notNull(),\n    ownerUserId: int("ownerUserId").notNull(),\n    attachedLabel: varchar("attachedLabel", { length: 220 }),\n    createdAt: bigint("createdAt", { mode: "number" }).notNull(),\n    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),\n  },\n  (table) => ({\n    taskFileUnique: uniqueIndex("task_global_file_links_task_file_unique").on(table.taskId, table.globalFileId),\n    ownerTaskIdx: index("task_global_file_links_owner_task_idx").on(table.ownerUserId, table.taskId),\n    ownerFileIdx: index("task_global_file_links_owner_file_idx").on(table.ownerUserId, table.globalFileId),\n  }),\n);\n\nexport const taskFiles = mysqlTable(\n'
)
text = text.replace(
    'export type TaskFile = typeof taskFiles.$inferSelect;\nexport type InsertTaskFile = typeof taskFiles.$inferInsert;\nexport type CredentialStatusSnapshot = typeof credentialStatusSnapshots.$inferSelect;',
    'export type GlobalFile = typeof globalFiles.$inferSelect;\nexport type InsertGlobalFile = typeof globalFiles.$inferInsert;\nexport type TaskGlobalFileLink = typeof taskGlobalFileLinks.$inferSelect;\nexport type InsertTaskGlobalFileLink = typeof taskGlobalFileLinks.$inferInsert;\nexport type TaskFile = typeof taskFiles.$inferSelect;\nexport type InsertTaskFile = typeof taskFiles.$inferInsert;\nexport type CredentialStatusSnapshot = typeof credentialStatusSnapshots.$inferSelect;'
)
schema.write_text(text)

db = ROOT / 'server/db.ts'
text = db.read_text()
text = text.replace('import { and, desc, eq, like, or } from "drizzle-orm";', 'import { and, desc, eq, like, or } from "drizzle-orm";')
text = text.replace(
    '  InsertGlobalMemory,\n  InsertOrchestrationTurn,',
    '  InsertGlobalMemory,\n  InsertGlobalFile,\n  InsertTaskGlobalFileLink,\n  InsertOrchestrationTurn,'
)
text = text.replace(
    '  globalMemory,\n',
    '  globalMemory,\n  globalFiles,\n'
)
text = text.replace(
    '  taskEvents,\n  taskFiles,',
    '  taskEvents,\n  taskFiles,\n  taskGlobalFileLinks,'
)
text = text.replace('export const GLOBAL_FILE_TASK_ID = 0;\n', '')
text = text.replace(
    '''export async function createGlobalFile(values: Omit<InsertTaskFile, "taskId" | "relativePath" | "createdAt" | "updatedAt"> & { relativePath: string; createdAt?: number; updatedAt?: number }) {
  return createTaskFile({
    ...values,
    taskId: GLOBAL_FILE_TASK_ID,
    relativePath: assertSafeRelativePath(values.relativePath),
  });
}
''',
    '''export async function createGlobalFile(values: Omit<InsertGlobalFile, "relativePath" | "displayName" | "createdAt" | "updatedAt"> & { relativePath: string; displayName?: string; createdAt?: number; updatedAt?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for global files");

  const timestamp = values.createdAt ?? nowMs();
  const relativePath = assertSafeRelativePath(values.relativePath);
  const displayName = (values.displayName?.trim() || relativePath.split("/").filter(Boolean).pop() || relativePath).slice(0, 220);
  await db.insert(globalFiles).values({ ...values, displayName, relativePath, createdAt: timestamp, updatedAt: values.updatedAt ?? timestamp });

  const result = await db
    .select()
    .from(globalFiles)
    .where(and(eq(globalFiles.ownerUserId, values.ownerUserId), eq(globalFiles.relativePath, relativePath), eq(globalFiles.createdAt, timestamp)))
    .orderBy(desc(globalFiles.id))
    .limit(1);

  if (!result[0]) throw new Error("Failed to create global file metadata");
  return result[0];
}
'''
)
text = text.replace('''export async function listGlobalFilesForOwner(ownerUserId: number, limit = 200) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for task files");

  return db
    .select()
    .from(taskFiles)
    .where(and(eq(taskFiles.ownerUserId, ownerUserId), eq(taskFiles.taskId, GLOBAL_FILE_TASK_ID)))
    .orderBy(desc(taskFiles.updatedAt))
    .limit(limit);
}
''', '''export async function listGlobalFilesForOwner(ownerUserId: number, limit = 200) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for global files");

  return db.select().from(globalFiles).where(eq(globalFiles.ownerUserId, ownerUserId)).orderBy(desc(globalFiles.updatedAt)).limit(limit);
}

export async function getGlobalFileForOwner(globalFileId: number, ownerUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for global files");

  const result = await db.select().from(globalFiles).where(and(eq(globalFiles.id, globalFileId), eq(globalFiles.ownerUserId, ownerUserId))).limit(1);
  return result[0];
}

export async function attachGlobalFileToTask(values: Omit<InsertTaskGlobalFileLink, "attachedLabel" | "createdAt" | "updatedAt"> & { attachedLabel?: string | null; createdAt?: number; updatedAt?: number }) {
  const task = await getTaskForOwner(values.taskId, values.ownerUserId);
  if (!task) throw new Error("Task not found");
  const file = await getGlobalFileForOwner(values.globalFileId, values.ownerUserId);
  if (!file) throw new Error("Global file not found");

  const db = await getDb();
  if (!db) throw new Error("Database is required for global file links");
  const timestamp = values.createdAt ?? nowMs();
  await db
    .insert(taskGlobalFileLinks)
    .values({ ...values, attachedLabel: values.attachedLabel?.trim().slice(0, 220) || file.displayName, createdAt: timestamp, updatedAt: values.updatedAt ?? timestamp })
    .onDuplicateKeyUpdate({ set: { attachedLabel: values.attachedLabel?.trim().slice(0, 220) || file.displayName, updatedAt: timestamp } });

  await touchTask(values.taskId, values.ownerUserId);
  const result = await db
    .select()
    .from(taskGlobalFileLinks)
    .where(and(eq(taskGlobalFileLinks.taskId, values.taskId), eq(taskGlobalFileLinks.globalFileId, values.globalFileId), eq(taskGlobalFileLinks.ownerUserId, values.ownerUserId)))
    .orderBy(desc(taskGlobalFileLinks.id))
    .limit(1);
  if (!result[0]) throw new Error("Failed to attach global file to task");
  return { ...result[0], file };
}

export async function listGlobalFileLinksForTask(taskId: number, ownerUserId: number, limit = 200) {
  const task = await getTaskForOwner(taskId, ownerUserId);
  if (!task) return [];
  const db = await getDb();
  if (!db) throw new Error("Database is required for global file links");

  const rows = await db
    .select({ link: taskGlobalFileLinks, file: globalFiles })
    .from(taskGlobalFileLinks)
    .innerJoin(globalFiles, and(eq(taskGlobalFileLinks.globalFileId, globalFiles.id), eq(globalFiles.ownerUserId, ownerUserId)))
    .where(and(eq(taskGlobalFileLinks.taskId, taskId), eq(taskGlobalFileLinks.ownerUserId, ownerUserId)))
    .orderBy(desc(taskGlobalFileLinks.updatedAt))
    .limit(limit);
  return rows.map((row) => ({ ...row.link, file: row.file }));
}
''')
text = text.replace('''export async function listAllFilesForOwner(ownerUserId: number, limit = 400) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for task files");

  return db.select().from(taskFiles).where(eq(taskFiles.ownerUserId, ownerUserId)).orderBy(desc(taskFiles.updatedAt)).limit(limit);
}
''', '''export async function listAllFilesForOwner(ownerUserId: number, limit = 400) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for files");

  const taskRows = await db.select().from(taskFiles).where(eq(taskFiles.ownerUserId, ownerUserId)).orderBy(desc(taskFiles.updatedAt)).limit(limit);
  const globalRows = await db.select().from(globalFiles).where(eq(globalFiles.ownerUserId, ownerUserId)).orderBy(desc(globalFiles.updatedAt)).limit(limit);
  return [
    ...taskRows.map((file) => ({ ...file, scope: "task" as const })),
    ...globalRows.map((file) => ({ ...file, taskId: null, version: 1, scope: "global" as const })),
  ]
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    .slice(0, limit);
}
''')
text = text.replace('''  if (values.taskId !== GLOBAL_FILE_TASK_ID) {
    await touchTask(values.taskId, values.ownerUserId);
  }
''', '''  await touchTask(values.taskId, values.ownerUserId);
''')
db.write_text(text)

routers = ROOT / 'server/routers.ts'
text = routers.read_text()
text = text.replace('  createGlobalFile,\n', '  attachGlobalFileToTask,\n  createGlobalFile,\n')
text = text.replace('  getTaskFileForOwner,\n', '  getGlobalFileForOwner,\n  getTaskFileForOwner,\n')
text = text.replace('  listGlobalFilesForOwner,\n', '  listGlobalFileLinksForTask,\n  listGlobalFilesForOwner,\n')
text = text.replace('} from "./filesystem";\nimport { getUserWorkspaceRoot }', '} from "./filesystem";\nimport { storagePut } from "./storage";\nimport { getUserWorkspaceRoot }')
text = text.replace('''            scope: z.enum(["task", "global"]).default("task"),
''', '''            scope: z.enum(["task", "global"]).default("task"),
            displayName: z.string().trim().max(220).optional(),
''')
text = text.replace('''        const isGlobal = input.scope === "global";
        if (!isGlobal && !input.taskId) throw new Error("Task id is required for task-scoped files");
        if (input.taskId) await requireOwnedTask(input.taskId, ctx.user.id);
        const file = isGlobal
          ? await createGlobalFile({
              ownerUserId: ctx.user.id,
              relativePath: input.relativePath,
              storageKey: input.storageKey,
              storageUrl: input.storageUrl,
              mimeType: input.mimeType ?? null,
              sizeBytes: input.sizeBytes ?? 0,
              version: input.version,
            })
          : await createTaskFile({
''', '''        const isGlobal = input.scope === "global";
        if (!isGlobal && !input.taskId) throw new Error("Task id is required for task-scoped files");
        if (input.taskId) await requireOwnedTask(input.taskId, ctx.user.id);
        const file = isGlobal
          ? await createGlobalFile({
              ownerUserId: ctx.user.id,
              displayName: input.displayName,
              relativePath: input.relativePath,
              storageKey: input.storageKey,
              storageUrl: input.storageUrl,
              mimeType: input.mimeType ?? null,
              sizeBytes: input.sizeBytes ?? 0,
              source: "manual",
              tagsJson: null,
            })
          : await createTaskFile({
''')
text = text.replace('''    listGlobal: protectedProcedure.input(z.object({ limit: z.number().int().positive().max(500).default(200) }).optional()).query(async ({ ctx, input }) => {
      return listGlobalFilesForOwner(ctx.user.id, input?.limit ?? 200);
    }),
    listAll: protectedProcedure.input(z.object({ limit: z.number().int().positive().max(500).default(400) }).optional()).query(async ({ ctx, input }) => {
      return listAllFilesForOwner(ctx.user.id, input?.limit ?? 400);
    }),
''', '''    listGlobal: protectedProcedure.input(z.object({ limit: z.number().int().positive().max(500).default(200) }).optional()).query(async ({ ctx, input }) => {
      return listGlobalFilesForOwner(ctx.user.id, input?.limit ?? 200);
    }),
    listGlobalForTask: protectedProcedure
      .input(z.object({ taskId: z.number().int().positive(), limit: z.number().int().positive().max(500).default(200) }))
      .query(async ({ ctx, input }) => {
        return listGlobalFileLinksForTask(input.taskId, ctx.user.id, input.limit);
      }),
    attachGlobalToTask: protectedProcedure
      .input(z.object({ taskId: z.number().int().positive(), globalFileId: z.number().int().positive(), attachedLabel: z.string().trim().max(220).optional() }))
      .mutation(async ({ ctx, input }) => {
        const attached = await attachGlobalFileToTask({ taskId: input.taskId, globalFileId: input.globalFileId, ownerUserId: ctx.user.id, attachedLabel: input.attachedLabel ?? null });
        await appendTaskEvent({
          taskId: input.taskId,
          ownerUserId: ctx.user.id,
          actor: "system",
          eventType: "file_event",
          status: "succeeded",
          content: `Global file attached to this task: ${attached.file.displayName}`,
          metadataJson: serializeJson({ globalFileId: attached.file.id, linkId: attached.id, storageKey: attached.file.storageKey }),
        });
        return attached;
      }),
    listAll: protectedProcedure.input(z.object({ limit: z.number().int().positive().max(500).default(400) }).optional()).query(async ({ ctx, input }) => {
      return listAllFilesForOwner(ctx.user.id, input?.limit ?? 400);
    }),
''')
text = text.replace('''        const isGlobalUpload = input.scope === "global";
        if (!isGlobalUpload && !input.taskId) throw new Error("Select a task before uploading to a task folder");
        if (input.taskId) await requireOwnedTask(input.taskId, ctx.user.id);
        const rootPath = await getUserWorkspaceRoot(ctx.user.id);
        const uploaded = await uploadWorkspaceFile({
          rootPath,
          workspaceId: isGlobalUpload ? 0 : input.taskId ?? 0,
          ownerUserId: ctx.user.id,
          relativePath: input.relativePath,
          base64Content: input.base64Content,
          mimeType: input.mimeType,
        });
        if (isGlobalUpload) {
          const file = await createGlobalFile({
            ownerUserId: ctx.user.id,
            relativePath: uploaded.relativePath,
            storageKey: uploaded.storageKey,
            storageUrl: uploaded.storageUrl,
            mimeType: input.mimeType ?? null,
            sizeBytes: uploaded.size,
            version: 1,
          });
          return { ...uploaded, file };
        }
''', '''        const isGlobalUpload = input.scope === "global";
        if (!isGlobalUpload && !input.taskId) throw new Error("Select a task before uploading to a task folder");
        if (input.taskId) await requireOwnedTask(input.taskId, ctx.user.id);
        if (isGlobalUpload) {
          const relativePath = assertSafeRelativePath(input.relativePath);
          const buffer = Buffer.from(input.base64Content, "base64");
          if (buffer.byteLength > 5 * 1024 * 1024) throw new Error("File is too large for the workshop uploader");
          const storage = await storagePut(`global-files/user-${ctx.user.id}/${relativePath}`, buffer, input.mimeType ?? "application/octet-stream");
          const file = await createGlobalFile({
            ownerUserId: ctx.user.id,
            displayName: input.displayName,
            relativePath,
            storageKey: storage.key,
            storageUrl: storage.url,
            mimeType: input.mimeType ?? null,
            sizeBytes: buffer.byteLength,
            source: "upload",
            tagsJson: null,
          });
          return { relativePath, storageKey: storage.key, storageUrl: storage.url, size: buffer.byteLength, file };
        }
        const rootPath = await getUserWorkspaceRoot(ctx.user.id);
        const uploaded = await uploadWorkspaceFile({
          rootPath,
          workspaceId: input.taskId ?? 0,
          ownerUserId: ctx.user.id,
          relativePath: input.relativePath,
          base64Content: input.base64Content,
          mimeType: input.mimeType,
        });
''')
routers.write_text(text)

home = ROOT / 'client/src/pages/Home.tsx'
text = home.read_text()
text = text.replace('''type TaskFileRecord = {
  id: number;
  taskId?: number;
  storageUrl: string;
  relativePath: string;
  version: number;
  mimeType: string | null;
  createdAt?: number;
  sizeBytes?: number | null;
};
''', '''type TaskFileRecord = {
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
''')
text = text.replace('''  const taskFilesQuery = trpc.files.listForTask.useQuery(filesInput, { enabled: isAuthenticated && Boolean(selectedTaskId) });
  const allFilesInput = useMemo(() => ({ limit: 400 }), []);
''', '''  const taskFilesQuery = trpc.files.listForTask.useQuery(filesInput, { enabled: isAuthenticated && Boolean(selectedTaskId) });
  const attachedGlobalFilesQuery = trpc.files.listGlobalForTask.useQuery(filesInput, { enabled: isAuthenticated && Boolean(selectedTaskId) });
  const allFilesInput = useMemo(() => ({ limit: 400 }), []);
''')
text = text.replace('''  const uploadWorkspaceFileMutation = trpc.filesystem.upload.useMutation();
  const credentialsRefreshMutation = trpc.credentials.refresh.useMutation();
''', '''  const uploadWorkspaceFileMutation = trpc.filesystem.upload.useMutation();
  const attachGlobalToTaskMutation = trpc.files.attachGlobalToTask.useMutation();
  const credentialsRefreshMutation = trpc.credentials.refresh.useMutation();
''')
text = text.replace('''  const taskFiles = (taskFilesQuery.data ?? []) as TaskFileRecord[];
  const allFiles = (allFilesQuery.data ?? []) as TaskFileRecord[];
  const globalFiles = (globalFilesQuery.data ?? []) as TaskFileRecord[];
''', '''  const taskFiles = (taskFilesQuery.data ?? []) as TaskFileRecord[];
  const attachedGlobalFiles = (attachedGlobalFilesQuery.data ?? []) as AttachedGlobalFileRecord[];
  const allFiles = (allFilesQuery.data ?? []) as TaskFileRecord[];
  const globalFiles = (globalFilesQuery.data ?? []) as TaskFileRecord[];
''')
text = text.replace('''      utils.files.listForTask.invalidate(),
      utils.files.listAll.invalidate(),
      utils.files.listGlobal.invalidate(),
''', '''      utils.files.listForTask.invalidate(),
      utils.files.listGlobalForTask.invalidate(),
      utils.files.listAll.invalidate(),
      utils.files.listGlobal.invalidate(),
''')
text = text.replace('''      const destination = scope === "global" ? "global file library" : "this task folder";
''', '''      const destination = scope === "global" ? "Global Files" : "this task folder";
''')
text = text.replace('''        mimeType: file.type || undefined,
      });
''', '''        mimeType: file.type || undefined,
        displayName: file.name,
      });
''', 1)
text = text.replace('''  const isMutating = createTask.isPending || updateTaskStatus.isPending || submitMessage.isPending || createFileMetadata.isPending || uploadWorkspaceFileMutation.isPending;
''', '''  const isMutating = createTask.isPending || updateTaskStatus.isPending || submitMessage.isPending || createFileMetadata.isPending || uploadWorkspaceFileMutation.isPending || attachGlobalToTaskMutation.isPending;
''')
insert_after = '''  function handleGlobalFileDrop(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsGlobalFileDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void uploadSelectedGlobalFile(file);
  }
'''
attachment_fn = '''
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
'''
text = text.replace(insert_after, insert_after + attachment_fn)
text = text.replace('''                <CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4 text-emerald-600" /> What the AI is doing</CardTitle>
''', '''                <CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4 text-emerald-600" /> AI Activity</CardTitle>
''')
text = text.replace('''                      <p className="mt-1">Uploads are stored in the selected task folder and then appear in this file list.</p>
''', '''                      <p className="mt-1">Uploads are stored in the selected task folder. Attached Global Files appear below as reusable references, not duplicate uploads.</p>
''')
text = text.replace('''                <CardTitle className="flex items-center gap-2 text-base"><Archive className="h-4 w-4 text-emerald-600" /> Global file library</CardTitle>
''', '''                <CardTitle className="flex items-center gap-2 text-base"><Archive className="h-4 w-4 text-emerald-600" /> Global Files</CardTitle>
''')
text = text.replace('''                  <Folder className="h-3.5 w-3.5 text-emerald-600" /> Global <span>/</span> Shared files
''', '''                  <Folder className="h-3.5 w-3.5 text-emerald-600" /> Reusable across tasks <span>/</span> Global Files
''')
text = text.replace('''                  <p className="font-semibold text-[#30302b]">Drop reusable files here or choose upload.</p>
                  <p className="mt-1">Global library files are owner-scoped and available outside a single task thread. Use task files for task-specific working material.</p>
''', '''                  <p className="font-semibold text-[#30302b]">Drop reusable files here or choose upload.</p>
                  <p className="mt-1">Global Files are owner-scoped reusable references. Attach them to a task when the task should use the same brief, screenshot, standard, or source file.</p>
''')
text = text.replace('''                    {globalFiles.slice(0, 12).map((file) => (
                      <a key={file.id} href={file.storageUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl bg-white/80 px-3 py-2 text-xs text-[#4d4d46] hover:bg-emerald-50" aria-label={`Open or download global file ${file.relativePath}`}>
                        <File className="h-4 w-4 text-emerald-600" />
                        <span className="min-w-0 flex-1 truncate">{fileNameFromPath(file.relativePath)}</span>
                        <span className="hidden text-[10px] text-[#8a8980] sm:inline">{readableFileKind(file)}</span>
                      </a>
                    ))}
''', '''                    {globalFiles.slice(0, 12).map((file) => (
                      <div key={file.id} className="rounded-xl bg-white/80 px-3 py-2 text-xs text-[#4d4d46] hover:bg-emerald-50">
                        <div className="flex items-center gap-2">
                          <a href={file.storageUrl} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-2" aria-label={`Open or download global file ${file.relativePath}`}>
                            <File className="h-4 w-4 text-emerald-600" />
                            <span className="min-w-0 flex-1 truncate">{file.displayName ?? fileNameFromPath(file.relativePath)}</span>
                          </a>
                          <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700">Global</Badge>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-[10px] text-[#8a8980]">{readableFileKind(file)}</span>
                          <Button type="button" variant="outline" onClick={() => void attachGlobalFileToSelectedTask(file)} disabled={!selectedTaskId || attachGlobalToTaskMutation.isPending} className="h-7 rounded-full border-emerald-200 bg-white px-2 text-[10px] text-emerald-700">
                            Attach to task
                          </Button>
                        </div>
                      </div>
                    ))}
''')
text = text.replace('''                  <div className="rounded-2xl border border-dashed border-[#cfcfc8] bg-[#fbfaf7] p-4 text-xs leading-5 text-[#6d6d65]">The global library is empty. Add reusable briefs, standards, screenshots, or references here when they should not belong to only one task.</div>
''', '''                  <div className="rounded-2xl border border-dashed border-[#cfcfc8] bg-[#fbfaf7] p-4 text-xs leading-5 text-[#6d6d65]">Global Files is empty. Add reusable briefs, standards, screenshots, or references here when they should not belong to only one task.</div>
''')
text = text.replace('''                      <p className="mt-1 text-[#77766e]">{file.taskId === 0 ? "Global library" : `Task #${file.taskId ?? "unknown"}`} · {compactDate(file.createdAt)}</p>
''', '''                      <p className="mt-1 text-[#77766e]">{file.scope === "global" || file.taskId === null ? "Global Files" : `Task #${file.taskId ?? "unknown"}`} · {compactDate(file.createdAt)}</p>
''')
# Insert attached global files block before Need to add a file card.
marker = '''                <div className="rounded-2xl border border-[#deded8] bg-[#fbfaf7] p-3 text-xs leading-5 text-[#686861]">
                  <p className="font-semibold text-[#30302b]">Need to add a file?</p>
'''
block = '''                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3 text-xs leading-5 text-emerald-800" data-testid="attached-global-files">
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

'''
text = text.replace(marker, block + marker)
home.write_text(text)

# Add focused tests.
(ROOT / 'server/p1.global-files.schema.test.ts').write_text('''import { describe, expect, it } from "vitest";
import { globalFiles, taskGlobalFileLinks } from "../drizzle/schema";

describe("P1 Global Files schema", () => {
  it("defines first-class owner scoped global file and task link tables", () => {
    expect(globalFiles).toBeDefined();
    expect(taskGlobalFileLinks).toBeDefined();
    expect(globalFiles.ownerUserId).toBeDefined();
    expect(globalFiles.displayName).toBeDefined();
    expect(globalFiles.storageKey).toBeDefined();
    expect(taskGlobalFileLinks.taskId).toBeDefined();
    expect(taskGlobalFileLinks.globalFileId).toBeDefined();
    expect(taskGlobalFileLinks.ownerUserId).toBeDefined();
  });
});
''')

(ROOT / 'server/p1.global-files.contract.test.ts').write_text('''import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";

describe("P1 Global Files router contract", () => {
  it("exposes first-class Global Files procedures instead of only sentinel task files", () => {
    const files = appRouter._def.procedures.files?._def?.procedures ?? {};
    expect(files.listGlobal).toBeDefined();
    expect(files.listGlobalForTask).toBeDefined();
    expect(files.attachGlobalToTask).toBeDefined();
    expect(files.createMetadata).toBeDefined();
  });
});
''')

(ROOT / 'client/src/pages/p1.global-files-ui.test.tsx').write_text('''import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

describe("P1 Global Files and AI Activity UI", () => {
  it("uses first-class Global Files copy and attach-to-task action", () => {
    expect(source).toContain("Global Files");
    expect(source).toContain("Attach to task");
    expect(source).toContain("Attached Global Files");
    expect(source).toContain("listGlobalForTask");
    expect(source).toContain("attachGlobalToTask");
  });

  it("renames the worker feed to AI Activity and gates technical details", () => {
    expect(source).toContain("AI Activity");
    expect(source).not.toContain("What the AI is doing");
    expect(source).toContain("disabled={technicalEvents.length === 0}");
    expect(source).toContain("worker-technical-details");
  });
});
''')
