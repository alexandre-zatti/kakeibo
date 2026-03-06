import { fetchGmailBill } from "@/adapters/utils/gmail-bill-fetcher";
import { parseBillWithGemini } from "@/adapters/utils/parse-bill-with-gemini";
import { MONTH_NAMES } from "@/adapters/utils/constants";
import logger from "@/lib/logger";
import type { AdapterModule } from "../types";

const log = logger.child({ module: "adapters/modules/celesc-fatura" });

const SENDER_EMAIL = "celesc-fatura@celesc.com.br";

interface CelescConfig {
  categoryId: number;
}

export const celescFatura: AdapterModule = {
  label: "Celesc Fatura",
  description: "Importa fatura de energia elétrica da Celesc via Gmail.",

  async execute(context) {
    const config = context.adapter.config as unknown as CelescConfig;

    if (!config?.categoryId) {
      return { success: false, error: "Categoria não configurada no adaptador.", actions: [] };
    }

    const { year, month } = context;
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const prevMonthStr = String(prevMonth).padStart(2, "0");
    const nextMonthStr = String(nextMonth).padStart(2, "0");

    // Search from the 1st of the prior month — bill usually arrives around the 28th
    const query = `from:${SENDER_EMAIL} after:${prevYear}/${prevMonthStr}/01 before:${nextYear}/${nextMonthStr}/01 has:attachment`;

    let bill;
    try {
      bill = await fetchGmailBill(context.householdId, query);
    } catch (err) {
      return { success: false, error: (err as Error).message, actions: [] };
    }

    if (!bill) {
      log.info({ year, month }, "No Celesc bill found for this month");
      return { success: true, actions: [] };
    }

    let extraction;
    try {
      extraction = await parseBillWithGemini(bill.pdfBuffer, bill.emailBody);
    } catch (err) {
      return {
        success: false,
        error: `Falha ao extrair valor da fatura: ${(err as Error).message}`,
        actions: [],
      };
    }
    const amount = extraction.totalAmount;

    const description = `Celesc - Fatura ${MONTH_NAMES[month - 1]}/${year}`;
    const filename = bill.filename || `celesc-fatura-${year}-${String(month).padStart(2, "0")}.pdf`;

    log.info({ amount, description, messageId: bill.messageId }, "Celesc bill processed");

    const attachment = { filename, mimeType: "application/pdf" as const, data: bill.pdfBuffer };

    if (context.targetExpenseId) {
      return {
        success: true,
        actions: [
          {
            type: "update_expense" as const,
            expenseId: context.targetExpenseId,
            data: { amount, description, attachment },
          },
        ],
      };
    }

    return {
      success: true,
      actions: [
        {
          type: "create_expense" as const,
          data: { description, amount, categoryId: config.categoryId, attachment },
        },
      ],
    };
  },
};
