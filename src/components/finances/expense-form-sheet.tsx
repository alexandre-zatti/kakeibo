"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createExpenseAction, updateExpenseAction } from "@/actions/expense";
import type {
  ExpenseEntryWithRelations,
  SerializedCategory,
  SerializedSavingsBox,
} from "@/types/finances";
import { toast } from "sonner";
import { z } from "zod";

const expenseFormSchema = z.object({
  description: z.string().min(1, "Descrição é obrigatória").max(255),
  amount: z.number().positive("Valor deve ser positivo"),
  categoryId: z.number().int().positive("Categoria é obrigatória"),
  isPaid: z.boolean(),
  savingsBoxId: z.number().int().positive().optional().nullable(),
});

type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

interface ExpenseFormSheetProps {
  budgetId: number;
  categories: SerializedCategory[];
  savingsBoxes: SerializedSavingsBox[];
  entry?: ExpenseEntryWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExpenseFormSheet({
  budgetId,
  categories,
  savingsBoxes,
  entry,
  open,
  onOpenChange,
}: ExpenseFormSheetProps) {
  const isEditing = !!entry;

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      description: entry?.description ?? "",
      amount: entry?.amount ?? 0,
      categoryId: entry?.categoryId ?? 0,
      isPaid: entry?.isPaid ?? false,
      savingsBoxId: entry?.savingsBoxId ?? null,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        description: entry?.description ?? "",
        amount: entry?.amount ?? 0,
        categoryId: entry?.categoryId ?? 0,
        isPaid: entry?.isPaid ?? false,
        savingsBoxId: entry?.savingsBoxId ?? null,
      });
    }
  }, [open, entry, form]);

  async function onSubmit(data: ExpenseFormValues) {
    const result = isEditing
      ? await updateExpenseAction(entry!.id, {
          description: data.description,
          amount: data.amount,
          categoryId: data.categoryId,
          isPaid: data.isPaid,
          savingsBoxId: data.savingsBoxId,
        })
      : await createExpenseAction(budgetId, { ...data, source: "manual" });

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(isEditing ? "Despesa atualizada" : "Despesa adicionada");
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[425px]">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Editar Despesa" : "Nova Despesa"}</SheetTitle>
          <SheetDescription>
            {isEditing ? "Altere os dados da despesa." : "Adicione uma nova despesa."}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="exp-description">Descrição</Label>
            <Input
              id="exp-description"
              placeholder="Ex: Aluguel"
              {...form.register("description")}
            />
            {form.formState.errors.description && (
              <p className="text-sm text-destructive">
                {form.formState.errors.description.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="exp-amount">Valor (R$)</Label>
            <Input
              id="exp-amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              {...form.register("amount", { valueAsNumber: true })}
            />
            {form.formState.errors.amount && (
              <p className="text-sm text-destructive">{form.formState.errors.amount.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select
              value={form.watch("categoryId")?.toString() || ""}
              onValueChange={(v) => form.setValue("categoryId", parseInt(v, 10))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Caixinha (opcional)</Label>
            <Select
              value={form.watch("savingsBoxId")?.toString() || "none"}
              onValueChange={(v) =>
                form.setValue("savingsBoxId", v === "none" ? null : parseInt(v, 10))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Nenhuma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                {savingsBoxes.map((b) => (
                  <SelectItem key={b.id} value={b.id.toString()}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="exp-isPaid"
              checked={form.watch("isPaid")}
              onCheckedChange={(v) => form.setValue("isPaid", v)}
            />
            <Label htmlFor="exp-isPaid">Pago</Label>
          </div>

          <SheetFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Salvando..." : "Salvar"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
