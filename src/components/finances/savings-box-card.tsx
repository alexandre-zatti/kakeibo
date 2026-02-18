"use client";

import Link from "next/link";
import { PiggyBank } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/utils";
import type { SerializedSavingsBox } from "@/types/finances";

interface SavingsBoxCardProps {
  box: SerializedSavingsBox;
}

export function SavingsBoxCard({ box }: SavingsBoxCardProps) {
  const goalProgress =
    box.goalAmount && box.goalAmount > 0
      ? Math.min((box.balance / box.goalAmount) * 100, 100)
      : null;

  return (
    <Link href={`/finances/caixinhas/${box.id}`}>
      <Card className="transition-colors hover:bg-accent/50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <PiggyBank className="h-4 w-4 text-muted-foreground" />
            {box.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-2xl font-bold">{formatCurrency(box.balance)}</p>

          {box.monthlyTarget && (
            <p className="text-xs text-muted-foreground">
              Meta mensal: {formatCurrency(box.monthlyTarget)}
            </p>
          )}

          {goalProgress !== null && box.goalAmount && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Meta: {formatCurrency(box.goalAmount)}</span>
                <span>{goalProgress.toFixed(0)}%</span>
              </div>
              <Progress value={goalProgress} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
