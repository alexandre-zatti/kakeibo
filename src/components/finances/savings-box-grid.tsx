"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { SerializedSavingsBox } from "@/types/finances";
import { SavingsBoxCard } from "./savings-box-card";
import { SavingsBoxFormSheet } from "./savings-box-form-sheet";

interface SavingsBoxGridProps {
  boxes: SerializedSavingsBox[];
}

export function SavingsBoxGrid({ boxes }: SavingsBoxGridProps) {
  const [formOpen, setFormOpen] = useState(false);

  const totalBalance = boxes.reduce((sum, box) => sum + box.balance, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div>
            <p className="text-sm text-muted-foreground">Total em Caixinhas</p>
            <p className="text-2xl font-bold">{formatCurrency(totalBalance)}</p>
          </div>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Nova Caixinha
          </Button>
        </CardContent>
      </Card>

      {boxes.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          Nenhuma caixinha criada ainda. Crie sua primeira!
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boxes.map((box) => (
            <SavingsBoxCard key={box.id} box={box} />
          ))}
        </div>
      )}

      <SavingsBoxFormSheet open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
