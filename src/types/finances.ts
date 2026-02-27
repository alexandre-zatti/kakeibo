import type {
  Category,
  ExpenseEntry,
  Household,
  HouseholdMember,
  IncomeEntry,
  MonthlyBudget,
  RecurringExpense,
  SavingsBox,
  SavingsTransaction,
  User,
} from "@prisma/client";

// =============================================================================
// Enums & Config
// =============================================================================

export const MonthlyBudgetStatus = {
  OPEN: "open",
  CLOSED: "closed",
} as const;

export type MonthlyBudgetStatusType =
  (typeof MonthlyBudgetStatus)[keyof typeof MonthlyBudgetStatus];

export const ExpenseSource = {
  MANUAL: "manual",
  DRAFT: "draft",
  AUTO: "auto",
  RECURRING: "recurring",
} as const;

export type ExpenseSourceType = (typeof ExpenseSource)[keyof typeof ExpenseSource];

export const ExpenseSourceConfig: Record<
  ExpenseSourceType,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  [ExpenseSource.MANUAL]: { label: "Manual", variant: "default" },
  [ExpenseSource.DRAFT]: { label: "Rascunho", variant: "secondary" },
  [ExpenseSource.AUTO]: { label: "Auto", variant: "outline" },
  [ExpenseSource.RECURRING]: { label: "Recorrente", variant: "outline" },
};

export const CategoryType = {
  INCOME: "income",
  EXPENSE: "expense",
} as const;

export type CategoryTypeValue = (typeof CategoryType)[keyof typeof CategoryType];

export const SavingsTransactionType = {
  CONTRIBUTION: "contribution",
  WITHDRAWAL: "withdrawal",
} as const;

export type SavingsTransactionTypeValue =
  (typeof SavingsTransactionType)[keyof typeof SavingsTransactionType];

export const SavingsTransactionSource = {
  MANUAL: "manual",
  CLOSING: "closing",
  EXPENSE_LINK: "expense_link",
} as const;

export type SavingsTransactionSourceValue =
  (typeof SavingsTransactionSource)[keyof typeof SavingsTransactionSource];

export const HouseholdRole = {
  OWNER: "owner",
  MEMBER: "member",
} as const;

export type HouseholdRoleType = (typeof HouseholdRole)[keyof typeof HouseholdRole];

// =============================================================================
// Serialized Types (Decimal -> number for JSON transport)
// =============================================================================

export interface SerializedCategory extends Category {}

export interface SerializedIncomeEntry extends Omit<IncomeEntry, "amount"> {
  amount: number;
}

export interface SerializedExpenseEntry extends Omit<ExpenseEntry, "amount"> {
  amount: number;
}

export interface SerializedRecurringExpense extends Omit<RecurringExpense, "amount"> {
  amount: number;
}

export interface SerializedSavingsBox extends Omit<
  SavingsBox,
  "balance" | "monthlyTarget" | "goalAmount"
> {
  balance: number;
  monthlyTarget: number | null;
  goalAmount: number | null;
}

export interface SerializedSavingsTransaction extends Omit<SavingsTransaction, "amount"> {
  amount: number;
}

export interface SerializedMonthlyBudget extends Omit<MonthlyBudget, "bankBalance"> {
  bankBalance: number | null;
}

// =============================================================================
// Composite Types
// =============================================================================

export interface MonthlyBudgetSummary extends SerializedMonthlyBudget {
  totalIncome: number;
  totalExpensesForecast: number;
  totalExpensesPaid: number;
  totalExpensesUnpaid: number;
  totalAvailable: number;
}

export interface IncomeEntryWithCategory extends SerializedIncomeEntry {
  category: SerializedCategory;
}

export interface ExpenseEntryWithRelations extends SerializedExpenseEntry {
  category: SerializedCategory;
  savingsBox: { id: number; name: string } | null;
}

export interface MonthlyBudgetDetail extends MonthlyBudgetSummary {
  incomeEntries: IncomeEntryWithCategory[];
  expenseEntries: ExpenseEntryWithRelations[];
}

export interface SavingsBoxWithHistory extends SerializedSavingsBox {
  transactions: SerializedSavingsTransaction[];
  goalProgress: number | null;
}

export interface HouseholdMemberWithUser extends HouseholdMember {
  user: Pick<User, "id" | "name" | "email" | "image">;
}

export interface HouseholdWithMembers extends Household {
  members: HouseholdMemberWithUser[];
}

export interface MonthReference {
  year: number;
  month: number;
}
