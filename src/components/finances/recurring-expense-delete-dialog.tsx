"use client";

import { useState } from "react";
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
import { deleteRecurringExpenseAction } from "@/actions/recurring-expense";
import type { SerializedRecurringExpense } from "@/types/finances";
import { toast } from "sonner";

interface RecurringExpenseDeleteDialogProps {
  entry: SerializedRecurringExpense;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RecurringExpenseDeleteDialog({
  entry,
  open,
  onOpenChange,
}: RecurringExpenseDeleteDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    const result = await deleteRecurringExpenseAction(entry.id);
    if (!result.success) {
      toast.error(result.error);
      setIsDeleting(false);
      return;
    }
    toast.success("Recorrente desativada");
    onOpenChange(false);
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Desativar Recorrente</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja desativar <strong>{entry.description}</strong>? Despesas ja
            geradas nao serao afetadas.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Desativando..." : "Desativar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
