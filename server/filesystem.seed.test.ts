import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listWorkspaceDirectory, readWorkspaceFile } from "./filesystem";

let tempRoot: string;

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aicw-workspace-seed-"));
});

afterEach(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
});

describe("workspace filesystem startup seeding", () => {
  it("creates README.md on first workspace tree access", async () => {
    const workspaceRoot = path.join(tempRoot, "user-1");

    const tree = await listWorkspaceDirectory(workspaceRoot, "", 1);
    const readme = await readWorkspaceFile(workspaceRoot, "README.md");

    expect(tree.type).toBe("directory");
    expect(tree.children?.map((entry) => entry.relativePath)).toContain("README.md");
    expect(readme.exists).toBe(true);
    expect(readme.relativePath).toBe("README.md");
    expect(readme.content).toContain("AI Coding Workshop Workspace");
  });

  it("returns an explicit non-existent file payload instead of throwing ENOENT", async () => {
    const workspaceRoot = path.join(tempRoot, "user-1");

    const missing = await readWorkspaceFile(workspaceRoot, "notes/missing.md");

    expect(missing).toEqual({
      relativePath: "notes/missing.md",
      content: "",
      size: 0,
      modifiedAt: null,
      exists: false,
    });
  });
});
