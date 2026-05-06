import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const previewUrl = process.env.SECTION4_PREVIEW_URL ?? "https://3000-iqeee61l7ryw6x12rr1f0-51598878.us2.manus.computer";
const repoUrl = process.env.SECTION4_REPO_URL ?? "https://github.com/viyo-ai/AI-API-Web-Portal-v2.git";
const tokenEnvVar = process.env.SECTION4_TOKEN_ENV_VAR ?? "BUILD_TARGET_GITHUB_TOKEN";
const evidenceDir = "/home/ubuntu/section4-browser-evidence";
const evidenceFile = "/home/ubuntu/section4_browser_acceptance.json";

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
  const latestTargets = await query(
    "select id, name, repoUrl, agentEnvVarMapJson from build_targets where repoUrl like ? order by updatedAt desc limit 5",
    ["%AI-API-Web-Portal-v2%"],
  );
  const latestBranches = await query(
    "select id, branchName, workspacePath, pushState, lastPushedCommit, lastPushError from build_branches order by updatedAt desc limit 10",
  );
  const branchEvidence = latestBranches.map((branch) => ({
    ...branch,
    hasGitDir: existsSync(path.join(branch.workspacePath, ".git")),
    hasAgentEnvFile: existsSync(path.join(branch.workspacePath, ".env.agent")),
  }));
  const checks = {
    previewUrl,
    repoUrl,
    tokenEnvVar,
    hasToken: Boolean(process.env[tokenEnvVar]),
    uiRequirements: [
      "Section 4 agent env injection settings are visible via data-testid=section4-env-settings",
      "Section 4 push policy is visible via data-testid=section4-push-policy when Build Mode is open",
      "Push button calls buildBranches.push and reports pushState",
    ],
    latestTargets,
    latestBranches: branchEvidence,
  };
  await writeFile(evidenceFile, `${JSON.stringify(checks, null, 2)}
`);
  if (!checks.hasToken) throw new Error(`Missing ${tokenEnvVar}`);
  console.log(JSON.stringify(checks, null, 2));
}

main().catch(async (error) => {
  await writeFile(evidenceFile, `${JSON.stringify({ error: error instanceof Error ? error.message : String(error), previewUrl, repoUrl }, null, 2)}
`);
  console.error(error);
  process.exitCode = 1;
});
