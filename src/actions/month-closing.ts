"use server";

import { revalidatePath } from "next/cache";
import { resolveSessionAndHousehold, type ActionResult } from "@/actions/_helpers";
import { populateFromRecurring, closeMonth, reopenMonth } from "@/services/monthly-budget";
import { distributeClosingBalance } from "@/services/savings-box";
import { reconcileMonthSchema, distributeBalanceSchema } from "@/lib/schemas/finances";
import { prisma } from "@/lib/prisma";
import type { SerializedMonthlyBudget } from "@/types/finances";
import logger, { serializeError } from "@/lib/logger";

const log = logger.child({ module: "actions/month-closing" });

export async function populateFromRecurringAction(
  budgetId: number
): Promise<ActionResult<{ count: number }>> {
  try {
    const ctx = await resolveSessionAndHousehold();
    if ("error" in ctx) return { success: false, error: ctx.error };

    const count = await populateFromRecurring(budgetId, ctx.householdId);

    revalidatePath("/finances");

    return { success: true, data: { count } };
  } catch (error) {
    log.error({ error: serializeError(error) }, "Failed to populate recurring");
    return { success: false, error: "Erro ao carregar recorrentes" };
  }
}

export async function reconcileMonthAction(budgetId: number, data: unknown): Promise<ActionResult> {
  try {
    const ctx = await resolveSessionAndHousehold();
    if ("error" in ctx) return { success: false, error: ctx.error };

    const parsed = reconcileMonthSchema.safeParse(data);
    if (!parsed.success) return { success: false, error: "Dados inválidos" };

    // Verify budget belongs to household
    const budget = await prisma.monthlyBudget.findUnique({ where: { id: budgetId } });
    if (!budget || budget.householdId !== ctx.householdId) {
      return { success: false, error: "Orçamento não encontrado" };
    }

    await prisma.monthlyBudget.update({
      where: { id: budgetId },
      data: { bankBalance: parsed.data.bankBalance },
    });

    revalidatePath("/finances");

    return { success: true };
  } catch (error) {
    log.error({ error: serializeError(error) }, "Failed to reconcile month");
    return { success: false, error: "Erro ao conciliar mês" };
  }
}

export async function distributeBalanceAction(
  budgetId: number,
  data: unknown
): Promise<ActionResult> {
  try {
    const ctx = await resolveSessionAndHousehold();
    if ("error" in ctx) return { success: false, error: ctx.error };

    const parsed = distributeBalanceSchema.safeParse(data);
    if (!parsed.success) return { success: false, error: "Dados inválidos" };

    // Verify budget belongs to household
    const budget = await prisma.monthlyBudget.findUnique({ where: { id: budgetId } });
    if (!budget || budget.householdId !== ctx.householdId) {
      return { success: false, error: "Orçamento não encontrado" };
    }

    await distributeClosingBalance(ctx.householdId, parsed.data.allocations);

    revalidatePath("/finances");
    revalidatePath("/finances/caixinhas");

    return { success: true };
  } catch (error) {
    log.error({ error: serializeError(error) }, "Failed to distribute balance");
    return { success: false, error: "Erro ao distribuir saldo" };
  }
}

export async function closeMonthAction(
  budgetId: number
): Promise<ActionResult<SerializedMonthlyBudget>> {
  try {
    const ctx = await resolveSessionAndHousehold();
    if ("error" in ctx) return { success: false, error: ctx.error };

    const budget = await closeMonth(budgetId, ctx.householdId);

    if (!budget) {
      return { success: false, error: "Não foi possível fechar o mês. Verifique a conciliação." };
    }

    revalidatePath("/finances");
    revalidatePath("/finances/caixinhas");

    return { success: true, data: budget };
  } catch (error) {
    log.error({ error: serializeError(error) }, "Failed to close month");
    return { success: false, error: "Erro ao fechar mês" };
  }
}

export async function reopenMonthAction(
  budgetId: number
): Promise<ActionResult<SerializedMonthlyBudget>> {
  try {
    const ctx = await resolveSessionAndHousehold();
    if ("error" in ctx) return { success: false, error: ctx.error };

    const budget = await reopenMonth(budgetId, ctx.householdId);

    if (!budget) return { success: false, error: "Mês não encontrado ou já aberto" };

    revalidatePath("/finances");
    revalidatePath("/finances/caixinhas");

    return { success: true, data: budget };
  } catch (error) {
    log.error({ error: serializeError(error) }, "Failed to reopen month");
    return { success: false, error: "Erro ao reabrir mês" };
  }
}
