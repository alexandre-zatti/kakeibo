"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CalendarPlus, Loader2 } from "lucide-react";
import { createMonthAction } from "@/actions/month-closing";
import { toast } from "sonner";

interface EmptyMonthProps {
  year: number;
  month: number;
}

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function EmptyMonth({ year, month }: EmptyMonthProps) {
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    setLoading(true);
    try {
      const result = await createMonthAction(year, month);
      if (!result.success) {
        toast.error(result.error);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <p className="text-muted-foreground">
        Nenhum orçamento para {MONTH_NAMES[month - 1]} de {year}.
      </p>
      <Button onClick={handleCreate} disabled={loading}>
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <CalendarPlus className="mr-2 h-4 w-4" />
        )}
        Criar Mês
      </Button>
    </div>
  );
}
