"use server";

import { revalidatePath } from "next/cache";
import { resolveSessionAndHousehold, type ActionResult } from "@/actions/_helpers";
import {
  createRecurringExpense,
  updateRecurringExpense,
  deleteRecurringExpense,
  toggleRecurringExpenseActive,
} from "@/services/recurring-expense";
import { createRecurringExpenseSchema, updateRecurringExpenseSchema } from "@/lib/schemas/finances";
import type { SerializedRecurringExpense } from "@/types/finances";
import logger, { serializeError } from "@/lib/logger";

const log = logger.child({ module: "actions/recurring-expense" });

export async function createRecurringExpenseAction(
  data: unknown
): Promise<ActionResult<SerializedRecurringExpense>> {
  try {
    const ctx = await resolveSessionAndHousehold();
    if ("error" in ctx) return { success: false, error: ctx.error };

    const parsed = createRecurringExpenseSchema.safeParse(data);
    if (!parsed.success) return { success: false, error: "Dados inválidos" };

    const expense = await createRecurringExpense(ctx.householdId, parsed.data);

    revalidatePath("/finances/recurring");

    return { success: true, data: expense };
  } catch (error) {
    log.error({ error: serializeError(error) }, "Failed to create recurring expense");
    return { success: false, error: "Erro ao criar despesa recorrente" };
  }
}

export async function updateRecurringExpenseAction(
  id: number,
  data: unknown
): Promise<ActionResult<SerializedRecurringExpense>> {
  try {
    const ctx = await resolveSessionAndHousehold();
    if ("error" in ctx) return { success: false, error: ctx.error };

    const parsed = updateRecurringExpenseSchema.safeParse(data);
    if (!parsed.success) return { success: false, error: "Dados inválidos" };

    const expense = await updateRecurringExpense(id, ctx.householdId, parsed.data);

    if (!expense) return { success: false, error: "Despesa recorrente não encontrada" };

    revalidatePath("/finances/recurring");

    return { success: true, data: expense };
  } catch (error) {
    log.error({ error: serializeError(error) }, "Failed to update recurring expense");
    return { success: false, error: "Erro ao atualizar despesa recorrente" };
  }
}

export async function deleteRecurringExpenseAction(id: number): Promise<ActionResult> {
  try {
    const ctx = await resolveSessionAndHousehold();
    if ("error" in ctx) return { success: false, error: ctx.error };

    const result = await deleteRecurringExpense(id, ctx.householdId);

    if (!result) return { success: false, error: "Despesa recorrente não encontrada" };

    revalidatePath("/finances/recurring");

    return { success: true };
  } catch (error) {
    log.error({ error: serializeError(error) }, "Failed to delete recurring expense");
    return { success: false, error: "Erro ao excluir despesa recorrente" };
  }
}

export async function toggleRecurringExpenseActiveAction(
  id: number,
  isActive: boolean
): Promise<ActionResult<SerializedRecurringExpense>> {
  try {
    const ctx = await resolveSessionAndHousehold();
    if ("error" in ctx) return { success: false, error: ctx.error };

    const expense = await toggleRecurringExpenseActive(id, ctx.householdId, isActive);

    if (!expense) return { success: false, error: "Despesa recorrente não encontrada" };

    revalidatePath("/finances/recurring");

    return { success: true, data: expense };
  } catch (error) {
    log.error({ error: serializeError(error) }, "Failed to toggle recurring expense");
    return { success: false, error: "Erro ao atualizar despesa recorrente" };
  }
}
