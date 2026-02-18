"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SerializedCategory, CategoryTypeValue } from "@/types/finances";
import { CategoryFormSheet } from "./category-form-sheet";
import { CategoryDeleteDialog } from "./category-delete-dialog";

interface CategoryListProps {
  title: string;
  type: CategoryTypeValue;
  categories: SerializedCategory[];
}

export function CategoryList({ title, type, categories }: CategoryListProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<SerializedCategory | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<SerializedCategory | null>(null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base">{title}</CardTitle>
        <Button variant="outline" size="sm" onClick={() => setFormOpen(true)}>
          <Plus className="mr-1 h-3 w-3" />
          Categoria
        </Button>
      </CardHeader>
      <CardContent>
        {categories.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nenhuma categoria cadastrada.
          </p>
        ) : (
          <div className="space-y-1">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  {cat.color && (
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.color }} />
                  )}
                  <span className="text-sm">{cat.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setEditEntry(cat)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setDeleteEntry(cat)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <CategoryFormSheet
        type={type}
        category={editEntry}
        open={formOpen || !!editEntry}
        onOpenChange={(open) => {
          if (!open) {
            setFormOpen(false);
            setEditEntry(null);
          }
        }}
      />

      {deleteEntry && (
        <CategoryDeleteDialog
          category={deleteEntry}
          open={!!deleteEntry}
          onOpenChange={(open) => {
            if (!open) setDeleteEntry(null);
          }}
        />
      )}
    </Card>
  );
}
