import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { PurchaseWithCount, PurchaseWithProducts } from "@/types/purchase";
import logger, { serializeError } from "@/lib/logger";

const serviceLogger = logger.child({ module: "services/purchase" });

export interface GetPurchasesOptions {
  userId: string;
  search?: string;
  status?: number;
  dateFrom?: Date;
  dateTo?: Date;
  priceMin?: number;
  priceMax?: number;
  sortBy?: "storeName" | "boughtAt" | "totalValue" | "status" | "createdAt";
  sortOrder?: "asc" | "desc";
}

/**
 * Get all purchases for a user with optional filters
 */
export async function getPurchases(options: GetPurchasesOptions): Promise<PurchaseWithCount[]> {
  const { userId, search, status, dateFrom, dateTo, priceMin, priceMax, sortBy, sortOrder } =
    options;

  serviceLogger.debug({ userId, search, status }, "Fetching purchases");

  const where: Prisma.PurchaseWhereInput = { userId };

  if (search) {
    where.storeName = { contains: search, mode: "insensitive" };
  }

  if (status) {
    where.status = status;
  }

  if (dateFrom || dateTo) {
    where.boughtAt = {};
    if (dateFrom) where.boughtAt.gte = dateFrom;
    if (dateTo) where.boughtAt.lte = dateTo;
  }

  if (priceMin !== undefined || priceMax !== undefined) {
    where.totalValue = {};
    if (priceMin !== undefined) where.totalValue.gte = priceMin;
    if (priceMax !== undefined) where.totalValue.lte = priceMax;
  }

  const orderBy: Prisma.PurchaseOrderByWithRelationInput = {};
  if (sortBy) {
    orderBy[sortBy] = sortOrder || "desc";
  } else {
    orderBy.boughtAt = "desc";
  }

  try {
    const purchases = await prisma.purchase.findMany({
      where,
      orderBy,
      include: {
        _count: { select: { products: true } },
      },
    });

    serviceLogger.debug({ userId, count: purchases.length }, "Purchases fetched");

    // Convert Decimal to number and Date to ISO string for serialization
    return purchases.map((p) => ({
      ...p,
      totalValue: p.totalValue ? Number(p.totalValue) : null,
      boughtAt: p.boughtAt ? p.boughtAt.toISOString() : null,
    }));
  } catch (error) {
    serviceLogger.error({ error: serializeError(error), userId }, "Failed to fetch purchases");
    throw error;
  }
}

/**
 * Get a single purchase by ID with products
 */
export async function getPurchaseById(
  id: number,
  userId: string
): Promise<PurchaseWithProducts | null> {
  serviceLogger.debug({ purchaseId: id, userId }, "Fetching purchase by ID");

  try {
    const purchase = await prisma.purchase.findUnique({
      where: { id },
      include: { products: true },
    });

    if (!purchase || purchase.userId !== userId) {
      serviceLogger.debug({ purchaseId: id, userId }, "Purchase not found or access denied");
      return null;
    }

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
  } catch (error) {
    serviceLogger.error(
      { error: serializeError(error), purchaseId: id, userId },
      "Failed to fetch purchase"
    );
    throw error;
  }
}

export interface UpdatePurchaseData {
  storeName?: string | null;
  boughtAt?: Date | null;
  status?: number;
}

/**
 * Update a purchase
 */
export async function updatePurchase(id: number, userId: string, data: UpdatePurchaseData) {
  serviceLogger.debug({ purchaseId: id, userId }, "Updating purchase");

  try {
    // Verify ownership
    const existing = await prisma.purchase.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existing || existing.userId !== userId) {
      serviceLogger.debug({ purchaseId: id, userId }, "Purchase not found or access denied");
      return null;
    }

    const updated = await prisma.purchase.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
      include: { products: true },
    });

    serviceLogger.info({ purchaseId: id, userId }, "Purchase updated successfully");

    return {
      ...updated,
      totalValue: updated.totalValue ? Number(updated.totalValue) : null,
    };
  } catch (error) {
    serviceLogger.error(
      { error: serializeError(error), purchaseId: id, userId },
      "Failed to update purchase"
    );
    throw error;
  }
}

/**
 * Delete a purchase and its products
 */
export async function deletePurchase(id: number, userId: string) {
  serviceLogger.debug({ purchaseId: id, userId }, "Deleting purchase");

  try {
    // Verify ownership
    const existing = await prisma.purchase.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existing || existing.userId !== userId) {
      serviceLogger.debug({ purchaseId: id, userId }, "Purchase not found or access denied");
      return false;
    }

    // Delete products first (schema has onDelete: Restrict)
    await prisma.product.deleteMany({ where: { purchaseId: id } });

    // Delete purchase
    await prisma.purchase.delete({ where: { id } });

    serviceLogger.info({ purchaseId: id, userId }, "Purchase deleted successfully");

    return true;
  } catch (error) {
    serviceLogger.error(
      { error: serializeError(error), purchaseId: id, userId },
      "Failed to delete purchase"
    );
    throw error;
  }
}
