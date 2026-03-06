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
  { key: "totalAvailable" as const, label: "Disponível", color: "text-blue-500" },
];

export function BudgetSummaryBar({ summary }: BudgetSummaryBarProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
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
