import fs from "node:fs";
import path from "node:path";

const root = "/home/ubuntu/portal-phase2-section2-worktree";
const files = [
  "client/src/pages/Home.tsx",
  "client/src/pages/Home.behavior.test.tsx",
  "server/routers.ts",
  "server/buildRunner.ts",
  "server/buildRunner/loadGovernance.ts",
  "server/db.ts",
  "server/section1.build-targets.contract.test.ts",
  "server/section1.github-token.secret.test.ts",
  "server/section2.governance.contract.test.ts",
  "server/section4.branch-policy.contract.test.ts",
];

function replaceAllStrict(text, replacements, file) {
  let next = text;
  for (const [from, to] of replacements) {
    if (!next.includes(from)) {
      console.warn(`[section3a] ${file}: missing expected text: ${from}`);
      continue;
    }
    next = next.split(from).join(to);
  }
  return next;
}

const homePath = path.join(root, "client/src/pages/Home.tsx");
let home = fs.readFileSync(homePath, "utf8");
home = replaceAllStrict(home, [
  ["function ownerFacingText(value: string | null | undefined) {\n  return (value ?? \"\")\n    .replaceAll(\"Wrapper LLM\", \"AI coordinator\")\n    .replaceAll(\"Wrapper\", \"AI coordinator\")\n    .replaceAll(\"production three-pane shell\", \"plain-English AI coding workshop\")\n    .replaceAll(\"task-first production shell\", \"task-first production workspace\");\n}\n", "function ownerFacingText(value: string | null | undefined) {\n  return (value ?? \"\")\n    .replaceAll(\"Wrapper LLM\", \"AI coordinator\")\n    .replaceAll(\"Wrapper\", \"AI coordinator\")\n    .replaceAll(\"Build Target\", \"Project\")\n    .replaceAll(\"Build Mode\", \"Project mode\")\n    .replaceAll(\"Governance Files\", \"Project rule books\")\n    .replaceAll(\"governance files\", \"rule books\")\n    .replaceAll(\"Governance\", \"Rule book\")\n    .replaceAll(\"Conventional Commit\", \"commit message\")\n    .replaceAll(\"token budget\", \"AI context limit\")\n    .replaceAll(\"production three-pane shell\", \"plain-English AI coding workshop\")\n    .replaceAll(\"task-first production shell\", \"task-first production workspace\");\n}\n\nfunction pushStatusLabel(value: string | null | undefined) {\n  if (value === \"pushed\") return \"Pushed\";\n  if (value === \"push_failed\") return \"Last push failed\";\n  return \"Never pushed\";\n}\n"],
  ["Saved environment and Governance Files settings for", "Saved AI environment variables and project rule books for"],
  ["The Build Target settings could not be saved.", "The project settings could not be saved."],
  ["The Build Branch push was blocked by Section 4 policy.", "The working branch push was blocked by project policy."],
  ["Add a GitHub repository URL before creating a Build Target.", "Add a GitHub repository URL before creating a project."],
  ["Build Target created for", "Project created for"],
  ["The Build Target could not be created.", "The project could not be created."],
  ["The Build Target connection test failed.", "The project connection test failed."],
  ["Create or select a Build Target before opening Build Mode.", "Create or select a project before opening project mode."],
  ["Build Mode ready on", "Project ready on"],
  ["Build Branch recorded, but clone failed:", "Working branch recorded, but clone failed:"],
  ["The Build Branch could not be created.", "The working branch could not be created."],
  ["> Build Targets", "> Projects"],
  ["placeholder=\"Build Target name\"", "placeholder=\"Project name\""],
  ["Section 4 injects these server-side secret mappings into a gitignored .env.agent file inside Build Branch workspaces.", "Paste only the env var names where you set tokens and secrets. The actual values go in your portal environment, never in this form."],
  ["Add Build Target", "Add Project"],
  ["Loading Build Targets...", "Loading projects..."],
  ["No Build Targets yet. Section 1 keeps existing tasks intact until you connect a repository.", "No projects yet. Existing tasks stay intact until you connect a repository."],
  ["Section 4 agent env injection", "AI environment variables"],
  ["Saved mappings generate <span className=\"font-mono\">.env.agent</span> during Build Branch operations. The file is gitignored and push policy blocks it from being staged.", "These get written into a hidden file inside the project's working folder so the AI can use them. The file is gitignored — the AI cannot accidentally commit your secrets."],
  ["Section 2 Governance Files", "Project rule books"],
  ["These safe repository-relative paths are loaded on every Build Mode turn before Claude or Kimi starts. Required misses block execution; optional misses are logged.", "Files in your repo that the AI reads on every task before doing anything. Required rule books that are missing will block tasks until you add them."],
  ["Enforce Claude/Kimi governance token budget with optional drops and required truncation logging.", "Trim rule books if they're too long for the AI's brain. Recommended on: optional rule books are trimmed first, and required rule books note what was shortened."],
  ["Add governance row", "Add rule book"],
  ["Save selected target settings", "Save project settings"],
  ["Build Mode target:", "Project:"],
  ["Build Mode: {selectedBuildTarget.name} on branch {openedBuildBranch.branchName}", "Project: {selectedBuildTarget.name} • Branch: {openedBuildBranch.branchName}"],
  ["Section 4 push policy: protected branches blocked, clean tree required, Conventional Commit required, and .env.agent is injected but never committed.", "Push checks: protected branches blocked, working tree must be clean, AI environment file is never committed."],
  ["Push branch with policy checks", "Push branch"],
  ["Push state: {openedBuildBranch.pushState ?? \"never_pushed\"}", "Push status: {pushStatusLabel(openedBuildBranch.pushState)}"],
  ["Read-only Build Target tree", "Read-only project tree"],
  ["Section 1 links this task to {selectedBuildTarget.name}. Git writes remain behind explicit Build Branch actions; shipped task files below are not replaced.", "This task is linked to {selectedBuildTarget.name}. Git writes stay behind explicit working-branch actions; shipped task files below are not replaced."],
], "client/src/pages/Home.tsx");

