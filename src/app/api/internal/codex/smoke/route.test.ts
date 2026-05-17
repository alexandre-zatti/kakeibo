import assert from "node:assert/strict";
import test from "node:test";

import { POST } from "./route";

function restoreEnv(
  snapshot: Pick<
    NodeJS.ProcessEnv,
    | "KAKEIBO_INTERNAL_WEBHOOK_SECRET"
    | "CODEX_RUNNER_BASE_URL"
    | "CODEX_RUNNER_TOKEN"
    | "CODEX_RUNNER_EXPECTED_VERSION"
  >
) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

test("internal Codex smoke route rejects unauthenticated requests before reaching the runner", async (t) => {
  const originalFetch = globalThis.fetch;
  const envSnapshot = {
    KAKEIBO_INTERNAL_WEBHOOK_SECRET: process.env.KAKEIBO_INTERNAL_WEBHOOK_SECRET,
    CODEX_RUNNER_BASE_URL: process.env.CODEX_RUNNER_BASE_URL,
    CODEX_RUNNER_TOKEN: process.env.CODEX_RUNNER_TOKEN,
    CODEX_RUNNER_EXPECTED_VERSION: process.env.CODEX_RUNNER_EXPECTED_VERSION,
  };
  let fetchCalled = false;

  t.after(() => {
    globalThis.fetch = originalFetch;
    restoreEnv(envSnapshot);
  });

  process.env.KAKEIBO_INTERNAL_WEBHOOK_SECRET = "internal-secret";
  globalThis.fetch = async () => {
    fetchCalled = true;
    return Response.json({ ok: false }, { status: 500 });
  };

  const response = await POST(
    new Request("https://kakeibo.zatti.tech/api/internal/codex/smoke", {
      method: "POST",
    }) as never
  );

  assert.equal(response.status, 401);
  assert.equal(fetchCalled, false);
});

test("internal Codex smoke route reaches only the fixed runner smoke path for authorized callers", async (t) => {
  const originalFetch = globalThis.fetch;
  const envSnapshot = {
    KAKEIBO_INTERNAL_WEBHOOK_SECRET: process.env.KAKEIBO_INTERNAL_WEBHOOK_SECRET,
    CODEX_RUNNER_BASE_URL: process.env.CODEX_RUNNER_BASE_URL,
    CODEX_RUNNER_TOKEN: process.env.CODEX_RUNNER_TOKEN,
    CODEX_RUNNER_EXPECTED_VERSION: process.env.CODEX_RUNNER_EXPECTED_VERSION,
  };
  const calls: Array<{ url: string; method: string; body: BodyInit | null | undefined }> = [];

  t.after(() => {
    globalThis.fetch = originalFetch;
    restoreEnv(envSnapshot);
  });

  process.env.KAKEIBO_INTERNAL_WEBHOOK_SECRET = "internal-secret";
  process.env.CODEX_RUNNER_BASE_URL = "http://codex-runner:8787";
  process.env.CODEX_RUNNER_TOKEN = "runner-token";
  process.env.CODEX_RUNNER_EXPECTED_VERSION = "0.130.0";

  globalThis.fetch = async (input, init) => {
    calls.push({
      url: String(input),
      method: init?.method ?? "GET",
      body: init?.body,
    });

    if (String(input).endsWith("/codex/version")) {
      return Response.json({ ok: true, version: "codex 0.130.0" });
    }

    if (String(input).endsWith("/codex/login/status")) {
      return Response.json({ ok: true, exitCode: 0 });
    }

    return Response.json({
      ok: true,
      exitCode: 0,
      expectedTextMatched: true,
      usageCaptured: true,
      lastMessage: "KAKEIBO_CODEX_SMOKE_OK",
    });
  };

  const response = await POST(
    new Request("https://kakeibo.zatti.tech/api/internal/codex/smoke", {
      method: "POST",
      headers: {
        authorization: "Bearer internal-secret",
        "content-type": "application/json",
      },
      body: JSON.stringify({ prompt: "try to run a different public prompt" }),
    }) as never
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.deepEqual(calls, [
    { url: "http://codex-runner:8787/codex/version", method: "GET", body: undefined },
    {
      url: "http://codex-runner:8787/codex/login/status",
      method: "GET",
      body: undefined,
    },
    { url: "http://codex-runner:8787/codex/smoke", method: "POST", body: undefined },
  ]);
});
