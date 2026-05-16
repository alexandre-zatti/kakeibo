import { extractReceiptData } from "@/lib/gemini";
import { receiptDataSchema } from "@/lib/schemas/receipt";
import { createPurchaseFromReceiptData } from "@/services/grocery-import";
import type { PurchaseWithProducts } from "@/types/purchase";
import logger from "@/lib/logger";

export interface ScanReceiptResult {
  purchase: PurchaseWithProducts;
}

/**
 * Scans receipt images using Gemini AI and saves the extracted data to the database
 */
export async function scanReceipt(
  userId: string,
  images: string[],
  isLongReceiptMode: boolean = false
): Promise<ScanReceiptResult> {
  logger.info({ userId, imageCount: images.length, isLongReceiptMode }, "Processing receipt scan");

  // Send to Gemini API for extraction
  const rawData = await extractReceiptData(images, isLongReceiptMode);

  // Validate LLM response with Zod
  const validationResult = receiptDataSchema.safeParse(rawData);
  if (!validationResult.success) {
    logger.error({ error: validationResult.error, rawData }, "LLM response validation failed");
    throw new Error("Failed to extract valid receipt data");
  }

  const receiptData = validationResult.data;

  const purchase = await createPurchaseFromReceiptData({
    userId,
    receiptData,
    fallbackBoughtAt: new Date(),
  });

  logger.info({ purchaseId: purchase.id, productCount: purchase.products.length }, "Receipt saved");

  return { purchase };
}
