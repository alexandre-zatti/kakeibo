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
import { createCategoryAction, updateCategoryAction } from "@/actions/category";
import type { SerializedCategory, CategoryTypeValue } from "@/types/finances";
import { toast } from "sonner";
import { z } from "zod";

const categoryFormSchema = z.object({
  name: z.string().min(1, "Nome e obrigatorio").max(255),
  icon: z.string().max(50).optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor deve ser hex (#RRGGBB)")
    .optional()
    .nullable()
    .or(z.literal("")),
  sortOrder: z.number().int(),
});

type CategoryFormValues = z.infer<typeof categoryFormSchema>;

interface CategoryFormSheetProps {
  type: CategoryTypeValue;
  category?: SerializedCategory | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CategoryFormSheet({ type, category, open, onOpenChange }: CategoryFormSheetProps) {
  const isEditing = !!category;

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: category?.name ?? "",
      icon: category?.icon ?? null,
      color: category?.color ?? "",
      sortOrder: category?.sortOrder ?? 0,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: category?.name ?? "",
        icon: category?.icon ?? null,
        color: category?.color ?? "",
        sortOrder: category?.sortOrder ?? 0,
      });
    }
  }, [open, category, form]);

  async function onSubmit(data: CategoryFormValues) {
    const cleanColor = data.color === "" ? null : data.color;

    const result = isEditing
      ? await updateCategoryAction(category!.id, {
          name: data.name,
          icon: data.icon,
          color: cleanColor,
          sortOrder: data.sortOrder,
        })
      : await createCategoryAction({
          name: data.name,
          type,
          icon: data.icon,
          color: cleanColor,
          sortOrder: data.sortOrder,
        });

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(isEditing ? "Categoria atualizada" : "Categoria criada");
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[425px]">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Editar Categoria" : "Nova Categoria"}</SheetTitle>
          <SheetDescription>
            {isEditing ? "Altere os dados da categoria." : "Crie uma nova categoria."}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="cat-name">Nome</Label>
            <Input id="cat-name" placeholder="Ex: Alimentacao" {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cat-color">Cor (opcional)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="cat-color"
                type="color"
                className="h-9 w-14 p-1"
                value={form.watch("color") || "#000000"}
                onChange={(e) => form.setValue("color", e.target.value)}
              />
              <Input placeholder="#RRGGBB" {...form.register("color")} className="flex-1" />
            </div>
            {form.formState.errors.color && (
              <p className="text-sm text-destructive">{form.formState.errors.color.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cat-sortOrder">Ordem</Label>
            <Input
              id="cat-sortOrder"
              type="number"
              min="0"
              {...form.register("sortOrder", { valueAsNumber: true })}
            />
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
