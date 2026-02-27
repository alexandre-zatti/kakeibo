import { z } from "zod";

// =============================================================================
// Household
// =============================================================================

export const createHouseholdSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(255),
});

export type CreateHouseholdInput = z.infer<typeof createHouseholdSchema>;

export const inviteHouseholdMemberSchema = z.object({
  email: z.string().email("Email inválido"),
});

export type InviteHouseholdMemberInput = z.infer<typeof inviteHouseholdMemberSchema>;

// =============================================================================
// Category
// =============================================================================

export const createCategorySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(255),
  type: z.enum(["income", "expense"], { message: "Tipo é obrigatório" }),
  icon: z.string().max(50).optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor deve ser hex (#RRGGBB)")
    .optional()
    .nullable(),
  sortOrder: z.number().int().default(0),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  icon: z.string().max(50).optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor deve ser hex (#RRGGBB)")
    .optional()
    .nullable(),
  sortOrder: z.number().int().optional(),
});

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

// =============================================================================
// Income
// =============================================================================

export const createIncomeSchema = z.object({
  description: z.string().min(1, "Descrição é obrigatória").max(255),
  amount: z.number().positive("Valor deve ser positivo"),
  categoryId: z.number().int().positive("Categoria é obrigatória"),
});

export type CreateIncomeInput = z.infer<typeof createIncomeSchema>;

export const updateIncomeSchema = z.object({
  description: z.string().min(1).max(255).optional(),
  amount: z.number().positive("Valor deve ser positivo").optional(),
  categoryId: z.number().int().positive().optional(),
});

export type UpdateIncomeInput = z.infer<typeof updateIncomeSchema>;

// =============================================================================
// Expense
// =============================================================================

export const createExpenseSchema = z.object({
  description: z.string().min(1, "Descrição é obrigatória").max(255),
  amount: z.number().positive("Valor deve ser positivo"),
  categoryId: z.number().int().positive("Categoria é obrigatória"),
  isPaid: z.boolean().default(false),
  source: z.enum(["manual", "draft", "auto", "recurring"]).default("manual"),
  savingsBoxId: z.number().int().positive().optional().nullable(),
  recurringExpenseId: z.number().int().positive().optional().nullable(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const updateExpenseSchema = z.object({
  description: z.string().min(1).max(255).optional(),
  amount: z.number().positive("Valor deve ser positivo").optional(),
  categoryId: z.number().int().positive().optional(),
  isPaid: z.boolean().optional(),
  savingsBoxId: z.number().int().positive().optional().nullable(),
});

export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

// =============================================================================
// Recurring Expense
// =============================================================================

export const createRecurringExpenseSchema = z.object({
  description: z.string().min(1, "Descrição é obrigatória").max(255),
  amount: z.number().positive("Valor deve ser positivo"),
  categoryId: z.number().int().positive("Categoria é obrigatória"),
  dayOfMonth: z.number().int().min(1).max(31).optional().nullable(),
});

export type CreateRecurringExpenseInput = z.infer<typeof createRecurringExpenseSchema>;

export const updateRecurringExpenseSchema = z.object({
  description: z.string().min(1).max(255).optional(),
  amount: z.number().positive("Valor deve ser positivo").optional(),
  categoryId: z.number().int().positive().optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional().nullable(),
});

export type UpdateRecurringExpenseInput = z.infer<typeof updateRecurringExpenseSchema>;

// =============================================================================
// Savings Box
// =============================================================================

export const createSavingsBoxSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(255),
  monthlyTarget: z.number().positive("Valor deve ser positivo").optional().nullable(),
  goalAmount: z.number().positive("Valor deve ser positivo").optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor deve ser hex (#RRGGBB)")
    .optional()
    .nullable(),
});

export type CreateSavingsBoxInput = z.infer<typeof createSavingsBoxSchema>;

export const updateSavingsBoxSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  monthlyTarget: z.number().positive("Valor deve ser positivo").optional().nullable(),
  goalAmount: z.number().positive("Valor deve ser positivo").optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor deve ser hex (#RRGGBB)")
    .optional()
    .nullable(),
});

export type UpdateSavingsBoxInput = z.infer<typeof updateSavingsBoxSchema>;

// =============================================================================
// Savings Transaction
// =============================================================================

export const createSavingsTransactionSchema = z.object({
  type: z.enum(["contribution", "withdrawal"], { message: "Tipo é obrigatório" }),
  amount: z.number().positive("Valor deve ser positivo"),
  description: z.string().max(255).optional().nullable(),
  source: z.enum(["manual", "closing", "expense_link"]).default("manual"),
});

export type CreateSavingsTransactionInput = z.infer<typeof createSavingsTransactionSchema>;

// =============================================================================
// Month Closing
// =============================================================================

export const reconcileMonthSchema = z.object({
  bankBalance: z.number().min(0, "Saldo não pode ser negativo"),
});

export type ReconcileMonthInput = z.infer<typeof reconcileMonthSchema>;

export const distributeBalanceSchema = z.object({
  allocations: z
    .array(
      z.object({
        savingsBoxId: z.number().int().positive(),
        amount: z.number().positive("Valor deve ser positivo"),
      })
    )
    .min(1, "Ao menos uma alocação é necessária"),
});

export type DistributeBalanceInput = z.infer<typeof distributeBalanceSchema>;

// =============================================================================
// URL Params
// =============================================================================

export const monthParamsSchema = z.object({
  year: z.coerce.number().int(),
  month: z.coerce.number().int().min(1).max(12),
});

export type MonthParams = z.infer<typeof monthParamsSchema>;
