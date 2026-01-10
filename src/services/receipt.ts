import { prisma } from "@/lib/prisma";
import { extractReceiptData } from "@/lib/gemini";
import { receiptDataSchema } from "@/lib/schemas/receipt";
import logger from "@/lib/logger";

export interface ScanReceiptResult {
  id: number;
  storeName: string | null;
  totalValue: number;
  boughtAt: Date | null;
  productCount: number;
}

/**
 * Scans receipt images using Gemini AI and saves the extracted data to the database
 */
export async function scanReceipt(userId: string, images: string[]): Promise<ScanReceiptResult> {
  logger.info({ userId, imageCount: images.length }, "Processing receipt scan");

  // Send to Gemini API for extraction
  const rawData = await extractReceiptData(images);

  // Validate LLM response with Zod
  const validationResult = receiptDataSchema.safeParse(rawData);
  if (!validationResult.success) {
    logger.error({ error: validationResult.error, rawData }, "LLM response validation failed");
    throw new Error("Failed to extract valid receipt data");
  }

  const receiptData = validationResult.data;

  // Parse date if provided
  let boughtAt: Date | null = null;
  if (receiptData.purchaseDate) {
    const parsed = new Date(receiptData.purchaseDate);
    if (!isNaN(parsed.getTime())) {
      boughtAt = parsed;
    }
  }

  // Save to database with status=2 (needs review)
  const purchase = await prisma.purchase.create({
    data: {
      userId,
      status: 2, // needs_review
      totalValue: receiptData.totalValue,
      storeName: receiptData.storeName,
      boughtAt,
      createdAt: new Date(),
      updatedAt: new Date(),
      products: {
        create: receiptData.products.map((product) => ({
          code: product.code,
          description: product.description,
          unitValue: product.unitValue,
          unitIdentifier: product.unitIdentifier,
          quantity: product.quantity,
          totalValue: product.totalValue,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      },
    },
    include: { products: true },
  });

  logger.info({ purchaseId: purchase.id, productCount: purchase.products.length }, "Receipt saved");

  return {
    id: purchase.id,
    storeName: purchase.storeName,
    totalValue: Number(purchase.totalValue),
    boughtAt: purchase.boughtAt,
    productCount: purchase.products.length,
  };
}
