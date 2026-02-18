"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { deleteSavingsBoxAction } from "@/actions/savings-box";
import type { SerializedSavingsBox } from "@/types/finances";
import { toast } from "sonner";

interface SavingsBoxDeleteDialogProps {
  box: SerializedSavingsBox;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SavingsBoxDeleteDialog({ box, open, onOpenChange }: SavingsBoxDeleteDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    setIsDeleting(true);
    const result = await deleteSavingsBoxAction(box.id);
    if (!result.success) {
      toast.error(result.error);
      setIsDeleting(false);
      return;
    }
    toast.success("Caixinha excluida");
    onOpenChange(false);
    router.push("/finances/caixinhas");
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir Caixinha</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir <strong>{box.name}</strong>?
            {box.balance > 0 && (
              <>
                {" "}
                Esta caixinha possui saldo de{" "}
                <strong>
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(box.balance)}
                </strong>
                . Retire o saldo antes de excluir.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting || box.balance > 0}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Excluindo..." : "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
