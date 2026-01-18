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
import { updateProductAction } from "@/actions/product";
import type { SerializedProduct } from "@/types/purchase";
import type { CreateProductInput } from "@/lib/schemas/product";
import { clientLogger } from "@/lib/client-logger";

interface ProductEditSheetProps {
  product: SerializedProduct;
  purchaseId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (product: SerializedProduct) => void;
}

export function ProductEditSheet({
  product,
  purchaseId,
  open,
  onOpenChange,
  onSuccess,
}: ProductEditSheetProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(data: CreateProductInput) {
    setIsSubmitting(true);

    const result = await updateProductAction(product.id, purchaseId, data);

    if (!result.success) {
      clientLogger.error("Failed to update product", result.error, { productId: product.id });
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
          <SheetTitle>Edit Product</SheetTitle>
          <SheetDescription>Make changes to the product details.</SheetDescription>
        </SheetHeader>
        <div className="py-4">
          <ProductForm
            defaultValues={{
              code: product.code,
              description: product.description ?? "",
              unitValue: product.unitValue,
              unitIdentifier: product.unitIdentifier,
              quantity: product.quantity,
              totalValue: product.totalValue ?? 0,
            }}
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
            submitLabel="Save changes"
            isSubmitting={isSubmitting}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
