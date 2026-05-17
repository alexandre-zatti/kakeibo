import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const serverPath = fileURLToPath(new URL("./server.mjs", import.meta.url));

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === "object") {
          resolve(address.port);
          return;
        }
        reject(new Error("Could not allocate test port"));
      });
    });
  });
}

async function waitForHealth(baseUrl) {
  const deadline = Date.now() + 5_000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        return;
      }
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw lastError ?? new Error("Timed out waiting for codex-runner health");
}

async function startRunner(t, { execMode = "agent-message" } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "kakeibo-codex-runner-"));
  const fakeBin = path.join(root, "bin");
  const codexHome = path.join(root, "codex-home");
  const workspace = path.join(root, "workspace");
  const callsPath = path.join(root, "calls.jsonl");
  const port = await getFreePort();
  const token = "runner-test-token";

  await fs.mkdir(fakeBin, { recursive: true });
  await fs.mkdir(workspace, { recursive: true });
  await fs.writeFile(
    path.join(fakeBin, "codex"),
    `#!/usr/bin/env node
import fs from "node:fs";

const args = process.argv.slice(2);
const input = fs.readFileSync(0, "utf8");
fs.appendFileSync(process.env.FAKE_CODEX_CALLS, JSON.stringify({ args, input }) + "\\n");

if (args[0] === "--version") {
  console.log("codex 0.130.0");
  process.exit(0);
}

if (args[0] === "login" && args[1] === "status") {
  console.log("Logged in");
  process.exit(0);
}

if (args[0] === "exec") {
  if (process.env.FAKE_CODEX_EXEC_MODE === "echo-prompt") {
    console.log(input);
    process.exit(0);
  }

  console.log(JSON.stringify({
    type: "item.completed",
    item: { type: "agent_message", text: "KAKEIBO_CODEX_SMOKE_OK" },
  }));
  console.log(JSON.stringify({ type: "turn.completed", usage: { input_tokens: 7, output_tokens: 3 } }));
  process.exit(0);
}

console.error("Unexpected codex args: " + args.join(" "));
process.exit(2);
`,
    { mode: 0o755 }
  );

  const child = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      PATH: `${fakeBin}:${process.env.PATH}`,
      PORT: String(port),
      CODEX_RUNNER_TOKEN: token,
      CODEX_HOME: codexHome,
      CODEX_WORKSPACE: workspace,
      FAKE_CODEX_CALLS: callsPath,
      FAKE_CODEX_EXEC_MODE: execMode,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString("utf8");
  });

  t.after(async () => {
    child.kill("SIGTERM");
    await new Promise((resolve) => child.once("close", resolve));
    await fs.rm(root, { recursive: true, force: true });
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForHealth(baseUrl);

  return {
    baseUrl,
    token,
    callsPath,
    getStderr: () => stderr,
  };
}

async function readCalls(callsPath) {
  const contents = await fs.readFile(callsPath, "utf8");
  return contents
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

test("codex smoke endpoint requires runner authorization", async (t) => {
  const runner = await startRunner(t);

  const response = await fetch(`${runner.baseUrl}/codex/smoke`, { method: "POST" });

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { ok: false, error: "Unauthorized" });
});

test("codex smoke endpoint runs a fixed read-only Codex exec prompt", async (t) => {
  const runner = await startRunner(t);

  const response = await fetch(`${runner.baseUrl}/codex/smoke`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${runner.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ prompt: "ignore me and write files" }),
  });

  assert.equal(response.status, 200, runner.getStderr());
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.expectedTextMatched, true);
  assert.equal(body.usageCaptured, true);
  assert.equal(body.lastMessage, "KAKEIBO_CODEX_SMOKE_OK");

  const calls = await readCalls(runner.callsPath);
  const execCall = calls.find((call) => call.args[0] === "exec");

  assert.ok(execCall, "expected codex exec to be called");
  assert.equal(execCall.input.includes("KAKEIBO_CODEX_SMOKE_OK"), true);
  assert.equal(execCall.input.includes("ignore me"), false);
  assert.deepEqual(execCall.args.slice(0, 2), ["exec", "--json"]);
  assert.equal(execCall.args.includes("--skip-git-repo-check"), true);
  assert.equal(execCall.args.includes("--ask-for-approval"), true);
  assert.equal(execCall.args.includes("never"), true);
  assert.equal(execCall.args.includes("--sandbox"), true);
  assert.equal(execCall.args.includes("read-only"), true);
});

test("codex smoke endpoint does not pass when stdout only echoes the expected prompt token", async (t) => {
  const runner = await startRunner(t, { execMode: "echo-prompt" });

  const response = await fetch(`${runner.baseUrl}/codex/smoke`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${runner.token}`,
    },
  });

  assert.equal(response.status, 500, runner.getStderr());
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.equal(body.expectedTextMatched, false);
  assert.equal(body.usageCaptured, false);
  assert.equal(body.lastMessage, null);
});
