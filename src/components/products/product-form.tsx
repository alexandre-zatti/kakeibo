"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createProductSchema, type CreateProductInput } from "@/lib/schemas/product";

interface ProductFormProps {
  defaultValues?: Partial<CreateProductInput>;
  onSubmit: (data: CreateProductInput) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
  isSubmitting?: boolean;
}

export function ProductForm({
  defaultValues,
  onSubmit,
  onCancel,
  submitLabel = "Save",
  isSubmitting = false,
}: ProductFormProps) {
  const form = useForm<CreateProductInput>({
    resolver: zodResolver(createProductSchema),
    defaultValues: {
      code: defaultValues?.code ?? "",
      description: defaultValues?.description ?? "",
      unitValue: defaultValues?.unitValue ?? null,
      unitIdentifier: defaultValues?.unitIdentifier ?? "",
      quantity: defaultValues?.quantity ?? null,
      totalValue: defaultValues?.totalValue ?? 0,
    },
  });

  const quantity = form.watch("quantity");
  const unitValue = form.watch("unitValue");

  // Auto-calculate totalValue when quantity and unitValue change
  useEffect(() => {
    if (quantity && unitValue) {
      const calculatedTotal = Number((quantity * unitValue).toFixed(2));
      form.setValue("totalValue", calculatedTotal);
    }
  }, [quantity, unitValue, form]);

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="description">Description *</Label>
        <Input
          id="description"
          placeholder="Product description"
          {...form.register("description")}
        />
        {form.formState.errors.description && (
          <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="quantity">Quantity</Label>
          <Input
            id="quantity"
            type="number"
            step="0.001"
            min="0"
            placeholder="0"
            {...form.register("quantity", {
              setValueAs: (v) => (v === "" ? null : parseFloat(v)),
            })}
          />
          {form.formState.errors.quantity && (
            <p className="text-sm text-destructive">{form.formState.errors.quantity.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="unitIdentifier">Unit</Label>
          <Input id="unitIdentifier" placeholder="kg, un, L" {...form.register("unitIdentifier")} />
          {form.formState.errors.unitIdentifier && (
            <p className="text-sm text-destructive">
              {form.formState.errors.unitIdentifier.message}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="unitValue">Unit Price</Label>
          <Input
            id="unitValue"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            {...form.register("unitValue", {
              setValueAs: (v) => (v === "" ? null : parseFloat(v)),
            })}
          />
          {form.formState.errors.unitValue && (
            <p className="text-sm text-destructive">{form.formState.errors.unitValue.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="totalValue">Total *</Label>
          <Input
            id="totalValue"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            {...form.register("totalValue", {
              setValueAs: (v) => (v === "" ? 0 : parseFloat(v)),
            })}
          />
          {form.formState.errors.totalValue && (
            <p className="text-sm text-destructive">{form.formState.errors.totalValue.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="code">Product Code (optional)</Label>
        <Input id="code" placeholder="SKU or barcode" {...form.register("code")} />
        {form.formState.errors.code && (
          <p className="text-sm text-destructive">{form.formState.errors.code.message}</p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
