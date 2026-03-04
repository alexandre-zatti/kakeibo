import { extractText } from "unpdf";
import logger from "@/lib/logger";

const log = logger.child({ module: "adapters/utils/parse-boleto-pdf" });

/**
 * Parses a Brazilian monetary value string (e.g. "1.234,56") into a number (1234.56).
 */
function parseBrazilianNumber(value: string): number | null {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(normalized);
  return isNaN(num) ? null : num;
}

/**
 * Extracts the bill amount from a Brazilian boleto/bill PDF text.
 * Tries multiple patterns common in Brazilian utility bills.
 */
export function extractAmountFromText(text: string): number | null {
  // Pattern 1: "VALOR A PAGAR" or "VALOR TOTAL" followed by an amount
  const valorPagarMatch = text.match(
    /VALOR\s+(?:A\s+)?(?:PAGAR|TOTAL)[^\d]*?(\d{1,3}(?:\.\d{3})*,\d{2})/i
  );
  if (valorPagarMatch) {
    return parseBrazilianNumber(valorPagarMatch[1]);
  }

  // Pattern 2: "Total a Pagar (R$)" followed by optional UC number then amount
  const totalPagarR$Match = text.match(
    /TOTAL\s+A\s+PAGAR\s*\(R\$\)\s*\d*\s+(\d{1,3}(?:\.\d{3})*,\d{2})/i
  );
  if (totalPagarR$Match) {
    return parseBrazilianNumber(totalPagarR$Match[1]);
  }

  // Pattern 3: "TOTAL A PAGAR" followed by an amount
  const totalPagarMatch = text.match(/TOTAL\s+A\s+PAGAR[^\d]*?(\d{1,3}(?:\.\d{3})*,\d{2})/i);
  if (totalPagarMatch) {
    return parseBrazilianNumber(totalPagarMatch[1]);
  }

  // Pattern 4: "R$" followed by amount, or amount followed by "R$" (reversed in some PDFs)
  const amounts = [
    ...text.matchAll(/R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/g),
    ...text.matchAll(/(\d{1,3}(?:\.\d{3})*,\d{2})R\$/g),
  ]
    .map((m) => parseBrazilianNumber(m[1]))
    .filter((n): n is number => n !== null);

  if (amounts.length > 0) {
    return Math.max(...amounts);
  }

  return null;
}

/**
 * Extracts the bill amount from a PDF boleto buffer.
 * Returns the amount in BRL as a number, or null if not found.
 */
export async function parseBoleto(pdfBuffer: Buffer): Promise<number | null> {
  const { totalPages, text } = await extractText(new Uint8Array(pdfBuffer), { mergePages: true });

  log.debug({ textLength: text.length, pages: totalPages }, "PDF parsed");
  log.debug({ textSample: text.substring(0, 500) }, "PDF text preview (first 500 chars)");

  const amount = extractAmountFromText(text);

  if (amount === null) {
    log.warn({ fullText: text }, "Could not extract amount from boleto PDF — dumping full text");
  } else {
    log.info({ amount }, "Extracted amount from boleto PDF");
  }

  return amount;
}
