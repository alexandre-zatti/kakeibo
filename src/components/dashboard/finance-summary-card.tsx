"use client";

import Link from "next/link";
import { Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { MonthlyBudgetSummary } from "@/types/finances";

interface FinanceSummaryCardProps {
  summary: MonthlyBudgetSummary;
  monthLabel: string;
}

export function FinanceSummaryCard({ summary, monthLabel }: FinanceSummaryCardProps) {
  return (
    <Link href="/finances">
      <Card className="transition-colors hover:bg-accent/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4" />
            {monthLabel}
          </CardTitle>
          <Badge variant={summary.status === "closed" ? "secondary" : "default"}>
            {summary.status === "closed" ? "Fechado" : "Aberto"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Entrada</span>
            <span className="font-medium text-green-500">
              {formatCurrency(summary.totalIncome)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Gastos</span>
            <span className="font-medium">{formatCurrency(summary.totalExpensesForecast)}</span>
          </div>
          <div className="flex justify-between border-t pt-1 text-sm">
            <span className="text-muted-foreground">Disponivel</span>
            <span
              className={`font-medium ${summary.totalAvailable >= 0 ? "text-green-500" : "text-red-500"}`}
            >
              {formatCurrency(summary.totalAvailable)}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
