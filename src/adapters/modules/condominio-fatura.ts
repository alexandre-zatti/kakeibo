import { fetchGmailBill } from "@/adapters/utils/gmail-bill-fetcher";
import { parseBoleto } from "@/adapters/utils/parse-boleto-pdf";
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
      return { success: false, error: "Categoria não configurada no adaptador." };
    }

    const { year, month } = context;
    const monthStr = String(month).padStart(2, "0");

    // The email body contains "Fatura MM/YYYY" matching the budget month.
    // Bill arrives on the 2nd of the next month, so we also search into month+1.
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonthStr = String(nextMonth).padStart(2, "0");

    const query = `from:${SENDER_EMAIL} "Fatura ${monthStr}/${year}" after:${year}/${monthStr}/01 before:${nextYear}/${nextMonthStr}/10 has:attachment`;

    let bill;
    try {
      bill = await fetchGmailBill(context.householdId, query);
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }

    if (!bill) {
      log.info({ year, month }, "No condomínio bill found for this month");
      return { success: true };
    }

    const amount = await parseBoleto(bill.pdfBuffer);
    if (amount === null) {
      return { success: false, error: "Não foi possível extrair o valor da fatura do PDF." };
    }

    const description = `Condomínio - Fatura ${MONTH_NAMES[month - 1]}/${year}`;
    const filename = bill.filename || `condominio-fatura-${year}-${monthStr}.pdf`;

    log.info({ amount, description, messageId: bill.messageId }, "Condomínio bill processed");

    return {
      success: true,
      expense: {
        description,
        amount,
        categoryId: config.categoryId,
        attachment: {
          filename,
          mimeType: "application/pdf",
          data: bill.pdfBuffer,
        },
      },
    };
  },
};
