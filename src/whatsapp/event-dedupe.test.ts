import test from "node:test";
import assert from "node:assert/strict";

import { RecentWahaEventDedupe } from "./event-dedupe";

test("RecentWahaEventDedupe accepts a WAHA message only once inside the TTL", () => {
  let now = 1_000;
  const dedupe = new RecentWahaEventDedupe({
    ttlMs: 10_000,
    now: () => now,
  });

  const event = {
    type: "message" as const,
    messageId: "true_120@g.us_ABC",
    chatId: "120@g.us",
    session: "default",
    body: "/help",
    fromMe: true,
    source: "app",
    replyToMessageId: null,
    media: null,
  };

  assert.equal(dedupe.accept(event), true);
  assert.equal(dedupe.accept(event), false);

  now += 10_001;

  assert.equal(dedupe.accept(event), true);
});
