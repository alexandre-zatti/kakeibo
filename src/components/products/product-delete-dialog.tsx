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
import { deleteProductAction } from "@/actions/product";
import type { SerializedProduct } from "@/types/purchase";
import { clientLogger } from "@/lib/client-logger";

interface ProductDeleteDialogProps {
  product: SerializedProduct;
  purchaseId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ProductDeleteDialog({
  product,
  purchaseId,
  open,
  onOpenChange,
  onSuccess,
}: ProductDeleteDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);

    const result = await deleteProductAction(product.id, purchaseId);

    if (!result.success) {
      clientLogger.error("Failed to delete product", result.error, { productId: product.id });
      setIsDeleting(false);
      return;
    }

    if (onSuccess) {
      onSuccess();
    }

    setIsDeleting(false);
    onOpenChange(false);
  }

  const productName = product.description || "this product";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Product</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{productName}</strong>? This action cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
