import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { deleteTemporaryMedia, storeTemporaryMedia } from "@/whatsapp/media-store";

test("temporary grocery media is stored under the configured data root and removable", async () => {
  const dataRoot = await mkdtemp(path.join(tmpdir(), "kakeibo-media-"));

  try {
    const mediaPath = await storeTemporaryMedia({
      dataRoot,
      commandRunId: 123,
      buffer: Buffer.from("receipt"),
      mimetype: "image/jpeg",
    });

    assert.equal(
      mediaPath,
      path.join(dataRoot, "whatsapp", "grocery", "123", "receipt.jpg")
    );
    await access(mediaPath);

    await deleteTemporaryMedia(mediaPath, dataRoot);
    await assert.rejects(access(mediaPath));
  } finally {
    await rm(dataRoot, { recursive: true, force: true });
  }
});
