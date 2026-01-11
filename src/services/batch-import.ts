import { prisma } from "@/lib/prisma";
import { BatchPurchase } from "@/lib/schemas/batch-import";
import logger from "@/lib/logger";

export interface BatchImportResult {
  purchasesCreated: number;
  productsCreated: number;
}

/**
 * Batch imports multiple purchases with their products in a single transaction.
 * All-or-nothing: if any purchase fails, the entire batch is rolled back.
 */
export async function batchImportPurchases(
  userId: string,
  purchases: BatchPurchase[]
): Promise<BatchImportResult> {
  logger.info({ userId, purchaseCount: purchases.length }, "Starting batch import");

  let totalProducts = 0;

  await prisma.$transaction(async (tx) => {
    for (const purchase of purchases) {
      // Parse date if provided, default to current date
      let boughtAt: Date = new Date();
      if (purchase.purchaseDate) {
        const parsed = new Date(purchase.purchaseDate);
        if (!isNaN(parsed.getTime())) {
          boughtAt = parsed;
        }
      }

      await tx.purchase.create({
        data: {
          userId,
          status: 1, // approved - backlog items are already verified
          totalValue: purchase.totalValue,
          storeName: purchase.storeName,
          boughtAt,
          createdAt: new Date(),
          updatedAt: new Date(),
          products: {
            create: purchase.products.map((product) => ({
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
      });

      totalProducts += purchase.products.length;
    }
  });

  logger.info(
    { userId, purchasesCreated: purchases.length, productsCreated: totalProducts },
    "Batch import completed"
  );

  return {
    purchasesCreated: purchases.length,
    productsCreated: totalProducts,
  };
}
