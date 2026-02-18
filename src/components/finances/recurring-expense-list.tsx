"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { toggleRecurringExpenseActiveAction } from "@/actions/recurring-expense";
import type { SerializedRecurringExpense, SerializedCategory } from "@/types/finances";
import { RecurringExpenseFormSheet } from "./recurring-expense-form-sheet";
import { RecurringExpenseDeleteDialog } from "./recurring-expense-delete-dialog";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

interface RecurringExpenseListProps {
  expenses: SerializedRecurringExpense[];
  categories: SerializedCategory[];
}

export function RecurringExpenseList({ expenses, categories }: RecurringExpenseListProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<SerializedRecurringExpense | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<SerializedRecurringExpense | null>(null);
  const isMobile = useIsMobile();

  async function handleToggleActive(id: number, isActive: boolean) {
    const result = await toggleRecurringExpenseActiveAction(id, isActive);
    if (!result.success) {
      toast.error(result.error);
    }
  }

  function getCategoryName(expense: SerializedRecurringExpense): string {
    // The service includes category in the join, so it might be on the object
    const cat = (expense as unknown as { category?: { name: string } }).category;
    if (cat?.name) return cat.name;
    const found = categories.find((c) => c.id === expense.categoryId);
    return found?.name ?? "";
  }

  if (isMobile) {
    return (
      <div className="space-y-4">
        <Button onClick={() => setFormOpen(true)} className="w-full">
          <Plus className="mr-1 h-4 w-4" />
          Nova Recorrente
        </Button>

        {expenses.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">
            Nenhuma despesa recorrente cadastrada.
          </p>
        ) : (
          <div className="space-y-2">
            {expenses.map((expense) => (
              <Card key={expense.id} className={expense.isActive ? "" : "opacity-60"}>
                <CardContent className="flex items-center justify-between py-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{expense.description}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{formatCurrency(expense.amount)}</span>
                      <Badge variant="outline" className="text-xs">
                        {getCategoryName(expense)}
                      </Badge>
                      {expense.dayOfMonth && (
                        <span className="text-xs text-muted-foreground">
                          Dia {expense.dayOfMonth}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={expense.isActive}
                      onCheckedChange={(v) => handleToggleActive(expense.id, v)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setEditEntry(expense)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <RecurringExpenseFormSheet
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
          <RecurringExpenseDeleteDialog
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

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Nova Recorrente
        </Button>
      </div>

      {expenses.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          Nenhuma despesa recorrente cadastrada.
        </p>
      ) : (
        <div className="rounded-md border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left text-sm font-medium">Descricao</th>
                <th className="px-4 py-2 text-left text-sm font-medium">Valor</th>
                <th className="px-4 py-2 text-left text-sm font-medium">Categoria</th>
                <th className="px-4 py-2 text-left text-sm font-medium">Dia</th>
                <th className="px-4 py-2 text-center text-sm font-medium">Ativo</th>
                <th className="px-4 py-2 text-right text-sm font-medium">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id} className={`border-b ${expense.isActive ? "" : "opacity-60"}`}>
                  <td className="px-4 py-2 text-sm">{expense.description}</td>
                  <td className="px-4 py-2 text-sm font-medium">
                    {formatCurrency(expense.amount)}
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant="outline" className="text-xs">
                      {getCategoryName(expense)}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-sm text-muted-foreground">
                    {expense.dayOfMonth ?? "-"}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <Switch
                      checked={expense.isActive}
                      onCheckedChange={(v) => handleToggleActive(expense.id, v)}
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setEditEntry(expense)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RecurringExpenseFormSheet
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
        <RecurringExpenseDeleteDialog
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
