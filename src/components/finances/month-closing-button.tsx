"use client";

import { useState } from "react";
import { Lock, LockOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { reopenMonthAction } from "@/actions/month-closing";
import type { MonthlyBudgetDetail, SerializedSavingsBox } from "@/types/finances";
import { MonthClosingWizard } from "./month-closing-wizard";
import { toast } from "sonner";

interface MonthClosingButtonProps {
  budget: MonthlyBudgetDetail;
  savingsBoxes: SerializedSavingsBox[];
}

export function MonthClosingButton({ budget, savingsBoxes }: MonthClosingButtonProps) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [isReopening, setIsReopening] = useState(false);

  const isClosed = budget.status === "closed";

  async function handleReopen() {
    setIsReopening(true);
    const result = await reopenMonthAction(budget.id);
    setIsReopening(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Mes reaberto");
    setReopenOpen(false);
  }

  if (isClosed) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="secondary">
          <Lock className="mr-1 h-3 w-3" />
          Mes Fechado
        </Badge>
        <Button variant="ghost" size="sm" onClick={() => setReopenOpen(true)}>
          <LockOpen className="mr-1 h-3 w-3" />
          Reabrir
        </Button>

        <AlertDialog open={reopenOpen} onOpenChange={setReopenOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reabrir Mes</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja reabrir este mes? Voce podera editar receitas e despesas
                novamente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isReopening}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleReopen} disabled={isReopening}>
                {isReopening ? "Reabrindo..." : "Reabrir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <>
      <Button size="sm" onClick={() => setWizardOpen(true)}>
        <Lock className="mr-1 h-4 w-4" />
        Fechar Mes
      </Button>

      <MonthClosingWizard
        budget={budget}
        savingsBoxes={savingsBoxes}
        open={wizardOpen}
        onOpenChange={setWizardOpen}
      />
    </>
  );
}
