import mysql from "mysql2/promise";
import { describe, expect, it } from "vitest";

const requiredV2Tables = [
  "credential_status_snapshots",
  "global_memory",
  "orchestration_turns",
  "task_events",
  "task_files",
  "task_message_queue",
  "tasks",
];

describe("v2 workspace database schema", () => {
  it.runIf(Boolean(process.env.DATABASE_URL))("has every table required by authenticated workspace startup queries", async () => {
    const connection = await mysql.createConnection(process.env.DATABASE_URL!);
    try {
      const [rows] = await connection.query(
        "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?) ORDER BY TABLE_NAME",
        [requiredV2Tables],
      );
      const actualTables = (rows as Array<{ TABLE_NAME: string }>).map((row) => row.TABLE_NAME);
      expect(actualTables).toEqual([...requiredV2Tables].sort());
    } finally {
      await connection.end();
    }
  });
});
