"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { updatePurchase, deletePurchase } from "@/services/purchase";
import { scanReceipt, type ScanReceiptResult } from "@/services/receipt";
import { updatePurchaseSchema } from "@/lib/schemas/purchase";
import { uploadRequestSchema } from "@/lib/schemas/receipt";
import logger, { serializeError } from "@/lib/logger";

const actionLogger = logger.child({ module: "actions/purchase" });

export interface ActionResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}

export async function updatePurchaseAction(
  purchaseId: number,
  formData: {
    storeName?: string | null;
    boughtAt?: string | null;
    status?: number;
  }
): Promise<ActionResult> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Validate input
    const parseResult = updatePurchaseSchema.safeParse(formData);
    if (!parseResult.success) {
      return { success: false, error: "Invalid input" };
    }

    const data = parseResult.data;

    // Only include fields that were actually provided to avoid overwriting with null
    const updateData: Parameters<typeof updatePurchase>[2] = {};
    if (data.storeName !== undefined) updateData.storeName = data.storeName;
    if (data.boughtAt !== undefined)
      updateData.boughtAt = data.boughtAt ? new Date(data.boughtAt) : null;
    if (data.status !== undefined) updateData.status = data.status;

    const result = await updatePurchase(purchaseId, session.user.id, updateData);

    if (!result) {
      return { success: false, error: "Purchase not found or access denied" };
    }

    revalidatePath("/groceries");
    revalidatePath(`/groceries/${purchaseId}`);

    return { success: true };
  } catch (error) {
    actionLogger.error({ error: serializeError(error), purchaseId }, "Failed to update purchase");
    return { success: false, error: "Failed to update purchase" };
  }
}

export async function deletePurchaseAction(purchaseId: number): Promise<ActionResult> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const result = await deletePurchase(purchaseId, session.user.id);

    if (!result) {
      return { success: false, error: "Purchase not found or access denied" };
    }

    revalidatePath("/groceries");

    return { success: true };
  } catch (error) {
    actionLogger.error({ error: serializeError(error), purchaseId }, "Failed to delete purchase");
    return { success: false, error: "Failed to delete purchase" };
  }
}

export async function scanReceiptAction(
  images: string[],
  isLongReceiptMode: boolean = false
): Promise<ActionResult<ScanReceiptResult>> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Validate input
    const parseResult = uploadRequestSchema.safeParse({ images });
    if (!parseResult.success) {
      return { success: false, error: "Invalid input: Please provide 1-3 images" };
    }

    const result = await scanReceipt(session.user.id, parseResult.data.images, isLongReceiptMode);

    revalidatePath("/groceries");

    return { success: true, data: result };
  } catch (error) {
    actionLogger.error({ error: serializeError(error) }, "Failed to scan receipt");
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to process receipt",
    };
  }
}
