"use server";

import { revalidatePath } from "next/cache";
import { resolveSessionAndHousehold, type ActionResult } from "@/actions/_helpers";
import {
  createSavingsBox,
  updateSavingsBox,
  deleteSavingsBox,
  addTransaction,
} from "@/services/savings-box";
import {
  createSavingsBoxSchema,
  updateSavingsBoxSchema,
  createSavingsTransactionSchema,
} from "@/lib/schemas/finances";
import type { SerializedSavingsBox, SerializedSavingsTransaction } from "@/types/finances";
import logger, { serializeError } from "@/lib/logger";

const log = logger.child({ module: "actions/savings-box" });

export async function createSavingsBoxAction(
  data: unknown
): Promise<ActionResult<SerializedSavingsBox>> {
  try {
    const ctx = await resolveSessionAndHousehold();
    if ("error" in ctx) return { success: false, error: ctx.error };

    const parsed = createSavingsBoxSchema.safeParse(data);
    if (!parsed.success) return { success: false, error: "Dados inválidos" };

    const box = await createSavingsBox(ctx.householdId, parsed.data);

    revalidatePath("/finances/caixinhas");

    return { success: true, data: box };
  } catch (error) {
    log.error({ error: serializeError(error) }, "Failed to create savings box");
    return { success: false, error: "Erro ao criar caixinha" };
  }
}

export async function updateSavingsBoxAction(
  id: number,
  data: unknown
): Promise<ActionResult<SerializedSavingsBox>> {
  try {
    const ctx = await resolveSessionAndHousehold();
    if ("error" in ctx) return { success: false, error: ctx.error };

    const parsed = updateSavingsBoxSchema.safeParse(data);
    if (!parsed.success) return { success: false, error: "Dados inválidos" };

    const box = await updateSavingsBox(id, ctx.householdId, parsed.data);

    if (!box) return { success: false, error: "Caixinha não encontrada" };

    revalidatePath("/finances/caixinhas");

    return { success: true, data: box };
  } catch (error) {
    log.error({ error: serializeError(error) }, "Failed to update savings box");
    return { success: false, error: "Erro ao atualizar caixinha" };
  }
}

export async function deleteSavingsBoxAction(id: number): Promise<ActionResult> {
  try {
    const ctx = await resolveSessionAndHousehold();
    if ("error" in ctx) return { success: false, error: ctx.error };

    const result = await deleteSavingsBox(id, ctx.householdId);

    if (!result.success) return { success: false, error: result.error };

    revalidatePath("/finances/caixinhas");

    return { success: true };
  } catch (error) {
    log.error({ error: serializeError(error) }, "Failed to delete savings box");
    return { success: false, error: "Erro ao excluir caixinha" };
  }
}

export async function addSavingsTransactionAction(
  boxId: number,
  data: unknown
): Promise<ActionResult<SerializedSavingsTransaction>> {
  try {
    const ctx = await resolveSessionAndHousehold();
    if ("error" in ctx) return { success: false, error: ctx.error };

    const parsed = createSavingsTransactionSchema.safeParse(data);
    if (!parsed.success) return { success: false, error: "Dados inválidos" };

    const tx = await addTransaction(boxId, ctx.householdId, parsed.data);

    if (!tx) return { success: false, error: "Caixinha não encontrada ou saldo insuficiente" };

    revalidatePath("/finances/caixinhas");

    return { success: true, data: tx };
  } catch (error) {
    log.error({ error: serializeError(error) }, "Failed to add savings transaction");
    return { success: false, error: "Erro ao registrar transação" };
  }
}
