"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
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
  reconcileMonthAction,
  distributeBalanceAction,
  closeMonthAction,
} from "@/actions/month-closing";
import { formatCurrency } from "@/lib/utils";
import type { MonthlyBudgetDetail, SerializedSavingsBox } from "@/types/finances";
import { toast } from "sonner";

type Step = "reconcile" | "distribute" | "close" | "done";

interface MonthClosingWizardProps {
  budget: MonthlyBudgetDetail;
  savingsBoxes: SerializedSavingsBox[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MonthClosingWizard({
  budget,
  savingsBoxes,
  open,
  onOpenChange,
}: MonthClosingWizardProps) {
  const [step, setStep] = useState<Step>("reconcile");
  const [bankBalance, setBankBalance] = useState<string>("");
  const [allocations, setAllocations] = useState<Record<number, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const calculatedAvailable = budget.totalAvailable;
  const bankBalanceNum = parseFloat(bankBalance) || 0;
  const discrepancy = bankBalanceNum - calculatedAvailable;

  const totalAllocated = Object.values(allocations).reduce(
    (sum, v) => sum + (parseFloat(v) || 0),
    0
  );
  const remaining = bankBalanceNum - totalAllocated;

  function handleReset() {
    setStep("reconcile");
    setBankBalance("");
    setAllocations({});
    setIsSubmitting(false);
  }

  async function handleReconcile() {
    if (bankBalanceNum < 0) {
      toast.error("Saldo nao pode ser negativo");
      return;
    }

    setIsSubmitting(true);
    const result = await reconcileMonthAction(budget.id, { bankBalance: bankBalanceNum });
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    setStep("distribute");
  }

  async function handleDistribute() {
    const entries = Object.entries(allocations)
      .map(([boxId, amount]) => ({
        savingsBoxId: parseInt(boxId, 10),
        amount: parseFloat(amount) || 0,
      }))
      .filter((e) => e.amount > 0);

    if (entries.length === 0 && bankBalanceNum > 0) {
      toast.error("Distribua o saldo para as caixinhas");
      return;
    }

    if (Math.abs(remaining) > 0.01 && bankBalanceNum > 0) {
      toast.error("Distribua todo o saldo restante");
      return;
    }

    if (entries.length > 0) {
      setIsSubmitting(true);
      const result = await distributeBalanceAction(budget.id, { allocations: entries });
      setIsSubmitting(false);

      if (!result.success) {
        toast.error(result.error);
        return;
      }
    }

    setStep("close");
  }

  async function handleClose() {
    setIsSubmitting(true);
    const result = await closeMonthAction(budget.id);
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    setStep("done");
    toast.success("Mes fechado com sucesso!");
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) handleReset();
        onOpenChange(o);
      }}
    >
      <SheetContent className="sm:max-w-[500px]">
        <SheetHeader>
          <SheetTitle>Fechar Mes</SheetTitle>
          <SheetDescription>
            {step === "reconcile" && "Passo 1: Conciliar saldo bancario"}
            {step === "distribute" && "Passo 2: Distribuir saldo para caixinhas"}
            {step === "close" && "Passo 3: Confirmar fechamento"}
            {step === "done" && "Mes fechado!"}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          {step === "reconcile" && (
            <>
              <div className="space-y-2 rounded-md border p-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Receitas</span>
                  <span>{formatCurrency(budget.totalIncome)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Despesas</span>
                  <span>{formatCurrency(budget.totalExpensesForecast)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 text-sm font-medium">
                  <span>Disponivel Calculado</span>
                  <span>{formatCurrency(calculatedAvailable)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bank-balance">Saldo Real no Banco (R$)</Label>
                <Input
                  id="bank-balance"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={bankBalance}
                  onChange={(e) => setBankBalance(e.target.value)}
                />
              </div>

              {bankBalance !== "" && Math.abs(discrepancy) > 0.01 && (
                <div className="rounded-md border border-yellow-500/50 bg-yellow-500/10 p-3">
                  <p className="text-sm">
                    Discrepancia: <strong>{formatCurrency(discrepancy)}</strong>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Verifique despesas faltantes ou ajuste valores antes de continuar.
                  </p>
                </div>
              )}

              <SheetFooter className="pt-4">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleReconcile} disabled={isSubmitting || bankBalance === ""}>
                  {isSubmitting ? "Salvando..." : "Proximo"}
                </Button>
              </SheetFooter>
            </>
          )}

          {step === "distribute" && (
            <>
              <div className="space-y-1 rounded-md border p-3">
                <div className="flex justify-between text-sm font-medium">
                  <span>Saldo Bancario</span>
                  <span>{formatCurrency(bankBalanceNum)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Distribuido</span>
                  <span>{formatCurrency(totalAllocated)}</span>
                </div>
                <div className="flex justify-between border-t pt-1 text-sm font-medium">
                  <span>Restante</span>
                  <span className={remaining > 0.01 ? "text-yellow-500" : "text-green-500"}>
                    {formatCurrency(remaining)}
                  </span>
                </div>
              </div>

              {savingsBoxes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma caixinha cadastrada. Crie uma em Caixinhas.
                </p>
              ) : (
                <div className="space-y-3">
                  {savingsBoxes.map((box) => (
                    <div key={box.id} className="flex items-center gap-3">
                      <div className="flex-1">
                        <Label className="text-sm">{box.name}</Label>
                        <p className="text-xs text-muted-foreground">
                          Saldo: {formatCurrency(box.balance)}
                        </p>
                      </div>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        className="w-28"
                        value={allocations[box.id] ?? ""}
                        onChange={(e) =>
                          setAllocations((prev) => ({ ...prev, [box.id]: e.target.value }))
                        }
                      />
                    </div>
                  ))}
                </div>
              )}

              <SheetFooter className="pt-4">
                <Button variant="outline" onClick={() => setStep("reconcile")}>
                  Voltar
                </Button>
                <Button onClick={handleDistribute} disabled={isSubmitting}>
                  {isSubmitting ? "Distribuindo..." : "Proximo"}
                </Button>
              </SheetFooter>
            </>
          )}

          {step === "close" && (
            <>
              <div className="space-y-2 rounded-md border p-3 text-center">
                <p className="text-sm">Tudo pronto para fechar o mes.</p>
                <p className="text-xs text-muted-foreground">
                  O mes ficara somente-leitura e o proximo mes sera criado automaticamente.
                </p>
              </div>

              <SheetFooter className="pt-4">
                <Button variant="outline" onClick={() => setStep("distribute")}>
                  Voltar
                </Button>
                <Button onClick={handleClose} disabled={isSubmitting}>
                  {isSubmitting ? "Fechando..." : "Fechar Mes"}
                </Button>
              </SheetFooter>
            </>
          )}

          {step === "done" && (
            <>
              <div className="flex flex-col items-center gap-3 py-6">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
                <p className="text-lg font-medium">Mes fechado com sucesso!</p>
                <p className="text-sm text-muted-foreground">
                  O proximo mes ja esta disponivel para uso.
                </p>
              </div>

              <SheetFooter className="pt-4">
                <Button onClick={() => onOpenChange(false)}>Fechar</Button>
              </SheetFooter>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
