import type { SerializedAdapter } from "@/types/finances";

export interface AdapterModule {
  /** Human-readable label for module selection in UI */
  label: string;
  /** Short description of what this module does */
  description: string;
  /** The execution function */
  execute: (context: AdapterContext) => Promise<AdapterResult>;
}

export interface AdapterContext {
  /** The household this adapter runs for */
  householdId: number;
  /** The monthly budget being populated */
  budgetId: number;
  /** Year/month of the budget */
  year: number;
  month: number;
  /** The adapter DB record */
  adapter: SerializedAdapter;
}

export interface AdapterResult {
  /** Was the adapter execution successful? */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** The expense data to create (omit if no bill found) */
  expense?: {
    description: string;
    amount: number;
    categoryId: number;
    /** Optional attachment file */
    attachment?: {
      filename: string;
      mimeType: string;
      /** Raw file buffer */
      data: Buffer;
    };
  };
}
