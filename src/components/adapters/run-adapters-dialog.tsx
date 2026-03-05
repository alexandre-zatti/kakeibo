"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Play, Loader2 } from "lucide-react";
import { triggerAdapterRunAction } from "@/actions/adapter-run";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AdapterWithLastRun } from "@/types/finances";

interface RunAdaptersDialogProps {
  budgetId: number;
  adapters: AdapterWithLastRun[];
  disabled?: boolean;
}

export function RunAdaptersDialog({ budgetId, adapters, disabled }: RunAdaptersDialogProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const activeAdapters = adapters.filter((a) => a.isActive);

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (isOpen) setSelected(activeAdapters.map((a) => a.id));
  }

  function toggleAdapter(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleRun() {
    setLoading(true);
    try {
      const result = await triggerAdapterRunAction(budgetId, selected);
      if (result.success) {
        toast.success("Adaptadores iniciados! Verifique o progresso na página de adaptadores.");
        router.refresh();
        setOpen(false);
      } else {
        toast.error(result.error ?? "Erro ao iniciar adaptadores");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={disabled || activeAdapters.length === 0}
      >
        <Play className="mr-2 h-4 w-4" />
        Executar Adaptadores
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Executar Adaptadores</DialogTitle>
            <DialogDescription>Selecione quais adaptadores executar neste mês.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {activeAdapters.map((adapter) => (
              <label key={adapter.id} className="flex cursor-pointer items-center gap-3">
                <Checkbox
                  checked={selected.includes(adapter.id)}
                  onCheckedChange={() => toggleAdapter(adapter.id)}
                />
                <div>
                  <p className="text-sm font-medium">{adapter.name}</p>
                  {adapter.description && (
                    <p className="text-xs text-muted-foreground">{adapter.description}</p>
                  )}
                </div>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleRun} disabled={loading || selected.length === 0}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Executar ({selected.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
