import { prisma } from "@/lib/prisma";
import { extractReceiptData } from "@/lib/gemini";
import { receiptDataSchema } from "@/lib/schemas/receipt";
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

  // Parse date if provided, default to current date if not found
  let boughtAt: Date = new Date();
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

  // Serialize Decimal fields to numbers and Date to ISO string for JSON transport
  return {
    purchase: {
      ...purchase,
      totalValue: purchase.totalValue ? Number(purchase.totalValue) : null,
      boughtAt: purchase.boughtAt ? purchase.boughtAt.toISOString() : null,
      products: purchase.products.map((p) => ({
        ...p,
        unitValue: p.unitValue ? Number(p.unitValue) : null,
        quantity: p.quantity ? Number(p.quantity) : null,
        totalValue: p.totalValue ? Number(p.totalValue) : null,
      })),
    },
  };
}
