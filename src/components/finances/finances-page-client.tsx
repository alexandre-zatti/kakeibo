"use client";

import { useState } from "react";
import { RunAdaptersDialog } from "@/components/adapters/run-adapters-dialog";
import { MonthClosingButton } from "@/components/finances/month-closing-button";
import { useAdapterRunStream } from "@/hooks/use-adapter-run-stream";
import { Loader2 } from "lucide-react";
import type {
  AdapterWithLastRun,
  MonthlyBudgetDetail,
  SerializedSavingsBox,
} from "@/types/finances";

interface FinancesPageClientProps {
  budgetId: number;
  budget: MonthlyBudgetDetail;
  adapters: AdapterWithLastRun[];
  savingsBoxes: SerializedSavingsBox[];
  isClosed: boolean;
}

export function FinancesPageClient({
  budgetId,
  budget,
  adapters,
  savingsBoxes,
  isClosed,
}: FinancesPageClientProps) {
  const [activeRunId, setActiveRunId] = useState<number | null>(null);
  const { isRunning } = useAdapterRunStream(activeRunId);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <RunAdaptersDialog
        budgetId={budgetId}
        adapters={adapters}
        disabled={isClosed || isRunning}
        onRunStarted={setActiveRunId}
      />
      {isRunning && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Executando adaptadores...
        </span>
      )}
      <MonthClosingButton budget={budget} savingsBoxes={savingsBoxes} />
    </div>
  );
}
