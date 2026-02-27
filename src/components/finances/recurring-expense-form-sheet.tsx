"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  createRecurringExpenseAction,
  updateRecurringExpenseAction,
} from "@/actions/recurring-expense";
import type { SerializedRecurringExpense, SerializedCategory } from "@/types/finances";
import { toast } from "sonner";
import { z } from "zod";

const recurringFormSchema = z.object({
  description: z.string().min(1, "Descricao e obrigatoria").max(255),
  amount: z.number().positive("Valor deve ser positivo"),
  categoryId: z.number().int().positive("Categoria e obrigatoria"),
  dayOfMonth: z.number().int().min(1).max(31).optional().nullable(),
});

type RecurringFormValues = z.infer<typeof recurringFormSchema>;

interface RecurringExpenseFormSheetProps {
  categories: SerializedCategory[];
  entry?: SerializedRecurringExpense | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RecurringExpenseFormSheet({
  categories,
  entry,
  open,
  onOpenChange,
}: RecurringExpenseFormSheetProps) {
  const isEditing = !!entry;

  const form = useForm<RecurringFormValues>({
    resolver: zodResolver(recurringFormSchema),
    defaultValues: {
      description: entry?.description ?? "",
      amount: entry?.amount ?? 0,
      categoryId: entry?.categoryId ?? 0,
      dayOfMonth: entry?.dayOfMonth ?? null,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        description: entry?.description ?? "",
        amount: entry?.amount ?? 0,
        categoryId: entry?.categoryId ?? 0,
        dayOfMonth: entry?.dayOfMonth ?? null,
      });
    }
  }, [open, entry, form]);

  async function onSubmit(data: RecurringFormValues) {
    const result = isEditing
      ? await updateRecurringExpenseAction(entry!.id, data)
      : await createRecurringExpenseAction(data);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(isEditing ? "Recorrente atualizada" : "Recorrente criada");
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[425px]">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Editar Recorrente" : "Nova Recorrente"}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Altere os dados da despesa recorrente."
              : "Adicione uma nova despesa recorrente."}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="rec-description">Descricao</Label>
            <Input
              id="rec-description"
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
            <Label htmlFor="rec-amount">Valor (R$)</Label>
            <Input
              id="rec-amount"
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
            <Label htmlFor="rec-dayOfMonth">Dia do mes (opcional)</Label>
            <Input
              id="rec-dayOfMonth"
              type="number"
              min="1"
              max="31"
              placeholder="Ex: 10"
              {...form.register("dayOfMonth", {
                setValueAs: (v) => (v === "" || v === null ? null : Number(v)),
              })}
            />
            {form.formState.errors.dayOfMonth && (
              <p className="text-sm text-destructive">{form.formState.errors.dayOfMonth.message}</p>
            )}
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
