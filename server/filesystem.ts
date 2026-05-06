import { constants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { storagePut } from "./storage";

export type WorkspaceFsEntry = {
  name: string;
  relativePath: string;
  type: "file" | "directory";
  size: number;
  modifiedAt: string;
  children?: WorkspaceFsEntry[];
};

export const MAX_FILE_PREVIEW_BYTES = 1024 * 1024;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function assertNoUnsafeSegments(relativePath: string) {
  if (relativePath.includes("\0")) throw new Error("File path contains an invalid character");
  if (path.isAbsolute(relativePath)) throw new Error("Absolute file paths are not allowed");
  const normalized = path.posix.normalize(relativePath.replace(/\\/g, "/"));
  if (normalized === ".." || normalized.startsWith("../") || normalized.includes("/../")) {
    throw new Error("Path traversal outside the workspace is not allowed");
  }
  return normalized === "." ? "" : normalized.replace(/^\.\//, "");
}

export async function ensureWorkspaceRoot(rootPath: string) {
  const resolved = path.resolve(rootPath);
  await fs.mkdir(resolved, { recursive: true, mode: 0o700 });
  return resolved;
}

export async function resolveWorkspacePath(rootPath: string, userRelativePath = "") {
  const root = await ensureWorkspaceRoot(rootPath);
  const safeRelativePath = assertNoUnsafeSegments(userRelativePath || "");
  const absolutePath = path.resolve(root, safeRelativePath);
  if (absolutePath !== root && !absolutePath.startsWith(`${root}${path.sep}`)) {
    throw new Error("Resolved file path is outside the workspace");
  }
  return { root, relativePath: safeRelativePath, absolutePath };
}

async function pathExists(absolutePath: string) {
  try {
    await fs.access(absolutePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function entryFor(root: string, absolutePath: string, depth: number): Promise<WorkspaceFsEntry> {
  const stats = await fs.stat(absolutePath);
  const relativePath = path.relative(root, absolutePath).replace(/\\/g, "/");
  const name = relativePath ? path.basename(absolutePath) : "workspace";
  const entry: WorkspaceFsEntry = {
    name,
    relativePath,
    type: stats.isDirectory() ? "directory" : "file",
    size: stats.size,
    modifiedAt: stats.mtime.toISOString(),
  };

  if (stats.isDirectory() && depth > 0) {
    const names = await fs.readdir(absolutePath);
    const children = await Promise.all(
      names
        .filter(item => !["node_modules", ".git", ".cache", "dist", ".manus-logs"].includes(item))
        .slice(0, 120)
        .map(item => entryFor(root, path.join(absolutePath, item), depth - 1)),
    );
    entry.children = children.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "directory" ? -1 : 1));
  }

  return entry;
}

export async function listWorkspaceDirectory(rootPath: string, relativePath = "", depth = 2) {
  const { root, absolutePath } = await resolveWorkspacePath(rootPath, relativePath);
  return entryFor(root, absolutePath, Math.max(0, Math.min(depth, 4)));
}

export async function readWorkspaceFile(rootPath: string, relativePath: string) {
  const { absolutePath, relativePath: safeRelativePath } = await resolveWorkspacePath(rootPath, relativePath);
  const stats = await fs.stat(absolutePath);
  if (!stats.isFile()) throw new Error("Only files can be previewed");
  if (stats.size > MAX_FILE_PREVIEW_BYTES) throw new Error("File is too large to preview safely");
  const data = await fs.readFile(absolutePath);
  if (data.includes(0)) throw new Error("Binary files cannot be previewed as text");
  return {
    relativePath: safeRelativePath,
    content: data.toString("utf8"),
    size: stats.size,
    modifiedAt: stats.mtime.toISOString(),
  };
}

export async function writeWorkspaceFile(rootPath: string, relativePath: string, content: string) {
  const { absolutePath, relativePath: safeRelativePath } = await resolveWorkspacePath(rootPath, relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true, mode: 0o700 });
  await fs.writeFile(absolutePath, content, "utf8");
  const stats = await fs.stat(absolutePath);
  return { relativePath: safeRelativePath, size: stats.size, modifiedAt: stats.mtime.toISOString() };
}

export async function createWorkspaceDirectory(rootPath: string, relativePath: string) {
  const { absolutePath, relativePath: safeRelativePath } = await resolveWorkspacePath(rootPath, relativePath);
  await fs.mkdir(absolutePath, { recursive: true, mode: 0o700 });
  const stats = await fs.stat(absolutePath);
  return { relativePath: safeRelativePath, size: stats.size, modifiedAt: stats.mtime.toISOString() };
}

export async function renameWorkspacePath(rootPath: string, fromRelativePath: string, toRelativePath: string) {
  const from = await resolveWorkspacePath(rootPath, fromRelativePath);
  const to = await resolveWorkspacePath(rootPath, toRelativePath);
  if (!(await pathExists(from.absolutePath))) throw new Error("Source path does not exist");
  if (await pathExists(to.absolutePath)) throw new Error("Destination path already exists");
  await fs.mkdir(path.dirname(to.absolutePath), { recursive: true, mode: 0o700 });
  await fs.rename(from.absolutePath, to.absolutePath);
  return { fromRelativePath: from.relativePath, toRelativePath: to.relativePath };
}

export async function deleteWorkspacePath(rootPath: string, relativePath: string) {
  const resolved = await resolveWorkspacePath(rootPath, relativePath);
  if (!resolved.relativePath) throw new Error("Deleting the workspace root is not allowed");
  await fs.rm(resolved.absolutePath, { recursive: true, force: false });
  return { relativePath: resolved.relativePath };
}

function sanitizeStorageSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._/-]/g, "_").replace(/\/+/g, "/").replace(/^\/+/, "");
}

