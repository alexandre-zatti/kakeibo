"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { MonthlyBudgetSummary } from "@/types/finances";

interface BudgetSummaryBarProps {
  summary: MonthlyBudgetSummary;
}

const summaryItems = [
  { key: "totalIncome" as const, label: "Entrada", color: "text-green-500" },
  { key: "totalExpensesForecast" as const, label: "Previsão Gastos", color: "text-foreground" },
  { key: "totalExpensesPaid" as const, label: "Gastos Pagos", color: "text-orange-500" },
  { key: "totalExpensesUnpaid" as const, label: "A Pagar", color: "text-yellow-500" },
  { key: "totalAvailable" as const, label: "Disponível", color: "text-blue-500" },
];

export function BudgetSummaryBar({ summary }: BudgetSummaryBarProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {summaryItems.map((item) => (
        <Card key={item.key}>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className={`text-lg font-bold ${item.color}`}>{formatCurrency(summary[item.key])}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
