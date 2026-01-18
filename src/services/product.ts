import { prisma } from "@/lib/prisma";
import type { SerializedProduct } from "@/types/purchase";
import type { CreateProductInput, UpdateProductInput } from "@/lib/schemas/product";
import logger, { serializeError } from "@/lib/logger";

const serviceLogger = logger.child({ module: "services/product" });

/**
 * Serialize a Prisma product to a SerializedProduct (Decimal -> number)
 */
function serializeProduct(product: {
  id: number;
  createdAt: Date | null;
  updatedAt: Date | null;
  code: string | null;
  description: string | null;
  unitValue: unknown;
  unitIdentifier: string | null;
  quantity: unknown;
  totalValue: unknown;
  purchaseId: number | null;
}): SerializedProduct {
  return {
    ...product,
    unitValue: product.unitValue ? Number(product.unitValue) : null,
    quantity: product.quantity ? Number(product.quantity) : null,
    totalValue: product.totalValue ? Number(product.totalValue) : null,
  };
}

/**
 * Recalculate and update the purchase total based on its products
 */
async function recalculatePurchaseTotal(purchaseId: number): Promise<void> {
  const products = await prisma.product.findMany({
    where: { purchaseId },
    select: { totalValue: true },
  });

  const total = products.reduce((sum, p) => sum + (p.totalValue ? Number(p.totalValue) : 0), 0);

  await prisma.purchase.update({
    where: { id: purchaseId },
    data: {
      totalValue: total,
      updatedAt: new Date(),
    },
  });

  serviceLogger.debug({ purchaseId, newTotal: total }, "Purchase total recalculated");
}

/**
 * Verify that a purchase belongs to the user
 */
async function verifyPurchaseOwnership(
  purchaseId: number,
  userId: string
): Promise<{ owned: boolean }> {
  const purchase = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    select: { userId: true },
  });

  return { owned: purchase?.userId === userId };
}

/**
 * Create a new product for a purchase
 */
export async function createProduct(
  purchaseId: number,
  userId: string,
  data: CreateProductInput
): Promise<SerializedProduct | null> {
  serviceLogger.debug({ purchaseId, userId }, "Creating product");

  try {
    // Verify ownership
    const { owned } = await verifyPurchaseOwnership(purchaseId, userId);
    if (!owned) {
      serviceLogger.debug({ purchaseId, userId }, "Purchase not found or access denied");
      return null;
    }

    const product = await prisma.product.create({
      data: {
        ...data,
        purchaseId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Recalculate purchase total
    await recalculatePurchaseTotal(purchaseId);

    serviceLogger.info({ productId: product.id, purchaseId, userId }, "Product created");

    return serializeProduct(product);
  } catch (error) {
    serviceLogger.error(
      { error: serializeError(error), purchaseId, userId },
      "Failed to create product"
    );
    throw error;
  }
}

/**
 * Update a product
 */
export async function updateProduct(
  productId: number,
  userId: string,
  data: UpdateProductInput
): Promise<SerializedProduct | null> {
  serviceLogger.debug({ productId, userId }, "Updating product");

  try {
    // Get the product and verify ownership through purchase
    const existing = await prisma.product.findUnique({
      where: { id: productId },
      include: { purchase: { select: { userId: true } } },
    });

    if (!existing || existing.purchase?.userId !== userId) {
      serviceLogger.debug({ productId, userId }, "Product not found or access denied");
      return null;
    }

    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });

    // Recalculate purchase total if totalValue changed
    if (existing.purchaseId && data.totalValue !== undefined) {
      await recalculatePurchaseTotal(existing.purchaseId);
    }

    serviceLogger.info({ productId, userId }, "Product updated");

    return serializeProduct(product);
  } catch (error) {
    serviceLogger.error(
      { error: serializeError(error), productId, userId },
      "Failed to update product"
    );
    throw error;
  }
}

/**
 * Delete a product
 */
export async function deleteProduct(productId: number, userId: string): Promise<boolean> {
  serviceLogger.debug({ productId, userId }, "Deleting product");

  try {
    // Get the product and verify ownership through purchase
    const existing = await prisma.product.findUnique({
      where: { id: productId },
      include: { purchase: { select: { userId: true } } },
    });

    if (!existing || existing.purchase?.userId !== userId) {
      serviceLogger.debug({ productId, userId }, "Product not found or access denied");
      return false;
    }

    const purchaseId = existing.purchaseId;

    await prisma.product.delete({ where: { id: productId } });

    // Recalculate purchase total
    if (purchaseId) {
      await recalculatePurchaseTotal(purchaseId);
    }

    serviceLogger.info({ productId, userId }, "Product deleted");

    return true;
  } catch (error) {
    serviceLogger.error(
      { error: serializeError(error), productId, userId },
      "Failed to delete product"
    );
    throw error;
  }
}

/**
 * Get a single product by ID
 */
export async function getProductById(
  productId: number,
  userId: string
): Promise<SerializedProduct | null> {
  serviceLogger.debug({ productId, userId }, "Fetching product by ID");

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { purchase: { select: { userId: true } } },
    });

    if (!product || product.purchase?.userId !== userId) {
      serviceLogger.debug({ productId, userId }, "Product not found or access denied");
      return null;
    }

    return serializeProduct(product);
  } catch (error) {
    serviceLogger.error(
      { error: serializeError(error), productId, userId },
      "Failed to fetch product"
    );
    throw error;
  }
}
