import { z } from "zod";

// Schema for a single product extracted from receipt
export const receiptProductSchema = z.object({
  code: z.string().max(255).optional().nullable(),
  description: z.string().max(255),
  unitValue: z.number().positive().optional().nullable(),
  unitIdentifier: z.string().max(10).optional().nullable(), // e.g., "kg", "un", "L"
  quantity: z.number().positive().optional().nullable(),
  totalValue: z.number().positive(),
});

// Schema for the complete receipt data from LLM
export const receiptDataSchema = z.object({
  storeName: z.string().max(255).optional().nullable(),
  purchaseDate: z.string().optional().nullable(), // ISO date string or locale format
  totalValue: z.number().positive(),
  products: z.array(receiptProductSchema).min(1),
});

// TypeScript types inferred from schemas
export type ReceiptProduct = z.infer<typeof receiptProductSchema>;
export type ReceiptData = z.infer<typeof receiptDataSchema>;

// Schema for upload request validation
export const uploadRequestSchema = z.object({
  images: z.array(z.string()).min(1).max(3),
});

export type UploadRequest = z.infer<typeof uploadRequestSchema>;
