# §1A-CONV Diff Proofs

Generated: 2026-05-07T22:33:13Z

## Git status
 M client/src/pages/Home.behavior.test.tsx
 M client/src/pages/Home.tsx
 M drizzle/schema.ts
 M server/db.ts
 M server/routers.ts
 M todo.md
?? .taskmaster/docs/ingestion-evidence/PORTAL_PHASE_3_DIRECTIVE-S1A-CONV-diff-proofs.md
?? .taskmaster/docs/ingestion-evidence/PORTAL_PHASE_3_DIRECTIVE-S1A-CONV-ingestion.md
?? drizzle/0013_project_memory.sql
?? server/architectLLM.ts
?? server/prompts/
?? server/section1a-conv.contract.test.ts

## Backend/drizzle diff stats
 drizzle/schema.ts |  29 +++++++++++
 server/db.ts      |  89 +++++++++++++++++++++++++++++++++
 server/routers.ts | 145 +++++++++++++++++++++++++++++++++++++++++++++++++++++-
 3 files changed, 262 insertions(+), 1 deletion(-)

## Dependency diff

## New migration file
CREATE TABLE `project_memory` (
  `id` int AUTO_INCREMENT NOT NULL,
  `ownerUserId` int NOT NULL,
  `buildTargetId` int NOT NULL,
  `key` varchar(160) NOT NULL,
  `value` longtext NOT NULL,
  `createdAt` bigint NOT NULL,
  `updatedAt` bigint NOT NULL,
  CONSTRAINT `project_memory_id` PRIMARY KEY(`id`),
  CONSTRAINT `project_memory_build_target_key_unique` UNIQUE(`buildTargetId`,`key`)
);
--> statement-breakpoint
CREATE INDEX `project_memory_owner_build_target_idx` ON `project_memory` (`ownerUserId`,`buildTargetId`);
--> statement-breakpoint
CREATE INDEX `project_memory_build_target_updated_idx` ON `project_memory` (`buildTargetId`,`updatedAt`);

## Schema diff
diff --git a/drizzle/schema.ts b/drizzle/schema.ts
index c0d71cc..4020ae6 100644
--- a/drizzle/schema.ts
+++ b/drizzle/schema.ts
@@ -241,6 +241,33 @@ export const globalMemory = mysqlTable(
   })
 );
 
+export const projectMemory = mysqlTable(
+  "project_memory",
+  {
+    id: int("id").autoincrement().primaryKey(),
+    ownerUserId: int("ownerUserId").notNull(),
+    buildTargetId: int("buildTargetId").notNull(),
+    key: varchar("key", { length: 160 }).notNull(),
+    value: longtext("value").notNull(),
+    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
+    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
+  },
+  table => ({
+    buildTargetKeyUnique: uniqueIndex("project_memory_build_target_key_unique").on(
+      table.buildTargetId,
+      table.key
+    ),
+    ownerBuildTargetIdx: index("project_memory_owner_build_target_idx").on(
+      table.ownerUserId,
+      table.buildTargetId
+    ),
+    buildTargetUpdatedIdx: index("project_memory_build_target_updated_idx").on(
+      table.buildTargetId,
+      table.updatedAt
+    ),
+  })
+);
+
 export const globalFiles = mysqlTable(
   "global_files",
   {
@@ -578,6 +605,8 @@ export type OrchestrationTurn = typeof orchestrationTurns.$inferSelect;
 export type InsertOrchestrationTurn = typeof orchestrationTurns.$inferInsert;
 export type GlobalMemory = typeof globalMemory.$inferSelect;
 export type InsertGlobalMemory = typeof globalMemory.$inferInsert;
+export type ProjectMemory = typeof projectMemory.$inferSelect;
+export type InsertProjectMemory = typeof projectMemory.$inferInsert;
 export type GlobalFile = typeof globalFiles.$inferSelect;
 export type InsertGlobalFile = typeof globalFiles.$inferInsert;
 export type TaskGlobalFileLink = typeof taskGlobalFileLinks.$inferSelect;

## Server files changed
server/db.ts
server/routers.ts
