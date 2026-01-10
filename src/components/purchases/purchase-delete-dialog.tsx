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
import { deletePurchaseAction } from "@/actions/purchase";
import type { PurchaseWithCount } from "@/types/purchase";
import { clientLogger } from "@/lib/client-logger";

interface PurchaseDeleteDialogProps {
  purchase: PurchaseWithCount;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PurchaseDeleteDialog({ purchase, open, onOpenChange }: PurchaseDeleteDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);

    const result = await deletePurchaseAction(purchase.id);

    if (!result.success) {
      clientLogger.error("Failed to delete purchase", result.error, { purchaseId: purchase.id });
      setIsDeleting(false);
      return;
    }

    onOpenChange(false);
  }

  const storeName = purchase.storeName || "Unknown Store";
  const itemCount = purchase._count?.products ?? 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Purchase</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the purchase from <strong>{storeName}</strong>? This
            will also delete {itemCount} product{itemCount !== 1 ? "s" : ""} associated with this
            purchase. This action cannot be undone.
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
