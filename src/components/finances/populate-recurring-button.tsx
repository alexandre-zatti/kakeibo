"use client";

import { useState } from "react";
import { Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { populateFromRecurringAction } from "@/actions/month-closing";
import { toast } from "sonner";

interface PopulateRecurringButtonProps {
  budgetId: number;
  isClosed: boolean;
}

export function PopulateRecurringButton({ budgetId, isClosed }: PopulateRecurringButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  async function handlePopulate() {
    setIsLoading(true);
    const result = await populateFromRecurringAction(budgetId);
    setIsLoading(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    const count = result.data?.count ?? 0;
    if (count === 0) {
      toast.info("Nenhuma recorrente nova para carregar");
    } else {
      toast.success(`${count} despesa(s) recorrente(s) carregada(s)`);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handlePopulate} disabled={isClosed || isLoading}>
      <Repeat className="mr-1 h-4 w-4" />
      {isLoading ? "Carregando..." : "Carregar Recorrentes"}
    </Button>
  );
}
