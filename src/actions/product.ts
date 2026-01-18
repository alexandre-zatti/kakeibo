"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { createProduct, updateProduct, deleteProduct } from "@/services/product";
import { createProductSchema, updateProductSchema } from "@/lib/schemas/product";
import type { SerializedProduct } from "@/types/purchase";
import logger, { serializeError } from "@/lib/logger";

const actionLogger = logger.child({ module: "actions/product" });

export interface ActionResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}

export async function createProductAction(
  purchaseId: number,
  formData: {
    code?: string | null;
    description: string;
    unitValue?: number | null;
    unitIdentifier?: string | null;
    quantity?: number | null;
    totalValue: number;
  }
): Promise<ActionResult<SerializedProduct>> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Validate input
    const parseResult = createProductSchema.safeParse(formData);
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map((e) => e.message).join(", ");
      return { success: false, error: errors };
    }

    const result = await createProduct(purchaseId, session.user.id, parseResult.data);

    if (!result) {
      return { success: false, error: "Purchase not found or access denied" };
    }

    revalidatePath("/groceries");
    revalidatePath(`/groceries/${purchaseId}`);

    return { success: true, data: result };
  } catch (error) {
    actionLogger.error({ error: serializeError(error), purchaseId }, "Failed to create product");
    return { success: false, error: "Failed to create product" };
  }
}

export async function updateProductAction(
  productId: number,
  purchaseId: number,
  formData: {
    code?: string | null;
    description?: string;
    unitValue?: number | null;
    unitIdentifier?: string | null;
    quantity?: number | null;
    totalValue?: number;
  }
): Promise<ActionResult<SerializedProduct>> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Validate input
    const parseResult = updateProductSchema.safeParse(formData);
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map((e) => e.message).join(", ");
      return { success: false, error: errors };
    }

    const result = await updateProduct(productId, session.user.id, parseResult.data);

    if (!result) {
      return { success: false, error: "Product not found or access denied" };
    }

    revalidatePath("/groceries");
    revalidatePath(`/groceries/${purchaseId}`);

    return { success: true, data: result };
  } catch (error) {
    actionLogger.error({ error: serializeError(error), productId }, "Failed to update product");
    return { success: false, error: "Failed to update product" };
  }
}

export async function deleteProductAction(
  productId: number,
  purchaseId: number
): Promise<ActionResult> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const result = await deleteProduct(productId, session.user.id);

    if (!result) {
      return { success: false, error: "Product not found or access denied" };
    }

    revalidatePath("/groceries");
    revalidatePath(`/groceries/${purchaseId}`);

    return { success: true };
  } catch (error) {
    actionLogger.error({ error: serializeError(error), productId }, "Failed to delete product");
    return { success: false, error: "Failed to delete product" };
  }
}
