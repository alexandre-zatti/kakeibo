import { fetchGmailBill } from "@/adapters/utils/gmail-bill-fetcher";
import { parseBillWithGemini } from "@/adapters/utils/parse-bill-with-gemini";
import { MONTH_NAMES } from "@/adapters/utils/constants";
import logger from "@/lib/logger";
import type { AdapterModule } from "../types";

const log = logger.child({ module: "adapters/modules/condominio-fatura" });

const SENDER_EMAIL = "envio@simob.com.br";

interface CondominioConfig {
  categoryId: number;
}

export const condominioFatura: AdapterModule = {
  label: "Condomínio Fatura",
  description: "Importa boleto de condomínio da Florença Imobiliária via Gmail.",

  async execute(context) {
    const config = context.adapter.config as unknown as CondominioConfig;

    if (!config?.categoryId) {
      return { success: false, error: "Categoria não configurada no adaptador.", actions: [] };
    }

    const { year, month } = context;
    const monthStr = String(month).padStart(2, "0");
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonthStr = String(nextMonth).padStart(2, "0");

    // Bill arrives on the 2nd of the budget month (e.g., March bill arrives March 2).
    // The email says "Fatura 02/2026" (prior month's competência) but we assign it
    // to the month it arrives in, since that's when it's due and paid.
    const query = `from:${SENDER_EMAIL} after:${year}/${monthStr}/01 before:${nextYear}/${nextMonthStr}/01 has:attachment`;

    let bill;
    try {
      bill = await fetchGmailBill(context.householdId, query);
    } catch (err) {
      return { success: false, error: (err as Error).message, actions: [] };
    }

    if (!bill) {
      log.info({ year, month }, "No condomínio bill found for this month");
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

    const description = `Condomínio - Fatura ${MONTH_NAMES[month - 1]}/${year}`;
    const filename = bill.filename || `condominio-fatura-${year}-${monthStr}.pdf`;

    log.info({ amount, description, messageId: bill.messageId }, "Condomínio bill processed");

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
