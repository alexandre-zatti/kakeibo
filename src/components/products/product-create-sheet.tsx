"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ProductForm } from "./product-form";
import { createProductAction } from "@/actions/product";
import type { SerializedProduct } from "@/types/purchase";
import type { CreateProductInput } from "@/lib/schemas/product";
import { clientLogger } from "@/lib/client-logger";

interface ProductCreateSheetProps {
  purchaseId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (product: SerializedProduct) => void;
}

export function ProductCreateSheet({
  purchaseId,
  open,
  onOpenChange,
  onSuccess,
}: ProductCreateSheetProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(data: CreateProductInput) {
    setIsSubmitting(true);

    const result = await createProductAction(purchaseId, data);

    if (!result.success) {
      clientLogger.error("Failed to create product", result.error, { purchaseId });
      setIsSubmitting(false);
      return;
    }

    if (result.data && onSuccess) {
      onSuccess(result.data);
    }

    setIsSubmitting(false);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[425px]">
        <SheetHeader>
          <SheetTitle>Add Product</SheetTitle>
          <SheetDescription>Add a new product to this purchase.</SheetDescription>
        </SheetHeader>
        <div className="py-4">
          <ProductForm
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
            submitLabel="Add product"
            isSubmitting={isSubmitting}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
