"use server";

import { revalidatePath } from "next/cache";
import { resolveSessionAndHousehold, type ActionResult } from "@/actions/_helpers";
import { createAdapterSchema, updateAdapterSchema } from "@/lib/schemas/finances";
import {
  createAdapter,
  updateAdapter,
  deleteAdapter,
  toggleAdapterActive,
} from "@/services/adapter";
import { prisma } from "@/lib/prisma";
import logger, { serializeError } from "@/lib/logger";
import type { SerializedAdapter } from "@/types/finances";

const log = logger.child({ module: "actions/adapter" });

export async function createAdapterAction(data: unknown): Promise<ActionResult<SerializedAdapter>> {
  try {
    const ctx = await resolveSessionAndHousehold();
    if ("error" in ctx) return { success: false, error: ctx.error };

    const parsed = createAdapterSchema.safeParse(data);
    if (!parsed.success) return { success: false, error: "Dados inválidos" };

    const adapter = await createAdapter(ctx.householdId, parsed.data);

    revalidatePath("/finances/adapters");
    return { success: true, data: adapter };
  } catch (error) {
    log.error({ error: serializeError(error) }, "Failed to create adapter");
    return { success: false, error: "Erro ao criar adaptador" };
  }
}

export async function updateAdapterAction(
  id: number,
  data: unknown
): Promise<ActionResult<SerializedAdapter>> {
  try {
    const ctx = await resolveSessionAndHousehold();
    if ("error" in ctx) return { success: false, error: ctx.error };

    const parsed = updateAdapterSchema.safeParse(data);
    if (!parsed.success) return { success: false, error: "Dados inválidos" };

    const adapter = await updateAdapter(id, ctx.householdId, parsed.data);
    if (!adapter) return { success: false, error: "Adaptador não encontrado" };

    revalidatePath("/finances/adapters");
    return { success: true, data: adapter };
  } catch (error) {
    log.error({ error: serializeError(error) }, "Failed to update adapter");
    return { success: false, error: "Erro ao atualizar adaptador" };
  }
}

export async function deleteAdapterAction(id: number): Promise<ActionResult> {
  try {
    const ctx = await resolveSessionAndHousehold();
    if ("error" in ctx) return { success: false, error: ctx.error };

    const result = await deleteAdapter(id, ctx.householdId);
    if (!result.success) return { success: false, error: result.error };

    revalidatePath("/finances/adapters");
    return { success: true };
  } catch (error) {
    log.error({ error: serializeError(error) }, "Failed to delete adapter");
    return { success: false, error: "Erro ao excluir adaptador" };
  }
}

export async function toggleAdapterActiveAction(
  id: number,
  isActive: boolean
): Promise<ActionResult<SerializedAdapter>> {
  try {
    const ctx = await resolveSessionAndHousehold();
    if ("error" in ctx) return { success: false, error: ctx.error };

    const adapter = await toggleAdapterActive(id, ctx.householdId, isActive);
    if (!adapter) return { success: false, error: "Adaptador não encontrado" };

    revalidatePath("/finances/adapters");
    return { success: true, data: adapter };
  } catch (error) {
    log.error({ error: serializeError(error) }, "Failed to toggle adapter");
    return { success: false, error: "Erro ao alterar status do adaptador" };
  }
}

export async function disconnectGoogleAction(): Promise<ActionResult> {
  try {
    const ctx = await resolveSessionAndHousehold();
    if ("error" in ctx) return { success: false, error: ctx.error };

    await prisma.googleConnection.delete({
      where: { householdId: ctx.householdId },
    });

    revalidatePath("/finances/adapters");
    return { success: true };
  } catch (error) {
    log.error({ error: serializeError(error) }, "Failed to disconnect Google");
    return { success: false, error: "Erro ao desconectar Google" };
  }
}
