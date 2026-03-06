import { getGmailClient } from "@/lib/google";
import logger from "@/lib/logger";

const log = logger.child({ module: "adapters/utils/gmail-bill-fetcher" });

export interface GmailBillResult {
  pdfBuffer: Buffer;
  filename: string;
  messageId: string;
  emailBody: string;
}

/**
 * Searches Gmail for a bill matching the given query and downloads the PDF attachment.
 *
 * Returns `null` if no matching email is found (not an error — bill may not exist yet).
 * Throws if Google is not connected or the email has no downloadable PDF.
 */
export async function fetchGmailBill(
  householdId: number,
  query: string
): Promise<GmailBillResult | null> {
  const gmail = await getGmailClient(householdId);

  log.info({ query, householdId }, "Searching Gmail for bill");

  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults: 1,
  });

  const messages = listRes.data.messages;
  if (!messages || messages.length === 0) {
    log.info({ query }, "No matching email found");
    return null;
  }

  const messageId = messages[0].id!;

  const msgRes = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const parts = msgRes.data.payload?.parts ?? [];
  const pdfPart = parts.find(
    (p) => p.mimeType === "application/pdf" || p.filename?.toLowerCase().endsWith(".pdf")
  );

  if (!pdfPart?.body?.attachmentId) {
    throw new Error("Email encontrado mas sem anexo PDF.");
  }

  const attachmentRes = await gmail.users.messages.attachments.get({
    userId: "me",
    messageId,
    id: pdfPart.body.attachmentId,
  });

  const pdfData = attachmentRes.data.data;
  if (!pdfData) {
    throw new Error("Não foi possível baixar o anexo PDF.");
  }

  const pdfBuffer = Buffer.from(pdfData, "base64url");
  const filename = pdfPart.filename || "attachment.pdf";

  // Extract email body text for additional context
  const textPart = parts.find((p) => p.mimeType === "text/plain");
  let emailBody = "";
  if (textPart?.body?.data) {
    emailBody = Buffer.from(textPart.body.data, "base64url").toString("utf-8");
  }

  log.info({ messageId, filename, size: pdfBuffer.length }, "PDF attachment downloaded");

  return { pdfBuffer, filename, messageId, emailBody };
}
