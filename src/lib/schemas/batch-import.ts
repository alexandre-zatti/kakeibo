import { z } from "zod";
import { receiptProductSchema } from "./receipt";

// Schema for a single purchase in the batch import
export const batchPurchaseSchema = z.object({
  storeName: z.string().max(255).optional().nullable(),
  purchaseDate: z.string().optional().nullable(), // ISO date string
  totalValue: z.number().positive(),
  products: z.array(receiptProductSchema).min(1),
});

// Schema for the batch import request
export const batchImportRequestSchema = z.object({
  purchases: z.array(batchPurchaseSchema).min(1),
});

// TypeScript types inferred from schemas
export type BatchPurchase = z.infer<typeof batchPurchaseSchema>;
export type BatchImportRequest = z.infer<typeof batchImportRequestSchema>;
