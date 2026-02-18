"use server";

import { revalidatePath } from "next/cache";
import { resolveSessionAndHousehold, type ActionResult } from "@/actions/_helpers";
import { createIncome, updateIncome, deleteIncome } from "@/services/income";
import { createIncomeSchema, updateIncomeSchema } from "@/lib/schemas/finances";
import type { SerializedIncomeEntry } from "@/types/finances";
import logger, { serializeError } from "@/lib/logger";

const log = logger.child({ module: "actions/income" });

export async function createIncomeAction(
  budgetId: number,
  data: unknown
): Promise<ActionResult<SerializedIncomeEntry>> {
  try {
    const ctx = await resolveSessionAndHousehold();
    if ("error" in ctx) return { success: false, error: ctx.error };

    const parsed = createIncomeSchema.safeParse(data);
    if (!parsed.success) return { success: false, error: "Dados inválidos" };

    const entry = await createIncome(budgetId, ctx.householdId, parsed.data);

    if (!entry) return { success: false, error: "Orçamento não encontrado ou fechado" };

    revalidatePath("/finances");

    return { success: true, data: entry };
  } catch (error) {
    log.error({ error: serializeError(error) }, "Failed to create income");
    return { success: false, error: "Erro ao criar receita" };
  }
}

export async function updateIncomeAction(
  entryId: number,
  data: unknown
): Promise<ActionResult<SerializedIncomeEntry>> {
  try {
    const ctx = await resolveSessionAndHousehold();
    if ("error" in ctx) return { success: false, error: ctx.error };

    const parsed = updateIncomeSchema.safeParse(data);
    if (!parsed.success) return { success: false, error: "Dados inválidos" };

    const entry = await updateIncome(entryId, ctx.householdId, parsed.data);

    if (!entry) return { success: false, error: "Receita não encontrada" };

    revalidatePath("/finances");

    return { success: true, data: entry };
  } catch (error) {
    log.error({ error: serializeError(error) }, "Failed to update income");
    return { success: false, error: "Erro ao atualizar receita" };
  }
}

export async function deleteIncomeAction(entryId: number): Promise<ActionResult> {
  try {
    const ctx = await resolveSessionAndHousehold();
    if ("error" in ctx) return { success: false, error: ctx.error };

    const result = await deleteIncome(entryId, ctx.householdId);

    if (!result) return { success: false, error: "Receita não encontrada" };

    revalidatePath("/finances");

    return { success: true };
  } catch (error) {
    log.error({ error: serializeError(error) }, "Failed to delete income");
    return { success: false, error: "Erro ao excluir receita" };
  }
}
