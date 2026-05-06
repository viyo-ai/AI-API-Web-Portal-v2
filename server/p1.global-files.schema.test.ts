import { describe, expect, it } from "vitest";
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
