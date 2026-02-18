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
import { deleteCategoryAction } from "@/actions/category";
import type { SerializedCategory } from "@/types/finances";
import { toast } from "sonner";

interface CategoryDeleteDialogProps {
  category: SerializedCategory;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CategoryDeleteDialog({ category, open, onOpenChange }: CategoryDeleteDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    const result = await deleteCategoryAction(category.id);
    if (!result.success) {
      toast.error(result.error);
      setIsDeleting(false);
      return;
    }
    toast.success("Categoria excluida");
    onOpenChange(false);
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir Categoria</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir <strong>{category.name}</strong>? Categorias em uso nao
            podem ser removidas.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Excluindo..." : "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
