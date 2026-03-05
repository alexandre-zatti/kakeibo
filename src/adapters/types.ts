import type { SerializedAdapter } from "@/types/finances";

/** Actions an adapter can return for the runner to apply */
export type AdapterAction =
  | {
      type: "create_expense";
      data: {
        description: string;
        amount: number;
        categoryId: number;
        attachment?: { filename: string; mimeType: string; data: Buffer };
      };
    }
  | {
      type: "update_expense";
      expenseId: number;
      data: {
        amount?: number;
        description?: string;
        categoryId?: number;
        attachment?: { filename: string; mimeType: string; data: Buffer };
      };
    }
  | {
      type: "enrich_expense";
      expenseId: number;
      attachment?: { filename: string; mimeType: string; data: Buffer };
    };

export interface AdapterModule {
  label: string;
  description: string;
  execute: (context: AdapterContext) => Promise<AdapterResult>;
}

export interface AdapterContext {
  householdId: number;
  budgetId: number;
  year: number;
  month: number;
  adapter: SerializedAdapter;
  /** Set when running for a specific expense (e.g. recurring expense that was just populated) */
  targetExpenseId?: number;
}

export interface AdapterResult {
  success: boolean;
  error?: string;
  /** Actions to apply (empty array = success with no side effects) */
  actions: AdapterAction[];
}
