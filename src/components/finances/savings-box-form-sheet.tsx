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
import { createSavingsBoxAction, updateSavingsBoxAction } from "@/actions/savings-box";
import type { SerializedSavingsBox } from "@/types/finances";
import { toast } from "sonner";
import { z } from "zod";

const savingsBoxFormSchema = z.object({
  name: z.string().min(1, "Nome e obrigatorio").max(255),
  monthlyTarget: z.number().positive("Valor deve ser positivo").optional().nullable(),
  goalAmount: z.number().positive("Valor deve ser positivo").optional().nullable(),
});

type SavingsBoxFormValues = z.infer<typeof savingsBoxFormSchema>;

interface SavingsBoxFormSheetProps {
  box?: SerializedSavingsBox | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SavingsBoxFormSheet({ box, open, onOpenChange }: SavingsBoxFormSheetProps) {
  const isEditing = !!box;

  const form = useForm<SavingsBoxFormValues>({
    resolver: zodResolver(savingsBoxFormSchema),
    defaultValues: {
      name: box?.name ?? "",
      monthlyTarget: box?.monthlyTarget ?? null,
      goalAmount: box?.goalAmount ?? null,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: box?.name ?? "",
        monthlyTarget: box?.monthlyTarget ?? null,
        goalAmount: box?.goalAmount ?? null,
      });
    }
  }, [open, box, form]);

  async function onSubmit(data: SavingsBoxFormValues) {
    const result = isEditing
      ? await updateSavingsBoxAction(box!.id, data)
      : await createSavingsBoxAction(data);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(isEditing ? "Caixinha atualizada" : "Caixinha criada");
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[425px]">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Editar Caixinha" : "Nova Caixinha"}</SheetTitle>
          <SheetDescription>
            {isEditing ? "Altere os dados da caixinha." : "Crie uma nova caixinha de economia."}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="box-name">Nome</Label>
            <Input id="box-name" placeholder="Ex: Ferias" {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="box-monthlyTarget">Meta Mensal (R$)</Label>
            <Input
              id="box-monthlyTarget"
              type="number"
              step="0.01"
              min="0"
              placeholder="Opcional"
              {...form.register("monthlyTarget", {
                setValueAs: (v) => (v === "" || v === null ? null : Number(v)),
              })}
            />
            {form.formState.errors.monthlyTarget && (
              <p className="text-sm text-destructive">
                {form.formState.errors.monthlyTarget.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="box-goalAmount">Meta Total (R$)</Label>
            <Input
              id="box-goalAmount"
              type="number"
              step="0.01"
              min="0"
              placeholder="Opcional"
              {...form.register("goalAmount", {
                setValueAs: (v) => (v === "" || v === null ? null : Number(v)),
              })}
            />
            {form.formState.errors.goalAmount && (
              <p className="text-sm text-destructive">{form.formState.errors.goalAmount.message}</p>
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
