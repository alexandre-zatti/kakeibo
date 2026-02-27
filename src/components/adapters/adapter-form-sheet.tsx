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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createAdapterAction, updateAdapterAction } from "@/actions/adapter";
import { createAdapterSchema, updateAdapterSchema } from "@/lib/schemas/finances";
import type { SerializedAdapter } from "@/types/finances";
import { toast } from "sonner";
import { z } from "zod";

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(255, "Nome muito longo"),
  description: z.string().max(1000, "Descrição muito longa").optional().nullable(),
  moduleKey: z.string().min(1, "Módulo é obrigatório"),
});

type AdapterFormValues = z.infer<typeof formSchema>;

interface AdapterFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableModules: { key: string; label: string; description: string }[];
  adapter?: SerializedAdapter | null;
}

export function AdapterFormSheet({
  open,
  onOpenChange,
  availableModules,
  adapter,
}: AdapterFormSheetProps) {
  const isEditing = !!adapter;

  const form = useForm<AdapterFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: adapter?.name ?? "",
      description: adapter?.description ?? "",
      moduleKey: adapter?.moduleKey ?? "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: adapter?.name ?? "",
        description: adapter?.description ?? "",
        moduleKey: adapter?.moduleKey ?? "",
      });
    }
  }, [open, adapter, form]);

  async function onSubmit(data: AdapterFormValues) {
    const payload = {
      ...data,
      description: data.description || null,
    };

    const result = isEditing
      ? await updateAdapterAction(adapter!.id, updateAdapterSchema.parse(payload))
      : await createAdapterAction(createAdapterSchema.parse(payload));

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(isEditing ? "Adaptador atualizado" : "Adaptador criado");
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[425px]">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Editar Adaptador" : "Novo Adaptador"}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Altere os dados do adaptador."
              : "Configure um novo adaptador para importar dados automaticamente."}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="adapter-name">Nome</Label>
            <Input id="adapter-name" placeholder="Ex: Gmail Fatura" {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="adapter-description">Descrição (opcional)</Label>
            <Input
              id="adapter-description"
              placeholder="Ex: Importa faturas do Gmail"
              {...form.register("description")}
            />
            {form.formState.errors.description && (
              <p className="text-sm text-destructive">
                {form.formState.errors.description.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Módulo</Label>
            <Select
              value={form.watch("moduleKey") || ""}
              onValueChange={(v) => form.setValue("moduleKey", v, { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o módulo..." />
              </SelectTrigger>
              <SelectContent>
                {availableModules.map((mod) => (
                  <SelectItem key={mod.key} value={mod.key}>
                    <span>{mod.label}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{mod.description}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.moduleKey && (
              <p className="text-sm text-destructive">{form.formState.errors.moduleKey.message}</p>
            )}
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
