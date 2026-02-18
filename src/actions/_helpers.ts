"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getHouseholdByUserId } from "@/services/household";

export interface ActionResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}

export async function resolveSessionAndHousehold(): Promise<
  { userId: string; householdId: number } | { error: string }
> {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user?.id) {
    return { error: "Não autenticado" };
  }

  const household = await getHouseholdByUserId(session.user.id);

  if (!household) {
    return { error: "Household não encontrado" };
  }

  return { userId: session.user.id, householdId: household.id };
}
