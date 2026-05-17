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

test("WahaClient downloads WAHA localhost media URLs through the configured base URL", async (t) => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; apiKey: string | null }> = [];

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    calls.push({
      url: String(input),
      apiKey: headers.get("X-Api-Key"),
    });

    return new Response("image-bytes", {
      headers: { "content-type": "image/jpeg" },
    });
  };

  const client = new WahaClient("http://waha:3000", "secret", "default");

  const media = await client.downloadMedia(
    "http://localhost:3000/api/files/receipt.jpg"
  );

  assert.deepEqual(calls, [
    {
      url: "http://waha:3000/api/files/receipt.jpg",
      apiKey: "secret",
    },
  ]);
  assert.equal(media.contentType, "image/jpeg");
  assert.equal(media.buffer.toString("utf8"), "image-bytes");
});
