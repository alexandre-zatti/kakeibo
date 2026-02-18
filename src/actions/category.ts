"use server";

import { revalidatePath } from "next/cache";
import { resolveSessionAndHousehold, type ActionResult } from "@/actions/_helpers";
import { createCategory, updateCategory, deleteCategory } from "@/services/category";
import { createCategorySchema, updateCategorySchema } from "@/lib/schemas/finances";
import type { SerializedCategory } from "@/types/finances";
import logger, { serializeError } from "@/lib/logger";

const log = logger.child({ module: "actions/category" });

export async function createCategoryAction(
  data: unknown
): Promise<ActionResult<SerializedCategory>> {
  try {
    const ctx = await resolveSessionAndHousehold();
    if ("error" in ctx) return { success: false, error: ctx.error };

    const parsed = createCategorySchema.safeParse(data);
    if (!parsed.success) return { success: false, error: "Dados inválidos" };

    const category = await createCategory(ctx.householdId, parsed.data);

    revalidatePath("/finances");

    return { success: true, data: category };
  } catch (error) {
    log.error({ error: serializeError(error) }, "Failed to create category");
    return { success: false, error: "Erro ao criar categoria" };
  }
}

export async function updateCategoryAction(
  categoryId: number,
  data: unknown
): Promise<ActionResult<SerializedCategory>> {
  try {
    const ctx = await resolveSessionAndHousehold();
    if ("error" in ctx) return { success: false, error: ctx.error };

    const parsed = updateCategorySchema.safeParse(data);
    if (!parsed.success) return { success: false, error: "Dados inválidos" };

    const category = await updateCategory(categoryId, ctx.householdId, parsed.data);

    if (!category) return { success: false, error: "Categoria não encontrada" };

    revalidatePath("/finances");

    return { success: true, data: category };
  } catch (error) {
    log.error({ error: serializeError(error) }, "Failed to update category");
    return { success: false, error: "Erro ao atualizar categoria" };
  }
}

export async function deleteCategoryAction(categoryId: number): Promise<ActionResult> {
  try {
    const ctx = await resolveSessionAndHousehold();
    if ("error" in ctx) return { success: false, error: ctx.error };

    const result = await deleteCategory(categoryId, ctx.householdId);

    if (!result.success) return { success: false, error: result.error };

    revalidatePath("/finances");

    return { success: true };
  } catch (error) {
    log.error({ error: serializeError(error) }, "Failed to delete category");
    return { success: false, error: "Erro ao excluir categoria" };
  }
}
