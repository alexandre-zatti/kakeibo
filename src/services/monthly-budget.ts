import { prisma } from "@/lib/prisma";
import logger, { serializeError } from "@/lib/logger";
import { executeSingleAdapter, processAdapterActions } from "@/adapters/runner";
import type {
  MonthlyBudgetDetail,
  MonthlyBudgetSummary,
  SerializedMonthlyBudget,
  IncomeEntryWithCategory,
  ExpenseEntryWithRelations,
} from "@/types/finances";

const log = logger.child({ module: "services/monthly-budget" });

function serializeBudget(budget: { bankBalance: unknown; [key: string]: unknown }) {
  return {
    ...budget,
    bankBalance: budget.bankBalance ? Number(budget.bankBalance) : null,
  };
}

function serializeIncomeEntries(
  entries: { amount: unknown; category: unknown; [key: string]: unknown }[]
): IncomeEntryWithCategory[] {
  return entries.map((e) => ({
    ...e,
    amount: Number(e.amount),
  })) as IncomeEntryWithCategory[];
}

function serializeExpenseEntries(
  entries: {
    amount: unknown;
    category: unknown;
    savingsBox: unknown;
    [key: string]: unknown;
  }[]
): ExpenseEntryWithRelations[] {
  return entries.map((e) => ({
    ...e,
    amount: Number(e.amount),
  })) as ExpenseEntryWithRelations[];
}

function computeSummary(
  budget: ReturnType<typeof serializeBudget>,
  incomeEntries: IncomeEntryWithCategory[],
  expenseEntries: ExpenseEntryWithRelations[]
): MonthlyBudgetSummary {
  const totalIncome = incomeEntries.reduce((sum, e) => sum + e.amount, 0);
  const totalExpensesForecast = expenseEntries.reduce((sum, e) => sum + e.amount, 0);
  const totalExpensesPaid = expenseEntries
    .filter((e) => e.isPaid)
    .reduce((sum, e) => sum + e.amount, 0);
  const totalExpensesUnpaid = totalExpensesForecast - totalExpensesPaid;
  const totalAvailable = totalIncome - totalExpensesForecast;

  return {
    ...budget,
    totalIncome,
    totalExpensesForecast,
    totalExpensesPaid,
    totalExpensesUnpaid,
    totalAvailable,
  } as MonthlyBudgetSummary;
}

