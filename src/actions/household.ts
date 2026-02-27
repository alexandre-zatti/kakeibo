"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { createHousehold, addHouseholdMember, removeHouseholdMember } from "@/services/household";
import { createHouseholdSchema, inviteHouseholdMemberSchema } from "@/lib/schemas/finances";
import type { ActionResult } from "@/actions/_helpers";
import type { HouseholdWithMembers } from "@/types/finances";
import logger, { serializeError } from "@/lib/logger";

const log = logger.child({ module: "actions/household" });

export async function createHouseholdAction(
  data: unknown
): Promise<ActionResult<HouseholdWithMembers>> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) return { success: false, error: "Não autenticado" };

    const parsed = createHouseholdSchema.safeParse(data);
    if (!parsed.success) return { success: false, error: "Dados inválidos" };

    const household = await createHousehold(session.user.id, parsed.data);

    revalidatePath("/finances");
    revalidatePath("/dashboard");

    return { success: true, data: household };
  } catch (error) {
    log.error({ error: serializeError(error) }, "Failed to create household");
    return { success: false, error: "Erro ao criar household" };
  }
}

export async function addHouseholdMemberAction(
  householdId: number,
  data: unknown
): Promise<ActionResult> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) return { success: false, error: "Não autenticado" };

    const parsed = inviteHouseholdMemberSchema.safeParse(data);
    if (!parsed.success) return { success: false, error: "Email inválido" };

    const result = await addHouseholdMember(householdId, parsed.data.email, session.user.id);

    if (!result.success) return { success: false, error: result.error };

    revalidatePath("/finances");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    log.error({ error: serializeError(error) }, "Failed to add household member");
    return { success: false, error: "Erro ao adicionar membro" };
  }
}

export async function removeHouseholdMemberAction(
  householdId: number,
  memberId: number
): Promise<ActionResult> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) return { success: false, error: "Não autenticado" };

    const result = await removeHouseholdMember(householdId, memberId, session.user.id);

    if (!result.success) return { success: false, error: result.error };

    revalidatePath("/finances");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    log.error({ error: serializeError(error) }, "Failed to remove household member");
    return { success: false, error: "Erro ao remover membro" };
  }
}
