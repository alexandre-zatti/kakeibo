import { extractBillData } from "@/lib/gemini";
import logger from "@/lib/logger";

const log = logger.child({ module: "adapters/utils/parse-bill-with-gemini" });

export interface BillExtractionResult {
  totalAmount: number;
  dueDate: string | null;
  description: string | null;
}

/**
 * Parses a bill PDF using Gemini AI.
 * Sends the PDF directly to Gemini as application/pdf inline data.
 */
export async function parseBillWithGemini(
  pdfBuffer: Buffer,
  emailBody?: string
): Promise<BillExtractionResult> {
  const pdfBase64 = pdfBuffer.toString("base64");

  log.info("Sending bill PDF to Gemini for analysis");
  const result = await extractBillData(pdfBase64, emailBody);

  if (
    typeof result.totalAmount !== "number" ||
    isNaN(result.totalAmount) ||
    result.totalAmount <= 0
  ) {
    throw new Error(`Invalid amount extracted: ${result.totalAmount}`);
  }

  log.info(
    { amount: result.totalAmount, dueDate: result.dueDate },
    "Bill parsed successfully with Gemini"
  );

  return result;
}
