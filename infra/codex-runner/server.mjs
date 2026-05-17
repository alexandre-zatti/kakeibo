import crypto from "node:crypto";
import http from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const port = Number(process.env.PORT || 8787);
const token = process.env.CODEX_RUNNER_TOKEN || "";
const workspace = process.env.CODEX_WORKSPACE || "/workspace";
const defaultModel = process.env.CODEX_DEFAULT_MODEL || "gpt-5.4";
const defaultSandbox = process.env.CODEX_DEFAULT_SANDBOX || "read-only";
const jobTimeoutMs = Number(process.env.CODEX_JOB_TIMEOUT_MS || 300_000);
const maxPromptBytes = Number(process.env.CODEX_MAX_PROMPT_BYTES || 200_000);
const maxOutputBytes = Number(process.env.CODEX_MAX_OUTPUT_BYTES || 2_000_000);
const codexHome = process.env.CODEX_HOME || "/home/codex/.codex";
const smokeExpectedText = "KAKEIBO_CODEX_SMOKE_OK";
const smokePrompt = [
  "This is a deployment smoke test for the Kakeibo Codex runner.",
  `Reply with exactly: ${smokeExpectedText}`,
  "Do not include any other text.",
].join("\n");
const smokeTimeoutMs = Number(
  process.env.CODEX_SMOKE_TIMEOUT_MS || Math.min(jobTimeoutMs, 120_000)
);

async function ensureCodexConfig() {
  await fs.mkdir(codexHome, { recursive: true });

  const configPath = path.join(codexHome, "config.toml");
  try {
    await fs.access(configPath);
  } catch {
    await fs.writeFile(
      configPath,
      [
        'forced_login_method = "chatgpt"',
        'cli_auth_credentials_store = "file"',
        'approval_policy = "never"',
        'sandbox_mode = "read-only"',
        "",
      ].join("\n"),
      { mode: 0o600 }
    );
  }
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function timingSafeEqualString(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

function isAuthorized(req) {
  if (!token) {
    return false;
  }

  const header = req.headers.authorization || "";
  const bearer = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  const apiToken = req.headers["x-runner-token"] || "";
  const candidate = bearer || apiToken;

  return typeof candidate === "string" && timingSafeEqualString(candidate, token);
}

async function readJsonBody(req) {
  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxPromptBytes) {
      throw Object.assign(new Error("Request body too large"), { statusCode: 413 });
    }
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("Invalid JSON body"), { statusCode: 400 });
  }
}

function run(command, args, { input = "", timeoutMs = jobTimeoutMs } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: workspace,
      env: {
        ...process.env,
        CODEX_HOME: codexHome,
        HOME: process.env.HOME || "/home/codex",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let truncated = false;

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      if (stdout.length + chunk.length > maxOutputBytes) {
        truncated = true;
        child.kill("SIGKILL");
        return;
      }
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk) => {
      if (stderr.length + chunk.length > maxOutputBytes) {
        truncated = true;
        child.kill("SIGKILL");
        return;
      }
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        exitCode: 127,
        stdout,
        stderr: `${stderr}${error.message}`,
        truncated,
      });
    });

    child.on("close", (exitCode, signal) => {
      clearTimeout(timer);
      resolve({ exitCode, signal, stdout, stderr, truncated });
    });

    child.stdin.end(input);
  });
}

function extractCodexSummary(stdout) {
  const lines = stdout.split(/\r?\n/).filter(Boolean);
  let lastMessage = null;
  let usage = null;

  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      if (event.type === "item.completed" && event.item?.type === "agent_message") {
        lastMessage = event.item.text ?? null;
      }
      if (event.type === "turn.completed") {
        usage = event.usage ?? null;
      }
    } catch {
      // Ignore non-JSON lines from older CLI versions or warnings.
    }
  }

  return { lastMessage, usage };
}

