"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { PurchaseEditSheet } from "./purchase-edit-sheet";
import { deletePurchaseAction } from "@/actions/purchase";
import type { PurchaseWithProducts } from "@/types/purchase";
import { clientLogger } from "@/lib/client-logger";

interface PurchaseDetailActionsProps {
  purchase: PurchaseWithProducts;
}

export function PurchaseDetailActions({ purchase }: PurchaseDetailActionsProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Convert to PurchaseWithCount format for the edit sheet
  const purchaseWithCount = {
    ...purchase,
    _count: { products: purchase.products.length },
  };

  async function handleDelete() {
    setIsDeleting(true);

    const result = await deletePurchaseAction(purchase.id);

    if (!result.success) {
      clientLogger.error("Failed to delete purchase", result.error, { purchaseId: purchase.id });
      setIsDeleting(false);
      return;
    }

    router.push("/groceries");
  }

  const storeName = purchase.storeName || "Unknown Store";
  const itemCount = purchase.products.length;

  return (
    <>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </Button>
        <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </div>

      <PurchaseEditSheet purchase={purchaseWithCount} open={editOpen} onOpenChange={setEditOpen} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
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
    </>
  );
}
