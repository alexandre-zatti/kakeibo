"use client";

import { useState } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProductEditSheet } from "./product-edit-sheet";
import { ProductDeleteDialog } from "./product-delete-dialog";
import type { SerializedProduct } from "@/types/purchase";

interface ProductRowActionsProps {
  product: SerializedProduct;
  purchaseId: number;
  onUpdate?: (product: SerializedProduct) => void;
  onDelete?: () => void;
}

export function ProductRowActions({
  product,
  purchaseId,
  onUpdate,
  onDelete,
}: ProductRowActionsProps) {
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setShowEditSheet(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setShowDeleteDialog(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProductEditSheet
        product={product}
        purchaseId={purchaseId}
        open={showEditSheet}
        onOpenChange={setShowEditSheet}
        onSuccess={onUpdate}
      />

      <ProductDeleteDialog
        product={product}
        purchaseId={purchaseId}
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onSuccess={onDelete}
      />
    </>
  );
}
