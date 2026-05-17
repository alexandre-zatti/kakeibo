import assert from "node:assert/strict";
import test from "node:test";

import { runCodexRunnerImageSmoke } from "./codex-runner-smoke";

test("runCodexRunnerImageSmoke validates version, login status, and the fixed Codex smoke job", async () => {
  const calls: Array<{ url: string; method: string; authorization: string | null }> = [];

  const fetchImpl: typeof fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    calls.push({
      url: String(input),
      method: init?.method ?? "GET",
      authorization: headers.get("authorization"),
    });

    if (String(input) === "http://codex-runner:8787/codex/version") {
      return Response.json({ ok: true, version: "codex 0.130.0" });
    }

    if (String(input) === "http://codex-runner:8787/codex/login/status") {
      return Response.json({ ok: true, exitCode: 0 });
    }

    if (String(input) === "http://codex-runner:8787/codex/smoke") {
      return Response.json({
        ok: true,
        exitCode: 0,
        expectedTextMatched: true,
        usageCaptured: true,
        lastMessage: "KAKEIBO_CODEX_SMOKE_OK",
        usage: { input_tokens: 7, output_tokens: 3 },
      });
    }

    return Response.json({ ok: false, error: "unexpected call" }, { status: 500 });
  };

  const result = await runCodexRunnerImageSmoke({
    baseUrl: "http://codex-runner:8787",
    token: "secret",
    fetchImpl,
  });

  assert.equal(result.ok, true);
  assert.equal(result.stage, "complete");
  assert.equal(result.version.version, "codex 0.130.0");
  assert.equal(result.version.expectedVersionMatched, true);
  assert.equal(result.smoke.lastMessage, "KAKEIBO_CODEX_SMOKE_OK");
  assert.deepEqual(calls, [
    {
      url: "http://codex-runner:8787/codex/version",
      method: "GET",
      authorization: "Bearer secret",
    },
    {
      url: "http://codex-runner:8787/codex/login/status",
      method: "GET",
      authorization: "Bearer secret",
    },
    {
      url: "http://codex-runner:8787/codex/smoke",
      method: "POST",
      authorization: "Bearer secret",
    },
  ]);
});

test("runCodexRunnerImageSmoke fails closed when the Codex smoke response is not the expected fixed text", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    if (String(input).endsWith("/codex/version")) {
      return Response.json({ ok: true, version: "codex 0.130.0" });
    }

    if (String(input).endsWith("/codex/login/status")) {
      return Response.json({ ok: true, exitCode: 0 });
    }

    return Response.json({
      ok: true,
      exitCode: 0,
      expectedTextMatched: false,
      lastMessage: "something else",
    });
  };

  const result = await runCodexRunnerImageSmoke({
    baseUrl: "http://codex-runner:8787",
    token: "secret",
    fetchImpl,
  });

  assert.equal(result.ok, false);
  assert.equal(result.stage, "smoke");
  assert.equal(result.smoke.expectedTextMatched, false);
});

test("runCodexRunnerImageSmoke fails closed when the runner Codex CLI version is stale", async () => {
  const fetchImpl: typeof fetch = async () => {
    return Response.json({ ok: true, version: "codex 0.129.0" });
  };

  const result = await runCodexRunnerImageSmoke({
    baseUrl: "http://codex-runner:8787",
    token: "secret",
    expectedVersion: "0.130.0",
    fetchImpl,
  });

  assert.equal(result.ok, false);
  assert.equal(result.stage, "version");
  assert.equal(result.version.expectedVersion, "0.130.0");
  assert.equal(result.version.expectedVersionMatched, false);
});
