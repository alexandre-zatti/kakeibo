"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MonthlyBudgetStatus } from "@/types/finances";

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

interface MonthNavigatorProps {
  year: number;
  month: number;
  status: string;
}

export function MonthNavigator({ year, month, status }: MonthNavigatorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function navigate(newYear: number, newMonth: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", String(newYear));
    params.set("month", String(newMonth));
    router.push(`/finances?${params.toString()}`);
  }

  function goPrev() {
    if (month === 1) navigate(year - 1, 12);
    else navigate(year, month - 1);
  }

  function goNext() {
    if (month === 12) navigate(year + 1, 1);
    else navigate(year, month + 1);
  }

  const isClosed = status === MonthlyBudgetStatus.CLOSED;

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={goPrev} className="h-8 w-8">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="flex items-center gap-2">
        <span className="text-lg font-semibold">
          {MONTH_NAMES[month - 1]} {year}
        </span>
        <Badge variant={isClosed ? "secondary" : "default"}>
          {isClosed ? "Fechado" : "Aberto"}
        </Badge>
      </div>
      <Button variant="outline" size="icon" onClick={goNext} className="h-8 w-8">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