export async function snapshotWorkspacePath(input: {
  rootPath: string;
  workspaceId: number;
  ownerUserId: number;
  relativePath: string;
  action: "upload" | "create" | "update" | "rename" | "delete" | "download" | "snapshot";
}) {
  const { absolutePath, relativePath } = await resolveWorkspacePath(input.rootPath, input.relativePath);
  const stats = await fs.stat(absolutePath);
  const storageRelPath = sanitizeStorageSegment(relativePath || "workspace-root");
  const baseKey = `workspaces/${input.workspaceId}/owner-${input.ownerUserId}/${input.action}/${storageRelPath}`;

  if (stats.isDirectory()) {
    const tree = await listWorkspaceDirectory(input.rootPath, relativePath, 4);
    const uploaded = await storagePut(`${baseKey}.manifest.json`, JSON.stringify(tree, null, 2), "application/json");
    return { relativePath, storageKey: uploaded.key, storageUrl: uploaded.url };
  }

  const data = await fs.readFile(absolutePath);
  const uploaded = await storagePut(baseKey || `workspaces/${input.workspaceId}/owner-${input.ownerUserId}/${input.action}/file`, data);
  return { relativePath, storageKey: uploaded.key, storageUrl: uploaded.url };
}

export async function uploadWorkspaceFile(input: {
  rootPath: string;
  workspaceId: number;
  ownerUserId: number;
  relativePath: string;
  base64Content: string;
  mimeType?: string;
}) {
  const data = Buffer.from(input.base64Content, "base64");
  if (data.byteLength > MAX_UPLOAD_BYTES) throw new Error("Upload exceeds the 5 MB safety limit");
  const resolved = await resolveWorkspacePath(input.rootPath, input.relativePath);
  const storageRelPath = sanitizeStorageSegment(resolved.relativePath || "uploaded-file");
  const uploaded = await storagePut(
    `workspaces/${input.workspaceId}/owner-${input.ownerUserId}/uploads/${storageRelPath}`,
    data,
    input.mimeType || "application/octet-stream",
  );
  await fs.mkdir(path.dirname(resolved.absolutePath), { recursive: true, mode: 0o700 });
  await fs.writeFile(resolved.absolutePath, data);
  return { relativePath: resolved.relativePath, size: data.byteLength, storageKey: uploaded.key, storageUrl: uploaded.url };
}
