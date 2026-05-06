import { describe, expect, it } from "vitest";
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
