import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getHouseholdByUserId } from "@/services/household";
import { getRecurringExpenses } from "@/services/recurring-expense";
import { getCategoriesByHousehold } from "@/services/category";
import { getAdapters } from "@/services/adapter";
import { RecurringExpenseList } from "@/components/finances/recurring-expense-list";

export default async function RecurringPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return null;

  const household = await getHouseholdByUserId(session.user.id);
  if (!household) return null;

  const [expenses, categories, adapters] = await Promise.all([
    getRecurringExpenses(household.id),
    getCategoriesByHousehold(household.id, "expense"),
    getAdapters(household.id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Despesas Recorrentes</h1>
      </div>
      <RecurringExpenseList expenses={expenses} categories={categories} adapters={adapters} />
    </div>
  );
}
