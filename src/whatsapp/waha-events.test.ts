import test from "node:test";
import assert from "node:assert/strict";

import { buildWahaWebSocketUrl } from "./waha-events";

test("buildWahaWebSocketUrl points to the internal WAHA websocket event stream", () => {
  assert.equal(
    buildWahaWebSocketUrl({
      baseUrl: "http://waha:3000",
      apiKey: "secret",
      session: "*",
      events: ["message", "message.any", "message.reaction"],
    }),
    "ws://waha:3000/ws?x-api-key=secret&session=*&events=message&events=message.any&events=message.reaction"
  );
});
