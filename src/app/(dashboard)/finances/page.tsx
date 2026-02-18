import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getHouseholdByUserId } from "@/services/household";
import { getOrCreateMonthlyBudget } from "@/services/monthly-budget";
import { getCategoriesByHousehold } from "@/services/category";
import { getSavingsBoxes } from "@/services/savings-box";
import { MonthNavigator } from "@/components/finances/month-navigator";
import { BudgetSummaryBar } from "@/components/finances/budget-summary-bar";
import { IncomeSection } from "@/components/finances/income-section";
import { ExpenseList } from "@/components/finances/expense-list";
import { MonthClosingButton } from "@/components/finances/month-closing-button";
import { PopulateRecurringButton } from "@/components/finances/populate-recurring-button";

interface FinancesPageProps {
  searchParams: Promise<{ year?: string; month?: string }>;
}

export default async function FinancesPage({ searchParams }: FinancesPageProps) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return null;

  const household = await getHouseholdByUserId(session.user.id);
  if (!household) return null;

  const params = await searchParams;
  const now = new Date();
  const year = params.year ? parseInt(params.year, 10) : now.getFullYear();
  const month = params.month ? parseInt(params.month, 10) : now.getMonth() + 1;

  const [budget, categories, savingsBoxes] = await Promise.all([
    getOrCreateMonthlyBudget(household.id, year, month),
    getCategoriesByHousehold(household.id),
    getSavingsBoxes(household.id),
  ]);

  const incomeCategories = categories.filter((c) => c.type === "income");
  const expenseCategories = categories.filter((c) => c.type === "expense");
  const isClosed = budget.status === "closed";

  return (
    <div className="space-y-6">
      <MonthNavigator year={year} month={month} status={budget.status} />
      <div className="flex flex-wrap items-center gap-2">
        <PopulateRecurringButton budgetId={budget.id} isClosed={isClosed} />
        <MonthClosingButton budget={budget} savingsBoxes={savingsBoxes} />
      </div>
      <BudgetSummaryBar summary={budget} />
      <IncomeSection
        budgetId={budget.id}
        entries={budget.incomeEntries}
        categories={incomeCategories}
        isClosed={isClosed}
      />
      <ExpenseList
        budgetId={budget.id}
        entries={budget.expenseEntries}
        categories={expenseCategories}
        savingsBoxes={savingsBoxes}
        isClosed={isClosed}
      />
    </div>
  );
}
