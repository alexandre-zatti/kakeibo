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
import { createIncomeSchema, type CreateIncomeInput } from "@/lib/schemas/finances";
import { createIncomeAction, updateIncomeAction } from "@/actions/income";
import type { IncomeEntryWithCategory, SerializedCategory } from "@/types/finances";
import { toast } from "sonner";

interface IncomeFormSheetProps {
  budgetId: number;
  categories: SerializedCategory[];
  entry?: IncomeEntryWithCategory | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IncomeFormSheet({
  budgetId,
  categories,
  entry,
  open,
  onOpenChange,
}: IncomeFormSheetProps) {
  const isEditing = !!entry;

  const form = useForm<CreateIncomeInput>({
    resolver: zodResolver(createIncomeSchema),
    defaultValues: {
      description: entry?.description ?? "",
      amount: entry?.amount ?? 0,
      categoryId: entry?.categoryId ?? 0,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        description: entry?.description ?? "",
        amount: entry?.amount ?? 0,
        categoryId: entry?.categoryId ?? 0,
      });
    }
  }, [open, entry, form]);

  async function onSubmit(data: CreateIncomeInput) {
    const result = isEditing
      ? await updateIncomeAction(entry!.id, data)
      : await createIncomeAction(budgetId, data);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(isEditing ? "Receita atualizada" : "Receita adicionada");
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[425px]">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Editar Receita" : "Nova Receita"}</SheetTitle>
          <SheetDescription>
            {isEditing ? "Altere os dados da receita." : "Adicione uma nova fonte de receita."}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input id="description" placeholder="Ex: Salário" {...form.register("description")} />
            {form.formState.errors.description && (
              <p className="text-sm text-destructive">
                {form.formState.errors.description.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Valor (R$)</Label>
            <Input
              id="amount"
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
            {form.formState.errors.categoryId && (
              <p className="text-sm text-destructive">{form.formState.errors.categoryId.message}</p>
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
