import test from "node:test";
import assert from "node:assert/strict";

import { normalizeWahaEvent } from "./events";

test("normalizeWahaEvent extracts command messages for the configured chat", () => {
  const event = normalizeWahaEvent(
    {
      event: "message.any",
      session: "default",
      payload: {
        id: "false_120@g.us_ABC",
        from: "120@g.us",
        to: "5511999999999@c.us",
        participant: "5511999999999@c.us",
        body: "/new-grocery angeloni",
        fromMe: false,
        hasMedia: true,
        media: {
          url: "http://waha:3000/api/files/receipt.jpg",
          mimetype: "image/jpeg",
          filename: "receipt.jpg",
        },
      },
    },
    { chatId: "120@g.us", session: "default" }
  );

  assert.deepEqual(event, {
    type: "message",
    messageId: "false_120@g.us_ABC",
    chatId: "120@g.us",
    session: "default",
    body: "/new-grocery angeloni",
    fromMe: false,
    source: null,
    replyToMessageId: null,
    media: {
      url: "http://waha:3000/api/files/receipt.jpg",
      mimetype: "image/jpeg",
      filename: "receipt.jpg",
    },
  });
});

test("normalizeWahaEvent ignores messages outside the configured chat", () => {
  assert.equal(
    normalizeWahaEvent(
      {
        event: "message.any",
        session: "default",
        payload: { id: "1", from: "other@g.us", body: "/help" },
      },
      { chatId: "120@g.us", session: "default" }
    ),
    null
  );
});

test("normalizeWahaEvent extracts reaction target ids", () => {
  const event = normalizeWahaEvent(
    {
      event: "message.reaction",
      session: "default",
      payload: {
        id: "reaction-1",
        from: "120@g.us",
        reaction: {
          text: "✅",
          messageId: "true_120@g.us_PROPOSAL",
        },
      },
    },
    { chatId: "120@g.us", session: "default" }
  );

  assert.deepEqual(event, {
    type: "reaction",
    messageId: "reaction-1",
    chatId: "120@g.us",
    session: "default",
    emoji: "✅",
    targetMessageId: "true_120@g.us_PROPOSAL",
    source: null,
  });
});
