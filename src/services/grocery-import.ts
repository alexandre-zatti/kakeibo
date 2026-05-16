import { prisma } from "@/lib/prisma";
import type { ReceiptData } from "@/lib/schemas/receipt";
import { PurchaseStatus, type PurchaseWithProducts } from "@/types/purchase";

export interface BuildPurchaseCreateDataInput {
  userId: string;
  receiptData: ReceiptData;
  fallbackBoughtAt?: Date | null;
  now?: Date;
}

export function buildPurchaseCreateDataFromReceipt({
  userId,
  receiptData,
  fallbackBoughtAt = new Date(),
  now = new Date(),
}: BuildPurchaseCreateDataInput) {
  let boughtAt = fallbackBoughtAt;
  if (receiptData.purchaseDate) {
    const parsed = new Date(receiptData.purchaseDate);
    if (!Number.isNaN(parsed.getTime())) {
      boughtAt = parsed;
    }
  }

  return {
    userId,
    status: PurchaseStatus.NEEDS_REVIEW,
    totalValue: receiptData.totalValue,
    storeName: receiptData.storeName,
    boughtAt,
    createdAt: now,
    updatedAt: now,
    products: {
      create: receiptData.products.map((product) => ({
        code: product.code,
        description: product.description,
        unitValue: product.unitValue,
        unitIdentifier: product.unitIdentifier,
        quantity: product.quantity,
        totalValue: product.totalValue,
        createdAt: now,
        updatedAt: now,
      })),
    },
  };
}

function serializePurchaseWithProducts(purchase: Awaited<ReturnType<typeof createPurchase>>) {
  return {
    ...purchase,
    totalValue: purchase.totalValue ? Number(purchase.totalValue) : null,
    boughtAt: purchase.boughtAt ? purchase.boughtAt.toISOString() : null,
    products: purchase.products.map((p) => ({
      ...p,
      unitValue: p.unitValue ? Number(p.unitValue) : null,
      quantity: p.quantity ? Number(p.quantity) : null,
      totalValue: p.totalValue ? Number(p.totalValue) : null,
    })),
  };
}

async function createPurchase(data: ReturnType<typeof buildPurchaseCreateDataFromReceipt>) {
  return prisma.purchase.create({
    data,
    include: { products: true },
  });
}

export async function createPurchaseFromReceiptData(input: {
  userId: string;
  receiptData: ReceiptData;
  fallbackBoughtAt?: Date | null;
}): Promise<PurchaseWithProducts> {
  const purchase = await createPurchase(buildPurchaseCreateDataFromReceipt(input));
  return serializePurchaseWithProducts(purchase);
}
