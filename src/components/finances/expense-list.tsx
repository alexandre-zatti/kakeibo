"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency } from "@/lib/utils";
import { ExpenseSourceConfig } from "@/types/finances";
import type {
  ExpenseEntryWithRelations,
  ExpenseSourceType,
  SerializedCategory,
  SerializedSavingsBox,
} from "@/types/finances";
import { toggleExpensePaidAction } from "@/actions/expense";
import { ExpenseFormSheet } from "./expense-form-sheet";
import { ExpenseDeleteDialog } from "./expense-delete-dialog";
import { toast } from "sonner";

interface ExpenseListProps {
  budgetId: number;
  entries: ExpenseEntryWithRelations[];
  categories: SerializedCategory[];
  savingsBoxes: SerializedSavingsBox[];
  isClosed: boolean;
}

export function ExpenseList({
  budgetId,
  entries,
  categories,
  savingsBoxes,
  isClosed,
}: ExpenseListProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<ExpenseEntryWithRelations | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<ExpenseEntryWithRelations | null>(null);

  async function handleTogglePaid(entry: ExpenseEntryWithRelations) {
    const result = await toggleExpensePaidAction(entry.id, !entry.isPaid);
    if (!result.success) {
      toast.error(result.error);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Despesas ({entries.length})</h3>
        {!isClosed && (
          <Button variant="outline" size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="mr-1 h-3 w-3" />
            Despesa
          </Button>
        )}
      </div>

      <div className="space-y-1">
        {entries.length === 0 && (
          <p className="py-2 text-sm text-muted-foreground">Nenhuma despesa adicionada.</p>
        )}
        {entries.map((entry) => {
          const sourceConfig = ExpenseSourceConfig[entry.source as ExpenseSourceType];
          return (
            <div key={entry.id} className="flex items-center gap-2 rounded-md border px-3 py-2">
              <Checkbox
                checked={entry.isPaid}
                onCheckedChange={() => !isClosed && handleTogglePaid(entry)}
                disabled={isClosed}
              />
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span
                  className={`truncate text-sm ${entry.isPaid ? "line-through opacity-60" : ""}`}
                >
                  {entry.description}
                </span>
                <Badge variant="outline" className="shrink-0 text-xs">
                  {entry.category.name}
                </Badge>
                {entry.source !== "manual" && sourceConfig && (
                  <Badge variant={sourceConfig.variant} className="shrink-0 text-xs">
                    {sourceConfig.label}
                  </Badge>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span className="text-sm font-medium">{formatCurrency(entry.amount)}</span>
                {!isClosed && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setEditEntry(entry)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setDeleteEntry(entry)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ExpenseFormSheet
        budgetId={budgetId}
        categories={categories}
        savingsBoxes={savingsBoxes}
        entry={editEntry}
        open={formOpen || !!editEntry}
        onOpenChange={(open) => {
          if (!open) {
            setFormOpen(false);
            setEditEntry(null);
          }
        }}
      />

      {deleteEntry && (
        <ExpenseDeleteDialog
          entry={deleteEntry}
          open={!!deleteEntry}
          onOpenChange={(open) => {
            if (!open) setDeleteEntry(null);
          }}
        />
      )}
    </div>
  );
}
