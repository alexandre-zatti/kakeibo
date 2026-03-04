import { getGmailClient } from "@/lib/google";
import { parseCelescPdf } from "@/adapters/utils/parse-celesc-pdf";
import logger from "@/lib/logger";
import type { AdapterModule } from "../types";

const log = logger.child({ module: "adapters/modules/celesc-fatura" });

const SENDER_EMAIL = "celesc-fatura@celesc.com.br";

const MONTH_NAMES = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

interface CelescConfig {
  categoryId: number;
}

export const celescFatura: AdapterModule = {
  label: "Celesc Fatura",
  description: "Importa fatura de energia elétrica da Celesc via Gmail.",

  async execute(context) {
    const config = context.adapter.config as unknown as CelescConfig;

    if (!config?.categoryId) {
      return { success: false, error: "Categoria não configurada no adaptador." };
    }

    // Build Gmail search query for the budget month
    const { year, month } = context;
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const prevMonthStr = String(prevMonth).padStart(2, "0");
    const nextMonthStr = String(nextMonth).padStart(2, "0");

    // Search from the 1st of the prior month — bill usually arrives around the 28th
    const query = `from:${SENDER_EMAIL} after:${prevYear}/${prevMonthStr}/01 before:${nextYear}/${nextMonthStr}/01 has:attachment`;

    log.info({ query, householdId: context.householdId }, "Searching Gmail for Celesc bill");

    // Get Gmail client (requires Google OAuth connection)
    let gmail;
    try {
      gmail = await getGmailClient(context.householdId);
    } catch {
      return { success: false, error: "Google não conectado. Conecte na página de adaptadores." };
    }

    // Search for emails
    const listRes = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: 1,
    });

    const messages = listRes.data.messages;
    if (!messages || messages.length === 0) {
      log.info({ year, month }, "No Celesc bill found for this month");
      return { success: true }; // No bill found — not an error
    }

    const messageId = messages[0].id!;

    // Get full message with payload
    const msgRes = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    // Find the PDF attachment part
    const parts = msgRes.data.payload?.parts ?? [];
    const pdfPart = parts.find(
      (p) => p.mimeType === "application/pdf" || p.filename?.toLowerCase().endsWith(".pdf")
    );

    if (!pdfPart?.body?.attachmentId) {
      return { success: false, error: "Email encontrado mas sem anexo PDF." };
    }

    // Download the PDF attachment
    const attachmentRes = await gmail.users.messages.attachments.get({
      userId: "me",
      messageId,
      id: pdfPart.body.attachmentId,
    });

    const pdfData = attachmentRes.data.data;
    if (!pdfData) {
      return { success: false, error: "Não foi possível baixar o anexo PDF." };
    }

    // Gmail returns base64url-encoded data
    const pdfBuffer = Buffer.from(pdfData, "base64url");

    // Parse the PDF to extract the bill amount
    const amount = await parseCelescPdf(pdfBuffer);
    if (amount === null) {
      return { success: false, error: "Não foi possível extrair o valor da fatura do PDF." };
    }

    const description = `Celesc - Fatura ${MONTH_NAMES[month - 1]}/${year}`;
    const filename = pdfPart.filename || `celesc-fatura-${year}-${String(month).padStart(2, "0")}.pdf`;

    log.info({ amount, description, messageId }, "Celesc bill processed successfully");

    return {
      success: true,
      expense: {
        description,
        amount,
        categoryId: config.categoryId,
        attachment: {
          filename,
          mimeType: "application/pdf",
          data: pdfBuffer,
        },
      },
    };
  },
};
