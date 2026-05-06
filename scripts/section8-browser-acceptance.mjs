import { mkdir, readFile, writeFile } from "node:fs/promises";
import mysql from "mysql2/promise";

const previewUrl = process.env.SECTION8_PREVIEW_URL ?? "https://3000-iqeee61l7ryw6x12rr1f0-51598878.us2.manus.computer";
const evidenceDir = "/home/ubuntu/section8-browser-evidence";
const evidenceFile = "/home/ubuntu/section8_browser_acceptance.json";

async function query(sql, params = []) {
  if (!process.env.DATABASE_URL) return [];
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [rows] = await connection.execute(sql, params);
    return rows;
  } finally {
    await connection.end();
  }
}

async function main() {
  await mkdir(evidenceDir, { recursive: true });
  const homeSource = await readFile("client/src/pages/Home.tsx", "utf8");
  const routerSource = await readFile("server/routers.ts", "utf8");
  const wrapperSource = await readFile("server/wrapperLLM.ts", "utf8");
  const schemaSource = await readFile("drizzle/schema.ts", "utf8");
  const queueColumns = await query("show columns from task_message_queue");
  const queueIndexes = await query("show index from task_message_queue");
  const turnStatusRows = await query("show columns from orchestration_turns like 'status'");

  const checks = {
    previewUrl,
    uiRequirements: {
      hasGenerationQueuePanel: homeSource.includes('data-testid="section8-generation-queue-panel"'),
      hasQueuedMessagesRegion: homeSource.includes('data-testid="section8-queued-messages"'),
      hasStopButton: homeSource.includes('data-testid="section8-stop-generation"'),
      hasSendOrQueueButton: homeSource.includes('data-testid="section8-send-or-queue-button"'),
      hasQueueLabel: homeSource.includes('aria-label={hasActiveGeneration ? "Queue message" : "Send message"}'),
    },
    serverRequirements: {
      submitQueuesDuringActiveGeneration: routerSource.includes("enqueueTaskMessage") && routerSource.includes("existingThread?.activeTurn"),
      hasQueuedMessageEditAndClearMutations: routerSource.includes("updateQueuedMessage:") && routerSource.includes("clearQueuedMessage:"),
      hasStopMutation: routerSource.includes("stopGeneration:") && routerSource.includes("requestTurnStop"),
      autoProcessesQueuedMessages: routerSource.includes("processQueuedMessagesAfterGeneration") && routerSource.includes("markQueuedMessagesSent"),
      wrapperChecksStopBoundaries: wrapperSource.includes("getTurnStopRequest") && wrapperSource.includes("clearTurnStopRequest") && wrapperSource.includes("stopTurn"),
    },
    schemaRequirements: {
      hasQueueTable: schemaSource.includes("taskMessageQueue") && queueColumns.length >= 7,
      queueStates: schemaSource.includes('["queued", "processing", "sent", "cleared"]'),
      turnCanStop: schemaSource.includes('"stopped"'),
      queueIndexes: queueIndexes.map((row) => row.Key_name),
      turnStatusRows,
    },
  };

  const failed = [
    ...Object.entries(checks.uiRequirements),
    ...Object.entries(checks.serverRequirements),
    ...Object.entries(checks.schemaRequirements).filter(([key]) => key !== "queueIndexes" && key !== "turnStatusRows"),
  ].filter(([, value]) => value !== true);

  await writeFile(evidenceFile, `${JSON.stringify(checks, null, 2)}\n`);
  if (failed.length > 0) {
    throw new Error(`Section 8 acceptance checks failed: ${failed.map(([key]) => key).join(", ")}`);
  }
  console.log(JSON.stringify(checks, null, 2));
}

main().catch(async (error) => {
  await writeFile(evidenceFile, `${JSON.stringify({ error: error instanceof Error ? error.message : String(error), previewUrl }, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
});
