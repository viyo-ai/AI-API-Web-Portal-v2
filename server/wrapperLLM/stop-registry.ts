import { describeStopBoundary, isDestructiveToolName } from "./tool-registry.ts";

export type StopRequest = {
  turnId: number;
  ownerUserId: number;
  taskId: number;
  requestedAt: number;
  activeOperation: string | null;
  destructiveOperation: boolean;
  boundary: string;
};

const stopRequests = new Map<number, StopRequest>();

export function requestTurnStop(input: { turnId: number; ownerUserId: number; taskId: number; activeOperation?: string | null }) {
  const activeOperation = input.activeOperation?.trim() || null;
  const destructiveOperation = isDestructiveToolName(activeOperation);
  const request: StopRequest = { turnId: input.turnId, ownerUserId: input.ownerUserId, taskId: input.taskId, requestedAt: Date.now(), activeOperation, destructiveOperation, boundary: describeStopBoundary(activeOperation) };
  stopRequests.set(input.turnId, request);
  return request;
}

export function getTurnStopRequest(turnId: number) { return stopRequests.get(turnId) ?? null; }
export function clearTurnStopRequest(turnId: number) { stopRequests.delete(turnId); }
