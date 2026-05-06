import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";

describe("P1 Global Files router contract", () => {
  it("exposes first-class Global Files procedures instead of only sentinel task files", () => {
    const procedures = appRouter._def.procedures as Record<string, unknown>;
    const nestedFiles = (procedures.files as { _def?: { procedures?: Record<string, unknown> } } | undefined)?._def?.procedures ?? {};
    const procedure = (name: string) => procedures[`files.${name}`] ?? nestedFiles[name];

    expect(procedure("listGlobal")).toBeDefined();
    expect(procedure("listGlobalForTask")).toBeDefined();
    expect(procedure("attachGlobalToTask")).toBeDefined();
    expect(procedure("createMetadata")).toBeDefined();
  });
});
