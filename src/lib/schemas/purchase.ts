import { z } from "zod";

// Schema for updating a purchase
export const updatePurchaseSchema = z.object({
  storeName: z.string().max(255).optional().nullable(),
  boughtAt: z.string().datetime().optional().nullable(),
  status: z.number().int().min(1).max(2).optional(),
});

export type UpdatePurchaseInput = z.infer<typeof updatePurchaseSchema>;

// Schema for list query parameters
export const purchaseListParamsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.enum(["storeName", "boughtAt", "totalValue", "status", "createdAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  search: z.string().optional(),
  status: z.coerce.number().int().min(1).max(2).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  priceMin: z.coerce.number().optional(),
  priceMax: z.coerce.number().optional(),
});

export type PurchaseListParams = z.infer<typeof purchaseListParamsSchema>;
