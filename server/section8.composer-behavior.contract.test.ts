import { describe, expect, it } from "vitest";
import { orchestrationTurns, taskMessageQueue } from "../drizzle/schema";
import { appRouter } from "./routers";
import { MAX_QUEUED_MESSAGES_PER_TASK, formatQueuedMessagesForGeneration } from "./db";
import { clearTurnStopRequest, getTurnStopRequest, requestTurnStop } from "./wrapperLLM/stop-registry";

const queueStates = ["queued", "processing", "sent", "cleared"] as const;

describe("Section 8 composer behavior during generation contracts", () => {
  it("adds persistent queued-message schema and stopped turn state without removing existing turn fields", () => {
    expect(taskMessageQueue.id).toBeDefined();
    expect(taskMessageQueue.taskId).toBeDefined();
    expect(taskMessageQueue.ownerUserId).toBeDefined();
    expect(taskMessageQueue.content).toBeDefined();
    expect(taskMessageQueue.state).toBeDefined();
    expect(taskMessageQueue.position).toBeDefined();
    expect(orchestrationTurns.state).toBeDefined();
    expect(orchestrationTurns.completedAt).toBeDefined();
  });

  it("exports Section 8 tRPC procedures at the orchestration contract boundary", () => {
    const procedures = appRouter._def.procedures;
    expect(procedures["orchestration.submitMessage"]).toBeDefined();
    expect(procedures["orchestration.updateQueuedMessage"]).toBeDefined();
    expect(procedures["orchestration.clearQueuedMessage"]).toBeDefined();
    expect(procedures["orchestration.stopGeneration"]).toBeDefined();
  });

  it("keeps queue state language aligned with the directive and caps queued composer drafts", () => {
    expect(queueStates).toEqual(["queued", "processing", "sent", "cleared"]);
    expect(MAX_QUEUED_MESSAGES_PER_TASK).toBe(5);
    expect(formatQueuedMessagesForGeneration([
      { position: 1, content: "First queued follow-up" },
      { position: 2, content: "Second queued follow-up" },
    ])).toContain("messages were queued during your previous response");
  });

  it("records Stop requests at safe boundaries and identifies destructive operations", () => {
    clearTurnStopRequest(77);
    const safeStop = requestTurnStop({ taskId: 7, ownerUserId: 42, turnId: 77, activeOperation: "thinking" });
    expect(safeStop.destructiveOperation).toBe(false);
    expect(safeStop.boundary).toBe("before_next_generation_step");
    expect(getTurnStopRequest(77)?.turnId).toBe(77);

    const destructiveStop = requestTurnStop({ taskId: 7, ownerUserId: 42, turnId: 78, activeOperation: "git push" });
    expect(destructiveStop.destructiveOperation).toBe(true);
    expect(destructiveStop.boundary).toBe("after_destructive_operation_completes");
    clearTurnStopRequest(77);
    clearTurnStopRequest(78);
  });
});