home = home.replace(/placeholder=\"WORKSHOP_GITHUB_TOKEN=BUILD_TARGET_TOKEN\"/g, "placeholder=\"AI_VAR_NAME=portal_env_var_name\"");
home = home.replace(/placeholder=\"main\" className=\"h-9 rounded-xl border-\[#d9d8d1\] bg-white text-xs\" \/>/g, "placeholder=\"main\" aria-label=\"Branch the AI works from\" className=\"h-9 rounded-xl border-[#d9d8d1] bg-white text-xs\" />");
home = home.replace(/placeholder=\"main, staging\" className=\"h-9 rounded-xl border-\[#d9d8d1\] bg-white text-xs\" \/>/g, "placeholder=\"main, staging\" aria-label=\"Branches the AI must never push to\" className=\"h-9 rounded-xl border-[#d9d8d1] bg-white text-xs\" />");
home = home.replace(/placeholder=\"pnpm check\\npnpm test\\npnpm build\" className=\"min-h-\[70px\] rounded-xl border-\[#d9d8d1\] bg-white text-xs\" \/>/g, "placeholder=\"pnpm check\\npnpm test\\npnpm build\" aria-label=\"Pre-push checks (optional, one per line)\" className=\"min-h-[70px] rounded-xl border-[#d9d8d1] bg-white text-xs\" />");
home = home.replace(/placeholder=\"curl -fsS http:\/\/localhost:3000\/health\" className=\"min-h-\[60px\] rounded-xl border-\[#d9d8d1\] bg-white text-xs\" \/>/g, "placeholder=\"curl -fsS http://localhost:3000/health\" aria-label=\"Service connection checks (optional, one per line)\" className=\"min-h-[60px] rounded-xl border-[#d9d8d1] bg-white text-xs\" />");
fs.writeFileSync(homePath, home);

const genericReplacements = [
  ["Build Targets", "Projects"],
  ["Build Target", "Project"],
  ["Build Mode", "Project mode"],
  ["Governance Files", "Project rule books"],
  ["Validation Commands", "Pre-push checks"],
  ["Service Checks", "Service connection checks"],
  ["Agent Env Var", "AI environment variable"],
  ["Conventional Commit", "commit message"],
  ["Token Budget", "AI Context Limit"],
  ["Pre-push Hook", "Pre-push check"],
];

for (const relative of files.filter((file) => file !== "client/src/pages/Home.tsx")) {
  const targetPath = path.join(root, relative);
  if (!fs.existsSync(targetPath)) continue;
  let text = fs.readFileSync(targetPath, "utf8");
  for (const [from, to] of genericReplacements) text = text.split(from).join(to);
  text = text.split("Governance loading blocked this Project mode turn. Missing required file(s):").join("Can't start: this project's rule book is missing —");
  text = text.split("Governance loaded for this Project mode turn:").join("Loaded rule books for this task:");
  text = text.split("Missing required governance files:").join("Missing required rule books:");
  text = text.split("Project rule books must include at least one governance document when the list is not empty.").join("Project rule books must include at least one rule book document when the list is not empty.");
  text = text.split("Governance file #").join("Rule book #");
  text = text.split("Governance file path is required.").join("Rule book path is required.");
  text = text.split("Unsafe governance file path:").join("Unsafe rule book path:");
  text = text.split("governance loading").join("rule book loading");
  text = text.split("governance document").join("rule book document");
  text = text.split("governance files").join("rule books");
  text = text.split("governance file").join("rule book");
  fs.writeFileSync(targetPath, text);
}

console.log("§3A vocabulary rename applied.");
