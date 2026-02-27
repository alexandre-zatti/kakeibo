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
import { addSavingsTransactionAction } from "@/actions/savings-box";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { z } from "zod";

interface SavingsTransactionSheetProps {
  boxId: number;
  boxBalance: number;
  type: "contribution" | "withdrawal";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SavingsTransactionSheet({
  boxId,
  boxBalance,
  type,
  open,
  onOpenChange,
}: SavingsTransactionSheetProps) {
  const isWithdrawal = type === "withdrawal";

  const schema = z.object({
    amount: z
      .number()
      .positive("Valor deve ser positivo")
      .refine((v) => !isWithdrawal || v <= boxBalance, {
        message: `Valor maximo: ${formatCurrency(boxBalance)}`,
      }),
    description: z.string().max(255).optional(),
  });

  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: 0, description: "" },
  });

  useEffect(() => {
    if (open) {
      form.reset({ amount: 0, description: "" });
    }
  }, [open, form]);

  async function onSubmit(data: FormValues) {
    const result = await addSavingsTransactionAction(boxId, {
      type,
      amount: data.amount,
      description: data.description || null,
      source: "manual",
    });

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(isWithdrawal ? "Retirada registrada" : "Aporte registrado");
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[425px]">
        <SheetHeader>
          <SheetTitle>{isWithdrawal ? "Retirar" : "Contribuir"}</SheetTitle>
          <SheetDescription>
            {isWithdrawal
              ? `Saldo disponivel: ${formatCurrency(boxBalance)}`
              : "Adicione um aporte a esta caixinha."}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="tx-amount">Valor (R$)</Label>
            <Input
              id="tx-amount"
              type="number"
              step="0.01"
              min="0"
              max={isWithdrawal ? boxBalance : undefined}
              placeholder="0.00"
              {...form.register("amount", { valueAsNumber: true })}
            />
            {form.formState.errors.amount && (
              <p className="text-sm text-destructive">{form.formState.errors.amount.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tx-description">Descricao (opcional)</Label>
            <Input
              id="tx-description"
              placeholder="Ex: Consulta veterinaria"
              {...form.register("description")}
            />
          </div>

          <SheetFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Salvando..." : "Confirmar"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
