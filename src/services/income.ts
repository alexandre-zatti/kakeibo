import { prisma } from "@/lib/prisma";
import logger, { serializeError } from "@/lib/logger";
import type { SerializedIncomeEntry } from "@/types/finances";
import type { CreateIncomeInput, UpdateIncomeInput } from "@/lib/schemas/finances";

const log = logger.child({ module: "services/income" });

function serializeIncome(entry: {
  amount: unknown;
  [key: string]: unknown;
}): SerializedIncomeEntry {
  return { ...entry, amount: Number(entry.amount) } as SerializedIncomeEntry;
}

export async function createIncome(
  budgetId: number,
  householdId: number,
  data: CreateIncomeInput
): Promise<SerializedIncomeEntry | null> {
  log.debug({ budgetId, householdId }, "Creating income entry");

  try {
    const budget = await prisma.monthlyBudget.findUnique({ where: { id: budgetId } });

    if (!budget || budget.householdId !== householdId || budget.status !== "open") {
      return null;
    }

    const entry = await prisma.incomeEntry.create({
      data: { ...data, monthlyBudgetId: budgetId },
    });

    log.info({ entryId: entry.id, budgetId }, "Income entry created");
    return serializeIncome(entry);
  } catch (error) {
    log.error({ error: serializeError(error), budgetId }, "Failed to create income");
    throw error;
  }
}

export async function updateIncome(
  entryId: number,
  householdId: number,
  data: UpdateIncomeInput
): Promise<SerializedIncomeEntry | null> {
  log.debug({ entryId, householdId }, "Updating income entry");

  try {
    const existing = await prisma.incomeEntry.findUnique({
      where: { id: entryId },
      include: { monthlyBudget: { select: { householdId: true, status: true } } },
    });

    if (
      !existing ||
      existing.monthlyBudget.householdId !== householdId ||
      existing.monthlyBudget.status !== "open"
    ) {
      return null;
    }

    const updated = await prisma.incomeEntry.update({
      where: { id: entryId },
      data,
    });

    log.info({ entryId, householdId }, "Income entry updated");
    return serializeIncome(updated);
  } catch (error) {
    log.error({ error: serializeError(error), entryId }, "Failed to update income");
    throw error;
  }
}

export async function deleteIncome(entryId: number, householdId: number): Promise<boolean> {
  log.debug({ entryId, householdId }, "Deleting income entry");

  try {
    const existing = await prisma.incomeEntry.findUnique({
      where: { id: entryId },
      include: { monthlyBudget: { select: { householdId: true, status: true } } },
    });

    if (
      !existing ||
      existing.monthlyBudget.householdId !== householdId ||
      existing.monthlyBudget.status !== "open"
    ) {
      return false;
    }

    await prisma.incomeEntry.delete({ where: { id: entryId } });

    log.info({ entryId, householdId }, "Income entry deleted");
    return true;
  } catch (error) {
    log.error({ error: serializeError(error), entryId }, "Failed to delete income");
    throw error;
  }
}
