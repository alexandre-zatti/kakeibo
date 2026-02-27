import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getHouseholdByUserId } from "@/services/household";
import { getMonthlyBudgetSummary } from "@/services/monthly-budget";
import { FinanceSummaryCard } from "@/components/dashboard/finance-summary-card";

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const household = await getHouseholdByUserId(session.user.id);
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const budgetSummary = household ? await getMonthlyBudgetSummary(household.id, year, month) : null;

  const monthLabel = new Date(year, month - 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        Welcome{session.user.name ? `, ${session.user.name}` : ""}
      </h1>
      <p className="text-muted-foreground">Start tracking your finances with Kakeibo.</p>

      {budgetSummary && (
        <FinanceSummaryCard
          summary={budgetSummary}
          monthLabel={monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}
        />
      )}
    </div>
  );
}
