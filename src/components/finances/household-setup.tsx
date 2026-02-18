"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createHouseholdSchema, type CreateHouseholdInput } from "@/lib/schemas/finances";
import { createHouseholdAction } from "@/actions/household";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export function HouseholdSetup() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<CreateHouseholdInput>({
    resolver: zodResolver(createHouseholdSchema),
    defaultValues: { name: "" },
  });

  async function onSubmit(data: CreateHouseholdInput) {
    setError(null);
    const result = await createHouseholdAction(data);

    if (!result.success) {
      setError(result.error ?? "Erro ao criar household");
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Configurar Household</CardTitle>
          <CardDescription>
            Crie seu household para começar a gerenciar suas finanças. Você poderá convidar outros
            membros depois.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Field>
              <FieldLabel htmlFor="name">Nome do household</FieldLabel>
              <Input id="name" placeholder="Ex: Casa da Família" {...form.register("name")} />
              <FieldError>{form.formState.errors.name?.message}</FieldError>
            </Field>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Criando..." : "Criar Household"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