async function handleAuthStatus(res) {
  const result = await run("codex", ["login", "status"], { timeoutMs: 30_000 });
  json(res, result.exitCode === 0 ? 200 : 503, {
    ok: result.exitCode === 0,
    exitCode: result.exitCode,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  });
}

async function handleVersion(res) {
  const result = await run("codex", ["--version"], { timeoutMs: 30_000 });
  json(res, result.exitCode === 0 ? 200 : 503, {
    ok: result.exitCode === 0,
    version: result.stdout.trim() || result.stderr.trim(),
  });
}

function buildCodexExecArgs({ model, sandbox }) {
  return [
    "exec",
    "--json",
    "--skip-git-repo-check",
    "--sandbox",
    sandbox,
    "--model",
    model,
    "--cd",
    workspace,
    "-",
  ];
}

async function runCodexExec(
  prompt,
  { model = defaultModel, sandbox = defaultSandbox, timeoutMs = jobTimeoutMs } = {}
) {
  const args = buildCodexExecArgs({ model, sandbox });

  return run("codex", args, {
    input: prompt,
    timeoutMs,
  });
}

async function handleSmoke(res) {
  const result = await runCodexExec(smokePrompt, {
    sandbox: "read-only",
    timeoutMs: smokeTimeoutMs,
  });
  const summary = extractCodexSummary(result.stdout);
  const expectedTextMatched =
    typeof summary.lastMessage === "string" && summary.lastMessage.trim() === smokeExpectedText;
  const usageCaptured = summary.usage !== null;
  const ok = result.exitCode === 0 && expectedTextMatched && usageCaptured;

  json(res, ok ? 200 : 500, {
    ok,
    exitCode: result.exitCode,
    signal: result.signal ?? null,
    truncated: result.truncated,
    expectedTextMatched,
    expectedText: smokeExpectedText,
    usageCaptured,
    lastMessage: summary.lastMessage,
    usage: summary.usage,
    stderr: result.stderr.trim(),
  });
}

async function handleJob(req, res) {
  const body = await readJsonBody(req);
  const prompt = body.prompt;

  if (typeof prompt !== "string" || !prompt.trim()) {
    json(res, 400, { ok: false, error: "Body must include a non-empty prompt string." });
    return;
  }

  const sandbox = body.sandbox || defaultSandbox;
  if (!["read-only", "workspace-write"].includes(sandbox)) {
    json(res, 400, { ok: false, error: "sandbox must be read-only or workspace-write." });
    return;
  }

  const model = typeof body.model === "string" && body.model.trim() ? body.model : defaultModel;
  const result = await runCodexExec(prompt, {
    model,
    sandbox,
    timeoutMs: Number(body.timeoutMs || jobTimeoutMs),
  });
  const summary = extractCodexSummary(result.stdout);

  json(res, result.exitCode === 0 ? 200 : 500, {
    ok: result.exitCode === 0,
    exitCode: result.exitCode,
    signal: result.signal ?? null,
    truncated: result.truncated,
    ...summary,
    stdout: result.stdout,
    stderr: result.stderr,
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "GET" && url.pathname === "/health") {
      json(res, 200, { ok: true, service: "codex-runner" });
      return;
    }

    if (!isAuthorized(req)) {
      json(res, 401, { ok: false, error: "Unauthorized" });
      return;
    }

    if (req.method === "GET" && url.pathname === "/codex/login/status") {
      await handleAuthStatus(res);
      return;
    }

    if (req.method === "GET" && url.pathname === "/codex/version") {
      await handleVersion(res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/codex/smoke") {
      await handleSmoke(res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/jobs") {
      await handleJob(req, res);
      return;
    }

    json(res, 404, { ok: false, error: "Not found" });
  } catch (error) {
    json(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "Internal server error",
    });
  }
});

await ensureCodexConfig();

server.listen(port, "0.0.0.0", () => {
  console.log(`codex-runner listening on ${port}`);
});
