import fs from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";
import WebSocket from "ws";

const previewPrefix = "https://3000-iqeee61l7ryw6x12rr1f0-51598878.us2.manus.computer";
const acceptanceRepoUrl = "https://github.com/viyo-ai/AI-API-Web-Portal-v2.git";
const acceptanceTokenEnvVar = "BUILD_TARGET_GITHUB_TOKEN";
const acceptanceBaseBranch = "main";
const evidenceDir = "/home/ubuntu/section1-browser-evidence";
await fs.mkdir(evidenceDir, { recursive: true });

async function getTarget() {
  const targets = await fetch("http://127.0.0.1:9222/json").then((r) => r.json());
  const target = targets.find((item) => item.type === "page" && item.url?.startsWith(previewPrefix));
  if (!target?.webSocketDebuggerUrl) throw new Error("Preview tab was not found in Chromium DevTools targets.");
  return target;
}

class CDP {
  constructor(url) {
    this.url = url;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
  }
  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      this.ws.on("open", resolve);
      this.ws.on("error", reject);
      this.ws.on("message", (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) reject(new Error(JSON.stringify(msg.error)));
          else resolve(msg.result);
        } else if (msg.method) {
          this.events.push(msg);
        }
      });
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP timeout for ${method}`));
      }, 30000);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
    });
  }
  close() {
    this.ws?.close();
  }
}

const target = await getTarget();
const cdp = new CDP(target.webSocketDebuggerUrl);
await cdp.connect();
await cdp.send("Page.enable");
await cdp.send("Runtime.enable");
await cdp.send("Network.enable");
await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

const evidence = {
  startedAt: new Date().toISOString(),
  previewUrl: target.url,
  targetTitle: target.title,
  steps: [],
  screenshots: [],
  consoleErrors: [],
  failedRequests: [],
};

function remember(step, status, details = {}) {
  evidence.steps.push({ step, status, at: new Date().toISOString(), ...details });
}

async function evalPage(expression, returnByValue = true) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue,
    userGesture: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || JSON.stringify(result.exceptionDetails));
  return result.result?.value;
}

async function screenshot(name) {
  const shot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  const file = path.join(evidenceDir, `${name}.png`);
  await fs.writeFile(file, Buffer.from(shot.data, "base64"));
  evidence.screenshots.push(file);
  return file;
}

async function waitFor(predicateSource, timeoutMs = 30000, label = "condition") {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeoutMs) {
    last = await evalPage(`(() => { try { return (${predicateSource})(); } catch (error) { return { __error: String(error) }; } })()`);
    if (last && !last.__error) return last;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${label}. Last value: ${JSON.stringify(last)}`);
}

async function clickByText(textOrRegex, selector = "button,a,[role='button']") {
  const escaped = JSON.stringify(textOrRegex);
  const result = await evalPage(`(() => {
    const query = ${JSON.stringify(selector)};
    const patternText = ${escaped};
    const pattern = patternText.startsWith('/') ? new RegExp(patternText.slice(1, patternText.lastIndexOf('/')), patternText.slice(patternText.lastIndexOf('/') + 1)) : null;
    const matches = [...document.querySelectorAll(query)].filter((el) => {
      const text = (el.innerText || el.textContent || '').trim();
      return pattern ? pattern.test(text) : text.includes(patternText);
    });
    if (!matches.length) return { ok: false, available: [...document.querySelectorAll(query)].map((el) => (el.innerText || el.textContent || '').trim()).filter(Boolean).slice(0, 80) };
    matches[0].scrollIntoView({ block: 'center', inline: 'center' });
    matches[0].click();
    return { ok: true, clicked: (matches[0].innerText || matches[0].textContent || '').trim() };
  })()`);
  if (!result?.ok) throw new Error(`Could not click ${textOrRegex}: ${JSON.stringify(result?.available)}`);
  return result.clicked;
}

async function setFieldByPlaceholder(placeholderPart, value) {
  const result = await evalPage(`(() => {
    const part = ${JSON.stringify(placeholderPart)}.toLowerCase();
    const el = [...document.querySelectorAll('input,textarea')].find((node) => (node.getAttribute('placeholder') || '').toLowerCase().includes(part));
    if (!el) return { ok: false, placeholders: [...document.querySelectorAll('input,textarea')].map((node) => node.getAttribute('placeholder') || '').filter(Boolean) };
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set;
    setter.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
    return { ok: true, placeholder: el.getAttribute('placeholder'), value: el.value };
  })()`);
  if (!result?.ok) throw new Error(`Could not set placeholder containing ${placeholderPart}: ${JSON.stringify(result?.placeholders)}`);
  return result;
}

async function collectState() {
  return await evalPage(`(() => {
    const text = document.body.innerText;
    const buttons = [...document.querySelectorAll('button,a,[role="button"]')].map((el) => (el.innerText || el.textContent || '').trim()).filter(Boolean).slice(0, 120);
    const inputs = [...document.querySelectorAll('input,textarea')].map((el) => ({ placeholder: el.getAttribute('placeholder') || '', value: el.value || '' })).slice(0, 80);
    return { text, buttons, inputs, url: location.href };
  })()`);
}

