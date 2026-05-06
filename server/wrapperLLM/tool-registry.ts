const DESTRUCTIVE_TOOL_HINTS = [
  "write",
  "delete",
  "remove",
  "rm",
  "mv",
  "commit",
  "push",
  "deploy",
  "publish",
  "migrate",
  "sql",
  "apply",
  "patch",
  "install",
  "restart",
  "rollback",
] as const;

export function isDestructiveToolName(toolName: string | null | undefined): boolean {
  const normalized = toolName?.trim().toLowerCase() ?? "";
  if (!normalized) return false;
  return DESTRUCTIVE_TOOL_HINTS.some((hint) => normalized.includes(hint));
}

export function describeStopBoundary(toolName: string | null | undefined): string {
  const activeOperation = toolName?.trim();
  if (!activeOperation) return "next_safe_boundary";
  return isDestructiveToolName(activeOperation) ? "after_destructive_operation_completes" : "before_next_generation_step";
}