const budgetInclude = {
  incomeEntries: {
    include: { category: true },
    orderBy: { createdAt: "asc" as const },
  },
  expenseEntries: {
    include: {
      category: true,
      savingsBox: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" as const },
  },
} as const;

export async function getMonthlyBudget(
  householdId: number,
  year: number,
  month: number
): Promise<MonthlyBudgetDetail | null> {
  log.debug({ householdId, year, month }, "Getting monthly budget");

  try {
    const budget = await prisma.monthlyBudget.findUnique({
      where: { householdId_year_month: { householdId, year, month } },
      include: budgetInclude,
    });

    if (!budget) return null;

    const serialized = serializeBudget(budget);
    const incomeEntries = serializeIncomeEntries(budget.incomeEntries);
    const expenseEntries = serializeExpenseEntries(budget.expenseEntries);
    const summary = computeSummary(serialized, incomeEntries, expenseEntries);

    return { ...summary, incomeEntries, expenseEntries };
  } catch (error) {
    log.error({ error: serializeError(error), householdId, year, month }, "Failed to get budget");
    throw error;
  }
}

export async function createMonthlyBudget(
  householdId: number,
  year: number,
  month: number
): Promise<MonthlyBudgetDetail> {
  log.debug({ householdId, year, month }, "Creating monthly budget");

  try {
    const budget = await prisma.monthlyBudget.create({
      data: { householdId, year, month },
      include: budgetInclude,
    });

    log.info({ householdId, year, month }, "Monthly budget created");

    const serialized = serializeBudget(budget);
    const incomeEntries = serializeIncomeEntries(budget.incomeEntries);
    const expenseEntries = serializeExpenseEntries(budget.expenseEntries);
    const summary = computeSummary(serialized, incomeEntries, expenseEntries);

    return { ...summary, incomeEntries, expenseEntries };
  } catch (error) {
    log.error(
      { error: serializeError(error), householdId, year, month },
      "Failed to create budget"
    );
    throw error;
  }
}

export async function getMonthlyBudgetSummary(
  householdId: number,
  year: number,
  month: number
): Promise<MonthlyBudgetSummary | null> {
  log.debug({ householdId, year, month }, "Fetching monthly budget summary");

  try {
    const budget = await prisma.monthlyBudget.findUnique({
      where: { householdId_year_month: { householdId, year, month } },
      include: budgetInclude,
    });

    if (!budget) return null;

    const serialized = serializeBudget(budget);
    const incomeEntries = serializeIncomeEntries(budget.incomeEntries);
    const expenseEntries = serializeExpenseEntries(budget.expenseEntries);

    return computeSummary(serialized, incomeEntries, expenseEntries);
  } catch (error) {
    log.error({ error: serializeError(error), householdId }, "Failed to fetch budget summary");
    throw error;
  }
}

export async function populateFromRecurring(
  budgetId: number,
  householdId: number
): Promise<{ count: number; createdExpenses: Array<{ id: number; recurringExpenseId: number }> }> {
  log.debug({ budgetId, householdId }, "Populating from recurring expenses");

  try {
    const budget = await prisma.monthlyBudget.findUnique({ where: { id: budgetId } });

    if (!budget || budget.householdId !== householdId || budget.status !== "open") {
      return { count: 0, createdExpenses: [] };
    }

    const recurringExpenses = await prisma.recurringExpense.findMany({
      where: { householdId, isActive: true },
    });

    // Get already-populated recurring IDs for this budget
    const existingRecurringIds = new Set(
      (
        await prisma.expenseEntry.findMany({
          where: { monthlyBudgetId: budgetId, recurringExpenseId: { not: null } },
          select: { recurringExpenseId: true },
        })
      ).map((e) => e.recurringExpenseId)
    );

    const toCreate = recurringExpenses.filter((r) => !existingRecurringIds.has(r.id));

    if (toCreate.length === 0) return { count: 0, createdExpenses: [] };

    await prisma.expenseEntry.createMany({
      data: toCreate.map((r) => ({
        description: r.description,
        amount: r.amount,
        categoryId: r.categoryId,
        monthlyBudgetId: budgetId,
        source: "recurring",
        recurringExpenseId: r.id,
      })),
    });

    // Fetch created entries to get IDs
    const created = await prisma.expenseEntry.findMany({
      where: {
        monthlyBudgetId: budgetId,
        recurringExpenseId: { in: toCreate.map((r) => r.id) },
      },
      select: { id: true, recurringExpenseId: true },
    });

    log.info({ budgetId, count: created.length }, "Recurring expenses populated");
    return {
      count: created.length,
      createdExpenses: created as Array<{ id: number; recurringExpenseId: number }>,
    };
  } catch (error) {
    log.error({ error: serializeError(error), budgetId }, "Failed to populate recurring");
    throw error;
  }
}

export async function closeMonth(
  budgetId: number,
  householdId: number
): Promise<{
  closedBudget: SerializedMonthlyBudget;
  newBudgetId: number;
  recurringCount: number;
  adapterResults: Array<{
    adapterId: number;
    adapterName: string;
    success: boolean;
    error?: string;
  }>;
} | null> {
  log.debug({ budgetId, householdId }, "Closing month");

  try {
    const budget = await prisma.monthlyBudget.findUnique({
      where: { id: budgetId },
      include: budgetInclude,
    });

    if (!budget || budget.householdId !== householdId || budget.status !== "open") {
      return null;
    }

    // Validate: bankBalance must be set
    if (budget.bankBalance === null) {
      return null;
    }

    // Transaction: close current month + create next
    const result = await prisma.$transaction(async (tx) => {
      const closed = await tx.monthlyBudget.update({
        where: { id: budgetId },
        data: { status: "closed", closedAt: new Date() },
      });

      const nextMonth = budget.month === 12 ? 1 : budget.month + 1;
      const nextYear = budget.month === 12 ? budget.year + 1 : budget.year;

      const newBudget = await tx.monthlyBudget.upsert({
        where: { householdId_year_month: { householdId, year: nextYear, month: nextMonth } },
        create: { householdId, year: nextYear, month: nextMonth },
        update: {},
      });

      return { closed, newBudget, nextYear, nextMonth };
    });

    // Auto-populate recurring expenses into new month
    const { count: recurringCount, createdExpenses } = await populateFromRecurring(
      result.newBudget.id,
      householdId
    );

    // Run linked adapters for recurring expenses that have an adapterId
    const recurringWithAdapters = await prisma.recurringExpense.findMany({
      where: {
        householdId,
        isActive: true,
        adapterId: { not: null },
      },
      include: { adapter: true },
    });

    const adapterResults: Array<{
      adapterId: number;
      adapterName: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const recurring of recurringWithAdapters) {
      const expense = createdExpenses.find((e) => e.recurringExpenseId === recurring.id);
      if (!expense || !recurring.adapter) continue;

      try {
        const adapterResult = await executeSingleAdapter(recurring.adapter, {
          householdId,
          budgetId: result.newBudget.id,
          year: result.nextYear,
          month: result.nextMonth,
          adapter: recurring.adapter,
          targetExpenseId: expense.id,
        });

        if (adapterResult.success && adapterResult.actions.length > 0) {
          await processAdapterActions(
            adapterResult.actions,
            result.newBudget.id,
            householdId,
            result.nextYear,
            result.nextMonth,
            recurring.adapter.id
          );
        }

        adapterResults.push({
          adapterId: recurring.adapter.id,
          adapterName: recurring.adapter.name,
          success: adapterResult.success,
          error: adapterResult.error,
        });
      } catch (error) {
        log.error({ error, adapterId: recurring.adapter.id }, "Linked adapter execution failed");
        adapterResults.push({
          adapterId: recurring.adapter.id,
          adapterName: recurring.adapter.name,
          success: false,
          error: error instanceof Error ? error.message : "Erro inesperado",
        });
      }
    }

    log.info(
      { budgetId, householdId, recurringCount, adapterResults: adapterResults.length },
      "Month closed with auto-populate and adapters"
    );

    return {
      closedBudget: serializeBudget(result.closed) as SerializedMonthlyBudget,
      newBudgetId: result.newBudget.id,
      recurringCount,
      adapterResults,
    };
  } catch (error) {
    log.error({ error: serializeError(error), budgetId }, "Failed to close month");
    throw error;
  }
}

export async function reopenMonth(
  budgetId: number,
  householdId: number
): Promise<SerializedMonthlyBudget | null> {
  log.debug({ budgetId, householdId }, "Reopening month");

  try {
    const budget = await prisma.monthlyBudget.findUnique({ where: { id: budgetId } });

    if (!budget || budget.householdId !== householdId || budget.status !== "closed") {
      return null;
    }

    const updated = await prisma.monthlyBudget.update({
      where: { id: budgetId },
      data: { status: "open", closedAt: null },
    });

    log.info({ budgetId, householdId }, "Month reopened");
    return serializeBudget(updated) as SerializedMonthlyBudget;
  } catch (error) {
    log.error({ error: serializeError(error), budgetId }, "Failed to reopen month");
    throw error;
  }
}
