"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, Loader2 } from "lucide-react";
import { triggerAdapterRunAction } from "@/actions/adapter-run";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface RunAdaptersButtonProps {
  budgetId: number;
  disabled?: boolean;
}

export function RunAdaptersButton({ budgetId, disabled }: RunAdaptersButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleRun() {
    setLoading(true);
    try {
      const result = await triggerAdapterRunAction(budgetId);
      if (result.success) {
        toast.success("Adaptadores iniciados! Verifique o progresso na página de adaptadores.");
        router.refresh();
      } else {
        toast.error(result.error ?? "Erro ao iniciar adaptadores");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleRun} disabled={disabled || loading}>
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Play className="mr-2 h-4 w-4" />
      )}
      Executar Adaptadores
    </Button>
  );
}
