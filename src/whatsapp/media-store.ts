import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const extensionByMimeType: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export function isSupportedGroceryImage(mimetype: string | null | undefined): boolean {
  return Boolean(mimetype && extensionByMimeType[mimetype]);
}

export async function storeTemporaryMedia(input: {
  dataRoot: string;
  commandRunId: number;
  buffer: Buffer;
  mimetype: string;
}): Promise<string> {
  const extension = extensionByMimeType[input.mimetype] ?? ".bin";
  const relativePath = path.posix.join(
    "whatsapp",
    "grocery",
    String(input.commandRunId),
    `receipt${extension}`
  );
  const absolutePath = path.join(input.dataRoot, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, input.buffer);
  return absolutePath;
}

export async function deleteTemporaryMedia(
  mediaPath: string | null | undefined,
  dataRoot = "/app/data"
): Promise<void> {
  if (!mediaPath) return;

  const safeRoot = path.resolve(dataRoot, "whatsapp");
  const safeMediaPath = path.resolve(mediaPath);
  if (!safeMediaPath.startsWith(`${safeRoot}${path.sep}`)) return;

  await rm(mediaPath, { force: true });
  await rm(path.dirname(mediaPath), { force: true, recursive: true });
}
