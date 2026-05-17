import test from "node:test";
import assert from "node:assert/strict";

import { WahaClient } from "./waha-client";

test("WahaClient starts a stopped persisted session and waits until it is working", async (t) => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; method: string }> = [];
  let sessionReads = 0;

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({ url, method });

    if (url === "http://waha:3000/api/sessions/default" && method === "GET") {
      sessionReads += 1;
      return Response.json({
        name: "default",
        status: sessionReads === 1 ? "STOPPED" : "WORKING",
      });
    }

    if (url === "http://waha:3000/api/sessions/default/start" && method === "POST") {
      return Response.json({ name: "default", status: "STARTING" }, { status: 201 });
    }

    return Response.json({ message: "unexpected call" }, { status: 500 });
  };

  const client = new WahaClient("http://waha:3000", "secret", "default");

  const session = await client.ensureSessionStarted({
    intervalMs: 1,
    timeoutMs: 100,
  });

  assert.equal(session.status, "WORKING");
  assert.deepEqual(calls, [
    { url: "http://waha:3000/api/sessions/default", method: "GET" },
    { url: "http://waha:3000/api/sessions/default/start", method: "POST" },
    { url: "http://waha:3000/api/sessions/default", method: "GET" },
  ]);
});
