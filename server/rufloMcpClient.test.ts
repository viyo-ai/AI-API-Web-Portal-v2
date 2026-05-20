/**
 * §PORTAL-PHASE-1 — INV-P1 Behavioral Tests
 *
 * Tests the Ruflo MCP subprocess lifecycle, tool dispatch routing,
 * and integration invariants defined in the Phase 1 directive.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  getRufloHealth,
  getRufloTools,
  getRufloToolSummaryForPrompt,
  isRufloTool,
  stripRufloPrefix,
  _test_resetState,
  _test_setToolCache,
  type RufloToolDefinition,
} from "./rufloMcpClient";
import { dispatchToolCall } from "./wrapperLLM";

// ─── INV-P1-01: Subprocess starts and is reachable ─────────────────────────────

describe("INV-P1-01: Ruflo subprocess lifecycle", () => {
  beforeEach(() => {
    _test_resetState();
  });

  it("health check returns expected structure when subprocess is not running", () => {
    const health = getRufloHealth();
    expect(health).toHaveProperty("alive");
    expect(health).toHaveProperty("pid");
    expect(health).toHaveProperty("uptimeMs");
    expect(health).toHaveProperty("restartCount");
    expect(health).toHaveProperty("toolCount");
    expect(health).toHaveProperty("lastError");
    expect(health.alive).toBe(false);
    expect(health.pid).toBeNull();
    expect(health.uptimeMs).toBeNull();
    expect(health.restartCount).toBe(0);
  });

  it("tool cache is empty when subprocess is not running", () => {
    const tools = getRufloTools();
    expect(tools).toEqual([]);
  });

  it("tool summary returns empty string when no tools are cached", () => {
    const summary = getRufloToolSummaryForPrompt();
    expect(summary).toBe("");
  });
});

// ─── INV-P1-02: Crash restart and graceful degradation ─────────────────────────

describe("INV-P1-02: Crash restart and graceful degradation", () => {
  beforeEach(() => {
    _test_resetState();
  });

  it("dispatchToolCall returns handled=true with error when subprocess is down", async () => {
    const result = await dispatchToolCall("ruflo.memory_store", { key: "test", value: "hello" });
    expect(result.handled).toBe(true);
    expect(result.error).toBeDefined();
    expect(result.error).toContain("not running");
  });

  it("non-ruflo tool calls return handled=false regardless of subprocess state", async () => {
    const result = await dispatchToolCall("buildTargets.testConnection", { repoUrl: "https://github.com/test/test" });
    expect(result.handled).toBe(false);
    expect(result.result).toBeUndefined();
    expect(result.error).toBeUndefined();
  });
});

// ─── INV-P1-03: Tool call routing contract ─────────────────────────────────────

describe("INV-P1-03: Ruflo tool routing contract", () => {
  beforeEach(() => {
    _test_resetState();
  });

  it("isRufloTool correctly identifies ruflo-namespaced tools", () => {
    expect(isRufloTool("ruflo.memory_store")).toBe(true);
    expect(isRufloTool("ruflo.swarm_init")).toBe(true);
    expect(isRufloTool("ruflo.hooks_pre_tool_use")).toBe(true);
    expect(isRufloTool("ruflo.neural_pattern_match")).toBe(true);
    expect(isRufloTool("buildTargets.testConnection")).toBe(false);
    expect(isRufloTool("projectMemory.set")).toBe(false);
    expect(isRufloTool("system.notifyOwner")).toBe(false);
    expect(isRufloTool("")).toBe(false);
  });

  it("stripRufloPrefix removes only the ruflo. prefix", () => {
    expect(stripRufloPrefix("ruflo.memory_store")).toBe("memory_store");
    expect(stripRufloPrefix("ruflo.swarm_init")).toBe("swarm_init");
    expect(stripRufloPrefix("ruflo.hooks_pre_tool_use")).toBe("hooks_pre_tool_use");
    // Edge case: already stripped
    expect(stripRufloPrefix("memory_store")).toBe("memory_store");
  });

  it("tool summary includes category breakdown when tools are cached", () => {
    const mockTools: RufloToolDefinition[] = [
      { name: "memory_store", description: "Store a value" },
      { name: "memory_search", description: "Search memory" },
      { name: "memory_recall", description: "Recall from memory" },
      { name: "swarm_init", description: "Initialize swarm" },
      { name: "swarm_status", description: "Swarm status" },
      { name: "hooks_pre_tool_use", description: "Pre-tool hook" },
      { name: "neural_pattern_match", description: "Pattern match" },
    ];
    _test_setToolCache(mockTools);

    const summary = getRufloToolSummaryForPrompt();
    expect(summary).toContain("7 total");
    expect(summary).toContain("ruflo.memory_");
    expect(summary).toContain("ruflo.swarm_");
    expect(summary).toContain("ruflo.hooks_");
    expect(summary).toContain("ruflo.neural_");
    expect(summary).toContain("ruflo.<tool_name>");
  });
});

// ─── INV-P1-04: Existing tools unaffected ──────────────────────────────────────

describe("INV-P1-04: Existing tools unaffected by Ruflo integration", () => {
  it("dispatchToolCall does not intercept non-ruflo tools", async () => {
    const existingTools = [
      "buildTargets.testConnection",
      "buildTargets.create",
      "projectMemory.list",
      "projectMemory.set",
      "auth.me",
      "auth.logout",
      "system.notifyOwner",
    ];

    for (const tool of existingTools) {
      const result = await dispatchToolCall(tool, {});
      expect(result.handled).toBe(false);
    }
  });
});

// ─── INV-P1-05: Token-prefix security audit ────────────────────────────────────

describe("INV-P1-05: No API key consumption by Ruflo", () => {
  it("RUFLO_ENV configuration does not include any API key variables", async () => {
    // Read the source file and verify no API keys are in the Ruflo env config
    const fs = await import("node:fs");
    const source = fs.readFileSync(
      new URL("./rufloMcpClient.ts", import.meta.url),
      "utf-8"
    );

    // The RUFLO_ENV block should not contain API key references
    const rufloEnvMatch = source.match(/const RUFLO_ENV[\s\S]*?};/);
    expect(rufloEnvMatch).not.toBeNull();
    const rufloEnvBlock = rufloEnvMatch![0];
    expect(rufloEnvBlock).not.toContain("ANTHROPIC_API_KEY");
    expect(rufloEnvBlock).not.toContain("CLAUDE_API_KEY");
    expect(rufloEnvBlock).not.toContain("OPENAI_API_KEY");
    expect(rufloEnvBlock).not.toContain("API_KEY");
  });

  it("subprocess spawn explicitly excludes API keys from child environment", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync(
      new URL("./rufloMcpClient.ts", import.meta.url),
      "utf-8"
    );

    // Verify the spawn function strips API keys
    expect(source).toContain('ANTHROPIC_API_KEY: ""');
    expect(source).toContain('CLAUDE_API_KEY: ""');
    expect(source).toContain('OPENAI_API_KEY: ""');
    expect(source).toContain("delete env.ANTHROPIC_API_KEY");
    expect(source).toContain("delete env.CLAUDE_API_KEY");
    expect(source).toContain("delete env.OPENAI_API_KEY");
  });
});

// ─── INV-P1-06: §9 approval gate unchanged ────────────────────────────────────

describe("INV-P1-06: §9 approval gate unchanged by Ruflo integration", () => {
  it("Ruflo tool summary includes explicit gate-bypass prohibition", () => {
    const mockTools: RufloToolDefinition[] = [
      { name: "memory_store", description: "Store a value" },
    ];
    _test_setToolCache(mockTools);

    // The system prompt injection includes the gate warning
    const fs = require("node:fs");
    const wrapperSource = fs.readFileSync(
      require("node:path").resolve(__dirname, "./wrapperLLM.ts"),
      "utf-8"
    );

    // Verify the rufloSection in baseSystemPrompt includes gate prohibition
    expect(wrapperSource).toContain("Ruflo tools do NOT bypass the §9 approval gate");
  });

  it("architect.context.md explicitly prohibits gate bypass via Ruflo", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const contextDoc = fs.readFileSync(
      path.resolve(__dirname, "./prompts/architect.context.md"),
      "utf-8"
    );

    expect(contextDoc).toContain("Bypassing the §9 approval gate or any safety constraint");
    expect(contextDoc).toContain("ruflo.memory_*");
    expect(contextDoc).toContain("ruflo.swarm_*");
    expect(contextDoc).toContain("ruflo.hooks_*");
    expect(contextDoc).toContain("ruflo.neural_*");
  });
});

// ─── Integration: dispatchToolCall contract ────────────────────────────────────

describe("dispatchToolCall integration contract", () => {
  beforeEach(() => {
    _test_resetState();
  });

  it("returns { handled: true, error } for ruflo tools when subprocess is down", async () => {
    const result = await dispatchToolCall("ruflo.swarm_init", { topology: "mesh" });
    expect(result.handled).toBe(true);
    expect(result.error).toBeDefined();
    expect(typeof result.error).toBe("string");
  });

  it("returns { handled: false } for all non-ruflo tools", async () => {
    const nonRufloTools = [
      "buildTargets.create",
      "projectMemory.list",
      "auth.me",
      "unknown.tool",
      "memory_store", // without ruflo. prefix
    ];

    for (const tool of nonRufloTools) {
      const result = await dispatchToolCall(tool, {});
      expect(result.handled).toBe(false);
    }
  });
});

// ─── INV-DEPLOY-01: Binary resolution finds ruflo from node_modules ──────────

import { findRufloBinary } from "./rufloMcpClient";
import { existsSync, statSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("INV-DEPLOY-01: Binary resolution without npx cache", () => {
  it("findRufloBinary resolves to node_modules/ruflo/bin/ruflo.js", () => {
    const binary = findRufloBinary();

    // Must resolve to a path containing ruflo/bin/ruflo.js
    expect(binary).toContain("ruflo");
    expect(binary).toContain("bin");
    expect(binary).toMatch(/ruflo\.js$/);

    // The resolved path must actually exist and be a file
    expect(existsSync(binary)).toBe(true);
    const stat = statSync(binary);
    expect(stat.isFile()).toBe(true);
  });

  it("findRufloBinary prefers node_modules over npx cache when both exist", () => {
    const binary = findRufloBinary();
    const expectedPrimary = resolve(process.cwd(), "node_modules", "ruflo", "bin", "ruflo.js");

    // When node_modules/ruflo exists (as it does after pnpm install),
    // the function MUST return the node_modules path, not the npx cache path
    expect(binary).toBe(expectedPrimary);
  });

  it("resolved ruflo binary is executable by Node.js (shebang check)", () => {
    const binary = findRufloBinary();
    const content = readFileSync(binary, "utf-8");

    // Must have Node.js shebang — confirms it's a valid Node script
    expect(content.startsWith("#!/usr/bin/env node")).toBe(true);
  });
});
