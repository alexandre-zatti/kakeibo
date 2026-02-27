import { prisma } from "@/lib/prisma";
import logger, { serializeError } from "@/lib/logger";
import type { SerializedRecurringExpense } from "@/types/finances";
import type {
  CreateRecurringExpenseInput,
  UpdateRecurringExpenseInput,
} from "@/lib/schemas/finances";

const log = logger.child({ module: "services/recurring-expense" });

function serialize(entry: { amount: unknown; [key: string]: unknown }): SerializedRecurringExpense {
  return { ...entry, amount: Number(entry.amount) } as SerializedRecurringExpense;
}

export async function getRecurringExpenses(
  householdId: number
): Promise<SerializedRecurringExpense[]> {
  log.debug({ householdId }, "Fetching recurring expenses");

  try {
    const expenses = await prisma.recurringExpense.findMany({
      where: { householdId },
      include: { category: true },
      orderBy: [{ isActive: "desc" }, { description: "asc" }],
    });

    return expenses.map(serialize);
  } catch (error) {
    log.error({ error: serializeError(error), householdId }, "Failed to fetch recurring expenses");
    throw error;
  }
}

export async function createRecurringExpense(
  householdId: number,
  data: CreateRecurringExpenseInput
): Promise<SerializedRecurringExpense> {
  log.debug({ householdId, description: data.description }, "Creating recurring expense");

  try {
    const expense = await prisma.recurringExpense.create({
      data: {
        ...data,
        dayOfMonth: data.dayOfMonth ?? null,
        householdId,
      },
    });

    log.info({ id: expense.id, householdId }, "Recurring expense created");
    return serialize(expense);
  } catch (error) {
    log.error({ error: serializeError(error), householdId }, "Failed to create recurring expense");
    throw error;
  }
}

export async function updateRecurringExpense(
  id: number,
  householdId: number,
  data: UpdateRecurringExpenseInput
): Promise<SerializedRecurringExpense | null> {
  log.debug({ id, householdId }, "Updating recurring expense");

  try {
    const existing = await prisma.recurringExpense.findUnique({ where: { id } });

    if (!existing || existing.householdId !== householdId) {
      return null;
    }

    const updated = await prisma.recurringExpense.update({
      where: { id },
      data: {
        ...data,
        dayOfMonth: data.dayOfMonth === undefined ? undefined : (data.dayOfMonth ?? null),
      },
    });

    log.info({ id, householdId }, "Recurring expense updated");
    return serialize(updated);
  } catch (error) {
    log.error({ error: serializeError(error), id }, "Failed to update recurring expense");
    throw error;
  }
}

export async function deleteRecurringExpense(id: number, householdId: number): Promise<boolean> {
  log.debug({ id, householdId }, "Soft-deleting recurring expense");

  try {
    const existing = await prisma.recurringExpense.findUnique({ where: { id } });

    if (!existing || existing.householdId !== householdId) {
      return false;
    }

    await prisma.recurringExpense.update({
      where: { id },
      data: { isActive: false },
    });

    log.info({ id, householdId }, "Recurring expense deactivated");
    return true;
  } catch (error) {
    log.error({ error: serializeError(error), id }, "Failed to delete recurring expense");
    throw error;
  }
}

export async function toggleRecurringExpenseActive(
  id: number,
  householdId: number,
  isActive: boolean
): Promise<SerializedRecurringExpense | null> {
  log.debug({ id, householdId, isActive }, "Toggling recurring expense active");

  try {
    const existing = await prisma.recurringExpense.findUnique({ where: { id } });

    if (!existing || existing.householdId !== householdId) {
      return null;
    }

    const updated = await prisma.recurringExpense.update({
      where: { id },
      data: { isActive },
    });

    log.info({ id, householdId, isActive }, "Recurring expense toggled");
    return serialize(updated);
  } catch (error) {
    log.error({ error: serializeError(error), id }, "Failed to toggle recurring expense");
    throw error;
  }
}
