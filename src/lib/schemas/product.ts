import { z } from "zod";

// Schema for creating a new product
export const createProductSchema = z.object({
  code: z.string().max(255).optional().nullable(),
  description: z.string().min(1, "Description is required").max(255),
  unitValue: z.number().positive().optional().nullable(),
  unitIdentifier: z.string().max(10).optional().nullable(),
  quantity: z.number().positive().optional().nullable(),
  totalValue: z.number().positive("Total value must be positive"),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

// Schema for updating a product
export const updateProductSchema = z.object({
  code: z.string().max(255).optional().nullable(),
  description: z.string().min(1, "Description is required").max(255).optional(),
  unitValue: z.number().positive().optional().nullable(),
  unitIdentifier: z.string().max(10).optional().nullable(),
  quantity: z.number().positive().optional().nullable(),
  totalValue: z.number().positive("Total value must be positive").optional(),
});

export type UpdateProductInput = z.infer<typeof updateProductSchema>;
