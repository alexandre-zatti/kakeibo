"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import type { IncomeEntryWithCategory, SerializedCategory } from "@/types/finances";
import { IncomeFormSheet } from "./income-form-sheet";
import { IncomeDeleteDialog } from "./income-delete-dialog";

interface IncomeSectionProps {
  budgetId: number;
  entries: IncomeEntryWithCategory[];
  categories: SerializedCategory[];
  isClosed: boolean;
}

export function IncomeSection({ budgetId, entries, categories, isClosed }: IncomeSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<IncomeEntryWithCategory | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<IncomeEntryWithCategory | null>(null);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 text-sm font-semibold"
        >
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Receitas ({entries.length})
        </button>
        {!isClosed && (
          <Button variant="outline" size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="mr-1 h-3 w-3" />
            Receita
          </Button>
        )}
      </div>

      {isOpen && (
        <div className="space-y-1">
          {entries.length === 0 && (
            <p className="py-2 text-sm text-muted-foreground">Nenhuma receita adicionada.</p>
          )}
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{entry.description}</span>
                <Badge variant="outline" className="text-xs">
                  {entry.category.name}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-green-500">
                  {formatCurrency(entry.amount)}
                </span>
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
          ))}
        </div>
      )}

      <IncomeFormSheet
        budgetId={budgetId}
        categories={categories}
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
        <IncomeDeleteDialog
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
