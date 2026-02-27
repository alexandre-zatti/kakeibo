import { prisma } from "@/lib/prisma";
import logger, { serializeError } from "@/lib/logger";
import type { SerializedExpenseEntry } from "@/types/finances";
import type { CreateExpenseInput, UpdateExpenseInput } from "@/lib/schemas/finances";

const log = logger.child({ module: "services/expense" });

function serializeExpense(entry: {
  amount: unknown;
  [key: string]: unknown;
}): SerializedExpenseEntry {
  return { ...entry, amount: Number(entry.amount) } as SerializedExpenseEntry;
}

export async function createExpense(
  budgetId: number,
  householdId: number,
  data: CreateExpenseInput
): Promise<SerializedExpenseEntry | null> {
  log.debug({ budgetId, householdId }, "Creating expense entry");

  try {
    const budget = await prisma.monthlyBudget.findUnique({ where: { id: budgetId } });

    if (!budget || budget.householdId !== householdId || budget.status !== "open") {
      return null;
    }

    const entry = await prisma.expenseEntry.create({
      data: {
        description: data.description,
        amount: data.amount,
        categoryId: data.categoryId,
        monthlyBudgetId: budgetId,
        isPaid: data.isPaid,
        paidAt: data.isPaid ? new Date() : null,
        source: data.source,
        savingsBoxId: data.savingsBoxId ?? null,
        recurringExpenseId: data.recurringExpenseId ?? null,
      },
    });

    // If paid and linked to a savings box, create auto-contribution
    if (data.isPaid && data.savingsBoxId) {
      await prisma.$transaction(async (tx) => {
        await tx.savingsTransaction.create({
          data: {
            type: "contribution",
            amount: data.amount,
            description: data.description,
            savingsBoxId: data.savingsBoxId!,
            source: "expense_link",
          },
        });
        await tx.savingsBox.update({
          where: { id: data.savingsBoxId! },
          data: { balance: { increment: data.amount } },
        });
      });
    }

    log.info({ entryId: entry.id, budgetId }, "Expense entry created");
    return serializeExpense(entry);
  } catch (error) {
    log.error({ error: serializeError(error), budgetId }, "Failed to create expense");
    throw error;
  }
}

export async function updateExpense(
  entryId: number,
  householdId: number,
  data: UpdateExpenseInput
): Promise<SerializedExpenseEntry | null> {
  log.debug({ entryId, householdId }, "Updating expense entry");

  try {
    const existing = await prisma.expenseEntry.findUnique({
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

    const updated = await prisma.expenseEntry.update({
      where: { id: entryId },
      data: {
        ...data,
        savingsBoxId: data.savingsBoxId === undefined ? undefined : (data.savingsBoxId ?? null),
      },
    });

    log.info({ entryId, householdId }, "Expense entry updated");
    return serializeExpense(updated);
  } catch (error) {
    log.error({ error: serializeError(error), entryId }, "Failed to update expense");
    throw error;
  }
}

export async function deleteExpense(entryId: number, householdId: number): Promise<boolean> {
  log.debug({ entryId, householdId }, "Deleting expense entry");

  try {
    const existing = await prisma.expenseEntry.findUnique({
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

    // If was paid and linked to savings box, reverse the auto-contribution
    if (existing.isPaid && existing.savingsBoxId) {
      await prisma.$transaction(async (tx) => {
        await tx.expenseEntry.delete({ where: { id: entryId } });
        await tx.savingsBox.update({
          where: { id: existing.savingsBoxId! },
          data: { balance: { decrement: Number(existing.amount) } },
        });
        // Delete the matching auto-transaction
        const autoTx = await tx.savingsTransaction.findFirst({
          where: {
            savingsBoxId: existing.savingsBoxId!,
            source: "expense_link",
            amount: existing.amount,
            description: existing.description,
          },
        });
        if (autoTx) {
          await tx.savingsTransaction.delete({ where: { id: autoTx.id } });
        }
      });
    } else {
      await prisma.expenseEntry.delete({ where: { id: entryId } });
    }

    log.info({ entryId, householdId }, "Expense entry deleted");
    return true;
  } catch (error) {
    log.error({ error: serializeError(error), entryId }, "Failed to delete expense");
    throw error;
  }
}

export async function toggleExpensePaid(
  entryId: number,
  householdId: number,
  isPaid: boolean
): Promise<SerializedExpenseEntry | null> {
  log.debug({ entryId, householdId, isPaid }, "Toggling expense paid status");

  try {
    const existing = await prisma.expenseEntry.findUnique({
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

    const updated = await prisma.$transaction(async (tx) => {
      const entry = await tx.expenseEntry.update({
        where: { id: entryId },
        data: { isPaid, paidAt: isPaid ? new Date() : null },
      });

      // Handle savings box auto-contribution
      if (existing.savingsBoxId) {
        if (isPaid && !existing.isPaid) {
          // Marking as paid: create contribution
          await tx.savingsTransaction.create({
            data: {
              type: "contribution",
              amount: existing.amount,
              description: existing.description,
              savingsBoxId: existing.savingsBoxId,
              source: "expense_link",
            },
          });
          await tx.savingsBox.update({
            where: { id: existing.savingsBoxId },
            data: { balance: { increment: Number(existing.amount) } },
          });
        } else if (!isPaid && existing.isPaid) {
          // Marking as unpaid: reverse contribution
          const autoTx = await tx.savingsTransaction.findFirst({
            where: {
              savingsBoxId: existing.savingsBoxId,
              source: "expense_link",
              amount: existing.amount,
              description: existing.description,
            },
          });
          if (autoTx) {
            await tx.savingsTransaction.delete({ where: { id: autoTx.id } });
          }
          await tx.savingsBox.update({
            where: { id: existing.savingsBoxId },
            data: { balance: { decrement: Number(existing.amount) } },
          });
        }
      }

      return entry;
    });

    log.info({ entryId, householdId, isPaid }, "Expense paid status toggled");
    return serializeExpense(updated);
  } catch (error) {
    log.error({ error: serializeError(error), entryId }, "Failed to toggle expense paid");
    throw error;
  }
}
