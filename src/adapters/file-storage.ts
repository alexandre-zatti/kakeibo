import fs from "node:fs/promises";
import path from "node:path";
import logger from "@/lib/logger";

const log = logger.child({ module: "adapters/file-storage" });

const UPLOADS_BASE = path.join(process.cwd(), "data", "uploads", "finances");

function buildFilePath(
  householdId: number,
  year: number,
  month: number,
  adapterId: number,
  filename: string
): string {
  const monthStr = `${year}-${String(month).padStart(2, "0")}`;
  const timestamp = Date.now();
  const ext = path.extname(filename) || ".bin";
  const safeName = `adapter-${adapterId}-${timestamp}${ext}`;
  return path.join(UPLOADS_BASE, String(householdId), monthStr, safeName);
}

export async function saveAttachment(
  householdId: number,
  year: number,
  month: number,
  adapterId: number,
  filename: string,
  data: Buffer
): Promise<string> {
  const filePath = buildFilePath(householdId, year, month, adapterId, filename);
  const dir = path.dirname(filePath);

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, data);

  log.info({ filePath, size: data.length }, "Saved adapter attachment");
  return filePath;
}

export async function readAttachment(filePath: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(filePath);
  } catch {
    log.warn({ filePath }, "Attachment file not found");
    return null;
  }
}

export function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
  };
  return mimeTypes[ext] ?? "application/octet-stream";
}
