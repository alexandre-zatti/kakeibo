"use server";

import { revalidatePath } from "next/cache";
import { resolveSessionAndHousehold, type ActionResult } from "@/actions/_helpers";
import { createExpense, updateExpense, deleteExpense, toggleExpensePaid } from "@/services/expense";
import { createExpenseSchema, updateExpenseSchema } from "@/lib/schemas/finances";
import type { SerializedExpenseEntry } from "@/types/finances";
import logger, { serializeError } from "@/lib/logger";

const log = logger.child({ module: "actions/expense" });

export async function createExpenseAction(
  budgetId: number,
  data: unknown
): Promise<ActionResult<SerializedExpenseEntry>> {
  try {
    const ctx = await resolveSessionAndHousehold();
    if ("error" in ctx) return { success: false, error: ctx.error };

    const parsed = createExpenseSchema.safeParse(data);
    if (!parsed.success) return { success: false, error: "Dados inválidos" };

    const entry = await createExpense(budgetId, ctx.householdId, parsed.data);

    if (!entry) return { success: false, error: "Orçamento não encontrado ou fechado" };

    revalidatePath("/finances");
    revalidatePath("/finances/caixinhas");

    return { success: true, data: entry };
  } catch (error) {
    log.error({ error: serializeError(error) }, "Failed to create expense");
    return { success: false, error: "Erro ao criar despesa" };
  }
}

export async function updateExpenseAction(
  entryId: number,
  data: unknown
): Promise<ActionResult<SerializedExpenseEntry>> {
  try {
    const ctx = await resolveSessionAndHousehold();
    if ("error" in ctx) return { success: false, error: ctx.error };

    const parsed = updateExpenseSchema.safeParse(data);
    if (!parsed.success) return { success: false, error: "Dados inválidos" };

    const entry = await updateExpense(entryId, ctx.householdId, parsed.data);

    if (!entry) return { success: false, error: "Despesa não encontrada" };

    revalidatePath("/finances");
    revalidatePath("/finances/caixinhas");

    return { success: true, data: entry };
  } catch (error) {
    log.error({ error: serializeError(error) }, "Failed to update expense");
    return { success: false, error: "Erro ao atualizar despesa" };
  }
}

export async function deleteExpenseAction(entryId: number): Promise<ActionResult> {
  try {
    const ctx = await resolveSessionAndHousehold();
    if ("error" in ctx) return { success: false, error: ctx.error };

    const result = await deleteExpense(entryId, ctx.householdId);

    if (!result) return { success: false, error: "Despesa não encontrada" };

    revalidatePath("/finances");
    revalidatePath("/finances/caixinhas");

    return { success: true };
  } catch (error) {
    log.error({ error: serializeError(error) }, "Failed to delete expense");
    return { success: false, error: "Erro ao excluir despesa" };
  }
}

export async function toggleExpensePaidAction(
  entryId: number,
  isPaid: boolean
): Promise<ActionResult<SerializedExpenseEntry>> {
  try {
    const ctx = await resolveSessionAndHousehold();
    if ("error" in ctx) return { success: false, error: ctx.error };

    const entry = await toggleExpensePaid(entryId, ctx.householdId, isPaid);

    if (!entry) return { success: false, error: "Despesa não encontrada" };

    revalidatePath("/finances");
    revalidatePath("/finances/caixinhas");

    return { success: true, data: entry };
  } catch (error) {
    log.error({ error: serializeError(error) }, "Failed to toggle expense paid");
    return { success: false, error: "Erro ao atualizar despesa" };
  }
}