async function getBranchDiagnostic(targetName, branchName) {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for authoritative Build Branch verification.");
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [rows] = await connection.query(
      `SELECT b.id, b.branchName, b.baseBranch, b.state, b.errorMessage, b.lastSyncedCommit, b.workspacePath, t.name AS targetName, t.repoUrl, t.githubTokenEnvVar
       FROM build_branches b
       JOIN build_targets t ON t.id = b.buildTargetId
       WHERE t.name = ? AND b.branchName = ?
       ORDER BY b.id DESC
       LIMIT 1`,
      [targetName, branchName],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      targetName: row.targetName,
      repoUrl: row.repoUrl,
      githubTokenEnvVar: row.githubTokenEnvVar,
      branchName: row.branchName,
      baseBranch: row.baseBranch,
      state: row.state,
      errorMessage: typeof row.errorMessage === "string" ? row.errorMessage.replace(/x-access-token:[^@]+@/g, "x-access-token:[redacted]@") : row.errorMessage,
      lastSyncedCommit: row.lastSyncedCommit,
      workspacePath: row.workspacePath,
    };
  } finally {
    await connection.end();
  }
}

async function waitForCleanBranchDiagnostic(targetName, branchName, timeoutMs = 90000) {
  const start = Date.now();
  let latest = null;
  while (Date.now() - start < timeoutMs) {
    latest = await getBranchDiagnostic(targetName, branchName);
    if (latest?.state === "clean") {
      await fs.stat(path.join(latest.workspacePath, ".git"));
      return latest;
    }
    if (latest?.state === "error") throw new Error(`Build Branch clone failed: ${latest.errorMessage || "unknown error"}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for clean Build Branch database state. Last diagnostic: ${JSON.stringify(latest)}`);
}

cdp.ws.on("message", (raw) => {
  try {
    const msg = JSON.parse(raw.toString());
    if (msg.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(msg.params?.type)) {
      evidence.consoleErrors.push({ type: msg.params.type, args: msg.params.args?.map((arg) => arg.value || arg.description).filter(Boolean) });
    }
    if (msg.method === "Network.responseReceived" && msg.params?.response?.status >= 400) {
      evidence.failedRequests.push({ url: msg.params.response.url, status: msg.params.response.status });
    }
  } catch {}
});

try {
  remember("load-preview", "running", { url: target.url });
  await cdp.send("Page.navigate", { url: previewPrefix + "/" });
  await waitFor(`() => document.readyState === 'complete' && document.body.innerText.includes('BUILD TARGETS')`, 30000, "Build Targets left-panel load");
  await screenshot("01-build-targets-initial");
  const initial = await collectState();
  const initialHaystack = `${initial.text}\n${initial.inputs.map((field) => `${field.placeholder} ${field.value}`).join('\n')}`;
  const requiredInitialText = ["BUILD TARGETS", "Build Target name", "https://github.com/org/repo", "BUILD_TARGET_GITHUB_TOKEN", "Optional validation commands"];
  const missingInitial = requiredInitialText.filter((text) => !initialHaystack.includes(text));
  if (missingInitial.length) throw new Error(`Missing initial Section 1 UI text or field metadata: ${missingInitial.join(', ')}`);
  remember("initial-section1-ui-visible", "passed", { buttons: initial.buttons.slice(0, 20), fields: initial.inputs.filter((field) => /Build Target|github|branch|validation/i.test(`${field.placeholder} ${field.value}`)).slice(0, 12), missingInitial });

  const stamp = Date.now();
  const targetName = `Section 1 Browser Target ${stamp}`;
  const branchName = `section1-browser-${stamp}`;
  await setFieldByPlaceholder("Build Target name", targetName);
  await setFieldByPlaceholder("https://github.com/org/repo", acceptanceRepoUrl);
  await setFieldByPlaceholder("BUILD_TARGET_VIYO", acceptanceTokenEnvVar);
  await setFieldByPlaceholder("Default base branch", acceptanceBaseBranch);
  await setFieldByPlaceholder("Protected branches", "main,staging");
  await setFieldByPlaceholder("Optional validation commands", "pnpm test -- --pool=forks");
  await screenshot("02-build-target-form-filled");
  remember("form-filled", "passed", { targetName, branchName, acceptanceRepoUrl, acceptanceTokenEnvVar, acceptanceBaseBranch });

  await clickByText("/Create|Add|Save/i");
  await waitFor(`() => document.body.innerText.includes(${JSON.stringify(targetName)})`, 30000, "created target card appears");
  await screenshot("03-build-target-created");
  remember("create-target", "passed", { targetName });

  const afterCreate = await collectState();
  const hasSettings = /Settings|Test connection|Open Build Mode|Build Mode/i.test(afterCreate.text);
  if (!hasSettings) throw new Error("Created target did not expose settings, test connection, or Build Mode controls.");
  remember("target-card-controls-visible", "passed", { matchingButtons: afterCreate.buttons.filter((button) => /Settings|Test|Open|Build|Clone|Close/i.test(button)) });

  await setFieldByPlaceholder("https://github.com/org/repo", acceptanceRepoUrl);
  await setFieldByPlaceholder("BUILD_TARGET_VIYO", acceptanceTokenEnvVar);
  await setFieldByPlaceholder("Default base branch", acceptanceBaseBranch);
  const connectionClicked = await clickByText("/Test connection|Connection/i").catch(async () => await clickByText("/Settings/i"));
  remember("connection-control-clicked", "passed", { clicked: connectionClicked });
  await waitFor(`() => /Repository connection succeeded\.|Environment variable .* is not set\.|Repository is not accessible|invalid token|connection test failed/i.test(document.body.innerText)`, 60000, "connection-test result or graceful status text");
  const afterConnection = await collectState();
  if (!afterConnection.text.includes("Repository connection succeeded.")) {
    const resultExcerpt = afterConnection.text.match(/(Repository connection succeeded\.|Environment variable[^\n]+|Repository is not accessible[^\n]*|invalid token[^\n]*|connection test failed[^\n]*)/i)?.[0] || "no explicit connection result";
    throw new Error(`Build Target connection did not succeed for acceptance repository: ${resultExcerpt}`);
  }
  await screenshot("04-connection-test-visible");
  remember("connection-test-visible", "passed", { resultExcerpt: "Repository connection succeeded." });

  await setFieldByPlaceholder("feature/portal-task", branchName);
  const openClicked = await clickByText("/Open Build Mode|Build Mode|Open/i");
  remember("open-build-mode-clicked", "passed", { clicked: openClicked });
  await waitFor(`() => document.body.innerText.includes(${JSON.stringify(branchName)}) && /Build Mode|Branch|Files|Task folder/i.test(document.body.innerText)`, 180000, "Build Mode banner and file-tree surface");
  await new Promise((resolve) => setTimeout(resolve, 5000));
  await screenshot("05-build-mode-opened");
  const buildMode = await collectState();
  const branchDiagnostic = await waitForCleanBranchDiagnostic(targetName, branchName);
  const requiredBuildMode = ["Build Mode", branchName, "Task folder"];
  const missingBuildMode = requiredBuildMode.filter((text) => !buildMode.text.includes(text));
  if (missingBuildMode.length) throw new Error(`Missing Build Mode text: ${missingBuildMode.join(', ')}`);
  remember("build-mode-visible", "passed", { matchingButtons: buildMode.buttons.filter((button) => /Close|Cleanup|Refresh|Branch|Build|Upload/i.test(button)), branchDiagnostic, staleCloneFailureTextPresent: /clone failed|Build Branch recorded, but clone failed/i.test(buildMode.text) });

  const hasReadOnlyCue = /read-only|Read-only|no writes|preview/i.test(buildMode.text) || !buildMode.buttons.some((button) => /^Write file$|^Create folder$|^Delete$/i.test(button));
  if (!hasReadOnlyCue) throw new Error("Build Mode file tree did not appear read-only; write controls were visible without a read-only cue.");
  remember("read-only-file-tree-cue", "passed", { hasReadOnlyCue });

  const closeClicked = await clickByText("/Close Build Mode|Close/i");
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const afterClose = await collectState();
  if (!afterClose.text.includes("BUILD TARGETS")) throw new Error("Left Build Targets panel was not visible after closing Build Mode.");
  await screenshot("06-build-mode-closed");
  remember("close-build-mode", "passed", { clicked: closeClicked });

  const nonExtensionConsoleErrors = evidence.consoleErrors.filter((item) => !String(item.args || "").includes("chrome-extension"));
  const appFailedRequests = evidence.failedRequests.filter((item) => item.url?.includes(previewPrefix) || item.url?.includes("/api/trpc"));
  if (appFailedRequests.some((item) => item.status >= 500)) throw new Error(`Browser loop observed app 5xx requests: ${JSON.stringify(appFailedRequests)}`);
  remember("network-console-review", "passed", { appFailedRequests, nonExtensionConsoleErrors: nonExtensionConsoleErrors.slice(0, 20) });

  evidence.completedAt = new Date().toISOString();
  evidence.status = "passed";
} catch (error) {
  evidence.completedAt = new Date().toISOString();
  evidence.status = "failed";
  evidence.error = error instanceof Error ? error.stack || error.message : String(error);
  await screenshot("99-failure-state").catch(() => undefined);
  throw error;
} finally {
  await fs.writeFile("/home/ubuntu/section1_browser_acceptance.json", JSON.stringify(evidence, null, 2));
  cdp.close();
}

console.log(JSON.stringify({ status: evidence.status, steps: evidence.steps.map((step) => ({ step: step.step, status: step.status })), screenshots: evidence.screenshots }, null, 2));
